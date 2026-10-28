import { GlmFooter } from '@/components/glm/glm-footer';
import { GlmHeader } from '@/components/glm/glm-header';
import { GlmPricing } from '@/components/glm/glm-pricing';

import { getPublicPageMetadata } from '@/shared/lib/seo';

export const dynamic = 'force-dynamic';

export const generateMetadata = getPublicPageMetadata('pricing');

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <div className="bg-[#050811] text-slate-100 flex min-h-screen flex-col selection:bg-cyan-400 selection:text-slate-950 font-sans">
      <GlmHeader />
      <main className="flex-1 py-8">
        <GlmPricing />
      </main>
      <GlmFooter />
    </div>
  );
}
