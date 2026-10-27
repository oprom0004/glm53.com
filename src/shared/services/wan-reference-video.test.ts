import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';

import {
  inspectReferenceVideo,
  referenceVideoDuration,
  signReferenceVideo,
} from './wan-reference-video';
import { parseWanRequest, resolveWanVideoQuote } from './wan-video-contract';
import { WanVideoStorage } from './wan-video-storage';

const secret = process.env.AUTH_SECRET;
before(() => {
  process.env.AUTH_SECRET = 'reference-video-test-key-never-used-in-production';
});
after(() => {
  if (secret === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = secret;
});
const fixture = (name: string) =>
  readFileSync(new URL(`../test/fixtures/${name}`, import.meta.url));
const url = 'https://media.example.com/wan-inputs/owner/reference.mp4';
const receipt = (durationMs = 2000) => ({
  url,
  token: signReferenceVideo('owner', url, durationMs),
});
const configs = {
  wan30_provider: 'kie',
  kie_api_key: 'fixture-key',
  r2_account_id: '0123456789abcdef0123456789abcdef',
  r2_bucket_name: 'fixture',
  r2_domain: 'https://media.example.com',
  r2_access_key: 'fixture',
  r2_secret_key: 'fixture',
};
const input = {
  version: '3.0',
  tier: 'standard',
  mode: 'reference',
  resolution: '480P',
  duration: 2,
  ratio: '16:9',
};

test('converted fractional rates round the combined reference and output duration only once', () => {
  const quote = resolveWanVideoQuote(
    { ...input, tier: 'prime', referenceVideos: [receipt(2020)] },
    { ...configs, polaris_wan30_prime_480p_credits_per_second: '50/7' },
    'owner'
  );
  assert.equal(quote.inputVideoDuration, 2.02);
  assert.equal(quote.credits, 29);
});

test('server reads real MP4 and MOV duration/dimensions and rejects invalid or unsupported files', () => {
  for (const name of ['reference-valid.mp4', 'reference-mov.mov'])
    assert.deepEqual(inspectReferenceVideo(fixture(name)), {
      durationMs: 2000,
      width: 240,
      height: 240,
    });
  for (const body of [
    Buffer.from('not video'),
    fixture('reference-valid.mp4').subarray(0, 700),
    fixture('reference-long.mp4'),
    fixture('reference-small.mp4'),
  ])
    assert.throws(() => inspectReferenceVideo(body), /invalid_reference_video/);
});

test('duration receipts bind verified duration to owner and immutable upload URL', () => {
  const item = receipt();
  assert.equal(referenceVideoDuration([item], 'owner'), 2);
  for (const value of [
    { ...item, url: url.replace('reference', 'other') },
    { ...item, token: item.token.slice(0, -6) + 'AAAAAA' },
  ])
    assert.throws(
      () => referenceVideoDuration([value], 'owner'),
      /invalid_reference_video/
    );
  assert.throws(
    () => referenceVideoDuration([item], 'other'),
    /invalid_reference_video/
  );
  assert.throws(
    () => referenceVideoDuration([receipt(8000), receipt(8000)], 'owner'),
    /reference_video_duration/
  );
});

test('quote charges input plus output duration, ignores forged plain duration and enforces total limits', () => {
  const referenceVideos = [receipt()];
  const q = resolveWanVideoQuote(
    { ...input, referenceVideos, referenceVideoDuration: 0 },
    configs,
    'owner'
  );
  assert.equal(q.credits, 14);
  assert.equal(q.inputVideoDuration, 2);
  assert.equal(
    resolveWanVideoQuote(
      { ...input, tier: 'prime', referenceVideos },
      configs,
      'owner'
    ).credits,
    20
  );
  assert.throws(
    () =>
      resolveWanVideoQuote(
        { ...input, referenceVideos, duration: 29 },
        configs,
        'owner'
      ),
    /reference_video_duration/
  );
  assert.throws(
    () => resolveWanVideoQuote({ ...input, referenceVideos }, configs, 'other'),
    /invalid_reference_video/
  );
  assert.throws(
    () =>
      resolveWanVideoQuote(
        { ...input, referenceVideos },
        { ...configs, wan30_provider: 'polaris', polaris_api_key: 'fixture' },
        'owner'
      ),
    /unsupported_model/
  );
});

test('request cannot omit receipts or mismatch their media URLs, and can mix images with videos', () => {
  const request = {
    ...input,
    requestId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    quoteVersion: 'wan-pricing-v1',
    expectedCredits: 14,
    prompt: 'Follow Video1',
    referenceVideos: [receipt()],
    media: [{ type: 'reference_video', url }],
  };
  assert.equal(parseWanRequest(request).media[0].type, 'reference_video');
  assert.equal(
    parseWanRequest({
      ...request,
      media: [
        ...request.media,
        { type: 'reference_image', url: 'https://media.example.com/image.png' },
      ],
    }).media.length,
    2
  );
  for (const changes of [
    { referenceVideos: [] },
    { media: [] },
    {
      media: [
        { type: 'reference_video', url: 'https://media.example.com/other.mp4' },
      ],
    },
    { mode: 'image' },
    { version: '2.7' },
  ])
    assert.throws(() => parseWanRequest({ ...request, ...changes }));
});

test('video storage validates content before upload and issues an owner-bound receipt', async () => {
  let writes = 0;
  const provider = {
    name: 'fixture',
    configs: {},
    getPublicUrl: ({ key }: { key: string }) =>
      `https://media.example.com/${key}`,
    uploadFile: async ({ key }: { key: string }) => {
      writes++;
      return {
        success: true,
        provider: 'fixture',
        url: `https://media.example.com/${key}`,
      };
    },
    downloadAndUpload: async () => {
      throw new Error();
    },
  };
  const storage = new WanVideoStorage(provider);
  await assert.rejects(
    storage.uploadReferenceVideo(
      'owner',
      new File(['invalid'], 'fake.mp4', { type: 'video/mp4' })
    ),
    /invalid_reference_video/
  );
  assert.equal(writes, 0);
  const result = await storage.uploadReferenceVideo(
    'owner',
    new File([new Uint8Array(fixture('reference-valid.mp4'))], 'test.mp4', {
      type: 'video/mp4',
    })
  );
  assert.equal(writes, 1);
  assert.equal(referenceVideoDuration([result], 'owner'), 2);
  assert.equal(
    storage.validateInputUrl('owner', result.url, 'reference_video'),
    true
  );
  assert.equal(
    storage.validateInputUrl('other', result.url, 'reference_video'),
    false
  );
  assert.equal(
    storage.validateInputUrl('owner', result.url, 'reference_image'),
    false
  );
});
