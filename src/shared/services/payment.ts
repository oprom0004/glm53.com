import { and, eq } from 'drizzle-orm';

import { subscription as subscriptionTable } from '@/config/db/schema';
import {
  CreemProvider,
  PaymentManager,
  PayPalProvider,
  StripeProvider,
} from '@/extensions/payment';
import {
  PaymentSession,
  PaymentStatus,
  PaymentType,
} from '@/extensions/payment/types';
import { getSnowId, getUuid } from '@/shared/lib/hash';
import { getSubscriptionEventTime } from '@/shared/lib/payment-event-time';
import { isAnnualMonthlyProduct } from '@/shared/lib/wan-product-catalog';
import { Configs, getAllConfigs } from '@/shared/models/config';

import {
  calculateCreditExpirationTime,
  CreditStatus,
  CreditTransactionScene,
  CreditTransactionType,
  NewCredit,
} from '../models/credit';
import {
  findOrderByOrderNo,
  NewOrder,
  Order,
  OrderStatus,
  UpdateOrder,
  updateOrderInTransaction,
  updateSubscriptionInTransaction,
} from '../models/order';
import { paymentTransaction } from '../models/payment-transaction';
import {
  findSubscriptionBySubscriptionNo,
  getBillingSubscription,
  NewSubscription,
  Subscription,
  SubscriptionStatus,
  UpdateSubscription,
} from '../models/subscription';
import { validatePayment } from './payment-validation';
import { isWanaiStripePayment } from './stripe-payment-scope';

export { handlePaymentRefunded } from '../models/payment-refund';

export async function assertCanStartSubscription(userId: string) {
  if (await getBillingSubscription(userId)) {
    throw new Error('subscription_already_exists');
  }
}

export async function cancelSubscriptionForUser({
  subscriptionNo,
  userId,
  paymentManager,
}: {
  subscriptionNo: string;
  userId: string;
  paymentManager: PaymentManager;
}) {
  const subscription = await findSubscriptionBySubscriptionNo(subscriptionNo);
  if (!subscription || subscription.userId !== userId)
    throw new Error('no permission');
  if (
    [SubscriptionStatus.PENDING_CANCEL, SubscriptionStatus.CANCELED].includes(
      subscription.status as SubscriptionStatus
    )
  )
    return subscription;
  if (
    ![
      SubscriptionStatus.ACTIVE,
      SubscriptionStatus.TRIALING,
      ...(subscription.paymentProvider === 'stripe'
        ? [SubscriptionStatus.EXPIRED, SubscriptionStatus.PAUSED]
        : []),
    ].includes(subscription.status as SubscriptionStatus)
  )
    throw new Error('subscription is not active or trialing');
  const provider = paymentManager.getProvider(subscription.paymentProvider);
  if (
    !provider?.cancelSubscription ||
    provider.name !== subscription.paymentProvider
  )
    throw new Error('subscription cancellation is unavailable');
  const session = await provider.cancelSubscription({
    subscriptionId: subscription.subscriptionId,
  });
  await handleSubscriptionCanceled({ subscription, session });
  return findSubscriptionBySubscriptionNo(subscriptionNo);
}

/**
 * get payment service with configs
 */
export function getPaymentServiceWithConfigs(configs: Configs) {
  const paymentManager = new PaymentManager();

  const defaultProvider = configs.default_payment_provider;

  // add stripe provider
  if (configs.stripe_enabled === 'true') {
    if (
      !configs.stripe_secret_key?.trim() ||
      !configs.stripe_signing_secret?.trim()
    ) {
      throw new Error('Stripe secret key and signing secret are required');
    }
    let allowedPaymentMethods = configs.stripe_payment_methods || [];
    if (typeof allowedPaymentMethods === 'string') {
      try {
        allowedPaymentMethods = JSON.parse(allowedPaymentMethods);
      } catch (e) {
        console.error('parse stripe payment methods error', e);
        allowedPaymentMethods = [];
      }
    }
    paymentManager.addProvider(
      new StripeProvider({
        secretKey: configs.stripe_secret_key,
        publishableKey: configs.stripe_publishable_key,
        signingSecret: configs.stripe_signing_secret,
        allowedPaymentMethods: allowedPaymentMethods as string[],
        allowPromotionCodes: configs.stripe_allow_promotion_codes === 'true',
        accountId: configs.stripe_account_id,
        isPaymentRelated: isWanaiStripePayment,
      }),
      defaultProvider === 'stripe'
    );
  }

  // add creem provider
  if (configs.creem_enabled === 'true') {
    if (
      !configs.creem_api_key?.trim() ||
      !configs.creem_signing_secret?.trim()
    ) {
      throw new Error('Creem API key and signing secret are required');
    }
    paymentManager.addProvider(
      new CreemProvider({
        apiKey: configs.creem_api_key,
        environment:
          configs.creem_environment === 'production' ? 'production' : 'sandbox',
        signingSecret: configs.creem_signing_secret,
      }),
      defaultProvider === 'creem'
    );
  }

  // add paypal provider
  if (configs.paypal_enabled === 'true') {
    paymentManager.addProvider(
      new PayPalProvider({
        clientId: configs.paypal_client_id,
        clientSecret: configs.paypal_client_secret,
        webhookId: configs.paypal_webhook_id,
        environment:
          configs.paypal_environment === 'production'
            ? 'production'
            : 'sandbox',
      }),
      defaultProvider === 'paypal'
    );
  }

  return paymentManager;
}

/**
 * global payment service
 */
let paymentService: PaymentManager | null = null;

/**
 * get payment service instance
 */
export async function getPaymentService(
  configs?: Configs
): Promise<PaymentManager> {
  if (!configs) {
    configs = await getAllConfigs();
  }
  paymentService = getPaymentServiceWithConfigs(configs);

  return paymentService;
}

/**
 * handle checkout success
 */
export async function handleCheckoutSuccess({
  order,
  session,
}: {
  order: Order; // checkout order
  session: PaymentSession; // payment session
}) {
  const orderNo = order.orderNo;
  if (!orderNo) {
    throw new Error('invalid order');
  }
  if (session.provider !== order.paymentProvider) {
    throw new Error('Payment provider mismatch');
  }

  // Idempotency check: if order is already paid, skip processing
  if (order.status === OrderStatus.PAID) {
    console.log(`Order ${orderNo} is already paid, skipping`);
    return;
  }

  // Only process orders in CREATED or PENDING status
  if (
    order.status !== OrderStatus.CREATED &&
    order.status !== OrderStatus.PENDING &&
    order.status !== OrderStatus.FAILED
  ) {
    console.log(`Order ${orderNo} status is ${order.status}, not processing`);
    return;
  }

  if (
    session.paymentStatus === PaymentStatus.SUCCESS &&
    order.paymentType === PaymentType.SUBSCRIPTION
  ) {
    if (!session.subscriptionId || !session.subscriptionInfo) {
      throw new Error('subscription id or subscription info not found');
    }
  }

  // payment success
  if (session.paymentStatus === PaymentStatus.SUCCESS) {
    validatePayment(session, order);
    // update order status to be paid
    const updateOrder: UpdateOrder = {
      status: OrderStatus.PAID,
      paymentResult: JSON.stringify(session.paymentResult),
      paymentAmount: session.paymentInfo?.paymentAmount,
      paymentCurrency: session.paymentInfo?.paymentCurrency,
      discountAmount: session.paymentInfo?.discountAmount,
      discountCurrency: session.paymentInfo?.discountCurrency,
      discountCode: session.paymentInfo?.discountCode,
      paymentEmail: session.paymentInfo?.paymentEmail,
      paidAt: session.paymentInfo?.paidAt,
      invoiceId: session.paymentInfo?.invoiceId,
      invoiceUrl: session.paymentInfo?.invoiceUrl,
      subscriptionNo: '',
      transactionId: session.paymentInfo?.transactionId,
      paymentUserName: session.paymentInfo?.paymentUserName,
      paymentUserId: session.paymentInfo?.paymentUserId,
    };

    // new subscription
    let newSubscription: NewSubscription | undefined = undefined;
    const subscriptionInfo = session.subscriptionInfo;

    // subscription first payment
    if (subscriptionInfo) {
      // new subscription
      newSubscription = {
        id: getUuid(),
        subscriptionNo:
          session.provider === 'creem'
            ? `creem_${subscriptionInfo.subscriptionId}`
            : getSnowId(),
        userId: order.userId,
        userEmail: order.paymentEmail || order.userEmail,
        status: subscriptionInfo.status || SubscriptionStatus.ACTIVE,
        paymentProvider: order.paymentProvider,
        subscriptionId: subscriptionInfo.subscriptionId,
        subscriptionResult: JSON.stringify(session.subscriptionResult),
        productId: order.productId,
        description: subscriptionInfo.description || 'Subscription Created',
        amount: order.amount,
        currency: order.currency,
        interval: subscriptionInfo.interval,
        intervalCount: subscriptionInfo.intervalCount,
        trialPeriodDays: subscriptionInfo.trialPeriodDays,
        currentPeriodStart: subscriptionInfo.currentPeriodStart,
        currentPeriodEnd: subscriptionInfo.currentPeriodEnd,
        billingUrl: subscriptionInfo.billingUrl,
        planName: order.planName || order.productName,
        productName: order.productName,
        creditsAmount: order.creditsAmount,
        creditsValidDays: order.creditsValidDays,
        paymentProductId: order.paymentProductId,
        paymentUserId: session.paymentInfo?.paymentUserId,
        canceledAt: subscriptionInfo.canceledAt,
        canceledEndAt: subscriptionInfo.canceledEndAt,
      };

      updateOrder.subscriptionNo = newSubscription.subscriptionNo;
      updateOrder.subscriptionId = session.subscriptionId;
      updateOrder.subscriptionResult = JSON.stringify(
        session.subscriptionResult
      );
    }

    // grant credit for order
    let newCredit: NewCredit | undefined = undefined;
    const annualPeriod =
      isAnnualMonthlyProduct(order.productId) &&
      order.paymentInterval === 'year'
        ? {
            start: subscriptionInfo!.currentPeriodStart!,
            end: subscriptionInfo!.currentPeriodEnd!,
          }
        : undefined;
    if (!annualPeriod && order.creditsAmount && order.creditsAmount > 0) {
      const credits = order.creditsAmount;
      const expiresAt =
        credits > 0
          ? calculateCreditExpirationTime({
              creditsValidDays: order.creditsValidDays || 0,
              currentPeriodEnd: subscriptionInfo?.currentPeriodEnd,
            })
          : null;

      newCredit = {
        id: getUuid(),
        userId: order.userId,
        userEmail: order.userEmail,
        orderNo: order.orderNo,
        subscriptionNo: newSubscription?.subscriptionNo,
        transactionNo: getSnowId(),
        transactionType: CreditTransactionType.GRANT,
        transactionScene:
          order.paymentType === PaymentType.SUBSCRIPTION
            ? CreditTransactionScene.SUBSCRIPTION
            : CreditTransactionScene.PAYMENT,
        credits: credits,
        remainingCredits: credits,
        description: `Grant credit`,
        expiresAt: expiresAt,
        status: CreditStatus.ACTIVE,
      };
    }

    await updateOrderInTransaction({
      orderNo,
      updateOrder,
      newSubscription,
      newCredit,
      annualPeriod,
    });
  } else if (
    session.paymentStatus === PaymentStatus.FAILED ||
    session.paymentStatus === PaymentStatus.CANCELED
  ) {
    // update order status to be failed
    await updateOrderInTransaction({
      orderNo,
      updateOrder: {
        status: OrderStatus.FAILED,
        paymentResult: JSON.stringify(session.paymentResult),
      },
    });
  } else if (session.paymentStatus === PaymentStatus.PROCESSING) {
    // update order payment result
    await updateOrderInTransaction({
      orderNo,
      updateOrder: { paymentResult: JSON.stringify(session.paymentResult) },
    });
  } else {
    throw new Error('unknown payment status');
  }
}

/**
 * handle payment success
 */
export async function handlePaymentSuccess({
  order,
  session,
}: {
  order: Order; // checkout order
  session: PaymentSession; // payment session
}) {
  const orderNo = order.orderNo;
  if (!orderNo) {
    throw new Error('invalid order');
  }

  if (order.paymentType === PaymentType.SUBSCRIPTION) {
    if (!session.subscriptionId || !session.subscriptionInfo) {
      throw new Error('subscription id or subscription info not found');
    }
  }

  // payment success
  if (session.paymentStatus === PaymentStatus.SUCCESS) {
    validatePayment(session, order);
    // update order status to be paid
    const updateOrder: UpdateOrder = {
      status: OrderStatus.PAID,
      paymentResult: JSON.stringify(session.paymentResult),
      paymentAmount: session.paymentInfo?.paymentAmount,
      paymentCurrency: session.paymentInfo?.paymentCurrency,
      discountAmount: session.paymentInfo?.discountAmount,
      discountCurrency: session.paymentInfo?.discountCurrency,
      discountCode: session.paymentInfo?.discountCode,
      paymentEmail: session.paymentInfo?.paymentEmail,
      paymentUserName: session.paymentInfo?.paymentUserName,
      paymentUserId: session.paymentInfo?.paymentUserId,
      paidAt: session.paymentInfo?.paidAt,
      invoiceId: session.paymentInfo?.invoiceId,
      invoiceUrl: session.paymentInfo?.invoiceUrl,
    };

    // new subscription
    let newSubscription: NewSubscription | undefined = undefined;
    const subscriptionInfo = session.subscriptionInfo;

    // subscription first payment
    if (subscriptionInfo) {
      // new subscription
      newSubscription = {
        id: getUuid(),
        subscriptionNo: getSnowId(),
        userId: order.userId,
        userEmail: order.paymentEmail || order.userEmail,
        status: SubscriptionStatus.ACTIVE,
        paymentProvider: order.paymentProvider,
        subscriptionId: subscriptionInfo.subscriptionId,
        subscriptionResult: JSON.stringify(session.subscriptionResult),
        productId: order.productId,
        description: subscriptionInfo.description,
        amount: subscriptionInfo.amount,
        currency: subscriptionInfo.currency,
        interval: subscriptionInfo.interval,
        intervalCount: subscriptionInfo.intervalCount,
        trialPeriodDays: subscriptionInfo.trialPeriodDays,
        currentPeriodStart: subscriptionInfo.currentPeriodStart,
        currentPeriodEnd: subscriptionInfo.currentPeriodEnd,
        planName: order.planName || order.productName,
        billingUrl: subscriptionInfo.billingUrl,
        productName: order.productName,
        creditsAmount: order.creditsAmount,
        creditsValidDays: order.creditsValidDays,
        paymentProductId: order.paymentProductId,
        paymentUserId: session.paymentInfo?.paymentUserId,
      };

      updateOrder.subscriptionId = session.subscriptionId;
      updateOrder.subscriptionResult = JSON.stringify(
        session.subscriptionResult
      );
    }

    // grant credit for order
    let newCredit: NewCredit | undefined = undefined;
    const annualPeriod =
      isAnnualMonthlyProduct(order.productId) &&
      order.paymentInterval === 'year'
        ? {
            start: subscriptionInfo!.currentPeriodStart!,
            end: subscriptionInfo!.currentPeriodEnd!,
          }
        : undefined;
    if (!annualPeriod && order.creditsAmount && order.creditsAmount > 0) {
      const credits = order.creditsAmount;
      const expiresAt =
        credits > 0
          ? calculateCreditExpirationTime({
              creditsValidDays: order.creditsValidDays || 0,
              currentPeriodEnd: subscriptionInfo?.currentPeriodEnd,
            })
          : null;

      newCredit = {
        id: getUuid(),
        userId: order.userId,
        userEmail: order.userEmail,
        orderNo: order.orderNo,
        subscriptionNo: newSubscription?.subscriptionNo,
        transactionNo: getSnowId(),
        transactionType: CreditTransactionType.GRANT,
        transactionScene:
          order.paymentType === PaymentType.SUBSCRIPTION
            ? CreditTransactionScene.SUBSCRIPTION
            : CreditTransactionScene.PAYMENT,
        credits: credits,
        remainingCredits: credits,
        description: `Grant credit`,
        expiresAt: expiresAt,
        status: CreditStatus.ACTIVE,
      };
    }

    await updateOrderInTransaction({
      orderNo,
      updateOrder,
      newSubscription,
      newCredit,
      annualPeriod,
    });
  } else {
    throw new Error('unknown payment status');
  }
}

export async function handleSubscriptionRenewal({
  subscription,
  session,
}: {
  subscription: Subscription; // subscription
  session: PaymentSession; // payment session
}) {
  const subscriptionNo = subscription.subscriptionNo;
  if (!subscriptionNo || !subscription.amount || !subscription.currency) {
    throw new Error('invalid subscription');
  }

  if (!session.subscriptionId || !session.subscriptionInfo) {
    throw new Error('invalid payment session');
  }
  if (session.subscriptionId !== subscription.subscriptionId) {
    throw new Error('subscription id mismatch');
  }

  const subscriptionInfo = session.subscriptionInfo;
  if (
    !subscriptionInfo ||
    !subscriptionInfo.currentPeriodStart ||
    !subscriptionInfo.currentPeriodEnd
  ) {
    throw new Error('invalid subscription info');
  }

  // payment success
  if (session.paymentStatus === PaymentStatus.SUCCESS) {
    validatePayment(session, {
      ...subscription,
      amount: subscription.amount,
      currency: subscription.currency,
    });
    // update subscription period
    const updateSubscription: UpdateSubscription = {
      currentPeriodStart: subscriptionInfo.currentPeriodStart,
      currentPeriodEnd: subscriptionInfo.currentPeriodEnd,
      status: SubscriptionStatus.ACTIVE,
      subscriptionResult: JSON.stringify(session.subscriptionResult),
    };

    const orderNo =
      session.provider === 'creem'
        ? `creem_renew_${session.paymentInfo!.transactionId}`
        : getSnowId();
    const currentTime = new Date();

    // renewal order
    const order: NewOrder = {
      id: getUuid(),
      orderNo: orderNo,
      userId: subscription.userId,
      userEmail: subscription.userEmail,
      status: OrderStatus.PAID,
      amount: subscription.amount,
      currency: subscription.currency,
      productId: subscription.productId,
      paymentType: PaymentType.RENEW,
      paymentInterval: subscription.interval,
      paymentProvider: session.provider || subscription.paymentProvider,
      checkoutInfo: '',
      createdAt: currentTime,
      productName: subscription.productName,
      description: 'Subscription Renewal',
      callbackUrl: '',
      creditsAmount: subscription.creditsAmount,
      creditsValidDays: subscription.creditsValidDays,
      planName: subscription.planName || '',
      paymentProductId: subscription.paymentProductId,
      paymentResult: JSON.stringify(session.paymentResult),
      paymentAmount: session.paymentInfo?.paymentAmount,
      paymentCurrency: session.paymentInfo?.paymentCurrency,
      discountAmount: session.paymentInfo?.discountAmount,
      discountCurrency: session.paymentInfo?.discountCurrency,
      discountCode: session.paymentInfo?.discountCode,
      paymentEmail: session.paymentInfo?.paymentEmail,
      paymentUserId: session.paymentInfo?.paymentUserId,
      paidAt: session.paymentInfo?.paidAt,
      invoiceId: session.paymentInfo?.invoiceId,
      invoiceUrl: session.paymentInfo?.invoiceUrl,
      subscriptionNo: subscription.subscriptionNo,
      transactionId: session.paymentInfo?.transactionId,
      paymentUserName: session.paymentInfo?.paymentUserName,
      subscriptionId: session.subscriptionId,
      subscriptionResult: JSON.stringify(session.subscriptionResult),
    };

    // grant credit for renewal order
    let newCredit: NewCredit | undefined = undefined;
    const annualPeriod =
      isAnnualMonthlyProduct(order.productId) &&
      order.paymentInterval === 'year'
        ? {
            start: subscriptionInfo!.currentPeriodStart!,
            end: subscriptionInfo!.currentPeriodEnd!,
          }
        : undefined;
    if (!annualPeriod && order.creditsAmount && order.creditsAmount > 0) {
      const credits = order.creditsAmount;
      const expiresAt =
        credits > 0
          ? calculateCreditExpirationTime({
              creditsValidDays: order.creditsValidDays || 0,
              currentPeriodEnd: subscriptionInfo?.currentPeriodEnd,
            })
          : null;

      newCredit = {
        id: getUuid(),
        userId: order.userId,
        userEmail: order.userEmail,
        orderNo: order.orderNo,
        subscriptionNo: subscription.subscriptionNo,
        transactionNo: getSnowId(),
        transactionType: CreditTransactionType.GRANT,
        transactionScene: CreditTransactionScene.RENEWAL,
        credits: credits,
        remainingCredits: credits,
        description: `Grant credit`,
        expiresAt: expiresAt,
        status: CreditStatus.ACTIVE,
      };
    }

    await updateSubscriptionInTransaction({
      subscriptionNo,
      updateSubscription,
      newOrder: order,
      newCredit,
      annualPeriod,
    });
  } else {
    throw new Error('unknown payment status');
  }
}

export async function handleSubscriptionUpdated({
  subscription,
  session,
}: {
  subscription: Subscription; // subscription
  session: PaymentSession; // payment session
}) {
  const subscriptionNo = subscription.subscriptionNo;
  if (!subscriptionNo || !subscription.amount || !subscription.currency) {
    throw new Error('invalid subscription');
  }

  const subscriptionInfo = session.subscriptionInfo;
  if (!subscriptionInfo || !subscriptionInfo.status) {
    throw new Error('invalid subscription info');
  }

  await syncSubscriptionState(subscription, session, {
    status: subscriptionInfo.status,
    currentPeriodStart: subscriptionInfo.currentPeriodStart,
    currentPeriodEnd: subscriptionInfo.currentPeriodEnd,
    canceledAt: subscriptionInfo.canceledAt || null,
    canceledEndAt: subscriptionInfo.canceledEndAt || null,
    canceledReason: subscriptionInfo.canceledReason || '',
    canceledReasonType: subscriptionInfo.canceledReasonType || '',
  });

  // console.log('handle subscription updated', subscriptionInfo);
}

export async function handleSubscriptionCanceled({
  subscription,
  session,
}: {
  subscription: Subscription; // subscription
  session: PaymentSession; // payment session
}) {
  const subscriptionNo = subscription.subscriptionNo;
  if (!subscriptionNo || !subscription.amount || !subscription.currency) {
    throw new Error('invalid subscription');
  }

  const subscriptionInfo = session.subscriptionInfo;
  if (
    !subscriptionInfo ||
    !subscriptionInfo.status ||
    ![SubscriptionStatus.CANCELED, SubscriptionStatus.PENDING_CANCEL].includes(
      subscriptionInfo.status as SubscriptionStatus
    )
  ) {
    throw new Error('invalid subscription info');
  }

  await syncSubscriptionState(subscription, session, {
    status: subscriptionInfo.status,
    canceledAt: subscriptionInfo.canceledAt,
    canceledEndAt: subscriptionInfo.canceledEndAt,
    canceledReason: subscriptionInfo.canceledReason,
    canceledReasonType: subscriptionInfo.canceledReasonType,
  });

  // console.log('handle subscription canceled', subscriptionInfo);
}

async function syncSubscriptionState(
  subscription: Subscription,
  session: PaymentSession,
  update: UpdateSubscription
) {
  if (
    session.provider !== subscription.paymentProvider ||
    session.subscriptionId !== subscription.subscriptionId
  ) {
    throw new Error('Payment subscription mismatch');
  }
  await paymentTransaction(async (tx: any) => {
    const [current] = await tx
      .select()
      .from(subscriptionTable)
      .where(eq(subscriptionTable.subscriptionNo, subscription.subscriptionNo))
      .for('update');
    if (!current) throw new Error('subscription not found');
    const incoming = getSubscriptionEventTime(session.subscriptionResult);
    const previous = getSubscriptionEventTime(current.subscriptionResult);
    if (
      Number.isFinite(previous) &&
      (!Number.isFinite(incoming) || incoming <= previous)
    ) {
      return;
    }
    const {
      currentPeriodStart: _start,
      currentPeriodEnd: _end,
      ...state
    } = update;
    if (state.status === SubscriptionStatus.PENDING_CANCEL) {
      state.canceledEndAt = current.currentPeriodEnd;
      state.canceledAt ||= new Date();
    }
    await tx
      .update(subscriptionTable)
      .set({
        ...state,
        subscriptionResult: JSON.stringify(session.subscriptionResult),
      })
      .where(
        and(
          eq(subscriptionTable.subscriptionNo, subscription.subscriptionNo),
          eq(subscriptionTable.status, current.status)
        )
      );
  });
}
