import React from 'react';
import { WanFaq } from '@/components/wan/wan-faq';
import { WanFeatures } from '@/components/wan/wan-features';
import { WanFooter } from '@/components/wan/wan-footer';
import { WanGenerator } from '@/components/wan/wan-generator';
import { WanHeader } from '@/components/wan/wan-header';

import { getPublicPageMetadata } from '@/shared/lib/seo';

export const generateMetadata = getPublicPageMetadata('wan3');

export default function Wan3Page() {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col selection:bg-violet-500 selection:text-white">
      <WanHeader />
      <main className="flex-1">
        <WanGenerator version="3.0" />
        <WanFeatures />
        <WanFaq />
      </main>
      <WanFooter />
    </div>
  );
}
