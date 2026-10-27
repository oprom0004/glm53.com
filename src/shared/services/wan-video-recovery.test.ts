import assert from 'node:assert/strict';
import { test } from 'node:test';

import { classifyWanRecoveryState } from './wan-video';

test('recovery never re-submits paid work and keeps uncertain states reserved', () => {
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
      phase: 'processing',
      ageMs: 60_000,
    }),
    { action: 'query', refund: false }
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
