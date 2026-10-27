import type { StripeMode } from './stripe-mode';

export const WANAI_PAYMENT_APP = 'wanai30-lite';

export interface StripePaymentReference {
  metadata?: Array<Record<string, string> | null | undefined>;
  subscriptionId?: string;
  transactionId?: string;
  providerOrderId?: string;
}

export function assertStripeEventScope(
  event: { livemode: boolean; account?: string | null },
  expected: { mode: StripeMode; accountId?: string }
) {
  if (event.livemode !== (expected.mode === 'live')) {
    throw new Error('Stripe mode mismatch');
  }
  if (expected.accountId && event.account !== expected.accountId) {
    throw new Error('Stripe account mismatch');
  }
}
