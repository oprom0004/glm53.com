import assert from 'node:assert/strict';
import test from 'node:test';

import { POST } from './route';

test('webhook route rejects an unavailable or fallback provider', async () => {
  const response = await POST(
    new Request('https://wan.example/api/payment/notify/attacker', {
      method: 'POST',
      body: '{}',
    }),
    { params: Promise.resolve({ provider: 'attacker' }) }
  );
  assert.equal(response.status, 404);
});
