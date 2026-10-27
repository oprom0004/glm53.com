import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, beforeEach, test } from 'node:test';
import { createClient } from '@libsql/client';
import { SQL } from 'drizzle-orm';
import { getTableConfig, SQLiteSyncDialect } from 'drizzle-orm/sqlite-core';

import * as schema from '@/config/db/schema.sqlite';
import { removeTestDatabaseDirectory } from '@/shared/test/cleanup';

let temp = '';
let client: ReturnType<typeof createClient>;
let service: typeof import('./wan-video');
let providerErrors: typeof import('@/extensions/ai/polaris-video');

before(async () => {
  temp = await mkdtemp(join(tmpdir(), 'wan-lite-video-'));
  process.env.DATABASE_URL = `file:${join(temp, 'test.db')}`;
  process.env.DATABASE_PROVIDER = 'sqlite';
  process.env.DB_SINGLETON_ENABLED = 'true';
  client = createClient({ url: process.env.DATABASE_URL });
  const dialect = new SQLiteSyncDialect();
  for (const table of [
    schema.user,
    schema.credit,
    schema.aiTask,
    schema.config,
  ]) {
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
  service = await import('./wan-video');
  providerErrors = await import('@/extensions/ai/polaris-video');
});

beforeEach(async () => {
  await client.batch([
    'DELETE FROM ai_task',
    'DELETE FROM credit',
    'DELETE FROM user',
  ]);
  await client.execute(
    "INSERT INTO user(id,name,email) VALUES('owner','Owner','owner@example.invalid'),('other','Other','other@example.invalid')"
  );
  await client.execute(
    "INSERT INTO credit(id,user_id,transaction_no,transaction_type,credits,remaining_credits,status) VALUES('grant','owner','grant-1','grant',100,100,'active')"
  );
});

after(async () => {
  const { closeDb } = await import('@/core/db');
  await closeDb();
  client?.close();
  if (temp) await removeTestDatabaseDirectory(temp);
});

const request = {
  requestId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  quoteVersion: 'wan-pricing-v1',
  version: '3.0',
  tier: 'prime',
  mode: 'text',
  prompt: 'A cinematic ocean wave',
  duration: 5,
  resolution: '720P',
  ratio: '16:9',
  media: [],
  expectedCredits: 15,
};
const configs = {
  polaris_api_key: 'fixture-key',
  polaris_wan30_prime_model: 'wan3.0-video-prime',
  polaris_wan30_prime_720p_credits_per_second: '3',
  r2_bucket_name: 'test-bucket',
  r2_account_id: '0123456789abcdef0123456789abcdef',
  r2_domain: 'https://media.wanai30.com',
  r2_access_key: 'test-id',
  r2_secret_key: 'test-secret',
};

let submits = 0;
let queries = 0;
let saves = 0;
let clock = 1_790_000_000_000;

function deps() {
  submits = queries = saves = 0;
  clock = 1_790_000_000_000;
  return {
    configs,
    now: () => clock,
    provider: {
      generate: async () => {
        submits++;
        return { taskId: 'task_gateway123' };
      },
      query: async () => {
        queries++;
        return {
          state: 'succeeded' as const,
          videoUrl:
            'https://provider.oss-cn-shanghai.aliyuncs.com/result.mp4?signature=temporary',
        };
      },
    },
    storage: {
      validateInputUrl: () => true,
      saveVideo: async () => {
        saves++;
        return 'https://media.example.invalid/wan-videos/result.mp4';
      },
    },
  };
}

async function balance() {
  return Number(
    (
      await client.execute(
        "SELECT remaining_credits FROM credit WHERE id='grant'"
      )
    ).rows[0].remaining_credits
  );
}

test('background recovery finds due tasks behind a full page of backoff tasks without charging again', async () => {
  const injected = deps();
  const submitted = await service.submitWanVideo('owner', request, injected);
  const { findAITaskById } = await import('@/shared/models/ai_task');
  const { db } = await import('@/core/db');
  const original = (await findAITaskById(submitted.id))!;
  const state = JSON.parse(original.taskResult!);
  await db()
    .insert(schema.aiTask)
    .values(
      Array.from({ length: 50 }, (_, index) => ({
        ...original,
        id: `waiting-${String(index).padStart(3, '0')}`,
        updatedAt: new Date(0),
        taskResult: JSON.stringify({ ...state, nextPollAt: clock + 1_000_000 }),
      }))
    );
  clock += 61_000;
  const result = await service.sweepWanVideos(injected, { maxTasks: 1 });
  assert.deepEqual(result, { scanned: 51, processed: 1, failed: 0 });
  assert.equal((await findAITaskById(submitted.id))?.status, 'success');
  assert.equal(submits, 1);
  assert.equal(queries, 1);
  assert.equal(saves, 1);
  assert.equal(await balance(), 85);
});

test('background recovery reports storage failures and later retries the saved output without re-generation', async () => {
  const injected = deps();
  const submitted = await service.submitWanVideo('owner', request, injected);
  clock += 61_000;
  const save = injected.storage.saveVideo;
  injected.storage.saveVideo = async () => {
    throw new Error('storage outage');
  };
  assert.equal(
    (await service.sweepWanVideos(injected, { maxTasks: 1 })).failed,
    1
  );
  clock += 121_000;
  injected.storage.saveVideo = save;
  assert.equal(
    (await service.sweepWanVideos(injected, { maxTasks: 1 })).failed,
    0
  );
  const { findAITaskById } = await import('@/shared/models/ai_task');
  assert.equal((await findAITaskById(submitted.id))?.status, 'success');
  assert.equal(submits, 1);
  assert.equal(queries, 1);
  assert.equal(await balance(), 85);
});

test('reference video charges verified input duration and rejects altered price before billing', async () => {
  const originalSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = 'reference-video-ledger-test-key-32-characters';
  try {
    const { signReferenceVideo } = await import('./wan-reference-video');
    const base = deps();
    const url = 'https://media.example.com/clip.mp4';
    const injected = {
      ...base,
      configs: { ...configs, wan30_provider: 'kie', kie_api_key: 'fixture' },
      provider: {
        generate: async (value: { referenceVideoDuration?: number }) => {
          submits++;
          assert.equal(value.referenceVideoDuration, 2);
          return { taskId: 'reference-video-task' };
        },
        query: async () => {
          queries++;
          return { state: 'failed' as const };
        },
      },
    };
    const value = {
      ...request,
      mode: 'reference',
      referenceVideos: [{ url, token: signReferenceVideo('owner', url, 2000) }],
      media: [{ type: 'reference_video', url }],
      expectedCredits: 21,
    };
    await assert.rejects(
      service.submitWanVideo(
        'owner',
        { ...value, expectedCredits: 15 },
        injected
      ),
      /price_changed/
    );
    assert.equal(await balance(), 100);
    assert.equal(submits, 0);
    const task = await service.submitWanVideo('owner', value, injected);
    assert.equal(task.costCredits, 21);
    assert.equal(await balance(), 79);
    await service.submitWanVideo('owner', value, injected);
    assert.equal(submits, 1);
    clock += 60_000;
    await service.refreshWanVideo('owner', task.id, injected);
    await service.refreshWanVideo('owner', task.id, injected);
    assert.equal(await balance(), 100);
    assert.equal(queries, 1);
  } finally {
    if (originalSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = originalSecret;
  }
});

for (const mode of ['image', 'reference'] as const) {
  test(`Kie ${mode} task failure after submission refunds once and preserves media`, async () => {
    const base = deps();
    const media = [
      {
        type: mode === 'image' ? 'first_frame' : 'reference_image',
        url: 'https://media.wanai30.com/input.png',
      },
    ];
    const injected = {
      ...base,
      configs: {
        ...configs,
        wan30_provider: 'kie',
        kie_api_key: 'kie-fixture',
      },
      provider: {
        generate: async (input: {
          media?: unknown;
          providerModel?: string;
        }) => {
          submits++;
          assert.deepEqual(input.media, media);
          assert.equal(input.providerModel, 'wan/3-0-video-prime');
          return { taskId: 'kie-image-task' };
        },
        query: async () => {
          queries++;
          return { state: 'failed' as const };
        },
      },
    };
    const value = { ...request, mode, media };
    const task = await service.submitWanVideo('owner', value, injected);
    assert.equal(await balance(), 85);
    clock += 60_000;
    assert.equal(
      (await service.refreshWanVideo('owner', task.id, injected)).status,
      'failed'
    );
    assert.equal(await balance(), 100);
    await service.refreshWanVideo('owner', task.id, injected);
    await service.submitWanVideo('owner', value, injected);
    assert.equal(await balance(), 100);
    assert.equal(submits, 1);
    assert.equal(queries, 1);
    assert.equal(saves, 0);
  });
}

test('a paid task keeps its model mapping and refuses to poll a different gateway', async () => {
  const base = deps();
  const taskConfigs = {
    ...configs,
    polaris_base_url: 'https://gateway.example.com',
    polaris_wan30_prime_model: 'vendor/wan-prime',
  };
  let queryModel = '';
  const injected = {
    ...base,
    configs: taskConfigs,
    provider: {
      generate: async (input: { providerModel?: string }) => {
        assert.equal(input.providerModel, 'vendor/wan-prime');
        submits++;
        return { taskId: 'task_gateway123' };
      },
      query: async (_taskId: string, _model?: string, model?: string) => {
        queries++;
        queryModel = model || '';
        return { state: 'processing' as const };
      },
    },
  };
  const task = await service.submitWanVideo('owner', request, injected);
  clock += 60_000;
  const moved = await service.refreshWanVideo('owner', task.id, {
    ...injected,
    configs: {
      ...taskConfigs,
      polaris_base_url: 'https://another.example.com',
    },
  });
  assert.equal(moved.phase, 'query_error');
  assert.equal(queries, 0);
  assert.equal(await balance(), 85);
  clock += 60_000;
  await service.refreshWanVideo('owner', task.id, {
    ...injected,
    configs: { ...taskConfigs, polaris_wan30_prime_model: 'new/model' },
  });
  assert.equal(queries, 1);
  assert.equal(queryModel, 'vendor/wan-prime');
  assert.equal(submits, 1);
  assert.equal(JSON.stringify(task).includes('gateway.example.com'), false);
});

test('duplicate submissions create one durable task, charge once and call Polaris once', async () => {
  const injected = deps();
  const results = await Promise.all([
    service.submitWanVideo('owner', request, injected),
    service.submitWanVideo('owner', request, injected),
  ]);

  assert.equal(results[0].id, results[1].id);
  assert.equal(results[0].costCredits, 15);
  assert.equal(submits, 1);
  assert.equal(await balance(), 85);
  assert.equal(
    (await client.execute('SELECT COUNT(*) AS n FROM ai_task')).rows[0].n,
    1
  );
  assert.equal(
    (
      await client.execute(
        "SELECT COUNT(*) AS n FROM credit WHERE transaction_type='consume'"
      )
    ).rows[0].n,
    1
  );
});

test('insufficient credits never contact Polaris or leave a task row', async () => {
  await client.execute(
    "UPDATE credit SET remaining_credits=10 WHERE id='grant'"
  );
  const injected = deps();
  await assert.rejects(
    service.submitWanVideo('owner', request, injected),
    /insufficient_credits/
  );
  assert.equal(submits, 0);
  assert.equal(
    (await client.execute('SELECT COUNT(*) AS n FROM ai_task')).rows[0].n,
    0
  );
});

test('definite rejection refunds exactly once while unknown submission keeps the debit reserved', async () => {
  const rejected = deps();
  rejected.provider.generate = async () => {
    submits++;
    throw new providerErrors.PolarisVideoError('request_rejected', 'rejected');
  };
  const failed = await service.submitWanVideo('owner', request, rejected);
  assert.equal(failed.phase, 'failed');
  assert.equal(await balance(), 100);
  assert.equal(
    (await service.submitWanVideo('owner', request, rejected)).id,
    failed.id
  );
  assert.equal(submits, 1);
  assert.equal(await balance(), 100);

  await client.execute('DELETE FROM ai_task');
  await client.execute("DELETE FROM credit WHERE transaction_type='consume'");
  const unknown = deps();
  unknown.provider.generate = async () => {
    submits++;
    throw new providerErrors.PolarisVideoError('unavailable', 'unknown');
  };
  const pending = await service.submitWanVideo(
    'owner',
    { ...request, requestId: 'bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee' },
    unknown
  );
  assert.equal(pending.phase, 'submission_unknown');
  assert.equal(await balance(), 85);
});

test('polling saves a successful video once and denies cross-user reads', async () => {
  const injected = deps();
  const created = await service.submitWanVideo('owner', request, injected);
  clock += 20_000;
  const completed = await service.refreshWanVideo(
    'owner',
    created.id,
    injected
  );
  assert.equal(completed.phase, 'success');
  assert.equal(
    completed.videoUrl,
    'https://media.example.invalid/wan-videos/result.mp4'
  );
  assert.equal(queries, 1);
  assert.equal(saves, 1);
  await assert.rejects(
    service.refreshWanVideo('other', created.id, injected),
    /task_not_found/
  );
});

test('Kie task snapshots survive provider selection changes and complete exactly once', async () => {
  const injected = deps();
  injected.configs = {
    ...configs,
    wan30_provider: 'kie',
    kie_api_key: 'kie-fixture',
  } as typeof configs;
  const created = await service.submitWanVideo('owner', request, injected);
  const stored = (await client.execute('SELECT * FROM ai_task')).rows[0];
  assert.equal(stored.provider, 'kie-wan');
  const snapshot = JSON.parse(String(stored.task_result));
  assert.equal(snapshot.providerModel, 'wan/3-0-video-prime');
  assert.equal(snapshot.providerBaseUrl, 'https://api.kie.ai/api/v1');
  injected.configs = {
    ...injected.configs,
    wan30_provider: 'polaris',
  } as typeof configs;
  assert.equal(
    (await service.submitWanVideo('owner', request, injected)).id,
    created.id
  );
  assert.equal(submits, 1);
  clock += 20_000;
  assert.equal(
    (await service.refreshWanVideo('owner', created.id, injected)).phase,
    'success'
  );
  assert.equal(
    (await service.refreshWanVideo('owner', created.id, injected)).phase,
    'success'
  );
  assert.equal(queries, 1);
  assert.equal(saves, 1);
  assert.equal(await balance(), 85);
});

for (const version of ['2.5', '2.6', '2.7'])
  for (const mode of ['text', 'image']) {
    test(`Kie Wan ${version} ${mode} stores the model, charges once and completes after configuration changes`, async () => {
      const injected = deps();
      injected.configs = {
        ...configs,
        wan30_provider: 'kie',
        kie_api_key: 'fixture',
      } as typeof configs;
      const draft = {
        ...request,
        version,
        mode,
        tier: 'standard',
        ratio: 'adaptive',
        expectedCredits: 50,
        media:
          mode === 'image'
            ? [
                {
                  type: 'first_frame',
                  url: 'https://media.wanai30.com/first.png',
                },
              ]
            : [],
      };
      const created = await service.submitWanVideo('owner', draft, injected);
      assert.equal(
        (await service.submitWanVideo('owner', draft, injected)).id,
        created.id
      );
      const stored = (await client.execute('SELECT * FROM ai_task')).rows[0];
      const providerModel = `wan/${version.replace('.', '-')}-${mode}-to-video`;
      assert.equal(stored.provider, 'kie-wan');
      assert.equal(
        JSON.parse(String(stored.task_result)).providerModel,
        providerModel
      );
      injected.configs = {
        ...injected.configs,
        wan30_provider: 'polaris',
      } as typeof configs;
      const previousQuery = injected.provider.query;
      injected.provider.query = async (...args: any[]) => {
        assert.equal(args[2], providerModel);
        return previousQuery();
      };
      clock += 20_000;
      assert.equal(
        (await service.refreshWanVideo('owner', created.id, injected)).phase,
        'success'
      );
      await service.refreshWanVideo('owner', created.id, injected);
      assert.equal(submits, 1);
      assert.equal(queries, 1);
      assert.equal(saves, 1);
      assert.equal(await balance(), 50);
    });
  }

test('Kie definite rejection refunds once and task cannot later be overwritten', async () => {
  const injected = deps();
  injected.configs = {
    ...configs,
    wan30_provider: 'kie',
    kie_api_key: 'kie-fixture',
  } as typeof configs;
  injected.provider.generate = async () => {
    submits++;
    throw new providerErrors.PolarisVideoError('request_rejected', 'rejected');
  };
  const failed = await service.submitWanVideo('owner', request, injected);
  assert.equal(failed.phase, 'failed');
  assert.equal(await balance(), 100);
  const { updateAITaskById } = await import('@/shared/models/ai_task');
  await updateAITaskById(failed.id, { status: 'processing' });
  assert.equal(
    (await service.refreshWanVideo('owner', failed.id, injected)).phase,
    'failed'
  );
  await service.submitWanVideo('owner', request, injected);
  assert.equal(submits, 1);
  assert.equal(await balance(), 100);
});

test('Kie endpoint changes suspend polling without refund or another submission', async () => {
  const injected = deps();
  injected.configs = {
    ...configs,
    wan30_provider: 'kie',
    kie_api_key: 'kie-fixture',
  } as typeof configs;
  const created = await service.submitWanVideo('owner', request, injected);
  injected.configs = {
    ...injected.configs,
    kie_base_url: 'https://another.example.com/api/v1',
  } as typeof configs;
  clock += 20_000;
  assert.equal(
    (await service.refreshWanVideo('owner', created.id, injected)).phase,
    'query_error'
  );
  assert.equal(queries, 0);
  assert.equal(submits, 1);
  assert.equal(await balance(), 85);
});
