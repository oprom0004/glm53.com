import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { SQL } from 'drizzle-orm';
import { getTableConfig, SQLiteSyncDialect } from 'drizzle-orm/sqlite-core';

import * as schema from '@/config/db/schema.sqlite';

import { removeTestDatabaseDirectory } from './cleanup';

export type PaymentDbFixture = {
  client: ReturnType<typeof createClient>;
  reset(): Promise<void>;
  close(): Promise<void>;
};
export async function createPaymentDb(): Promise<PaymentDbFixture> {
  const temp = await mkdtemp(join(tmpdir(), 'wan-payment-options-'));
  process.env.DATABASE_URL = `file:${join(temp, 'test.db')}`;
  process.env.DATABASE_PROVIDER = 'sqlite';
  process.env.DB_SINGLETON_ENABLED = 'true';
  const client = createClient({ url: process.env.DATABASE_URL });
  const dialect = new SQLiteSyncDialect();
  for (const table of [
    schema.user,
    schema.order,
    schema.subscription,
    schema.credit,
    schema.aiTask,
    schema.config,
    schema.role,
    schema.userRole,
  ]) {
    const config = getTableConfig(table);
    const columns = config.columns.map((column) => {
      const value = column.default;
      const defaultSql =
        value instanceof SQL
          ? dialect.sqlToQuery(value).sql
          : value === undefined
            ? undefined
            : typeof value === 'string'
              ? `'${value.replaceAll("'", "''")}'`
              : String(value);
      return `"${column.name}" ${column.getSQLType()}${column.primary ? ' PRIMARY KEY' : ''}${column.isUnique ? ' UNIQUE' : ''}${column.notNull ? ' NOT NULL' : ''}${defaultSql === undefined ? '' : ` DEFAULT (${defaultSql})`}`;
    });
    await client.execute(
      `CREATE TABLE "${config.name}" (${columns.join(', ')})`
    );
  }
  return {
    client,
    async reset() {
      await client.batch([
        'DELETE FROM user_role',
        'DELETE FROM role',
        'DELETE FROM ai_task',
        'DELETE FROM credit',
        'DELETE FROM "order"',
        'DELETE FROM subscription',
        'DELETE FROM config',
        'DELETE FROM user',
      ]);
      for (const id of ['owner', 'other'])
        await client.execute({
          sql: 'INSERT INTO user (id,name,email) VALUES (?,?,?)',
          args: [id, id, `${id}@example.invalid`],
        });
    },
    async close() {
      const { closeDb } = await import('@/core/db');
      await closeDb();
      client.close();
      await removeTestDatabaseDirectory(temp);
    },
  };
}
