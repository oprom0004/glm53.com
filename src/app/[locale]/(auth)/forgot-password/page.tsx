import { PasswordForm } from '@/shared/blocks/sign/password-form';
import { getPublicConfigs } from '@/shared/models/config';

export default async function ForgotPasswordPage() {
  const configs = await getPublicConfigs();
  return (
    <PasswordForm
      mode="forgot"
      available={configs.auth_password_reset_ready === 'true'}
    />
  );
}
