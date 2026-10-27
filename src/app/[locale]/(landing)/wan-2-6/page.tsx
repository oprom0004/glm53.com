import { WanVersionPage } from '@/components/wan/wan-version-page';

import { getPublicPageMetadata } from '@/shared/lib/seo';

export const generateMetadata = getPublicPageMetadata('wan26');

export default function Wan26Page() {
  return <WanVersionPage version="2.6" />;
}
