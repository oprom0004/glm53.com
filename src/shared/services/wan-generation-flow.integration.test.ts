import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyWanRecoveryState } from './wan-video';
import {
  parseWanRequest,
  quoteWanVideo,
  WAN_QUOTE_VERSION,
} from './wan-video-contract';

const configs = {
  polaris_api_key: 'fixture-polaris-key',
  polaris_base_url: 'https://api.polariscore.ai',
  polaris_wan30_model: 'wan3.0-video',
  polaris_wan30_standard_1080p_credits_per_second: '14',
  r2_bucket_name: 'fixture-bucket',
  r2_account_id: '0123456789abcdef0123456789abcdef',
  r2_domain: 'https://media.wanai30.com',
  r2_access_key: 'fixture-access-id',
  r2_secret_key: 'fixture-access-secret',
};

test('quote, request validation and recovery preserve the exact Wan generation contract', () => {
  const input = {
    version: '3.0',
    tier: 'standard',
    mode: 'text',
    duration: 5,
    resolution: '1080P',
    ratio: '16:9',
  } as const;
  const quote = quoteWanVideo(input, configs);
  assert.deepEqual(quote, {
    credits: 70,
    normalizedInput: input,
    quoteVersion: WAN_QUOTE_VERSION,
  });

  assert.deepEqual(
    parseWanRequest({
      ...input,
      requestId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      expectedCredits: quote.credits,
      quoteVersion: quote.quoteVersion,
      prompt: '  A cinematic ocean wave  ',
      media: [],
    }).prompt,
    'A cinematic ocean wave'
  );
  assert.deepEqual(
    classifyWanRecoveryState({
      hasProviderTaskId: false,
      phase: 'queued',
      ageMs: 60_000,
    }),
    { action: 'mark_submission_unknown', refund: false }
  );
  assert.deepEqual(
    classifyWanRecoveryState({
      hasProviderTaskId: true,
      phase: 'storage_pending',
      ageMs: 60_000,
    }),
    { action: 'save', refund: false }
  );
});
