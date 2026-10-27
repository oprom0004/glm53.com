import { inArray } from 'drizzle-orm';

import { db } from '@/core/db';
import { config } from '@/config/db/schema';
import {
  parseWanVideoRateConfig,
  WAN_VIDEO_RATE_CONFIG_KEY,
} from '@/shared/lib/wan-video-rate-config';

import { POLARIS_MODELS } from './polaris-models';
import {
  WAN_DEFAULT_PRICE_CONFIG,
  WAN_PRICE_FIELDS,
} from './wan-video-pricing';

const WAN_CONFIG_KEYS = [
  WAN_VIDEO_RATE_CONFIG_KEY,
  'wan30_provider',
  'kie_api_key',
  'kie_base_url',
  'polaris_api_key',
  'polaris_base_url',
  ...POLARIS_MODELS.map(({ name }) => name),
  ...WAN_PRICE_FIELDS.map(({ name }) => name),
  'wan_video_output_hosts',
  'r2_account_id',
  'r2_bucket_name',
  'r2_access_key',
  'r2_secret_key',
  'r2_endpoint',
  'r2_domain',
  'r2_upload_path',
];

export async function getWanVideoConfigs(): Promise<Record<string, string>> {
  const rows = await db()
    .select()
    .from(config)
    .where(inArray(config.name, WAN_CONFIG_KEYS));
  const values: Record<string, string> = {
    ...WAN_DEFAULT_PRICE_CONFIG,
    ...Object.fromEntries(
      rows.map((row: { name: string; value: string | null }) => [
        row.name,
        row.value ?? '',
      ])
    ),
  };
  if (WAN_VIDEO_RATE_CONFIG_KEY in values) {
    Object.assign(
      values,
      parseWanVideoRateConfig(values[WAN_VIDEO_RATE_CONFIG_KEY]).rates
    );
    delete values[WAN_VIDEO_RATE_CONFIG_KEY];
  }
  for (const key of WAN_CONFIG_KEYS) {
    if (key === WAN_VIDEO_RATE_CONFIG_KEY) continue;
    const override = process.env[key.toUpperCase()] ?? process.env[key];
    if (override?.trim())
      values[key] = key.endsWith('_credits_per_second')
        ? override.trim()
        : override;
  }
  return values;
}
