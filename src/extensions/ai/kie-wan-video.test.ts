import assert from 'node:assert/strict';
import test from 'node:test';

import { KieWanVideoProvider } from './kie-wan-video';
import { PolarisVideoError, type PolarisVideoInput } from './polaris-video';

const input: PolarisVideoInput = {
  model: 'wan3.0-video',
  providerModel: 'wan/3-0-video',
  prompt: 'An ocean wave',
  duration: 5,
  resolution: '720P',
  ratio: '16:9',
  media: [],
};
const key = 'fixture-private-key';
const taskId = 'bd8f4b1a52048d0f17a38b49591abfa1';

test('Wan 2.x uses each documented model and payload, then binds results to the saved model', async () => {
  for (const version of ['2.5', '2.6', '2.7'] as const)
    for (const image of [false, true]) {
      const model = `wan/${version.replace('.', '-')}-${image ? 'image' : 'text'}-to-video`;
      const first = 'https://media.example.com/first.png';
      const provider = new KieWanVideoProvider(
        { apiKey: key },
        async (_url, init) => {
          if (init?.method === 'POST') {
            const body = JSON.parse(String(init.body));
            assert.equal(body.model, model);
            assert.deepEqual(body.input, {
              prompt: input.prompt,
              resolution: '720p',
              duration: version === '2.7' ? 5 : '5',
              nsfw_checker: true,
              ...(version === '2.5'
                ? {
                    enable_prompt_expansion: true,
                    ...(image
                      ? { image_url: first }
                      : { aspect_ratio: '9:16' }),
                  }
                : version === '2.6'
                  ? {
                      multi_shots: false,
                      ...(image ? { image_urls: [first] } : {}),
                    }
                  : {
                      prompt_extend: true,
                      watermark: false,
                      ...(image
                        ? { first_frame_url: first }
                        : { ratio: '9:16' }),
                    }),
            });
            return Response.json({ code: 200, data: { taskId } });
          }
          return Response.json({
            code: 200,
            data: {
              taskId,
              model,
              state: 'success',
              resultJson: JSON.stringify({
                resultUrls: ['https://output.example.com/video.mp4'],
              }),
            },
          });
        }
      );
      const internal =
        version === '2.5'
          ? 'wan2.5-t2v-preview'
          : version === '2.6'
            ? 'wan2.6-t2v'
            : 'wan2.7-t2v';
      await provider.generate({
        ...input,
        model: internal,
        providerModel: model,
        ratio: image || version === '2.6' ? 'adaptive' : '9:16',
        media: image ? [{ type: 'first_frame', url: first }] : [],
      });
      assert.equal(
        (await provider.query(taskId, internal, model)).state,
        'succeeded'
      );
      const opposite = model.replace(
        image ? 'image' : 'text',
        image ? 'text' : 'image'
      );
      assert.equal(
        (await provider.query(taskId, internal, opposite)).state,
        'unknown'
      );
      await assert.rejects(
        provider.query(taskId, internal, 'wan/3-0-video'),
        PolarisVideoError
      );
    }
});

test('Wan 2.x rejects unsupported requests before contacting Kie', async () => {
  let calls = 0;
  const provider = new KieWanVideoProvider({ apiKey: key }, async () => {
    calls++;
    return Response.json({});
  });
  const base = {
    ...input,
    model: 'wan2.5-t2v-preview' as const,
    providerModel: 'wan/2-5-text-to-video',
  };
  for (const patch of [
    { duration: 6 },
    { resolution: '480P' as const },
    { prompt: 'x'.repeat(801) },
    { providerModel: 'wan/2-6-text-to-video' },
  ]) {
    await assert.rejects(
      provider.generate({ ...base, ...patch }),
      PolarisVideoError
    );
  }
  assert.equal(calls, 0);
});

test('both tiers send video and image references in order without internal duration proofs', async () => {
  for (const prime of [false, true]) {
    const provider = new KieWanVideoProvider(
      { apiKey: key },
      async (_url, init) => {
        const payload = JSON.parse(String(init?.body));
        assert.deepEqual(payload.input.reference_video_urls, [
          'https://media.example.com/a.mp4',
          'https://media.example.com/b.mov',
        ]);
        assert.deepEqual(payload.input.reference_image_urls, [
          'https://media.example.com/ref.png',
        ]);
        assert.equal(
          payload.model,
          prime ? 'wan/3-0-video-prime' : 'wan/3-0-video'
        );
        assert.equal(payload.input.referenceVideoDuration, undefined);
        assert.equal(payload.input.first_frame_url, undefined);
        return Response.json({ code: 200, data: { taskId } });
      }
    );
    await provider.generate({
      ...input,
      model: prime ? 'wan3.0-video-prime' : 'wan3.0-video',
      providerModel: prime ? 'wan/3-0-video-prime' : 'wan/3-0-video',
      referenceVideoDuration: 4,
      media: [
        { type: 'reference_video', url: 'https://media.example.com/a.mp4' },
        { type: 'reference_image', url: 'https://media.example.com/ref.png' },
        { type: 'reference_video', url: 'https://media.example.com/b.mov' },
      ],
    });
    await assert.rejects(
      provider.generate({
        ...input,
        referenceVideoDuration: 16,
        media: [
          { type: 'reference_video', url: 'https://media.example.com/a.mp4' },
        ],
      }),
      PolarisVideoError
    );
  }
});

test('both Kie tiers preserve media order and duration/resolution boundaries across all image modes', async () => {
  const mediaCases: NonNullable<PolarisVideoInput['media']>[] = [
    [],
    [{ type: 'first_frame', url: 'https://media.example.com/first.jpg' }],
    [
      { type: 'first_frame', url: 'https://media.example.com/first.jpg' },
      { type: 'last_frame', url: 'https://media.example.com/last.jpg' },
    ],
    Array.from({ length: 10 }, (_, i) => ({
      type: 'reference_image' as const,
      url: `https://media.example.com/ref-${i}.jpg`,
    })),
  ];
  for (const prime of [false, true])
    for (const media of mediaCases)
      for (const resolution of ['480P', '720P', '1080P'] as const)
        for (const duration of [2, 30]) {
          const model = prime ? 'wan/3-0-video-prime' : 'wan/3-0-video';
          const provider = new KieWanVideoProvider(
            { apiKey: key },
            async (_url, init) => {
              const body = JSON.parse(String(init?.body));
              assert.equal(body.model, model);
              assert.deepEqual(body.input, {
                prompt: media.length ? '' : input.prompt,
                resolution,
                duration,
                aspect_ratio: 'adaptive',
                audio: true,
                ...(media[0]?.type === 'first_frame'
                  ? { first_frame_url: media[0].url }
                  : {}),
                ...(media[1]?.type === 'last_frame'
                  ? { last_frame_url: media[1].url }
                  : {}),
                ...(media[0]?.type === 'reference_image'
                  ? { reference_image_urls: media.map((m) => m.url) }
                  : {}),
              });
              return Response.json({ code: 200, data: { taskId } });
            }
          );
          await provider.generate({
            ...input,
            model: prime ? 'wan3.0-video-prime' : 'wan3.0-video',
            providerModel: model,
            resolution,
            duration,
            ratio: 'adaptive',
            media,
            prompt: media.length ? '' : input.prompt,
          });
        }
});

test('Kie submits exact Wan fields and bearer auth, including first/last and reference modes', async () => {
  for (const media of [
    [],
    [
      { type: 'first_frame', url: 'https://media.example.com/first.jpg' },
      { type: 'last_frame', url: 'https://media.example.com/last.jpg' },
    ],
    [{ type: 'reference_image', url: 'https://media.example.com/ref.jpg' }],
  ] as PolarisVideoInput['media'][]) {
    const provider = new KieWanVideoProvider(
      { apiKey: key },
      async (url, init) => {
        assert.equal(url, 'https://api.kie.ai/api/v1/jobs/createTask');
        assert.equal(init?.redirect, 'error');
        assert.equal(
          new Headers(init?.headers).get('Authorization'),
          `Bearer ${key}`
        );
        const body = JSON.parse(String(init?.body));
        assert.equal(body.model, 'wan/3-0-video');
        assert.equal(body.input.duration, 5);
        assert.equal(body.input.resolution, '720P');
        assert.equal(body.input.aspect_ratio, '16:9');
        assert.equal(body.input.audio, true);
        assert.equal(body.input.n_frames, undefined);
        assert.equal(
          body.input.first_frame_url,
          media?.find((m) => m.type === 'first_frame')?.url
        );
        assert.equal(
          body.input.last_frame_url,
          media?.find((m) => m.type === 'last_frame')?.url
        );
        assert.deepEqual(
          body.input.reference_image_urls,
          media?.some((m) => m.type === 'reference_image')
            ? ['https://media.example.com/ref.jpg']
            : undefined
        );
        return Response.json({ code: 200, data: { taskId } });
      }
    );
    assert.deepEqual(await provider.generate({ ...input, media }), { taskId });
  }
});

test('Kie maps Prime and normalizes origin or versioned endpoints', async () => {
  for (const baseUrl of [
    'https://api.kie.ai',
    'https://api.kie.ai/v1',
    'https://api.kie.ai/api/v1/',
  ]) {
    const provider = new KieWanVideoProvider(
      { apiKey: key, baseUrl },
      async (url, init) => {
        assert.equal(url, 'https://api.kie.ai/api/v1/jobs/createTask');
        assert.equal(
          JSON.parse(String(init?.body)).model,
          'wan/3-0-video-prime'
        );
        return Response.json({ code: 200, data: { taskId } });
      }
    );
    await provider.generate({
      ...input,
      model: 'wan3.0-video-prime',
      providerModel: 'wan/3-0-video-prime',
    });
  }
});

test('invalid models and mixed media are rejected before contacting Kie', async () => {
  let calls = 0;
  const provider = new KieWanVideoProvider({ apiKey: key }, async () => {
    calls++;
    return Response.json({});
  });
  for (const change of [
    { model: 'wan2.6-t2v' },
    { providerModel: 'another-model' },
    { duration: 31 },
    {
      media: [{ type: 'last_frame', url: 'https://media.example.com/end.jpg' }],
    },
    {
      media: [
        { type: 'first_frame', url: 'https://media.example.com/a.jpg' },
        { type: 'reference_image', url: 'https://media.example.com/b.jpg' },
      ],
    },
  ]) {
    await assert.rejects(
      provider.generate({ ...input, ...change } as PolarisVideoInput),
      PolarisVideoError
    );
  }
  assert.equal(calls, 0);
});

test('Kie definite rejections differ from ambiguous transport and response failures', async () => {
  for (const [response, certainty] of [
    [
      Response.json({ code: 402, msg: 'no balance' }, { status: 200 }),
      'rejected',
    ],
    [Response.json({ code: 401 }, { status: 401 }), 'rejected'],
    [Response.json({ code: 500 }, { status: 500 }), 'unknown'],
    [Response.json({ code: 402, data: { taskId } }), 'unknown'],
    [Response.json({ code: 200, data: {} }), 'unknown'],
    [new Response('{broken'), 'unknown'],
  ] as const) {
    const provider = new KieWanVideoProvider(
      { apiKey: key },
      async () => response
    );
    await assert.rejects(
      provider.generate(input),
      (error: unknown) =>
        error instanceof PolarisVideoError &&
        error.certainty === certainty &&
        !error.message.includes(key)
    );
  }
  let calls = 0;
  const provider = new KieWanVideoProvider({ apiKey: key }, async () => {
    calls++;
    throw new Error('network failed');
  });
  await assert.rejects(
    provider.generate(input),
    (error: unknown) =>
      error instanceof PolarisVideoError && error.certainty === 'unknown'
  );
  assert.equal(calls, 1);
});

test('Kie query validates task and model before trusting terminal status or output', async () => {
  for (const [data, state] of [
    [{ state: 'waiting' }, 'processing'],
    [{ state: 'queuing' }, 'processing'],
    [{ state: 'generating' }, 'processing'],
    [{ state: 'fail' }, 'failed'],
    [
      {
        state: 'success',
        resultJson: JSON.stringify({
          resultUrls: ['https://tempfile.aiquickdraw.com/result.mp4'],
        }),
      },
      'succeeded',
    ],
    [{ state: 'fail', taskId: 'different-task' }, 'unknown'],
    [{ state: 'fail', model: 'wrong-model' }, 'unknown'],
    [{ state: 'success', resultJson: 'broken' }, 'unknown'],
    [
      {
        state: 'success',
        resultJson: JSON.stringify({
          resultUrls: ['http://unsafe.example.com/video.mp4'],
        }),
      },
      'unknown',
    ],
  ] as const) {
    const provider = new KieWanVideoProvider({ apiKey: key }, async (url) => {
      assert.equal(
        url,
        `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`
      );
      return Response.json({
        code: 200,
        data: { taskId, model: 'wan/3-0-video', ...data },
      });
    });
    assert.equal(
      (await provider.query(taskId, 'wan3.0-video', 'wan/3-0-video')).state,
      state
    );
  }
});
