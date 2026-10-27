export type PurchaseMode = 'credits' | 'monthly' | 'annual';
export type WanProduct = Readonly<{
  id: string;
  tier: 'starter' | 'creator' | 'pro';
  mode: PurchaseMode;
  amount: number;
  currency: 'USD';
  interval: 'one-time' | 'month' | 'year';
  credits: number;
  validDays: number;
  creditPolicy: 'permanent' | 'paid-period' | 'annual-monthly-v1';
  displayMonthlyDollars?: number;
  originalMonthlyAmount?: number;
}>;

export type WanCatalog = Readonly<{
  revision: string;
  products: readonly WanProduct[];
}>;
export const WAN_CATALOG_CONFIG_KEY = 'wan_pricing_catalog';
export type WanCatalogValues = Record<
  string,
  { amount: number; credits: number }
>;
export type WanCatalogDraft = Record<
  string,
  { price: string; credits: string }
>;
export class WanCatalogValidationError extends Error {
  constructor(public readonly fieldErrors: Record<string, string>) {
    super('pricing_invalid');
  }
}

const tiers = [
  {
    tier: 'starter',
    credits: 800,
    monthly: 1590,
    annual: 17200,
    pack: 1990,
    display: 14,
  },
  {
    tier: 'creator',
    credits: 2400,
    monthly: 4590,
    annual: 49500,
    pack: 5490,
    display: 42,
  },
  {
    tier: 'pro',
    credits: 5200,
    monthly: 9590,
    annual: 103600,
    pack: 10990,
    display: 86,
  },
] as const;

export const WAN_PRODUCTS: readonly WanProduct[] = Object.freeze(
  (['monthly', 'annual', 'credits'] as const).flatMap((mode) =>
    tiers.map((t) =>
      Object.freeze({
        id: `${t.tier}-${mode}-${t.credits}${mode === 'annual' ? '-v1' : mode === 'credits' ? '-v2' : ''}`,
        tier: t.tier,
        mode,
        currency: 'USD' as const,
        credits: t.credits,
        amount:
          mode === 'monthly'
            ? t.monthly
            : mode === 'annual'
              ? t.annual
              : t.pack,
        interval:
          mode === 'monthly'
            ? ('month' as const)
            : mode === 'annual'
              ? ('year' as const)
              : ('one-time' as const),
        validDays: mode === 'credits' ? 0 : 30,
        creditPolicy:
          mode === 'credits'
            ? ('permanent' as const)
            : mode === 'annual'
              ? ('annual-monthly-v1' as const)
              : ('paid-period' as const),
        ...(mode === 'annual'
          ? {
              displayMonthlyDollars: t.display,
              originalMonthlyAmount: t.monthly,
            }
          : {}),
      })
    )
  )
);

export const DEFAULT_WAN_CATALOG: WanCatalog = Object.freeze({
  revision: 'default-v1',
  products: WAN_PRODUCTS,
});

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function exactProducts(value: unknown): value is Record<string, unknown> {
  return (
    record(value) &&
    Object.keys(value).length === WAN_PRODUCTS.length &&
    WAN_PRODUCTS.every((p) => Object.hasOwn(value, p.id))
  );
}

function inRange(value: unknown, max: number): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= max
  );
}

/** Dollar input stays a string until its fractional digits become integer cents. */
export function validateWanCatalogDraft(input: unknown): WanCatalogValues {
  if (!exactProducts(input))
    throw new WanCatalogValidationError({ products: 'invalid_products' });
  const errors: Record<string, string> = {};
  const result: WanCatalogValues = {};
  for (const product of WAN_PRODUCTS) {
    const value = input[product.id];
    const price = record(value) ? value.price : undefined;
    const credits = record(value) ? value.credits : undefined;
    const validPrice =
      typeof price === 'string' && /^\d{1,6}(?:\.\d{1,2})?$/.test(price);
    const [whole, fraction = ''] = validPrice ? price.split('.') : [];
    const amount = validPrice
      ? Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
      : NaN;
    const creditCount =
      typeof credits === 'string' && /^\d{1,10}$/.test(credits)
        ? Number(credits)
        : NaN;
    if (!inRange(amount, 99999999))
      errors[`${product.id}.price`] = 'invalid_price';
    if (!inRange(creditCount, 1000000000))
      errors[`${product.id}.credits`] = 'invalid_credits';
    if (
      !record(value) ||
      Object.keys(value).some((k) => !['price', 'credits'].includes(k))
    )
      errors[`${product.id}.price`] = 'invalid_price';
    result[product.id] = { amount, credits: creditCount };
  }
  if (Object.keys(errors).length) throw new WanCatalogValidationError(errors);
  return result;
}

/** Missing configuration is the only case allowed to use the original defaults. */
export function parseWanCatalog(raw?: string | null): WanCatalog {
  if (raw === undefined || raw === null) return DEFAULT_WAN_CATALOG;
  let stored: unknown;
  try {
    stored = JSON.parse(raw);
  } catch {
    throw new Error('pricing_invalid');
  }
  if (
    !record(stored) ||
    stored.version !== 1 ||
    typeof stored.revision !== 'string' ||
    !/^[A-Za-z0-9-]{1,100}$/.test(stored.revision) ||
    !exactProducts(stored.products)
  )
    throw new Error('pricing_invalid');
  const values = stored.products;
  const products = WAN_PRODUCTS.map((product) => {
    const value = values[product.id];
    if (
      !record(value) ||
      !inRange(value.amount, 99999999) ||
      !inRange(value.credits, 1000000000) ||
      Object.keys(value).some((k) => !['amount', 'credits'].includes(k))
    )
      throw new Error('pricing_invalid');
    return {
      ...product,
      amount: value.amount,
      credits: value.credits,
      displayMonthlyDollars: undefined,
      originalMonthlyAmount: undefined,
    } as WanProduct;
  }).map((product) => {
    if (product.mode !== 'annual') return Object.freeze(product);
    const monthly = WAN_PRODUCTS.find(
      (p) => p.mode === 'monthly' && p.tier === product.tier
    )!;
    const counterpart = values[monthly.id] as {
      amount: number;
      credits: number;
    };
    return Object.freeze({
      ...product,
      displayMonthlyDollars: Math.round(product.amount / 12) / 100,
      ...(counterpart.credits === product.credits &&
      counterpart.amount * 12 > product.amount
        ? { originalMonthlyAmount: counterpart.amount }
        : {}),
    });
  });
  return Object.freeze({
    revision: stored.revision,
    products: Object.freeze(products),
  });
}

export function findWanProduct(id: unknown): WanProduct | undefined {
  return typeof id === 'string'
    ? WAN_PRODUCTS.find((p) => p.id === id)
    : undefined;
}

// Historical interpretation must survive a product being withdrawn from sale.
export function isAnnualMonthlyProduct(id: unknown): boolean {
  return (
    typeof id === 'string' &&
    [
      'starter-annual-800-v1',
      'creator-annual-2400-v1',
      'pro-annual-5200-v1',
    ].includes(id)
  );
}

export function unitCreditCost(product: WanProduct): number {
  return (
    product.amount /
    100 /
    (product.credits * (product.mode === 'annual' ? 12 : 1))
  );
}
