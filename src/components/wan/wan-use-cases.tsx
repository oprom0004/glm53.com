'use client';

import React from 'react';
import Image from 'next/image';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function WanUseCases() {
  const t = useTranslations('wan-home.use_cases');
  const images = [
    '/wan-2.7/8.cover.webp',
    '/wan-2.7/12.cover.webp',
    '/wan-2.7/16.cover.webp',
  ];
  const cases = (
    t.raw('items') as {
      title: string;
      category: string;
      description: string;
      bullets: string[];
    }[]
  ).map((item, index) => ({ ...item, image: images[index] }));

  return (
    <section id="use-cases" className="py-20 md:py-28">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-foreground text-3xl font-bold tracking-tight md:text-5xl">
            {t('title')}
          </h2>
          <p className="text-muted-foreground mx-auto mt-5 text-base leading-7 sm:text-lg">
            {t('description')}
          </p>
        </div>

        <div className="mt-14 grid gap-8 lg:grid-cols-3">
          {cases.map((c, i) => (
            <article
              key={i}
              className="border-border/60 bg-card flex flex-col overflow-hidden rounded-[2rem] border shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="bg-muted/40 relative aspect-[16/9] w-full overflow-hidden">
                <Image
                  src={c.image}
                  alt={c.title}
                  fill
                  className="object-cover transition-transform duration-500 hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </div>

              <div className="flex flex-grow flex-col p-6">
                <p className="text-xs font-semibold tracking-[0.16em] text-violet-700 uppercase dark:text-violet-300">
                  {c.category}
                </p>
                <h3 className="text-foreground mt-3 text-xl font-bold tracking-tight">
                  {c.title}
                </h3>
                <p className="text-muted-foreground mt-4 flex-1 text-sm leading-6">
                  {c.description}
                </p>

                <ul className="border-border/40 text-muted-foreground mt-6 space-y-2.5 border-t pt-6 text-sm">
                  {c.bullets.map((b, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <Check className="mt-1 h-4 w-4 flex-none text-violet-500" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
