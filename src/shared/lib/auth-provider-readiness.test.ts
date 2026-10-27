import assert from 'node:assert/strict';
import test from 'node:test';

import { getAuthProviderReadiness } from './auth-provider-readiness';

test('auth readiness exposes only fully configured and explicitly enabled providers', () => {
  assert.deepEqual(
    getAuthProviderReadiness({
      email_auth_enabled: 'true',
      google_auth_enabled: 'true',
      google_client_id: 'google-id',
      google_client_secret: 'google-secret',
      github_auth_enabled: 'true',
      github_client_id: 'github-id',
      github_client_secret: '',
    }),
    { email: true, google: true, github: false }
  );
});

test('auth readiness hides disabled providers even when credentials exist', () => {
  assert.deepEqual(
    getAuthProviderReadiness({
      email_auth_enabled: 'false',
      google_auth_enabled: 'false',
      google_client_id: 'google-id',
      google_client_secret: 'google-secret',
      github_auth_enabled: 'false',
      github_client_id: 'github-id',
      github_client_secret: 'github-secret',
    }),
    { email: false, google: false, github: false }
  );
});

test('email auth defaults on when the setting has not been configured', () => {
  assert.deepEqual(getAuthProviderReadiness({}), {
    email: true,
    google: false,
    github: false,
  });
});
