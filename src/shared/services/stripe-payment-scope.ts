import {
  WANAI_PAYMENT_APP,
  type StripePaymentReference,
} from '@/extensions/payment/stripe-scope';
import {
  findOrderByInvoiceId,
  findOrderByOrderNo,
  findOrderByTransactionId,
} from '@/shared/models/order';
import { findSubscriptionByProviderSubscriptionId } from '@/shared/models/subscription';

export async function isWanaiStripePayment(reference: StripePaymentReference) {
  const metadata = reference.metadata || [];
  const markers = new Set(
    metadata.map((row) => row?.wanai_app).filter(Boolean)
  );
  if (markers.size > 1) throw new Error('Stripe application metadata mismatch');
  let local = false;
  for (const orderNo of new Set(
    metadata.map((row) => row?.order_no).filter(Boolean)
  )) {
    const order = await findOrderByOrderNo(orderNo!);
    if (order?.paymentProvider === 'stripe') local = true;
  }
  if (!local && reference.subscriptionId) {
    local = !!(await findSubscriptionByProviderSubscriptionId({
      provider: 'stripe',
      subscriptionId: reference.subscriptionId,
    }));
  }
  if (!local && reference.transactionId) {
    local = !!(await findOrderByTransactionId({
      paymentProvider: 'stripe',
      transactionId: reference.transactionId,
    }));
  }
  if (!local && reference.providerOrderId) {
    local = !!(await findOrderByInvoiceId({
      paymentProvider: 'stripe',
      invoiceId: reference.providerOrderId,
    }));
  }
  if (markers.size && !markers.has(WANAI_PAYMENT_APP)) {
    if (local) throw new Error('Stripe application metadata mismatch');
    return false;
  }
  return local || markers.has(WANAI_PAYMENT_APP);
}
