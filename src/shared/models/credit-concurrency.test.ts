import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { createClient } from '@libsql/client';
import { SQL } from 'drizzle-orm';
import { getTableConfig, SQLiteSyncDialect } from 'drizzle-orm/sqlite-core';

import * as schema from '@/config/db/schema.sqlite';
import { removeTestDatabaseDirectory } from '@/shared/test/cleanup';

let temp = '';
let client: ReturnType<typeof createClient>;
let createAITask: typeof import('./ai_task').createAITask;

before(async () => {
  temp = await mkdtemp(join(tmpdir(), 'wan-lite-credit-'));
  process.env.DATABASE_URL = `file:${join(temp, 'test.db')}`;
  process.env.DATABASE_PROVIDER = 'sqlite';
  process.env.DB_SINGLETON_ENABLED = 'true';
  client = createClient({ url: process.env.DATABASE_URL });
  const dialect = new SQLiteSyncDialect();
  for (const table of [schema.user, schema.credit, schema.aiTask]) {
    const definition = getTableConfig(table);
    const columns = definition.columns.map((column) => {
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
      `CREATE TABLE "${definition.name}" (${columns.join(', ')})`
    );
  }
  await client.execute(
    "INSERT INTO user(id,name,email) VALUES('owner','Owner','owner@example.invalid')"
  );
  await client.execute(
    "INSERT INTO credit(id,user_id,transaction_no,transaction_type,credits,remaining_credits,status) VALUES('grant','owner','grant','grant',100,100,'active')"
  );
  ({ createAITask } = await import('./ai_task'));
});

after(async () => {
  const { closeDb } = await import('@/core/db');
  await closeDb();
  client?.close();
  if (temp) await removeTestDatabaseDirectory(temp);
});

test('concurrent task charges cannot overspend and createAITask has no trial-credit parameter', async () => {
  assert.equal(createAITask.length, 1);
  const makeTask = (id: string) =>
    createAITask({
      id,
      userId: 'owner',
      mediaType: 'video',
      provider: 'polaris',
      model: 'wan3.0-video',
      prompt: 'test',
      status: 'processing',
      scene: 'text-to-video',
      costCredits: 60,
    });
  const results = await Promise.allSettled([
    makeTask('task-a'),
    makeTask('task-b'),
  ]);
  assert.equal(
    results.filter((result) => result.status === 'fulfilled').length,
    1
  );
  const balance = await client.execute(
    "SELECT remaining_credits FROM credit WHERE id='grant'"
  );
  assert.equal(Number(balance.rows[0].remaining_credits), 40);
  assert.equal(
    (await client.execute('SELECT COUNT(*) AS n FROM ai_task')).rows[0].n,
    1
  );
});
