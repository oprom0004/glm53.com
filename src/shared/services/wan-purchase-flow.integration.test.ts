import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PaymentInterval,
  PaymentStatus,
  SubscriptionStatus,
} from '@/extensions/payment/types';
import { planPaymentRefund } from '@/shared/models/payment-refund';
import { shouldApplyPaymentState } from '@/shared/services/payment-events';

import { buildCheckoutMetadata, validatePayment } from './payment-validation';
import {
  resolveSubscriptionPlan,
  safeLocalReturnPath,
} from './subscription-plans';

test('approved Stripe plan survives checkout, signed settlement, replay and refund contracts', () => {
  const plan = resolveSubscriptionPlan('starter', {
    stripe_price_starter: 'price_starter_fixture',
  });
  const metadata = buildCheckoutMetadata(
    { order_no: 'attacker', user_id: 'attacker', amount: 1 },
    { app_name: 'wanai30-lite', order_no: 'order_1', user_id: 'user_1' }
  );
  assert.equal(metadata.order_no, 'order_1');
  assert.equal(metadata.user_id, 'user_1');

  const start = new Date('2026-09-01T00:00:00Z');
  const end = new Date('2026-10-01T00:00:00Z');
  assert.doesNotThrow(() =>
    validatePayment(
      {
        provider: 'stripe',
        paymentStatus: PaymentStatus.SUCCESS,
        metadata,
        subscriptionId: 'sub_1',
        paymentInfo: {
          transactionId: 'pi_1',
          amount: plan.amount,
          currency: plan.currency,
          discountAmount: 0,
          paymentAmount: plan.amount,
          paymentCurrency: plan.currency,
        },
        subscriptionInfo: {
          subscriptionId: 'sub_1',
          amount: plan.amount,
          currency: plan.currency,
          interval: PaymentInterval.MONTH,
          intervalCount: 1,
          currentPeriodStart: start,
          currentPeriodEnd: end,
          status: SubscriptionStatus.ACTIVE,
        },
      },
      {
        paymentProvider: 'stripe',
        amount: plan.amount,
        currency: plan.currency,
        userId: 'user_1',
        orderNo: 'order_1',
      }
    )
  );

  assert.equal(shouldApplyPaymentState(undefined, 100), true);
  assert.equal(shouldApplyPaymentState(100, 100), false);
  assert.equal(shouldApplyPaymentState(100, 99), false);
  assert.deepEqual(
    planPaymentRefund({
      paidAmount: plan.amount,
      refundAmount: plan.amount,
      totalRefundedAmount: plan.amount,
      grants: [{ credits: plan.credits, remainingCredits: 600 }],
      alreadyReclaimed: 0,
    }),
    {
      full: true,
      reclaimedCredits: 600,
      consumedCredits: 200,
      reviewRequired: true,
    }
  );
  assert.equal(
    safeLocalReturnPath('https://attacker.example', '/settings/payments'),
    '/settings/payments'
  );
});
