'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

import { Link } from '@/core/i18n/navigation';

import { WanDemoVideo } from './wan-demo-video';

export function WanHero() {
  const t = useTranslations('wan-home.hero');
  return (
    <section className="relative overflow-hidden pt-10 pb-20 md:pt-16 md:pb-28">
      {/* Background Glows */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.18),_transparent_36%),radial-gradient(circle_at_20%_70%,_rgba(56,189,248,0.12),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.96),_rgba(248,250,252,0.98))] dark:bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.26),_transparent_36%),radial-gradient(circle_at_20%_70%,_rgba(56,189,248,0.14),_transparent_28%),linear-gradient(180deg,_rgba(15,15,35,0.98),_rgba(10,10,24,1))]"></div>
      <div className="pointer-events-none absolute top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-violet-500/10 blur-3xl"></div>
      <div className="pointer-events-none absolute top-[22rem] right-[8%] h-44 w-44 rounded-full bg-sky-400/10 blur-3xl"></div>

      <div className="relative z-10 container mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-5xl text-center">
          {/* Top Pill Badge */}
          <div className="inline-flex items-center gap-3 rounded-full border border-violet-400/20 bg-white/75 px-4 py-2 text-sm text-violet-700 shadow-[0_12px_30px_rgba(139,92,246,0.08)] backdrop-blur dark:bg-white/5 dark:text-violet-200">
            <span className="h-2.5 w-2.5 rounded-full bg-violet-500 motion-safe:animate-pulse"></span>
            <span className="font-semibold">{t('eyebrow')}</span>
          </div>

          {/* Big Title */}
          <h1 className="text-foreground mt-6 text-[2.5rem] leading-[1.1] font-extrabold tracking-tight text-balance md:text-[3.875rem] lg:text-[4.5rem]">
            <span className="block">{t('title')}</span>
            <span className="mt-2 block text-[0.65em] font-bold text-violet-600 dark:text-violet-400">
              — {t('subtitle')}
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-muted-foreground mx-auto mt-6 max-w-3xl text-sm leading-7 font-normal sm:text-lg sm:leading-8">
            {t('description')}
          </p>

          {/* CTA Buttons */}
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/wan-3"
              className="inline-flex h-12 min-w-[220px] items-center justify-center rounded-full bg-violet-600 px-6 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(124,58,237,0.28)] transition-all hover:-translate-y-0.5 hover:bg-violet-500 hover:shadow-[0_20px_50px_rgba(124,58,237,0.34)]"
            >
              ✦ {t('create')}
            </Link>
            <Link
              href="/wan-3#generator"
              className="border-border bg-background/90 text-foreground hover:bg-muted inline-flex h-12 min-w-[200px] items-center justify-center rounded-full border px-6 text-sm font-semibold shadow-sm transition-all hover:-translate-y-0.5"
            >
              {t('studio')}
            </Link>
          </div>
        </div>

        {/* Hero Video Showcase Card */}
        <div className="border-border/60 relative left-1/2 mt-14 w-[94vw] max-w-5xl -translate-x-1/2 overflow-hidden rounded-[1rem] border bg-slate-950 shadow-[0_30px_80px_rgba(15,23,42,0.18)] ring-1 ring-white/10 sm:rounded-[2rem]">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 text-xs tracking-[0.2em] text-white/60 uppercase">
            <span>{t('shot')}</span>
            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 motion-safe:animate-ping"></span>
              {t('status')}
            </span>
          </div>
          <WanDemoVideo
            label={t('video_label')}
            className="aspect-[16/8.4] w-full object-cover"
            src="/home/wan-3-preview-1.mp4"
          />
        </div>
      </div>
    </section>
  );
}
