import { and, asc, eq, gt, isNotNull, notInArray } from 'drizzle-orm';

import { db } from '@/core/db';
import { credit, order } from '@/config/db/schema';
import {
  ANNUAL_ENTITLEMENT_SCENE,
  ANNUAL_MONTHLY_SCENE,
  annualTransactionNo,
  currentAnnualWindow,
  parseAnnualSnapshot,
  type AnnualCreditSnapshot,
  type AnnualPeriod,
} from '@/shared/lib/annual-credit-policy';
import { getUuid } from '@/shared/lib/hash';
import { isAnnualMonthlyProduct } from '@/shared/lib/wan-product-catalog';
import type { Order } from '@/shared/models/order';
import { paymentTransaction } from '@/shared/models/payment-transaction';

async function settleReceipt(tx: any, receipt: any, paid: Order, now: Date) {
  if (
    !['paid', 'partially_refunded'].includes(paid.status) ||
    receipt.status !== 'active'
  )
    return;
  const s = parseAnnualSnapshot(receipt.metadata);
  if (
    !s ||
    s.orderNo !== paid.orderNo ||
    s.userId !== paid.userId ||
    s.subscriptionNo !== paid.subscriptionNo ||
    s.provider !== paid.paymentProvider ||
    s.monthlyCredits !== paid.creditsAmount ||
    !isAnnualMonthlyProduct(paid.productId) ||
    paid.paymentInterval !== 'year'
  )
    throw new Error('Annual entitlement mismatch');
  const window = currentAnnualWindow(
    { start: new Date(s.periodStart), end: new Date(s.periodEnd) },
    now
  );
  if (!window) return;
  const transactionNo = annualTransactionNo(paid.orderNo, window.index);
  const [existing] = await tx
    .select()
    .from(credit)
    .where(eq(credit.transactionNo, transactionNo));
  if (existing) return;
  await tx.insert(credit).values({
    id: getUuid(),
    userId: paid.userId,
    userEmail: paid.userEmail,
    orderNo: paid.orderNo,
    subscriptionNo: paid.subscriptionNo,
    transactionNo,
    transactionType: 'grant',
    transactionScene: ANNUAL_MONTHLY_SCENE,
    credits: s.monthlyCredits,
    remainingCredits: s.monthlyCredits,
    expiresAt: window.end,
    status: 'active',
    description: 'Annual subscription monthly credits',
    metadata: JSON.stringify(s),
  });
}

export async function grantPaidAnnualPeriod(
  tx: any,
  paidOrder: Order,
  period: AnnualPeriod,
  now: Date
): Promise<void> {
  if (['refunded', 'partially_refunded'].includes(paidOrder.status)) return;
  if (
    paidOrder.status !== 'paid' ||
    !isAnnualMonthlyProduct(paidOrder.productId) ||
    paidOrder.paymentInterval !== 'year' ||
    !paidOrder.subscriptionNo
  )
    throw new Error('Invalid annual paid order');
  const snapshot: AnnualCreditSnapshot = {
    version: 1,
    policy: 'annual-monthly-v1',
    orderNo: paidOrder.orderNo,
    userId: paidOrder.userId,
    subscriptionNo: paidOrder.subscriptionNo,
    provider: paidOrder.paymentProvider,
    periodStart: period.start.toISOString(),
    periodEnd: period.end.toISOString(),
    monthlyCredits: paidOrder.creditsAmount!,
  };
  if (!parseAnnualSnapshot(JSON.stringify(snapshot)))
    throw new Error('Invalid annual snapshot');
  const transactionNo = annualTransactionNo(paidOrder.orderNo, 'entitlement');
  let [receipt] = await tx
    .select()
    .from(credit)
    .where(eq(credit.transactionNo, transactionNo))
    .for('update');
  if (receipt) {
    if (
      JSON.stringify(parseAnnualSnapshot(receipt.metadata)) !==
      JSON.stringify(snapshot)
    )
      throw new Error('Annual snapshot conflict');
  } else {
    [receipt] = await tx
      .insert(credit)
      .values({
        id: getUuid(),
        userId: paidOrder.userId,
        userEmail: paidOrder.userEmail,
        orderNo: paidOrder.orderNo,
        subscriptionNo: paidOrder.subscriptionNo,
        transactionNo,
        transactionType: 'grant',
        transactionScene: ANNUAL_ENTITLEMENT_SCENE,
        credits: 0,
        remainingCredits: 0,
        expiresAt: period.end,
        status: 'active',
        description: 'Annual entitlement receipt',
        metadata: JSON.stringify(snapshot),
      })
      .returning();
  }
  await settleReceipt(tx, receipt, paidOrder, now);
}

export async function settleAnnualCreditsInTransaction(
  tx: any,
  userId: string,
  now: Date
): Promise<void> {
  const receipts = await tx
    .select()
    .from(credit)
    .where(
      and(
        eq(credit.userId, userId),
        eq(credit.transactionScene, ANNUAL_ENTITLEMENT_SCENE),
        eq(credit.status, 'active'),
        gt(credit.expiresAt, now)
      )
    )
    .orderBy(asc(credit.orderNo));
  for (const candidate of receipts) {
    // Match refund lock ordering: order before grant rows. Re-read after locking.
    const [paid] = await tx
      .select()
      .from(order)
      .where(
        and(eq(order.orderNo, candidate.orderNo), eq(order.userId, userId))
      )
      .for('update');
    if (!paid || !['paid', 'partially_refunded'].includes(paid.status))
      continue;
    const [receipt] = await tx
      .select()
      .from(credit)
      .where(eq(credit.id, candidate.id))
      .for('update');
    if (receipt) await settleReceipt(tx, receipt, paid, now);
  }
}

export async function ensureAnnualCredits(userId: string): Promise<void> {
  await paymentTransaction((tx) =>
    settleAnnualCreditsInTransaction(tx, userId, new Date())
  );
}

// The daily sweep makes grants visible even when a customer has not opened the
// site. Balance reads and spending still settle synchronously at month rollover.
export async function sweepAnnualCredits(now = new Date(), limit = 100) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new Error('Invalid annual sweep limit');
  const currentGrants = db()
    .select({ orderNo: credit.orderNo })
    .from(credit)
    .where(
      and(
        eq(credit.transactionScene, ANNUAL_MONTHLY_SCENE),
        eq(credit.status, 'active'),
        isNotNull(credit.orderNo),
        gt(credit.expiresAt, now)
      )
    );
  const users = await db()
    .selectDistinct({ userId: credit.userId })
    .from(credit)
    .where(
      and(
        eq(credit.transactionScene, ANNUAL_ENTITLEMENT_SCENE),
        eq(credit.status, 'active'),
        gt(credit.expiresAt, now),
        notInArray(credit.orderNo, currentGrants)
      )
    )
    .orderBy(asc(credit.userId))
    .limit(limit + 1);
  let processed = 0;
  let failed = 0;
  for (const { userId } of users.slice(0, limit)) {
    try {
      await paymentTransaction((tx) =>
        settleAnnualCreditsInTransaction(tx, userId, now)
      );
      processed++;
    } catch {
      failed++;
    }
  }
  return { processed, failed, hasMore: users.length > limit };
}
