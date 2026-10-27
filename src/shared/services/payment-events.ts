import {
  PaymentEvent,
  PaymentEventType,
  SubscriptionCycleType,
} from '@/extensions/payment/types';
import { assertStripeOrderLinkage } from '@/shared/lib/payment-order-linkage';
import {
  findInitialOrderBySubscriptionNo,
  findOrderByInvoiceId,
  findOrderByOrderNo,
  findOrderByTransactionId,
  OrderStatus,
} from '@/shared/models/order';
import { findSubscriptionByProviderSubscriptionId } from '@/shared/models/subscription';

import {
  handleCheckoutSuccess,
  handlePaymentRefunded,
  handleSubscriptionCanceled,
  handleSubscriptionRenewal,
  handleSubscriptionUpdated,
} from './payment';
import { validatePayment } from './payment-validation';

export type PaymentEventResult =
  | { kind: 'applied'; orderNo?: string }
  | { kind: 'duplicate'; orderNo?: string }
  | { kind: 'ignored'; reason: string };

export function shouldApplyPaymentState(
  previous: number | undefined,
  incoming: number
) {
  return (
    Number.isFinite(incoming) &&
    (!Number.isFinite(previous) || incoming > (previous as number))
  );
}

export async function handlePaymentEvent({
  provider,
  event,
}: {
  provider: string;
  event: PaymentEvent;
}): Promise<PaymentEventResult> {
  if (event.eventType === PaymentEventType.IGNORED)
    return { kind: 'ignored', reason: 'provider_ignored' };
  const session = event.paymentSession;
  if (!session || session.provider !== provider)
    throw new Error('Payment provider/session mismatch');
  if (event.eventType === PaymentEventType.PAYMENT_REFUNDED) {
    const result = await handlePaymentRefunded({ session });
    return result
      ? { kind: 'applied', orderNo: result.orderNo || undefined }
      : { kind: 'duplicate' };
  }
  if (event.eventType === PaymentEventType.CHECKOUT_SUCCESS) {
    const order =
      session.metadata?.order_no &&
      (await findOrderByOrderNo(session.metadata.order_no));
    if (!order) throw new Error('Payment order not found');
    if (
      [
        OrderStatus.PAID,
        OrderStatus.REFUNDED,
        OrderStatus.PARTIALLY_REFUNDED,
      ].includes(order.status as OrderStatus)
    )
      return { kind: 'duplicate', orderNo: order.orderNo };
    await handleCheckoutSuccess({ order, session });
    return { kind: 'applied', orderNo: order.orderNo };
  }
  if (event.eventType === PaymentEventType.PAYMENT_SUCCESS) {
    const transactionId = session.paymentInfo?.transactionId;
    if (!transactionId) throw new Error('Payment transaction id not found');
    const intentOrder = await findOrderByTransactionId({
      transactionId,
      paymentProvider: provider,
    });
    const invoiceOrder =
      provider === 'stripe' && session.paymentInfo?.invoiceId
        ? await findOrderByInvoiceId({
            invoiceId: session.paymentInfo.invoiceId,
            paymentProvider: provider,
          })
        : undefined;
    if (
      intentOrder &&
      invoiceOrder &&
      intentOrder.orderNo !== invoiceOrder.orderNo
    )
      throw new Error('Payment order linkage ambiguous');
    const existingOrder = intentOrder || invoiceOrder;
    if (existingOrder) {
      if (provider === 'stripe') {
        assertStripeOrderLinkage(existingOrder, {
          transactionId,
          invoiceId: session.paymentInfo?.invoiceId,
        });
        // A renewal's metadata retains the initial Checkout order number.
        validatePayment(session, { ...existingOrder, orderNo: undefined });
        if (
          existingOrder.subscriptionId &&
          existingOrder.subscriptionId !== session.subscriptionId
        )
          throw new Error('Payment subscription mismatch');
      }
      if (
        [
          OrderStatus.PAID,
          OrderStatus.REFUNDED,
          OrderStatus.PARTIALLY_REFUNDED,
        ].includes(existingOrder.status as OrderStatus)
      )
        return { kind: 'duplicate', orderNo: existingOrder.orderNo };
      await handleCheckoutSuccess({ order: existingOrder, session });
      return { kind: 'applied', orderNo: existingOrder.orderNo };
    }
    if (session.subscriptionId && session.subscriptionInfo) {
      const subscription = await findSubscriptionByProviderSubscriptionId({
        provider,
        subscriptionId: session.subscriptionId,
      });
      if (subscription) {
        if (
          session.paymentInfo?.subscriptionCycleType ===
          SubscriptionCycleType.CREATE
        ) {
          const initialOrder = await findInitialOrderBySubscriptionNo(
            subscription.subscriptionNo
          );
          if (
            initialOrder?.paymentProvider === provider &&
            initialOrder.userId === subscription.userId &&
            [
              OrderStatus.PAID,
              OrderStatus.REFUNDED,
              OrderStatus.PARTIALLY_REFUNDED,
            ].includes(initialOrder.status as OrderStatus)
          )
            return { kind: 'duplicate', orderNo: initialOrder.orderNo };
          throw new Error('First payment order has not settled');
        }
        await handleSubscriptionRenewal({ subscription, session });
        return { kind: 'applied' };
      }
    }
    if (
      provider === 'stripe' &&
      session.paymentInfo?.subscriptionCycleType ===
        SubscriptionCycleType.RENEWAL
    )
      throw new Error('First payment subscription not found; retry event');
    const order =
      session.metadata?.order_no &&
      (await findOrderByOrderNo(session.metadata.order_no));
    if (!order)
      throw new Error(
        'First payment order/subscription not found; retry event'
      );
    await handleCheckoutSuccess({ order, session });
    return { kind: 'applied', orderNo: order.orderNo };
  }
  if (
    event.eventType === PaymentEventType.SUBSCRIBE_UPDATED ||
    event.eventType === PaymentEventType.SUBSCRIBE_CANCELED
  ) {
    if (!session.subscriptionId || !session.subscriptionInfo)
      throw new Error('Payment subscription info not found');
    const subscription = await findSubscriptionByProviderSubscriptionId({
      provider,
      subscriptionId: session.subscriptionId,
    });
    if (!subscription)
      throw new Error('Payment subscription not found; retry event');
    if (event.eventType === PaymentEventType.SUBSCRIBE_CANCELED)
      await handleSubscriptionCanceled({ subscription, session });
    else await handleSubscriptionUpdated({ subscription, session });
    return { kind: 'applied' };
  }
  throw new Error(`Unsupported payment event: ${event.eventType}`);
}

export const applyPaymentEvent = handlePaymentEvent;
