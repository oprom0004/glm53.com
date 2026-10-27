import { WanPricing } from '@/components/wan/wan-pricing';
import { WanPricingUnavailable } from '@/components/wan/wan-pricing-unavailable';

import type { Subscription } from '@/shared/models/subscription';
import { getWanCatalog } from '@/shared/services/wan-catalog';
import type { Pricing as PricingType } from '@/shared/types/blocks/pricing';

/** All pricing entry points share the server-owned catalog and checkout contract. */
export async function Pricing({
  className,
}: {
  section: PricingType;
  className?: string;
  currentSubscription?: Subscription;
}) {
  const catalog = await getWanCatalog().catch(() => null);
  return (
    <div className={className}>
      {catalog ? <WanPricing catalog={catalog} /> : <WanPricingUnavailable />}
    </div>
  );
}
