import { and, eq, or } from 'drizzle-orm';

import { credit, order } from '@/config/db/schema';
import type { PaymentSession } from '@/extensions/payment/types';
import { getUuid } from '@/shared/lib/hash';
import { assertStripeOrderLinkage } from '@/shared/lib/payment-order-linkage';

import {
  CreditStatus,
  CreditTransactionScene,
  CreditTransactionType,
} from './credit';
import { OrderStatus } from './order';
import { paymentTransaction } from './payment-transaction';

export function planPaymentRefund({
  paidAmount,
  refundAmount,
  totalRefundedAmount,
  grants,
  alreadyReclaimed,
  alreadyFullyRefunded = false,
}: {
  paidAmount: number;
  refundAmount: number;
  totalRefundedAmount: number;
  grants: Array<{ credits: number; remainingCredits: number }>;
  alreadyReclaimed: number;
  alreadyFullyRefunded?: boolean;
}) {
  if (
    !Number.isSafeInteger(paidAmount) ||
    paidAmount <= 0 ||
    !Number.isSafeInteger(refundAmount) ||
    refundAmount <= 0 ||
    !Number.isSafeInteger(totalRefundedAmount) ||
    totalRefundedAmount < refundAmount ||
    totalRefundedAmount > paidAmount
  )
    throw new Error('Refund amount mismatch');
  const full = alreadyFullyRefunded || totalRefundedAmount === paidAmount;
  const reclaimedCredits = full
    ? grants.reduce(
        (total, grant) => total + Math.max(0, grant.remainingCredits),
        0
      )
    : 0;
  const rawConsumed = grants.reduce(
    (total, grant) =>
      total + Math.max(0, grant.credits - grant.remainingCredits),
    0
  );
  const consumedCredits = Math.max(0, rawConsumed - alreadyReclaimed);
  return {
    full,
    reclaimedCredits,
    consumedCredits,
    reviewRequired: !full || consumedCredits > 0,
  };
}

export async function handlePaymentRefunded({
  session,
}: {
  session: PaymentSession;
}) {
  const refund = session.refundInfo;
  if (!refund?.refundId || !refund.transactionId)
    throw new Error('Invalid refund');
  if (['pending', 'failed'].includes(refund.status)) return;
  if (refund.status !== 'succeeded')
    throw new Error('Unsupported refund status');
  const transactionNo = `refund_${session.provider}_${refund.refundId}`;
  return paymentTransaction(async (tx: any) => {
    const matchingOrders = await tx
      .select()
      .from(order)
      .where(
        and(
          eq(order.paymentProvider, session.provider),
          or(
            eq(order.transactionId, refund.transactionId),
            refund.providerOrderId
              ? eq(order.invoiceId, refund.providerOrderId)
              : undefined
          )
        )
      )
      .for('update');
    // PI and invoice must identify one ledger order, never whichever OR-match
    // the database happens to return first.
    if (matchingOrders.length > 1)
      throw new Error('Refund order linkage ambiguous');
    const [paidOrder] = matchingOrders;
    if (
      !paidOrder ||
      ![
        OrderStatus.PAID,
        OrderStatus.REFUNDED,
        OrderStatus.PARTIALLY_REFUNDED,
      ].includes(paidOrder.status)
    )
      throw new Error('Refund paid order not found');
    if (session.provider === 'stripe') {
      assertStripeOrderLinkage(paidOrder, {
        transactionId: refund.transactionId,
        invoiceId: refund.providerOrderId,
      });
    }
    const [existing] = await tx
      .select()
      .from(credit)
      .where(eq(credit.transactionNo, transactionNo));
    if (existing) return existing;
    if (
      refund.currency?.toLowerCase() !==
      paidOrder.paymentCurrency?.toLowerCase()
    )
      throw new Error('Refund amount/currency mismatch');
    const grants = await tx
      .select()
      .from(credit)
      .where(
        and(
          eq(credit.orderNo, paidOrder.orderNo),
          eq(credit.userId, paidOrder.userId),
          eq(credit.transactionType, CreditTransactionType.GRANT)
        )
      )
      .for('update');
    const priorRefunds = await tx
      .select()
      .from(credit)
      .where(
        and(
          eq(credit.orderNo, paidOrder.orderNo),
          eq(credit.transactionType, CreditTransactionType.REFUND)
        )
      );
    const alreadyReclaimed = priorRefunds.reduce(
      (total: number, row: any) => total + Math.max(0, -row.credits),
      0
    );
    const plan = planPaymentRefund({
      paidAmount: paidOrder.paymentAmount,
      refundAmount: refund.amount,
      totalRefundedAmount: refund.totalRefundedAmount,
      grants,
      alreadyReclaimed,
      alreadyFullyRefunded: paidOrder.status === OrderStatus.REFUNDED,
    });
    if (plan.full) {
      for (const grant of grants) {
        await tx
          .update(credit)
          .set({ remainingCredits: 0, status: CreditStatus.REVOKED })
          .where(eq(credit.id, grant.id));
      }
    }
    const metadata = {
      refundId: refund.refundId,
      provider: session.provider,
      transactionId: refund.transactionId,
      refundAmount: refund.amount,
      totalRefundedAmount: refund.totalRefundedAmount,
      currency: refund.currency,
      reclaimedCredits: plan.reclaimedCredits,
      consumedCredits: plan.consumedCredits,
      reviewRequired: plan.reviewRequired,
      reviewStatus: plan.reviewRequired ? 'pending' : 'not_required',
    };
    const [audit] = await tx
      .insert(credit)
      .values({
        id: getUuid(),
        transactionNo,
        userId: paidOrder.userId,
        userEmail: paidOrder.userEmail,
        orderNo: paidOrder.orderNo,
        subscriptionNo: paidOrder.subscriptionNo,
        transactionType: CreditTransactionType.REFUND,
        transactionScene: CreditTransactionScene.REFUND,
        credits: -plan.reclaimedCredits,
        remainingCredits: 0,
        status: CreditStatus.ACTIVE,
        description: plan.reviewRequired
          ? 'Payment refund: manual review required'
          : 'Payment refund: unused credits reclaimed',
        metadata: JSON.stringify(metadata),
      })
      .returning();
    await tx
      .update(order)
      .set({
        status: plan.full
          ? OrderStatus.REFUNDED
          : OrderStatus.PARTIALLY_REFUNDED,
      })
      .where(eq(order.orderNo, paidOrder.orderNo));
    return audit;
  });
}
