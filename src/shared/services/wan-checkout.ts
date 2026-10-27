import {
  stripeCheckoutMode,
  stripeKeyMode,
} from '@/extensions/payment/stripe-mode';
import { WANAI_PAYMENT_APP } from '@/extensions/payment/stripe-scope';
import {
  PaymentInterval,
  PaymentStatus,
  PaymentType,
  type PaymentOrder,
  type PaymentProvider,
} from '@/extensions/payment/types';
import { getSnowId, getUuid } from '@/shared/lib/hash';
import {
  findWanProduct,
  WAN_PRODUCTS,
  type WanProduct,
} from '@/shared/lib/wan-product-catalog';
import { getAllConfigs, type Configs } from '@/shared/models/config';
import {
  OrderStatus,
  reserveCreditPackOrder,
  reserveSubscriptionOrder,
  updateOrderByOrderNo,
  type NewOrder,
} from '@/shared/models/order';
import { getUserInfo } from '@/shared/models/user';

import { continueCreditPackCheckout } from './credit-pack-checkout';
import {
  assertCanStartSubscription,
  getPaymentService,
  handleCheckoutSuccess,
} from './payment';
import { buildCheckoutMetadata } from './payment-validation';
import { safeLocalReturnPath } from './subscription-plans';
import { getWanCatalog } from './wan-catalog';

type CheckoutDependencies = {
  getUser(): Promise<
    { id: string; email: string; name?: string } | null | undefined
  >;
  getConfigs(): Promise<Configs>;
  getProvider(configs: Configs): Promise<PaymentProvider | undefined>;
};
const defaults: CheckoutDependencies = {
  getUser: getUserInfo,
  getConfigs: getAllConfigs,
  getProvider: async (configs) =>
    (await getPaymentService(configs)).getProvider('stripe'),
};
function error(message: string, status = 409, checkoutUrl?: string) {
  return Response.json(
    { code: -1, message, ...(checkoutUrl ? { data: { checkoutUrl } } : {}) },
    {
      status,
      headers: { 'Cache-Control': 'private, no-store' },
    }
  );
}
function success(data: unknown) {
  return Response.json(
    { code: 0, message: 'ok', data },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
function sameProduct(stored: string | null, requested: WanProduct) {
  // Historical Lite monthly orders used the tier as their product identifier.
  return (
    stored === requested.id ||
    (requested.mode === 'monthly' && stored === requested.tier)
  );
}

// Dependency boundary keeps authentication/network configurable in local tests;
// the real reservations, transactions and catalog are always used.
export function createCheckoutHandler(deps: CheckoutDependencies = defaults) {
  return async function checkout(req: Request) {
    try {
      const body = await req.json().catch(() => null);
      if (!body || typeof body !== 'object' || Array.isArray(body))
        return error('invalid_request', 400);
      if (
        [
          'payment_provider',
          'provider',
          'amount',
          'currency',
          'priceId',
          'product_id',
          'metadata',
          'credits',
          'discount',
        ].some((key) => key in body)
      )
        return error('checkout_parameters_are_server_owned', 400);
      if (body.productId !== undefined && body.planId !== undefined)
        return error('invalid_request', 400);
      const canonicalProduct =
        body.productId !== undefined
          ? findWanProduct(body.productId)
          : WAN_PRODUCTS.find(
              (item) => item.mode === 'monthly' && item.tier === body.planId
            );
      if (!canonicalProduct) return error('invalid_plan', 400);
      const user = await deps.getUser().catch(() => null);
      if (!user?.id || !user.email) return error('unauthenticated', 401);
      const catalog = await getWanCatalog().catch(() => null);
      // Canonical identity is enough to locate an existing order. A null quote
      // below forbids new reservations; recovery always uses the stored price,
      // credits and payment payload, never these provisional default values.
      const product =
        catalog?.products.find((p) => p.id === canonicalProduct.id) ??
        canonicalProduct;
      const catalogQuote = {
        revision: catalog?.revision ?? null,
        expectedRevision: body.catalogRevision,
      };
      const configs = await deps.getConfigs();
      const stripeMode = stripeKeyMode(configs.stripe_secret_key);
      if (configs.stripe_enabled !== 'true' || !stripeMode)
        return error('stripe_not_configured', 503);
      const provider = await deps.getProvider(configs);
      if (!provider || provider.name !== 'stripe')
        return error('stripe_not_configured', 503);
      const recurring = product.mode !== 'credits';
      if (recurring) await assertCanStartSubscription(user.id);
      const configuredPrice =
        catalog &&
        product.mode === 'monthly' &&
        product.amount === canonicalProduct.amount
          ? String(configs[`stripe_price_${product.tier}`] || '').trim()
          : '';
      if (configuredPrice && !/^price_[A-Za-z0-9_]+$/.test(configuredPrice))
        return error('plan_not_configured', 503);
      const localePrefix = body.locale === 'zh' ? '/zh' : '';
      const appUrl = String(configs.app_url || 'https://wanai30.com').replace(
        /\/$/,
        ''
      );
      const callbackUrl =
        appUrl +
        safeLocalReturnPath(
          body.returnPath,
          `${localePrefix}/settings/${recurring ? 'billing' : 'payments'}`
        );
      const productName = `${product.tier[0].toUpperCase()}${product.tier.slice(1)} ${product.mode === 'credits' ? 'Credits' : product.mode === 'annual' ? 'Annual' : 'Monthly'}`;
      let orderNo = getSnowId();
      let checkoutOrder: PaymentOrder = {
        orderNo,
        type: recurring ? PaymentType.SUBSCRIPTION : PaymentType.ONE_TIME,
        expiresAt: Math.floor(Date.now() / 1000) + 86400,
        ...(configuredPrice ? { productId: configuredPrice } : {}),
        price: { amount: product.amount, currency: 'usd' },
        description: productName,
        customer: { name: user.name, email: user.email },
        metadata: buildCheckoutMetadata(undefined, {
          app_name: WANAI_PAYMENT_APP,
          order_no: orderNo,
          user_id: user.id,
        }),
        successUrl: `${appUrl}/api/payment/callback?order_no=${encodeURIComponent(orderNo)}`,
        cancelUrl: `${appUrl}${localePrefix}/pricing?purchase=${product.mode}#pricing`,
        ...(recurring
          ? {
              plan: {
                name: productName,
                interval: product.interval as PaymentInterval,
                intervalCount: 1,
              },
            }
          : {}),
      };
      const order: NewOrder = {
        id: getUuid(),
        orderNo,
        userId: user.id,
        userEmail: user.email,
        status: OrderStatus.PENDING,
        amount: product.amount,
        currency: 'usd',
        productId: product.id,
        paymentType: checkoutOrder.type,
        paymentInterval: product.interval,
        paymentProvider: 'stripe',
        checkoutInfo: JSON.stringify(checkoutOrder),
        createdAt: new Date(),
        productName,
        description: productName,
        callbackUrl,
        creditsAmount: product.credits,
        creditsValidDays: product.validDays,
        planName: productName,
        ...(configuredPrice ? { paymentProductId: configuredPrice } : {}),
      };
      if (!recurring) {
        const reserved = await reserveCreditPackOrder(order, body.requestId, {
          stripeMode,
          catalogQuote,
        });
        const result = await continueCreditPackCheckout({
          reserved,
          requestedProductId: product.id,
          provider,
          now: new Date(),
          stripeMode,
        });
        return result.kind === 'error'
          ? error(
              result.code,
              result.code === 'checkout_retry' ? 503 : 409,
              result.checkoutUrl
            )
          : success(result);
      }
      const reserved = await reserveSubscriptionOrder(order, {
        stripeMode,
        catalogQuote,
      });
      if (reserved.orderNo !== orderNo) {
        if (reserved.paymentProvider !== provider.name)
          return error('checkout_in_progress');
        if (reserved.paymentSessionId) {
          const session = await provider.getPaymentSession({
            sessionId: reserved.paymentSessionId,
          });
          if (session.paymentStatus === PaymentStatus.SUCCESS) {
            await handleCheckoutSuccess({ order: reserved, session });
            return error('subscription_already_exists');
          }
          if (session.paymentResult?.status === 'expired') {
            await updateOrderByOrderNo(
              reserved.orderNo,
              { status: OrderStatus.COMPLETED },
              { expectedStatus: reserved.status as OrderStatus }
            );
            return error('checkout_expired_retry');
          }
          if (
            session.paymentResult?.status === 'open' &&
            reserved.checkoutUrl
          ) {
            return sameProduct(reserved.productId, product)
              ? success({
                  sessionId: reserved.paymentSessionId,
                  checkoutUrl: reserved.checkoutUrl,
                })
              : error('checkout_in_progress', 409, reserved.checkoutUrl);
          }
          return error('checkout_in_progress');
        }
        if (
          !sameProduct(reserved.productId, product) ||
          reserved.status !== OrderStatus.PENDING ||
          Date.now() - +reserved.createdAt > 23 * 3600000
        )
          return error('checkout_needs_review');
        checkoutOrder = JSON.parse(reserved.checkoutInfo || '{}');
        if (
          checkoutOrder.orderNo !== reserved.orderNo ||
          checkoutOrder.metadata?.user_id !== user.id ||
          checkoutOrder.metadata?.order_no !== reserved.orderNo ||
          checkoutOrder.price?.amount !== reserved.amount ||
          checkoutOrder.price?.currency?.toLowerCase() !==
            reserved.currency.toLowerCase() ||
          checkoutOrder.type !== PaymentType.SUBSCRIPTION
        )
          return error('checkout_needs_review');
        orderNo = reserved.orderNo;
      }
      const result = await provider.createPayment({ order: checkoutOrder });
      if (
        result.provider !== 'stripe' ||
        stripeCheckoutMode(result.checkoutInfo.sessionId) !== stripeMode
      )
        return error('checkout_needs_review');
      const updated = await updateOrderByOrderNo(
        orderNo,
        {
          status: OrderStatus.CREATED,
          checkoutResult: JSON.stringify(result.checkoutResult),
          checkoutUrl: result.checkoutInfo.checkoutUrl,
          paymentSessionId: result.checkoutInfo.sessionId,
        },
        { expectedStatus: OrderStatus.PENDING }
      );
      if (!updated) return error('checkout_in_progress');
      return success(result.checkoutInfo);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      if (message === 'Invalid purchase request')
        return error('invalid_request', 400);
      if (
        [
          'subscription_already_exists',
          'checkout_needs_review',
          'checkout_in_progress',
          'pricing_changed',
        ].includes(message)
      )
        return error(message);
      return error('checkout_retry', 503);
    }
  };
}
