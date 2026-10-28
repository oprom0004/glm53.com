import React from 'react';
import { GlmArchitecture } from '@/components/glm/glm-architecture';
import { GlmBenchmarks } from '@/components/glm/glm-benchmarks';
import { GlmCta } from '@/components/glm/glm-cta';
import { GlmFaq } from '@/components/glm/glm-faq';
import { GlmFooter } from '@/components/glm/glm-footer';
import { GlmHardwareCalculator } from '@/components/glm/glm-hardware-calculator';
import { GlmHeader } from '@/components/glm/glm-header';
import { GlmHero } from '@/components/glm/glm-hero';
import { GlmModels } from '@/components/glm/glm-models';
import { GlmPricing } from '@/components/glm/glm-pricing';
import { GlmWorkflows } from '@/components/glm/glm-workflows';

import { getPublicPageMetadata } from '@/shared/lib/seo';

export const dynamic = 'force-dynamic';
export const generateMetadata = getPublicPageMetadata('home');

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <div className="bg-[#050811] text-slate-100 flex min-h-screen flex-col selection:bg-cyan-400 selection:text-slate-950 font-sans">
      <GlmHeader />
      <main className="flex-1">
        <GlmHero />
        <GlmWorkflows />
        <GlmBenchmarks />
        <GlmModels />
        <GlmArchitecture />
        <GlmHardwareCalculator />
        <GlmPricing />
        <GlmFaq />
        <GlmCta />
      </main>
      <GlmFooter />
    </div>
  );
}
