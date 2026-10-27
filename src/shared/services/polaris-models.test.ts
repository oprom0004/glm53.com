import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  checkPolarisModels,
  readPolarisModelsForAdmin,
} from './polaris-model-check';

const configs = {
  polaris_api_key: 'test-private-key',
  polaris_base_url: 'https://api.polariscore.ai/',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

test('model check uses the approved endpoint and returns only safe unique Wan IDs', async () => {
  const result = await checkPolarisModels(configs, async (url, options) => {
    assert.equal(url, 'https://api.polariscore.ai/v1/models');
    assert.equal(options?.method, 'GET');
    assert.equal(options?.redirect, 'error');
    assert.equal(
      new Headers(options?.headers).get('Authorization'),
      'Bearer test-private-key'
    );
    return json({
      data: [
        { id: 'wan2.5-t2v-preview' },
        { id: 'wan2.6-t2v' },
        { id: 'wan2.6-t2v' },
        { id: 'wan3.0-video-prime', private: 'must-not-return' },
        { id: 'gpt-example' },
        { id: 'wan2.5-<script>' },
      ],
    });
  });

  assert.deepEqual(result, [
    'wan2.5-t2v-preview',
    'wan2.6-t2v',
    'wan3.0-video-prime',
  ]);
});

test('missing keys, unsafe origins and upstream errors become safe codes', async () => {
  let calls = 0;
  const request = async () => {
    calls++;
    return json({ data: [] });
  };
  await assert.rejects(checkPolarisModels({}, request), /^Error: missing_key$/);
  await assert.rejects(
    checkPolarisModels(
      { ...configs, polaris_base_url: 'https://127.0.0.1' },
      request
    ),
    /^Error: invalid_base_url$/
  );
  assert.equal(calls, 0);

  await assert.rejects(
    checkPolarisModels(configs, async () => json({ error: 'secret' }, 401)),
    /^Error: invalid_key$/
  );
});

test('admin model check authorizes before reading config or contacting Polaris', async () => {
  let reads = 0;
  let requests = 0;
  const deps = {
    getUser: async (): Promise<{ id: string } | null> => null,
    canManageSettings: async () => false,
    getConfigs: async () => {
      reads++;
      return configs;
    },
    request: async () => {
      requests++;
      return json({ data: [] });
    },
  };

  assert.deepEqual(await readPolarisModelsForAdmin(deps), {
    status: 401,
    error: 'unauthenticated',
  });
  deps.getUser = async () => ({ id: 'user' });
  assert.deepEqual(await readPolarisModelsForAdmin(deps), {
    status: 403,
    error: 'forbidden',
  });
  assert.equal(reads, 0);
  assert.equal(requests, 0);
});
