import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getTaskHistoryQuery,
  getWanTaskHistoryItem,
  loadWanTaskHistory,
} from './task-history';

const task = {
  id: 'wan-task',
  userId: 'owner',
  prompt: 'Ocean wave',
  provider: 'polaris',
  model: 'wan3.0-video',
  status: 'success',
  costCredits: 14,
  createdAt: new Date('2026-09-25T00:00:00Z'),
  options: JSON.stringify({ version: '3.0', resolution: '1080P', duration: 8 }),
  taskInfo: JSON.stringify({
    status: 'success',
    videos: [{ videoUrl: 'https://cdn.example/video.mp4' }],
    rawSecret: 'never-forward',
  }),
} as any;

test('Wan task history exposes only safe product fields and media URLs', () => {
  const item = getWanTaskHistoryItem(task);
  assert.deepEqual(item, {
    id: 'wan-task',
    prompt: 'Ocean wave',
    model: 'wan3.0-video',
    status: 'success',
    costCredits: 14,
    createdAt: new Date('2026-09-25T00:00:00Z'),
    version: '3.0',
    resolution: '1080P',
    duration: 8,
    videoUrl: 'https://cdn.example/video.mp4',
    errorCode: undefined,
  });
  assert.equal(JSON.stringify(item).includes('never-forward'), false);
});

test('task history query bounds pagination and always scopes the repository by owner', async () => {
  assert.deepEqual(getTaskHistoryQuery({ page: '-2', pageSize: '9999' }), {
    page: 1,
    limit: 50,
  });
  const seen: any[] = [];
  const result = await loadWanTaskHistory(
    'owner',
    { page: '2', pageSize: '10' },
    {
      getTasks: async (query) => {
        seen.push(query);
        return [task, { ...task, id: 'kie-task', provider: 'kie-wan' }];
      },
      getCount: async (query) => {
        seen.push(query);
        return 2;
      },
    }
  );
  assert.deepEqual(seen, [
    {
      userId: 'owner',
      provider: ['polaris', 'kie-wan'],
      mediaType: 'video',
      page: 2,
      limit: 10,
    },
    { userId: 'owner', provider: ['polaris', 'kie-wan'], mediaType: 'video' },
  ]);
  assert.equal(result.tasks.length, 2);
  assert.equal(result.total, 2);
  assert.equal(result.tasks[1].id, 'kie-task');
});

test('unsafe video URLs and provider error payloads are reduced to safe summaries', () => {
  const item = getWanTaskHistoryItem({
    ...task,
    status: 'failed',
    taskInfo: JSON.stringify({
      errorCode: 'generation_rejected',
      videoUrl: 'javascript:alert(1)',
      providerBody: 'secret',
    }),
  });
  assert.equal(item.videoUrl, undefined);
  assert.equal(item.errorCode, 'generation_rejected');
  assert.equal(JSON.stringify(item).includes('providerBody'), false);
});

test('generation labels distinguish reference sources and frames without exposing source URLs or receipts', () => {
  for (const [mode, types, expected] of [
    ['text', [], 'text'],
    ['image', ['first_frame'], 'image'],
    ['image', ['first_frame', 'last_frame'], 'first-last'],
    ['reference', ['reference_image'], 'reference-image'],
    ['reference', ['reference_video'], 'reference-video'],
    ['reference', ['reference_image', 'reference_video'], 'reference-mixed'],
  ] as const) {
    const item = getWanTaskHistoryItem({
      ...task,
      options: JSON.stringify({
        mode,
        tier: 'prime',
        media: types.map((type) => ({
          type,
          url: 'https://private-source.example/file',
        })),
        referenceVideos: [{ token: 'secret-receipt' }],
      }),
    });
    assert.equal(item.generationType, expected);
    assert.equal(item.tier, 'prime');
    assert.doesNotMatch(JSON.stringify(item), /private-source|secret-receipt/);
  }
  assert.equal(
    getWanTaskHistoryItem({ ...task, options: '{}' }).generationType,
    undefined
  );
});
