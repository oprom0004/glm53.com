import assert from 'node:assert/strict';
import test from 'node:test';

import { getSetupChecks } from './setup-readiness';

test('setup checklist identifies each missing dependency without contacting a provider', () => {
  const checks = getSetupChecks({});
  assert.equal(checks.find((check) => check.id === 'email')?.ready, true);
  for (const id of [
    'google',
    'storage',
    'ai',
    'polaris_wan30_prime_model',
    'stripe',
  ]) {
    const check = checks.find((check) => check.id === id)!;
    assert.equal(check.ready, false);
    assert.ok(check.missing.length > 0);
  }
});

test('setup checklist never serializes secrets and rejects malformed configured values', () => {
  const checks = getSetupChecks({
    google_auth_enabled: 'true',
    google_client_id: 'example-client',
    google_client_secret: 'private-google-secret',
    polaris_api_key: 'Bearer private-key',
    polaris_wan30_prime_model: '../invalid',
    stripe_enabled: 'true',
    stripe_secret_key: 'pk_test_public',
    stripe_signing_secret: 'private-webhook-secret',
  });
  assert.equal(checks.find((check) => check.id === 'google')?.ready, true);
  assert.equal(checks.find((check) => check.id === 'ai')?.ready, false);
  assert.equal(
    checks.find((check) => check.id === 'polaris_wan30_prime_model')?.ready,
    false
  );
  assert.equal(checks.find((check) => check.id === 'stripe')?.ready, false);
  assert.doesNotMatch(
    JSON.stringify(checks),
    /private-google-secret|private-key|private-webhook-secret/
  );
});

test('Kie setup checks use the selected key and fixed model IDs without leaking the secret', () => {
  const checks = getSetupChecks({
    wan30_provider: 'kie',
    kie_api_key: 'kie-private-fixture',
  });
  assert.equal(checks.find((check) => check.id === 'ai')?.ready, true);
  assert.equal(
    checks.find((check) => check.id === 'kie_wan30_prime')?.ready,
    true
  );
  assert.equal(
    checks.some((check) => check.id === 'polaris_wan30_prime_model'),
    false
  );
  assert.doesNotMatch(JSON.stringify(checks), /kie-private-fixture/);
});
