'use client';

import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function WanFaq() {
  const t = useTranslations('wan-home.faq');
  const faqs = t.raw('items') as { q: string; a: string }[];

  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section
      id="faq"
      className="bg-muted/20 border-border/40 border-t py-20 md:py-28"
    >
      <div className="container mx-auto max-w-4xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center rounded-full border border-violet-400/20 bg-violet-500/8 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-violet-700 uppercase dark:text-violet-200">
            {t('eyebrow')}
          </span>
          <h2 className="text-foreground mt-4 text-3xl font-bold tracking-tight md:text-5xl">
            {t('title')}
          </h2>
        </div>

        <div className="mt-12 space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="border-border/60 bg-card rounded-[1.5rem] border px-6 py-5 shadow-sm transition-all"
              >
                <button
                  type="button"
                  id={`faq-question-${idx}`}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${idx}`}
                  onClick={() => toggle(idx)}
                  className="text-foreground flex w-full cursor-pointer items-center justify-between text-left text-lg font-semibold hover:text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <span>{faq.q}</span>
                  <ChevronRight
                    className={`text-muted-foreground h-5 w-5 flex-none transition-transform duration-300 ${
                      isOpen ? 'rotate-90 text-violet-600' : ''
                    }`}
                  />
                </button>
                <p
                  id={`faq-answer-${idx}`}
                  role="region"
                  aria-labelledby={`faq-question-${idx}`}
                  hidden={!isOpen}
                  className="text-muted-foreground animate-fadeIn mt-4 text-base leading-7"
                >
                  {faq.a}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
