import { WanVersionPage } from '@/components/wan/wan-version-page';

import { getPublicPageMetadata } from '@/shared/lib/seo';

export const generateMetadata = getPublicPageMetadata('wan27');

export default function Wan27Page() {
  return <WanVersionPage version="2.7" />;
}
