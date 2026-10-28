import type { MetadataRoute } from 'next';

import { publicGlmRoutes, siteConfig } from '@/config/site';

export function buildSitemapEntries(
  siteUrl = siteConfig.url
): MetadataRoute.Sitemap {
  const origin = new URL(siteUrl).origin;
  const absolute = (path: string, locale: 'en' | 'zh') => {
    const localized = locale === 'zh' ? `/zh${path === '/' ? '' : path}` : path;
    return `${origin}${localized === '/' ? '' : localized}`;
  };
  const now = new Date();

  return publicGlmRoutes.flatMap((path) =>
    (['en', 'zh'] as const).map((locale) => ({
      url: absolute(path, locale),
      lastModified: now,
      changeFrequency:
        path === '/' ? ('weekly' as const) : ('monthly' as const),
      priority:
        path === '/'
          ? 1
          : path === '/chat'
            ? 0.9
            : path.startsWith('/docs')
              ? 0.85
              : 0.8,
      alternates: {
        languages: {
          en: absolute(path, 'en'),
          zh: absolute(path, 'zh'),
          'x-default': absolute(path, 'en'),
        },
      },
    }))
  );
}

export default function sitemap(): MetadataRoute.Sitemap {
  return buildSitemapEntries();
}
