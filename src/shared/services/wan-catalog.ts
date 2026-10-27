import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/core/db';
import { envConfigs } from '@/config';
import { config } from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';
import {
  parseWanCatalog,
  validateWanCatalogDraft,
  WAN_CATALOG_CONFIG_KEY,
  type WanCatalog,
} from '@/shared/lib/wan-product-catalog';
import { getUserInfo } from '@/shared/models/user';

import { hasRole, ROLES } from './rbac';

async function readRow(database = db()) {
  const [row] = await database
    .select()
    .from(config)
    .where(eq(config.name, WAN_CATALOG_CONFIG_KEY))
    .limit(1);
  return row as { name: string; value: string | null } | undefined;
}

/** Financial configuration must never use the shared stale-while-revalidate cache. */
export async function getWanCatalog(): Promise<WanCatalog> {
  const row = await readRow();
  // A null stored value is corrupt, unlike a missing row.
  return parseWanCatalog(row ? (row.value ?? '') : undefined);
}

export type WanCatalogAuth = {
  getUser(): Promise<{ id: string } | null | undefined>;
};
const defaultAuth: WanCatalogAuth = { getUser: getUserInfo };

export async function saveWanCatalog(
  input: unknown,
  auth: WanCatalogAuth = defaultAuth
): Promise<WanCatalog> {
  const user = await auth.getUser();
  if (!user) throw new Error('pricing_unauthorized');
  if (!(await hasRole(user.id, ROLES.SUPER_ADMIN)))
    throw new Error('pricing_forbidden');
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('pricing_invalid');
  const { expectedRevision, products: draft } = input as Record<
    string,
    unknown
  >;
  if (
    typeof expectedRevision !== 'string' ||
    !/^[A-Za-z0-9-]{1,100}$/.test(expectedRevision)
  )
    throw new Error('pricing_invalid');
  const products = validateWanCatalogDraft(draft);
  const row = await readRow();
  const current = parseWanCatalog(row ? (row.value ?? '') : undefined);
  if (current.revision !== expectedRevision)
    throw new Error('pricing_conflict');
  const value = JSON.stringify({ version: 1, revision: getUuid(), products });
  if (row) {
    const query = db()
      .update(config)
      .set({ value })
      .where(
        and(
          eq(config.name, WAN_CATALOG_CONFIG_KEY),
          row.value === null
            ? isNull(config.value)
            : eq(config.value, row.value)
        )
      );
    // The app's MySQL returning() compatibility shim returns the input payload
    // even when no rows match. Use actual affectedRows for this CAS boundary.
    const changed =
      envConfigs.database_provider === 'mysql'
        ? (await query)[0]?.affectedRows === 1
        : (await query.returning()).length === 1;
    if (!changed) throw new Error('pricing_conflict');
  } else {
    try {
      // Unique config.name makes simultaneous first saves mutually exclusive.
      await db().insert(config).values({ name: WAN_CATALOG_CONFIG_KEY, value });
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
  return parseWanCatalog(value);
}

export type WanCatalogQuote = {
  revision: string | null;
  expectedRevision?: unknown;
};

/** Only called immediately before reserving a NEW payable order. */
export async function assertWanCatalogRevision(
  tx: any,
  quote: WanCatalogQuote
) {
  // An unreadable quote may still recover an existing immutable order, but
  // must never turn the canonical fallback into a newly payable default price.
  if (quote.revision === null) throw new Error('pricing_unavailable');
  const [row] = await tx
    .select()
    .from(config)
    .where(eq(config.name, WAN_CATALOG_CONFIG_KEY))
    .for('update');
  const current = parseWanCatalog(row ? (row.value ?? '') : undefined);
  // Legacy clients are accepted only while the original catalog is unchanged.
  const expected =
    quote.expectedRevision === undefined
      ? 'default-v1'
      : quote.expectedRevision;
  if (current.revision !== quote.revision || expected !== current.revision)
    throw new Error('pricing_changed');
}
