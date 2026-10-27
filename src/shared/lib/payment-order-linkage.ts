/** Match normalized Stripe IDs without rewriting legacy ledger identifiers. */
export function assertStripeOrderLinkage(
  order: {
    transactionId?: string | null;
    invoiceId?: string | null;
    paymentSessionId?: string | null;
  },
  incoming: { transactionId: string; invoiceId?: string | null }
) {
  const sameInvoice =
    !!incoming.invoiceId && order.invoiceId === incoming.invoiceId;
  const legacyTransaction =
    !order.transactionId ||
    order.transactionId === order.invoiceId ||
    (order.transactionId.startsWith('cs_') &&
      order.transactionId === order.paymentSessionId);
  if (
    (order.transactionId !== incoming.transactionId &&
      !(sameInvoice && legacyTransaction)) ||
    (incoming.invoiceId && order.invoiceId && !sameInvoice)
  ) {
    throw new Error('Payment transaction/invoice mismatch');
  }
}
