import Stripe from 'stripe';

import { stripeCheckoutMode, stripeKeyMode } from './stripe-mode';
import {
  assertStripeEventScope,
  WANAI_PAYMENT_APP,
  type StripePaymentReference,
} from './stripe-scope';
import {
  CheckoutSession,
  PaymentBilling,
  PaymentEventType,
  PaymentInterval,
  PaymentInvoice,
  PaymentStatus,
  PaymentType,
  SubscriptionCycleType,
  SubscriptionInfo,
  SubscriptionStatus,
  type PaymentConfigs,
  type PaymentEvent,
  type PaymentOrder,
  type PaymentProvider,
  type PaymentRefundInfo,
  type PaymentSession,
} from './types';

type StripeRefundLike = Pick<
  Stripe.Refund,
  'id' | 'amount' | 'currency' | 'status' | 'payment_intent'
>;

type StripeChargeLike = Pick<
  Stripe.Charge,
  'amount_refunded' | 'currency' | 'payment_intent'
>;

function stripeObjectId(value: { id?: string } | string | null | undefined) {
  return typeof value === 'string' ? value : value?.id;
}

export function normalizeStripeRefund({
  refund,
  charge,
  invoiceId,
}: {
  refund: StripeRefundLike;
  charge: StripeChargeLike;
  invoiceId?: string;
}): PaymentRefundInfo {
  const transactionId = stripeObjectId(refund.payment_intent);
  const chargeTransactionId = stripeObjectId(charge.payment_intent);
  if (!transactionId) throw new Error('Stripe refund payment intent missing');
  if (chargeTransactionId && chargeTransactionId !== transactionId)
    throw new Error('Stripe refund payment intent mismatch');
  if (charge.currency.toLowerCase() !== refund.currency.toLowerCase())
    throw new Error('Stripe refund currency mismatch');
  if (!Number.isSafeInteger(charge.amount_refunded))
    throw new Error('Stripe cumulative refund amount missing');

  return {
    refundId: refund.id,
    transactionId,
    providerOrderId: invoiceId,
    amount: refund.amount,
    currency: refund.currency,
    totalRefundedAmount: charge.amount_refunded,
    status: refund.status || 'pending',
  };
}

export function mapStripeEventType(eventType: string): PaymentEventType {
  switch (eventType) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
    case 'checkout.session.async_payment_failed':
      return PaymentEventType.CHECKOUT_SUCCESS;
    case 'invoice.payment_succeeded':
    case 'invoice.paid':
      return PaymentEventType.PAYMENT_SUCCESS;
    case 'invoice.payment_failed':
      // No grants or extensions on failure. The authoritative subscription
      // status is synchronized by customer.subscription.updated instead.
      return PaymentEventType.IGNORED;
    case 'refund.created':
    case 'refund.updated':
      return PaymentEventType.PAYMENT_REFUNDED;
    case 'customer.subscription.updated':
      return PaymentEventType.SUBSCRIBE_UPDATED;
    case 'customer.subscription.deleted':
      return PaymentEventType.SUBSCRIBE_CANCELED;
    default:
      return PaymentEventType.IGNORED;
  }
}

// Keep API requests and the dashboard's snapshot webhook endpoint on the same
// version as the installed Stripe SDK. No new SDK dependency is required.
export const STRIPE_API_VERSION = '2025-08-27.basil' as const;
const objectId = (value: string | { id?: string } | null | undefined) =>
  typeof value === 'string' ? value : value?.id;

// Stripe event timestamps have second precision and no ordering guarantee.
// Serialize authoritative reads/mutations for the same subscription so local
// observation order also reflects Stripe's actual read order, not network order.
let lastStateObservation = 0;
const stateObservationTime = () =>
  (lastStateObservation = Math.max(Date.now(), lastStateObservation + 1));
const pendingStateOperations = new Map<string, Promise<void>>();
async function subscriptionStateOperation<T>(
  id: string,
  execute: () => Promise<T>
): Promise<T> {
  const previous = pendingStateOperations.get(id) || Promise.resolve();
  const result = previous.then(execute, execute);
  const tail = result.then(
    () => undefined,
    () => undefined
  );
  pendingStateOperations.set(id, tail);
  void tail.then(() => {
    if (pendingStateOperations.get(id) === tail)
      pendingStateOperations.delete(id);
  });
  return result;
}

/**
 * Stripe payment provider configs
 * @docs https://stripe.com/docs
 */
export interface StripeConfigs extends PaymentConfigs {
  secretKey: string;
  publishableKey: string;
  signingSecret?: string;
  apiVersion?: string;
  allowedPaymentMethods?: string[];
  allowPromotionCodes?: boolean;
  accountId?: string;
  isPaymentRelated?: (reference: StripePaymentReference) => Promise<boolean>;
}

/**
 * Stripe payment provider implementation
 * @website https://stripe.com/
 */
export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe';
  configs: StripeConfigs;

  private client: Stripe;

  constructor(configs: StripeConfigs) {
    this.configs = { ...configs, secretKey: configs.secretKey.trim() };
    if (!stripeKeyMode(this.configs.secretKey))
      throw new Error('Invalid Stripe secret key mode');
    this.client = new Stripe(this.configs.secretKey, {
      apiVersion: STRIPE_API_VERSION,
      stripeAccount: this.configs.accountId,
      httpClient: Stripe.createFetchHttpClient(),
    });
  }

  async createPayment({
    order,
  }: {
    order: PaymentOrder;
  }): Promise<CheckoutSession> {
    try {
      // check payment price
      if (!order.price) {
        throw new Error('price is required');
      }
      if (!Number.isSafeInteger(order.price.amount) || order.price.amount <= 0)
        throw new Error('A positive integer payment amount is required');
      if (
        !order.orderNo ||
        order.metadata?.order_no !== order.orderNo ||
        !order.metadata?.user_id
      )
        throw new Error('Server-owned order metadata is required');
      if (
        order.discount ||
        this.configs.allowPromotionCodes ||
        order.plan?.trialPeriodDays
      )
        throw new Error(
          'Discounts and trials are not supported in the first Stripe phase'
        );

      // Legacy monthly Price IDs remain supported, but cannot override the catalog.
      if (order.productId) {
        const savedPrice = await this.client.prices.retrieve(order.productId);
        if (
          !savedPrice.active ||
          savedPrice.unit_amount !== order.price.amount ||
          savedPrice.currency.toLowerCase() !==
            order.price.currency.toLowerCase() ||
          (order.type === PaymentType.SUBSCRIPTION
            ? savedPrice.recurring?.interval !== order.plan?.interval ||
              savedPrice.recurring?.interval_count !==
                (order.plan?.intervalCount || 1)
            : savedPrice.type !== 'one_time')
        )
          throw new Error('Stripe price mismatch');
      }

      // create payment with dynamic product

      // build price data
      const priceData: Stripe.Checkout.SessionCreateParams.LineItem.PriceData =
        {
          currency: order.price.currency,
          unit_amount: order.price.amount, // unit: cents
          product_data: {
            name: order.description || '',
          },
        };

      if (order.type === PaymentType.SUBSCRIPTION) {
        // create subscription payment

        // check payment plan
        if (!order.plan) {
          throw new Error('plan is required');
        }

        // build recurring data
        priceData.recurring = {
          interval: order.plan
            .interval as Stripe.Checkout.SessionCreateParams.LineItem.PriceData.Recurring.Interval,
          interval_count: order.plan.intervalCount || 1,
        };
      } else {
        // create one-time payment
      }

      // set or create customer
      let customerId = '';
      if (order.customer?.email) {
        for await (const customer of this.client.customers.list({
          email: order.customer.email,
          limit: 100,
        })) {
          if (
            customer.metadata?.wanai_app === WANAI_PAYMENT_APP &&
            customer.metadata?.user_id === order.metadata.user_id
          ) {
            customerId = customer.id;
            break;
          }
        }
        if (!customerId) {
          const customer = await this.client.customers.create(
            {
              email: order.customer.email,
              name: order.customer.name,
              metadata: {
                ...order.customer.metadata,
                wanai_app: WANAI_PAYMENT_APP,
                user_id: order.metadata.user_id,
              },
            },
            { idempotencyKey: `wan30ai-customer-${order.orderNo}` }
          );
          customerId = customer.id;
        }
      }

      // create payment session params
      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        ...(order.expiresAt ? { expires_at: order.expiresAt } : {}),
        payment_method_types: ['card'],
        automatic_tax: { enabled: false },
        adaptive_pricing: { enabled: false },
        mode:
          order.type === PaymentType.SUBSCRIPTION ? 'subscription' : 'payment',
        line_items: [
          order.productId
            ? { price: order.productId, quantity: 1 }
            : { price_data: priceData, quantity: 1 },
        ],
      };

      // If currency is CNY, enable WeChat Pay and Alipay (only for one-time payments)
      // Note: WeChat Pay and Alipay through Stripe only supports one-time payments, not subscriptions
      const currency = order.price.currency.toLowerCase();
      if (currency === 'cny' && order.type === PaymentType.ONE_TIME) {
        // Enable WeChat Pay and Alipay for CNY one-time payments
        sessionParams.payment_method_types = [];
        sessionParams.payment_method_options = {};

        // get allowed payment methods
        const allowedPaymentMethods = this.configs.allowedPaymentMethods || [];

        if (allowedPaymentMethods.includes('card')) {
          sessionParams.payment_method_types.push('card');
        }
        if (allowedPaymentMethods.includes('wechat_pay')) {
          sessionParams.payment_method_types.push('wechat_pay');
          sessionParams.payment_method_options.wechat_pay = {
            client: 'web',
          };
        }
        if (allowedPaymentMethods.includes('alipay')) {
          sessionParams.payment_method_types.push('alipay');
          sessionParams.payment_method_options.alipay = {};
        }

        if (allowedPaymentMethods.length === 0) {
          // not set allowed payment methods, use default payment methods
          sessionParams.payment_method_types = ['card'];
        }
      }

      if (order.type === PaymentType.ONE_TIME) {
        sessionParams.invoice_creation = {
          enabled: true,
        };
      }

      if (customerId) {
        sessionParams.customer = customerId;
      }

      if (order.metadata) {
        const metadata = { ...order.metadata, wanai_app: WANAI_PAYMENT_APP };
        sessionParams.metadata = metadata;
        if (order.type === PaymentType.SUBSCRIPTION) {
          sessionParams.subscription_data = { metadata };
        } else {
          sessionParams.payment_intent_data = { metadata };
        }
      }

      if (order.successUrl) {
        sessionParams.success_url = order.successUrl;
      }

      if (order.cancelUrl) {
        sessionParams.cancel_url = order.cancelUrl;
      }

      const session = await this.client.checkout.sessions.create(
        sessionParams,
        {
          idempotencyKey: order.orderNo,
        }
      );
      if (!session.id || !session.url) {
        throw new Error('create payment failed');
      }

      return {
        provider: this.name,
        checkoutParams: sessionParams,
        checkoutInfo: {
          sessionId: session.id,
          checkoutUrl: session.url,
        },
        checkoutResult: session,
        metadata: sessionParams.metadata,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get payment session by session id
   */
  async getPaymentSession({
    sessionId,
  }: {
    sessionId: string;
  }): Promise<PaymentSession> {
    try {
      if (!sessionId) {
        throw new Error('sessionId is required');
      }
      const sessionMode = stripeCheckoutMode(sessionId);
      if (
        sessionMode &&
        sessionMode !== stripeKeyMode(this.configs.secretKey)
      ) {
        throw new Error('checkout_needs_review');
      }

      const session = await this.client.checkout.sessions.retrieve(sessionId);

      return await this.buildPaymentSessionFromCheckoutSession(session);
    } catch (error) {
      // A same-mode 404 may mean the key belongs to another Stripe account.
      // Never use it as permission to discard the order or create a new charge.
      if (
        error instanceof Stripe.errors.StripeInvalidRequestError &&
        error.code === 'resource_missing'
      ) {
        throw new Error('checkout_needs_review');
      }
      throw error;
    }
  }

  /**
   * Get payment event from webhook notification
   */
  async getPaymentEvent({ req }: { req: Request }): Promise<PaymentEvent> {
    try {
      const rawBody = await req.text();
      const signature = req.headers.get('stripe-signature') as string;

      if (!rawBody || !signature) {
        throw new Error('Invalid webhook request');
      }

      if (!this.configs.signingSecret) {
        throw new Error('Signing Secret not configured');
      }

      let event: Stripe.Event;
      try {
        event = this.client.webhooks.constructEvent(
          rawBody,
          signature,
          this.configs.signingSecret
        );
      } catch {
        throw new Error('Invalid webhook signature');
      }
      try {
        assertStripeEventScope(event, {
          mode: stripeKeyMode(this.configs.secretKey)!,
          accountId: this.configs.accountId,
        });
      } catch {
        throw new Error(
          'Invalid webhook payload: Stripe mode mismatch or account mismatch'
        );
      }

      let paymentSession: PaymentSession | undefined = undefined;

      const eventType = mapStripeEventType(event.type);
      const ignored = () => ({
        eventType: PaymentEventType.IGNORED,
        eventResult: event,
      });
      if (eventType === PaymentEventType.IGNORED) return ignored();
      if (!(await this.isRelevantEvent(event))) return ignored();

      if (eventType === PaymentEventType.CHECKOUT_SUCCESS) {
        paymentSession = await this.buildPaymentSessionFromCheckoutSession(
          event.data.object as Stripe.Response<Stripe.Checkout.Session>
        );
        if (event.type === 'checkout.session.async_payment_failed')
          paymentSession.paymentStatus = PaymentStatus.FAILED;
      } else if (eventType === PaymentEventType.PAYMENT_SUCCESS) {
        const invoice = event.data.object as Stripe.Invoice;
        // One-time invoice receipts and unsupported adjustments do not create
        // extra grants. Only normal first and recurring subscription invoices.
        if (
          !['subscription_create', 'subscription_cycle'].includes(
            invoice.billing_reason || ''
          )
        )
          return ignored();
        paymentSession = await this.buildPaymentSessionFromInvoice(
          event.data.object as Stripe.Response<Stripe.Invoice>
        );
      } else if (eventType === PaymentEventType.PAYMENT_REFUNDED) {
        const refund = event.data.object as Stripe.Refund;
        if (refund.status !== 'succeeded') return ignored();
        paymentSession = await this.buildRefundSession(refund);
      } else if (eventType === PaymentEventType.SUBSCRIBE_UPDATED) {
        paymentSession = await this.buildPaymentSessionFromSubscription(
          await this.currentSubscription(
            (event.data.object as Stripe.Subscription).id
          )
        );
      } else if (eventType === PaymentEventType.SUBSCRIBE_CANCELED) {
        paymentSession = await this.buildPaymentSessionFromSubscription(
          await this.currentSubscription(
            (event.data.object as Stripe.Subscription).id
          )
        );
      }

      if (!paymentSession) {
        throw new Error('Invalid webhook event');
      }
      if (paymentSession.subscriptionResult) {
        paymentSession.subscriptionResult = {
          ...paymentSession.subscriptionResult,
          _event_created_at: event.created * 1000,
        };
      }

      return {
        eventType: eventType,
        eventResult: event,
        paymentSession: paymentSession,
      };
    } catch (error) {
      throw error;
    }
  }

  async getPaymentInvoice({
    invoiceId,
  }: {
    invoiceId: string;
  }): Promise<PaymentInvoice> {
    try {
      const invoice = await this.client.invoices.retrieve(invoiceId);
      if (!invoice.id) {
        throw new Error('Invoice not found');
      }

      return {
        invoiceId: invoice.id,
        invoiceUrl: invoice.hosted_invoice_url || undefined,
        amount: invoice.amount_paid,
        currency: invoice.currency,
      };
    } catch (error) {
      throw error;
    }
  }

  async getPaymentBilling({
    customerId,
    returnUrl,
  }: {
    customerId: string;
    returnUrl?: string;
  }): Promise<PaymentBilling> {
    try {
      const customer = await this.client.customers.retrieve(customerId);
      if (customer.deleted || customer.metadata.wanai_app !== WANAI_PAYMENT_APP)
        throw new Error(
          'Stripe customer is not isolated; contact support for billing'
        );
      let configurationId: string | undefined;
      for await (const configuration of this.client.billingPortal.configurations.list(
        { active: true, limit: 100 }
      )) {
        const features = configuration.features;
        if (
          configuration.metadata?.wanai_app === WANAI_PAYMENT_APP &&
          configuration.active &&
          !configuration.is_default &&
          features.subscription_update?.enabled === false &&
          features.subscription_cancel?.enabled === false &&
          features.customer_update?.enabled === false &&
          features.invoice_history?.enabled === true &&
          features.payment_method_update?.enabled === true
        ) {
          configurationId = configuration.id;
          break;
        }
      }
      if (!configurationId)
        throw new Error(
          'Stripe isolated billing configuration is required; contact support'
        );
      const billing = await this.client.billingPortal.sessions.create({
        customer: customerId,
        configuration: configurationId,
        return_url: returnUrl,
      });

      if (!billing.url) {
        throw new Error('get billing url failed');
      }

      return {
        billingUrl: billing.url,
      };
    } catch (error) {
      throw error;
    }
  }

  async cancelSubscription({
    subscriptionId,
  }: {
    subscriptionId: string;
  }): Promise<PaymentSession> {
    try {
      if (!subscriptionId) {
        throw new Error('subscriptionId is required');
      }

      const subscription = await subscriptionStateOperation(
        subscriptionId,
        async () => {
          const current =
            await this.client.subscriptions.retrieve(subscriptionId);
          // Failed collection has no newly paid period to preserve. End the
          // contract now so Stripe also stops retrying its open invoices.
          const updated = ['canceled', 'incomplete_expired'].includes(
            current.status
          )
            ? current
            : ['past_due', 'unpaid', 'incomplete', 'paused'].includes(
                  current.status
                )
              ? await this.client.subscriptions.cancel(subscriptionId, {
                  prorate: false,
                  invoice_now: false,
                })
              : await this.client.subscriptions.update(subscriptionId, {
                  cancel_at_period_end: true,
                });
          if (
            !updated.cancel_at_period_end &&
            !['canceled', 'incomplete_expired'].includes(updated.status)
          )
            throw new Error('Cancel subscription failed');
          return { ...updated, _state_observed_at: stateObservationTime() };
        }
      );

      const session =
        await this.buildPaymentSessionFromSubscription(subscription);
      session.subscriptionResult = {
        ...subscription,
        _event_created_at: Date.now(),
      };
      return session;
    } catch (error) {
      throw error;
    }
  }

  private invoiceReference(invoice: Stripe.Invoice): StripePaymentReference {
    return {
      providerOrderId: invoice.id,
      metadata: [
        invoice.metadata,
        invoice.parent?.subscription_details?.metadata,
      ],
      subscriptionId: objectId(
        invoice.parent?.subscription_details?.subscription
      ),
    };
  }

  private async isRelevantEvent(event: Stripe.Event): Promise<boolean> {
    const matches = this.configs.isPaymentRelated;
    if (!matches) return true;
    if (event.type.startsWith('checkout.session.')) {
      const checkout = event.data.object as Stripe.Checkout.Session;
      return matches({
        metadata: [checkout.metadata],
        subscriptionId: objectId(checkout.subscription),
        transactionId: objectId(checkout.payment_intent),
      });
    }
    if (event.type.startsWith('customer.subscription.')) {
      const subscription = event.data.object as Stripe.Subscription;
      return matches({
        metadata: [subscription.metadata],
        subscriptionId: subscription.id,
      });
    }
    if (event.type.startsWith('invoice.')) {
      return matches(
        this.invoiceReference(event.data.object as Stripe.Invoice)
      );
    }
    if (event.type.startsWith('refund.')) {
      const refund = event.data.object as Stripe.Refund;
      if (refund.status !== 'succeeded') return false;
      const transactionId = objectId(refund.payment_intent);
      if (await matches({ metadata: [refund.metadata], transactionId }))
        return true;
      if (!transactionId) return false;
      // A refund can precede local settlement. Resolve ownership via Stripe's
      // payment/invoice linkage before deciding it belongs to another project.
      // Read failures propagate so an outage cannot silently drop a refund.
      const intent = await this.client.paymentIntents.retrieve(transactionId);
      if (await matches({ metadata: [intent.metadata], transactionId }))
        return true;
      for await (const allocation of this.client.invoicePayments.list({
        payment: { type: 'payment_intent', payment_intent: transactionId },
        limit: 100,
      })) {
        const invoiceId = objectId(allocation.invoice);
        if (!invoiceId) throw new Error('Stripe refund invoice is required');
        const invoice = await this.client.invoices.retrieve(invoiceId);
        if (await matches(this.invoiceReference(invoice))) return true;
      }
      return false;
    }
    return false;
  }

  private mapStripeStatus(session: Stripe.Checkout.Session): PaymentStatus {
    switch (session.status) {
      case 'complete':
        // session complete, check payment status
        switch (session.payment_status) {
          case 'paid':
            // payment success
            return PaymentStatus.SUCCESS;
          case 'unpaid':
            // payment failed
            return PaymentStatus.PROCESSING;
          case 'no_payment_required':
            // means payment not required, should be success
            return PaymentStatus.SUCCESS;
          default:
            throw new Error(
              `Unknown Stripe payment status: ${session.payment_status}`
            );
        }
      case 'expired':
        // payment canceled
        return PaymentStatus.CANCELED;
      case 'open':
        return PaymentStatus.PROCESSING;
      default:
        throw new Error(`Unknown Stripe status: ${session.status}`);
    }
  }

  private async currentSubscription(id: string) {
    if (!id) throw new Error('Stripe subscription ID is required');
    return subscriptionStateOperation(id, async () => {
      const subscription = await this.client.subscriptions.retrieve(id);
      if (subscription.id !== id)
        throw new Error('Stripe subscription mismatch');
      return { ...subscription, _state_observed_at: stateObservationTime() };
    });
  }

  private mergeMetadata(...sources: (Stripe.Metadata | null | undefined)[]) {
    const result: Stripe.Metadata = {};
    for (const source of sources) {
      for (const key of ['order_no', 'user_id', 'wanai_app']) {
        if (source?.[key] && result[key] && source[key] !== result[key])
          throw new Error('Stripe payment metadata mismatch');
      }
      Object.assign(result, source || {});
    }
    if (!result.order_no || !result.user_id)
      throw new Error('Stripe payment metadata is required');
    return result;
  }

  private async verifiedIntent(
    id: string | undefined,
    amount: number,
    currency: string,
    customer: string | undefined
  ) {
    if (!id || !customer)
      throw new Error('Stripe payment mismatch: missing payment/customer');
    const intent = await this.client.paymentIntents.retrieve(id);
    if (
      intent.status !== 'succeeded' ||
      intent.amount !== amount ||
      intent.amount_received !== amount ||
      intent.currency !== currency ||
      objectId(intent.customer) !== customer
    )
      throw new Error('Stripe payment mismatch');
    return intent;
  }

  // A PaymentIntent is the canonical transaction for checkout, invoice and
  // refund notifications. These must never grant the same payment twice.
  private async buildPaymentSessionFromCheckoutSession(
    session: Stripe.Checkout.Session
  ): Promise<PaymentSession> {
    const result: PaymentSession = {
      provider: this.name,
      paymentStatus: this.mapStripeStatus(session),
      paymentResult: session,
      metadata: session.metadata,
    };
    if (result.paymentStatus !== PaymentStatus.SUCCESS) return result;
    if (
      session.payment_status !== 'paid' ||
      !session.currency ||
      !Number.isSafeInteger(session.amount_subtotal) ||
      !session.amount_subtotal ||
      session.amount_subtotal <= 0 ||
      session.amount_total !== session.amount_subtotal ||
      (session.total_details?.amount_discount || 0) !== 0
    )
      throw new Error('Stripe payment mismatch: unsupported checkout amount');

    if (session.subscription) {
      // Use the checkout's historical invoice, never latest_invoice (which can
      // already refer to another cycle when a notification arrives late).
      const invoiceId = objectId(session.invoice);
      if (!invoiceId) throw new Error('Stripe checkout invoice is required');
      const invoice = await this.client.invoices.retrieve(invoiceId);
      const paid = await this.buildPaymentSessionFromInvoice(invoice);
      if (
        invoice.billing_reason !== 'subscription_create' ||
        paid.subscriptionId !== objectId(session.subscription) ||
        paid.paymentInfo?.amount !== session.amount_subtotal ||
        paid.paymentInfo?.currency !== session.currency ||
        paid.paymentInfo?.paymentUserId !== objectId(session.customer)
      )
        throw new Error('Stripe payment mismatch: checkout invoice');
      return {
        ...paid,
        paymentResult: session,
        metadata: this.mergeMetadata(paid.metadata, session.metadata),
      };
    }
    const intent = await this.verifiedIntent(
      objectId(session.payment_intent),
      session.amount_total,
      session.currency,
      objectId(session.customer)
    );
    result.metadata = this.mergeMetadata(intent.metadata, session.metadata);
    result.paymentInfo = {
      transactionId: intent.id,
      amount: session.amount_subtotal,
      currency: session.currency,
      discountAmount: 0,
      paymentAmount: session.amount_total,
      paymentCurrency: session.currency,
      paymentEmail:
        session.customer_email || session.customer_details?.email || undefined,
      paymentUserName: session.customer_details?.name || '',
      paymentUserId: objectId(session.customer),
      paidAt: new Date(session.created * 1000),
      invoiceId: objectId(session.invoice),
    };
    return result;
  }

  private async buildPaymentSessionFromInvoice(
    invoice: Stripe.Invoice
  ): Promise<PaymentSession> {
    const parent = invoice.parent?.subscription_details;
    const subscriptionId = objectId(parent?.subscription);
    const line = invoice.lines.data[0];
    if (
      invoice.status !== 'paid' ||
      !subscriptionId ||
      !Number.isSafeInteger(invoice.subtotal) ||
      invoice.subtotal <= 0 ||
      invoice.amount_paid !== invoice.subtotal ||
      invoice.total !== invoice.subtotal ||
      invoice.amount_remaining !== 0 ||
      invoice.lines.has_more ||
      invoice.lines.data.length !== 1 ||
      line.amount !== invoice.subtotal ||
      line.quantity !== 1 ||
      line.parent?.subscription_item_details?.proration ||
      objectId(line.parent?.subscription_item_details?.subscription) !==
        subscriptionId ||
      !Number.isSafeInteger(line.period.start) ||
      !Number.isSafeInteger(line.period.end) ||
      line.period.start <= 0 ||
      line.period.end <= line.period.start
    )
      throw new Error('Stripe payment mismatch: unsupported paid invoice');

    // Basil removed invoice.payment_intent. Invoice Payments provides the
    // authoritative allocation; manual/split/balance-only payments are outside
    // this first phase and must not be mistaken for fully settled card charges.
    const allocations = await this.client.invoicePayments.list({
      invoice: invoice.id,
      status: 'paid',
      limit: 2,
    });
    const allocation = allocations.data[0];
    if (
      allocations.has_more ||
      allocations.data.length !== 1 ||
      allocation.status !== 'paid' ||
      objectId(allocation.invoice) !== invoice.id ||
      allocation.amount_paid !== invoice.amount_paid ||
      allocation.payment.type !== 'payment_intent'
    )
      throw new Error('Stripe payment allocation is unsupported');
    const intent = await this.verifiedIntent(
      objectId(allocation.payment.payment_intent),
      invoice.amount_paid,
      invoice.currency,
      objectId(invoice.customer)
    );
    const subscription = await this.currentSubscription(subscriptionId);
    const subscriptionInfo = await this.buildSubscriptionInfo(subscription);
    // Entitlements follow the actual paid invoice, not the current API snapshot.
    subscriptionInfo.currentPeriodStart = new Date(line.period.start * 1000);
    subscriptionInfo.currentPeriodEnd = new Date(line.period.end * 1000);
    if (
      subscriptionInfo.amount !== invoice.subtotal ||
      subscriptionInfo.currency !== invoice.currency
    )
      throw new Error('Stripe payment mismatch: subscription price');
    return {
      provider: this.name,
      paymentStatus: PaymentStatus.SUCCESS,
      paymentInfo: {
        transactionId: intent.id,
        amount: invoice.subtotal,
        currency: invoice.currency,
        discountAmount: 0,
        paymentAmount: invoice.amount_paid,
        paymentCurrency: invoice.currency,
        paymentEmail: invoice.customer_email || '',
        paymentUserName: invoice.customer_name || '',
        paymentUserId: objectId(invoice.customer),
        paidAt: new Date(
          (invoice.status_transitions.paid_at || invoice.created) * 1000
        ),
        invoiceId: invoice.id,
        invoiceUrl: invoice.hosted_invoice_url || '',
        subscriptionCycleType:
          invoice.billing_reason === 'subscription_create'
            ? SubscriptionCycleType.CREATE
            : SubscriptionCycleType.RENEWAL,
      },
      paymentResult: invoice,
      metadata: this.mergeMetadata(
        subscription.metadata,
        parent?.metadata,
        intent.metadata,
        invoice.metadata
      ),
      subscriptionId,
      subscriptionInfo,
      subscriptionResult: subscription,
    };
  }

  private async buildPaymentSessionFromSubscription(
    subscription: Stripe.Subscription
  ): Promise<PaymentSession> {
    return {
      provider: this.name,
      subscriptionId: subscription.id,
      subscriptionInfo: await this.buildSubscriptionInfo(subscription),
      subscriptionResult: subscription,
      metadata: subscription.metadata,
    };
  }

  private async buildSubscriptionInfo(
    subscription: Stripe.Subscription
  ): Promise<SubscriptionInfo> {
    if (subscription.items.data.length !== 1 || subscription.items.has_more)
      throw new Error('Stripe multi-item subscriptions are not supported');
    const data = subscription.items.data[0];
    const recurring = data.price.recurring;
    if (!recurring) throw new Error('Stripe recurring price is required');
    const subscriptionInfo: SubscriptionInfo = {
      subscriptionId: subscription.id,
      productId: objectId(data.price.product),
      planId: data.price.id,
      amount: data.price.unit_amount || 0,
      currency: data.price.currency,
      currentPeriodStart: data.current_period_start
        ? new Date(data.current_period_start * 1000)
        : undefined,
      currentPeriodEnd: data.current_period_end
        ? new Date(data.current_period_end * 1000)
        : undefined,
      interval: recurring.interval as PaymentInterval,
      intervalCount: recurring.interval_count,
      metadata: subscription.metadata,
    };
    switch (subscription.status) {
      case 'active':
      case 'trialing':
        subscriptionInfo.status =
          subscription.status === 'trialing'
            ? SubscriptionStatus.TRIALING
            : SubscriptionStatus.ACTIVE;
        if (!subscription.cancel_at && !subscription.cancel_at_period_end)
          break;
        subscriptionInfo.status = SubscriptionStatus.PENDING_CANCEL;
        subscriptionInfo.canceledEndAt = subscription.cancel_at
          ? new Date(subscription.cancel_at * 1000)
          : subscriptionInfo.currentPeriodEnd;
        break;
      case 'canceled':
        subscriptionInfo.status = SubscriptionStatus.CANCELED;
        subscriptionInfo.canceledEndAt = subscription.ended_at
          ? new Date(subscription.ended_at * 1000)
          : undefined;
        break;
      case 'paused':
        subscriptionInfo.status = SubscriptionStatus.PAUSED;
        break;
      case 'past_due':
      case 'unpaid':
      case 'incomplete':
        subscriptionInfo.status = SubscriptionStatus.EXPIRED;
        break;
      case 'incomplete_expired':
        subscriptionInfo.status = SubscriptionStatus.CANCELED;
        break;
      default:
        throw new Error(
          `Unknown Stripe subscription status: ${subscription.status}`
        );
    }
    if (
      subscription.status !== 'canceled' &&
      subscription.status !== 'incomplete_expired' &&
      (subscription.cancel_at_period_end || subscription.cancel_at)
    ) {
      subscriptionInfo.status = SubscriptionStatus.PENDING_CANCEL;
      subscriptionInfo.canceledEndAt = subscription.cancel_at
        ? new Date(subscription.cancel_at * 1000)
        : subscriptionInfo.currentPeriodEnd;
    }
    if (
      [SubscriptionStatus.PENDING_CANCEL, SubscriptionStatus.CANCELED].includes(
        subscriptionInfo.status
      )
    ) {
      subscriptionInfo.canceledAt = subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000)
        : new Date();
      subscriptionInfo.canceledReason =
        subscription.cancellation_details?.comment || '';
      subscriptionInfo.canceledReasonType =
        subscription.cancellation_details?.feedback || '';
    }
    return subscriptionInfo;
  }

  private async buildRefundSession(
    refund: Stripe.Refund
  ): Promise<PaymentSession> {
    const chargeId = objectId(refund.charge);
    const intentId = objectId(refund.payment_intent);
    if (!chargeId || !intentId)
      throw new Error('Stripe refund payment is required');
    const charge = await this.client.charges.retrieve(chargeId);
    if (
      !charge.paid ||
      objectId(charge.payment_intent) !== intentId ||
      charge.currency !== refund.currency ||
      !Number.isSafeInteger(refund.amount) ||
      refund.amount <= 0 ||
      !Number.isSafeInteger(charge.amount_refunded) ||
      charge.amount_refunded < refund.amount ||
      charge.amount_refunded > charge.amount
    )
      throw new Error('Stripe refund payment mismatch');
    // Older Lite orders used invoice IDs as transaction IDs. Preserve that
    // linkage so refunds still revoke their credits after this upgrade.
    const allocations = await this.client.invoicePayments.list({
      payment: { type: 'payment_intent', payment_intent: intentId },
      limit: 2,
    });
    if (allocations.has_more || allocations.data.length > 1)
      throw new Error('Stripe refund allocation is unsupported');
    const invoiceId = objectId(allocations.data[0]?.invoice);
    return {
      provider: this.name,
      paymentResult: refund,
      refundInfo: {
        refundId: refund.id,
        transactionId: intentId,
        providerOrderId: invoiceId,
        amount: refund.amount,
        currency: refund.currency,
        totalRefundedAmount: charge.amount_refunded,
        status: 'succeeded',
      },
    };
  }
}

/**
 * Create Stripe provider with configs
 */
export function createStripeProvider(configs: StripeConfigs): StripeProvider {
  return new StripeProvider(configs);
}
