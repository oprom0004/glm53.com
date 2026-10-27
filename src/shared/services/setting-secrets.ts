import { assertGenericConfigNames } from '@/shared/lib/config-key-policy';

import type { Setting } from './settings';

type SettingLike = Pick<Setting, 'name' | 'type' | 'metadata'>;

const isSecretSetting = (setting: SettingLike) =>
  setting.type === 'password' || setting.metadata?.secret === true;

export function assertAllowedSettingSubmission(
  submitted: Record<string, string>,
  settings: SettingLike[]
) {
  const names = Object.keys(submitted);
  assertGenericConfigNames(names);
  const allowed = new Set(settings.map((setting) => setting.name));
  for (const name of getSecretSettingNames(settings))
    allowed.add(`${name}__clear`);
  if (names.some((name) => !allowed.has(name)))
    throw new Error('unknown_setting');
}

export function getSecretSettingNames(settings: SettingLike[]) {
  return settings
    .filter(isSecretSetting)
    .map((setting) => setting.name)
    .filter(Boolean);
}

export function prepareAdminConfigView(
  configs: Record<string, string>,
  settings: SettingLike[]
) {
  const allowedNames = new Set(settings.map((setting) => setting.name));
  const values = Object.fromEntries(
    Object.entries(configs).filter(([name]) => allowedNames.has(name))
  );
  const configuredSecrets: Record<string, true> = {};

  for (const name of getSecretSettingNames(settings)) {
    if (configs[name]) configuredSecrets[name] = true;
    values[name] = '';
  }

  return { values, configuredSecrets };
}

export function decorateAdminSecretFields<T extends SettingLike>(
  settings: T[],
  configuredSecrets: Record<string, true>,
  labels: { clearTitle: string; clearTip: string }
) {
  const fields: Array<
    | T
    | {
        name: string;
        title: string;
        type: 'switch';
        value: boolean;
        tip: string;
        metadata: { clearsSecret: string };
      }
  > = [];

  for (const setting of settings) {
    if (!isSecretSetting(setting) || !configuredSecrets[setting.name]) {
      fields.push(setting);
      continue;
    }

    fields.push(
      {
        ...setting,
        metadata: { ...setting.metadata, configured: true },
      },
      {
        name: `${setting.name}__clear`,
        title: labels.clearTitle,
        type: 'switch',
        value: false,
        tip: labels.clearTip,
        metadata: { clearsSecret: setting.name },
      }
    );
  }

  return fields;
}

export function mergeSecretSettingSubmission(
  current: Record<string, string>,
  submitted: Record<string, string>,
  secretNames: string[]
) {
  const secretSet = new Set(secretNames);
  const updates: Record<string, string> = {};

  for (const [name, value] of Object.entries(submitted)) {
    if (name.endsWith('__clear')) continue;
    if (!secretSet.has(name)) {
      updates[name] = value;
      continue;
    }

    const clearRequested = submitted[`${name}__clear`] === 'true';
    if (clearRequested) {
      updates[name] = '';
    } else if (value) {
      updates[name] = value;
    } else if (!current[name]) {
      // An empty, never-configured field needs no database row.
      continue;
    }
  }

  return updates;
}
