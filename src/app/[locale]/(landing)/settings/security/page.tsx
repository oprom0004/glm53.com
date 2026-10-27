import { getLocale } from 'next-intl/server';

import { redirect } from '@/core/i18n/navigation';
import { PasswordForm } from '@/shared/blocks/sign/password-form';
import { getUserInfo } from '@/shared/models/user';

export default async function SecurityPage() {
  const locale = await getLocale();
  const user = await getUserInfo();
  if (!user)
    redirect({ href: '/sign-in?callbackUrl=%2Fsettings%2Fsecurity', locale });
  return <PasswordForm mode="change" />;
}
