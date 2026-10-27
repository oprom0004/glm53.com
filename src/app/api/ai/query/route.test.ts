import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { runInThisContext } from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);

function queryFixture(owner = 'owner', provider = 'polaris') {
  let task: any = {
    id: 'wan-task',
    userId: owner,
    provider,
    status: 'processing',
    taskId: provider === 'polaris' ? null : 'upstream-task',
    taskInfo: null,
    taskResult: null,
    creditId: 'consumption',
  };
  const calls: string[] = [];
  const dependencies: Record<string, unknown> = {
    '@/shared/lib/resp': {
      respData: (data: unknown) => Response.json({ code: 0, data }),
      respErr: (message: string) => Response.json({ code: -1, message }),
    },
    '@/shared/models/user': { getUserInfo: async () => ({ id: 'owner' }) },
    '@/shared/models/ai_task': {
      findAITaskById: async () => ({ ...task }),
      updateAITaskById: async (_id: string, changes: object) => {
        calls.push('update');
        task = { ...task, ...changes };
        return task;
      },
    },
    '@/shared/services/wan-video': {
      refreshWanVideo: async (userId: string, taskId: string) => {
        assert.equal(userId, 'owner');
        assert.equal(taskId, task.id);
        calls.push('wan');
        task = { ...task, taskResult: '{"phase":"submission_unknown"}' };
      },
    },
    '@/shared/services/ai': {
      getAIService: async () => {
        calls.push('generic');
        return {
          getProvider: () => ({
            query: async () => ({ taskStatus: 'failed' }),
          }),
        };
      },
    },
  };
  const code = ts.transpileModule(
    readFileSync(new URL('./route.ts', import.meta.url), 'utf8'),
    {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }
  ).outputText;
  const module = { exports: {} as any };
  runInThisContext(`(function(require,module,exports){${code}\n})`)(
    (id: string) => dependencies[id] ?? require(id),
    module,
    module.exports
  );
  return {
    calls,
    request: async () =>
      (
        await module.exports.POST(
          new Request('http://localhost/api/ai/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId: task.id }),
          })
        )
      ).json(),
  };
}

test('legacy query recovers an owned Wan task even when the upstream submission ID is missing', async () => {
  const fixture = queryFixture();
  const result = await fixture.request();
  assert.equal(result.code, 0);
  assert.equal(JSON.parse(result.data.taskResult).phase, 'submission_unknown');
  assert.deepEqual(fixture.calls, ['wan']);
});

test('legacy query rejects another owner before either provider is called', async () => {
  const fixture = queryFixture('another-user');
  assert.equal((await fixture.request()).code, -1);
  assert.deepEqual(fixture.calls, []);
});

test('generic query still persists a terminal status when taskInfo has not changed', async () => {
  const fixture = queryFixture('owner', 'replicate');
  const result = await fixture.request();
  assert.equal(result.data.status, 'failed');
  assert.deepEqual(fixture.calls, ['generic', 'update']);
});

test('Kie Wan queries use the protected Wan recovery flow instead of the generic Kie adapter', async () => {
  const fixture = queryFixture('owner', 'kie-wan');
  assert.equal((await fixture.request()).code, 0);
  assert.deepEqual(fixture.calls, ['wan']);
});
