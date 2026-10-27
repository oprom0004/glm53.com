'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useLocale } from 'next-intl';

import { signIn } from '@/core/auth/client';
import { Link } from '@/core/i18n/navigation';
import { defaultLocale } from '@/config/locale';

function AuthPopupContent() {
  const provider = useSearchParams().get('provider') || '';
  const locale = useLocale();
  const [failed, setFailed] = useState(false);
  const supported = provider === 'google' || provider === 'github';
  useEffect(() => {
    if (!supported) return;
    let active = true;
    const timer = setTimeout(() => {
      void signIn
        .social({
          provider,
          callbackURL: `${locale === defaultLocale ? '' : `/${locale}`}/auth-callback`,
        })
        .then((result) => {
          if (active && result.error) setFailed(true);
        })
        .catch(() => {
          if (active) setFailed(true);
        });
    }, 0);
    return () => {
      clearTimeout(timer);
      active = false;
    };
  }, [provider, locale, supported]);
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-6 text-center">
      {failed || !supported ? (
        <>
          <p role="alert">
            {locale === 'zh'
              ? '第三方登录暂时无法完成，请返回登录页面重试。'
              : 'Social sign-in could not be started. Return to sign-in and try again.'}
          </p>
          <Link href="/sign-in" className="text-violet-600 underline">
            {locale === 'zh' ? '返回登录' : 'Back to sign in'}
          </Link>
        </>
      ) : (
        <>
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
          <p>
            {locale === 'zh'
              ? '正在前往登录页面…'
              : `Redirecting to ${provider}…`}
          </p>
        </>
      )}
    </div>
  );
}
export default function AuthPopupPage() {
  return (
    <Suspense fallback={<Loader2 className="animate-spin" />}>
      <AuthPopupContent />
    </Suspense>
  );
}
