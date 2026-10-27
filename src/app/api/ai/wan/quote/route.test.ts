import assert from 'node:assert/strict';
import { test } from 'node:test';

import { handleWanApi } from '@/shared/services/wan-video-api';

const configs = {
  polaris_api_key: 'fixture-key',
  polaris_wan30_model: 'wan3.0-video',
  r2_account_id: '0123456789abcdef0123456789abcdef',
  r2_domain: 'https://media.wanai30.com',
  r2_bucket_name: 'fixture-bucket',
  r2_access_key: 'fixture-id',
  r2_secret_key: 'fixture-secret',
};

function quoteRequest(body: unknown) {
  return new Request('https://wan.example/api/ai/wan/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('quote requires authentication and returns a server-calculated snapshot', async () => {
  const input = {
    version: '3.0',
    tier: 'standard',
    mode: 'text',
    duration: 3,
    resolution: '480P',
    ratio: '16:9',
    credits: 1,
  };
  const unauthenticated = await handleWanApi('quote', quoteRequest(input), {
    getUser: async () => null,
    getConfigs: async () => configs,
  });
  assert.equal(unauthenticated.status, 401);

  const response = await handleWanApi('quote', quoteRequest(input), {
    getUser: async () => ({ id: 'user-1' }),
    getConfigs: async () => configs,
  });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data, {
    credits: 11,
    normalizedInput: {
      version: '3.0',
      tier: 'standard',
      mode: 'text',
      duration: 3,
      resolution: '480P',
      ratio: '16:9',
    },
    quoteVersion: 'wan-pricing-v1',
  });
});

test('quote rejects malformed JSON, cross-origin calls and disabled resolutions', async () => {
  const deps = {
    getUser: async () => ({ id: 'user-1' }),
    getConfigs: async () => configs,
  };
  const malformed = await handleWanApi(
    'quote',
    new Request('https://wan.example/api/ai/wan/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    }),
    deps
  );
  assert.equal(malformed.status, 400);

  const forbidden = await handleWanApi(
    'quote',
    new Request('https://wan.example/api/ai/wan/quote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://evil.example',
      },
      body: '{}',
    }),
    deps
  );
  assert.equal(forbidden.status, 403);

  const disabled = await handleWanApi(
    'quote',
    quoteRequest({
      version: '2.5',
      tier: 'standard',
      mode: 'text',
      duration: 5,
      resolution: '1080P',
      ratio: 'adaptive',
    }),
    {
      ...deps,
      getConfigs: async () => ({
        ...configs,
        polaris_wan25_text_model: 'wan2.5-t2v-preview',
      }),
    }
  );
  assert.equal(disabled.status, 503);
  assert.equal((await disabled.json()).message, 'pricing_not_configured');
});
