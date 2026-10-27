import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  PolarisVideoError,
  PolarisVideoProvider,
  type PolarisVideoInput,
} from './polaris-video';

const apiKey = 'test-private-polaris-key';
const taskId = 'task_abc123';
const wan3Input: PolarisVideoInput = {
  model: 'wan3.0-video',
  prompt: 'A paper crane crosses a rainy city.',
  duration: 5,
  resolution: '720P',
  ratio: '16:9',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

test('Wan 3 submission uses the approved endpoint, normalized key and exact payload once', async () => {
  let calls = 0;
  const provider = new PolarisVideoProvider(
    { apiKey: `  ${apiKey}\n`, baseUrl: 'https://api.polariscore.ai/' },
    async (url, options) => {
      calls++;
      assert.equal(
        url,
        'https://api.polariscore.ai/api/v1/services/aigc/video-generation/video-synthesis'
      );
      assert.equal(options?.method, 'POST');
      assert.equal(options?.redirect, 'error');
      assert.equal(options?.cache, 'no-store');
      assert.equal(
        new Headers(options?.headers).get('Authorization'),
        `Bearer ${apiKey}`
      );
      assert.deepEqual(JSON.parse(String(options?.body)), {
        model: 'wan3.0-video',
        input: { prompt: 'A paper crane crosses a rainy city.' },
        parameters: {
          resolution: '720P',
          ratio: '16:9',
          duration: 5,
          audio: true,
          prompt_extend: true,
          watermark: false,
        },
      });
      return json({ id: taskId, task_id: taskId });
    }
  );

  assert.deepEqual(await provider.generate(wan3Input), { taskId });
  assert.equal(calls, 1);
});

test('Wan 2 image submission uses the videos endpoint and only one first frame', async () => {
  const provider = new PolarisVideoProvider(
    { apiKey },
    async (url, options) => {
      assert.equal(url, 'https://api.polariscore.ai/v1/videos');
      assert.deepEqual(JSON.parse(String(options?.body)), {
        model: 'wan2.6-t2v',
        prompt: 'Ocean at dawn',
        image: 'https://media.example.com/first.png',
        duration: 15,
        metadata: { resolution: '1080p', fps: 24, n: 1 },
      });
      return json({ id: 'video_abc123', model: 'wan2.6-t2v' });
    }
  );

  assert.deepEqual(
    await provider.generate({
      model: 'wan2.6-t2v',
      prompt: 'Ocean at dawn',
      media: [
        { type: 'first_frame', url: 'https://media.example.com/first.png' },
      ],
      duration: 15,
      resolution: '1080P',
      ratio: 'adaptive',
    }),
    { taskId: 'video_abc123' }
  );
});

test('invalid input and unsafe configuration fail before HTTP and never expose secrets', async () => {
  let calls = 0;
  const request = async () => {
    calls++;
    return json({ id: taskId });
  };
  assert.throws(
    () =>
      new PolarisVideoProvider(
        { apiKey, baseUrl: 'https://127.0.0.1' },
        request
      ),
    (error) => {
      assert.ok(error instanceof PolarisVideoError);
      assert.equal(error.code, 'invalid_base_url');
      assert.equal(JSON.stringify(error).includes(apiKey), false);
      return true;
    }
  );

  const provider = new PolarisVideoProvider({ apiKey }, request);
  await assert.rejects(
    provider.generate({ ...wan3Input, duration: 31 }),
    (error) => {
      assert.ok(error instanceof PolarisVideoError);
      assert.equal(error.code, 'invalid_input');
      assert.equal(error.certainty, 'rejected');
      return true;
    }
  );
  assert.equal(calls, 0);
});

test('query normalizes processing, success and definite failure without downloading output', async () => {
  const responses = [
    {
      code: 'success',
      data: { task_id: taskId, status: 'IN_PROGRESS', data: { output: {} } },
    },
    {
      code: 'success',
      data: {
        task_id: taskId,
        status: 'SUCCESS',
        result_url: 'https://media.example.com/result.mp4',
        data: { output: { task_status: 'SUCCEEDED' } },
      },
    },
    {
      code: 'success',
      data: {
        task_id: taskId,
        status: 'FAILURE',
        data: { output: { task_status: 'FAILED' } },
      },
    },
  ];
  let index = 0;
  const provider = new PolarisVideoProvider({ apiKey }, async () =>
    json(responses[index++])
  );

  assert.deepEqual(await provider.query(taskId), { state: 'processing' });
  assert.deepEqual(await provider.query(taskId), {
    state: 'succeeded',
    videoUrl: 'https://media.example.com/result.mp4',
  });
  assert.deepEqual(await provider.query(taskId), { state: 'failed' });
});

test('HTTP and network failures return stable safe errors without retrying', async () => {
  for (const [response, code, certainty] of [
    [json({ error: apiKey }, 422), 'request_rejected', 'rejected'],
    [json({ error: apiKey }, 503), 'unavailable', 'unknown'],
  ] as const) {
    let calls = 0;
    const provider = new PolarisVideoProvider({ apiKey }, async () => {
      calls++;
      return response;
    });
    await assert.rejects(provider.generate(wan3Input), (error) => {
      assert.ok(error instanceof PolarisVideoError);
      assert.equal(error.code, code);
      assert.equal(error.certainty, certainty);
      assert.equal(String(error).includes(apiKey), false);
      return true;
    });
    assert.equal(calls, 1);
  }
});
