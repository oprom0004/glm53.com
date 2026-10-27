import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getStorageServiceWithConfigs } from '@/shared/services/storage';
import { getWanVideoStorage } from '@/shared/services/wan-video-storage';

import { R2Provider } from './r2';

const configs = {
  r2_account_id: '0123456789abcdef0123456789abcdef',
  r2_access_key: 'test-access',
  r2_secret_key: 'test-secret',
  r2_bucket_name: 'wanai-media',
  r2_upload_path: '/uploads/',
  r2_domain: 'https://media.wanai30.com/',
};

test('R2 is the only active storage even with leftover OSS credentials', () => {
  const manager = getStorageServiceWithConfigs({
    ...configs,
    aliyun_oss_region: 'oss-cn-hangzhou',
    aliyun_oss_bucket: 'old-bucket',
    aliyun_oss_access_key_id: 'old-id',
    aliyun_oss_access_key_secret: 'old-secret',
  });
  assert.deepEqual(manager.getProviderNames(), ['r2']);
  assert.equal(
    manager.getPublicUrl({ key: 'video.mp4' }),
    'https://media.wanai30.com/uploads/video.mp4'
  );
  assert.doesNotThrow(() => getWanVideoStorage(configs));
  assert.throws(
    () => getWanVideoStorage({ ...configs, r2_domain: '' }),
    /storage_not_configured/
  );
  assert.throws(
    () =>
      getWanVideoStorage({
        ...configs,
        r2_domain: `https://${configs.r2_account_id}.r2.cloudflarestorage.com`,
      }),
    /storage_not_configured/
  );
  assert.doesNotThrow(() =>
    getWanVideoStorage({
      ...configs,
      r2_account_id: '',
      r2_endpoint: `https://${configs.r2_account_id}.r2.cloudflarestorage.com`,
    })
  );
});

test('R2 signs uploads and HEAD against S3 endpoint, returns public domain without credentials', async (t) => {
  const requests: Request[] = [];
  t.mock.method(globalThis, 'fetch', async (input: Request) => {
    requests.push(input);
    return new Response(null, { status: 200 });
  });
  const provider = new R2Provider({
    accountId: configs.r2_account_id,
    accessKeyId: configs.r2_access_key,
    secretAccessKey: configs.r2_secret_key,
    bucket: configs.r2_bucket_name,
    endpoint: `https://${configs.r2_account_id}.r2.cloudflarestorage.com/`,
    publicDomain: configs.r2_domain,
    uploadPath: configs.r2_upload_path,
  });
  const result = await provider.uploadFile({
    key: 'wan-videos/example.mp4',
    body: new Uint8Array([1, 2, 3]),
    contentType: 'video/mp4',
  });
  assert.equal(result.success, true);
  assert.equal(
    result.url,
    'https://media.wanai30.com/uploads/wan-videos/example.mp4'
  );
  assert.equal(await provider.exists({ key: 'wan-videos/example.mp4' }), true);
  assert.deepEqual(
    requests.map((request) => request.method),
    ['PUT', 'HEAD']
  );
  for (const request of requests) {
    assert.equal(
      request.url,
      `https://${configs.r2_account_id}.r2.cloudflarestorage.com/wanai-media/uploads/wan-videos/example.mp4`
    );
    assert.match(
      request.headers.get('Authorization') || '',
      /AWS4-HMAC-SHA256.*auto\/s3\/aws4_request/
    );
    assert.equal(request.redirect, 'error');
  }
});
