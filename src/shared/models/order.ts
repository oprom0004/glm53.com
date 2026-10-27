import { createHash } from 'node:crypto';
import { and, count, desc, eq, inArray, ne, or } from 'drizzle-orm';

import { db } from '@/core/db';
import { credit, order, subscription, user } from '@/config/db/schema';
import {
  stripeCheckoutMode,
  type StripeMode,
} from '@/extensions/payment/stripe-mode';
import { PaymentType } from '@/extensions/payment/types';
import type { AnnualPeriod } from '@/shared/lib/annual-credit-policy';
import { getSubscriptionEventTime } from '@/shared/lib/payment-event-time';
import { assertStripeOrderLinkage } from '@/shared/lib/payment-order-linkage';
import { grantPaidAnnualPeriod } from '@/shared/services/annual-credits';
import {
  assertWanCatalogRevision,
  type WanCatalogQuote,
} from '@/shared/services/wan-catalog';

import { NewCredit } from './credit';
import { paymentTransaction } from './payment-transaction';
import {
  NewSubscription,
  UpdateSubscription,
  updateSubscriptionBySubscriptionNo,
} from './subscription';
import { appendUserToResult, User } from './user';

export type Order = typeof order.$inferSelect & {
  user?: User;
};
export type NewOrder = typeof order.$inferInsert;
export type UpdateOrder = Partial<
  Omit<NewOrder, 'id' | 'orderNo' | 'createdAt'>
>;

export enum OrderStatus {
  // processing status
  PENDING = 'pending', // order saved, waiting for checkout
  CREATED = 'created', // checkout success
  // final status
  COMPLETED = 'completed', // checkout completed, but failed
  PAID = 'paid', // order paid success
  FAILED = 'failed', // order paid, but failed
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
}

export async function findInitialOrderBySubscriptionNo(subscriptionNo: string) {
  const [result] = await db()
    .select()
    .from(order)
    .where(
      and(
        eq(order.subscriptionNo, subscriptionNo),
        eq(order.paymentType, PaymentType.SUBSCRIPTION)
      )
    )
    .limit(1);
  return result;
}

/**
 * create order
 */
export async function createOrder(newOrder: NewOrder) {
  const [result] = await db().insert(order).values(newOrder).returning();

  return result;
}

export async function reserveSubscriptionOrder(
  newOrder: NewOrder,
  options: {
    stripeMode?: StripeMode;
    catalogQuote?: WanCatalogQuote;
  } = {}
): Promise<Order> {
  return paymentTransaction(async (tx) => {
    // Lock an existing owner row: locking an empty pending-order result cannot
    // serialize simultaneous first purchases on PostgreSQL/MySQL.
    const [owner] = await tx
      .select()
      .from(user)
      .where(eq(user.id, newOrder.userId))
      .for('update');
    if (!owner) throw new Error('Invalid purchase owner');
    const [contract] = await tx
      .select()
      .from(subscription)
      .where(
        and(
          eq(subscription.userId, newOrder.userId),
          ne(subscription.status, 'canceled')
        )
      )
      .limit(1);
    if (contract) throw new Error('subscription_already_exists');

    const pendingOrders: Order[] = await tx
      .select()
      .from(order)
      .where(
        and(
          eq(order.userId, newOrder.userId),
          eq(order.paymentType, PaymentType.SUBSCRIPTION),
          inArray(order.status, [OrderStatus.PENDING, OrderStatus.CREATED])
        )
      )
      .orderBy(desc(order.createdAt));
    let pending: Order | undefined;
    for (const candidate of pendingOrders) {
      if (
        newOrder.paymentProvider === 'stripe' &&
        options.stripeMode === 'live' &&
        isUnpaidStripeTestCheckout(candidate)
      ) {
        await tx
          .update(order)
          .set({ status: OrderStatus.COMPLETED })
          .where(
            and(eq(order.id, candidate.id), eq(order.status, candidate.status))
          );
      } else {
        pending ??= candidate;
      }
    }
    if (pending) return pending;
    if (options.catalogQuote)
      await assertWanCatalogRevision(tx, options.catalogQuote);
    const [created] = await tx.insert(order).values(newOrder).returning();
    return created;
  });
}

export async function reserveCreditPackOrder(
  newOrder: NewOrder,
  requestId: string,
  options: {
    stripeMode?: StripeMode;
    catalogQuote?: WanCatalogQuote;
  } = {}
): Promise<Order> {
  if (
    typeof requestId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      requestId
    )
  )
    throw new Error('Invalid purchase request');
  if (newOrder.paymentType !== PaymentType.ONE_TIME)
    throw new Error('Invalid credit pack order');
  const orderNo = `pack_${createHash('sha256').update(`${newOrder.userId}:${requestId.toLowerCase()}`).digest('hex')}`;
  return paymentTransaction(async (tx) => {
    const [owner] = await tx
      .select()
      .from(user)
      .where(eq(user.id, newOrder.userId))
      .for('update');
    if (!owner) throw new Error('Invalid purchase owner');
    const [existing] = await tx
      .select()
      .from(order)
      .where(eq(order.orderNo, orderNo));
    if (existing) {
      if (
        existing.userId !== newOrder.userId ||
        existing.productId !== newOrder.productId
      )
        throw new Error('checkout_in_progress');
      const recoveryOrderNo = creditPackRecoveryOrderNo(existing);
      const [target] = recoveryOrderNo
        ? await tx
            .select()
            .from(order)
            .where(eq(order.orderNo, recoveryOrderNo))
        : [existing];
      if (
        !target ||
        target.userId !== existing.userId ||
        target.paymentProvider !== existing.paymentProvider ||
        target.paymentType !== PaymentType.ONE_TIME ||
        creditPackRecoveryOrderNo(target)
      )
        throw new Error('checkout_needs_review');
      if (
        options.stripeMode === 'live' &&
        [OrderStatus.PENDING, OrderStatus.CREATED].includes(target.status) &&
        isUnpaidStripeTestCheckout(target)
      ) {
        const [retired] = await tx
          .update(order)
          .set({ status: OrderStatus.COMPLETED })
          .where(eq(order.orderNo, target.orderNo))
          .returning();
        return recoveryOrderNo ? existing : retired;
      }
      return existing;
    }
    const pending = await tx
      .select()
      .from(order)
      .where(
        and(
          eq(order.userId, newOrder.userId),
          eq(order.paymentType, PaymentType.ONE_TIME),
          inArray(order.status, [
            OrderStatus.PENDING,
            OrderStatus.CREATED,
            OrderStatus.FAILED,
          ])
        )
      );
    for (const candidate of pending) {
      if (
        options.stripeMode === 'live' &&
        isUnpaidStripeTestCheckout(candidate)
      )
        await tx
          .update(order)
          .set({ status: OrderStatus.COMPLETED })
          .where(eq(order.id, candidate.id));
      else {
        // Persist the new request's relation to the original purchase. A bare
        // return of candidate would let this request create a second charge
        // when replayed after the original is paid. This row is never payable.
        const [recovery] = await tx
          .insert(order)
          .values({
            ...newOrder,
            orderNo,
            status: OrderStatus.COMPLETED,
            amount: 0,
            creditsAmount: 0,
            checkoutInfo: JSON.stringify({
              type: 'credit-pack-recovery-v1',
              orderNo: candidate.orderNo,
            }),
          })
          .returning();
        return recovery;
      }
    }
    if (options.catalogQuote)
      await assertWanCatalogRevision(tx, options.catalogQuote);
    const payment = JSON.parse(newOrder.checkoutInfo || '{}');
    payment.orderNo = orderNo;
    payment.metadata = {
      ...payment.metadata,
      order_no: orderNo,
      user_id: newOrder.userId,
    };
    const success = new URL(payment.successUrl);
    success.searchParams.set('order_no', orderNo);
    payment.successUrl = success.toString();
    const [created] = await tx
      .insert(order)
      .values({ ...newOrder, orderNo, checkoutInfo: JSON.stringify(payment) })
      .returning();
    return created;
  });
}

export function creditPackRecoveryOrderNo(row: Order): string | undefined {
  const snapshot = JSON.parse(row.checkoutInfo || '{}');
  if (snapshot?.type !== 'credit-pack-recovery-v1') return;
  if (
    row.status !== OrderStatus.COMPLETED ||
    row.amount !== 0 ||
    row.paymentSessionId ||
    row.paymentType !== PaymentType.ONE_TIME ||
    typeof snapshot.orderNo !== 'string' ||
    !snapshot.orderNo ||
    snapshot.orderNo === row.orderNo
  )
    throw new Error('checkout_needs_review');
  return snapshot.orderNo;
}

function isUnpaidStripeTestCheckout(candidate: Order) {
  if (
    candidate.paymentProvider !== 'stripe' ||
    stripeCheckoutMode(candidate.paymentSessionId) !== 'test' ||
    candidate.paidAt ||
    candidate.transactionId ||
    candidate.paymentAmount ||
    candidate.subscriptionNo ||
    candidate.subscriptionId ||
    candidate.paymentResult
  ) {
    return false;
  }
  if (!candidate.checkoutResult) return true;
  try {
    const snapshot = JSON.parse(candidate.checkoutResult);
    return (
      !!snapshot &&
      typeof snapshot === 'object' &&
      !Array.isArray(snapshot) &&
      (snapshot.livemode === undefined || snapshot.livemode === false) &&
      (snapshot.id === undefined ||
        snapshot.id === candidate.paymentSessionId) &&
      snapshot.status !== 'complete' &&
      (!snapshot.payment_status || snapshot.payment_status === 'unpaid') &&
      !snapshot.subscription &&
      !snapshot.payment_intent
    );
  } catch {
    return false;
  }
}

/**
 * get orders
 */
export async function getOrders({
  orderNo,
  userId,
  status,
  getUser,
  paymentType,
  paymentProvider,
  page = 1,
  limit = 30,
}: {
  orderNo?: string;
  userId?: string;
  status?: OrderStatus;
  getUser?: boolean;
  paymentType?: PaymentType;
  paymentProvider?: string;
  page?: number;
  limit?: number;
} = {}): Promise<Order[]> {
  const result = await db()
    .select()
    .from(order)
    .where(
      and(
        orderNo ? eq(order.orderNo, orderNo) : undefined,
        userId ? eq(order.userId, userId) : undefined,
        status ? eq(order.status, status) : undefined,
        paymentType ? eq(order.paymentType, paymentType) : undefined,
        paymentProvider ? eq(order.paymentProvider, paymentProvider) : undefined
      )
    )
    .orderBy(desc(order.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  if (getUser) {
    return appendUserToResult(result);
  }

  return result;
}

/**
 * get orders count
 */
export async function getOrdersCount({
  orderNo,
  userId,
  paymentType,
  status,
  paymentProvider,
}: {
  orderNo?: string;
  userId?: string;
  paymentType?: PaymentType;
  paymentProvider?: string;
  status?: OrderStatus;
} = {}): Promise<number> {
  const [result] = await db()
    .select({ count: count() })
    .from(order)
    .where(
      and(
        orderNo ? eq(order.orderNo, orderNo) : undefined,
        userId ? eq(order.userId, userId) : undefined,
        status ? eq(order.status, status) : undefined,
        paymentType ? eq(order.paymentType, paymentType) : undefined,
        paymentProvider ? eq(order.paymentProvider, paymentProvider) : undefined
      )
    );

  return result?.count || 0;
}

/**
 * find order by id
 */
export async function findOrderById(id: string) {
  const [result] = await db().select().from(order).where(eq(order.id, id));

  return result;
}

/**
 * find order by order no
 */
export async function findOrderByOrderNo(orderNo: string) {
  const [result] = await db()
    .select()
    .from(order)
    .where(eq(order.orderNo, orderNo));

  return result;
}

/**
 * find order by transaction id and payment provider
 */
export async function findOrderByTransactionId({
  transactionId,
  paymentProvider,
}: {
  transactionId: string;
  paymentProvider: string;
}) {
  const [result] = await db()
    .select()
    .from(order)
    .where(
      and(
        eq(order.transactionId, transactionId),
        eq(order.paymentProvider, paymentProvider)
      )
    );

  return result;
}

export async function findOrderByInvoiceId({
  invoiceId,
  paymentProvider,
}: {
  invoiceId: string;
  paymentProvider: string;
}) {
  const [result] = await db()
    .select()
    .from(order)
    .where(
      and(
        eq(order.invoiceId, invoiceId),
        eq(order.paymentProvider, paymentProvider)
      )
    );

  return result;
}

/**
 * update order
 */
export async function updateOrderByOrderNo(
  orderNo: string,
  updateOrder: UpdateOrder,
  options?: {
    // Only update if current status matches (optimistic lock)
    expectedStatus?: OrderStatus;
  }
) {
  const conditions = [eq(order.orderNo, orderNo)];

  // Add status check for optimistic locking
  if (options?.expectedStatus) {
    conditions.push(eq(order.status, options.expectedStatus));
  }

  const [result] = await db()
    .update(order)
    .set(updateOrder)
    .where(and(...conditions))
    .returning();

  return result;
}

/**
 * update order by order id
 */
export async function updateOrderByOrderId(
  orderId: string,
  updateOrder: UpdateOrder
) {
  const [result] = await db()
    .update(order)
    .set(updateOrder)
    .where(eq(order.id, orderId))
    .returning();

  return result;
}

export async function updateOrderInTransaction({
  orderNo,
  updateOrder,
  newSubscription,
  newCredit,
  annualPeriod,
}: {
  orderNo: string;
  updateOrder: UpdateOrder;
  newSubscription?: NewSubscription;
  newCredit?: NewCredit;
  annualPeriod?: AnnualPeriod;
}) {
  if (newCredit && annualPeriod) throw new Error('Conflicting credit policies');
  if (!orderNo || !updateOrder) {
    throw new Error('orderNo and updateOrder are required');
  }

  const result = await paymentTransaction(async (tx: any) => {
    let result: any = {
      order: null,
      subscription: null,
      credit: null,
    };

    const [currentOrder] = await tx
      .select()
      .from(order)
      .where(eq(order.orderNo, orderNo))
      .for('update');
    if (!currentOrder) throw new Error('order not found');
    if (
      [
        OrderStatus.PAID,
        OrderStatus.REFUNDED,
        OrderStatus.PARTIALLY_REFUNDED,
      ].includes(currentOrder.status)
    ) {
      return { ...result, order: currentOrder };
    }
    if (updateOrder.status === OrderStatus.PAID) {
      if (
        ![
          OrderStatus.CREATED,
          OrderStatus.PENDING,
          OrderStatus.FAILED,
        ].includes(currentOrder.status)
      ) {
        throw new Error('order cannot be paid');
      }
      if (updateOrder.transactionId) {
        const [existing] = await tx
          .select()
          .from(order)
          .where(
            and(
              eq(order.transactionId, updateOrder.transactionId),
              eq(order.paymentProvider, currentOrder.paymentProvider)
            )
          )
          .for('update');
        if (existing && existing.orderNo !== orderNo) {
          throw new Error('Payment transaction order mismatch');
        }
      }
    }

    const [claimed] = await tx
      .update(order)
      .set(updateOrder)
      .where(
        and(eq(order.orderNo, orderNo), eq(order.status, currentOrder.status))
      )
      .returning();
    if (!claimed) throw new Error('Concurrent order update; retry settlement');
    result.order = claimed;

    // deal with subscription
    if (newSubscription) {
      let existingSubscription: any = null;
      if (newSubscription.subscriptionId && newSubscription.paymentProvider) {
        // not create subscription with same subscription id and payment provider
        const [existingSubscriptionResult] = await tx
          .select()
          .from(subscription)
          .where(
            and(
              eq(subscription.subscriptionId, newSubscription.subscriptionId),
              eq(subscription.paymentProvider, newSubscription.paymentProvider)
            )
          );

        existingSubscription = existingSubscriptionResult;
      }

      if (
        existingSubscription &&
        existingSubscription.userId !== currentOrder.userId
      ) {
        throw new Error('Payment subscription owner mismatch');
      }
      if (!existingSubscription) {
        // create subscription
        const [subscriptionResult] = await tx
          .insert(subscription)
          .values(newSubscription)
          .returning();

        existingSubscription = subscriptionResult;
      }

      result.subscription = existingSubscription;
      const [linked] = await tx
        .update(order)
        .set({ subscriptionNo: existingSubscription.subscriptionNo })
        .where(eq(order.orderNo, orderNo))
        .returning();
      result.order = linked;
    }

    if (annualPeriod)
      await grantPaidAnnualPeriod(tx, result.order, annualPeriod, new Date());

    // deal with credit
    if (newCredit) {
      // not create credit with same order no
      let [existingCredit] = await tx
        .select()
        .from(credit)
        .where(eq(credit.orderNo, orderNo));

      if (!existingCredit) {
        // create credit
        const [creditResult] = await tx
          .insert(credit)
          .values({
            ...newCredit,
            orderNo,
            subscriptionNo:
              result.subscription?.subscriptionNo || newCredit.subscriptionNo,
          })
          .returning();

        existingCredit = creditResult;
      }

      result.credit = existingCredit;
    }

    return result;
  });

  return result;
}

export async function updateSubscriptionInTransaction({
  subscriptionNo,
  updateSubscription,
  newOrder,
  newCredit,
  annualPeriod,
}: {
  subscriptionNo: string; // subscription unique id in table
  updateSubscription: UpdateSubscription;
  newOrder?: NewOrder;
  newCredit?: NewCredit;
  annualPeriod?: AnnualPeriod;
}) {
  if (newCredit && annualPeriod) throw new Error('Conflicting credit policies');
  if (!subscriptionNo || !updateSubscription) {
    throw new Error('subscriptionNo and updateSubscription are required');
  }

  const result = await paymentTransaction(async (tx: any) => {
    let result: any = {
      order: null,
      subscription: null,
      credit: null,
    };

    const [currentSubscription] = await tx
      .select()
      .from(subscription)
      .where(eq(subscription.subscriptionNo, subscriptionNo))
      .for('update');
    if (!currentSubscription) throw new Error('subscription not found');

    // deal with order
    if (newOrder) {
      let existingOrder: any = null;
      if (newOrder.transactionId && newOrder.paymentProvider) {
        // Historical Stripe renewals stored the invoice as transactionId. Use
        // both identifiers under the subscription lock so replay cannot grant
        // twice, including after a full refund.
        const matches = await tx
          .select()
          .from(order)
          .where(
            and(
              eq(order.paymentProvider, newOrder.paymentProvider),
              or(
                eq(order.transactionId, newOrder.transactionId),
                newOrder.paymentProvider === 'stripe' && newOrder.invoiceId
                  ? eq(order.invoiceId, newOrder.invoiceId)
                  : undefined
              )
            )
          )
          .for('update');
        if (matches.length > 1)
          throw new Error('Payment order linkage ambiguous');
        existingOrder = matches[0];
        if (existingOrder && newOrder.paymentProvider === 'stripe') {
          assertStripeOrderLinkage(existingOrder, {
            transactionId: newOrder.transactionId,
            invoiceId: newOrder.invoiceId,
          });
        }
      }

      const reusedOrder = !!existingOrder;
      if (!existingOrder) {
        // create order
        const [orderResult] = await tx
          .insert(order)
          .values(newOrder)
          .returning();

        existingOrder = orderResult;
      }

      result.order = existingOrder;
      if (
        existingOrder.userId !== currentSubscription.userId ||
        existingOrder.subscriptionNo !== subscriptionNo
      ) {
        throw new Error('Payment renewal owner mismatch');
      }
      if (
        reusedOrder &&
        [
          OrderStatus.PAID,
          OrderStatus.REFUNDED,
          OrderStatus.PARTIALLY_REFUNDED,
        ].includes(existingOrder.status)
      ) {
        return { ...result, subscription: currentSubscription };
      }
    }

    if (annualPeriod)
      await grantPaidAnnualPeriod(tx, result.order, annualPeriod, new Date());

    // deal with credit
    if (newCredit) {
      let existingCredit: any = null;
      if (result.order && result.order.orderNo) {
        // not create credit with same order no
        const [existingCreditResult] = await tx
          .select()
          .from(credit)
          .where(eq(credit.orderNo, result.order.orderNo));

        existingCredit = existingCreditResult;
      }

      if (!existingCredit) {
        // create credit
        const [creditResult] = await tx
          .insert(credit)
          .values({
            ...newCredit,
            orderNo: result.order?.orderNo || newCredit.orderNo,
            subscriptionNo,
          })
          .returning();

        existingCredit = creditResult;
      }

      result.credit = existingCredit;
    }

    const periodIsNewer =
      !currentSubscription.currentPeriodEnd ||
      (updateSubscription.currentPeriodEnd &&
        updateSubscription.currentPeriodEnd >
          currentSubscription.currentPeriodEnd);
    const periodUpdate: UpdateSubscription = periodIsNewer
      ? { ...updateSubscription }
      : {};
    const previousEventTime = getSubscriptionEventTime(
      currentSubscription.subscriptionResult
    );
    const incomingEventTime = getSubscriptionEventTime(
      updateSubscription.subscriptionResult
    );
    if (
      Number.isFinite(previousEventTime) &&
      (!Number.isFinite(incomingEventTime) ||
        incomingEventTime < previousEventTime)
    ) {
      delete periodUpdate.subscriptionResult;
      delete periodUpdate.status;
    }
    if (
      currentSubscription.status !== 'active' &&
      currentSubscription.status !== 'paused' &&
      !(
        ['creem', 'stripe'].includes(currentSubscription.paymentProvider) &&
        currentSubscription.status === 'expired'
      )
    ) {
      delete periodUpdate.status;
    }
    if (!Object.keys(periodUpdate).length) {
      return { ...result, subscription: currentSubscription };
    }

    const [subscriptionResult] = await tx
      .update(subscription)
      .set(periodUpdate)
      .where(eq(subscription.subscriptionNo, subscriptionNo))
      .returning();

    result.subscription = subscriptionResult;

    return result;
  });

  return result;
}
