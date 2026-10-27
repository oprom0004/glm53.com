import { PasswordForm } from '@/shared/blocks/sign/password-form';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <PasswordForm mode="reset" token={typeof token === 'string' ? token : ''} />
  );
}
