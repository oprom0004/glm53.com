'use client';

import { useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  Sparkles,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { authClient, signIn } from '@/core/auth/client';
import { Link, useRouter } from '@/core/i18n/navigation';
import { defaultLocale } from '@/config/locale';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

import {
  normalizeAuthCallbackPath,
  validateSignIn,
  type AuthFieldErrors,
} from './auth-validation';
import { EmailAuthSection } from './email-auth-section';
import { SocialProviders } from './social-providers';

export function SignIn({
  configs,
  callbackUrl = '/',
  defaultEmail = '',
  embedded = false,
  defaultEmailExpanded = false,
  onAuthenticated,
  onVerificationRequired,
  onSwitchToSignUp,
}: {
  configs: Record<string, string>;
  callbackUrl: string;
  defaultEmail?: string;
  embedded?: boolean;
  defaultEmailExpanded?: boolean;
  onAuthenticated?: () => Promise<void> | void;
  onVerificationRequired?: () => void;
  onSwitchToSignUp?: () => void;
}) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('common.sign');
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState(defaultEmail || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [formError, setFormError] = useState('');

  const isEmailAuthEnabled = configs.auth_email_ready === 'true';

  callbackUrl = normalizeAuthCallbackPath(callbackUrl);
  const localizedCallbackUrl =
    locale !== defaultLocale &&
    callbackUrl.startsWith('/') &&
    !callbackUrl.startsWith(`/${locale}`)
      ? `/${locale}${callbackUrl}`
      : callbackUrl;
  const localeBase = locale !== defaultLocale ? `/${locale}` : '';
  const signUpHref =
    callbackUrl === '/'
      ? '/sign-up?method=email'
      : `/sign-up?method=email&callbackUrl=${encodeURIComponent(callbackUrl)}`;

  const handleSignIn = async () => {
    if (loading) return;

    const errors = validateSignIn({ email, password });
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError('');
      if (errors.email) emailRef.current?.focus();
      else if (errors.password) passwordRef.current?.focus();
      return;
    }

    setFieldErrors({});
    setFormError('');
    setLoading(true);

    try {
      await signIn.email(
        {
          email: email.trim(),
          password,
          // Better Auth redirects when callbackURL is present. Keep modal sign-in
          // on the generator so the user's prompt and selected files survive.
          callbackURL: onAuthenticated ? undefined : localizedCallbackUrl,
        },
        {
          onRequest: () => {},
          onResponse: () => {},
          onSuccess: async () => {
            if (onAuthenticated) {
              await onAuthenticated();
              setLoading(false);
            }
          },
          onError: (event: any) => {
            const code = event?.error?.code;
            if (code === 'EMAIL_NOT_VERIFIED') {
              let callbackWithoutLocale = localizedCallbackUrl;
              if (locale !== defaultLocale) {
                if (callbackWithoutLocale === `/${locale}`) {
                  callbackWithoutLocale = '/';
                } else if (callbackWithoutLocale.startsWith(`/${locale}/`)) {
                  callbackWithoutLocale =
                    callbackWithoutLocale.slice(locale.length + 1) || '/';
                }
              }

              const verifyPath = `/verify-email?sent=1&email=${encodeURIComponent(
                email.trim()
              )}&callbackUrl=${encodeURIComponent(callbackWithoutLocale)}`;

              void authClient.sendVerificationEmail({
                email: email.trim(),
                callbackURL: `${localeBase}${callbackWithoutLocale || '/'}`,
              });
              onVerificationRequired?.();
              router.push(verifyPath);
              return;
            }

            setFormError(t('sign_in_error'));
            setLoading(false);
          },
        }
      );
    } catch {
      setFormError(t('sign_in_error'));
      setLoading(false);
    }
  };

  const emailError = fieldErrors.email
    ? t(fieldErrors.email as 'validation_email_required')
    : '';
  const passwordError = fieldErrors.password
    ? t(fieldErrors.password as 'validation_password_required')
    : '';

  return (
    <section
      aria-labelledby={embedded ? undefined : 'sign-in-title'}
      className="w-full"
    >
      {!embedded && (
        <div className="mb-8">
          <div className="text-auth-action inline-flex items-center gap-2 text-xs font-semibold tracking-[0.18em] uppercase">
            <Sparkles className="size-4" aria-hidden="true" />
            {t('sign_in_eyebrow')}
          </div>
          <h1
            id="sign-in-title"
            className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-balance sm:text-4xl"
          >
            {t('sign_in_title')}
          </h1>
          <p className="text-muted-foreground mt-3 max-w-sm text-sm leading-6">
            {t('sign_in_description')}
          </p>
        </div>
      )}

      <div className="grid gap-6">
        <SocialProviders
          configs={configs}
          callbackUrl={localizedCallbackUrl || '/'}
          loading={loading}
          setLoading={setLoading}
          onAuthenticated={onAuthenticated}
        />
        {isEmailAuthEnabled && (
          <EmailAuthSection
            defaultExpanded={defaultEmailExpanded || Boolean(defaultEmail)}
            disabled={loading}
          >
            {isEmailAuthEnabled && (
              <form
                noValidate
                className="grid gap-1"
                aria-busy={loading}
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleSignIn();
                }}
              >
                {formError && (
                  <div
                    role="alert"
                    className="border-auth-error/25 bg-auth-error/8 text-auth-error mb-4 flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm leading-5"
                  >
                    <AlertCircle
                      className="mt-0.5 size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid gap-1.5">
                  <Label htmlFor="sign-in-email" className="text-[0.8125rem]">
                    {t('email_title')}
                  </Label>
                  <div className="relative">
                    <Mail
                      className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-[1.125rem] -translate-y-1/2"
                      aria-hidden="true"
                    />
                    <Input
                      ref={emailRef}
                      id="sign-in-email"
                      name="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder={t('email_placeholder')}
                      required
                      aria-invalid={Boolean(emailError)}
                      aria-describedby={
                        emailError ? 'sign-in-email-error' : undefined
                      }
                      className="border-border/80 bg-background focus-visible:ring-auth-action/20 h-12 rounded-lg pl-11 shadow-none"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        if (fieldErrors.email) {
                          setFieldErrors((current) => ({
                            ...current,
                            email: undefined,
                          }));
                        }
                        if (formError) setFormError('');
                      }}
                    />
                  </div>
                  <p
                    id="sign-in-email-error"
                    className="text-auth-error min-h-5 text-xs leading-5"
                  >
                    {emailError || <span aria-hidden="true">&nbsp;</span>}
                  </p>
                </div>

                <div className="grid gap-1.5">
                  <Label
                    htmlFor="sign-in-password"
                    className="text-[0.8125rem]"
                  >
                    {t('password_title')}
                  </Label>
                  <div className="relative">
                    <LockKeyhole
                      className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-[1.125rem] -translate-y-1/2"
                      aria-hidden="true"
                    />
                    <Input
                      ref={passwordRef}
                      id="sign-in-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder={t('password_placeholder')}
                      required
                      aria-invalid={Boolean(passwordError)}
                      aria-describedby={
                        passwordError ? 'sign-in-password-error' : undefined
                      }
                      className="border-border/80 bg-background focus-visible:ring-auth-action/20 h-12 rounded-lg pr-12 pl-11 shadow-none"
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        if (fieldErrors.password) {
                          setFieldErrors((current) => ({
                            ...current,
                            password: undefined,
                          }));
                        }
                        if (formError) setFormError('');
                      }}
                    />
                    <button
                      type="button"
                      aria-label={
                        showPassword ? t('hide_password') : t('show_password')
                      }
                      aria-pressed={showPassword}
                      className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-1 flex size-10 -translate-y-1/2 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
                      onClick={() => setShowPassword((current) => !current)}
                    >
                      {showPassword ? (
                        <EyeOff
                          className="size-[1.125rem]"
                          aria-hidden="true"
                        />
                      ) : (
                        <Eye className="size-[1.125rem]" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  <p
                    id="sign-in-password-error"
                    className="text-auth-error min-h-5 text-xs leading-5"
                  >
                    {passwordError || <span aria-hidden="true">&nbsp;</span>}
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  aria-busy={loading}
                  className="bg-auth-action text-auth-action-foreground hover:bg-auth-action/90 relative mt-2 h-12 w-full rounded-lg text-sm font-semibold shadow-[0_12px_28px_hsl(239_70%_55%/0.22)] active:translate-y-px"
                >
                  <span
                    className={
                      loading ? 'invisible' : 'inline-flex items-center gap-2'
                    }
                  >
                    {t('sign_in_action')}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </span>
                  {loading && (
                    <Loader2
                      className="absolute size-4 animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  )}
                </Button>
              </form>
            )}

            {isEmailAuthEnabled && (
              <Link
                href="/forgot-password"
                className="text-sm text-violet-600 underline underline-offset-4"
              >
                {t('forgot_password')}
              </Link>
            )}

            {isEmailAuthEnabled && (
              <p className="text-muted-foreground text-center text-sm">
                {t('no_account')}{' '}
                {onSwitchToSignUp ? (
                  <button
                    type="button"
                    onClick={onSwitchToSignUp}
                    className="text-foreground font-semibold underline underline-offset-4"
                  >
                    {t('sign_up_title')}
                  </button>
                ) : (
                  <Link
                    href={signUpHref}
                    className="text-foreground decoration-border hover:text-auth-action focus-visible:ring-ring font-semibold underline underline-offset-4 transition-colors focus-visible:rounded-sm focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {t('sign_up_title')}
                  </Link>
                )}
              </p>
            )}
          </EmailAuthSection>
        )}
      </div>
    </section>
  );
}
