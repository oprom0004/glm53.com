import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getAuthProviderReadiness,
  readinessToPublicConfig,
} from '@/shared/lib/auth-provider-readiness';
import {
  getSecretSettingNames,
  mergeSecretSettingSubmission,
  prepareAdminConfigView,
} from '@/shared/services/setting-secrets';
import { getSettings, publicSettingNames } from '@/shared/services/settings';

import { getSocialProviders } from './config';

const credentials = {
  google_auth_enabled: 'true',
  google_client_id: 'test-client.apps.googleusercontent.com',
  google_client_secret: 'google-test-secret-not-a-real-key',
};

test('saved Google credentials register the provider and expose readiness without its secret', async () => {
  const providers = await getSocialProviders(credentials);
  assert.deepEqual(providers.google, {
    clientId: 'test-client.apps.googleusercontent.com',
    clientSecret: 'google-test-secret-not-a-real-key',
  });
  const publicConfig = readinessToPublicConfig(
    getAuthProviderReadiness(credentials)
  );
  assert.equal(publicConfig.auth_google_ready, 'true');
  assert.equal(publicConfig.auth_email_ready, 'true');
  assert.equal(publicSettingNames.includes('google_client_secret'), false);
  assert.equal(
    JSON.stringify(publicConfig).includes(credentials.google_client_secret),
    false
  );
});

test('disabled or incomplete Google configuration cannot register a sign-in provider', async () => {
  for (const overrides of [
    { google_auth_enabled: 'false' },
    { google_client_id: '' },
    { google_client_secret: '' },
    { google_client_secret: '  ' },
  ]) {
    const config = { ...credentials, ...overrides };
    assert.equal((await getSocialProviders(config)).google, undefined);
    assert.equal(getAuthProviderReadiness(config).google, false);
  }
});

test('Google secret stays blank in the admin view and survives an empty settings save', async () => {
  const settings = await getSettings();
  const view = prepareAdminConfigView(credentials, settings);
  assert.equal(view.values.google_client_id, credentials.google_client_id);
  assert.equal(view.values.google_client_secret, '');
  assert.equal(view.configuredSecrets.google_client_secret, true);
  assert.equal(
    JSON.stringify(view).includes(credentials.google_client_secret),
    false
  );
  const secretNames = getSecretSettingNames(settings);
  assert.deepEqual(
    mergeSecretSettingSubmission(
      credentials,
      { google_client_secret: '' },
      secretNames
    ),
    {}
  );
  assert.deepEqual(
    mergeSecretSettingSubmission(
      credentials,
      { google_client_secret: '', google_client_secret__clear: 'true' },
      secretNames
    ),
    { google_client_secret: '' }
  );
});
