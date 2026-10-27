import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';

import type {
  StorageProvider,
  StorageUploadOptions,
} from '@/extensions/storage';

import { WanVideoStorage } from './wan-video-storage';

const aliceHash =
  '2bd806c97f0e00af1a1fc3328fa763a9269723c8db8fac4f93af71db186d6e90';
const imageId = '4c872dc8-4973-4f85-86ad-93b837fa6630';
const taskId = 'd35d6267-0e71-4a4a-8e36-8fb9f0fd1f3d';
const base = 'https://media.example.com/uploads/';
const inputUrl = `${base}wan-inputs/${aliceHash}/${imageId}.png`;
const videoUrl = `${base}wan-videos/${aliceHash}/${taskId}.mp4`;
const sourceUrl =
  'https://wan-results.oss-cn-hangzhou.aliyuncs.com/result.mp4?Signature=temporary';
const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const mp4 = Buffer.from(
  '000000186674797069736f6d0000020069736f6d69736f32',
  'hex'
);

function boundary() {
  const uploads: StorageUploadOptions[] = [];
  const provider: StorageProvider = {
    name: 'r2',
    configs: {},
    getPublicUrl: ({ key }) => `${base}${key}`,
    exists: async () => false,
    uploadFile: async (options) => {
      uploads.push(options);
      return {
        success: true,
        provider: 'r2',
        url: `${base}${options.key}`,
      };
    },
    downloadAndUpload: async () => {
      throw new Error('generic downloader must not be used');
    },
  };
  return { provider, uploads };
}

test('input media accepts only the current user canonical R2 namespace', () => {
  const storage = new WanVideoStorage(boundary().provider);
  assert.equal(storage.validateInputUrl('alice', inputUrl), true);
  assert.equal(storage.validateInputUrl('bob', inputUrl), false);
  for (const invalid of [
    inputUrl.replace('https:', 'http:'),
    inputUrl.replace('media.example.com', 'evil.example.com'),
    `${inputUrl}?token=secret`,
    `${inputUrl}#fragment`,
    inputUrl.replace('.png', '.svg'),
  ]) {
    assert.equal(storage.validateInputUrl('alice', invalid), false, invalid);
  }
});

test('image uploads verify MIME magic and use a random user-scoped object key', async () => {
  const { provider, uploads } = boundary();
  const storage = new WanVideoStorage(provider);
  const result = await storage.uploadImage(
    'alice',
    new File(
      [
        new Uint8Array(
          await sharp({
            create: {
              width: 240,
              height: 240,
              channels: 3,
              background: '#446688',
            },
          })
            .png()
            .toBuffer()
        ),
      ],
      '../../unsafe.svg',
      { type: 'image/png' }
    )
  );
  assert.match(
    uploads[0].key,
    new RegExp(`^wan-inputs/${aliceHash}/[0-9a-f-]{36}\\.png$`)
  );
  assert.equal(result.url, `${base}${uploads[0].key}`);
  await assert.rejects(
    storage.uploadImage(
      'alice',
      new File(['<svg/>'], 'fake.png', { type: 'image/png' })
    ),
    /invalid_image/
  );
});

test('invalid dimensions, transparency and broken image data are rejected before R2 upload', async () => {
  const { provider, uploads } = boundary();
  const storage = new WanVideoStorage(provider);
  for (const [width, height, alpha] of [
    [239, 480, 1],
    [8001, 240, 1],
    [2000, 240, 1],
    [240, 240, 0.5],
  ]) {
    const body = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 30, g: 60, b: 90, alpha },
      },
    })
      .png()
      .toBuffer();
    await assert.rejects(
      storage.uploadImage(
        'alice',
        new File([new Uint8Array(body)], 'input.png', { type: 'image/png' })
      ),
      /invalid_image/
    );
  }
  await assert.rejects(
    storage.uploadImage(
      'alice',
      new File([png], 'truncated.png', { type: 'image/png' })
    ),
    /invalid_image/
  );
  assert.equal(uploads.length, 0);
});

test('valid JPEG, WebP and opaque RGBA PNG retain their original bytes', async () => {
  for (const format of ['jpeg', 'webp', 'png'] as const) {
    const { provider, uploads } = boundary();
    const body = await sharp({
      create: {
        width: 1920,
        height: 240,
        channels: 4,
        background: { r: 30, g: 60, b: 90, alpha: 1 },
      },
    })
      .toFormat(format)
      .toBuffer();
    await new WanVideoStorage(provider).uploadImage(
      'alice',
      new File([new Uint8Array(body)], `image.${format}`, {
        type: `image/${format}`,
      })
    );
    assert.equal(uploads.length, 1);
    assert.deepEqual(uploads[0].body, body);
  }
});

test('video persistence validates provider output and returns the permanent R2 URL', async () => {
  const { provider, uploads } = boundary();
  let requests = 0;
  const storage = new WanVideoStorage(provider, async (url, options) => {
    requests++;
    assert.equal(url, sourceUrl);
    assert.equal(options?.redirect, 'error');
    return new Response(mp4, { headers: { 'Content-Type': 'video/mp4' } });
  });
  assert.equal(await storage.saveVideo('alice', taskId, sourceUrl), videoUrl);
  assert.equal(uploads[0].contentType, 'video/mp4');
  assert.equal(requests, 1);
  await assert.rejects(
    storage.saveVideo('alice', taskId, 'http://127.0.0.1/private.mp4'),
    /storage_pending/
  );
  assert.equal(requests, 1);
});

test('custom result hosts are explicitly allowed, never matched by suffix or redirected', async () => {
  const { provider } = boundary();
  let calls = 0;
  const request: typeof fetch = async (_url, options) => {
    calls++;
    assert.equal(options?.redirect, 'error');
    return new Response(mp4, { headers: { 'Content-Type': 'video/mp4' } });
  };
  const customUrl = 'https://cdn.provider.com/result.mp4?signature=temporary';
  await assert.rejects(
    new WanVideoStorage(provider, request).saveVideo(
      'alice',
      taskId,
      customUrl
    ),
    /storage_pending/
  );
  assert.equal(calls, 0);
  const storage = new WanVideoStorage(provider, request, ['cdn.provider.com']);
  assert.equal(await storage.saveVideo('alice', taskId, customUrl), videoUrl);
  for (const source of [
    'https://cdn.provider.com.evil.com/a.mp4',
    'https://sub.cdn.provider.com/a.mp4',
    'https://cdn.provider.com@127.0.0.1/a.mp4',
  ])
    await assert.rejects(
      storage.saveVideo('alice', taskId, source),
      /storage_pending/
    );
  assert.equal(calls, 1);
});

test('Kie result CDN is allowed by exact hostname and retains download checks', async () => {
  const { provider } = boundary();
  let calls = 0;
  const storage = new WanVideoStorage(provider, async (_url, options) => {
    calls++;
    assert.equal(options?.redirect, 'error');
    return new Response(mp4, { headers: { 'Content-Type': 'video/mp4' } });
  });
  assert.equal(
    await storage.saveVideo(
      'alice',
      taskId,
      'https://tempfile.aiquickdraw.com/wan30/result.mp4'
    ),
    videoUrl
  );
  await assert.rejects(
    storage.saveVideo(
      'alice',
      taskId,
      'https://tempfile.aiquickdraw.com.evil.com/result.mp4'
    ),
    /storage_pending/
  );
  assert.equal(calls, 1);
});
