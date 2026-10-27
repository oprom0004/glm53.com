import assert from 'node:assert/strict';
import test from 'node:test';

import {
  mapStripeEventType,
  normalizeStripeRefund,
  StripeProvider,
} from './stripe';
import { PaymentEventType } from './types';

test('Stripe refuses a checkout session from another environment before retrieval', async () => {
  const provider = new StripeProvider({
    secretKey: 'sk_test_example',
    publishableKey: 'pk_test_example',
    signingSecret: 'whsec_example',
  });
  await assert.rejects(
    provider.getPaymentSession({ sessionId: 'cs_live_foreign' }),
    /checkout_needs_review/i
  );
});

test('Stripe maps refund lifecycle events to the normalized refund event', () => {
  assert.equal(
    mapStripeEventType('refund.created'),
    PaymentEventType.PAYMENT_REFUNDED
  );
  assert.equal(
    mapStripeEventType('refund.updated'),
    PaymentEventType.PAYMENT_REFUNDED
  );
});

test('Stripe refund normalization keeps cumulative amount and invoice linkage', () => {
  assert.deepEqual(
    normalizeStripeRefund({
      refund: {
        id: 're_123',
        amount: 500,
        currency: 'usd',
        status: 'succeeded',
        payment_intent: 'pi_123',
      },
      charge: {
        amount_refunded: 800,
        currency: 'usd',
        payment_intent: 'pi_123',
      },
      invoiceId: 'in_123',
    }),
    {
      refundId: 're_123',
      transactionId: 'pi_123',
      providerOrderId: 'in_123',
      amount: 500,
      currency: 'usd',
      totalRefundedAmount: 800,
      status: 'succeeded',
    }
  );
});

test('Stripe refund normalization rejects a charge from another payment intent', () => {
  assert.throws(
    () =>
      normalizeStripeRefund({
        refund: {
          id: 're_123',
          amount: 500,
          currency: 'usd',
          status: 'succeeded',
          payment_intent: 'pi_123',
        },
        charge: {
          amount_refunded: 500,
          currency: 'usd',
          payment_intent: 'pi_foreign',
        },
      }),
    /payment intent mismatch/i
  );
});
