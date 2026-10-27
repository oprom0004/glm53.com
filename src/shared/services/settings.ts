import { getTranslations } from 'next-intl/server';

import { Tab } from '@/shared/types/blocks/common';

import { POLARIS_MODELS } from './polaris-models';
import { WAN_PRICE_FIELDS } from './wan-video-pricing';

export interface Setting {
  name: string;
  title: string;
  type: string;
  placeholder?: string;
  options?: {
    title: string;
    value: string;
  }[];
  tip?: string;
  value?: string | string[] | boolean | number;
  group?: string;
  tab?: string;
  attributes?: Record<string, any>;
  metadata?: {
    secret?: boolean;
    serverOnly?: boolean;
    configured?: boolean;
    revealSecret?: boolean;
    [key: string]: unknown;
  };
}

export interface SettingGroup {
  name: string;
  title: string;
  description?: string;
  tab: string;
}

export async function getSettingTabs(tab: string, canManagePricing = false) {
  const t = await getTranslations('admin.settings');

  const tabs: Tab[] = [
    {
      name: 'setup',
      title: t('edit.tabs.setup'),
      url: '/admin/settings/setup',
      is_active: tab === 'setup',
    },
    {
      name: 'general',
      title: t('edit.tabs.general'),
      url: '/admin/settings/general',
      is_active: tab === 'general',
    },
    {
      name: 'auth',
      title: t('edit.tabs.auth'),
      url: '/admin/settings/auth',
      is_active: tab === 'auth',
    },
    {
      name: 'payment',
      title: t('edit.tabs.payment'),
      url: '/admin/settings/payment',
      is_active: tab === 'payment',
    },
    {
      name: 'email',
      title: t('edit.tabs.email'),
      url: '/admin/settings/email',
      is_active: tab === 'email',
    },
    {
      name: 'storage',
      title: t('edit.tabs.storage'),
      url: '/admin/settings/storage',
      is_active: tab === 'storage',
    },

    {
      name: 'ai',
      title: t('edit.tabs.ai'),
      url: '/admin/settings/ai',
      is_active: tab === 'ai',
    },
    {
      name: 'analytics',
      title: t('edit.tabs.analytics'),
      url: '/admin/settings/analytics',
      is_active: tab === 'analytics',
    },
    {
      name: 'ads',
      title: t('edit.tabs.ads'),
      url: '/admin/settings/ads',
      is_active: tab === 'ads',
    },
    {
      name: 'affiliate',
      title: t('edit.tabs.affiliate'),
      url: '/admin/settings/affiliate',
      is_active: tab === 'affiliate',
    },
    {
      name: 'customer_service',
      title: t('edit.tabs.customer_service'),
      url: '/admin/settings/customer_service',
      is_active: tab === 'customer_service',
    },
  ];

  if (canManagePricing) {
    const pricing = await getTranslations('admin.pricing');
    tabs.splice(3, 0, {
      name: 'pricing',
      title: pricing('title'),
      url: '/admin/settings/pricing',
      is_active: tab === 'pricing',
    });
  }
  return tabs;
}

export async function getSettingGroups() {
  const t = await getTranslations('admin.settings');
  const settingGroups: SettingGroup[] = [
    {
      name: 'appinfo',
      title: t('groups.appinfo'),
      description: 'custom your app info',
      tab: 'general',
    },
    {
      name: 'user_role',
      title: t('groups.user_role'),
      description: 'custom user role settings',
      tab: 'general',
    },
    {
      name: 'email_auth',
      title: t('groups.email_auth'),
      description: 'custom your email auth settings',
      tab: 'auth',
    },
    {
      name: 'google_auth',
      title: t('groups.google_auth'),
      description: t('groups.google_auth_description'),
      tab: 'auth',
    },
    {
      name: 'github_auth',
      title: t('groups.github_auth'),
      description: 'custom your github auth settings',
      tab: 'auth',
    },
    {
      name: 'basic_payment',
      title: t('groups.basic_payment'),
      description: 'custom your basic payment settings',
      tab: 'payment',
    },
    {
      name: 'stripe',
      title: t('groups.stripe'),
      description:
        'custom your <a href="https://stripe.com" class="text-primary" target="_blank">Stripe</a> settings',
      tab: 'payment',
    },
    {
      name: 'creem',
      title: t('groups.creem'),
      description:
        'custom your <a href="https://www.creem.io" class="text-primary" target="_blank">Creem</a> settings',
      tab: 'payment',
    },
    {
      name: 'paypal',
      title: t('groups.paypal'),
      description: 'custom your paypal settings',
      tab: 'payment',
    },
    {
      name: 'google_analytics',
      title: t('groups.google_analytics'),
      description:
        'custom your <a href="https://analytics.google.com/" class="text-primary" target="_blank">Google Analytics</a> settings',
      tab: 'analytics',
    },
    {
      name: 'clarity',
      title: t('groups.clarity'),
      description:
        'custom your <a href="https://clarity.microsoft.com/" class="text-primary" target="_blank">Clarity</a> settings',
      tab: 'analytics',
    },
    {
      name: 'plausible',
      title: t('groups.plausible'),
      description:
        'custom your <a href="https://plausible.io/" class="text-primary" target="_blank">Plausible</a> settings',
      tab: 'analytics',
    },
    {
      name: 'openpanel',
      title: t('groups.openpanel'),
      description:
        'custom your <a href="https://openpanel.dev/" class="text-primary" target="_blank">OpenPanel</a> settings',
      tab: 'analytics',
    },
    {
      name: 'vercel_analytics',
      title: t('groups.vercel_analytics'),
      description:
        'custom your <a href="https://vercel.com/docs/analytics/" class="text-primary" target="_blank">Vercel Analytics</a> settings',
      tab: 'analytics',
    },
    {
      name: 'resend',
      title: t('groups.resend'),
      description: 'custom your resend settings',
      tab: 'email',
    },
    {
      name: 'r2',
      title: t('groups.r2'),
      description: t('groups.r2_description'),
      tab: 'storage',
    },
    {
      name: 'openrouter',
      title: t('groups.openrouter'),
      description: `Custom <a href="https://openrouter.ai" class="text-primary" target="_blank">OpenRouter</a> settings`,
      tab: 'ai',
    },
    {
      name: 'polaris',
      title: t('groups.polaris'),
      description: t('groups.polaris_description'),
      tab: 'ai',
    },
    {
      name: 'replicate',
      title: t('groups.replicate'),
      description: `Custom <a href="https://replicate.com" class="text-primary" target="_blank">Replicate</a> settings`,
      tab: 'ai',
    },
    {
      name: 'fal',
      title: 'Fal',
      description: `Custom <a href="https://fal.ai" class="text-primary" target="_blank">Fal</a> settings`,
      tab: 'ai',
    },
    {
      name: 'gemini',
      title: 'Gemini',
      description: `Custom <a href="https://aistudio.google.com/api-keys" class="text-primary" target="_blank">Gemini</a> settings`,
      tab: 'ai',
    },
    {
      name: 'kie',
      title: 'Kie',
      description: `Custom <a href="https://kie.ai" class="text-primary" target="_blank">Kie</a> settings`,
      tab: 'ai',
    },
    {
      name: 'adsense',
      title: t('groups.adsense'),
      description: 'custom your adsense settings',
      tab: 'ads',
    },
    {
      name: 'affonso',
      title: t('groups.affonso'),
      description:
        'custom your <a href="https://affonso.io?atp=shipany" class="text-primary" target="_blank">Affonso</a> settings',
      tab: 'affiliate',
    },
    {
      name: 'promotekit',
      title: t('groups.promotekit'),
      description:
        'custom your <a href="https://www.promotekit.com?via=shipany" class="text-primary" target="_blank">PromoteKit</a> settings',
      tab: 'affiliate',
    },
    {
      name: 'crisp',
      title: t('groups.crisp'),
      description:
        'custom your <a href="https://crisp.chat" class="text-primary" target="_blank">Crisp</a> settings',
      tab: 'customer_service',
    },
    {
      name: 'tawk',
      title: t('groups.tawk'),
      description:
        'custom your <a href="https://www.tawk.to" class="text-primary" target="_blank">Tawk</a> settings',
      tab: 'customer_service',
    },
  ];
  return settingGroups;
}

export async function getSettings() {
  const settings: Setting[] = [
    {
      name: 'app_name',
      title: 'App Name',
      placeholder: 'ShipAny',
      type: 'text',
      group: 'appinfo',
      tab: 'general',
    },
    {
      name: 'app_description',
      title: 'App Description',
      placeholder:
        'ShipAny is a NextJS boilerplate for building AI SaaS startups. ',
      type: 'textarea',
      group: 'appinfo',
      tab: 'general',
    },
    {
      name: 'app_logo',
      title: 'App Logo',
      type: 'upload_image',
      group: 'appinfo',
      tab: 'general',
    },
    {
      name: 'app_preview_image',
      title: 'App Preview Image',
      type: 'upload_image',
      group: 'appinfo',
      tab: 'general',
    },
    {
      name: 'initial_role_enabled',
      title: 'Initial Role Enabled',
      type: 'switch',
      value: 'false',
      group: 'user_role',
      tab: 'general',
      tip: 'whether assign initial role for new user',
    },
    {
      name: 'initial_role_name',
      title: 'Initial Role',
      type: 'select',
      value: 'viewer',
      options: [
        { title: 'Viewer', value: 'viewer' },
        { title: 'Editor', value: 'editor' },
        { title: 'Admin', value: 'admin' },
        { title: 'Super Admin', value: 'super_admin' },
      ],
      group: 'user_role',
      tab: 'general',
      tip: 'the initial role for new user',
    },
    {
      name: 'email_auth_enabled',
      title: 'Enabled',
      type: 'switch',
      value: 'true',
      group: 'email_auth',
      tab: 'auth',
    },
    {
      name: 'email_verification_enabled',
      title: 'Email Verification Required',
      type: 'switch',
      value: 'false',
      group: 'email_auth',
      tab: 'auth',
      tip: 'Require users to verify their email before they can sign in. Requires a configured email provider (e.g. Resend).',
    },
    {
      name: 'google_auth_enabled',
      title: 'Auth Enabled',
      type: 'switch',
      value: 'false',
      group: 'google_auth',
      tab: 'auth',
    },
    {
      name: 'google_one_tap_enabled',
      title: 'OneTap Enabled',
      type: 'switch',
      value: 'false',
      group: 'google_auth',
      tab: 'auth',
    },
    {
      name: 'google_client_id',
      title: 'Google Client ID',
      type: 'text',
      placeholder: '',
      group: 'google_auth',
      tab: 'auth',
    },
    {
      name: 'google_client_secret',
      title: 'Google Client Secret',
      type: 'password',
      placeholder: '',
      group: 'google_auth',
      tab: 'auth',
    },
    {
      name: 'github_auth_enabled',
      title: 'Auth Enabled',
      type: 'switch',
      group: 'github_auth',
      tab: 'auth',
    },
    {
      name: 'github_client_id',
      title: 'Github Client ID',
      type: 'text',
      placeholder: '',
      group: 'github_auth',
      tab: 'auth',
    },
    {
      name: 'github_client_secret',
      title: 'Github Client Secret',
      type: 'password',
      placeholder: '',
      group: 'github_auth',
      tab: 'auth',
    },
    {
      name: 'select_payment_enabled',
      title: 'Select Payment Method Enabled',
      type: 'switch',
      value: 'false',
      tip: 'whether allow users to select payment method, if disabled, the default payment provider will be used',
      placeholder: '',
      group: 'basic_payment',
      tab: 'payment',
    },
    {
      name: 'default_payment_provider',
      title: 'Default Payment Provider',
      type: 'select',
      value: 'stripe',
      options: [
        {
          title: 'Stripe',
          value: 'stripe',
        },
        {
          title: 'Creem',
          value: 'creem',
        },
        {
          title: 'Paypal',
          value: 'paypal',
        },
      ],
      tip: 'Choose the default payment provider to use',
      group: 'basic_payment',
      tab: 'payment',
    },
    {
      name: 'stripe_enabled',
      title: 'Stripe Enabled',
      type: 'switch',
      value: 'false',
      placeholder: '',
      group: 'stripe',
      tab: 'payment',
    },
    {
      name: 'stripe_publishable_key',
      title: 'Stripe Publishable Key',
      type: 'text',
      placeholder: 'pk_xxx',
      group: 'stripe',
      tab: 'payment',
    },
    {
      name: 'stripe_secret_key',
      title: 'Stripe Secret Key',
      type: 'password',
      placeholder: 'sk_xxx',
      group: 'stripe',
      tab: 'payment',
    },
    {
      name: 'stripe_signing_secret',
      title: 'Stripe Signing Secret',
      type: 'password',
      placeholder: 'whsec_xxx',
      tip: 'Stripe Signing Secret is used to verify the webhook notification from Stripe',
      group: 'stripe',
      tab: 'payment',
    },
    {
      name: 'stripe_account_id',
      title: 'Stripe Connect Account ID',
      type: 'text',
      placeholder: 'acct_xxx (optional)',
      tip: 'When set, signed webhook events must come from this Stripe Connect account.',
      group: 'stripe',
      tab: 'payment',
    },
    {
      name: 'stripe_price_starter',
      title: 'Stripe Starter Monthly Price ID',
      type: 'text',
      placeholder: 'price_xxx',
      tip: 'Optional legacy Price ID for USD 15.90/month. A different admin-configured monthly price automatically uses dynamic pricing; annual and credit packs always use dynamic prices.',
      group: 'stripe',
      tab: 'payment',
    },
    {
      name: 'stripe_price_creator',
      title: 'Stripe Creator Monthly Price ID',
      type: 'text',
      placeholder: 'price_xxx',
      tip: 'Optional legacy Price ID for USD 45.90/month. A different admin-configured monthly price automatically uses dynamic pricing.',
      group: 'stripe',
      tab: 'payment',
    },
    {
      name: 'stripe_price_pro',
      title: 'Stripe Pro Monthly Price ID',
      type: 'text',
      placeholder: 'price_xxx',
      tip: 'Optional legacy Price ID for USD 95.90/month. A different admin-configured monthly price automatically uses dynamic pricing.',
      group: 'stripe',
      tab: 'payment',
    },
    {
      name: 'stripe_payment_methods',
      title: 'Stripe Payment Methods',
      type: 'checkbox',
      tip: 'If not set, only card payment method will be enabled.',
      options: [
        { title: 'Card', value: 'card' },
        { title: 'Wechat Pay', value: 'wechat_pay' },
        { title: 'Alipay', value: 'alipay' },
      ],
      value: ['card'],
      group: 'stripe',
      tab: 'payment',
    },
    {
      name: 'stripe_promotion_codes',
      title: 'Stripe Promotion Codes',
      type: 'textarea',
      attributes: {
        rows: 6,
      },
      placeholder: `{
  "starter": "promo_xxx",
  "standard-monthly": "promo_xxx",
  "premium-yearly": "promo_xxx"
}`,
      group: 'stripe',
      tab: 'payment',
      tip: 'Map the product_id in pricing table to <a href="https://dashboard.stripe.com/coupons" class="text-primary" target="_blank">promotion_code</a> created in Stripe. Must be a valid JSON object.',
    },
    {
      name: 'stripe_allow_promotion_codes',
      title: 'Stripe Allow Promotion Codes',
      type: 'switch',
      value: 'false',
      group: 'stripe',
      tab: 'payment',
      tip: 'Keep disabled for Wan monthly/annual/credit packs. These products require exact catalog amounts and reject promotional checkouts.',
    },
    {
      name: 'creem_enabled',
      title: 'Creem Enabled',
      type: 'switch',
      value: 'false',
      group: 'creem',
      tab: 'payment',
    },
    {
      name: 'creem_environment',
      title: 'Creem Environment',
      type: 'select',
      value: 'sandbox',
      options: [
        { title: 'Sandbox', value: 'sandbox' },
        { title: 'Production', value: 'production' },
      ],
      group: 'creem',
      tab: 'payment',
    },
    {
      name: 'creem_api_key',
      title: 'Creem API Key',
      type: 'password',
      placeholder: 'creem_xxx',
      group: 'creem',
      tab: 'payment',
    },
    {
      name: 'creem_signing_secret',
      title: 'Creem Signing Secret',
      type: 'password',
      placeholder: 'whsec_xxx',
      group: 'creem',
      tab: 'payment',
      tip: 'Creem Signing Secret is used to verify the webhook notification from Creem',
    },
    {
      name: 'creem_product_ids',
      title: 'Creem Product IDs Mapping',
      type: 'textarea',
      attributes: {
        rows: 6,
      },
      placeholder: `{
  "starter": "prod_xxx",
  "standard-monthly": "prod_xxx",
  "premium-yearly": "prod_xxx"
}`,
      group: 'creem',
      tab: 'payment',
      tip: 'Map the product_id in pricing table to <a href="https://www.creem.io/dashboard/products" class="text-primary" target="_blank">payment_product_id</a> created in Creem. Must be a valid JSON object.',
    },
    {
      name: 'paypal_enabled',
      title: 'Paypal Enabled',
      type: 'switch',
      value: 'false',
      group: 'paypal',
      tab: 'payment',
    },
    {
      name: 'paypal_environment',
      title: 'Paypal Environment',
      type: 'select',
      value: 'sandbox',
      options: [
        { title: 'Sandbox', value: 'sandbox' },
        { title: 'Production', value: 'production' },
      ],
      group: 'paypal',
      tab: 'payment',
    },
    {
      name: 'paypal_client_id',
      title: 'Paypal Client ID',
      type: 'text',
      placeholder: 'paypal_xxx',
      group: 'paypal',
      tab: 'payment',
    },
    {
      name: 'paypal_client_secret',
      title: 'Paypal Client Secret',
      type: 'password',
      placeholder: 'paypal_xxx',
      group: 'paypal',
      tab: 'payment',
    },
    {
      name: 'paypal_webhook_id',
      title: 'Paypal Webhook ID',
      type: 'text',
      placeholder: 'xxx',
      tip: 'PayPal Webhook ID is used to verify the webhook notification from PayPal. You can find it in PayPal Developer Dashboard > Webhooks.',
      group: 'paypal',
      tab: 'payment',
    },
    {
      name: 'google_analytics_id',
      title: 'Google Analytics ID',
      type: 'text',
      placeholder: '',
      group: 'google_analytics',
      tab: 'analytics',
    },
    {
      name: 'clarity_id',
      title: 'Clarity ID',
      type: 'text',
      placeholder: '',
      group: 'clarity',
      tab: 'analytics',
    },
    {
      name: 'plausible_domain',
      title: 'Plausible Domain',
      type: 'text',
      placeholder: 'shipany.site',
      group: 'plausible',
      tab: 'analytics',
    },
    {
      name: 'plausible_src',
      title: 'Plausible Script Src',
      type: 'url',
      placeholder: 'https://plausible.io/js/script.js',
      group: 'plausible',
      tab: 'analytics',
    },
    {
      name: 'openpanel_client_id',
      title: 'OpenPanel Client ID',
      type: 'text',
      placeholder: '',
      group: 'openpanel',
      tab: 'analytics',
    },
    {
      name: 'vercel_analytics_enabled',
      title: 'Enabled',
      type: 'switch',
      value: 'false',
      group: 'vercel_analytics',
      tab: 'analytics',
    },
    {
      name: 'resend_api_key',
      title: 'Resend API Key',
      type: 'password',
      placeholder: '',
      group: 'resend',
      tab: 'email',
    },
    {
      name: 'resend_sender_email',
      title: 'Resend Sender Email',
      type: 'text',
      placeholder: 'ShipAny Two <no-reply@mail.shipany.site>',
      group: 'resend',
      tab: 'email',
    },
    {
      name: 'r2_account_id',
      title: 'Cloudflare Account ID',
      type: 'text',
      placeholder: '',
      tip: '32-character Account ID. Optional when the full S3 endpoint below is provided.',
      group: 'r2',
      tab: 'storage',
      metadata: { serverOnly: true },
    },
    {
      name: 'r2_access_key',
      title: 'R2 Access Key ID',
      type: 'password',
      placeholder: '',
      group: 'r2',
      tab: 'storage',
    },
    {
      name: 'r2_secret_key',
      title: 'R2 Secret Access Key',
      type: 'password',
      placeholder: '',
      group: 'r2',
      tab: 'storage',
    },
    {
      name: 'r2_bucket_name',
      title: 'Bucket Name',
      type: 'text',
      placeholder: '',
      group: 'r2',
      tab: 'storage',
    },
    {
      name: 'r2_upload_path',
      title: 'Upload Path',
      type: 'text',
      placeholder: 'uploads',
      tip: 'The path to upload files to, leave empty to use the default upload path. Example: uploads/foo/bar',
      group: 'r2',
      tab: 'storage',
    },
    {
      name: 'r2_endpoint',
      title: 'R2 S3 API Endpoint',
      type: 'url',
      placeholder: 'https://<account-id>.r2.cloudflarestorage.com',
      tip: 'S3 endpoint, without bucket name. Leave empty to derive it from the Account ID. Do not use the public domain here.',
      group: 'r2',
      tab: 'storage',
    },
    {
      name: 'r2_domain',
      title: 'R2 Public Domain',
      type: 'url',
      placeholder: 'https://media.wanai30.com',
      tip: 'Required. An HTTPS custom domain connected to this R2 bucket, or its enabled r2.dev URL. The private S3 endpoint is not a public playback URL.',
      group: 'r2',
      tab: 'storage',
    },
    {
      name: 'openrouter_api_key',
      title: 'OpenRouter API Key',
      type: 'password',
      placeholder: 'sk-or-xxx',
      group: 'openrouter',
      tab: 'ai',
    },
    {
      name: 'polaris_api_key',
      title: 'Wan API Key',
      type: 'password',
      placeholder: '',
      group: 'polaris',
      tab: 'ai',
      attributes: { autoComplete: 'off', spellCheck: false },
      metadata: { secret: true, serverOnly: true, revealSecret: true },
    },
    {
      name: 'polaris_webhook_secret',
      title: 'Polaris Webhook Secret',
      type: 'password',
      placeholder: '',
      group: 'polaris',
      tab: 'ai',
      attributes: { autoComplete: 'off', spellCheck: false },
      metadata: { secret: true, serverOnly: true, revealSecret: true },
    },
    {
      name: 'polaris_base_url',
      title: 'Wan API Base URL',
      type: 'url',
      value: 'https://api.polariscore.ai',
      tip: 'Polaris or a Wan-compatible gateway. Uses /v1/videos for Wan 2.x and /api/v1/services/aigc/video-generation/video-synthesis for Wan 3.0. A different protocol needs its own adapter.',
      group: 'polaris',
      tab: 'ai',
      attributes: { spellCheck: false },
      metadata: { serverOnly: true },
    },
    {
      name: 'wan_video_output_hosts',
      title: 'Wan Video Download Hosts',
      type: 'textarea',
      placeholder: 'cdn.provider.com',
      tip: 'Trusted result-file hostnames from your provider, separated by commas or new lines. Exact hosts only, no URLs or wildcards. Polaris public result hosts and Kie tempfile.aiquickdraw.com are supported by default.',
      group: 'polaris',
      tab: 'ai',
      metadata: { serverOnly: true },
    },
    ...POLARIS_MODELS.map((model) => ({
      ...model,
      type: 'text',
      group: 'polaris',
      tab: 'ai',
      attributes: { autoComplete: 'off', spellCheck: false },
      metadata: { serverOnly: true },
    })),
    ...WAN_PRICE_FIELDS.map((price) => ({
      ...price,
      type: 'number',
      group: 'video_pricing',
      tab: 'pricing',
      attributes: { min: 1, max: 99999.5, step: 0.5 },
      metadata: { serverOnly: true },
    })),
    {
      name: 'openrouter_base_url',
      title: 'OpenRouter Base URL',
      type: 'url',
      placeholder: 'https://openrouter.ai/api/v1',
      tip: 'Set any OpenAI compatible API URL, leave empty to use the default OpenRouter API URL',
      group: 'openrouter',
      tab: 'ai',
    },
    {
      name: 'replicate_api_token',
      title: 'Replicate API Token',
      type: 'password',
      placeholder: 'r8_xxx',
      group: 'replicate',
      tab: 'ai',
    },
    ...[
      {
        name: 'replicate',
        title: 'Replicate',
        url: 'https://api.replicate.com/v1',
      },
      { name: 'fal', title: 'Fal Queue', url: 'https://queue.fal.run' },
      {
        name: 'gemini',
        title: 'Gemini',
        url: 'https://generativelanguage.googleapis.com/v1beta',
      },
      { name: 'kie', title: 'Kie', url: 'https://api.kie.ai/api/v1' },
    ].map((provider) => ({
      name: `${provider.name}_base_url`,
      title: `${provider.title} Base URL`,
      type: 'url',
      placeholder: provider.url,
      group: provider.name,
      tab: 'ai',
      tip: `Leave empty for ${provider.url}. Custom gateways must implement the same provider API protocol.`,
      metadata: { serverOnly: true },
    })),
    {
      name: 'replicate_custom_storage',
      title: 'Replicate Custom Storage',
      type: 'switch',
      value: 'false',
      group: 'replicate',
      tab: 'ai',
      tip: 'Use custom storage to save files generated by Replicate',
    },
    {
      name: 'fal_api_key',
      title: 'Fal API Key',
      type: 'password',
      placeholder: 'fal_xxx',
      group: 'fal',
      tip: 'Fal API Key is used to access the Fal API',
      tab: 'ai',
    },
    {
      name: 'fal_custom_storage',
      title: 'Fal Custom Storage',
      type: 'switch',
      value: 'false',
      group: 'fal',
      tab: 'ai',
      tip: 'Use custom storage to save files generated by Fal',
    },
    {
      name: 'gemini_api_key',
      title: 'Gemini API Key',
      type: 'password',
      placeholder: 'AIza...',
      group: 'gemini',
      tip: 'Google Gemini API Key',
      tab: 'ai',
    },
    {
      name: 'wan30_provider',
      title: 'Wan Video Provider',
      type: 'select',
      value: 'polaris',
      options: [
        { title: 'Polaris / compatible gateway', value: 'polaris' },
        { title: 'Kie.ai', value: 'kie' },
      ],
      tip: 'Select the provider for new Wan 2.5, 2.6, 2.7 and 3.0 tasks. Kie uses the Kie API Key below and the official model ID for each version and generation mode.',
      group: 'kie',
      tab: 'ai',
      metadata: { serverOnly: true },
    },
    {
      name: 'kie_api_key',
      title: 'Kie API Key',
      type: 'password',
      placeholder: 'xxx',
      group: 'kie',
      tip: 'Kie API Key is used to access the Kie API',
      tab: 'ai',
    },
    {
      name: 'kie_custom_storage',
      title: 'Kie Custom Storage',
      type: 'switch',
      value: 'false',
      group: 'kie',
      tab: 'ai',
      tip: 'Use custom storage to save files generated by Kie',
    },
    {
      name: 'adsense_code',
      title: 'Adsense Code',
      type: 'text',
      placeholder: 'ca-pub-xxx',
      group: 'adsense',
      tab: 'ads',
    },
    {
      name: 'affonso_enabled',
      title: 'Affonso Enabled',
      type: 'switch',
      value: 'false',
      group: 'affonso',
      tab: 'affiliate',
    },
    {
      name: 'affonso_id',
      title: 'Affonso ID',
      type: 'text',
      placeholder: 'xxx',
      tip: 'Affonso Program ID',
      group: 'affonso',
      tab: 'affiliate',
    },
    {
      name: 'affonso_cookie_duration',
      title: 'Affonso Cookie Duration',
      type: 'number',
      placeholder: '30',
      tip: 'Affonso Cookie Duration in days, default is 30 days',
      value: '30',
      group: 'affonso',
      tab: 'affiliate',
    },
    {
      name: 'promotekit_enabled',
      title: 'PromoteKit Enabled',
      type: 'switch',
      value: 'false',
      group: 'promotekit',
      tab: 'affiliate',
    },
    {
      name: 'promotekit_id',
      title: 'PromoteKit ID',
      type: 'text',
      placeholder: 'xxx',
      tip: 'PromoteKit Program ID',
      group: 'promotekit',
      tab: 'affiliate',
    },
    {
      name: 'crisp_enabled',
      title: 'Crisp Enabled',
      type: 'switch',
      value: 'false',
      group: 'crisp',
      tab: 'customer_service',
    },
    {
      name: 'crisp_website_id',
      title: 'Crisp Website ID',
      type: 'text',
      placeholder: 'xxx',
      group: 'crisp',
      tab: 'customer_service',
    },
    {
      name: 'tawk_enabled',
      title: 'Tawk Enabled',
      type: 'switch',
      value: 'false',
      group: 'tawk',
      tab: 'customer_service',
    },
    {
      name: 'tawk_property_id',
      title: 'Tawk Property ID',
      tip: 'Tawk Property ID is associated with your Tawk account',
      type: 'text',
      placeholder: 'xxx',
      group: 'tawk',
      tab: 'customer_service',
    },
    {
      name: 'tawk_widget_id',
      title: 'Tawk Widget ID',
      type: 'text',
      placeholder: 'xxx',
      group: 'tawk',
      tab: 'customer_service',
    },
  ];

  return settings.map((setting) => {
    if (!['ai', 'storage'].includes(setting.tab || '')) return setting;
    const secret = setting.type === 'password';
    return {
      ...setting,
      attributes: {
        ...setting.attributes,
        ...(secret ? { autoComplete: 'off', spellCheck: false } : {}),
      },
      metadata: {
        ...setting.metadata,
        serverOnly: true,
        ...(secret ? { secret: true, revealSecret: true } : {}),
      },
    };
  });
}

// SECURITY: this whitelist gates which DB-stored config keys are allowed to
// reach the browser via `getPublicConfigs()`. Only add keys that are safe to
// expose publicly (feature flags, public client IDs). NEVER add API keys,
// client secrets, signing secrets, or any credential here.
export const publicSettingNames = [
  'email_auth_enabled',
  'email_verification_enabled',
  'google_auth_enabled',
  'google_one_tap_enabled',
  'google_client_id',
  'github_auth_enabled',
  'select_payment_enabled',
  'default_payment_provider',
  'stripe_enabled',
  'creem_enabled',
  'paypal_enabled',
  'affonso_enabled',
  'promotekit_enabled',
  'crisp_enabled',
  'tawk_enabled',
];

export async function getAllSettingNames() {
  const settings = await getSettings();
  const settingNames: string[] = [];

  settings.forEach((setting: Setting) => {
    settingNames.push(setting.name);
  });

  return settingNames;
}
