import { getRemainingCredits } from '@/shared/models/credit';
import { getOrders } from '@/shared/models/order';
import { getCurrentSubscription } from '@/shared/models/subscription';

type Dependencies = {
  getSubscription: (userId: string) => Promise<any>;
  getCredits: (userId: string) => Promise<number>;
  getPayments: (userId: string) => Promise<any[]>;
};

const defaults: Dependencies = {
  getSubscription: getCurrentSubscription,
  getCredits: getRemainingCredits,
  getPayments: (userId) => getOrders({ userId, page: 1, limit: 100 }),
};

export async function loadAccountOverview(
  userId: string,
  dependencies: Dependencies = defaults
) {
  if (!userId) throw new Error('unauthenticated');
  const [subscription, remainingCredits, payments] = await Promise.all([
    dependencies.getSubscription(userId),
    dependencies.getCredits(userId),
    dependencies.getPayments(userId),
  ]);
  return {
    subscription: subscription
      ? {
          planName: subscription.planName || subscription.productName,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
        }
      : null,
    remainingCredits,
    paymentCount: payments.length,
  };
}
