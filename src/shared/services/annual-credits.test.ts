import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';

import { PaymentManager } from '@/extensions/payment';
import {
  PaymentInterval,
  PaymentStatus,
  PaymentType,
  SubscriptionStatus,
  type PaymentSession,
} from '@/extensions/payment/types';

import { createPaymentDb, type PaymentDbFixture } from '../test/payment-db';

test('scheduled settlement grants an unattended month once and does not restore spent credits', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: start });
  await annualPayment();
  const { sweepAnnualCredits } = await import('./annual-credits');
  const secondMonth = new Date('2028-02-29T08:15:00Z');
  t.mock.timers.setTime(+secondMonth);
  assert.deepEqual(await sweepAnnualCredits(secondMonth), {
    processed: 1,
    failed: 0,
    hasMore: false,
  });
  const rows = (
    await fixture.client.execute(
      "SELECT * FROM credit WHERE transaction_scene='annual_monthly_v1'"
    )
  ).rows;
  assert.equal(rows.length, 2);
  assert.equal(
    rows.filter((r) => Number(r.expires_at) > +secondMonth).length,
    1
  );
  await credits.consumeCredits({ userId: 'owner', credits: 2400 });
  assert.deepEqual(await sweepAnnualCredits(secondMonth), {
    processed: 0,
    failed: 0,
    hasMore: false,
  });
  assert.equal(await credits.getRemainingCredits('owner'), 0);
  assert.equal(
    (
      await fixture.client.execute(
        "SELECT * FROM credit WHERE transaction_scene='annual_monthly_v1'"
      )
    ).rows.length,
    2
  );
});

test('scheduled settlement races safely with balance reads and stops after a full refund', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: start });
  await annualPayment();
  const { sweepAnnualCredits } = await import('./annual-credits');
  const now = new Date('2028-02-29T08:15:00Z');
  t.mock.timers.setTime(+now);
  await Promise.all([
    sweepAnnualCredits(now),
    sweepAnnualCredits(now),
    credits.getRemainingCredits('owner'),
  ]);
  assert.equal(
    (
      await fixture.client.execute(
        "SELECT * FROM credit WHERE transaction_scene='annual_monthly_v1'"
      )
    ).rows.length,
    2
  );
  await payments.handlePaymentRefunded({ session: annualRefund() });
  t.mock.timers.setTime(Date.parse('2028-03-31T08:15:00Z'));
  assert.equal((await sweepAnnualCredits()).processed, 0);
  assert.equal(await credits.getRemainingCredits('owner'), 0);
});

test('opening history or its count directly settles the current annual month without exposing receipts', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: start });
  await annualPayment();
  t.mock.timers.setTime(Date.parse('2028-02-29T08:15:00Z'));
  const rows = await credits.getCredits({ userId: 'owner' });
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.transactionScene === 'annual_monthly_v1'));
  t.mock.timers.setTime(Date.parse('2028-03-31T08:15:00Z'));
  assert.equal(await credits.getCreditsCount({ userId: 'owner' }), 3);
  assert.equal(await credits.getCreditsCount({ userId: 'other' }), 0);
});

test('lazy balance reads do not accumulate or reset spent credits; user history hides receipts', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: start });
  await annualPayment();
  t.mock.timers.setTime(Date.parse('2028-07-31T08:15:00Z'));
  const balances = await Promise.all(
    Array.from({ length: 5 }, () => credits.getRemainingCredits('owner'))
  );
  assert.deepEqual(balances, [2400, 2400, 2400, 2400, 2400]);
  await credits.consumeCredits({ userId: 'owner', credits: 100 });
  assert.equal(await credits.getRemainingCredits('owner'), 2300);
  assert.equal(
    (
      await fixture.client.execute(
        "SELECT * FROM credit WHERE transaction_scene='annual_monthly_v1'"
      )
    ).rows.length,
    2
  );
  assert.equal(
    (await credits.getCredits({ userId: 'owner' })).some(
      (r) => r.transactionScene === 'annual_entitlement_v1'
    ),
    false
  );
  assert.equal(await credits.getCreditsCount({ userId: 'owner' }), 3);
  assert.equal(await credits.getRemainingCredits('other'), 0);
});
test('twelve monthly grants and no thirteenth are shared by aggregate balances and spending', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: start });
  await annualPayment();
  const dates = [
    '2028-02-29',
    '2028-03-31',
    '2028-04-30',
    '2028-05-31',
    '2028-06-30',
    '2028-07-31',
    '2028-08-31',
    '2028-09-30',
    '2028-10-31',
    '2028-11-30',
    '2028-12-31',
  ];
  for (const date of dates) {
    t.mock.timers.setTime(Date.parse(`${date}T08:15:00Z`));
    await Promise.all(
      Array.from({ length: 3 }, () => credits.getRemainingCredits('owner'))
    );
    assert.equal(await credits.getRemainingCredits('owner'), 2400);
  }
  assert.equal(
    (
      await fixture.client.execute(
        "SELECT * FROM credit WHERE transaction_scene='annual_monthly_v1'"
      )
    ).rows.length,
    12
  );
  t.mock.timers.setTime(+end);
  assert.equal(await credits.getRemainingCredits('owner'), 0);
});
test('direct spending settles a month and consumes expiring credits before permanent credits', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: start });
  await annualPayment();
  await credits.createCredit({
    id: 'permanent',
    transactionNo: 'permanent',
    userId: 'owner',
    transactionType: credits.CreditTransactionType.GRANT,
    status: credits.CreditStatus.ACTIVE,
    credits: 100,
    remainingCredits: 100,
    expiresAt: null,
  });
  t.mock.timers.setTime(Date.parse('2028-02-29T08:15:00Z'));
  await credits.consumeCredits({ userId: 'owner', credits: 25 });
  assert.equal(
    (
      await fixture.client.execute(
        "SELECT remaining_credits FROM credit WHERE id='permanent'"
      )
    ).rows[0].remaining_credits,
    100
  );
  assert.equal(await credits.getRemainingCredits('owner'), 2475);
});
test('a failed outer spending transaction rolls back the new monthly grant', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: start });
  await annualPayment();
  t.mock.timers.setTime(Date.parse('2028-02-29T08:15:00Z'));
  const { paymentTransaction } = await import('../models/payment-transaction');
  await assert.rejects(
    paymentTransaction(async (tx) => {
      await credits.consumeCredits({ userId: 'owner', credits: 25, tx });
      throw new Error('rollback');
    }),
    /rollback/
  );
  assert.equal(
    (
      await fixture.client.execute(
        "SELECT * FROM credit WHERE transaction_scene='annual_monthly_v1'"
      )
    ).rows.length,
    1
  );
});

let fixture: PaymentDbFixture;
function annualRefund(amount = 49500): PaymentSession {
  return {
    provider: 'stripe',
    paymentStatus: PaymentStatus.SUCCESS,
    refundInfo: {
      refundId: `re_annual_${amount}`,
      transactionId: 'pi_annual_first',
      status: 'succeeded',
      amount,
      totalRefundedAmount: amount,
      currency: 'usd',
    },
  };
}
test('full refund races with month settlement, replays once and blocks future grants', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: start });
  await annualPayment();
  t.mock.timers.setTime(Date.parse('2028-02-29T08:15:00Z'));
  const { ensureAnnualCredits } = await import('./annual-credits');
  await Promise.all([
    ensureAnnualCredits('owner'),
    payments.handlePaymentRefunded({ session: annualRefund() }),
  ]);
  await payments.handlePaymentRefunded({ session: annualRefund() });
  await payments.handlePaymentRefunded({ session: annualRefund() });
  assert.equal(await credits.getRemainingCredits('owner'), 0);
  t.mock.timers.setTime(Date.parse('2028-03-31T08:15:00Z'));
  assert.equal(await credits.getRemainingCredits('owner'), 0);
  assert.equal(
    (await orders.findOrderByOrderNo('annual-first'))?.status,
    'refunded'
  );
  assert.equal(
    (
      await fixture.client.execute(
        "SELECT * FROM credit WHERE transaction_type='refund'"
      )
    ).rows.length,
    1
  );
});
test('partial refunds stay manual review without deleting future paid months', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: start });
  await annualPayment();
  await payments.handlePaymentRefunded({ session: annualRefund(1000) });
  const audit = (
    await fixture.client.execute(
      "SELECT metadata FROM credit WHERE transaction_type='refund'"
    )
  ).rows[0];
  assert.equal(JSON.parse(String(audit.metadata)).reviewRequired, true);
  t.mock.timers.setTime(Date.parse('2028-02-29T08:15:00Z'));
  assert.equal(await credits.getRemainingCredits('owner'), 2400);
});
test('late partial refund cannot downgrade a refunded annual order or restore future months', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: start });
  await annualPayment();
  await payments.handlePaymentRefunded({ session: annualRefund() });
  await payments.handlePaymentRefunded({ session: annualRefund(1000) });
  assert.equal(
    (await orders.findOrderByOrderNo('annual-first'))?.status,
    'refunded'
  );
  t.mock.timers.setTime(Date.parse('2028-02-29T08:15:00Z'));
  assert.equal(await credits.getRemainingCredits('owner'), 0);
});

test('cancel action reloads ownership, keeps paid annual access, and is safe to repeat', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: start });
  const { session } = await annualPayment();
  assert.equal(typeof payments.cancelSubscriptionForUser, 'function');
  const subscriptions = await import('../models/subscription');
  const subscription =
    (await subscriptions.findSubscriptionByProviderSubscriptionId({
      provider: 'stripe',
      subscriptionId: 'sub_annual',
    }))!;
  let calls = 0;
  const manager = new PaymentManager();
  manager.addProvider({
    name: 'stripe',
    configs: {},
    createPayment: async () => assert.fail('must not create checkout'),
    getPaymentSession: async () => assert.fail('must not retrieve checkout'),
    getPaymentEvent: async () => assert.fail('must not retrieve webhook'),
    cancelSubscription: async ({ subscriptionId }) => {
      assert.equal(subscriptionId, 'sub_annual');
      calls++;
      return {
        ...session,
        subscriptionInfo: {
          ...session.subscriptionInfo!,
          status: SubscriptionStatus.PENDING_CANCEL,
          canceledAt: start,
          canceledEndAt: end,
        },
      };
    },
  });
  await assert.rejects(
    payments.cancelSubscriptionForUser({
      subscriptionNo: subscription.subscriptionNo,
      userId: 'other',
      paymentManager: manager,
    }),
    /permission/
  );
  assert.equal(calls, 0);
  const canceled = await payments.cancelSubscriptionForUser({
    subscriptionNo: subscription.subscriptionNo,
    userId: 'owner',
    paymentManager: manager,
  });
  assert.equal(canceled?.status, 'pending_cancel');
  assert.equal(+canceled!.currentPeriodEnd!, +end);
  await payments.cancelSubscriptionForUser({
    subscriptionNo: subscription.subscriptionNo,
    userId: 'owner',
    paymentManager: manager,
  });
  assert.equal(calls, 1);
  t.mock.timers.setTime(Date.parse('2028-02-29T08:15:00Z'));
  assert.equal(await credits.getRemainingCredits('owner'), 2400);
});

test('cancel action never invokes a fallback provider for an unavailable contract provider', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: start });
  const { session } = await annualPayment();
  assert.equal(typeof payments.cancelSubscriptionForUser, 'function');
  const subscription = await import('../models/subscription').then((m) =>
    m.findSubscriptionByProviderSubscriptionId({
      provider: 'stripe',
      subscriptionId: 'sub_annual',
    })
  );
  const manager = new PaymentManager();
  let calls = 0;
  manager.addProvider(
    {
      name: 'creem',
      configs: {},
      createPayment: async () => assert.fail('must not create checkout'),
      getPaymentSession: async () => assert.fail('must not retrieve checkout'),
      getPaymentEvent: async () => assert.fail('must not retrieve webhook'),
      cancelSubscription: async () => {
        calls++;
        return session;
      },
    },
    true
  );
  await assert.rejects(
    payments.cancelSubscriptionForUser({
      subscriptionNo: subscription!.subscriptionNo,
      userId: 'owner',
      paymentManager: manager,
    }),
    /unavailable/
  );
  assert.equal(calls, 0);
});

test('canceling renewal preserves every paid month, not an unpaid thirteenth', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: start });
  const { session } = await annualPayment();
  const subscriptions = await import('../models/subscription');
  const subscription =
    (await subscriptions.findSubscriptionByProviderSubscriptionId({
      provider: 'stripe',
      subscriptionId: 'sub_annual',
    }))!;
  await payments.handleSubscriptionCanceled({
    subscription,
    session: {
      ...session,
      subscriptionInfo: {
        ...session.subscriptionInfo!,
        status: SubscriptionStatus.CANCELED,
        canceledAt: start,
        canceledEndAt: end,
      },
    },
  });
  for (const date of [
    '2028-02-29',
    '2028-03-31',
    '2028-04-30',
    '2028-05-31',
    '2028-06-30',
    '2028-07-31',
    '2028-08-31',
    '2028-09-30',
    '2028-10-31',
    '2028-11-30',
    '2028-12-31',
  ]) {
    t.mock.timers.setTime(Date.parse(`${date}T08:15:00Z`));
    assert.equal(await credits.getRemainingCredits('owner'), 2400);
  }
  t.mock.timers.setTime(+end);
  assert.equal(await credits.getRemainingCredits('owner'), 0);
});
test('refunded annual sources cannot be restored by a failed generation task', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: start });
  await annualPayment();
  const tasks = await import('../models/ai_task');
  const { AITaskStatus } = await import('@/extensions/ai');
  const task = await tasks.createAITask({
    id: 'annual-task',
    userId: 'owner',
    mediaType: 'video',
    provider: 'polaris',
    model: 'wan2.5-t2v-preview',
    prompt: 'test',
    status: AITaskStatus.PENDING,
    costCredits: 25,
    scene: 'text-to-video',
  });
  await payments.handlePaymentRefunded({ session: annualRefund() });
  await tasks.updateAITaskById(task.id, {
    status: AITaskStatus.FAILED,
    creditId: task.creditId,
  });
  assert.equal(await credits.getRemainingCredits('owner'), 0);
});
test('corrupt entitlement ownership fails closed without granting the next month', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: start });
  await annualPayment();
  await fixture.client.execute(
    "UPDATE credit SET metadata='{}' WHERE transaction_scene='annual_entitlement_v1'"
  );
  t.mock.timers.setTime(Date.parse('2028-02-29T08:15:00Z'));
  await assert.rejects(
    credits.getRemainingCredits('owner'),
    /entitlement mismatch/
  );
  assert.equal(
    (
      await fixture.client.execute(
        "SELECT * FROM credit WHERE transaction_scene='annual_monthly_v1'"
      )
    ).rows.length,
    1
  );
});
let payments: typeof import('./payment');
let orders: typeof import('../models/order');
let credits: typeof import('../models/credit');
const start = new Date('2028-01-31T08:15:00Z');
const end = new Date('2029-01-31T08:15:00Z');
before(async () => {
  fixture = await createPaymentDb();
  payments = await import('./payment');
  orders = await import('../models/order');
  credits = await import('../models/credit');
});
beforeEach(async () => fixture.reset());
after(async () => fixture?.close());
async function annualPayment(settle = true) {
  const order = await orders.createOrder({
    id: 'annual-first',
    orderNo: 'annual-first',
    userId: 'owner',
    userEmail: 'owner@example.invalid',
    status: orders.OrderStatus.CREATED,
    amount: 49500,
    currency: 'usd',
    productId: 'creator-annual-2400-v1',
    paymentType: PaymentType.SUBSCRIPTION,
    paymentInterval: PaymentInterval.YEAR,
    paymentProvider: 'stripe',
    checkoutInfo: '{}',
    creditsAmount: 2400,
    creditsValidDays: 30,
  });
  const session: PaymentSession = {
    provider: 'stripe',
    paymentStatus: PaymentStatus.SUCCESS,
    metadata: { order_no: order.orderNo, user_id: 'owner' },
    paymentInfo: {
      transactionId: 'pi_annual_first',
      amount: 49500,
      currency: 'usd',
      paymentAmount: 49500,
      paymentCurrency: 'usd',
      paymentUserId: 'cus_owner',
      paidAt: start,
    },
    subscriptionId: 'sub_annual',
    subscriptionInfo: {
      subscriptionId: 'sub_annual',
      amount: 49500,
      currency: 'usd',
      interval: PaymentInterval.YEAR,
      intervalCount: 1,
      currentPeriodStart: start,
      currentPeriodEnd: end,
      status: SubscriptionStatus.ACTIVE,
    },
  };
  if (settle) await payments.handleCheckoutSuccess({ order, session });
  return { order, session };
}
test('annual payment stores a zero receipt and only the current month, once', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: start });
  const args = await annualPayment();
  await payments.handlePaymentSuccess(args);
  const rows = (
    await fixture.client.execute(
      "SELECT * FROM credit WHERE order_no='annual-first'"
    )
  ).rows;
  assert.equal(rows.length, 2);
  assert.equal(
    rows.find((r) => r.transaction_scene === 'annual_entitlement_v1')?.credits,
    0
  );
  const month = rows.find((r) => r.transaction_scene === 'annual_monthly_v1');
  assert.equal(month?.remaining_credits, 2400);
  assert.equal(month?.expires_at, Date.parse('2028-02-29T08:15:00Z'));
  assert.equal(await credits.getRemainingCredits('owner'), 2400);
});
for (const [now, count, index] of [
  ['2028-04-01T00:00:00Z', 2, 2],
  ['2027-12-01T00:00:00Z', 1, -1],
  ['2029-02-01T00:00:00Z', 1, -1],
] as const)
  test(`annual notification at ${now} never backfills expired credits`, async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date(now) });
    await annualPayment();
    const rows = (await fixture.client.execute('SELECT * FROM credit')).rows;
    assert.equal(rows.length, count);
    assert.equal(
      await credits.getRemainingCredits('owner'),
      index < 0 ? 0 : 2400
    );
    if (index >= 0)
      assert.match(
        String(rows.find((r) => r.credits === 2400)?.transaction_no),
        /-2$/
      );
  });
test('year-price monthly-interval mismatch cannot settle', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: start });
  const args = await annualPayment(false);
  args.session.subscriptionInfo!.interval = PaymentInterval.MONTH;
  await assert.rejects(
    payments.handleCheckoutSuccess(args),
    /interval|subscription/i
  );
  assert.equal(
    (await fixture.client.execute('SELECT * FROM credit')).rows.length,
    0
  );
});
test('annual renewal replays use the persisted order and independent year', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: start });
  const { session } = await annualPayment();
  const subscriptions = await import('../models/subscription');
  const subscription =
    (await subscriptions.findSubscriptionByProviderSubscriptionId({
      provider: 'stripe',
      subscriptionId: 'sub_annual',
    }))!;
  t.mock.timers.setTime(+end);
  const renewal: PaymentSession = {
    ...session,
    metadata: { user_id: 'owner' },
    paymentInfo: {
      ...session.paymentInfo!,
      transactionId: 'pi_year2',
      paidAt: end,
    },
    subscriptionInfo: {
      ...session.subscriptionInfo!,
      currentPeriodStart: end,
      currentPeriodEnd: new Date('2030-01-31T08:15:00Z'),
    },
  };
  await payments.handleSubscriptionRenewal({ subscription, session: renewal });
  await payments.handleSubscriptionRenewal({ subscription, session: renewal });
  assert.equal(
    (await fixture.client.execute('SELECT * FROM "order"')).rows.length,
    2
  );
  assert.equal(
    (await fixture.client.execute('SELECT * FROM credit')).rows.length,
    4
  );
  assert.equal(await credits.getRemainingCredits('owner'), 2400);
});
