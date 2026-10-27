import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';

import {
  PaymentStatus,
  type PaymentProvider,
} from '@/extensions/payment/types';

import { WAN_PRODUCTS } from '../lib/wan-product-catalog';
import { createPaymentDb, type PaymentDbFixture } from '../test/payment-db';

let fixture: PaymentDbFixture;
let orders: typeof import('../models/order');
let checkout: typeof import('./wan-checkout');
before(async () => {
  fixture = await createPaymentDb();
  orders = await import('../models/order');
  checkout = await import('./wan-checkout');
});
beforeEach(async () => fixture.reset());
after(async () => fixture?.close());

function request(body: unknown) {
  return new Request('https://wanai30.com/api/payment/checkout', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}
function harness(
  config: Record<string, string> = {},
  beforeProvider?: () => Promise<void>
) {
  const attempts: any[] = [];
  let lookupStatus = 'open';
  let failNext = false;
  const provider = {
    name: 'stripe',
    async createPayment({ order }: any) {
      attempts.push(structuredClone(order));
      if (failNext) {
        failNext = false;
        throw new Error('simulated network uncertainty');
      }
      return {
        provider: 'stripe',
        checkoutParams: {},
        checkoutInfo: {
          sessionId: 'cs_test_safe',
          checkoutUrl: 'https://checkout.stripe.com/safe',
        },
        checkoutResult: { id: 'cs_test_safe', status: 'open', livemode: false },
      };
    },
    async getPaymentSession({ sessionId }: { sessionId: string }) {
      assert.equal(sessionId, 'cs_test_safe');
      return {
        provider: 'stripe',
        paymentStatus: PaymentStatus.PROCESSING,
        paymentResult: { status: lookupStatus },
      };
    },
  } as unknown as PaymentProvider;
  return {
    attempts,
    failNext() {
      failNext = true;
    },
    expire() {
      lookupStatus = 'expired';
    },
    handler: checkout.createCheckoutHandler({
      getUser: async () => ({
        id: 'owner',
        name: 'Owner',
        email: 'owner@example.invalid',
      }),
      getConfigs: async () => ({
        app_url: 'https://wanai30.com',
        stripe_enabled: 'true',
        stripe_secret_key: 'sk_test_fixture',
        ...config,
      }),
      getProvider: async () => {
        await beforeProvider?.();
        return provider;
      },
    }),
  };
}

async function customCatalog(revision = 'custom-v2') {
  const products = Object.fromEntries(
    WAN_PRODUCTS.map((p) => [
      p.id,
      { amount: p.amount + 111, credits: p.credits + 200 },
    ])
  );
  await fixture.client.execute({
    sql: 'INSERT INTO config (name,value) VALUES (?,?) ON CONFLICT(name) DO UPDATE SET value=excluded.value',
    args: [
      'wan_pricing_catalog',
      JSON.stringify({ version: 1, revision, products }),
    ],
  });
}

test('configured price and credits govern new purchases; custom monthly price uses dynamic Stripe data', async () => {
  await customCatalog();
  const h = harness({ stripe_price_starter: 'price_legacy' });
  const response = await h.handler(
    request({ productId: 'starter-monthly-800', catalogRevision: 'custom-v2' })
  );
  assert.equal(response.status, 200);
  assert.equal(h.attempts[0].price.amount, 1701);
  assert.equal(h.attempts[0].productId, undefined);
  const row = await orders.findOrderByOrderNo(h.attempts[0].orderNo);
  assert.equal(row?.creditsAmount, 1000);
});

test('outdated or absent quote revision cannot create a new payable order after configuration changes', async () => {
  await customCatalog();
  const h = harness();
  for (const catalogRevision of [undefined, 'default-v1', {}, 'old']) {
    for (const productId of [
      'starter-monthly-800',
      'starter-annual-800-v1',
      'starter-credits-800-v2',
    ]) {
      const response = await h.handler(
        request({ productId, catalogRevision, requestId: crypto.randomUUID() })
      );
      assert.equal(response.status, 409);
      assert.equal((await response.json()).message, 'pricing_changed');
    }
  }
  assert.equal(h.attempts.length, 0);
  assert.equal(
    (await fixture.client.execute('SELECT count(*) AS total FROM "order"'))
      .rows[0].total,
    0
  );
});

test('existing monthly session is recovered at its original price after a catalog update', async () => {
  const h = harness({ stripe_price_starter: 'price_legacy' });
  const body = {
    productId: 'starter-monthly-800',
    catalogRevision: 'default-v1',
  };
  assert.equal((await h.handler(request(body))).status, 200);
  await customCatalog();
  assert.equal((await h.handler(request(body))).status, 200);
  assert.equal(h.attempts.length, 1);
  const row = await orders.findOrderByOrderNo(h.attempts[0].orderNo);
  assert.equal(row?.amount, 1590);
  assert.equal(row?.creditsAmount, 800);
});

test('credit pack request replay keeps its original credits after a catalog update', async () => {
  const h = harness();
  const body = {
    productId: 'starter-credits-800-v2',
    requestId: crypto.randomUUID(),
    catalogRevision: 'default-v1',
  };
  assert.equal((await h.handler(request(body))).status, 200);
  await customCatalog();
  assert.equal((await h.handler(request(body))).status, 200);
  assert.equal(h.attempts.length, 1);
  const row = await orders.findOrderByOrderNo(h.attempts[0].orderNo);
  assert.equal(row?.amount, 1990);
  assert.equal(row?.creditsAmount, 800);
});

test('catalog change between quote loading and reservation cannot reserve stale financial values', async () => {
  const h = harness({}, () => customCatalog());
  const response = await h.handler(
    request({ productId: 'starter-monthly-800', catalogRevision: 'default-v1' })
  );
  assert.equal(response.status, 409);
  assert.equal((await response.json()).message, 'pricing_changed');
  assert.equal(h.attempts.length, 0);
});

test('an uncertain subscription creation retries the original snapshot after a price change', async () => {
  const h = harness({ stripe_price_starter: 'price_legacy' });
  h.failNext();
  const body = {
    productId: 'starter-monthly-800',
    catalogRevision: 'default-v1',
  };
  assert.equal((await h.handler(request(body))).status, 503);
  await customCatalog();
  assert.equal((await h.handler(request(body))).status, 200);
  assert.equal(h.attempts.length, 2);
  assert.deepEqual(h.attempts[0], h.attempts[1]);
});

for (const mode of ['monthly', 'credits'] as const) {
  for (const uncertain of [false, true]) {
    test(`a corrupt current catalog does not block ${mode} ${uncertain ? 'uncertain' : 'open'} checkout recovery`, async () => {
      await customCatalog();
      const h = harness();
      if (uncertain) h.failNext();
      const body = {
        productId:
          mode === 'monthly' ? 'starter-monthly-800' : 'starter-credits-800-v2',
        catalogRevision: 'custom-v2',
        requestId: crypto.randomUUID(),
      };
      assert.equal(
        (await h.handler(request(body))).status,
        uncertain ? 503 : 200
      );
      await fixture.client.execute(
        "UPDATE config SET value='broken' WHERE name='wan_pricing_catalog'"
      );
      const resumed = await h.handler(request(body));
      assert.equal(resumed.status, 200);
      assert.equal(h.attempts.length, uncertain ? 2 : 1);
      if (uncertain) assert.deepEqual(h.attempts[0], h.attempts[1]);
      const row = (await orders.findOrderByOrderNo(h.attempts[0].orderNo))!;
      assert.equal(row.creditsAmount, 1000);
      assert.equal(row.amount, mode === 'monthly' ? 1701 : 2101);
    });
  }
}

test('an unavailable initial quote never creates a default-price order even if the catalog recovers mid-request', async () => {
  await fixture.client.execute(
    "INSERT INTO config (name,value) VALUES ('wan_pricing_catalog','broken')"
  );
  const h = harness({}, () => customCatalog('recovered'));
  const response = await h.handler(
    request({ productId: 'starter-monthly-800', catalogRevision: 'recovered' })
  );
  assert.equal(response.status, 503);
  assert.equal(h.attempts.length, 0);
  assert.equal(
    (await fixture.client.execute('SELECT count(*) AS total FROM "order"'))
      .rows[0].total,
    0
  );
});

test('corrupt current catalog blocks all new purchases without a payable order', async () => {
  await fixture.client.execute(
    "INSERT INTO config (name,value) VALUES ('wan_pricing_catalog','broken')"
  );
  const h = harness();
  for (const productId of [
    'starter-monthly-800',
    'starter-annual-800-v1',
    'starter-credits-800-v2',
  ]) {
    assert.equal(
      (
        await h.handler(
          request({
            productId,
            catalogRevision: 'default-v1',
            requestId: crypto.randomUUID(),
          })
        )
      ).status,
      503
    );
  }
  assert.equal(h.attempts.length, 0);
  assert.equal(
    (await fixture.client.execute('SELECT count(*) AS total FROM "order"'))
      .rows[0].total,
    0
  );
});

test('custom annual checkout grants its paid snapshot each month despite later catalog changes', async (t) => {
  const now = new Date('2028-01-01T00:00:00Z');
  t.mock.timers.enable({ apis: ['Date'], now });
  await customCatalog();
  const h = harness();
  assert.equal(
    (
      await h.handler(
        request({
          productId: 'creator-annual-2400-v1',
          catalogRevision: 'custom-v2',
        })
      )
    ).status,
    200
  );
  const row = (await orders.findOrderByOrderNo(h.attempts[0].orderNo))!;
  assert.equal(row.amount, 49611);
  assert.equal(row.creditsAmount, 2600);
  const { handleCheckoutSuccess, handleSubscriptionRenewal } = await import(
    './payment'
  );
  const { getRemainingCredits } = await import('../models/credit');
  const { findSubscriptionByProviderSubscriptionId } = await import(
    '../models/subscription'
  );
  const { PaymentInterval, SubscriptionStatus } = await import(
    '@/extensions/payment/types'
  );
  const session = {
    provider: 'stripe',
    paymentStatus: PaymentStatus.SUCCESS,
    metadata: { order_no: row.orderNo, user_id: 'owner' },
    paymentInfo: {
      transactionId: 'pi_custom_annual',
      amount: row.amount,
      currency: 'usd',
      paymentAmount: row.amount,
      paymentCurrency: 'usd',
      paymentUserId: 'cus_custom',
      paidAt: now,
    },
    subscriptionId: 'sub_custom',
    subscriptionInfo: {
      subscriptionId: 'sub_custom',
      amount: row.amount,
      currency: 'usd',
      interval: PaymentInterval.YEAR,
      intervalCount: 1,
      currentPeriodStart: now,
      currentPeriodEnd: new Date('2029-01-01T00:00:00Z'),
      status: SubscriptionStatus.ACTIVE,
    },
  };
  // Existing payments must not consult the current catalog even if it is corrupt.
  await fixture.client.execute(
    "UPDATE config SET value='broken' WHERE name='wan_pricing_catalog'"
  );
  await handleCheckoutSuccess({ order: row, session });
  assert.equal(await getRemainingCredits('owner'), 2600);
  t.mock.timers.setTime(Date.parse('2028-02-01T00:00:00Z'));
  assert.equal(await getRemainingCredits('owner'), 2600);
  const subscription = (await findSubscriptionByProviderSubscriptionId({
    provider: 'stripe',
    subscriptionId: 'sub_custom',
  }))!;
  t.mock.timers.setTime(Date.parse('2029-01-01T00:00:00Z'));
  await handleSubscriptionRenewal({
    subscription,
    session: {
      ...session,
      metadata: { user_id: 'owner' },
      paymentInfo: {
        ...session.paymentInfo,
        transactionId: 'pi_custom_renewal',
        paidAt: new Date('2029-01-01T00:00:00Z'),
      },
      subscriptionInfo: {
        ...session.subscriptionInfo,
        currentPeriodStart: new Date('2029-01-01T00:00:00Z'),
        currentPeriodEnd: new Date('2030-01-01T00:00:00Z'),
      },
    },
  });
  assert.equal(await getRemainingCredits('owner'), 2600);
  const rows = (
    await fixture.client.execute('SELECT amount, credits_amount FROM "order"')
  ).rows;
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => r.amount === 49611 && r.credits_amount === 2600));
});

test('annual checkout derives yearly price and monthly allowance only from the server catalog', async () => {
  const h = harness();
  const response = await h.handler(
    request({
      productId: 'creator-annual-2400-v1',
      locale: 'zh',
      returnPath: '//evil.invalid',
    })
  );
  assert.equal(response.status, 200);
  const payment = h.attempts[0];
  assert.equal(payment.price.amount, 49500);
  assert.equal(payment.plan.interval, 'year');
  assert.equal(payment.type, 'subscription');
  assert.equal(payment.productId, undefined);
  assert.equal(payment.metadata.user_id, 'owner');
  assert.match(payment.cancelUrl, /\/zh\/pricing\?purchase=annual#pricing$/);
  const row = await orders.findOrderByOrderNo(payment.orderNo);
  assert.equal(row?.creditsAmount, 2400);
  assert.equal(row?.productId, 'creator-annual-2400-v1');
  assert.equal(row?.callbackUrl, 'https://wanai30.com/zh/settings/billing');
});

test('configured monthly Price IDs remain usable while new products never reuse them', async () => {
  const h = harness({ stripe_price_starter: 'price_legacy' });
  assert.equal((await h.handler(request({ planId: 'starter' }))).status, 200);
  assert.equal(h.attempts[0].productId, 'price_legacy');
  assert.equal(h.attempts[0].price.amount, 1590);
  assert.equal(h.attempts[0].plan.interval, 'month');
  const again = await h.handler(request({ productId: 'starter-monthly-800' }));
  assert.equal(again.status, 200);
  assert.equal(h.attempts.length, 1);
});

test('credit packs create permanent one-time orders and replay an open session without another charge', async () => {
  const h = harness();
  const body = {
    productId: 'pro-credits-5200-v2',
    requestId: crypto.randomUUID(),
  };
  assert.equal((await h.handler(request(body))).status, 200);
  assert.equal(h.attempts[0].price.amount, 10990);
  assert.equal(h.attempts[0].plan, undefined);
  assert.equal(h.attempts[0].type, 'one-time');
  const row = await orders.findOrderByOrderNo(h.attempts[0].orderNo);
  assert.equal(row?.creditsValidDays, 0);
  assert.equal(row?.creditsAmount, 5200);
  assert.equal((await h.handler(request(body))).status, 200);
  assert.equal(h.attempts.length, 1);
});

test('different-plan checkout provides explicit resume and verified expiry unlocks a new choice', async () => {
  const h = harness();
  await h.handler(request({ productId: 'starter-monthly-800' }));
  const response = await h.handler(
    request({ productId: 'creator-annual-2400-v1' })
  );
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    code: -1,
    message: 'checkout_in_progress',
    data: { checkoutUrl: 'https://checkout.stripe.com/safe' },
  });
  assert.equal(h.attempts.length, 1);
  h.expire();
  const expired = await h.handler(
    request({ productId: 'creator-annual-2400-v1' })
  );
  assert.equal((await expired.json()).message, 'checkout_expired_retry');
  assert.equal(
    (await h.handler(request({ productId: 'creator-annual-2400-v1' }))).status,
    200
  );
  assert.equal(h.attempts.length, 2);
});

test('client financial overrides, invalid products and invalid pack requests cannot create payable orders', async () => {
  const h = harness();
  for (const body of [
    { productId: 'creator-annual-2400-v1', amount: 1 },
    { productId: 'starter-credits-800-v2', metadata: { user_id: 'other' } },
    { productId: 'starter-credits-800-v2', requestId: 'bad' },
    { productId: 'invented' },
    { productId: 'starter-monthly-800', planId: 'pro' },
    [],
  ])
    assert.equal((await h.handler(request(body))).status, 400);
  assert.equal(h.attempts.length, 0);
  assert.equal(
    (await fixture.client.execute('SELECT count(*) AS n FROM "order"')).rows[0]
      .n,
    0
  );
});

test('paid pack callback grants permanent credits once, supports a fresh purchase and revokes on refund', async () => {
  const h = harness();
  const body = {
    productId: 'starter-credits-800-v2',
    requestId: crypto.randomUUID(),
  };
  await h.handler(request(body));
  const row = await orders.findOrderByOrderNo(h.attempts[0].orderNo);
  assert.ok(row);
  const { handleCheckoutSuccess, handlePaymentRefunded } = await import(
    './payment'
  );
  const { getRemainingCredits } = await import('../models/credit');
  const session = {
    provider: 'stripe',
    paymentStatus: PaymentStatus.SUCCESS,
    metadata: { order_no: row.orderNo, user_id: 'owner' },
    paymentInfo: {
      transactionId: 'pi_pack_settled',
      amount: 1990,
      currency: 'usd',
      paymentAmount: 1990,
      paymentCurrency: 'usd',
      paymentUserId: 'cus_pack',
      discountAmount: 0,
    },
    paymentResult: { id: 'cs_test_safe' },
  };
  await Promise.all([
    handleCheckoutSuccess({ order: row, session }),
    handleCheckoutSuccess({ order: row, session }),
  ]);
  assert.equal(await getRemainingCredits('owner'), 800);
  const grant = (
    await fixture.client.execute(
      "SELECT * FROM credit WHERE transaction_type='grant'"
    )
  ).rows;
  assert.equal(grant.length, 1);
  assert.equal(grant[0].expires_at, null);
  const replay = await (await h.handler(request(body))).json();
  assert.equal(replay.data.kind, 'paid');
  assert.equal(h.attempts.length, 1);
  assert.equal(
    (await h.handler(request({ ...body, requestId: crypto.randomUUID() })))
      .status,
    200
  );
  assert.equal(h.attempts.length, 2);
  await handlePaymentRefunded({
    session: {
      provider: 'stripe',
      refundInfo: {
        refundId: 're_pack',
        transactionId: 'pi_pack_settled',
        amount: 1990,
        totalRefundedAmount: 1990,
        currency: 'usd',
        status: 'succeeded',
      },
    },
  });
  assert.equal(await getRemainingCredits('owner'), 0);
});
