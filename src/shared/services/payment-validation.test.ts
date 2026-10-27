import assert from 'node:assert/strict';
import test from 'node:test';

import type { PaymentSession } from '@/extensions/payment/types';

import { buildCheckoutMetadata, validatePayment } from './payment-validation';

function session(overrides: Partial<PaymentSession> = {}): PaymentSession {
  return {
    provider: 'stripe',
    paymentStatus: 'success' as any,
    metadata: { order_no: 'order-1', user_id: 'user-1' },
    paymentInfo: {
      transactionId: 'pi_1',
      amount: 1590,
      currency: 'usd',
      paymentAmount: 1590,
      paymentCurrency: 'usd',
      discountAmount: 0,
    },
    ...overrides,
  } as PaymentSession;
}

const expected = {
  paymentProvider: 'stripe',
  amount: 1590,
  currency: 'usd',
  paymentProductId: 'price_starter',
  userId: 'user-1',
  orderNo: 'order-1',
};

test('reserved checkout metadata cannot be overwritten by public custom metadata', () => {
  assert.deepEqual(
    buildCheckoutMetadata(
      { campaign: 'launch', user_id: 'attacker', order_no: 'foreign' },
      { app_name: 'wanai30-lite', user_id: 'user-1', order_no: 'order-1' }
    ),
    {
      campaign: 'launch',
      app_name: 'wanai30-lite',
      user_id: 'user-1',
      order_no: 'order-1',
    }
  );
});

test('payment validation rejects provider, owner, order, currency and amount tampering', () => {
  assert.doesNotThrow(() => validatePayment(session(), expected));
  assert.throws(
    () => validatePayment(session({ provider: 'creem' }), expected),
    /provider mismatch/i
  );
  assert.throws(
    () =>
      validatePayment(
        session({ metadata: { order_no: 'order-1', user_id: 'user-2' } }),
        expected
      ),
    /owner mismatch/i
  );
  assert.throws(
    () =>
      validatePayment(
        session({ metadata: { order_no: 'other', user_id: 'user-1' } }),
        expected
      ),
    /order mismatch/i
  );
  assert.throws(
    () =>
      validatePayment(
        session({ paymentInfo: { ...session().paymentInfo!, currency: 'eur' } }),
        expected
      ),
    /currency mismatch/i
  );
  assert.throws(
    () =>
      validatePayment(
        session({ paymentInfo: { ...session().paymentInfo!, amount: 1 } }),
        expected
      ),
    /amount mismatch/i
  );
});
