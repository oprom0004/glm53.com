import type { PurchaseMode } from './wan-product-catalog';

export function parsePurchaseMode(value: unknown): PurchaseMode {
  return value === 'credits' || value === 'annual' ? value : 'monthly';
}

export function pricingCallback(mode: PurchaseMode): string {
  return `/pricing?purchase=${mode}#pricing`;
}

export function safeCheckoutUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return;
  try {
    const url = new URL(value);
    if (
      url.protocol === 'https:' &&
      url.hostname === 'checkout.stripe.com' &&
      !url.username &&
      !url.password &&
      !url.port
    )
      return url.href;
  } catch {}
}

export function safePaymentCallback(
  value: unknown,
  origin: string
): string | undefined {
  if (typeof value !== 'string') return;
  try {
    const url = new URL(value, origin);
    if (url.origin === origin && !url.username && !url.password)
      return url.href;
  } catch {}
}
