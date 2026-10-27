'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { RiGithubFill } from 'react-icons/ri';
import { toast } from 'sonner';

import { authClient, signIn } from '@/core/auth/client';
import { defaultLocale } from '@/config/locale';
import { Button } from '@/shared/components/ui/button';
import { useAppContext } from '@/shared/contexts/app';

import { normalizeAuthCallbackPath } from './auth-validation';

export function SocialProviders({
  configs,
  callbackUrl,
  loading,
  setLoading,
  onAuthenticated,
}: {
  configs: Record<string, string>;
  callbackUrl: string;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  onAuthenticated?: () => Promise<void> | void;
}) {
  const t = useTranslations('common.sign');
  const locale = useLocale();
  const { setIsShowSignModal } = useAppContext();
  const [error, setError] = useState('');
  const popupTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const popupStartedAt = useRef(0);
  const finishing = useRef(false);
  const callback = normalizeAuthCallbackPath(callbackUrl);
  const localizedCallback =
    locale !== defaultLocale &&
    !callback.startsWith(`/${locale}/`) &&
    callback !== `/${locale}`
      ? `/${locale}${callback}`
      : callback;
  const completion = useRef({
    onAuthenticated,
    callbackUrl: localizedCallback,
  });
  completion.current = { onAuthenticated, callbackUrl: localizedCallback };
  const googleReady = configs.auth_google_ready === 'true';
  const cleanup = useCallback(() => {
    if (popupTimer.current) clearInterval(popupTimer.current);
    popupTimer.current = null;
  }, []);
  const complete = useCallback(async () => {
    if (finishing.current) return;
    finishing.current = true;
    try {
      // A storage notification alone is not proof of a successful sign-in.
      const response = await fetch('/api/auth/get-session', {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const session = await response.json();
      if (!response.ok || !session?.user?.id) throw new Error('no_session');
      // OAuth ran in another window, so this window's session hook is still stale.
      authClient.$store.notify('$sessionSignal');
      cleanup();
      if (completion.current.onAuthenticated) {
        await completion.current.onAuthenticated();
        setIsShowSignModal(false);
        setLoading(false);
      } else {
        window.location.assign(completion.current.callbackUrl);
      }
    } catch {
      setError(t('social_sign_in_error'));
      setLoading(false);
    } finally {
      cleanup();
      popupStartedAt.current = 0;
      finishing.current = false;
    }
  }, [cleanup, setIsShowSignModal, setLoading, t]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === 'auth-callback-success' &&
        event.newValue &&
        popupStartedAt.current > 0 &&
        Number(event.newValue) >= popupStartedAt.current
      )
        void complete();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      cleanup();
    };
  }, [complete, cleanup]);

  const handleSignIn = async (provider: 'google' | 'github') => {
    if (loading) return;
    setError('');
    if (provider === 'google' && !googleReady) {
      setError(t('google_unavailable'));
      return;
    }
    setLoading(true);
    popupStartedAt.current = Date.now();
    const base = locale === defaultLocale ? '' : `/${locale}`;
    const popup = window.open(
      `${window.location.origin}${base}/auth-popup?provider=${provider}`,
      'oauth-popup',
      `width=500,height=600,left=${window.screenX + (window.outerWidth - 500) / 2},top=${window.screenY + (window.outerHeight - 600) / 2},toolbar=no,menubar=no,scrollbars=yes`
    );
    if (!popup) {
      toast.info(t('popup_blocked'));
      try {
        const result = await signIn.social({
          provider,
          callbackURL: localizedCallback,
        });
        if (result.error) throw new Error('oauth_failed');
      } catch {
        setError(t('social_sign_in_error'));
        setLoading(false);
      }
      return;
    }
    popupTimer.current = setInterval(() => {
      // COOP can prevent observing popup.closed. Do not leave the form locked forever.
      if (Date.now() - popupStartedAt.current > 5 * 60_000) {
        cleanup();
        setLoading(false);
        return;
      }
      try {
        if (popup.closed) {
          cleanup();
          setLoading(false);
        }
      } catch {
        /* Completion is also delivered through the storage event. */
      }
    }, 500);
  };
  return (
    <div className="grid w-full gap-3" aria-busy={loading}>
      <Button
        type="button"
        variant="outline"
        disabled={loading}
        className="h-13 w-full cursor-pointer gap-3 rounded-lg border bg-[#f2f2f2] text-base font-medium text-[#1f1f1f] shadow-sm hover:bg-[#e8e8e8] hover:text-[#1f1f1f] hover:shadow-md focus-visible:ring-[#4285f4]/30 dark:bg-[#f2f2f2] dark:hover:bg-[#e8e8e8]"
        style={{
          fontFamily: '"Google Sans", Arial, sans-serif',
          borderColor: '#747775',
        }}
        onClick={() => void handleSignIn('google')}
      >
        <Image
          src="/images/brands/google-g.png"
          alt=""
          width={24}
          height={24}
          className="size-6 shrink-0"
          unoptimized
          aria-hidden="true"
        />
        {t('google_sign_in_title')}
      </Button>
      {configs.auth_github_ready === 'true' && (
        <Button
          type="button"
          variant="outline"
          className="h-12 w-full gap-3 rounded-lg"
          disabled={loading}
          onClick={() => void handleSignIn('github')}
        >
          <RiGithubFill aria-hidden="true" />
          {t('github_sign_in_title')}
        </Button>
      )}
      {error && (
        <p
          role="alert"
          className="text-muted-foreground text-center text-xs leading-5"
        >
          {error}
        </p>
      )}
    </div>
  );
}
