// Isolated UI fixture: no authentication bypass and no real database writes.
import React from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { createRoot } from 'react-dom/client';

import en from '@/config/locale/messages/en/admin/pricing.json';
import zh from '@/config/locale/messages/zh/admin/pricing.json';
import { WanPricingSettings } from '@/shared/blocks/form/wan-pricing-settings';
import { DEFAULT_WAN_CATALOG } from '@/shared/lib/wan-product-catalog';
import { WAN_DEFAULT_PRICE_CONFIG } from '@/shared/services/wan-video-pricing';

let pricing = {
  revision: 'preview-initial',
  rates: { ...WAN_DEFAULT_PRICE_CONFIG },
  overrides: {},
};
const params = new URLSearchParams(location.search);
const locale = params.get('locale') === 'en' ? 'en' : 'zh';
const scenario = params.get('scenario');
document.documentElement.lang = locale;
document.documentElement.classList.toggle(
  'dark',
  params.get('theme') === 'dark'
);
window.fetch = async (_input, init) => {
  if (scenario === 'offline')
    throw new Error('Isolated simulated network failure');
  if (init?.method === 'POST') {
    if (scenario === 'slow')
      await new Promise((resolve) => setTimeout(resolve, 1500));
    if (scenario === 'conflict')
      return Response.json(
        { code: -1, message: 'pricing_conflict' },
        { status: 409 }
      );
    const body = JSON.parse(String(init.body));
    pricing = {
      ...pricing,
      revision: `preview-${Date.now()}`,
      rates: body.rates,
    };
  }
  return Response.json({ code: 0, data: pricing });
};
createRoot(document.getElementById('root')!).render(
  <NextIntlClientProvider
    locale={locale}
    timeZone="UTC"
    messages={{ admin: { pricing: locale === 'en' ? en : zh } }}
  >
    <main className="mx-auto max-w-5xl p-6">
      <p className="mb-6 text-sm">
        仅测试预览 / UI fixture · 保存仅改变内存，不会修改真实配置
      </p>
      {/* Standalone HTTP fixture has no Next.js router or client-side routes. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a className="mb-6 inline-block underline" href="/?locale=en">
        English preview
      </a>
      <WanPricingSettings
        catalog={DEFAULT_WAN_CATALOG}
        videoPricing={pricing}
      />
    </main>
  </NextIntlClientProvider>
);
