import {
  parseWanCreditRate,
  WAN_PRICE_FIELDS,
} from '@/shared/services/wan-video-pricing';

export const WAN_VIDEO_RATE_CONFIG_KEY = 'wan_pricing_video_rates';
export type WanVideoPricing = {
  revision: string;
  rates: Record<string, string>;
  overrides: Record<string, string>;
};

export class WanVideoRateValidationError extends Error {
  constructor(public fieldErrors: Record<string, string>) {
    super('pricing_invalid');
  }
}

export function validateWanVideoRates(input: unknown): Record<string, string> {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new WanVideoRateValidationError({});
  const source = input as Record<string, unknown>;
  const keys = WAN_PRICE_FIELDS.map(({ name }) => name);
  if (Object.keys(source).some((key) => !keys.includes(key)))
    throw new WanVideoRateValidationError({});
  const rates: Record<string, string> = {};
  const errors: Record<string, string> = {};
  for (const key of keys) {
    const raw = source[key];
    if (
      typeof raw !== 'string' ||
      (raw.trim() !== '' && parseWanCreditRate(raw.trim()) === null)
    ) {
      errors[key] = 'invalid_rate';
    } else {
      rates[key] = raw.trim();
    }
  }
  if (Object.keys(errors).length) throw new WanVideoRateValidationError(errors);
  return rates;
}

export function parseWanVideoRateConfig(
  raw: string
): Omit<WanVideoPricing, 'overrides'> {
  try {
    const data = JSON.parse(raw);
    if (
      !data ||
      data.version !== 1 ||
      typeof data.revision !== 'string' ||
      !/^[A-Za-z0-9-]{1,100}$/.test(data.revision)
    )
      throw new Error('pricing_invalid');
    return {
      revision: data.revision,
      rates: validateWanVideoRates(data.rates),
    };
  } catch {
    throw new Error('pricing_invalid');
  }
}

/** Validate a server response before replacing an administrator's editable draft. */
export function parseWanVideoPricingResponse(input: unknown): WanVideoPricing {
  if (!input || typeof input !== 'object') throw new Error('pricing_invalid');
  const data = input as WanVideoPricing;
  const parsed = parseWanVideoRateConfig(
    JSON.stringify({ version: 1, revision: data.revision, rates: data.rates })
  );
  if (
    !data.overrides ||
    typeof data.overrides !== 'object' ||
    Array.isArray(data.overrides)
  )
    throw new Error('pricing_invalid');
  for (const [key, value] of Object.entries(data.overrides)) {
    if (
      !(key in parsed.rates) ||
      typeof value !== 'string' ||
      value !== parsed.rates[key]
    )
      throw new Error('pricing_invalid');
  }
  return { ...parsed, overrides: { ...data.overrides } };
}
