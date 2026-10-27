import { stripeKeyMode } from '@/extensions/payment/stripe-mode';
import { r2ConfigsFromSettings } from '@/extensions/storage/r2';
import { getAuthProviderReadiness } from '@/shared/lib/auth-provider-readiness';

import { KIE_WAN2_MODELS } from './kie-wan2-contract';
import { POLARIS_MODELS } from './polaris-models';
import { isProviderModelId } from './provider-endpoint';
import {
  getWanProviderId,
  KIE_WAN_MODELS,
  wanProviderCredentials,
} from './wan-provider-settings';

export type SetupCheck = {
  id: string;
  title: string;
  href: string;
  ready: boolean;
  missing: string[];
};

/** Configuration checks only: never contacts providers or returns credential values. */
export function getSetupChecks(
  config: Record<string, string>,
  locale = 'en'
): SetupCheck[] {
  const zh = locale === 'zh';
  const label = (en: string, cn: string) => (zh ? cn : en);
  const present = (key: string) => Boolean(config[key]?.trim());
  const google: string[] = [];
  if (config.google_auth_enabled !== 'true')
    google.push(label('Enable Google sign-in', '开启 Google 登录'));
  if (!present('google_client_id')) google.push('Client ID');
  if (!present('google_client_secret')) google.push('Client Secret');
  const storage: string[] = [];
  for (const [key, title] of [
    ['r2_access_key', 'Access Key ID'],
    ['r2_secret_key', 'Secret Access Key'],
    ['r2_bucket_name', 'Bucket'],
    ['r2_domain', label('Public domain', '公开访问域名')],
  ]) {
    if (!present(key)) storage.push(title);
  }
  if (!present('r2_account_id') && !present('r2_endpoint'))
    storage.push(label('Account ID or S3 endpoint', 'Account ID 或 S3 端点'));
  try {
    r2ConfigsFromSettings(config);
  } catch {
    if (!storage.length)
      storage.push(
        label(
          'Correct the R2 endpoint, bucket or public domain',
          '检查 R2 端点、桶名称及公开域名格式'
        )
      );
  }
  const ai: string[] = [];
  const useKie = config.wan30_provider === 'kie';
  try {
    wanProviderCredentials(config, getWanProviderId(config, '3.0'));
  } catch {
    ai.push(
      label(
        'Configure the selected provider API key and endpoint',
        '配置所选供应商的 API Key 和接口地址'
      )
    );
  }
  const stripe: string[] = [];
  if (config.stripe_enabled !== 'true')
    stripe.push(label('Enable Stripe', '开启 Stripe'));
  if (!stripeKeyMode(config.stripe_secret_key))
    stripe.push(label('Valid Stripe secret key', '有效的 Stripe Secret Key'));
  if (!present('stripe_signing_secret')) stripe.push('Webhook Signing Secret');
  if (config.stripe_allow_promotion_codes === 'true')
    stripe.push(
      label(
        'Disable promotion codes for the current catalog',
        '关闭当前商品目录不支持的优惠码'
      )
    );
  const auth = getAuthProviderReadiness(config);
  const checks: SetupCheck[] = [
    {
      id: 'email',
      title: label('Email sign-in', '邮箱登录'),
      href: '/admin/settings/auth',
      ready: auth.email,
      missing: auth.email
        ? []
        : [label('Enable email sign-in', '开启邮箱登录')],
    },
    {
      id: 'google',
      title: label('Google sign-in', 'Google 登录'),
      href: '/admin/settings/auth',
      ready: google.length === 0,
      missing: google,
    },
    {
      id: 'storage',
      title: label('Image and video storage', '图片与视频存储'),
      href: '/admin/settings/storage',
      ready: storage.length === 0,
      missing: storage,
    },
    {
      id: 'ai',
      title: useKie
        ? label('Kie Wan video API', 'Kie Wan 视频接口')
        : label('Wan video API', 'Wan 视频接口'),
      href: '/admin/settings/ai',
      ready: ai.length === 0,
      missing: ai,
    },
    ...POLARIS_MODELS.filter(() => !useKie).map((model) => ({
      id: model.name,
      title: model.title,
      href: '/admin/settings/ai',
      ready: isProviderModelId(config[model.name]?.trim() || ''),
      missing: isProviderModelId(config[model.name]?.trim() || '')
        ? []
        : [label('Model ID from your provider', '供应商支持的模型 ID')],
    })),
    ...(useKie
      ? [
          ...Object.entries(KIE_WAN_MODELS).map(([tier, model]) => ({
            id: `kie_wan30_${tier}`,
            title: `Kie ${tier}: ${model}`,
            href: '/admin/settings/ai',
            ready: true,
            missing: [],
          })),
          ...Object.entries(KIE_WAN2_MODELS).flatMap(([version, modes]) =>
            Object.entries(modes).map(([mode, model]) => ({
              id: `kie_wan${version.replace('.', '')}_${mode}`,
              title: `Kie Wan ${version} ${mode}: ${model}`,
              href: '/admin/settings/ai',
              ready: true,
              missing: [],
            }))
          ),
        ]
      : []),
    {
      id: 'stripe',
      title: label('Stripe payments', 'Stripe 支付'),
      href: '/admin/settings/payment',
      ready: stripe.length === 0,
      missing: stripe,
    },
    {
      id: 'email-delivery',
      title: label('Verification email delivery', '验证邮件发送'),
      href: '/admin/settings/email',
      ready: present('resend_api_key') && present('resend_sender_email'),
      missing: [
        ...(!present('resend_api_key') ? ['Resend API Key'] : []),
        ...(!present('resend_sender_email')
          ? [label('Verified sender address', '已验证的发件地址')]
          : []),
      ],
    },
  ];
  return checks;
}
