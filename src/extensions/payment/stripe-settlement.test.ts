import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import Stripe from 'stripe';

import { findWanProduct } from '@/shared/lib/wan-product-catalog';

import { StripeProvider } from './stripe';
import {
  PaymentEventType,
  PaymentInterval,
  PaymentStatus,
  PaymentType,
  SubscriptionStatus,
} from './types';

const secret = 'whsec_unit_test_only';
const start = Date.parse('2026-09-01T00:00:00Z') / 1000;
const end = Date.parse('2026-10-01T00:00:00Z') / 1000;
const metadata = {
  order_no: 'order_first',
  user_id: 'user_test',
  app_name: 'WanAI',
};
const subscription = () => ({
  id: 'sub_test',
  object: 'subscription',
  status: 'active',
  livemode: false,
  metadata,
  cancel_at: null,
  cancel_at_period_end: false,
  canceled_at: null,
  items: {
    data: [
      {
        id: 'si_test',
        current_period_start: start,
        current_period_end: end,
        price: {
          id: 'price_test',
          product: 'prod_test',
          unit_amount: 8900,
          currency: 'usd',
          recurring: { interval: 'month', interval_count: 1 },
        },
        plan: { interval: 'month', interval_count: 1 },
      },
    ],
  },
});
const intent = () => ({
  id: 'pi_test',
  object: 'payment_intent',
  status: 'succeeded',
  amount: 8900,
  amount_received: 8900,
  currency: 'usd',
  customer: 'cust_test',
  metadata,
});
const invoice = () => ({
  id: 'in_test',
  object: 'invoice',
  status: 'paid',
  livemode: false,
  billing_reason: 'subscription_create',
  subtotal: 8900,
  total: 8900,
  amount_paid: 8900,
  amount_remaining: 0,
  currency: 'usd',
  customer: 'cust_test',
  created: start,
  status_transitions: { paid_at: start },
  metadata: {},
  parent: {
    type: 'subscription_details',
    subscription_details: { subscription: 'sub_test', metadata },
  },
  lines: {
    has_more: false,
    data: [
      {
        id: 'il_test',
        amount: 8900,
        quantity: 1,
        period: { start, end },
        parent: {
          type: 'subscription_item_details',
          subscription_item_details: {
            subscription: 'sub_test',
            proration: false,
          },
        },
      },
    ],
  },
});
const checkout = (recurring = false) => ({
  id: 'cs_test',
  object: 'checkout.session',
  status: 'complete',
  payment_status: 'paid',
  livemode: false,
  mode: recurring ? 'subscription' : 'payment',
  amount_subtotal: 8900,
  amount_total: 8900,
  currency: 'usd',
  payment_intent: recurring ? null : 'pi_test',
  subscription: recurring ? 'sub_test' : null,
  invoice: recurring ? 'in_test' : null,
  customer: 'cust_test',
  metadata,
  created: start,
  total_details: { amount_discount: 0, amount_tax: 0, amount_shipping: 0 },
});
test('Stripe refuses cross-mode checkout retrieval without calling the wrong API environment', async (t) => {
  const boundary = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('unexpected network');
  });
  for (const key of [
    'sk_live_unit_only',
    'rk_live_unit_only',
    ' sk_live_unit_only ',
  ]) {
    const live = new StripeProvider({ secretKey: key, publishableKey: '' });
    await assert.rejects(
      live.getPaymentSession({ sessionId: 'cs_test_Abc123' }),
      /checkout_needs_review/
    );
  }
  await assert.rejects(
    new StripeProvider({
      secretKey: 'sk_test_unit_only',
      publishableKey: '',
    }).getPaymentSession({ sessionId: 'cs_live_Abc123' }),
    /checkout_needs_review/
  );
  assert.equal(boundary.mock.callCount(), 0);
});

test('same-mode checkout retrieval preserves the payable session for both Stripe key types', async (t) => {
  for (const [key, id, livemode] of [
    ['sk_test_unit_only', 'cs_test_Abc123', false],
    ['rk_live_unit_only', 'cs_live_Abc123', true],
  ] as const) {
    const boundary = api(t, {
      [`/v1/checkout/sessions/${id}`]: {
        ...checkout(),
        id,
        livemode,
        status: 'open',
        payment_status: 'unpaid',
      },
    });
    const result = await new StripeProvider({
      secretKey: key,
      publishableKey: '',
    }).getPaymentSession({ sessionId: id });
    assert.equal(result.paymentStatus, PaymentStatus.PROCESSING);
    assert.equal(result.paymentResult.id, id);
    assert.equal(result.paymentResult.status, 'open');
    assert.equal(boundary.mock.callCount(), 1);
  }
});

test('a missing same-mode Stripe session requires review and never exposes the provider response', async (t) => {
  t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(
        JSON.stringify({
          error: {
            type: 'invalid_request_error',
            code: 'resource_missing',
            message: 'No such checkout.session: cs_live_private',
          },
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
  );
  const live = new StripeProvider({
    secretKey: 'rk_live_unit_only',
    publishableKey: '',
  });
  await assert.rejects(
    live.getPaymentSession({ sessionId: 'cs_live_Private123' }),
    (error: any) => error.message === 'checkout_needs_review'
  );
});

const provider = () =>
  new StripeProvider({
    secretKey: 'sk_test_unit_only',
    publishableKey: 'pk_test_unit_only',
    signingSecret: secret,
  });
function request(type: string, object: unknown, live = false) {
  const payload = JSON.stringify({
    id: 'evt_test',
    object: 'event',
    type,
    created: Math.floor(Date.now() / 1000),
    livemode: live,
    api_version: '2025-08-27.basil',
    data: { object },
  });
  return new Request('https://wanai30.com/api/payment/notify/stripe', {
    method: 'POST',
    body: payload,
    headers: {
      'stripe-signature': Stripe.webhooks.generateTestHeaderString({
        payload,
        secret,
      }),
    },
  });
}
type Route = unknown | ((url: URL, init: RequestInit) => unknown);
function api(t: TestContext, routes: Record<string, Route>) {
  return t.mock.method(
    globalThis,
    'fetch',
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url
      );
      const route = routes[url.pathname];
      if (!route)
        return Response.json(
          {
            error: {
              type: 'invalid_request_error',
              message: `Unexpected API request: ${url.pathname}`,
            },
          },
          { status: 400 }
        );
      return Response.json(
        await (typeof route === 'function' ? route(url, init || {}) : route)
      );
    }
  );
}
const paidInvoiceRoutes = () => ({
  '/v1/subscriptions/sub_test': subscription(),
  '/v1/invoices/in_test': invoice(),
  '/v1/invoice_payments': {
    has_more: false,
    data: [
      {
        id: 'inpay_test',
        status: 'paid',
        amount_paid: 8900,
        invoice: 'in_test',
        payment: { type: 'payment_intent', payment_intent: 'pi_test' },
      },
    ],
  },
  '/v1/payment_intents/pi_test': intent(),
});

test('Stripe does not reuse another project customer with the same email or trust client scope metadata', async (t) => {
  const boundary = api(t, {
    '/v1/customers': (_url: URL, init: RequestInit) => {
      if (init.method === 'GET')
        return { data: [{ id: 'cus_other', metadata: {} }], has_more: false };
      assert.equal(init.method, 'POST');
      const form = new URLSearchParams(String(init.body));
      assert.equal(form.get('metadata[wanai_app]'), 'wanai30-lite');
      assert.equal(form.get('metadata[user_id]'), 'user_test');
      return { id: 'cus_wanai' };
    },
    '/v1/checkout/sessions': (_url: URL, init: RequestInit) => {
      const form = new URLSearchParams(String(init.body));
      assert.equal(form.get('customer'), 'cus_wanai');
      assert.equal(form.get('metadata[wanai_app]'), 'wanai30-lite');
      assert.equal(
        form.get('subscription_data[metadata][wanai_app]'),
        'wanai30-lite'
      );
      return { id: 'cs_scoped', url: 'https://checkout.stripe.com/test' };
    },
  });
  const result = await provider().createPayment({
    order: {
      orderNo: 'order_first',
      type: PaymentType.SUBSCRIPTION,
      price: { amount: 1590, currency: 'usd' },
      plan: { name: 'Starter', interval: PaymentInterval.MONTH },
      customer: {
        email: 'test@example.invalid',
        metadata: { wanai_app: 'other', user_id: 'other' },
      },
      metadata: { ...metadata, wanai_app: 'other' },
    },
  });
  assert.equal(result.checkoutInfo.sessionId, 'cs_scoped');
  assert.equal(boundary.mock.callCount(), 3);
});

test('Stripe finds its own customer beyond a foreign first page without changing existing customers', async (t) => {
  const boundary = api(t, {
    '/v1/customers': (url: URL, init: RequestInit) => {
      assert.equal(init.method, 'GET');
      return url.searchParams.get('starting_after')
        ? {
            data: [
              {
                id: 'cus_wanai',
                metadata: { wanai_app: 'wanai30-lite', user_id: 'user_test' },
              },
            ],
            has_more: false,
          }
        : {
            data: [
              {
                id: 'cus_other',
                metadata: {
                  wanai_app: 'wanai30-lite',
                  user_id: 'someone_else',
                },
              },
            ],
            has_more: true,
          };
    },
    '/v1/checkout/sessions': (_url: URL, init: RequestInit) => {
      const form = new URLSearchParams(String(init.body));
      assert.equal(form.get('customer'), 'cus_wanai');
      assert.equal(
        form.get('payment_intent_data[metadata][wanai_app]'),
        'wanai30-lite'
      );
      return { id: 'cs_scoped', url: 'https://checkout.stripe.com/test' };
    },
  });
  await provider().createPayment({
    order: {
      orderNo: 'order_first',
      type: PaymentType.ONE_TIME,
      price: { amount: 1590, currency: 'usd' },
      customer: { email: 'test@example.invalid' },
      metadata,
    },
  });
  assert.equal(boundary.mock.callCount(), 3);
});

test('Stripe billing portal refuses legacy/shared customers before creating a portal session', async (t) => {
  const boundary = api(t, {
    '/v1/customers/cus_shared': { id: 'cus_shared', metadata: {} },
    '/v1/billing_portal/sessions': {
      url: 'https://billing.stripe.com/unsafe-shared',
    },
  });
  await assert.rejects(
    provider().getPaymentBilling({ customerId: 'cus_shared' }),
    /customer is not isolated/
  );
  assert.equal(boundary.mock.callCount(), 1);
});

test('Stripe billing portal remains available for a WanAI-isolated customer', async (t) => {
  api(t, {
    '/v1/customers/cus_wanai': {
      id: 'cus_wanai',
      metadata: { wanai_app: 'wanai30-lite', user_id: 'user_test' },
    },
    '/v1/billing_portal/sessions': (_url: URL, init: RequestInit) => {
      const form = new URLSearchParams(String(init.body));
      assert.equal(form.get('customer'), 'cus_wanai');
      assert.equal(form.get('configuration'), 'bpc_wanai');
      return { url: 'https://billing.stripe.com/wanai-only' };
    },
    '/v1/billing_portal/configurations': {
      data: [
        {
          id: 'bpc_wanai',
          active: true,
          is_default: false,
          metadata: { wanai_app: 'wanai30-lite' },
          features: {
            customer_update: { enabled: false },
            invoice_history: { enabled: true },
            payment_method_update: { enabled: true },
            subscription_update: { enabled: false },
            subscription_cancel: { enabled: false },
          },
        },
      ],
      has_more: false,
    },
  });
  assert.equal(
    (await provider().getPaymentBilling({ customerId: 'cus_wanai' }))
      .billingUrl,
    'https://billing.stripe.com/wanai-only'
  );
});

for (const unsafe of [
  'missing',
  'default',
  'subscription_update',
  'subscription_cancel',
]) {
  test(`Stripe never falls back to a ${unsafe} portal configuration`, async (t) => {
    const features = {
      customer_update: { enabled: false },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_update: { enabled: unsafe === 'subscription_update' },
      subscription_cancel: { enabled: unsafe === 'subscription_cancel' },
    };
    const boundary = api(t, {
      '/v1/customers/cus_wanai': {
        id: 'cus_wanai',
        metadata: { wanai_app: 'wanai30-lite', user_id: 'user_test' },
      },
      '/v1/billing_portal/configurations': {
        data:
          unsafe === 'missing'
            ? []
            : [
                {
                  id: 'bpc_unsafe',
                  active: true,
                  is_default: unsafe === 'default',
                  metadata: { wanai_app: 'wanai30-lite' },
                  features,
                },
              ],
        has_more: false,
      },
      '/v1/billing_portal/sessions': {
        url: 'https://billing.stripe.com/unsafe',
      },
    });
    await assert.rejects(
      provider().getPaymentBilling({ customerId: 'cus_wanai' }),
      /isolated billing configuration/
    );
    assert.equal(boundary.mock.callCount(), 2);
  });
}

for (const [productId, expectedAmount, interval] of [
  ['starter-monthly-800', 1590, 'month'],
  ['creator-monthly-2400', 4590, 'month'],
  ['pro-monthly-5200', 9590, 'month'],
  ['starter-annual-800-v1', 17200, 'year'],
  ['creator-annual-2400-v1', 49500, 'year'],
  ['pro-annual-5200-v1', 103600, 'year'],
  ['starter-credits-800-v2', 1990, 'one-time'],
  ['creator-credits-2400-v2', 5490, 'one-time'],
  ['pro-credits-5200-v2', 10990, 'one-time'],
] as const) {
  test(`Stripe charges ${expectedAmount} cents with ${interval} for ${productId}`, async (t) => {
    for (const _locale of ['en', 'zh']) {
      const item = findWanProduct(productId);
      assert.ok(
        item,
        'The server-owned public catalog must expose this product'
      );
      const boundary = api(t, {
        '/v1/customers': {
          data: [
            {
              id: 'cust_test',
              metadata: { wanai_app: 'wanai30-lite', user_id: 'user_test' },
            },
          ],
          has_more: false,
        },
        '/v1/checkout/sessions': (_url: URL, init: RequestInit) => {
          const form = new URLSearchParams(String(init.body));
          assert.equal(
            form.get('mode'),
            interval === 'one-time' ? 'payment' : 'subscription'
          );
          assert.equal(
            form.get('line_items[0][price_data][unit_amount]'),
            String(expectedAmount)
          );
          assert.equal(
            form.get('line_items[0][price_data][currency]')?.toLowerCase(),
            'usd'
          );
          assert.equal(form.get('line_items[0][quantity]'), '1');
          assert.equal(
            form.get('line_items[0][price_data][recurring][interval]'),
            interval === 'one-time' ? null : interval
          );
          return { id: 'cs_test', url: 'https://checkout.stripe.com/test' };
        },
      });
      try {
        const result = await provider().createPayment({
          order: {
            orderNo: 'order_first',
            type:
              item.interval === 'one-time'
                ? PaymentType.ONE_TIME
                : PaymentType.SUBSCRIPTION,
            price: { amount: item.amount, currency: item.currency },
            plan: {
              name: item.tier,
              interval: item.interval as PaymentInterval,
            },
            description: item.tier,
            customer: { email: 'test@example.invalid' },
            metadata,
          },
        });
        assert.equal(result.checkoutInfo.sessionId, 'cs_test');
      } finally {
        boundary.mock.restore();
      }
    }
  });
}

test('Stripe rejects invalid signatures as invalid requests before fetching', async (t) => {
  const fetch = api(t, {});
  const req = request('checkout.session.completed', checkout());
  req.headers.set('stripe-signature', 'invalid');
  await assert.rejects(
    provider().getPaymentEvent({ req }),
    /Invalid webhook signature/
  );
  assert.equal(fetch.mock.callCount(), 0);
});
test('Stripe acknowledges signed out-of-scope events without API calls', async (t) => {
  const fetch = api(t, {});
  const event = await provider().getPaymentEvent({
    req: request('customer.created', { id: 'cust_test' }),
  });
  assert.equal(event.eventType, PaymentEventType.IGNORED);
  assert.equal(fetch.mock.callCount(), 0);
});
test('Stripe test key never settles a live-mode event', async (t) => {
  const fetch = api(t, {});
  await assert.rejects(
    provider().getPaymentEvent({
      req: request('checkout.session.completed', checkout(), true),
    }),
    /mode mismatch/
  );
  assert.equal(fetch.mock.callCount(), 0);
});

test('Stripe normalizes live secret keys consistently for signed payment webhooks', async (t) => {
  const boundary = api(t, { '/v1/payment_intents/pi_test': intent() });
  for (const key of [' sk_live_unit_only ', '\trk_live_unit_only\n']) {
    const config = {
      secretKey: key,
      publishableKey: '',
      signingSecret: secret,
    };
    const live = new StripeProvider(config);
    const event = await live.getPaymentEvent({
      req: request(
        'checkout.session.completed',
        { ...checkout(), livemode: true },
        true
      ),
    });
    assert.equal(event.eventType, PaymentEventType.CHECKOUT_SUCCESS);
    assert.equal(event.paymentSession?.paymentStatus, PaymentStatus.SUCCESS);
    assert.equal(config.secretKey, key, 'must not mutate caller configuration');
    await assert.rejects(
      live.getPaymentEvent({
        req: request('checkout.session.completed', checkout(), false),
      }),
      /mode mismatch/
    );
  }
  assert.equal(boundary.mock.callCount(), 2);
});
test('Stripe one-time checkout uses confirmed PaymentIntent and base amount', async (t) => {
  api(t, { '/v1/payment_intents/pi_test': intent() });
  const event = await provider().getPaymentEvent({
    req: request('checkout.session.completed', checkout()),
  });
  assert.equal(event.paymentSession?.paymentInfo?.transactionId, 'pi_test');
  assert.equal(event.paymentSession?.paymentInfo?.amount, 8900);
  assert.equal(event.paymentSession?.paymentInfo?.currency, 'usd');
});
test('Stripe asynchronous success settles and asynchronous failure grants nothing', async (t) => {
  api(t, { '/v1/payment_intents/pi_test': intent() });
  const success = await provider().getPaymentEvent({
    req: request('checkout.session.async_payment_succeeded', checkout()),
  });
  assert.equal(success.paymentSession?.paymentStatus, PaymentStatus.SUCCESS);
  const failed = await provider().getPaymentEvent({
    req: request('checkout.session.async_payment_failed', {
      ...checkout(),
      payment_status: 'unpaid',
    }),
  });
  assert.equal(failed.paymentSession?.paymentStatus, PaymentStatus.FAILED);
});
test('Stripe subscription checkout and invoice share transaction and historical paid period', async (t) => {
  const routes = paidInvoiceRoutes();
  routes['/v1/subscriptions/sub_test'].items.data[0].current_period_start = end;
  routes['/v1/subscriptions/sub_test'].items.data[0].current_period_end =
    end + 31 * 86400;
  api(t, routes);
  const checkoutEvent = await provider().getPaymentEvent({
    req: request('checkout.session.completed', checkout(true)),
  });
  const invoiceEvent = await provider().getPaymentEvent({
    req: request('invoice.paid', invoice()),
  });
  for (const event of [checkoutEvent, invoiceEvent]) {
    assert.equal(event.paymentSession?.paymentInfo?.transactionId, 'pi_test');
    assert.equal(
      event.paymentSession?.subscriptionInfo?.currentPeriodEnd?.toISOString(),
      '2026-10-01T00:00:00.000Z'
    );
    assert.equal(event.paymentSession?.metadata?.user_id, 'user_test');
  }
});
test('Stripe paid invoice refuses manual, split or incomplete payment allocations', async (t) => {
  const routes = paidInvoiceRoutes();
  routes['/v1/invoice_payments'].data[0].amount_paid = 1;
  api(t, routes);
  await assert.rejects(
    provider().getPaymentEvent({ req: request('invoice.paid', invoice()) }),
    /payment allocation/
  );
});
test('Stripe does not fulfill a checkout whose PaymentIntent differs in amount', async (t) => {
  api(t, {
    '/v1/payment_intents/pi_test': { ...intent(), amount_received: 1 },
  });
  await assert.rejects(
    provider().getPaymentEvent({
      req: request('checkout.session.completed', checkout()),
    }),
    /payment mismatch/
  );
});
test('Stripe failed renewal never declares payment success', async (t) => {
  api(t, {
    '/v1/subscriptions/sub_test': { ...subscription(), status: 'past_due' },
  });
  const event = await provider().getPaymentEvent({
    req: request('invoice.payment_failed', {
      ...invoice(),
      status: 'open',
      amount_paid: 0,
    }),
  });
  assert.notEqual(event.paymentSession?.paymentStatus, PaymentStatus.SUCCESS);
});
test('Stripe period-end cancellation uses update, retains paid period and records a watermark', async (t) => {
  api(t, {
    '/v1/subscriptions/sub_test': (_url: URL, init: RequestInit) => {
      if (init.method === 'GET') return subscription();
      assert.equal(init.method, 'POST');
      const form = new URLSearchParams(String(init.body));
      assert.equal(form.get('cancel_at_period_end'), 'true');
      return {
        ...subscription(),
        cancel_at_period_end: true,
        canceled_at: Math.floor(Date.now() / 1000),
      };
    },
  });
  const session = await provider().cancelSubscription({
    subscriptionId: 'sub_test',
  });
  assert.equal(
    session.subscriptionInfo?.status,
    SubscriptionStatus.PENDING_CANCEL
  );
  assert.equal(
    session.subscriptionInfo?.canceledEndAt?.toISOString(),
    '2026-10-01T00:00:00.000Z'
  );
  assert.ok(session.subscriptionResult?._event_created_at > 0);
});
test('Stripe past-due cancellation stops collection immediately without prorating or invoicing', async (t) => {
  api(t, {
    '/v1/subscriptions/sub_test': (_url: URL, init: RequestInit) => {
      if (init.method === 'GET')
        return { ...subscription(), status: 'past_due' };
      assert.equal(init.method, 'DELETE');
      const form = _url.searchParams;
      assert.equal(form.get('prorate'), 'false');
      assert.equal(form.get('invoice_now'), 'false');
      return {
        ...subscription(),
        status: 'canceled',
        canceled_at: end,
        ended_at: end,
      };
    },
  });
  const result = await provider().cancelSubscription({
    subscriptionId: 'sub_test',
  });
  assert.equal(result.subscriptionInfo?.status, SubscriptionStatus.CANCELED);
  assert.notEqual(result.paymentStatus, PaymentStatus.SUCCESS);
});

test('Stripe subscription lifecycle snapshots preserve signed event time', async (t) => {
  api(t, {
    '/v1/subscriptions/sub_test': { ...subscription(), status: 'unpaid' },
  });
  const req = request('customer.subscription.updated', {
    ...subscription(),
    status: 'unpaid',
  });
  const created = JSON.parse(await req.clone().text()).created;
  const event = await provider().getPaymentEvent({ req });
  assert.equal(
    event.paymentSession?.subscriptionInfo?.status,
    SubscriptionStatus.EXPIRED
  );
  assert.equal(
    event.paymentSession?.subscriptionResult?._event_created_at,
    created * 1000
  );
});
test('Stripe successful refund is linked to the original PaymentIntent and cumulative amount', async (t) => {
  const refund = {
    id: 're_test',
    object: 'refund',
    status: 'succeeded',
    amount: 8900,
    currency: 'usd',
    charge: 'ch_test',
    payment_intent: 'pi_test',
  };
  api(t, {
    '/v1/invoice_payments': {
      data: [{ invoice: 'in_legacy' }],
      has_more: false,
    },
    '/v1/charges/ch_test': {
      id: 'ch_test',
      paid: true,
      amount: 8900,
      amount_refunded: 8900,
      currency: 'usd',
      payment_intent: 'pi_test',
    },
  });
  const event = await provider().getPaymentEvent({
    req: request('refund.updated', refund),
  });
  assert.equal(event.eventType, PaymentEventType.PAYMENT_REFUNDED);
  assert.equal(event.paymentSession?.refundInfo?.transactionId, 'pi_test');
  assert.equal(event.paymentSession?.refundInfo?.totalRefundedAmount, 8900);
  assert.equal(event.paymentSession?.refundInfo?.providerOrderId, 'in_legacy');
});

test('configured monthly price is validated before charging and Connect headers apply to all calls', async (t) => {
  const boundary = api(t, {
    '/v1/prices/price_legacy': (_url: URL, init: RequestInit) => {
      assert.equal(
        new Headers(init.headers).get('Stripe-Account'),
        'acct_lite'
      );
      return {
        id: 'price_legacy',
        active: true,
        type: 'recurring',
        unit_amount: 1590,
        currency: 'usd',
        recurring: { interval: 'month', interval_count: 1 },
      };
    },
    '/v1/checkout/sessions': (_url: URL, init: RequestInit) => {
      assert.equal(
        new Headers(init.headers).get('Stripe-Account'),
        'acct_lite'
      );
      const form = new URLSearchParams(String(init.body));
      assert.equal(form.get('line_items[0][price]'), 'price_legacy');
      assert.equal(form.get('line_items[0][price_data][unit_amount]'), null);
      assert.equal(
        new Headers(init.headers).get('Idempotency-Key'),
        'order_first'
      );
      return { id: 'cs_test_price', url: 'https://checkout.stripe.com/test' };
    },
  });
  const payment = {
    orderNo: 'order_first',
    productId: 'price_legacy',
    type: PaymentType.SUBSCRIPTION,
    price: { amount: 1590, currency: 'usd' },
    plan: { name: 'Starter', interval: PaymentInterval.MONTH },
    metadata,
  };
  const stripe = new StripeProvider({
    secretKey: 'sk_test_unit_only',
    publishableKey: '',
    accountId: 'acct_lite',
  });
  assert.equal(
    (await stripe.createPayment({ order: payment })).checkoutInfo.sessionId,
    'cs_test_price'
  );
  await assert.rejects(
    stripe.createPayment({
      order: { ...payment, price: { amount: 1, currency: 'usd' } },
    }),
    /price.*mismatch/i
  );
  assert.equal(boundary.mock.callCount(), 3);
});

test('signed Connect events from another account are rejected before API reads', async (t) => {
  const boundary = api(t, {});
  const stripe = new StripeProvider({
    secretKey: 'sk_test_unit_only',
    publishableKey: '',
    signingSecret: secret,
    accountId: 'acct_lite',
  });
  await assert.rejects(
    stripe.getPaymentEvent({
      req: request('checkout.session.completed', checkout()),
    }),
    /account mismatch/i
  );
  assert.equal(boundary.mock.callCount(), 0);
});

test('legacy one-time refunds resolve application scope by invoice even without PaymentIntent metadata', async (t) => {
  api(t, {
    '/v1/payment_intents/pi_legacy': { id: 'pi_legacy', metadata: {} },
    '/v1/invoice_payments': {
      data: [{ id: 'inpay_old', invoice: 'in_legacy' }],
      has_more: false,
    },
    '/v1/invoices/in_legacy': { id: 'in_legacy', metadata: {}, parent: null },
    '/v1/charges/ch_legacy': {
      id: 'ch_legacy',
      paid: true,
      amount: 1590,
      amount_refunded: 1590,
      currency: 'usd',
      payment_intent: 'pi_legacy',
    },
  });
  const stripe = new StripeProvider({
    secretKey: 'sk_test_unit_only',
    publishableKey: '',
    signingSecret: secret,
    isPaymentRelated: async (reference) =>
      reference.providerOrderId === 'in_legacy',
  });
  const result = await stripe.getPaymentEvent({
    req: request('refund.updated', {
      id: 're_legacy',
      status: 'succeeded',
      amount: 1590,
      currency: 'usd',
      charge: 'ch_legacy',
      payment_intent: 'pi_legacy',
      metadata: {},
    }),
  });
  assert.equal(result.eventType, PaymentEventType.PAYMENT_REFUNDED);
  assert.equal(result.paymentSession?.refundInfo?.providerOrderId, 'in_legacy');
});

test('Stripe serializes same-subscription authoritative reads before assigning state order', async (t) => {
  let release!: (value: unknown) => void;
  let started!: () => void;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  const delayed = new Promise<unknown>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  api(t, {
    '/v1/subscriptions/sub_test': () => {
      if (++calls === 1) {
        started();
        return delayed;
      }
      return { ...subscription(), cancel_at_period_end: true };
    },
  });
  const stripe = provider();
  const old = stripe.getPaymentEvent({
    req: request('customer.subscription.updated', subscription()),
  });
  await ready;
  const freshPromise = stripe.getPaymentEvent({
    req: request('customer.subscription.updated', subscription()),
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  const overlappingReads = calls;
  release(subscription());
  const fresh = await freshPromise;
  const late = await old;
  assert.equal(overlappingReads, 1);
  assert.equal(
    fresh.paymentSession?.subscriptionInfo?.status,
    SubscriptionStatus.PENDING_CANCEL
  );
  assert.ok(
    late.paymentSession?.subscriptionResult?._state_observed_at <
      fresh.paymentSession?.subscriptionResult?._state_observed_at
  );
});
test('Stripe checkout forwards protected metadata and an order-scoped idempotency key', async (t) => {
  const expiresAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
  api(t, {
    '/v1/customers': {
      data: [
        {
          id: 'cust_test',
          metadata: { wanai_app: 'wanai30-lite', user_id: 'user_test' },
        },
      ],
      has_more: false,
    },
    '/v1/checkout/sessions': (_url: URL, init: RequestInit) => {
      const form = new URLSearchParams(String(init.body));
      assert.equal(
        form.get('subscription_data[metadata][order_no]'),
        'order_first'
      );
      assert.equal(
        form.get('subscription_data[metadata][user_id]'),
        'user_test'
      );
      assert.equal(form.get('payment_method_types[0]'), 'card');
      assert.equal(form.get('expires_at'), String(expiresAt));
      assert.equal(
        new Headers(init.headers).get('Idempotency-Key'),
        'order_first'
      );
      return { id: 'cs_test', url: 'https://checkout.stripe.com/test' };
    },
  });
  const result = await provider().createPayment({
    order: {
      orderNo: 'order_first',
      type: PaymentType.SUBSCRIPTION,
      expiresAt,
      price: { amount: 8900, currency: 'usd' },
      plan: { name: 'WanAI Test', interval: PaymentInterval.MONTH },
      customer: { email: 'test@example.invalid' },
      metadata,
    },
  });
  assert.equal(result.checkoutInfo.sessionId, 'cs_test');
});

test('Stripe cancellation shares the authoritative-read queue and cannot overtake an in-flight read', async (t) => {
  let release!: (value: unknown) => void;
  let started!: () => void;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  const delayed = new Promise<unknown>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  api(t, {
    '/v1/subscriptions/sub_test': (_url: URL, init: RequestInit) => {
      calls++;
      if (init.method === 'GET') {
        started();
        return delayed;
      }
      assert.equal(init.method, 'POST');
      return { ...subscription(), cancel_at_period_end: true };
    },
  });
  const stripe = provider();
  const reading = stripe.getPaymentEvent({
    req: request('customer.subscription.updated', subscription()),
  });
  await ready;
  const canceling = stripe.cancelSubscription({ subscriptionId: 'sub_test' });
  await new Promise<void>((resolve) => setImmediate(resolve));
  const overlappingCalls = calls;
  release(subscription());
  const [read, canceled] = await Promise.all([reading, canceling]);
  assert.equal(overlappingCalls, 1);
  assert.equal(
    canceled.subscriptionInfo?.status,
    SubscriptionStatus.PENDING_CANCEL
  );
  assert.ok(
    read.paymentSession?.subscriptionResult?._state_observed_at <
      canceled.subscriptionResult?._state_observed_at
  );
});
