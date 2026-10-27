import type { PaymentSession } from '@/extensions/payment/types';

export function buildCheckoutMetadata(
  custom: unknown,
  reserved: { app_name: string; order_no: string; user_id: string }
) {
  return {
    ...(custom && typeof custom === 'object' && !Array.isArray(custom)
      ? custom
      : {}),
    ...reserved,
  };
}

export function validatePayment(
  session: PaymentSession,
  expected: {
    paymentProvider: string;
    amount: number;
    currency: string;
    paymentProductId?: string | null;
    paymentUserId?: string | null;
    userId: string;
    orderNo?: string;
    paymentInterval?: string | null;
    interval?: string | null;
    intervalCount?: number | null;
    paymentType?: string | null;
  }
) {
  if (session.provider !== expected.paymentProvider)
    throw new Error('Payment provider mismatch');
  if (session.metadata?.user_id && session.metadata.user_id !== expected.userId)
    throw new Error('Payment owner mismatch');
  if (
    expected.orderNo &&
    session.metadata?.order_no &&
    session.metadata.order_no !== expected.orderNo
  )
    throw new Error('Payment order mismatch');
  if (!['creem', 'stripe'].includes(session.provider)) return;
  const info = session.paymentInfo;
  if (
    !info?.transactionId ||
    (session.provider === 'creem' &&
      (!info.productId || info.productId !== expected.paymentProductId))
  )
    throw new Error('Payment product/transaction mismatch');
  if (
    info.currency?.toLowerCase() !== expected.currency.toLowerCase() ||
    info.paymentCurrency?.toLowerCase() !== expected.currency.toLowerCase()
  )
    throw new Error('Payment currency mismatch');
  if (
    info.amount !== expected.amount ||
    !Number.isSafeInteger(info.paymentAmount) ||
    info.paymentAmount < expected.amount ||
    (session.provider === 'stripe' &&
      (info.paymentAmount !== expected.amount ||
        (info.discountAmount || 0) !== 0))
  )
    throw new Error('Payment amount mismatch');
  if (expected.paymentUserId && info.paymentUserId !== expected.paymentUserId)
    throw new Error('Payment customer mismatch');
  if (session.subscriptionInfo) {
    const sub = session.subscriptionInfo;
    const expectedInterval = expected.paymentInterval || expected.interval;
    if (
      expected.paymentType === 'one-time' ||
      (expectedInterval && sub.interval !== expectedInterval) ||
      (expectedInterval && sub.intervalCount !== (expected.intervalCount || 1))
    )
      throw new Error('Payment subscription interval mismatch');
    if (
      sub.amount !== expected.amount ||
      sub.currency?.toLowerCase() !== expected.currency.toLowerCase() ||
      (session.provider === 'creem' &&
        sub.productId !== expected.paymentProductId) ||
      sub.subscriptionId !== session.subscriptionId ||
      !sub.currentPeriodStart ||
      !sub.currentPeriodEnd ||
      !Number.isFinite(sub.currentPeriodStart.getTime()) ||
      !Number.isFinite(sub.currentPeriodEnd.getTime()) ||
      sub.currentPeriodEnd <= sub.currentPeriodStart
    )
      throw new Error('Payment subscription mismatch');
  }
}
