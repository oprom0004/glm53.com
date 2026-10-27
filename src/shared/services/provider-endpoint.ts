/** Admin-owned API endpoints. Credentials, query strings and local hosts are not accepted. */
export function normalizeProviderBaseUrl(value: string): string {
  const input = value.trim();
  try {
    if (!input || /[\s\\\u0000-\u001f\u007f]/.test(input)) throw new Error();
    const url = new URL(input);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      input.includes('?') ||
      input.includes('#') ||
      url.port ||
      !isPublicHostname(url.hostname) ||
      input.includes('%') ||
      input.split('/').includes('..')
    )
      throw new Error();
    return url.href.replace(/\/+$/, '');
  } catch {
    throw new Error('invalid_base_url');
  }
}

export function isPublicHostname(host: string): boolean {
  return (
    host.length <= 253 &&
    /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]*$/i.test(host) &&
    !/(?:^|\.)(?:localhost|local|internal|test|invalid)$/i.test(host)
  );
}

/** Wan compatible gateways use the same paths as the existing Wan adapter. */
export function wanApiUrl(baseUrl: string, path: string) {
  const base = normalizeProviderBaseUrl(baseUrl);
  // Accept either an origin/prefix or a prefix ending in /v1 or /api/v1.
  const suffix = base.endsWith('/api/v1')
    ? '/api/v1'
    : base.endsWith('/v1')
      ? '/v1'
      : '';
  return `${suffix ? base.slice(0, -suffix.length) : base}${path}`;
}

export function isProviderModelId(value: string) {
  return (
    value.length <= 200 &&
    /^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(value) &&
    !value.includes('..') &&
    !value.includes('//')
  );
}

export function normalizeOutputHosts(value: string) {
  const hosts = [
    ...new Set(
      value
        .toLowerCase()
        .split(/[\s,]+/)
        .filter(Boolean)
    ),
  ];
  if (hosts.length > 50 || hosts.some((host) => !isPublicHostname(host))) {
    throw new Error('invalid_output_hosts');
  }
  return hosts;
}
