import { MetadataRoute } from 'next';

import { siteConfig } from '@/config/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/*?*q=',
        '/privacy-policy',
        '/terms-of-service',
        '/settings/*',
        '/my-videos',
        '/activity/*',
        '/admin/*',
        '/api/*',
        '/sign-in',
        '/sign-up',
        '/verify-email',
        '/auth-callback',
        '/auth-popup',
        '/zh/settings/*',
        '/zh/my-videos',
        '/zh/activity/*',
        '/zh/admin/*',
        '/zh/sign-in',
        '/zh/sign-up',
        '/zh/verify-email',
        '/zh/auth-callback',
        '/zh/auth-popup',
      ],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
