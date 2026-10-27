'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';

import { Link } from '@/core/i18n/navigation';

export function WanFooter() {
  const t = useTranslations('pages.index.page.navigation');
  return (
    <footer className="border-border bg-background text-foreground border-t">
      <div className="container mx-auto max-w-7xl px-6 py-16 md:py-20">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.3fr_1fr_1.15fr] lg:gap-20">
          <div>
            <Link href="/" className="mb-6 inline-flex items-center gap-2">
              <div className="relative h-8 w-8 flex-shrink-0">
                <Image
                  src="/logo.webp"
                  alt="WanAI 3.0"
                  width={32}
                  height={32}
                  className="object-contain"
                />
              </div>
              <span className="text-foreground text-xl font-bold">
                WanAI 3.0
              </span>
            </Link>
            <p className="text-muted-foreground max-w-sm text-[15px] leading-7">
              {t('footer_description')}
            </p>
          </div>

          <div>
            <div className="text-foreground/80 mb-5 text-xs font-semibold tracking-[0.18em] uppercase">
              {t('products')}
            </div>
            <ul className="space-y-2.5">
              <li>
                <Link
                  href="/pricing"
                  className="text-muted-foreground hover:text-foreground text-[14px] transition-colors"
                >
                  {t('pricing')}
                </Link>
              </li>
              <li>
                <Link
                  href="/wan-3"
                  className="text-muted-foreground hover:text-foreground text-[14px] transition-colors"
                >
                  Wan 3.0 {t('video_generator')}
                </Link>
              </li>
              <li>
                <Link
                  href="/wan-2-7"
                  className="text-muted-foreground hover:text-foreground text-[14px] transition-colors"
                >
                  Wan 2.7 {t('video_generator')}
                </Link>
              </li>
              <li>
                <Link
                  href="/wan-2-6"
                  className="text-muted-foreground hover:text-foreground text-[14px] transition-colors"
                >
                  Wan 2.6 {t('video_generator')}
                </Link>
              </li>
              <li>
                <Link
                  href="/wan-2-5"
                  className="text-muted-foreground hover:text-foreground text-[14px] transition-colors"
                >
                  Wan 2.5 {t('video_generator')}
                </Link>
              </li>
            </ul>

            <div className="mt-8">
              <div className="text-foreground/80 mb-3 text-xs font-semibold tracking-[0.18em] uppercase">
                {t('support')}
              </div>
              <a
                href="mailto:contact@wanai30.com"
                className="text-muted-foreground hover:text-foreground text-[14px] transition-colors"
              >
                contact@wanai30.com
              </a>
            </div>
          </div>

          <div>
            <div className="text-foreground/80 mb-5 text-xs font-semibold tracking-[0.18em] uppercase">
              {t('resources')}
            </div>
            <ul className="space-y-2.5">
              <li>
                <Link
                  href="/#features"
                  className="text-muted-foreground hover:text-foreground text-[14px] transition-colors"
                >
                  {t('features_guide')}
                </Link>
              </li>
              <li>
                <Link
                  href="/#compare"
                  className="text-muted-foreground hover:text-foreground text-[14px] transition-colors"
                >
                  {t('comparison')}
                </Link>
              </li>
              <li>
                <Link
                  href="/#use-cases"
                  className="text-muted-foreground hover:text-foreground text-[14px] transition-colors"
                >
                  {t('showcase')}
                </Link>
              </li>
              <li>
                <Link
                  href="/#faq"
                  className="text-muted-foreground hover:text-foreground text-[14px] transition-colors"
                >
                  {t('faq')}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Legal and Copyright Bar */}
        <div className="border-border/70 text-muted-foreground mt-14 flex flex-col gap-4 border-t pt-6 text-sm md:flex-row md:items-center md:justify-between">
          <p>
            © 2026{' '}
            <span className="text-foreground font-semibold">wanai30.com</span>.{' '}
            {t('rights')}
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
            <Link
              href="/privacy-policy"
              className="hover:text-foreground transition-colors"
            >
              {t('privacy')}
            </Link>
            <Link
              href="/terms-of-service"
              className="hover:text-foreground transition-colors"
            >
              {t('terms')}
            </Link>
            <Link
              href="/refund"
              className="hover:text-foreground transition-colors"
            >
              {t('refund')}
            </Link>
            <Link
              href="/disclaimer"
              className="hover:text-foreground transition-colors"
            >
              {t('disclaimer_title')}
            </Link>
          </div>
        </div>

        <div className="border-border/70 mt-6 border-t pt-6">
          <p className="text-muted-foreground/75 max-w-5xl text-xs leading-5">
            {t('disclaimer_title')}: {t('disclaimer')}
          </p>
        </div>
      </div>
    </footer>
  );
}
