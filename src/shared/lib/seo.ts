import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { absoluteAssetUrl, absoluteSiteUrl, siteConfig } from '@/config/site';

type SupportedLocale = 'en' | 'zh';

export type PageSeoDefinition = {
  path: string;
  title: string;
  description: string;
  keywords?: string;
};

type LocalizedPageSeo = Record<SupportedLocale, PageSeoDefinition>;

export const PUBLIC_PAGE_SEO: Record<string, LocalizedPageSeo> = {
  home: {
    en: {
      path: '/',
      title: 'GLM-5.3 — Next-Gen Open Frontier LLM with 1M Context & Advanced Reasoning',
      description:
        'Experience GLM-5.3: 753B MoE architecture, 1,000,000 token context window, state-of-the-art SWE-bench coding reasoning, and native autonomous agent workflows.',
    },
    zh: {
      path: '/',
      title: 'GLM-5.3 官方在线体验与开源前沿大模型门户',
      description:
        'GLM-5.3 拥有 753B MoE 架构与 100 万字长文本记忆，公认开源最强代码编写与工程推理能力，原生支持自主 Agent 与复杂任务拆解。',
    },
  },
  pricing: {
    en: {
      path: '/pricing',
      title: 'GLM-5.3 Pricing — Flexible Credit Packs & Unlimited Pro Subscriptions',
      description:
        'Access GLM-5.3 (753B) and GLM-5.3-Flash (320B) with permanent credit packs, monthly subscriptions, and enterprise dedicated throughput.',
    },
    zh: {
      path: '/pricing',
      title: 'GLM-5.3 定价方案 — 永久积分包与 Pro 开发者订阅',
      description:
        '随时体验 GLM-5.3 (753B) 旗舰版与 GLM-5.3-Flash 高速版，提供永久积分包、月付开发者订阅与企业高并发专属专线方案。',
    },
  },
  wan25: {
    en: {
      path: '/wan-2-5',
      title: 'Wan 2.5 AI Video Generator | WanAI',
      description:
        'Generate 2–10 second text-to-video and image-to-video clips with Wan 2.5 in 480P or 720P.',
    },
    zh: {
      path: '/wan-2-5',
      title: 'Wan 2.5 AI 视频生成器 | WanAI',
      description:
        '使用 Wan 2.5 生成 2–10 秒的文生视频或图生视频，支持 480P 与 720P。',
    },
  },
  wan26: {
    en: {
      path: '/wan-2-6',
      title: 'Wan 2.6 AI Video Generator | WanAI',
      description:
        'Generate 2–15 second text-to-video and image-to-video clips with Wan 2.6 up to 1080P.',
    },
    zh: {
      path: '/wan-2-6',
      title: 'Wan 2.6 AI 视频生成器 | WanAI',
      description:
        '使用 Wan 2.6 生成 2–15 秒的文生视频或图生视频，最高支持 1080P。',
    },
  },
  wan27: {
    en: {
      path: '/wan-2-7',
      title: 'Wan 2.7 AI Video Generator | WanAI',
      description:
        'Generate 2–15 second text-to-video and image-to-video clips with Wan 2.7 up to 1080P.',
    },
    zh: {
      path: '/wan-2-7',
      title: 'Wan 2.7 AI 视频生成器 | WanAI',
      description:
        '使用 Wan 2.7 生成 2–15 秒的文生视频或图生视频，最高支持 1080P。',
    },
  },
  wan3: {
    en: {
      path: '/wan-3',
      title: 'Wan 3.0 AI Video Generator | WanAI',
      description:
        'Create text-to-video, image-to-video, and reference-to-video clips up to 1080P with Wan 3.0.',
    },
    zh: {
      path: '/wan-3',
      title: 'Wan 3.0 AI 视频生成器 | WanAI',
      description:
        '使用 Wan 3.0 创建最高 1080P 的文生视频、图生视频与参考生视频。',
    },
  },
};

export function resolveSeoLocale(locale: string): SupportedLocale {
  return locale === 'zh' ? 'zh' : 'en';
}

export function buildPageMetadata({
  locale,
  path,
  title,
  description,
  keywords,
  imageUrl = siteConfig.previewImage,
  noIndex = false,
}: PageSeoDefinition & {
  locale: string;
  imageUrl?: string;
  noIndex?: boolean;
}): Metadata {
  const canonical = absoluteSiteUrl(path, locale);
  const image = absoluteAssetUrl(imageUrl);
  const languages = {
    en: absoluteSiteUrl(path, 'en'),
    zh: absoluteSiteUrl(path, 'zh'),
    'x-default': absoluteSiteUrl(path, siteConfig.defaultLocale),
  };

  return {
    metadataBase: new URL(siteConfig.url),
    title,
    description,
    keywords,
    alternates: { canonical, languages },
    openGraph: {
      type: 'website',
      locale: locale === 'zh' ? 'zh_CN' : 'en_US',
      url: canonical,
      title,
      description,
      siteName: siteConfig.name,
      images: [{ url: image, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
    robots: { index: !noIndex, follow: !noIndex },
  };
}

export function getPublicPageMetadata(page: keyof typeof PUBLIC_PAGE_SEO) {
  return async ({ params }: { params: Promise<{ locale: string }> }) => {
    const { locale } = await params;
    const normalized = resolveSeoLocale(locale);
    setRequestLocale(locale);
    return buildPageMetadata({ locale, ...PUBLIC_PAGE_SEO[page][normalized] });
  };
}

export function getMetadata(
  options: {
    title?: string;
    description?: string;
    keywords?: string;
    metadataKey?: string;
    canonicalUrl?: string;
    imageUrl?: string;
    appName?: string;
    noIndex?: boolean;
  } = {}
) {
  return async ({ params }: { params: Promise<{ locale: string }> }) => {
    const { locale } = await params;
    setRequestLocale(locale);
    const defaultMetadata = await getTranslatedMetadata(
      'common.metadata',
      locale
    );
    const translatedMetadata: Partial<
      Pick<PageSeoDefinition, 'title' | 'description' | 'keywords'>
    > = options.metadataKey
      ? await getTranslatedMetadata(options.metadataKey, locale)
      : {};

    return buildPageMetadata({
      locale,
      path: options.canonicalUrl || '/',
      title: options.title || translatedMetadata.title || defaultMetadata.title,
      description:
        options.description ||
        translatedMetadata.description ||
        defaultMetadata.description,
      keywords:
        options.keywords ||
        translatedMetadata.keywords ||
        defaultMetadata.keywords,
      imageUrl: options.imageUrl,
      noIndex: options.noIndex,
    });
  };
}

async function getTranslatedMetadata(metadataKey: string, locale: string) {
  setRequestLocale(locale);
  const t = await getTranslations(metadataKey);
  return {
    title: t.has('title') ? t('title') : '',
    description: t.has('description') ? t('description') : '',
    keywords: t.has('keywords') ? t('keywords') : '',
  };
}
