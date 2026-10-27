import { setRequestLocale } from 'next-intl/server';

import { Link } from '@/core/i18n/navigation';
import { PERMISSIONS, requireAllPermissions } from '@/core/rbac';
import { envConfigs } from '@/config';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { getAllConfigs } from '@/shared/models/config';
import { getUserInfo } from '@/shared/models/user';
import { hasRole, ROLES } from '@/shared/services/rbac';
import { getSettingTabs } from '@/shared/services/settings';
import { getSetupChecks } from '@/shared/services/setup-readiness';
import { getWanVideoConfigs } from '@/shared/services/wan-video-config';
import { wanCapabilities } from '@/shared/services/wan-video-contract';

export default async function SetupPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAllPermissions({
    codes: [PERMISSIONS.SETTINGS_READ, PERMISSIONS.SETTINGS_WRITE],
    redirectUrl: '/admin/no-permission',
    locale,
  });
  const zh = locale === 'zh';
  const config = await getAllConfigs();
  const checks = getSetupChecks(config, locale);
  const viewer = await getUserInfo();
  const tabs = await getSettingTabs(
    'setup',
    !!viewer && (await hasRole(viewer.id, ROLES.SUPER_ADMIN))
  );
  const videoConfig = await getWanVideoConfigs().catch(() => null);
  const enabledModes = videoConfig
    ? ['text', 'image', 'reference'].map((mode) => ({
        mode,
        capabilities: wanCapabilities(
          videoConfig,
          '3.0',
          mode as 'text' | 'image' | 'reference'
        ),
      }))
    : [];
  const title = zh ? '配置检查' : 'Setup checklist';
  return (
    <>
      <Header
        crumbs={[
          { title: 'Admin', url: '/admin' },
          { title, is_active: true },
        ]}
      />
      <Main>
        <MainHeader title={title} tabs={tabs} />
        <p className="text-muted-foreground mb-6 max-w-3xl text-sm">
          {zh
            ? '这里检查已保存配置的完整性，不会发送邮件、生成视频或创建付款。配置完整后仍需完成真实服务测试。'
            : 'Checks saved configuration without sending email, generating videos or creating payments. Complete a real service test after configuration.'}
        </p>
        <div className="mb-6 rounded-xl border p-4 text-sm">
          <p className="font-semibold">
            {zh
              ? '本环境 Google OAuth 回调地址'
              : 'Google OAuth callback for this environment'}
          </p>
          <code className="mt-2 block break-all">{`${envConfigs.auth_url.replace(/\/$/, '')}/api/auth/callback/google`}</code>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {checks.map((check) => (
            <section key={check.id} className="rounded-xl border p-5">
              <h2 className="font-semibold">{check.title}</h2>
              <p
                className={`my-2 text-sm ${check.ready ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'}`}
              >
                {check.ready
                  ? zh
                    ? '配置字段已齐全，待实测'
                    : 'Configuration present; test with the provider'
                  : zh
                    ? '待完成'
                    : 'Needs configuration'}
              </p>
              {!!check.missing.length && (
                <ul className="mb-3 list-inside list-disc text-sm">
                  {check.missing.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
              <Link
                href={check.href}
                className="text-sm font-medium text-violet-600 underline underline-offset-4"
              >
                {zh ? '打开设置' : 'Open settings'}
              </Link>
            </section>
          ))}
        </div>
        <section className="mt-6 rounded-xl border p-5">
          <h2 className="mb-3 font-semibold">Wan 3.0 Standard / Prime</h2>
          {!videoConfig && (
            <p role="alert">
              {zh
                ? '无法读取视频配置，请检查数据库及视频积分费率。'
                : 'Cannot read video configuration. Check the database and video credit rates.'}
            </p>
          )}
          {enabledModes.map(({ mode, capabilities }) => (
            <p key={mode} className="mb-2 text-sm">
              {mode}:{' '}
              {Object.entries(capabilities.tiers)
                .map(
                  ([tier, status]) =>
                    `${tier}: ${status.enabled ? (zh ? '可用参数已配置' : 'configured') : zh ? '不可用，请完成接口、存储、模型及费率设置' : 'unavailable; check API, storage, model and rates'}`
                )
                .join(' · ')}
            </p>
          ))}
          <Link
            href="/admin/settings/pricing"
            className="text-sm text-violet-600 underline"
          >
            {zh
              ? '商品价格与视频积分费率（超级管理员）'
              : 'Product prices and video credit rates (super administrator)'}
          </Link>
        </section>
      </Main>
    </>
  );
}
