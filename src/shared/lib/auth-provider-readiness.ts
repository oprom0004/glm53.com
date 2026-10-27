export type AuthProviderReadiness = {
  email: boolean;
  google: boolean;
  github: boolean;
};

function isEnabled(value: string | undefined, defaultValue = false) {
  return value === undefined ? defaultValue : value === 'true';
}

export function getAuthProviderReadiness(
  configs: Record<string, string | undefined>
): AuthProviderReadiness {
  return {
    email: isEnabled(configs.email_auth_enabled, true),
    google:
      isEnabled(configs.google_auth_enabled) &&
      Boolean(configs.google_client_id?.trim()) &&
      Boolean(configs.google_client_secret?.trim()),
    github:
      isEnabled(configs.github_auth_enabled) &&
      Boolean(configs.github_client_id?.trim()) &&
      Boolean(configs.github_client_secret?.trim()),
  };
}

export function readinessToPublicConfig(
  readiness: AuthProviderReadiness
): Record<string, string> {
  return {
    auth_email_ready: String(readiness.email),
    auth_google_ready: String(readiness.google),
    auth_github_ready: String(readiness.github),
  };
}

export function isAuthEmailDeliveryReady(
  configs: Record<string, string | undefined>
) {
  return Boolean(
    configs.resend_api_key?.trim() && configs.resend_sender_email?.trim()
  );
}
