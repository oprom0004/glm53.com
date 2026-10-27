'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

import { Link } from '@/core/i18n/navigation';

export function WanComparison() {
  const t = useTranslations('wan-home.comparison');
  const tableData = t.raw('rows') as {
    spec: string;
    v25: string;
    v26: string;
    v27: string;
    v30: string;
  }[];

  return (
    <section
      id="compare"
      className="bg-muted/30 border-border/40 border-t py-20 md:py-28"
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

        <div className="border-border/60 bg-background mt-12 overflow-x-auto rounded-[2rem] border shadow-sm">
          <table className="w-full min-w-[850px] border-collapse text-left">
            <thead>
              <tr className="border-border/60 border-b">
                <th className="text-foreground px-6 py-5 text-sm font-semibold">
                  {t('spec')}
                </th>
                <th className="text-foreground px-6 py-5 text-sm font-semibold">
                  Wan 2.5
                </th>
                <th className="text-foreground px-6 py-5 text-sm font-semibold">
                  Wan 2.6
                </th>
                <th className="text-foreground px-6 py-5 text-sm font-semibold">
                  Wan 2.7
                </th>
                <th className="bg-violet-500/10 px-6 py-5 text-sm font-bold text-violet-700 dark:text-violet-200">
                  Wan 3.0 ✦
                </th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, idx) => (
                <tr
                  key={idx}
                  className="border-border/40 hover:bg-muted/20 border-b transition-colors last:border-b-0"
                >
                  <td className="text-foreground px-6 py-4 text-sm font-medium">
                    {row.spec}
                  </td>
                  <td className="text-muted-foreground px-6 py-4 text-sm">
                    {row.v25}
                  </td>
                  <td className="text-muted-foreground px-6 py-4 text-sm">
                    {row.v26}
                  </td>
                  <td className="text-muted-foreground px-6 py-4 text-sm">
                    {row.v27}
                  </td>
                  <td className="bg-violet-500/10 px-6 py-4 text-sm font-semibold text-violet-700 dark:text-violet-300">
                    {row.v30}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/wan-3"
            className="inline-flex h-12 items-center justify-center rounded-full bg-violet-600 px-8 text-sm font-semibold text-white shadow-md shadow-violet-500/20 transition-colors hover:bg-violet-500"
          >
            {t('create')}
          </Link>
        </div>
      </div>
    </section>
  );
}
