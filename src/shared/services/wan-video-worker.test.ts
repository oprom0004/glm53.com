import assert from 'node:assert/strict';
import { test } from 'node:test';

import { runWanVideoWorkerOnce } from './wan-video-worker';

test('worker recovery runs the persisted sweep and reports sanitized failure state', async () => {
  let runs = 0;
  assert.equal(
    await runWanVideoWorkerOnce(async () => {
      runs++;
    }),
    true
  );
  assert.equal(runs, 1);
  assert.equal(
    await runWanVideoWorkerOnce(async () => {
      throw new Error('private upstream response');
    }),
    false
  );
});
