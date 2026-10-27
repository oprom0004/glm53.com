import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';

import {
  PaymentEventType,
  PaymentInterval,
  PaymentStatus,
  PaymentType,
  SubscriptionCycleType,
  SubscriptionStatus,
  type PaymentSession,
} from '@/extensions/payment/types';

import { createPaymentDb, type PaymentDbFixture } from '../test/payment-db';

let fixture: PaymentDbFixture;
let orders: typeof import('../models/order');
let subscriptions: typeof import('../models/subscription');
let credits: typeof import('../models/credit');
let payments: typeof import('./payment');
let events: typeof import('./payment-events');
before(async () => {
  fixture = await createPaymentDb();
  orders = await import('../models/order');
  subscriptions = await import('../models/subscription');
  credits = await import('../models/credit');
  payments = await import('./payment');
  events = await import('./payment-events');
});
beforeEach(async () => fixture.reset());
after(async () => fixture?.close());
const start = new Date('2030-01-01T00:00:00Z');
const end = new Date('2030-02-01T00:00:00Z');
const session = (): PaymentSession => ({
  provider: 'stripe',
  paymentStatus: PaymentStatus.SUCCESS,
  subscriptionId: 'sub_legacy',
  metadata: { user_id: 'owner', order_no: 'initial' },
  paymentInfo: {
    transactionId: 'pi_legacy',
    invoiceId: 'in_legacy',
    amount: 1590,
    currency: 'usd',
    paymentAmount: 1590,
    paymentCurrency: 'usd',
    paymentUserId: 'cus_legacy',
    discountAmount: 0,
    subscriptionCycleType: SubscriptionCycleType.RENEWAL,
  },
  subscriptionInfo: {
    subscriptionId: 'sub_legacy',
    amount: 1590,
    currency: 'usd',
    interval: PaymentInterval.MONTH,
    intervalCount: 1,
    status: SubscriptionStatus.ACTIVE,
    currentPeriodStart: start,
    currentPeriodEnd: end,
  },
  paymentResult: { id: 'in_legacy' },
});
async function seed(status: 'paid' | 'refunded' = 'paid') {
  const subscription = await subscriptions.createSubscription({
    id: 'sub-row',
    subscriptionNo: 'sub-local',
    userId: 'owner',
    userEmail: 'owner@example.invalid',
    paymentProvider: 'stripe',
    subscriptionId: 'sub_legacy',
    status: SubscriptionStatus.ACTIVE,
    productId: 'starter',
    amount: 1590,
    currency: 'usd',
    interval: PaymentInterval.MONTH,
    intervalCount: 1,
    paymentUserId: 'cus_legacy',
    creditsAmount: 800,
    creditsValidDays: 31,
    currentPeriodStart: start,
    currentPeriodEnd: end,
  });
  await orders.createOrder({
    id: 'old-renewal',
    orderNo: 'old-renewal',
    userId: 'owner',
    status,
    amount: 1590,
    currency: 'usd',
    checkoutInfo: '{}',
    productId: 'starter',
    paymentType: PaymentType.RENEW,
    paymentInterval: PaymentInterval.MONTH,
    paymentProvider: 'stripe',
    transactionId: 'in_legacy',
    invoiceId: 'in_legacy',
    subscriptionNo: 'sub-local',
    subscriptionId: 'sub_legacy',
    paymentAmount: 1590,
    paymentCurrency: 'usd',
    paymentUserId: 'cus_legacy',
    creditsAmount: 800,
    creditsValidDays: 31,
  });
  await credits.createCredit({
    id: 'old-grant',
    transactionNo: 'old-grant',
    userId: 'owner',
    orderNo: 'old-renewal',
    subscriptionNo: 'sub-local',
    transactionType: credits.CreditTransactionType.GRANT,
    status:
      status === 'paid'
        ? credits.CreditStatus.ACTIVE
        : credits.CreditStatus.REVOKED,
    credits: 800,
    remainingCredits: status === 'paid' ? 800 : 0,
    expiresAt: end,
  });
  return subscription;
}
for (const status of ['paid', 'refunded'] as const) {
  test(`a replayed legacy ${status} renewal invoice creates no new order or credits`, async () => {
    const subscription = await seed(status);
    const event = {
      eventType: PaymentEventType.PAYMENT_SUCCESS,
      eventResult: {},
      paymentSession: session(),
    };
    assert.equal(
      (await events.handlePaymentEvent({ provider: 'stripe', event })).kind,
      'duplicate'
    );
    // The transaction must independently deduplicate, even without the route guard.
    await Promise.all(
      [1, 2].map(() =>
        payments.handleSubscriptionRenewal({ subscription, session: session() })
      )
    );
    assert.equal(
      (await fixture.client.execute('SELECT count(*) AS n FROM "order"'))
        .rows[0].n,
      1
    );
    assert.equal(
      (await fixture.client.execute('SELECT count(*) AS n FROM credit')).rows[0]
        .n,
      1
    );
    assert.equal(
      (await orders.findOrderByOrderNo('old-renewal'))?.transactionId,
      'in_legacy'
    );
    assert.equal(
      await credits.getRemainingCredits('owner'),
      status === 'paid' ? 800 : 0
    );
  });
}
test('renewal rejects a canonical PaymentIntent that conflicts with the persisted invoice', async () => {
  const subscription = await seed();
  await orders.updateOrderByOrderNo('old-renewal', {
    transactionId: 'pi_different',
  });
  await assert.rejects(
    payments.handleSubscriptionRenewal({ subscription, session: session() }),
    /mismatch/
  );
  await assert.rejects(
    events.handlePaymentEvent({
      provider: 'stripe',
      event: {
        eventType: PaymentEventType.PAYMENT_SUCCESS,
        eventResult: {},
        paymentSession: session(),
      },
    }),
    /mismatch/
  );
  assert.equal(
    (await fixture.client.execute('SELECT count(*) AS n FROM "order"')).rows[0]
      .n,
    1
  );
});
test('subscription reservation validates and locks its owner before returning one concurrent reservation', async () => {
  const request = (userId: string) => ({
    id: crypto.randomUUID(),
    orderNo: crypto.randomUUID(),
    userId,
    checkoutInfo: '{}',
    status: orders.OrderStatus.PENDING,
    amount: 1590,
    currency: 'usd',
    paymentType: PaymentType.SUBSCRIPTION,
    paymentProvider: 'stripe',
    productId: 'starter-monthly-800',
  });
  await assert.rejects(
    orders.reserveSubscriptionOrder(request('missing')),
    /owner/
  );
  const results = await Promise.all(
    Array.from({ length: 5 }, () =>
      orders.reserveSubscriptionOrder(request('owner'))
    )
  );
  assert.equal(new Set(results.map((r) => r.orderNo)).size, 1);
  assert.equal(
    (await fixture.client.execute('SELECT count(*) AS n FROM "order"')).rows[0]
      .n,
    1
  );
});

test('conflicting intent/invoice orders and mismatched legacy owners fail closed', async () => {
  const subscription = await seed();
  const stored = (await orders.findOrderByOrderNo('old-renewal'))!;
  await orders.createOrder({
    ...stored,
    id: 'conflict',
    orderNo: 'conflict',
    transactionId: 'pi_legacy',
    invoiceId: 'in_other',
  });
  await assert.rejects(
    events.handlePaymentEvent({
      provider: 'stripe',
      event: {
        eventType: PaymentEventType.PAYMENT_SUCCESS,
        eventResult: {},
        paymentSession: session(),
      },
    }),
    /ambiguous/
  );
  await assert.rejects(
    payments.handleSubscriptionRenewal({ subscription, session: session() }),
    /ambiguous/
  );
  assert.equal(
    (await fixture.client.execute('SELECT count(*) AS n FROM credit')).rows[0]
      .n,
    1
  );

  await fixture.reset();
  await seed();
  const wrongOwner = session();
  wrongOwner.metadata = { user_id: 'other' };
  await assert.rejects(
    events.handlePaymentEvent({
      provider: 'stripe',
      event: {
        eventType: PaymentEventType.PAYMENT_SUCCESS,
        eventResult: {},
        paymentSession: wrongOwner,
      },
    }),
    /owner mismatch/
  );
});
