import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';

import {
  PaymentStatus,
  PaymentType,
  type PaymentProvider,
} from '@/extensions/payment/types';

import { createPaymentDb, type PaymentDbFixture } from '../test/payment-db';

let fixture: PaymentDbFixture;
let orders: typeof import('../models/order');
const requestId = 'fbb32cc4-0b55-4f98-8e27-b3e18ea24aee';
const nextId = '02b2b4e5-c8e3-4a3a-b410-31e030656ddf';
before(async () => {
  fixture = await createPaymentDb();
  orders = await import('../models/order');
});
beforeEach(async () => fixture.reset());
after(async () => fixture?.close());
function pack(userId = 'owner') {
  return {
    id: crypto.randomUUID(),
    orderNo: 'temporary',
    userId,
    userEmail: `${userId}@example.invalid`,
    status: orders.OrderStatus.PENDING,
    amount: 1990,
    currency: 'usd',
    paymentType: PaymentType.ONE_TIME,
    paymentProvider: 'stripe',
    productId: 'starter-credits-800-v2',
    creditsAmount: 800,
    creditsValidDays: 0,
    callbackUrl: 'https://wanai30.com/settings/payments',
    checkoutInfo: JSON.stringify({
      type: PaymentType.ONE_TIME,
      orderNo: 'temporary',
      description: 'Starter credits',
      price: { amount: 1990, currency: 'usd' },
      metadata: { app_name: 'WanAI', user_id: userId, order_no: 'temporary' },
      successUrl: 'https://wanai30.com/api/payment/callback?order_no=temporary',
      cancelUrl: 'https://wanai30.com/pricing?purchase=credits',
      expiresAt: Math.floor(Date.now() / 1000) + 86400,
    }),
  };
}
async function moduleUnderTest() {
  const mod = await import('./credit-pack-checkout').catch(() => undefined);
  assert.ok(mod, 'credit-pack checkout service must exist');
  assert.equal(typeof orders.reserveCreditPackOrder, 'function');
  return mod;
}
test('durable request identity cannot create another payment after settlement, but a new purchase can', async () => {
  await moduleUnderTest();
  const seed = pack();
  const first = await orders.reserveCreditPackOrder(seed, requestId);
  const repeated = await Promise.all([
    orders.reserveCreditPackOrder(pack(), requestId),
    orders.reserveCreditPackOrder(pack(), requestId),
  ]);
  assert.ok(repeated.every((r) => r.orderNo === first.orderNo));
  const saved = JSON.parse(first.checkoutInfo!);
  assert.equal(saved.orderNo, first.orderNo);
  assert.equal(saved.metadata.order_no, first.orderNo);
  assert.equal(
    new URL(saved.successUrl).searchParams.get('order_no'),
    first.orderNo
  );
  await assert.rejects(
    orders.reserveCreditPackOrder(
      { ...pack(), productId: 'pro-credits-5200-v2' },
      requestId
    ),
    /checkout_in_progress/
  );
  await assert.rejects(
    orders.reserveCreditPackOrder(pack(), 'invalid'),
    /request/
  );
  const other = await orders.reserveCreditPackOrder(pack('other'), requestId);
  assert.notEqual(other.orderNo, first.orderNo);
  await orders.updateOrderByOrderNo(first.orderNo, {
    status: orders.OrderStatus.PAID,
  });
  assert.equal(
    (await orders.reserveCreditPackOrder(pack(), requestId)).status,
    orders.OrderStatus.PAID
  );
  assert.notEqual(
    (await orders.reserveCreditPackOrder(pack(), nextId)).orderNo,
    first.orderNo
  );
});
test('ambiguous create retries identical server parameters and settled replay never calls Stripe', async () => {
  const mod = await moduleUnderTest();
  const reserved = await orders.reserveCreditPackOrder(pack(), requestId);
  const seen: any[] = [];
  const provider = {
    name: 'stripe',
    async createPayment({ order }: any) {
      seen.push(order);
      if (seen.length === 1)
        throw new Error('network timeout after acceptance');
      return {
        provider: 'stripe',
        checkoutParams: {},
        checkoutInfo: {
          sessionId: 'cs_test_pack',
          checkoutUrl: 'https://checkout.stripe.com/test',
        },
        checkoutResult: { status: 'open' },
      };
    },
  } as unknown as PaymentProvider;
  const invoke = (row = reserved) =>
    mod.continueCreditPackCheckout({
      reserved: row,
      requestedProductId: reserved.productId!,
      provider,
      now: new Date(),
    });
  assert.deepEqual(await invoke(), { kind: 'error', code: 'checkout_retry' });
  assert.equal(
    (await orders.findOrderByOrderNo(reserved.orderNo))?.status,
    'pending'
  );
  assert.equal((await invoke()).kind, 'checkout');
  assert.deepEqual(seen[0], seen[1]);
  await orders.updateOrderByOrderNo(reserved.orderNo, {
    status: orders.OrderStatus.PAID,
  });
  assert.deepEqual(await invoke(), {
    kind: 'paid',
    callbackUrl: 'https://wanai30.com/settings/payments',
  });
  assert.equal(seen.length, 2);
});
test('unknown old results require review; only verified expiry releases a reservation', async () => {
  const mod = await moduleUnderTest();
  const row = await orders.reserveCreditPackOrder(pack(), requestId);
  const provider = {
    name: 'stripe',
    async createPayment() {
      throw new Error('must not create');
    },
    async getPaymentSession() {
      return {
        provider: 'stripe',
        paymentStatus: PaymentStatus.PROCESSING,
        paymentResult: { status: 'expired' },
      };
    },
  } as unknown as PaymentProvider;
  const invoke = () =>
    mod.continueCreditPackCheckout({
      reserved: row,
      requestedProductId: row.productId!,
      provider,
      now: new Date(+row.createdAt + 24 * 3600000),
    });
  assert.deepEqual(await invoke(), {
    kind: 'error',
    code: 'checkout_needs_review',
  });
  await orders.updateOrderByOrderNo(row.orderNo, {
    status: orders.OrderStatus.CREATED,
    paymentSessionId: 'cs_test_expired',
  });
  assert.deepEqual(await invoke(), {
    kind: 'error',
    code: 'checkout_expired_retry',
  });
  assert.equal(
    (await orders.findOrderByOrderNo(row.orderNo))?.status,
    orders.OrderStatus.COMPLETED
  );
});

test('a lost request ID can resume the original session and recovery replay stays settled', async () => {
  const mod = await moduleUnderTest();
  const original = await orders.reserveCreditPackOrder(pack(), requestId);
  await orders.updateOrderByOrderNo(original.orderNo, {
    status: orders.OrderStatus.CREATED,
    paymentSessionId: 'cs_test_original',
    checkoutUrl: 'https://checkout.stripe.com/original',
  });
  const attempts = await Promise.allSettled([
    orders.reserveCreditPackOrder(pack(), nextId),
    orders.reserveCreditPackOrder(pack(), nextId),
  ]);
  const recoveries = attempts.map((attempt) => {
    assert.equal(
      attempt.status,
      'fulfilled',
      'a new request must recover the pending checkout'
    );
    return attempt.value;
  });
  assert.equal(recoveries[0].orderNo, recoveries[1].orderNo);
  assert.notEqual(recoveries[0].orderNo, original.orderNo);
  let lookups = 0;
  const provider = {
    name: 'stripe',
    async createPayment() {
      assert.fail('recovery must not create a new payment');
    },
    async getPaymentSession({ sessionId }: any) {
      assert.equal(sessionId, 'cs_test_original');
      lookups++;
      return {
        paymentStatus: PaymentStatus.PROCESSING,
        paymentResult: { status: 'open' },
      };
    },
  } as unknown as PaymentProvider;
  const invoke = async () =>
    mod.continueCreditPackCheckout({
      reserved: await orders.reserveCreditPackOrder(pack(), nextId),
      requestedProductId: original.productId!,
      provider,
      now: new Date(),
    });
  assert.deepEqual(await invoke(), {
    kind: 'checkout',
    sessionId: 'cs_test_original',
    checkoutUrl: 'https://checkout.stripe.com/original',
  });
  await orders.updateOrderByOrderNo(original.orderNo, {
    status: orders.OrderStatus.PAID,
  });
  assert.deepEqual(await invoke(), {
    kind: 'paid',
    callbackUrl: 'https://wanai30.com/settings/payments',
  });
  assert.equal(lookups, 1);
  const fresh = await orders.reserveCreditPackOrder(
    pack(),
    crypto.randomUUID()
  );
  assert.equal(fresh.status, orders.OrderStatus.PENDING);
  assert.notEqual(fresh.orderNo, original.orderNo);
  assert.deepEqual(await invoke(), {
    kind: 'paid',
    callbackUrl: 'https://wanai30.com/settings/payments',
  });
});

test('lost request recovery verifies expiry then allows an explicit new purchase', async () => {
  const mod = await moduleUnderTest();
  const original = await orders.reserveCreditPackOrder(pack(), requestId);
  await orders.updateOrderByOrderNo(original.orderNo, {
    status: orders.OrderStatus.CREATED,
    paymentSessionId: 'cs_test_expired',
  });
  const recovery = await orders.reserveCreditPackOrder(pack(), nextId);
  const provider = {
    name: 'stripe',
    async createPayment() {
      assert.fail('expired recovery must not create a payment');
    },
    async getPaymentSession({ sessionId }: any) {
      assert.equal(sessionId, 'cs_test_expired');
      return {
        paymentStatus: PaymentStatus.PROCESSING,
        paymentResult: { status: 'expired' },
      };
    },
  } as unknown as PaymentProvider;
  const result = await mod.continueCreditPackCheckout({
    reserved: recovery,
    requestedProductId: original.productId!,
    provider,
    now: new Date(+original.createdAt + 25 * 3600000),
  });
  assert.deepEqual(result, { kind: 'error', code: 'checkout_expired_retry' });
  assert.equal(
    (await orders.findOrderByOrderNo(original.orderNo))?.status,
    orders.OrderStatus.COMPLETED
  );
  assert.equal(
    (await orders.reserveCreditPackOrder(pack(), crypto.randomUUID())).status,
    orders.OrderStatus.PENDING
  );
});

test('recovery for another pack offers explicit resume without changing the original purchase', async () => {
  const mod = await moduleUnderTest();
  const original = await orders.reserveCreditPackOrder(pack(), requestId);
  await orders.updateOrderByOrderNo(original.orderNo, {
    status: orders.OrderStatus.CREATED,
    paymentSessionId: 'cs_test_original',
    checkoutUrl: 'https://checkout.stripe.com/original',
  });
  const requested = { ...pack(), productId: 'pro-credits-5200-v2' };
  const recovery = await orders.reserveCreditPackOrder(requested, nextId);
  const result = await mod.continueCreditPackCheckout({
    reserved: recovery,
    requestedProductId: requested.productId,
    now: new Date(),
    provider: {
      name: 'stripe',
      async createPayment() {
        assert.fail('must not create another pack');
      },
      async getPaymentSession() {
        return {
          paymentStatus: PaymentStatus.PROCESSING,
          paymentResult: { status: 'open' },
        };
      },
    } as unknown as PaymentProvider,
  });
  assert.deepEqual(result, {
    kind: 'error',
    code: 'checkout_in_progress',
    checkoutUrl: 'https://checkout.stripe.com/original',
  });
  const saved = await orders.findOrderByOrderNo(original.orderNo);
  assert.equal(saved?.productId, 'starter-credits-800-v2');
  assert.equal(saved?.amount, 1990);
});

test('unknown old checkout remains fail-closed after request recovery', async () => {
  const mod = await moduleUnderTest();
  const original = await orders.reserveCreditPackOrder(pack(), requestId);
  const recovery = await orders.reserveCreditPackOrder(pack(), nextId);
  const result = await mod.continueCreditPackCheckout({
    reserved: recovery,
    requestedProductId: original.productId!,
    now: new Date(+original.createdAt + 24 * 3600000),
    provider: {
      name: 'stripe',
      async createPayment() {
        assert.fail('unknown result must not create another payment');
      },
    } as unknown as PaymentProvider,
  });
  assert.deepEqual(result, { kind: 'error', code: 'checkout_needs_review' });
  assert.equal(
    (await orders.findOrderByOrderNo(original.orderNo))?.status,
    orders.OrderStatus.PENDING
  );
});

test('recovered ambiguous creation reuses original idempotency payload, never the recovery row', async () => {
  const mod = await moduleUnderTest();
  const original = await orders.reserveCreditPackOrder(pack(), requestId);
  const recovery = await orders.reserveCreditPackOrder(pack(), nextId);
  const result = await mod.continueCreditPackCheckout({
    reserved: recovery,
    requestedProductId: original.productId!,
    now: new Date(),
    provider: {
      name: 'stripe',
      async createPayment({ order }: any) {
        assert.deepEqual(order, JSON.parse(original.checkoutInfo!));
        assert.equal(order.orderNo, original.orderNo);
        assert.equal(order.price.amount, 1990);
        return {
          provider: 'stripe',
          checkoutParams: {},
          checkoutInfo: {
            sessionId: 'cs_test_recovered',
            checkoutUrl: 'https://checkout.stripe.com/recovered',
          },
          checkoutResult: { status: 'open' },
        };
      },
    } as unknown as PaymentProvider,
  });
  assert.equal(result.kind, 'checkout');
  assert.equal(
    (await orders.findOrderByOrderNo(original.orderNo))?.paymentSessionId,
    'cs_test_recovered'
  );
  assert.equal(
    (await orders.findOrderByOrderNo(recovery.orderNo))?.paymentSessionId,
    null
  );
});

test('recovery cannot cross an owner boundary and safely retires known unpaid test sessions on live switch', async () => {
  const mod = await moduleUnderTest();
  const original = await orders.reserveCreditPackOrder(pack(), requestId);
  await orders.updateOrderByOrderNo(original.orderNo, {
    status: orders.OrderStatus.CREATED,
    paymentSessionId: 'cs_test_old',
  });
  let recovery = await orders.reserveCreditPackOrder(pack(), nextId);
  const provider = {
    name: 'stripe',
    async getPaymentSession() {
      assert.fail('must not query with live credentials');
    },
  } as unknown as PaymentProvider;
  await orders.updateOrderByOrderNo(original.orderNo, { userId: 'other' });
  assert.deepEqual(
    await mod.continueCreditPackCheckout({
      reserved: recovery,
      requestedProductId: original.productId!,
      provider,
      now: new Date(),
    }),
    { kind: 'error', code: 'checkout_needs_review' }
  );
  await assert.rejects(
    orders.reserveCreditPackOrder(pack(), nextId),
    /checkout_needs_review/
  );
  await orders.updateOrderByOrderNo(original.orderNo, { userId: 'owner' });
  recovery = await orders.reserveCreditPackOrder(pack(), nextId, {
    stripeMode: 'live',
  });
  assert.deepEqual(
    await mod.continueCreditPackCheckout({
      reserved: recovery,
      requestedProductId: original.productId!,
      provider,
      now: new Date(),
    }),
    { kind: 'error', code: 'checkout_expired_retry' }
  );
  assert.equal(
    (await orders.findOrderByOrderNo(original.orderNo))?.status,
    orders.OrderStatus.COMPLETED
  );
});
