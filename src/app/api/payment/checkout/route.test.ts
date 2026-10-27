import assert from 'node:assert/strict';
import test from 'node:test';

import { POST } from './route';

function request(body: unknown) {
  return new Request('https://wan.example/api/payment/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('public checkout rejects client-owned provider and price fields before authentication', async () => {
  for (const body of [
    { planId: 'starter', provider: 'paypal' },
    { planId: 'starter', payment_provider: 'creem' },
    { planId: 'starter', amount: 1 },
    { planId: 'starter', currency: 'cny' },
    { planId: 'starter', priceId: 'price_attacker' },
  ]) {
    const response = await POST(request(body));
    assert.equal(response.status, 400);
    assert.equal(
      (await response.json()).message,
      'checkout_parameters_are_server_owned'
    );
  }
});

test('valid public checkout requires an authenticated user', async () => {
  const response = await POST(request({ planId: 'starter' }));
  assert.equal(response.status, 401);
  assert.equal((await response.json()).message, 'unauthenticated');
});
