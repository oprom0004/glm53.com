import assert from 'node:assert/strict';
import { test } from 'node:test';

import { handleWanApi } from '@/shared/services/wan-video-api';

function multipart(file: File) {
  const form = new FormData();
  form.append('file', file);
  return new Request('https://wan.example/api/ai/wan/upload', {
    method: 'POST',
    body: form,
  });
}

test('upload authenticates first and passes exactly one file to user-scoped storage', async () => {
  let uploads = 0;
  const deps = {
    getUser: async () => ({ id: 'user-1' }),
    getConfigs: async () => ({}),
    upload: async (userId: string, file: File) => {
      uploads++;
      assert.equal(userId, 'user-1');
      assert.equal(file.name, 'frame.png');
      return { url: 'https://media.example/wan-inputs/user/frame.png' };
    },
  };
  const file = new File(
    [Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')],
    'frame.png',
    { type: 'image/png' }
  );
  const response = await handleWanApi('upload', multipart(file), deps);
  assert.equal(response.status, 200);
  assert.equal(uploads, 1);
  assert.deepEqual((await response.json()).data, {
    url: 'https://media.example/wan-inputs/user/frame.png',
  });

  const unauthenticated = await handleWanApi('upload', multipart(file), {
    ...deps,
    getUser: async () => null,
  });
  assert.equal(unauthenticated.status, 401);
  assert.equal(uploads, 1);
});

test('upload rejects wrong content types, extra fields and oversized declarations', async () => {
  const deps = {
    getUser: async () => ({ id: 'user-1' }),
    getConfigs: async () => ({}),
    upload: async () => ({ url: 'should-not-run' }),
  };
  const wrongType = await handleWanApi(
    'upload',
    new Request('https://wan.example/api/ai/wan/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }),
    deps
  );
  assert.equal(wrongType.status, 400);
  assert.equal((await wrongType.json()).message, 'invalid_image');

  const oversized = await handleWanApi(
    'upload',
    new Request('https://wan.example/api/ai/wan/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=x',
        'Content-Length': String(11 * 1024 * 1024 + 1),
      },
      body: '--x--',
    }),
    deps
  );
  assert.equal(oversized.status, 400);
});

test('reference-video upload authenticates and uses the video validator, never image storage', async () => {
  let uploads = 0;
  const deps = {
    getUser: async () => ({ id: 'owner' }),
    getConfigs: async () => ({ wan30_provider: 'kie' }),
    upload: async () => {
      throw new Error('image storage must not be used');
    },
    uploadVideo: async (owner: string, file: File) => {
      uploads++;
      assert.equal(owner, 'owner');
      assert.equal(file.name, 'reference.mov');
      return {
        url: 'https://media.example.com/reference.mov',
        token: 'signed-receipt',
        durationMs: 2000,
      };
    },
  };
  const file = new File(
    ['mock delegated to video validator'],
    'reference.mov',
    { type: 'video/quicktime' }
  );
  assert.equal(
    (
      await handleWanApi('upload-video', multipart(file), {
        ...deps,
        getUser: async () => null,
      })
    ).status,
    401
  );
  assert.equal(uploads, 0);
  const response = await handleWanApi('upload-video', multipart(file), deps);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.durationMs, 2000);
  assert.equal(uploads, 1);
});
