import assert from 'node:assert/strict';
import test from 'node:test';

import { getAuthOptions } from './config';

test('email verification and password reset require both a sender and a service key', async () => {
  for (const config of [
    {},
    { resend_api_key: 'test-only' },
    { resend_sender_email: 'test@example.invalid' },
  ] as Record<string, string>[]) {
    const options = await getAuthOptions({
      ...config,
      email_verification_enabled: 'true',
    });
    assert.equal(options.emailAndPassword.requireEmailVerification, false);
    assert.equal(options.emailAndPassword.sendResetPassword, undefined);
  }
});

test('configured password recovery revokes existing sessions and disabled email auth stays disabled', async () => {
  const config = {
    resend_api_key: 'test-only',
    resend_sender_email: 'test@example.invalid',
    email_verification_enabled: 'true',
  };
  const ready = await getAuthOptions(config);
  assert.equal(ready.emailAndPassword.requireEmailVerification, true);
  assert.equal(ready.emailAndPassword.revokeSessionsOnPasswordReset, true);
  assert.equal(typeof ready.emailAndPassword.sendResetPassword, 'function');
  const disabled = await getAuthOptions({
    ...config,
    email_auth_enabled: 'false',
  });
  assert.equal(disabled.emailAndPassword.enabled, false);
  assert.equal(disabled.emailAndPassword.sendResetPassword, undefined);
});
