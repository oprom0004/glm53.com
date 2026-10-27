import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { normalizeAuthCallbackPath, validateSignIn, validateSignUp } =
  require('./auth-validation.ts') as typeof import('./auth-validation.ts');

test('登录校验会同时指出无效邮箱和空密码', () => {
  assert.deepEqual(validateSignIn({ email: 'not-an-email', password: '' }), {
    email: 'validation_email_invalid',
    password: 'validation_password_required',
  });
});

test('登录校验接受格式正确的邮箱和非空密码', () => {
  assert.deepEqual(
    validateSignIn({ email: 'creator@example.com', password: 'secret' }),
    {}
  );
});

test('注册校验要求姓名、八位密码和一致的确认密码', () => {
  assert.deepEqual(
    validateSignUp({
      name: '  ',
      email: 'creator@example.com',
      password: 'short',
      passwordConfirm: 'different',
    }),
    {
      name: 'validation_name_required',
      password: 'validation_password_length',
      passwordConfirm: 'validation_password_mismatch',
    }
  );
});

test('注册校验接受完整且有效的账户信息', () => {
  assert.deepEqual(
    validateSignUp({
      name: 'Wan Creator',
      email: 'creator@example.com',
      password: 'secure-pass',
      passwordConfirm: 'secure-pass',
    }),
    {}
  );
});

test('认证回调只接受站内绝对路径', () => {
  assert.equal(
    normalizeAuthCallbackPath('/studio?tab=recent'),
    '/studio?tab=recent'
  );
  assert.equal(normalizeAuthCallbackPath('https://example.com'), '/');
  assert.equal(normalizeAuthCallbackPath('//example.com/redirect'), '/');
  assert.equal(normalizeAuthCallbackPath('/%2f%2fevil.example'), '/');
  assert.equal(
    normalizeAuthCallbackPath('/settings/tasks\nSet-Cookie:x=1'),
    '/'
  );
  assert.equal(normalizeAuthCallbackPath(undefined), '/');
});
