import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cleanupUploadParts } from './upload-parts-cleanup';
import { handleUploadPartsCron } from './upload-parts-cron';

const configs = {
  accountId: 'a'.repeat(32),
  accessKeyId: 'test',
  secretAccessKey: 'test',
  bucket: 'shared-bucket',
  uploadPath: 'wanai30',
  publicDomain: 'https://media.example.com',
};
const prefix = 'wanai30/wan-upload-parts/';
const part = `${prefix}${'b'.repeat(64)}/12345678-1234-1234-1234-123456789abc/0`;
const now = Date.parse('2026-09-27T12:00:00Z');
const old = '2026-09-25T12:00:00Z';
function listing(
  items: [string, string][],
  next?: string,
  listedPrefix = prefix
) {
  return new Response(
    `<ListBucketResult><Prefix>${listedPrefix}</Prefix><IsTruncated>${!!next}</IsTruncated>${items.map(([key, date]) => `<Contents><Key>${key}</Key><LastModified>${date}</LastModified></Contents>`).join('')}${next ? `<NextContinuationToken>${next}</NextContinuationToken>` : ''}</ListBucketResult>`
  );
}

test('cleanup only deletes expired valid staging parts and follows a scoped cursor', async () => {
  const deleted: string[] = [];
  let pages = 0;
  const result = await cleanupUploadParts(configs, {
    now,
    request: async (url, init) => {
      const parsed = new URL(url);
      if (init.method === 'DELETE') {
        deleted.push(parsed.pathname);
        return new Response(null, { status: 204 });
      }
      assert.equal(parsed.searchParams.get('prefix'), prefix);
      assert.equal(parsed.searchParams.get('max-keys'), '500');
      pages++;
      if (pages === 1)
        return listing(
          [
            [part, old],
            [part.replace('wanai30/', 'lipsync/'), old],
            ['wanai30/completed.mp4', old],
            [`${prefix}unexpected.mp4`, old],
            [part.replace('/0', '/1'), '2026-09-27T11:50:00Z'],
            [part.replace('/0', '/2'), 'invalid'],
            [part.replace('/0', '/3'), '2026-09-26T12:00:00Z'],
          ],
          'next-page'
        );
      assert.equal(parsed.searchParams.get('continuation-token'), 'next-page');
      return listing([[part.replace('/0', '/4'), old]]);
    },
  });
  assert.deepEqual(deleted, [
    `/shared-bucket/${part}`,
    `/shared-bucket/${part.replace('/0', '/4')}`,
  ]);
  assert.deepEqual(result, {
    scanned: 8,
    deleted: 2,
    skipped: 6,
    failed: 0,
    hasMore: false,
  });
});

test('cleanup reports delete failures and a bounded remaining backlog', async () => {
  const result = await cleanupUploadParts(configs, {
    now,
    maxPages: 1,
    request: async (_url, init) =>
      init.method === 'DELETE'
        ? new Response(null, { status: 403 })
        : listing([[part, old]], 'next'),
  });
  assert.deepEqual(result, {
    scanned: 1,
    deleted: 0,
    skipped: 0,
    failed: 1,
    hasMore: true,
  });
});

test('cleanup rejects wrong prefixes, malformed listings, forbidden XML declarations and denied lists', async () => {
  for (const response of [
    listing([[part, old]], undefined, 'other/'),
    new Response('<invalid/>'),
    new Response('<!DOCTYPE data [<!ENTITY test "hello">]><ListBucketResult/>'),
    new Response('private storage error', { status: 403 }),
  ]) {
    let deletes = 0;
    await assert.rejects(
      cleanupUploadParts(configs, {
        now,
        request: async (_url, init) => {
          if (init.method === 'DELETE') deletes++;
          return response;
        },
      })
    );
    assert.equal(deletes, 0);
  }
});

test('cleanup cron authenticates before storage work and sanitizes failures', async () => {
  let calls = 0;
  const summary = {
    scanned: 0,
    deleted: 0,
    skipped: 0,
    failed: 0,
    hasMore: false,
  };
  const request = (token: string) =>
    new Request('https://wanai30.com/api/cron/upload-parts', {
      headers: { authorization: token },
    });
  const unauthorized = await handleUploadPartsCron(
    request('Bearer wrong'),
    'secret',
    async () => {
      calls++;
      return summary;
    }
  );
  assert.equal(unauthorized.status, 401);
  assert.equal(calls, 0);
  const ok = await handleUploadPartsCron(
    request('Bearer secret'),
    'secret',
    async () => summary
  );
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('cache-control'), 'private, no-store');
  const partial = await handleUploadPartsCron(
    request('Bearer secret'),
    'secret',
    async () => ({ ...summary, failed: 1 })
  );
  assert.equal(partial.status, 503);
  const fatal = await handleUploadPartsCron(
    request('Bearer secret'),
    'secret',
    async () => {
      throw new Error('private secret');
    }
  );
  assert.equal(fatal.status, 503);
  assert.deepEqual(await fatal.json(), { error: 'upload_cleanup_unavailable' });
});
