'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { WanDemoVideo } from './wan-demo-video';

export function WanFeatures() {
  const t = useTranslations('wan-home.features');
  return (
    <section id="features" className="py-20 md:py-28">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-foreground text-3xl font-bold tracking-tight md:text-5xl">
            {t('title')}
          </h2>
          <p className="text-muted-foreground mx-auto mt-5 text-base leading-7 sm:text-lg">
            {t('description')}
          </p>
        </div>

        <div className="mt-16 space-y-16">
          {/* Feature 1: 30s Long Video */}
          <article className="border-border/60 bg-card/90 grid items-center gap-8 rounded-[2rem] border p-6 shadow-sm md:grid-cols-[1.2fr_0.8fr] md:p-8">
            <div>
              <span className="inline-flex items-center rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-amber-700 uppercase dark:text-amber-200">
                {t('duration.eyebrow')}
              </span>
              <h3 className="text-foreground mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
                {t('duration.title')}
              </h3>
              <p className="text-muted-foreground mt-4 text-base leading-7">
                {t('duration.description')}
              </p>
              <div className="mt-6">
                <ul className="text-muted-foreground space-y-3 text-sm leading-6">
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-1 h-4 w-4 flex-none text-emerald-500" />
                    <span>{t('duration.benefits.0')}</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-1 h-4 w-4 flex-none text-emerald-500" />
                    <span>{t('duration.benefits.1')}</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-1 h-4 w-4 flex-none text-emerald-500" />
                    <span>{t('duration.benefits.2')}</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="border-border/60 bg-muted/30 h-[360px] overflow-hidden rounded-[1.75rem] border md:h-[420px]">
              <WanDemoVideo
                label={t('duration.video_label')}
                className="h-full w-full object-cover"
                src="/home/expected-4k-video-output.mp4"
              />
            </div>
          </article>

          {/* Feature 2: Multi-Subject Consistency */}
          <article className="border-border/60 bg-card/90 grid items-center gap-8 rounded-[2rem] border p-6 shadow-sm md:grid-cols-[0.9fr_1.1fr] md:p-8">
            {/* 4-Frame Video Grid */}
            <div className="border-border/60 bg-muted/30 order-2 grid grid-cols-2 gap-3 rounded-[1.75rem] border p-4 md:order-1">
              {[1, 2, 3, 4].map((num) => (
                <div
                  key={num}
                  className="group bg-muted/30 relative overflow-hidden rounded-[1.25rem] border border-violet-400/20"
                >
                  <div className="absolute top-2.5 left-2.5 z-10 rounded-full bg-black/50 px-2 py-0.5 backdrop-blur-md">
                    <span className="text-[10px] font-bold tracking-wider text-white uppercase">
                      {t('continuity.frame', { number: num })}
                    </span>
                  </div>
                  <WanDemoVideo
                    label={t('continuity.video_label', { number: num })}
                    className="aspect-[4/3] h-full w-full object-cover"
                    src={`/home/character-consistency-${num}.mp4`}
                  />
                </div>
              ))}
            </div>

            <div className="order-1 md:order-2">
              <span className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-emerald-700 uppercase dark:text-emerald-200">
                {t('continuity.eyebrow')}
              </span>
              <h3 className="text-foreground mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
                {t('continuity.title')}
              </h3>
              <p className="text-muted-foreground mt-4 text-base leading-7">
                {t('continuity.description')}
              </p>
              <div className="mt-6">
                <ul className="text-muted-foreground space-y-3 text-sm leading-6">
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-1 h-4 w-4 flex-none text-emerald-500" />
                    <span>{t('continuity.benefits.0')}</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-1 h-4 w-4 flex-none text-emerald-500" />
                    <span>{t('continuity.benefits.1')}</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-1 h-4 w-4 flex-none text-emerald-500" />
                    <span>{t('continuity.benefits.2')}</span>
                  </li>
                </ul>
              </div>
            </div>
          </article>

          {/* Feature 3: Cinematic Camera Movement */}
          <article className="border-border/60 bg-card/90 grid items-center gap-8 rounded-[2rem] border p-6 shadow-sm md:grid-cols-[1.2fr_0.8fr] md:p-8">
            <div>
              <span className="inline-flex items-center rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-sky-700 uppercase dark:text-sky-200">
                {t('direction.eyebrow')}
              </span>
              <h3 className="text-foreground mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
                {t('direction.title')}
              </h3>
              <p className="text-muted-foreground mt-4 text-base leading-7">
                {t('direction.description')}
              </p>
              <div className="mt-6">
                <ul className="text-muted-foreground space-y-3 text-sm leading-6">
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-1 h-4 w-4 flex-none text-emerald-500" />
                    <span>{t('direction.benefits.0')}</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-1 h-4 w-4 flex-none text-emerald-500" />
                    <span>{t('direction.benefits.1')}</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-1 h-4 w-4 flex-none text-emerald-500" />
                    <span>{t('direction.benefits.2')}</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="border-border/60 bg-muted/30 aspect-[4/3] overflow-hidden rounded-[1.75rem] border">
              <WanDemoVideo
                label={t('direction.video_label')}
                className="h-full w-full object-cover"
                src="/home/advanced-camera-control.mp4"
              />
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
