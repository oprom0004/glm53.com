import { getTranslations } from 'next-intl/server';

import { redirect } from '@/core/i18n/navigation';
import { envConfigs } from '@/config';
import { defaultLocale } from '@/config/locale';
import { normalizeAuthCallbackPath } from '@/shared/blocks/sign/auth-validation';
import { SignIn } from '@/shared/blocks/sign/sign-in';
import { getPublicConfigs } from '@/shared/models/config';
import { getSignUser } from '@/shared/models/user';

function stripLocalePrefix(path: string, locale: string) {
  if (!path?.startsWith('/')) return '/';
  if (locale === defaultLocale) return path;
  if (path === `/${locale}`) return '/';
  if (path.startsWith(`/${locale}/`))
    return path.slice(locale.length + 1) || '/';
  return path;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const t = await getTranslations('common');

  return {
    title: `${t('sign.sign_in_title')} - ${t('metadata.title')}`,
    alternates: {
      canonical:
        locale !== defaultLocale
          ? `${envConfigs.app_url}/${locale}/sign-in`
          : `${envConfigs.app_url}/sign-in`,
    },
  };
}

export default async function SignInPage({
  searchParams,
  params,
}: {
  searchParams: Promise<{
    callbackUrl?: string;
    email?: string;
    verified?: string;
    method?: string;
  }>;
  params: Promise<{ locale: string }>;
}) {
  const { callbackUrl, email, method } = await searchParams;
  const { locale } = await params;
  const safeCallbackUrl = normalizeAuthCallbackPath(callbackUrl);

  // If user is already signed in, don't show sign-in form again.
  const sessionUser = await getSignUser();
  if (sessionUser) {
    const target = stripLocalePrefix(safeCallbackUrl, locale);
    redirect({ href: target || '/', locale });
  }

  // SECURITY: must use getPublicConfigs() here — `configs` is passed to a
  // client component and would otherwise serialize all DB-stored secrets
  // (provider API keys, client secrets, etc.) into the page HTML/RSC payload.
  const configs = await getPublicConfigs();

  return (
    <SignIn
      configs={configs}
      callbackUrl={safeCallbackUrl}
      defaultEmail={email || ''}
      defaultEmailExpanded={method === 'email'}
    />
  );
}
