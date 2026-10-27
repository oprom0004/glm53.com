import {
  stripeCheckoutMode,
  type StripeMode,
} from '@/extensions/payment/stripe-mode';
import {
  PaymentStatus,
  PaymentType,
  type PaymentOrder,
  type PaymentProvider,
} from '@/extensions/payment/types';
import {
  creditPackRecoveryOrderNo,
  findOrderByOrderNo,
  OrderStatus,
  updateOrderByOrderNo,
  type Order,
} from '@/shared/models/order';

import { handleCheckoutSuccess } from './payment';

export type CreditPackCheckoutResult =
  | { kind: 'checkout'; sessionId: string; checkoutUrl: string }
  | { kind: 'paid'; callbackUrl: string }
  | {
      kind: 'error';
      checkoutUrl?: string;
      code:
        | 'checkout_in_progress'
        | 'checkout_expired_retry'
        | 'checkout_needs_review'
        | 'checkout_retry';
    };

export async function continueCreditPackCheckout({
  reserved,
  requestedProductId,
  provider,
  now,
  stripeMode,
}: {
  reserved: Order;
  requestedProductId: string;
  provider: PaymentProvider;
  now: Date;
  stripeMode?: StripeMode;
}): Promise<CreditPackCheckoutResult> {
  const error = (
    code: Extract<CreditPackCheckoutResult, { kind: 'error' }>['code']
  ): CreditPackCheckoutResult => ({ kind: 'error', code });
  // Webhook may have settled since the reservation was obtained.
  let row = await findOrderByOrderNo(reserved.orderNo);
  if (
    !row ||
    row.userId !== reserved.userId ||
    row.productId !== requestedProductId ||
    row.paymentProvider !== provider.name
  )
    return error('checkout_in_progress');
  try {
    const recoveryOrderNo = creditPackRecoveryOrderNo(row);
    if (recoveryOrderNo) {
      const original = await findOrderByOrderNo(recoveryOrderNo);
      if (
        !original ||
        original.userId !== row.userId ||
        original.paymentProvider !== provider.name ||
        original.paymentType !== PaymentType.ONE_TIME ||
        creditPackRecoveryOrderNo(original)
      )
        return error('checkout_needs_review');
      row = original;
    }
  } catch {
    return error('checkout_needs_review');
  }
  if (
    [
      OrderStatus.PAID,
      OrderStatus.REFUNDED,
      OrderStatus.PARTIALLY_REFUNDED,
    ].includes(row.status as OrderStatus)
  )
    return {
      kind: 'paid',
      callbackUrl: row.callbackUrl || '/settings/payments',
    };
  if (row.status === OrderStatus.COMPLETED)
    return error('checkout_expired_retry');
  try {
    if (row.paymentSessionId) {
      const session = await provider.getPaymentSession({
        sessionId: row.paymentSessionId,
      });
      if (session.paymentStatus === PaymentStatus.SUCCESS) {
        await handleCheckoutSuccess({ order: row, session });
        return {
          kind: 'paid',
          callbackUrl: row.callbackUrl || '/settings/payments',
        };
      }
      if (session.paymentResult?.status === 'expired') {
        await updateOrderByOrderNo(
          row.orderNo,
          { status: OrderStatus.COMPLETED },
          { expectedStatus: row.status as OrderStatus }
        );
        return error('checkout_expired_retry');
      }
      if (session.paymentResult?.status === 'open' && row.checkoutUrl)
        return row.productId !== requestedProductId
          ? {
              kind: 'error',
              code: 'checkout_in_progress',
              checkoutUrl: row.checkoutUrl,
            }
          : {
              kind: 'checkout',
              sessionId: row.paymentSessionId,
              checkoutUrl: row.checkoutUrl,
            };
      return error('checkout_in_progress');
    }
    if (
      row.status !== OrderStatus.PENDING ||
      +now - +row.createdAt > 23 * 3600000
    )
      return error('checkout_needs_review');
    if (row.productId !== requestedProductId)
      return error('checkout_in_progress');
    const original: PaymentOrder = JSON.parse(row.checkoutInfo || '{}');
    if (
      original.orderNo !== row.orderNo ||
      original.metadata?.order_no !== row.orderNo ||
      original.metadata?.user_id !== row.userId ||
      original.price?.amount !== row.amount ||
      original.price?.currency.toLowerCase() !== row.currency.toLowerCase() ||
      original.type !== 'one-time'
    )
      return error('checkout_needs_review');
    const result = await provider.createPayment({ order: original });
    if (
      result.provider !== provider.name ||
      (stripeMode &&
        stripeCheckoutMode(result.checkoutInfo.sessionId) !== stripeMode)
    )
      return error('checkout_needs_review');
    await updateOrderByOrderNo(
      row.orderNo,
      {
        status: OrderStatus.CREATED,
        checkoutResult: JSON.stringify(result.checkoutResult),
        checkoutUrl: result.checkoutInfo.checkoutUrl,
        paymentSessionId: result.checkoutInfo.sessionId,
      },
      { expectedStatus: OrderStatus.PENDING }
    );
    return { kind: 'checkout', ...result.checkoutInfo };
  } catch (e) {
    return error(
      e instanceof Error && e.message === 'checkout_needs_review'
        ? 'checkout_needs_review'
        : 'checkout_retry'
    );
  }
}
