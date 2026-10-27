import { absoluteSiteUrl, siteConfig } from '@/config/site';
import {
  WAN_PRODUCTS,
  type WanProduct,
} from '@/shared/lib/wan-product-catalog';

export function buildProductJsonLd(
  locale: string,
  products: readonly WanProduct[] = WAN_PRODUCTS
) {
  const pricingUrl = absoluteSiteUrl('/pricing', locale);
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: siteConfig.name,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web',
    url: absoluteSiteUrl('/', locale),
    description: siteConfig.description,
    offers: products.map((plan) => ({
      '@type': 'Offer',
      name: `${plan.tier[0].toUpperCase()}${plan.tier.slice(1)} ${plan.mode[0].toUpperCase()}${plan.mode.slice(1)}`,
      url: `${pricingUrl}?purchase=${plan.mode}#pricing`,
      price: (plan.amount / 100).toFixed(2),
      priceCurrency: plan.currency.toUpperCase(),
      availability: 'https://schema.org/InStock',
    })),
  };
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
