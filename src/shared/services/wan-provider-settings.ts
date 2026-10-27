import { normalizeProviderBaseUrl } from './provider-endpoint';
import type { WanVersion } from './wan-models';

export type WanProviderId = 'polaris' | 'kie-wan';
export const WAN_PROVIDER_IDS: WanProviderId[] = ['polaris', 'kie-wan'];
export const KIE_WAN_MODELS = {
  standard: 'wan/3-0-video',
  prime: 'wan/3-0-video-prime',
} as const;

export function getWanProviderId(
  configs: Record<string, string>,
  version: WanVersion
): WanProviderId {
  // Retain the stored setting name while applying the selected provider to all Wan versions.
  if (!['2.5', '2.6', '2.7', '3.0'].includes(version))
    throw new Error('not_configured');
  const selection = configs.wan30_provider?.trim() || 'polaris';
  if (selection === 'kie') return 'kie-wan';
  if (selection === 'polaris') return 'polaris';
  throw new Error('not_configured');
}

export function wanProviderBaseUrl(
  configs: Record<string, string>,
  provider: WanProviderId
) {
  return normalizeProviderBaseUrl(
    provider === 'kie-wan'
      ? configs.kie_base_url?.trim() || 'https://api.kie.ai/api/v1'
      : configs.polaris_base_url?.trim() || 'https://api.polariscore.ai'
  );
}

export function wanProviderCredentials(
  configs: Record<string, string>,
  provider: WanProviderId
) {
  try {
    const apiKey =
      (provider === 'kie-wan'
        ? configs.kie_api_key
        : configs.polaris_api_key
      )?.trim() || '';
    if (!apiKey || !/^[\x21-\x7e]+$/.test(apiKey) || /^Bearer\b/i.test(apiKey))
      throw new Error();
    return { apiKey, baseUrl: wanProviderBaseUrl(configs, provider) };
  } catch {
    throw new Error('not_configured');
  }
}
