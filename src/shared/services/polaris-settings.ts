import { POLARIS_MODELS } from './polaris-models';
import {
  isProviderModelId,
  normalizeOutputHosts,
  normalizeProviderBaseUrl,
} from './provider-endpoint';
import { parseWanCreditRate, WAN_PRICE_FIELDS } from './wan-video-pricing';

export const POLARIS_ORIGIN = 'https://api.polariscore.ai';

export function normalizePolarisSettings(values: Record<string, string>) {
  const normalized = { ...values };
  if (
    'wan30_provider' in normalized &&
    !['polaris', 'kie'].includes(normalized.wan30_provider)
  ) {
    throw new Error('invalid_provider');
  }
  if ('kie_api_key' in normalized) {
    normalized.kie_api_key = normalized.kie_api_key.trim();
    if (
      normalized.kie_api_key &&
      (!/^[\x21-\x7e]+$/.test(normalized.kie_api_key) ||
        /^Bearer\b/i.test(normalized.kie_api_key))
    )
      throw new Error('invalid_api_key');
  }
  for (const name of [
    'polaris_api_key',
    'polaris_base_url',
    ...POLARIS_MODELS.map((model) => model.name),
    ...WAN_PRICE_FIELDS.map((price) => price.name),
  ]) {
    if (name in normalized) normalized[name] = normalized[name].trim();
  }
  if ('polaris_base_url' in normalized) {
    const value = normalized.polaris_base_url || POLARIS_ORIGIN;
    normalized.polaris_base_url = normalizeProviderBaseUrl(value);
  }
  const key = normalized.polaris_api_key;
  if (key && (key.length > 4096 || /\s/.test(key) || /^Bearer\b/i.test(key))) {
    throw new Error('invalid_api_key');
  }
  for (const { name } of POLARIS_MODELS) {
    const model = normalized[name];
    if (model && !isProviderModelId(model)) {
      throw new Error('invalid_model_id');
    }
  }
  for (const provider of ['openrouter', 'replicate', 'fal', 'gemini', 'kie']) {
    const name = `${provider}_base_url`;
    if (name in normalized)
      normalized[name] = normalized[name].trim()
        ? normalizeProviderBaseUrl(normalized[name])
        : '';
  }
  if ('wan_video_output_hosts' in normalized) {
    normalized.wan_video_output_hosts = normalizeOutputHosts(
      normalized.wan_video_output_hosts
    ).join('\n');
  }
  for (const name of Object.keys(normalized).filter((name) =>
    name.startsWith('r2_')
  )) {
    normalized[name] = normalized[name].trim();
  }
  for (const name of ['r2_endpoint', 'r2_domain']) {
    if (normalized[name])
      normalized[name] = normalizeProviderBaseUrl(normalized[name]);
  }
  if (
    (normalized.r2_account_id &&
      !/^[a-f0-9]{32}$/.test(normalized.r2_account_id)) ||
    (normalized.r2_domain &&
      new URL(normalized.r2_domain).hostname.endsWith(
        '.r2.cloudflarestorage.com'
      )) ||
    (normalized.r2_bucket_name &&
      !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(normalized.r2_bucket_name)) ||
    (normalized.r2_endpoint &&
      !/^https:\/\/[a-f0-9]{32}(?:\.(?:eu|fedramp))?\.r2\.cloudflarestorage\.com$/.test(
        normalized.r2_endpoint
      )) ||
    (normalized.r2_upload_path &&
      !/^\/?[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\/?$/.test(
        normalized.r2_upload_path
      ))
  ) {
    throw new Error('invalid_r2_settings');
  }
  for (const { name } of WAN_PRICE_FIELDS) {
    const price = normalized[name];
    if (price && parseWanCreditRate(price) === null) {
      throw new Error('invalid_price');
    }
  }
  return normalized;
}
