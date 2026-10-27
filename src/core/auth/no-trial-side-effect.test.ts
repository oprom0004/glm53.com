import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('auth lifecycle grants roles only and has no credit side effect', async () => {
  const source = await readFile(new URL('./config.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /grantCreditsForNewUser|WAN25_TRIAL_SCENE/);
  assert.doesNotMatch(source, /models\/credit/);
  assert.match(source, /grantRoleForNewUser/);
});
