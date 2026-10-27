import { WanVersionPage } from '@/components/wan/wan-version-page';

import { getPublicPageMetadata } from '@/shared/lib/seo';

export const generateMetadata = getPublicPageMetadata('wan25');

export default function Wan25Page() {
  return <WanVersionPage version="2.5" />;
}
