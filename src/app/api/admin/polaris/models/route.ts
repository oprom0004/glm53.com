import { inArray } from 'drizzle-orm';

import { config } from '@/config/db/schema';
import { db } from '@/core/db';
import { PERMISSIONS } from '@/core/rbac';
import { getUserInfo } from '@/shared/models/user';
import { readPolarisModelsForAdmin } from '@/shared/services/polaris-model-check';
import { hasAllPermissions } from '@/shared/services/rbac';

export const runtime = 'nodejs';

export async function GET() {
  const result = await readPolarisModelsForAdmin({
    getUser: getUserInfo,
    canManageSettings: (userId) =>
      hasAllPermissions(userId, [
        PERMISSIONS.SETTINGS_READ,
        PERMISSIONS.SETTINGS_WRITE,
      ]),
    getConfigs: async () => {
      const names = ['polaris_api_key', 'polaris_base_url'];
      const rows = await db()
        .select()
        .from(config)
        .where(inArray(config.name, names));

      return Object.fromEntries(
        names.map((name) => [
          name,
          process.env[name.toUpperCase()] ||
            process.env[name] ||
            rows.find(
              (row: { name: string; value: string | null }) => row.name === name
            )?.value ||
            '',
        ])
      );
    },
  });

  const { status, ...body } = result;
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' },
  });
}
