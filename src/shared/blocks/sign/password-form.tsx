'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';

import { authClient } from '@/core/auth/client';
import { Link } from '@/core/i18n/navigation';
import { defaultLocale } from '@/config/locale';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

export function PasswordForm({
  mode,
  available = true,
  token = '',
}: {
  mode: 'forgot' | 'reset' | 'change';
  available?: boolean;
  token?: string;
}) {
  const locale = useLocale();
  const zh = locale === 'zh';
  const text = (en: string, cn: string) => (zh ? cn : en);
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');
  const disabled = !available || (mode === 'reset' && !token);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || disabled) return;
    setError('');
    if (
      mode !== 'forgot' &&
      (password.length < 8 ||
        password.length > 128 ||
        password !== confirmation)
    ) {
      setError(
        text(
          'Use 8–128 characters and enter the same password twice.',
          '密码需为 8–128 个字符，且两次输入一致。'
        )
      );
      return;
    }
    setBusy(true);
    try {
      const response =
        mode === 'forgot'
          ? await authClient.requestPasswordReset({
              email: email.trim(),
              redirectTo: `${window.location.origin}${locale === defaultLocale ? '' : `/${locale}`}/reset-password`,
            })
          : mode === 'reset'
            ? await authClient.resetPassword({ token, newPassword: password })
            : await authClient.changePassword({
                currentPassword,
                newPassword: password,
                revokeOtherSessions: true,
              });
      if (response.error) {
        setError(
          mode === 'change'
            ? text(
                'Unable to change your password. Check your current password and try again.',
                '修改失败，请检查当前密码后重试。'
              )
            : mode === 'reset'
              ? text(
                  'This link may be invalid or expired. Request a new reset email.',
                  '链接可能无效或已过期，请重新申请重置邮件。'
                )
              : text(
                  'Unable to send the reset email. Please try again later.',
                  '重置邮件暂时无法发送，请稍后重试。'
                )
        );
        return;
      }
      setComplete(true);
      setCurrentPassword('');
      setPassword('');
      setConfirmation('');
    } catch {
      setError(
        text(
          'The request could not be completed. Please try again.',
          '请求未完成，请重试。'
        )
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="w-full max-w-md space-y-5">
      <h1 className="text-2xl font-semibold">
        {mode === 'change'
          ? text('Change password', '修改密码')
          : mode === 'forgot'
            ? text('Forgot password', '找回密码')
            : text('Reset password', '重置密码')}
      </h1>
      {!available && (
        <p role="status" className="text-muted-foreground text-sm">
          {text(
            'Password reset email is not available yet. You can still sign in with your current password or a connected Google account.',
            '密码重置邮件暂未启用。你仍可使用现有密码或已关联的 Google 账户登录。'
          )}
        </p>
      )}
      {mode === 'reset' && !token && (
        <p role="alert">
          {text(
            'Open the reset link from your email, or request a new one.',
            '请打开邮件中的重置链接，或重新申请。'
          )}
        </p>
      )}
      {complete ? (
        <p role="status" className="rounded-lg border p-4 text-sm">
          {mode === 'forgot'
            ? text(
                'If this address has an account, a reset email will arrive shortly. Check your inbox and spam folder.',
                '如果该邮箱已注册，你将收到重置邮件。请检查收件箱及垃圾邮件。'
              )
            : text(
                'Your password has been updated. Other sessions have been signed out.',
                '密码已更新，其他登录会话已退出。'
              )}
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4" aria-busy={busy}>
          {mode === 'forgot' ? (
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={disabled || busy}
              />
            </div>
          ) : (
            <>
              {mode === 'change' && (
                <div className="space-y-2">
                  <Label htmlFor="current-password">
                    {text('Current password', '当前密码')}
                  </Label>
                  <Input
                    id="current-password"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    disabled={busy}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="new-password">
                  {text('New password', '新密码')}
                </Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={disabled || busy}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">
                  {text('Confirm new password', '确认新密码')}
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  required
                  disabled={disabled || busy}
                />
              </div>
            </>
          )}
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <Button className="w-full" type="submit" disabled={disabled || busy}>
            {busy
              ? text('Please wait…', '请稍候…')
              : mode === 'forgot'
                ? text('Send reset link', '发送重置链接')
                : text('Save new password', '保存新密码')}
          </Button>
        </form>
      )}
      <div className="flex gap-4 text-sm text-violet-600 underline underline-offset-4">
        {mode !== 'forgot' && (
          <Link href="/forgot-password">
            {text('Request a reset link', '申请重置链接')}
          </Link>
        )}
        <Link href="/sign-in">{text('Back to sign in', '返回登录')}</Link>
      </div>
    </section>
  );
}
