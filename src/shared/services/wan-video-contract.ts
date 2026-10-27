import { r2ConfigsFromSettings } from '@/extensions/storage/r2';

import {
  assertKieWan2Options,
  assertKieWan2Prompt,
  KIE_WAN2_MODELS,
  kieWan2Limits,
} from './kie-wan2-contract';
import { isProviderModelId } from './provider-endpoint';
import {
  isValidWanDuration,
  WAN_DURATION_LIMITS,
  WAN2_MODELS,
  wan2ModelKey,
  type WanModel,
  type WanVersion,
} from './wan-models';
import {
  getWanProviderId,
  KIE_WAN_MODELS,
  wanProviderCredentials,
  type WanProviderId,
} from './wan-provider-settings';
import {
  referenceVideoDuration,
  type ReferenceVideoReceipt,
} from './wan-reference-video';
import {
  parseWanCreditRate,
  WAN_DEFAULT_PRICE_CONFIG,
  WAN_RESOLUTIONS,
  wan2PriceKey,
  wanCreditsForDuration,
  wanPriceKey,
  type WanResolution,
  type WanTier,
} from './wan-video-pricing';

export const WAN_QUOTE_VERSION = 'wan-pricing-v1';

export type WanQuoteInput = {
  version: WanVersion;
  tier: WanTier;
  mode: 'text' | 'image' | 'reference';
  duration: number;
  referenceVideos?: ReferenceVideoReceipt[];
  resolution: WanResolution;
  ratio: 'adaptive' | '16:9' | '9:16' | '1:1' | '4:3' | '3:4';
};

export type WanMedia = {
  type: 'first_frame' | 'last_frame' | 'reference_image' | 'reference_video';
  url: string;
};

export type WanRequest = WanQuoteInput & {
  requestId: string;
  expectedCredits: number;
  quoteVersion: string;
  prompt: string;
  media: WanMedia[];
};

export function parseWanQuote(value: unknown): WanQuoteInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('invalid_params');
  }
  const input = value as Record<string, unknown>;
  if (
    typeof input.version !== 'string' ||
    !['2.5', '2.6', '2.7', '3.0'].includes(input.version)
  ) {
    throw new Error('unsupported_model');
  }

  const isWan2 = input.version !== '3.0';
  const referenceVideos = input.referenceVideos ?? [];
  if (
    !Array.isArray(referenceVideos) ||
    referenceVideos.length > 5 ||
    (referenceVideos.length && (isWan2 || input.mode !== 'reference')) ||
    referenceVideos.some(
      (item) =>
        !item ||
        typeof item.url !== 'string' ||
        item.url.length > 2048 ||
        typeof item.token !== 'string' ||
        item.token.length > 4096
    )
  )
    throw new Error('invalid_reference_video');
  if (
    typeof input.tier !== 'string' ||
    !['standard', 'prime'].includes(input.tier) ||
    typeof input.mode !== 'string' ||
    !['text', 'image', 'reference'].includes(input.mode) ||
    !isValidWanDuration(input.version as WanVersion, input.duration) ||
    typeof input.resolution !== 'string' ||
    !WAN_RESOLUTIONS.includes(input.resolution as WanResolution) ||
    typeof input.ratio !== 'string' ||
    !['adaptive', '16:9', '9:16', '1:1', '4:3', '3:4'].includes(input.ratio) ||
    (isWan2 &&
      (input.tier !== 'standard' || !['text', 'image'].includes(input.mode)))
  ) {
    throw new Error('invalid_params');
  }

  return {
    version: input.version,
    tier: input.tier,
    mode: input.mode,
    duration: input.duration,
    resolution: input.resolution,
    ratio: input.ratio,
    ...(referenceVideos.length
      ? {
          referenceVideos: referenceVideos.map(({ url, token }) => ({
            url,
            token,
          })),
        }
      : {}),
  } as WanQuoteInput;
}

export function parseWanRequest(value: unknown): WanRequest {
  const quote = parseWanQuote(value);
  const input = value as Record<string, unknown>;
  if (
    typeof input.requestId !== 'string' ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
      input.requestId
    ) ||
    !Number.isSafeInteger(input.expectedCredits) ||
    Number(input.expectedCredits) <= 0 ||
    input.quoteVersion !== WAN_QUOTE_VERSION ||
    typeof input.prompt !== 'string' ||
    (quote.mode === 'text' && !input.prompt.trim()) ||
    input.prompt.length > 20_000
  ) {
    throw new Error('invalid_params');
  }

  const media = input.media ?? [];
  if (!Array.isArray(media) || media.length > 15) {
    throw new Error('invalid_params');
  }
  for (const item of media) {
    if (
      !item ||
      typeof item !== 'object' ||
      ![
        'first_frame',
        'last_frame',
        'reference_image',
        'reference_video',
      ].includes(item.type) ||
      typeof item.url !== 'string' ||
      item.url.length > 2048
    ) {
      throw new Error('invalid_params');
    }
    try {
      const url = new URL(item.url);
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.hash ||
        url.search ||
        (url.port && url.port !== '443')
      ) {
        throw new Error();
      }
    } catch {
      throw new Error('invalid_params');
    }
  }
  if (
    (quote.version !== '3.0' &&
      media.some((item) => item.type !== 'first_frame')) ||
    (quote.mode === 'text' && media.length > 0) ||
    (quote.mode === 'image' &&
      (media.filter((item) => item.type === 'first_frame').length !== 1 ||
        media.filter((item) => item.type === 'last_frame').length > 1 ||
        media.some(
          (item) => !['first_frame', 'last_frame'].includes(item.type)
        ))) ||
    (quote.mode === 'reference' &&
      (!media.length ||
        media.some(
          (item) => !['reference_image', 'reference_video'].includes(item.type)
        ))) ||
    media.filter((item) => item.type === 'reference_image').length > 10 ||
    JSON.stringify(
      media
        .filter((item) => item.type === 'reference_video')
        .map((item) => item.url)
    ) !== JSON.stringify((quote.referenceVideos ?? []).map((item) => item.url))
  ) {
    throw new Error('invalid_params');
  }

  return {
    ...quote,
    requestId: input.requestId.toLowerCase(),
    expectedCredits: input.expectedCredits as number,
    quoteVersion: WAN_QUOTE_VERSION,
    prompt: input.prompt.trim(),
    media: media.map((item) => ({ type: item.type, url: item.url })),
  } as WanRequest;
}

function assertInfrastructure(
  configs: Record<string, string>,
  provider: WanProviderId
) {
  wanProviderCredentials(configs, provider);
  try {
    r2ConfigsFromSettings(configs);
  } catch {
    throw new Error('storage_not_configured');
  }
}

export function resolveWanVideoQuote(
  value: unknown,
  configs: Record<string, string>,
  userId?: string
) {
  const normalizedInput = parseWanQuote(value);
  const provider = getWanProviderId(configs, normalizedInput.version);
  assertInfrastructure(configs, provider);
  if (normalizedInput.version !== '3.0') {
    if (provider === 'kie-wan') {
      assertKieWan2Options({
        ...normalizedInput,
        version: normalizedInput.version,
      });
      const prompt = (value as Record<string, unknown>).prompt;
      if (typeof prompt === 'string')
        assertKieWan2Prompt(
          normalizedInput.version,
          normalizedInput.mode,
          prompt
        );
    } else if (normalizedInput.ratio !== 'adaptive') {
      throw new Error('invalid_params');
    }
  }
  if (normalizedInput.referenceVideos?.length && provider !== 'kie-wan')
    throw new Error('unsupported_model');
  const inputVideoDuration = referenceVideoDuration(
    normalizedInput.referenceVideos ?? [],
    userId
  );
  if (inputVideoDuration + normalizedInput.duration > 30)
    throw new Error('reference_video_duration');

  const modelField =
    normalizedInput.version !== '3.0'
      ? wan2ModelKey(
          normalizedInput.version,
          normalizedInput.mode as 'text' | 'image'
        )
      : normalizedInput.tier === 'prime'
        ? 'polaris_wan30_prime_model'
        : 'polaris_wan30_model';
  const expectedModel: WanModel =
    normalizedInput.version !== '3.0'
      ? WAN2_MODELS[normalizedInput.version]
      : normalizedInput.tier === 'prime'
        ? 'wan3.0-video-prime'
        : 'wan3.0-video';
  const providerModel =
    provider === 'kie-wan'
      ? normalizedInput.version === '3.0'
        ? KIE_WAN_MODELS[normalizedInput.tier]
        : KIE_WAN2_MODELS[normalizedInput.version][
            normalizedInput.mode as 'text' | 'image'
          ]
      : configs[modelField]?.trim();
  if (!providerModel || !isProviderModelId(providerModel)) {
    throw new Error('unsupported_model');
  }

  const priceKey =
    normalizedInput.version === '3.0'
      ? wanPriceKey(normalizedInput.tier, normalizedInput.resolution)
      : wan2PriceKey(
          normalizedInput.version,
          normalizedInput.mode as 'text' | 'image',
          normalizedInput.resolution
        );
  const configuredRate = Object.hasOwn(configs, priceKey)
    ? configs[priceKey]
    : WAN_DEFAULT_PRICE_CONFIG[priceKey];
  const rate = parseWanCreditRate((configuredRate ?? '').trim());
  if (rate === null) throw new Error('pricing_not_configured');

  return {
    provider,
    model: expectedModel,
    providerModel,
    credits: wanCreditsForDuration(
      configuredRate!.trim(),
      normalizedInput.duration + inputVideoDuration
    ),
    inputVideoDuration,
    normalizedInput,
    quoteVersion: WAN_QUOTE_VERSION,
  };
}

export function quoteWanVideo(
  value: unknown,
  configs: Record<string, string>,
  userId?: string
) {
  const { credits, normalizedInput, quoteVersion } = resolveWanVideoQuote(
    value,
    configs,
    userId
  );
  return { credits, normalizedInput, quoteVersion };
}

export function wanCapabilities(
  configs: Record<string, string>,
  version: WanVersion = '3.0',
  mode: WanQuoteInput['mode'] = 'text'
) {
  const resolutionStatus = (tier: WanTier, resolution: WanResolution) => {
    if (version !== '3.0' && tier === 'prime') {
      return { enabled: false, reason: 'unsupported_model' };
    }
    try {
      quoteWanVideo(
        {
          version,
          tier,
          mode,
          duration: WAN_DURATION_LIMITS[version].initial,
          resolution,
          ratio: version === '3.0' ? '16:9' : 'adaptive',
        },
        configs
      );
      return { enabled: true };
    } catch (error) {
      return {
        enabled: false,
        reason: error instanceof Error ? error.message : 'not_configured',
      };
    }
  };
  const buildTier = (tier: WanTier) => {
    const resolutions = Object.fromEntries(
      WAN_RESOLUTIONS.map((resolution) => [
        resolution,
        resolutionStatus(tier, resolution),
      ])
    ) as Record<WanResolution, { enabled: boolean; reason?: string }>;
    const enabled = WAN_RESOLUTIONS.some(
      (resolution) => resolutions[resolution].enabled
    );
    return {
      enabled,
      ...(!enabled ? { reason: resolutions['480P'].reason } : {}),
      resolutions,
    };
  };

  return {
    version,
    mode,
    ...(version !== '3.0' && getWanProviderId(configs, version) === 'kie-wan'
      ? kieWan2Limits(version, mode)
      : {}),
    referenceVideo:
      version === '3.0' &&
      mode === 'reference' &&
      configs.wan30_provider?.trim() === 'kie',
    duration:
      version !== '3.0' && getWanProviderId(configs, version) === 'kie-wan'
        ? kieWan2Limits(version, mode).duration
        : { ...WAN_DURATION_LIMITS[version], step: 1 },
    tiers: {
      standard: buildTier('standard'),
      prime: buildTier('prime'),
    },
  };
}

export type WanCapabilities = ReturnType<typeof wanCapabilities>;
