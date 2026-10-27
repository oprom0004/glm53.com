import assert from 'node:assert/strict';
import { test } from 'node:test';

import { handleWanApi } from '@/shared/services/wan-video-api';

const configs = {
  polaris_api_key: 'fixture-key',
  polaris_wan25_text_model: 'wan2.5-t2v-preview',
  r2_account_id: '0123456789abcdef0123456789abcdef',
  r2_domain: 'https://media.wanai30.com',
  r2_bucket_name: 'fixture-bucket',
  r2_access_key: 'fixture-id',
  r2_secret_key: 'fixture-secret',
};

test('capabilities are public, no-store and never disclose provider configuration', async () => {
  let userReads = 0;
  const response = await handleWanApi(
    'capabilities',
    new Request(
      'https://wan.example/api/ai/wan/capabilities?version=2.5&mode=text'
    ),
    {
      getUser: async () => {
        userReads += 1;
        return null;
      },
      getConfigs: async () => configs,
    }
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(userReads, 0);
  assert.deepEqual(body.data.duration, { min: 2, max: 10, initial: 5 });
  assert.equal(body.data.tiers.standard.resolutions['1080P'].enabled, false);
  assert.equal(JSON.stringify(body).includes('fixture-key'), false);
});

test('capabilities reject invalid versions and modes with stable errors', async () => {
  const response = await handleWanApi(
    'capabilities',
    new Request(
      'https://wan.example/api/ai/wan/capabilities?version=9.9&mode=reference'
    ),
    { getUser: async () => null, getConfigs: async () => configs }
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    code: -1,
    message: 'invalid_params',
  });
});
