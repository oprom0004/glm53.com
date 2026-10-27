import { Fragment } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PERMISSIONS, requireAllPermissions } from '@/core/rbac';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { FormCard } from '@/shared/blocks/form';
import { PolarisModelCheck } from '@/shared/blocks/polaris/model-check';
import { getAllConfigs, saveConfigs } from '@/shared/models/config';
import { getUserInfo } from '@/shared/models/user';
import { normalizePolarisSettings } from '@/shared/services/polaris-settings';
import { hasRole, ROLES } from '@/shared/services/rbac';
import {
  assertAllowedSettingSubmission,
  decorateAdminSecretFields,
  getSecretSettingNames,
  mergeSecretSettingSubmission,
  prepareAdminConfigView,
} from '@/shared/services/setting-secrets';
import {
  getSettingGroups,
  getSettings,
  getSettingTabs,
} from '@/shared/services/settings';
import { Crumb } from '@/shared/types/blocks/common';
import { Form as FormType } from '@/shared/types/blocks/form';

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string; tab: string }>;
}) {
  const { locale, tab } = await params;
  setRequestLocale(locale);

  // Check if user has permission to read settings
  await requireAllPermissions({
    codes: [PERMISSIONS.SETTINGS_READ, PERMISSIONS.SETTINGS_WRITE],
    redirectUrl: '/admin/no-permission',
    locale,
  });

  const settingGroups = await getSettingGroups();
  const settings = await getSettings();
  const allConfigs = await getAllConfigs();
  const { values: configs, configuredSecrets } = prepareAdminConfigView(
    allConfigs,
    settings
  );

  const t = await getTranslations('admin.settings');

  const crumbs: Crumb[] = [
    { title: t('edit.crumbs.admin'), url: '/admin' },
    { title: t('edit.crumbs.settings'), is_active: true },
  ];

  const viewer = await getUserInfo();
  const tabs = await getSettingTabs(
    tab ?? 'auth',
    !!viewer && (await hasRole(viewer.id, ROLES.SUPER_ADMIN))
  );

  const handleSubmit = async (data: FormData) => {
    'use server';

    const t = await getTranslations({ locale, namespace: 'admin.settings' });
    const user = await getUserInfo();

    if (!user) {
      throw new Error('no auth');
    }

    await requireAllPermissions({
      codes: [PERMISSIONS.SETTINGS_READ, PERMISSIONS.SETTINGS_WRITE],
      locale,
    });

    const currentConfigs = await getAllConfigs();
    const submitted: Record<string, string> = {};
    data.forEach((value, name) => {
      submitted[name] = value as string;
    });
    let normalized = submitted;
    const currentSettings = await getSettings();
    try {
      assertAllowedSettingSubmission(submitted, currentSettings);
      normalized = normalizePolarisSettings(submitted);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      return {
        status: 'error',
        message:
          code === 'invalid_base_url'
            ? t('polaris.settings_errors.invalid_base_url')
            : code === 'invalid_api_key'
              ? t('polaris.settings_errors.invalid_api_key')
              : code === 'invalid_model_id'
                ? t('polaris.settings_errors.invalid_model_id')
                : code === 'invalid_price'
                  ? t('polaris.settings_errors.invalid_price')
                  : code === 'invalid_r2_settings'
                    ? t('polaris.settings_errors.invalid_r2_settings')
                    : code === 'invalid_output_hosts'
                      ? t('polaris.settings_errors.invalid_output_hosts')
                      : t('polaris.settings_errors.invalid_settings'),
      };
    }
    const updates = mergeSecretSettingSubmission(
      currentConfigs,
      normalized,
      getSecretSettingNames(currentSettings)
    );
    await saveConfigs(updates);

    return {
      status: 'success',
      message: 'Settings updated',
    };
  };

  let forms: FormType[] = [];

  settingGroups.forEach((group) => {
    if (group.tab !== tab) {
      return;
    }

    forms.push({
      title: group.title,
      description: group.description,
      fields: decorateAdminSecretFields(
        settings
          .filter((setting) => setting.group === group.name)
          .map((setting) => ({
            name: setting.name,
            title:
              group.name === 'google_auth'
                ? t(`google.fields.${setting.name}.title`)
                : setting.title,
            type: setting.type as any,
            placeholder: setting.placeholder,
            group: setting.group,
            options: setting.options,
            tip:
              group.name === 'google_auth'
                ? t(`google.fields.${setting.name}.tip`)
                : setting.tip,
            value: setting.value,
            attributes: setting.attributes,
            metadata: setting.metadata,
          })),
        configuredSecrets,
        {
          clearTitle: t('secrets.clear_title'),
          clearTip: t('secrets.clear_tip'),
        }
      ) as FormType['fields'],
      passby: {
        provider: group.name,
        tab: group.tab,
      },
      data: configs,
      submit: {
        button: {
          title: t('edit.buttons.submit'),
        },
        handler: handleSubmit as any,
      },
    });
  });

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader title={t('edit.title')} tabs={tabs} />
        {forms.map((form) => (
          <Fragment key={form.title}>
            <FormCard
              title={form.title}
              description={form.description}
              form={form}
              className="mb-8 md:max-w-xl"
              defaultCollapsed={false}
              collapsible={true}
            />
            {form.passby?.provider === 'polaris' && <PolarisModelCheck />}
          </Fragment>
        ))}
      </Main>
    </>
  );
}
