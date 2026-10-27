import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getAIManagerWithConfigs } from '@/shared/services/ai';
import { checkPolarisModels } from '@/shared/services/polaris-model-check';
import { normalizePolarisSettings } from '@/shared/services/polaris-settings';

import { PolarisVideoProvider } from './polaris-video';
import { AIMediaType } from './types';

test('Wan compatible gateway uses its configured URL and model alias for generate, query and model discovery', async () => {
  const configs = normalizePolarisSettings({
    polaris_api_key: 'gateway-key',
    polaris_base_url: ' https://gateway.example.com/wan/ ',
    polaris_wan26_text_model: 'vendor/wan-2.6',
  });
  const calls: string[] = [];
  const provider = new PolarisVideoProvider(
    { apiKey: configs.polaris_api_key, baseUrl: configs.polaris_base_url },
    async (url, options) => {
      calls.push(String(url));
      assert.equal(
        new Headers(options?.headers).get('Authorization'),
        'Bearer gateway-key'
      );
      if (options?.method === 'POST') {
        assert.equal(
          JSON.parse(options.body as string).model,
          'vendor/wan-2.6'
        );
        return Response.json({ id: 'video_custom', model: 'vendor/wan-2.6' });
      }
      return Response.json({
        id: 'video_custom',
        model: 'vendor/wan-2.6',
        status: 'completed',
        video_url: 'https://cdn.example.com/a.mp4',
      });
    }
  );
  const result = await provider.generate({
    model: 'wan2.6-t2v',
    providerModel: configs.polaris_wan26_text_model,
    prompt: 'A lake',
    duration: 5,
    resolution: '720P',
    ratio: 'adaptive',
  });
  assert.equal(result.taskId, 'video_custom');
  assert.equal(
    (await provider.query(result.taskId, 'wan2.6-t2v', 'vendor/wan-2.6')).state,
    'succeeded'
  );
  assert.deepEqual(calls, [
    'https://gateway.example.com/wan/v1/videos',
    'https://gateway.example.com/wan/v1/videos/video_custom',
  ]);
  assert.deepEqual(
    await checkPolarisModels(configs, async (url) => {
      assert.equal(url, 'https://gateway.example.com/wan/v1/models');
      return Response.json({
        data: [{ id: 'vendor/wan-2.6' }, { id: '<unsafe>' }],
      });
    }),
    ['vendor/wan-2.6']
  );
});

test('Studio provider configurations reach each adapter and its actual request URL', async (t) => {
  const calls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: unknown) => {
    calls.push(String(url));
    return new Response('{}', { status: 401 });
  });
  const ai = getAIManagerWithConfigs({
    kie_api_key: 'kie-test',
    kie_base_url: 'https://gateway.example.com/kie/api/v1/',
    fal_api_key: 'fal-test',
    fal_base_url: 'https://gateway.example.com/fal/',
    gemini_api_key: 'gemini-test',
    gemini_base_url: 'https://gateway.example.com/gemini/v1beta/',
    replicate_api_token: 'replicate-test',
    replicate_base_url: 'https://gateway.example.com/replicate/v1/',
  });
  for (const [name, model] of [
    ['kie', 'test-model'],
    ['fal', 'fal-ai/test'],
    ['gemini', 'gemini-test'],
    ['replicate', 'owner/model'],
  ]) {
    await assert.rejects(
      ai.getProvider(name)!.generate({
        params: { mediaType: AIMediaType.IMAGE, model, prompt: 'A lake' },
      })
    );
  }
  assert.deepEqual(
    calls.map((url) => new URL(url).origin),
    Array(4).fill('https://gateway.example.com')
  );
  assert.ok(calls[0].startsWith('https://gateway.example.com/kie/api/v1/'));
  assert.ok(calls[1].startsWith('https://gateway.example.com/fal/'));
  assert.equal(
    calls[2],
    'https://gateway.example.com/gemini/v1beta/models/gemini-test:generateContent'
  );
  assert.ok(calls[3].startsWith('https://gateway.example.com/replicate/v1/'));
});

test('Wan 2 accepts flat and wrapped query responses independently of task ID prefix', async () => {
  for (const taskId of ['task_custom', 'video_custom']) {
    for (const wrapped of [false, true]) {
      let requests = 0;
      const provider = new PolarisVideoProvider(
        { apiKey: 'fixture-key', baseUrl: 'https://gateway.example.com/v1' },
        async (url) => {
          requests++;
          assert.equal(url, `https://gateway.example.com/v1/videos/${taskId}`);
          return Response.json(
            wrapped
              ? {
                  code: 'success',
                  data: {
                    task_id: taskId,
                    status: 'SUCCESS',
                    result_url: 'https://cdn.example.com/video.mp4',
                  },
                }
              : {
                  id: taskId,
                  model: 'vendor/wan2.6',
                  status: 'completed',
                  video_url: 'https://cdn.example.com/video.mp4',
                }
          );
        }
      );
      assert.deepEqual(
        await provider.query(taskId, 'wan2.6-t2v', 'vendor/wan2.6'),
        {
          state: 'succeeded',
          videoUrl: 'https://cdn.example.com/video.mp4',
        }
      );
      assert.equal(requests, 1);
    }
  }
});
