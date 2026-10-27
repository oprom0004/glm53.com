import { getLocale } from 'next-intl/server';

export async function WanPricingUnavailable() {
  const isZh = (await getLocale()) === 'zh';
  return (
    <section id="pricing" className="bg-muted/30 px-4 py-20 text-center">
      <h2 className="text-foreground text-3xl font-bold">
        {isZh ? '定价暂时不可用' : 'Pricing is temporarily unavailable'}
      </h2>
      <p className="text-muted-foreground mt-4">
        {isZh
          ? '请稍后刷新页面查看最新套餐。'
          : 'Please refresh later to see the latest plans.'}
      </p>
    </section>
  );
}
