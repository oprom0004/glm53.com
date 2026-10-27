import { getTranslations, setRequestLocale } from 'next-intl/server';

import { requireRole } from '@/core/rbac';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import {
  PricingNavigationProvider,
  WanPricingSettings,
} from '@/shared/blocks/form/wan-pricing-settings';
import { ROLES } from '@/shared/services/rbac';
import { getSettingTabs } from '@/shared/services/settings';
import { getWanCatalog } from '@/shared/services/wan-catalog';
import { getWanVideoPricing } from '@/shared/services/wan-video-pricing-settings';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin.pricing' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function PricingSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole({
    roleName: ROLES.SUPER_ADMIN,
    redirectUrl: '/admin/no-permission',
    locale,
  });
  const [t, catalog, tabs, videoPricing, pricingT] = await Promise.all([
    getTranslations('admin.settings'),
    getWanCatalog(),
    getSettingTabs('pricing', true),
    getWanVideoPricing(),
    getTranslations('admin.pricing'),
  ]);

  return (
    <>
      <Header
        crumbs={[
          { title: t('edit.crumbs.admin'), url: '/admin' },
          { title: t('edit.crumbs.settings'), is_active: true },
        ]}
      />
      <Main>
        <MainHeader title={t('edit.title')} tabs={tabs} />
        <a
          href="#video-rates"
          className="text-primary mb-6 inline-block cursor-pointer underline underline-offset-4 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          {pricingT('video.jump')}
        </a>
        <PricingNavigationProvider>
          <WanPricingSettings catalog={catalog} />
          <WanPricingSettings catalog={catalog} videoPricing={videoPricing} />
        </PricingNavigationProvider>
      </Main>
    </>
  );
}
