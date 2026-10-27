import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';

import {
  PaymentStatus,
  PaymentType,
  type PaymentSession,
} from '@/extensions/payment/types';

import { createPaymentDb, type PaymentDbFixture } from '../test/payment-db';

let fixture: PaymentDbFixture;
let orders: typeof import('./order');
let credits: typeof import('./credit');
let refunds: typeof import('./payment-refund');
before(async () => {
  fixture = await createPaymentDb();
  orders = await import('./order');
  credits = await import('./credit');
  refunds = await import('./payment-refund');
});
beforeEach(async () => fixture.reset());
after(async () => fixture?.close());

async function paidOrder(
  orderNo: string,
  transactionId: string,
  invoiceId: string
) {
  await orders.createOrder({
    id: orderNo,
    orderNo,
    userId: 'owner',
    status: orders.OrderStatus.PAID,
    amount: 1990,
    currency: 'usd',
    productId: 'starter-credits-800-v2',
    paymentType: PaymentType.ONE_TIME,
    paymentProvider: 'stripe',
    checkoutInfo: '{}',
    transactionId,
    invoiceId,
    paymentAmount: 1990,
    paymentCurrency: 'usd',
    creditsAmount: 800,
    creditsValidDays: 0,
  });
  await credits.createCredit({
    id: `grant-${orderNo}`,
    transactionNo: `grant-${orderNo}`,
    userId: 'owner',
    orderNo,
    transactionType: credits.CreditTransactionType.GRANT,
    status: credits.CreditStatus.ACTIVE,
    credits: 800,
    remainingCredits: 800,
  });
}
function refund(
  transactionId: string,
  providerOrderId: string
): PaymentSession {
  return {
    provider: 'stripe',
    paymentStatus: PaymentStatus.SUCCESS,
    refundInfo: {
      refundId: 're_legacy',
      transactionId,
      providerOrderId,
      status: 'succeeded',
      amount: 1990,
      totalRefundedAmount: 1990,
      currency: 'usd',
    },
  };
}

test('legacy Stripe invoice-as-transaction orders retain history and refund through verified invoice linkage', async () => {
  await paidOrder('legacy', 'in_legacy', 'in_legacy');
  await refunds.handlePaymentRefunded({
    session: refund('pi_verified', 'in_legacy'),
  });
  const row = await orders.findOrderByOrderNo('legacy');
  assert.equal(row?.status, 'refunded');
  assert.equal(row?.transactionId, 'in_legacy');
  assert.equal(await credits.getRemainingCredits('owner'), 0);
});

test('legacy Checkout-as-transaction orders refund through verified invoice without rewriting history', async () => {
  await paidOrder('legacy-checkout', 'cs_test_legacy', 'in_legacy');
  await orders.updateOrderByOrderNo('legacy-checkout', {
    paymentSessionId: 'cs_test_legacy',
  });
  await refunds.handlePaymentRefunded({
    session: refund('pi_verified', 'in_legacy'),
  });
  const row = await orders.findOrderByOrderNo('legacy-checkout');
  assert.equal(row?.status, 'refunded');
  assert.equal(row?.transactionId, 'cs_test_legacy');
  assert.equal(await credits.getRemainingCredits('owner'), 0);
});

test('a contradictory legacy Checkout ID cannot use invoice fallback', async () => {
  await paidOrder('legacy-checkout', 'cs_test_legacy', 'in_legacy');
  await orders.updateOrderByOrderNo('legacy-checkout', {
    paymentSessionId: 'cs_test_different',
  });
  await assert.rejects(
    refunds.handlePaymentRefunded({
      session: refund('pi_verified', 'in_legacy'),
    }),
    /mismatch/i
  );
  assert.equal(await credits.getRemainingCredits('owner'), 800);
});

test('canonical PaymentIntent and matching invoice settle once without rewriting identifiers', async () => {
  await paidOrder('canonical', 'pi_verified', 'in_paid');
  await refunds.handlePaymentRefunded({
    session: refund('pi_verified', 'in_paid'),
  });
  await refunds.handlePaymentRefunded({
    session: refund('pi_verified', 'in_paid'),
  });
  assert.equal(
    (await orders.findOrderByOrderNo('canonical'))?.transactionId,
    'pi_verified'
  );
  assert.equal(
    (
      await fixture.client.execute(
        "SELECT * FROM credit WHERE transaction_type = 'refund'"
      )
    ).rows.length,
    1
  );
  assert.equal(await credits.getRemainingCredits('owner'), 0);
});

test('PaymentIntent and invoice pointing at different orders fail closed without revoking either grant', async () => {
  await paidOrder('first', 'pi_first', 'in_first');
  await paidOrder('second', 'pi_second', 'in_second');
  await assert.rejects(
    refunds.handlePaymentRefunded({ session: refund('pi_first', 'in_second') }),
    /mismatch|ambiguous/i
  );
  assert.equal((await orders.findOrderByOrderNo('first'))?.status, 'paid');
  assert.equal((await orders.findOrderByOrderNo('second'))?.status, 'paid');
  assert.equal(await credits.getRemainingCredits('owner'), 1600);
});

test('invoice fallback cannot override a different canonical PaymentIntent on the paid order', async () => {
  await paidOrder('canonical', 'pi_original', 'in_paid');
  await assert.rejects(
    refunds.handlePaymentRefunded({ session: refund('pi_wrong', 'in_paid') }),
    /mismatch/i
  );
  assert.equal((await orders.findOrderByOrderNo('canonical'))?.status, 'paid');
  assert.equal(await credits.getRemainingCredits('owner'), 800);
});

test('a matched PaymentIntent still rejects contradictory persisted invoice linkage', async () => {
  await paidOrder('canonical', 'pi_original', 'in_paid');
  await assert.rejects(
    refunds.handlePaymentRefunded({
      session: refund('pi_original', 'in_wrong'),
    }),
    /mismatch/i
  );
  assert.equal((await orders.findOrderByOrderNo('canonical'))?.status, 'paid');
  assert.equal(await credits.getRemainingCredits('owner'), 800);
});
