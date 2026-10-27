import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';

import { AliyunOssProvider, type AliyunOssClient } from './oss';

const configs = {
  region: 'oss-cn-hangzhou',
  endpoint: 'https://oss-cn-hangzhou.aliyuncs.com',
  accessKeyId: 'test-access-key',
  accessKeySecret: 'test-access-secret',
  bucket: 'wan30ai-test',
  uploadPath: '/generated/',
  publicDomain: 'https://media.example.com/',
};

function provider(client: AliyunOssClient) {
  return new AliyunOssProvider(configs, async () => client);
}

test('OSS upload normalizes object keys and returns the permanent public URL', async () => {
  const calls: unknown[][] = [];
  const storage = provider({
    async put(...args) {
      calls.push(args);
      return { res: { status: 200 } };
    },
    async head() {
      return { res: { status: 200 } };
    },
  });

  const result = await storage.uploadFile({
    body: new Uint8Array([1, 2, 3]),
    key: '/videos/result.mp4',
    contentType: 'video/mp4',
    disposition: 'inline',
  });

  assert.equal(result.success, true);
  assert.equal(result.provider, 'aliyun_oss');
  assert.equal(result.key, 'videos/result.mp4');
  assert.equal(
    result.url,
    'https://media.example.com/generated/videos/result.mp4'
  );
  assert.equal(calls[0][0], 'generated/videos/result.mp4');
  assert.deepEqual(calls[0][1], Buffer.from([1, 2, 3]));
});

test('OSS download transfers the remote body through the same provider', async (t: TestContext) => {
  t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(new Uint8Array([4, 5]), {
        headers: { 'content-type': 'video/mp4' },
      })
  );
  const calls: unknown[][] = [];
  const storage = provider({
    async put(...args) {
      calls.push(args);
      return { res: { status: 200 } };
    },
    async head() {
      return { res: { status: 200 } };
    },
  });

  const result = await storage.downloadAndUpload({
    url: 'https://model.example.com/result.mp4',
    key: 'videos/remote.mp4',
  });

  assert.equal(result.success, true);
  assert.deepEqual(calls[0][1], Buffer.from([4, 5]));
});
