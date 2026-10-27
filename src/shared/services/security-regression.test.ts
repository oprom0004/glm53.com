import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  getAuthProviderReadiness,
  readinessToPublicConfig,
} from '@/shared/lib/auth-provider-readiness';

test('public auth readiness never serializes provider credentials', () => {
  const secret = 'fixture-secret-that-must-stay-server-side';
  const configs = {
    email_auth_enabled: 'true',
    google_auth_enabled: 'true',
    google_client_id: 'fixture-client-id',
    google_client_secret: secret,
    github_auth_enabled: 'false',
    github_client_id: 'fixture-github-id',
    github_client_secret: secret,
  };
  const serialized = JSON.stringify(
    readinessToPublicConfig(getAuthProviderReadiness(configs))
  );
  assert.doesNotMatch(serialized, /fixture-secret|fixture-client-id/);
  assert.deepEqual(JSON.parse(serialized), {
    auth_email_ready: 'true',
    auth_google_ready: 'true',
    auth_github_ready: 'false',
  });
});

test('authentication source has no first-login credit grant', async () => {
  const source = await readFile(
    new URL('../../core/auth/config.ts', import.meta.url),
    'utf8'
  );
  assert.doesNotMatch(
    source,
    /grantCreditsForNewUser|WAN25_TRIAL_SCENE|50 credits/i
  );
});

test('admin settings and credit model expose no new-user gift switch', async () => {
  const [settingsSource, creditSource] = await Promise.all([
    readFile(new URL('./settings.ts', import.meta.url), 'utf8'),
    readFile(new URL('../models/credit.ts', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(settingsSource, /initial_credits_/);
  assert.doesNotMatch(creditSource, /grantCreditsForNewUser/);
});
