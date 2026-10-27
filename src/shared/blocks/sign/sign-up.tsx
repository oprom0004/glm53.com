'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { authClient, signUp } from '@/core/auth/client';
import { Link } from '@/core/i18n/navigation';
import { defaultLocale } from '@/config/locale';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

import {
  normalizeAuthCallbackPath,
  validateSignUp,
  type AuthFieldErrors,
} from './auth-validation';
import { EmailAuthSection } from './email-auth-section';
import { SocialProviders } from './social-providers';

export function SignUp({
  configs,
  callbackUrl = '/',
  embedded = false,
  defaultEmailExpanded = false,
  onAuthenticated,
  onVerificationRequired,
  onSwitchToSignIn,
}: {
  configs: Record<string, string>;
  callbackUrl: string;
  embedded?: boolean;
  defaultEmailExpanded?: boolean;
  onAuthenticated?: () => Promise<void> | void;
  onVerificationRequired?: () => void;
  onSwitchToSignIn?: () => void;
}) {
  const router = useRouter();
  const t = useTranslations('common.sign');
  const locale = useLocale();
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const passwordConfirmRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [formError, setFormError] = useState('');

  const isEmailAuthEnabled = configs.auth_email_ready === 'true';
  const emailVerificationEnabled =
    configs.auth_email_verification_ready === 'true';

  callbackUrl = normalizeAuthCallbackPath(callbackUrl);
  const localizedCallbackUrl =
    locale !== defaultLocale &&
    callbackUrl.startsWith('/') &&
    !callbackUrl.startsWith(`/${locale}`)
      ? `/${locale}${callbackUrl}`
      : callbackUrl;
  const localeBase = locale !== defaultLocale ? `/${locale}` : '';
  const signInHref =
    callbackUrl === '/'
      ? '/sign-in?method=email'
      : `/sign-in?method=email&callbackUrl=${encodeURIComponent(callbackUrl)}`;

  const reportAffiliate = ({
    userEmail,
    stripeCustomerId,
  }: {
    userEmail: string;
    stripeCustomerId?: string;
  }) => {
    if (typeof window === 'undefined' || !configs) return;

    const windowObject = window as any;
    if (configs.affonso_enabled === 'true' && windowObject.Affonso) {
      windowObject.Affonso.signup(userEmail);
    }
    if (configs.promotekit_enabled === 'true' && windowObject.promotekit) {
      windowObject.promotekit.refer(userEmail, stripeCustomerId);
    }
  };

  const handleSignUp = async () => {
    if (loading) return;

    const errors = validateSignUp({
      name,
      email,
      password,
      passwordConfirm,
    });
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError('');
      if (errors.name) nameRef.current?.focus();
      else if (errors.email) emailRef.current?.focus();
      else if (errors.password) passwordRef.current?.focus();
      else if (errors.passwordConfirm) passwordConfirmRef.current?.focus();
      return;
    }

    setFieldErrors({});
    setFormError('');
    setLoading(true);

    try {
      await signUp.email(
        {
          email: email.trim(),
          password,
          name: name.trim(),
        },
        {
          onRequest: () => {},
          onResponse: () => {},
          onSuccess: async () => {
            reportAffiliate({ userEmail: email.trim() });

            if (emailVerificationEnabled) {
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
              router.push(`${localeBase}${verifyPath}`);
              return;
            }

            if (onAuthenticated) {
              await onAuthenticated();
              setLoading(false);
            } else {
              window.location.assign(localizedCallbackUrl);
            }
          },
          onError: () => {
            setFormError(t('sign_up_error'));
            setLoading(false);
          },
        }
      );
    } catch {
      setFormError(t('sign_up_error'));
      setLoading(false);
    }
  };

  const nameError = fieldErrors.name
    ? t(fieldErrors.name as 'validation_name_required')
    : '';
  const emailError = fieldErrors.email
    ? t(fieldErrors.email as 'validation_email_required')
    : '';
  const passwordError = fieldErrors.password
    ? t(fieldErrors.password as 'validation_password_required')
    : '';
  const passwordConfirmError = fieldErrors.passwordConfirm
    ? t(fieldErrors.passwordConfirm as 'validation_password_confirm_required')
    : '';

  return (
    <section
      aria-labelledby={embedded ? undefined : 'sign-up-title'}
      className="w-full"
    >
      {!embedded && (
        <div className="mb-7">
          <div className="text-auth-action inline-flex items-center gap-2 text-xs font-semibold tracking-[0.18em] uppercase">
            <Sparkles className="size-4" aria-hidden="true" />
            {t('sign_up_eyebrow')}
          </div>
          <h1
            id="sign-up-title"
            className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-balance sm:text-4xl"
          >
            {t('sign_up_title')}
          </h1>
          <p className="text-muted-foreground mt-3 max-w-sm text-sm leading-6">
            {t('sign_up_description')}
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
            defaultExpanded={defaultEmailExpanded}
            disabled={loading}
          >
            {isEmailAuthEnabled && (
              <form
                noValidate
                className="grid gap-1"
                aria-busy={loading}
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleSignUp();
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
                  <Label htmlFor="sign-up-name" className="text-[0.8125rem]">
                    {t('name_title')}
                  </Label>
                  <div className="relative">
                    <UserRound
                      className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-[1.125rem] -translate-y-1/2"
                      aria-hidden="true"
                    />
                    <Input
                      ref={nameRef}
                      id="sign-up-name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      placeholder={t('name_placeholder')}
                      required
                      aria-invalid={Boolean(nameError)}
                      aria-describedby={
                        nameError ? 'sign-up-name-error' : undefined
                      }
                      className="border-border/80 bg-background focus-visible:ring-auth-action/20 h-12 rounded-lg pl-11 shadow-none"
                      value={name}
                      onChange={(event) => {
                        setName(event.target.value);
                        if (fieldErrors.name) {
                          setFieldErrors((current) => ({
                            ...current,
                            name: undefined,
                          }));
                        }
                        if (formError) setFormError('');
                      }}
                    />
                  </div>
                  <p
                    id="sign-up-name-error"
                    className="text-auth-error min-h-5 text-xs leading-5"
                  >
                    {nameError || <span aria-hidden="true">&nbsp;</span>}
                  </p>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="sign-up-email" className="text-[0.8125rem]">
                    {t('email_title')}
                  </Label>
                  <div className="relative">
                    <Mail
                      className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-[1.125rem] -translate-y-1/2"
                      aria-hidden="true"
                    />
                    <Input
                      ref={emailRef}
                      id="sign-up-email"
                      name="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder={t('email_placeholder')}
                      required
                      aria-invalid={Boolean(emailError)}
                      aria-describedby={
                        emailError ? 'sign-up-email-error' : undefined
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
                    id="sign-up-email-error"
                    className="text-auth-error min-h-5 text-xs leading-5"
                  >
                    {emailError || <span aria-hidden="true">&nbsp;</span>}
                  </p>
                </div>

                <div className="grid gap-1.5">
                  <Label
                    htmlFor="sign-up-password"
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
                      id="sign-up-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      minLength={8}
                      placeholder={t('password_placeholder')}
                      required
                      aria-invalid={Boolean(passwordError)}
                      aria-describedby="sign-up-password-help sign-up-password-error"
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
                  <div className="min-h-5 text-xs leading-5">
                    <span
                      id="sign-up-password-help"
                      className={
                        passwordError ? 'sr-only' : 'text-muted-foreground'
                      }
                    >
                      {t('password_requirement')}
                    </span>
                    <span
                      id="sign-up-password-error"
                      className="text-auth-error"
                    >
                      {passwordError}
                    </span>
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <Label
                    htmlFor="sign-up-password-confirm"
                    className="text-[0.8125rem]"
                  >
                    {t('password_confirm_title')}
                  </Label>
                  <div className="relative">
                    <LockKeyhole
                      className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-[1.125rem] -translate-y-1/2"
                      aria-hidden="true"
                    />
                    <Input
                      ref={passwordConfirmRef}
                      id="sign-up-password-confirm"
                      name="passwordConfirm"
                      type={showPasswordConfirm ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder={t('password_confirm_placeholder')}
                      required
                      aria-invalid={Boolean(passwordConfirmError)}
                      aria-describedby={
                        passwordConfirmError
                          ? 'sign-up-password-confirm-error'
                          : undefined
                      }
                      className="border-border/80 bg-background focus-visible:ring-auth-action/20 h-12 rounded-lg pr-12 pl-11 shadow-none"
                      value={passwordConfirm}
                      onChange={(event) => {
                        setPasswordConfirm(event.target.value);
                        if (fieldErrors.passwordConfirm) {
                          setFieldErrors((current) => ({
                            ...current,
                            passwordConfirm: undefined,
                          }));
                        }
                        if (formError) setFormError('');
                      }}
                    />
                    <button
                      type="button"
                      aria-label={
                        showPasswordConfirm
                          ? t('hide_password_confirm')
                          : t('show_password_confirm')
                      }
                      aria-pressed={showPasswordConfirm}
                      className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-1 flex size-10 -translate-y-1/2 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
                      onClick={() =>
                        setShowPasswordConfirm((current) => !current)
                      }
                    >
                      {showPasswordConfirm ? (
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
                    id="sign-up-password-confirm-error"
                    className="text-auth-error min-h-5 text-xs leading-5"
                  >
                    {passwordConfirmError || (
                      <span aria-hidden="true">&nbsp;</span>
                    )}
                  </p>
                </div>

                {emailVerificationEnabled && (
                  <p className="mb-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-700 dark:text-amber-300">
                    {t('email_verification_hint')}
                  </p>
                )}

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
                    {t('sign_up_action')}
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
              <p className="text-muted-foreground text-center text-sm">
                {t('already_have_account')}{' '}
                {onSwitchToSignIn ? (
                  <button
                    type="button"
                    onClick={onSwitchToSignIn}
                    className="text-foreground font-semibold underline underline-offset-4"
                  >
                    {t('sign_in_title')}
                  </button>
                ) : (
                  <Link
                    href={signInHref}
                    className="text-foreground decoration-border hover:text-auth-action focus-visible:ring-ring font-semibold underline underline-offset-4 transition-colors focus-visible:rounded-sm focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {t('sign_in_title')}
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
