import { WAN2_MODELS, type Wan2Version } from './wan-models';

export const WAN_RESOLUTIONS = ['480P', '720P', '1080P'] as const;
export type WanResolution = (typeof WAN_RESOLUTIONS)[number];
export type WanTier = 'standard' | 'prime';

export const WAN_DEFAULT_CREDITS_PER_SECOND = {
  '2.5': { '480P': 5, '720P': 10, '1080P': null },
  '2.6': { '480P': 5, '720P': 10, '1080P': 16 },
  '2.7': { '480P': 5, '720P': 10, '1080P': 16 },
  '3.0': {
    standard: { '480P': 3.5, '720P': 7, '1080P': 14 },
    prime: { '480P': 5, '720P': 10, '1080P': 20 },
  },
} as const;

export function parseWanCreditRate(value: string): number | null {
  const fraction = /^([1-9]\d{0,6})\/([1-9]\d{0,4})$/.exec(value);
  if (!fraction && !/^[1-9]\d{0,4}(?:\.5)?$/.test(value)) return null;
  const rate = fraction
    ? Number(fraction[1]) / Number(fraction[2])
    : Number(value);
  return rate >= 1 && rate <= 99_999.5 ? rate : null;
}

/** Keep rational unit conversions exact until the final whole-credit charge. */
export function wanCreditsForDuration(value: string, seconds: number): number {
  const rate = parseWanCreditRate(value);
  if (rate === null) throw new Error('pricing_not_configured');
  if (!Number.isFinite(seconds) || seconds <= 0)
    throw new Error('invalid_params');
  const parts = value.split('/');
  const credits = Math.ceil(
    parts.length === 2
      ? (Number(parts[0]) * seconds) / Number(parts[1])
      : rate * seconds
  );
  if (!Number.isSafeInteger(credits) || credits <= 0)
    throw new Error('invalid_params');
  return credits;
}

export function wanPriceKey(tier: WanTier, resolution: WanResolution) {
  return `polaris_wan30_${tier}_${resolution.toLowerCase()}_credits_per_second`;
}

export function wan2PriceKey(
  version: Wan2Version,
  mode: 'text' | 'image',
  resolution: WanResolution
) {
  return `polaris_wan${version.replace('.', '')}_${mode}_${resolution.toLowerCase()}_credits_per_second`;
}

export const WAN_PRICE_FIELDS = [
  ...(['standard', 'prime'] as const).flatMap((tier) =>
    WAN_RESOLUTIONS.map((resolution) => ({
      name: wanPriceKey(tier, resolution),
      title: `Wan 3.0 ${tier === 'prime' ? 'Prime' : 'Standard'} ${resolution} credits per second`,
      value: String(WAN_DEFAULT_CREDITS_PER_SECOND['3.0'][tier][resolution]),
    }))
  ),
  ...(Object.keys(WAN2_MODELS) as Wan2Version[]).flatMap((version) =>
    (['text', 'image'] as const).flatMap((mode) =>
      WAN_RESOLUTIONS.map((resolution) => ({
        name: wan2PriceKey(version, mode, resolution),
        title: `Wan ${version} ${mode === 'text' ? 'Text-to-Video' : 'Image-to-Video'} ${resolution} credits per second`,
        value: String(
          WAN_DEFAULT_CREDITS_PER_SECOND[version][resolution] ?? ''
        ),
      }))
    )
  ),
];

export const WAN_DEFAULT_PRICE_CONFIG: Record<string, string> =
  Object.fromEntries(WAN_PRICE_FIELDS.map(({ name, value }) => [name, value]));
