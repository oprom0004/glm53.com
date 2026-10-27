import { WanFooter } from '@/components/wan/wan-footer';
import { WanHeader } from '@/components/wan/wan-header';
import { WanPricing } from '@/components/wan/wan-pricing';
import { WanPricingUnavailable } from '@/components/wan/wan-pricing-unavailable';

import { buildProductJsonLd, serializeJsonLd } from '@/shared/lib/json-ld';
import { getPublicPageMetadata } from '@/shared/lib/seo';
import { getWanCatalog } from '@/shared/services/wan-catalog';

export const dynamic = 'force-dynamic';

export const generateMetadata = getPublicPageMetadata('pricing');

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const catalog = await getWanCatalog().catch(() => null);
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col selection:bg-violet-500 selection:text-white">
      <WanHeader />
      <main className="flex-1">
        {catalog ? <WanPricing catalog={catalog} /> : <WanPricingUnavailable />}
      </main>
      <WanFooter />
      {catalog && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(
              buildProductJsonLd(locale, catalog.products)
            ),
          }}
        />
      )}
    </div>
  );
}
