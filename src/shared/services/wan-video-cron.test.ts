import assert from 'node:assert/strict';
import { test } from 'node:test';

import { handleWanVideoCron } from './wan-video-cron';

test('recovery rejects missing or incorrect credentials without touching tasks', async () => {
  let calls = 0;
  const sweep = async () => {
    calls++;
  };
  for (const [secret, authorization] of [
    ['', 'Bearer '],
    ['private-test-secret', ''],
    ['private-test-secret', 'Bearer incorrect'],
  ]) {
    const response = await handleWanVideoCron(
      new Request('https://wanai30.com/api/cron/wan-videos', {
        headers: { authorization },
      }),
      secret,
      sweep
    );
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  }
  assert.equal(calls, 0);
});

test('authenticated recovery is awaited and does not expose upstream failure details', async () => {
  const request = new Request('https://wanai30.com/api/cron/wan-videos', {
    headers: { authorization: 'Bearer test-secret' },
  });
  let finished = false;
  const ok = await handleWanVideoCron(request, 'test-secret', async () => {
    await Promise.resolve();
    finished = true;
  });
  assert.equal(ok.status, 200);
  assert.equal(finished, true);
  const failed = await handleWanVideoCron(request, 'test-secret', async () => {
    throw new Error('private vendor key');
  });
  assert.equal(failed.status, 503);
  assert.deepEqual(await failed.json(), { error: 'recovery_unavailable' });
  const retry = await handleWanVideoCron(request, 'test-secret', async () => ({
    scanned: 51,
    processed: 1,
    failed: 1,
  }));
  assert.equal(retry.status, 503);
  assert.deepEqual(await retry.json(), {
    ok: false,
    result: { scanned: 51, processed: 1, failed: 1 },
  });
});
