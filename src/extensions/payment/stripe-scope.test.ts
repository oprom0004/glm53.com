import assert from 'node:assert/strict';
import test from 'node:test';

import { stripeCheckoutMode, stripeKeyMode } from './stripe-mode';
import {
  assertStripeEventScope,
  WANAI_PAYMENT_APP,
} from './stripe-scope';

test('Stripe key and checkout modes are server-derived and must agree', () => {
  assert.equal(stripeKeyMode('sk_test_secret'), 'test');
  assert.equal(stripeKeyMode('rk_live_secret'), 'live');
  assert.equal(stripeKeyMode('pk_test_public'), undefined);
  assert.equal(stripeCheckoutMode('cs_test_123'), 'test');
  assert.equal(stripeCheckoutMode('cs_live_123'), 'live');
});

test('Stripe signed events must match configured mode and Connect account', () => {
  assert.doesNotThrow(() =>
    assertStripeEventScope(
      { livemode: false, account: 'acct_1' },
      { mode: 'test', accountId: 'acct_1' }
    )
  );
  assert.throws(
    () =>
      assertStripeEventScope(
        { livemode: true, account: 'acct_1' },
        { mode: 'test', accountId: 'acct_1' }
      ),
    /mode mismatch/i
  );
  assert.throws(
    () =>
      assertStripeEventScope(
        { livemode: false, account: 'acct_foreign' },
        { mode: 'test', accountId: 'acct_1' }
      ),
    /account mismatch/i
  );
  assert.equal(WANAI_PAYMENT_APP, 'wanai30-lite');
});
