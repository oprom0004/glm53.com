import { createHash } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/core/db';
import { envConfigs } from '@/config';
import { config } from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';
import {
  parseWanVideoRateConfig,
  validateWanVideoRates,
  WAN_VIDEO_RATE_CONFIG_KEY,
  WanVideoRateValidationError,
  type WanVideoPricing,
} from '@/shared/lib/wan-video-rate-config';
import { getUserInfo } from '@/shared/models/user';

import { hasRole, ROLES } from './rbac';
import {
  WAN_DEFAULT_PRICE_CONFIG,
  WAN_PRICE_FIELDS,
} from './wan-video-pricing';

export type VideoPricingAuth = {
  getUser(): Promise<{ id: string } | null | undefined>;
};
const defaultAuth: VideoPricingAuth = { getUser: getUserInfo };
const hash = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

export async function requireVideoPricingAdmin(
  auth: VideoPricingAuth = defaultAuth
) {
  const user = await auth.getUser();
  if (!user) throw new Error('pricing_unauthorized');
  if (!(await hasRole(user.id, ROLES.SUPER_ADMIN)))
    throw new Error('pricing_forbidden');
}

async function readState() {
  const rows = await db()
    .select()
    .from(config)
    .where(
      inArray(config.name, [
        WAN_VIDEO_RATE_CONFIG_KEY,
        ...WAN_PRICE_FIELDS.map(({ name }) => name),
      ])
    );
  const values = Object.fromEntries(
    rows.map((row: { name: string; value: string | null }) => [
      row.name,
      row.value ?? '',
    ])
  );
  const row = rows.find(
    (row: { name: string }) => row.name === WAN_VIDEO_RATE_CONFIG_KEY
  ) as { value: string } | undefined;
  const legacy = Object.fromEntries(
    WAN_PRICE_FIELDS.map(({ name }) => [
      name,
      values[name] ?? WAN_DEFAULT_PRICE_CONFIG[name],
    ])
  );
  const stored = row
    ? parseWanVideoRateConfig(row.value ?? '')
    : {
        revision: `legacy-${hash(legacy)}`,
        rates: validateWanVideoRates(legacy),
      };
  const overrides: Record<string, string> = {};
  for (const { name } of WAN_PRICE_FIELDS) {
    const value = process.env[name.toUpperCase()] ?? process.env[name];
    // Match the established runtime: empty environment values do not override DB.
    if (value?.trim()) overrides[name] = value.trim();
  }
  const view = (
    revision: string,
    rates: Record<string, string>
  ): WanVideoPricing => ({
    revision: `${revision}-${hash(overrides).slice(0, 12)}`,
    rates: validateWanVideoRates({ ...rates, ...overrides }),
    overrides,
  });
  return { row, stored, view, current: view(stored.revision, stored.rates) };
}

/** Fresh, safe values only; no shared config cache and no provider credentials. */
export async function getWanVideoPricing(): Promise<WanVideoPricing> {
  return (await readState()).current;
}

export async function saveWanVideoPricing(
  input: unknown,
  auth: VideoPricingAuth = defaultAuth
): Promise<WanVideoPricing> {
  await requireVideoPricingAdmin(auth);
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('pricing_invalid');
  const { expectedRevision, rates: draft } = input as Record<string, unknown>;
  if (
    typeof expectedRevision !== 'string' ||
    !/^[A-Za-z0-9-]{1,100}$/.test(expectedRevision)
  )
    throw new Error('pricing_invalid');
  const rates = validateWanVideoRates(draft);
  const state = await readState();
  if (expectedRevision !== state.current.revision)
    throw new Error('pricing_conflict');
  for (const [key, override] of Object.entries(state.current.overrides)) {
    if (rates[key] !== override)
      throw new Error('pricing_environment_override');
    // Saving another field must not copy temporary environment overrides into DB.
    rates[key] = state.stored.rates[key];
  }
  const revision = getUuid();
  const value = JSON.stringify({ version: 1, revision, rates });
  if (state.row) {
    const query = db()
      .update(config)
      .set({ value })
      .where(
        and(
          eq(config.name, WAN_VIDEO_RATE_CONFIG_KEY),
          eq(config.value, state.row.value)
        )
      );
    const changed =
      envConfigs.database_provider === 'mysql'
        ? (await query)[0]?.affectedRows === 1
        : (await query.returning()).length === 1;
    if (!changed) throw new Error('pricing_conflict');
  } else {
    try {
      await db()
        .insert(config)
        .values({ name: WAN_VIDEO_RATE_CONFIG_KEY, value });
    } catch (error: any) {
      const code = String(error?.code || error?.cause?.code || '');
      const message = String(error?.cause?.message || error?.message || '');
      if (
        /23505|ER_DUP_ENTRY|SQLITE_CONSTRAINT/.test(code) ||
        /UNIQUE constraint failed|Duplicate entry/.test(message)
      )
        throw new Error('pricing_conflict');
      throw error;
    }
  }
  return state.view(revision, rates);
}

export function createVideoPricingHandler(
  method: 'GET' | 'POST',
  auth: VideoPricingAuth = defaultAuth
) {
  const reply = (body: unknown, status = 200) =>
    Response.json(body, {
      status,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  return async (request: Request) => {
    const origin = request.headers.get('origin');
    if (method === 'POST' && origin && origin !== new URL(request.url).origin)
      return reply({ code: -1, message: 'pricing_forbidden' }, 403);
    try {
      await requireVideoPricingAdmin(auth);
      if (method === 'GET')
        return reply({ code: 0, data: await getWanVideoPricing() });
      const raw = await request.text();
      if (raw.length > 16000) throw new Error('pricing_invalid');
      return reply({
        code: 0,
        data: await saveWanVideoPricing(JSON.parse(raw), auth),
      });
    } catch (error) {
      if (error instanceof WanVideoRateValidationError)
        return reply(
          {
            code: -1,
            message: 'pricing_invalid',
            fieldErrors: error.fieldErrors,
          },
          400
        );
      const code =
        error instanceof SyntaxError
          ? 'pricing_invalid'
          : error instanceof Error
            ? error.message
            : '';
      const statuses: Record<string, number> = {
        pricing_unauthorized: 401,
        pricing_forbidden: 403,
        pricing_invalid: 400,
        pricing_conflict: 409,
        pricing_environment_override: 409,
      };
      return statuses[code]
        ? reply({ code: -1, message: code }, statuses[code])
        : reply({ code: -1, message: 'pricing_unavailable' }, 503);
    }
  };
}
