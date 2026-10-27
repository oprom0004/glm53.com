import type { Configs } from '@/shared/models/config';

export const WAN_SUBSCRIPTION_PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    amount: 1590,
    currency: 'usd',
    credits: 800,
    interval: 'month',
    priceConfigKey: 'stripe_price_starter',
  },
  {
    id: 'creator',
    name: 'Creator',
    amount: 4590,
    currency: 'usd',
    credits: 2400,
    interval: 'month',
    priceConfigKey: 'stripe_price_creator',
  },
  {
    id: 'pro',
    name: 'Pro',
    amount: 9590,
    currency: 'usd',
    credits: 5200,
    interval: 'month',
    priceConfigKey: 'stripe_price_pro',
  },
] as const;

export type WanSubscriptionPlanId =
  (typeof WAN_SUBSCRIPTION_PLANS)[number]['id'];

export function getPublicSubscriptionPlans() {
  return WAN_SUBSCRIPTION_PLANS.map(
    ({ priceConfigKey: _serverOnly, ...plan }) => plan
  );
}

export function resolveSubscriptionPlan(planId: unknown, configs: Configs) {
  const plan = WAN_SUBSCRIPTION_PLANS.find((item) => item.id === planId);
  if (!plan) throw new Error('invalid_plan');
  const stripePriceId = String(configs[plan.priceConfigKey] || '').trim();
  if (!/^price_[A-Za-z0-9_]+$/.test(stripePriceId)) {
    throw new Error('plan_not_configured');
  }
  return { ...plan, stripePriceId };
}

export function safeLocalReturnPath(value: unknown, fallback: string) {
  if (typeof value !== 'string' || !value.startsWith('/')) return fallback;
  if (value.startsWith('//') || value.includes('\\')) return fallback;
  try {
    const parsed = new URL(value, 'https://local.invalid');
    if (parsed.origin !== 'https://local.invalid') return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function safeAppRedirect(
  value: unknown,
  appUrl: string,
  fallbackPath: string
) {
  const origin = new URL(appUrl).origin;
  try {
    const target = new URL(typeof value === 'string' ? value : '', origin);
    if (target.origin !== origin) return `${origin}${fallbackPath}`;
    return target.toString();
  } catch {
    return `${origin}${fallbackPath}`;
  }
}
