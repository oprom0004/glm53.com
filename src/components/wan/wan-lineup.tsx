'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/core/i18n/navigation';

export function WanLineup() {
  const t = useTranslations('wan-home.lineup');
  const versions = [
    { key: 'v30', name: 'Wan 3.0', href: '/wan-3', isFeatured: true },
    { key: 'v27', name: 'Wan 2.7', href: '/wan-2-7', isFeatured: false },
    { key: 'v26', name: 'Wan 2.6', href: '/wan-2-6', isFeatured: false },
    { key: 'v25', name: 'Wan 2.5', href: '/wan-2-5', isFeatured: false },
  ].map((model) => ({
    ...model,
    badge: t(`models.${model.key}.badge`),
    description: t(`models.${model.key}.description`),
    features: t.raw(`models.${model.key}.features`) as string[],
    buttonText: t(`models.${model.key}.buttonText`),
    badgeColor: model.isFeatured
      ? 'border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-300'
      : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  }));

  return (
    <section
      id="versions"
      className="bg-muted/40 border-border/40 border-y py-20 md:py-28"
    >
      <div className="container mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center rounded-full border border-sky-400/20 bg-sky-500/8 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-sky-700 uppercase dark:text-sky-200">
            {t('eyebrow')}
          </span>
          <h2 className="text-foreground mt-5 text-3xl font-bold tracking-tight md:text-5xl">
            {t('title')}
          </h2>
          <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-base leading-7 sm:text-lg">
            {t('description')}
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {versions.map((ver) => (
            <article
              key={ver.name}
              className={`flex h-full flex-col rounded-[2rem] border p-6 transition-all ${
                ver.isFeatured
                  ? 'via-card to-card border-violet-500/60 bg-gradient-to-b from-violet-500/10 shadow-[0_20px_70px_rgba(139,92,246,0.16)] ring-1 ring-violet-500/30'
                  : 'border-border/70 bg-card/90 shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-foreground text-2xl font-bold tracking-tight">
                    {ver.name}
                  </h3>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${ver.badgeColor}`}
                >
                  {ver.badge}
                </span>
              </div>

              <p className="text-muted-foreground mt-5 text-sm leading-6">
                {ver.description}
              </p>

              <ul className="text-muted-foreground mt-6 flex-grow space-y-3 text-sm leading-6">
                {ver.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5">
                    <Check className="mt-1 h-4 w-4 flex-none text-violet-500" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={ver.href}
                className={`mt-8 inline-flex h-11 w-full items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                  ver.isFeatured
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20 hover:bg-violet-500'
                    : 'border-border bg-background text-foreground hover:bg-muted/70 border'
                }`}
              >
                {ver.buttonText}
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
