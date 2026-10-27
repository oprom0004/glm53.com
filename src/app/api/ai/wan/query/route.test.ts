import assert from 'node:assert/strict';
import { test } from 'node:test';

import { handleWanApi } from '@/shared/services/wan-video-api';

function json(body: unknown) {
  return new Request('https://wan.example/api/ai/wan/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('query accepts only a task id and delegates within the authenticated user', async () => {
  let calls = 0;
  const response = await handleWanApi(
    'query',
    json({ taskId: `wan-${'a'.repeat(64)}` }),
    {
      getUser: async () => ({ id: 'user-1' }),
      getConfigs: async () => ({}),
      refresh: async (userId, taskId) => {
        calls++;
        assert.equal(userId, 'user-1');
        assert.equal(taskId, `wan-${'a'.repeat(64)}`);
        return {
          id: taskId,
          status: 'success' as const,
          phase: 'success' as const,
          costCredits: 25,
          videoUrl: 'https://media.example/video.mp4',
        };
      },
    }
  );
  assert.equal(calls, 1);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.phase, 'success');
});

test('query rejects malformed input and hides cross-user tasks as not found', async () => {
  const malformed = await handleWanApi('query', json({ taskId: 1 }), {
    getUser: async () => ({ id: 'user-1' }),
    getConfigs: async () => ({}),
  });
  assert.equal(malformed.status, 400);

  const hidden = await handleWanApi(
    'query',
    json({ taskId: `wan-${'a'.repeat(64)}` }),
    {
      getUser: async () => ({ id: 'user-1' }),
      getConfigs: async () => ({}),
      refresh: async () => {
        throw new Error('task_not_found');
      },
    }
  );
  assert.equal(hidden.status, 404);
  assert.equal((await hidden.json()).message, 'task_not_found');
});
