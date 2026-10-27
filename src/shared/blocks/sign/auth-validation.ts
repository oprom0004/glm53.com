export type AuthFieldErrors = Partial<
  Record<'name' | 'email' | 'password' | 'passwordConfirm', string>
>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeAuthCallbackPath(raw?: string): string {
  const value = String(raw || '').trim();
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  if (/[%](?:0a|0d|2f|5c)|[\r\n\\]/i.test(value)) return '/';

  try {
    const trustedOrigin = 'https://wanai.local';
    const parsed = new URL(value, trustedOrigin);
    if (parsed.origin !== trustedOrigin) return '/';

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/';
  }
}

export function validateSignIn(values: {
  email: string;
  password: string;
}): AuthFieldErrors {
  const errors: AuthFieldErrors = {};

  if (!values.email.trim()) {
    errors.email = 'validation_email_required';
  } else if (!EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = 'validation_email_invalid';
  }

  if (!values.password) {
    errors.password = 'validation_password_required';
  }

  return errors;
}

export function validateSignUp(values: {
  name: string;
  email: string;
  password: string;
  passwordConfirm: string;
}): AuthFieldErrors {
  const errors = validateSignIn(values);

  if (!values.name.trim()) {
    errors.name = 'validation_name_required';
  }

  if (values.password && values.password.length < 8) {
    errors.password = 'validation_password_length';
  }

  if (!values.passwordConfirm) {
    errors.passwordConfirm = 'validation_password_confirm_required';
  } else if (values.passwordConfirm !== values.password) {
    errors.passwordConfirm = 'validation_password_mismatch';
  }

  return errors;
}
