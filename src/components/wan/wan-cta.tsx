'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

import { Link } from '@/core/i18n/navigation';

export function WanCta() {
  const t = useTranslations('wan-home.cta');
  return (
    <section
      id="waitlist"
      className="relative overflow-hidden pt-20 pb-24 md:pt-24 md:pb-28"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.18),_transparent_35%),linear-gradient(180deg,_rgba(139,92,246,0.06),_rgba(56,189,248,0.04))]"></div>
      <div className="relative z-10 container mx-auto max-w-5xl px-4 sm:px-6">
        <div className="bg-background/90 rounded-[2.25rem] border border-violet-400/20 px-6 py-12 text-center shadow-[0_30px_90px_rgba(139,92,246,0.12)] backdrop-blur md:px-12 md:py-16">
          <h2 className="text-foreground mx-auto max-w-3xl text-3xl font-bold tracking-tight text-balance md:text-5xl lg:text-6xl">
            {t('title')}
          </h2>
          <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-base leading-7 sm:text-lg">
            {t('description')}
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/wan-3"
              className="inline-flex h-14 items-center justify-center rounded-full bg-violet-600 px-10 text-base font-bold text-white shadow-lg shadow-violet-500/25 transition-all hover:bg-violet-500 hover:shadow-violet-500/40"
            >
              {t('create')}
            </Link>
          </div>

          <p className="text-muted-foreground mt-6 text-xs sm:text-sm">
            {t('proof')}
          </p>
        </div>
      </div>
    </section>
  );
}
