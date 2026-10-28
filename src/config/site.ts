import { envConfigs } from '@/config';
import { defaultLocale, locales } from '@/config/locale';

const SAFE_PRODUCTION_URL = 'https://glm53.com';

export function normalizeSiteUrl(value?: string) {
  try {
    const url = new URL(String(value || '').trim());
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    return url.origin;
  } catch {
    return SAFE_PRODUCTION_URL;
  }
}

export const siteConfig = {
  // Public identity is independent of local preview / auth callback origins.
  url: normalizeSiteUrl(envConfigs.site_url),
  name:
    !envConfigs.app_name || envConfigs.app_name === 'ShipAny App'
      ? 'GLM-5.3'
      : envConfigs.app_name,
  description:
    envConfigs.app_description ||
    'GLM-5.3 Frontier Open Source Large Language Model with 1M Context Window and SWE-bench Leading Code Reasoning.',
  previewImage: envConfigs.app_preview_image || '/preview.png',
  defaultLocale,
  locales,
} as const;

export const publicGlmRoutes = [
  '/',
  '/chat',
  '/pricing',
  '/docs',
  '/blog',
  '/docs/api-reference',
  '/docs/prompt-guide',
  '/docs/swe-bench-debug',
  '/docs/deployment-guide',
  '/docs/glm-5-3-vs-claude-3-5-sonnet',
  '/docs/glm-5-3-vs-deepseek-v3',
  '/docs/glm-5-3-vs-openai-codex',
  '/docs/solutions-1m-codebase',
  '/docs/solutions-autonomous-agent',
  '/docs/solutions-private-deployment',
] as const;

export const publicWanRoutes = publicGlmRoutes;

export function localizedPath(path: string, locale: string) {
  const normalized =
    path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
  return `${locale === defaultLocale ? '' : `/${locale}`}${normalized}` || '/';
}

export function absoluteSiteUrl(path = '/', locale?: string) {
  const localized = locale ? localizedPath(path, locale) : path;
  const normalized = localized.startsWith('/') ? localized : `/${localized}`;
  return `${siteConfig.url}${normalized === '/' ? '' : normalized}`;
}

export function absoluteAssetUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return absoluteSiteUrl(path);
}
