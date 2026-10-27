import assert from 'node:assert/strict';
import { test } from 'node:test';

import { handleWanApi } from '@/shared/services/wan-video-api';

function json(body: unknown) {
  return new Request('https://wan.example/api/ai/wan/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('generate delegates once for the authenticated user and returns no-store', async () => {
  let calls = 0;
  const response = await handleWanApi('generate', json({ requestId: 'x' }), {
    getUser: async () => ({ id: 'user-1' }),
    getConfigs: async () => ({}),
    submit: async (userId, body) => {
      calls++;
      assert.equal(userId, 'user-1');
      assert.deepEqual(body, { requestId: 'x' });
      return {
        id: 'wan-task',
        status: 'processing' as const,
        phase: 'processing' as const,
        costCredits: 25,
      };
    },
  });
  assert.equal(calls, 1);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal((await response.json()).data.costCredits, 25);
});

test('generate maps pricing, balance and idempotency errors without leaking details', async () => {
  for (const [code, status] of [
    ['insufficient_credits', 402],
    ['price_changed', 409],
    ['idempotency_conflict', 409],
  ] as const) {
    const response = await handleWanApi('generate', json({}), {
      getUser: async () => ({ id: 'user-1' }),
      getConfigs: async () => ({}),
      submit: async () => {
        throw new Error(code);
      },
    });
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), { code: -1, message: code });
  }
});
