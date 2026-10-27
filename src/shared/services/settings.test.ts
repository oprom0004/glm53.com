import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mergeConfigSources } from '@/shared/models/config';

import { POLARIS_MODELS } from './polaris-models';
import { normalizePolarisSettings } from './polaris-settings';
import {
  assertAllowedSettingSubmission,
  decorateAdminSecretFields,
  getSecretSettingNames,
  mergeSecretSettingSubmission,
  prepareAdminConfigView,
} from './setting-secrets';
import { getSettings } from './settings';
import { WAN_PRICE_FIELDS } from './wan-video-pricing';

test('generic settings accept only registered canonical names and explicit secret clear controls', async () => {
  const settings = await getSettings();
  for (const setting of settings.filter(
    (field) => field.group !== 'video_pricing'
  ))
    assert.doesNotThrow(() =>
      assertAllowedSettingSubmission({ [setting.name]: '' }, settings)
    );
  assert.doesNotThrow(() =>
    assertAllowedSettingSubmission(
      { stripe_secret_key__clear: 'true' },
      settings
    )
  );
  for (const name of [
    'WAN_PRICING_CATALOG',
    'wan_pricing_catalog',
    'WÁN_PRICING_CATALOG',
    'wan_prıcing_catalog',
    'undeclared_field',
    'stripe_enabled__clear',
  ])
    assert.throws(
      () => assertAllowedSettingSubmission({ [name]: '{}' }, settings),
      /reserved_pricing_config|invalid_config_name|unknown_setting/
    );
});

test('Wan provider settings are server-only admin fields with explicit secret metadata', async () => {
  const settings = await getSettings();
  const providerFields = settings.filter((field) =>
    ['polaris', 'r2'].includes(field.group || '')
  );

  assert.deepEqual(
    providerFields.map((field) => field.name),
    [
      'r2_account_id',
      'r2_access_key',
      'r2_secret_key',
      'r2_bucket_name',
      'r2_upload_path',
      'r2_endpoint',
      'r2_domain',
      'polaris_api_key',
      'polaris_webhook_secret',
      'polaris_base_url',
      'wan_video_output_hosts',
      'polaris_wan25_text_model',
      'polaris_wan25_image_model',
      'polaris_wan26_text_model',
      'polaris_wan26_image_model',
      'polaris_wan27_text_model',
      'polaris_wan27_image_model',
      'polaris_wan30_model',
      'polaris_wan30_prime_model',
    ]
  );

  assert.deepEqual(getSecretSettingNames(providerFields), [
    'r2_access_key',
    'r2_secret_key',
    'polaris_api_key',
    'polaris_webhook_secret',
  ]);
  assert.equal(
    providerFields.every((field) => field.metadata?.serverOnly === true),
    true
  );
  assert.equal(
    settings.some((field) => field.group === 'aliyun_oss'),
    false
  );
  for (const provider of ['openrouter', 'replicate', 'fal', 'gemini', 'kie']) {
    assert.ok(settings.find((field) => field.name === `${provider}_base_url`));
    assert.ok(
      settings.find(
        (field) => field.group === provider && field.type === 'password'
      )
    );
  }
});

test('Wan model and price settings expose the approved defaults as server-only fields', async () => {
  const settings = await getSettings();
  for (const expected of [...POLARIS_MODELS, ...WAN_PRICE_FIELDS]) {
    const field = settings.find(
      (candidate) => candidate.name === expected.name
    );
    assert.ok(field, expected.name);
    assert.equal(field.value, expected.value);
    assert.equal(
      field.group,
      WAN_PRICE_FIELDS.some((price) => price.name === expected.name)
        ? 'video_pricing'
        : 'polaris'
    );
    assert.equal(field.metadata?.serverOnly, true);
  }
});

test('video rates are registered under pricing and cannot be submitted through generic settings', async () => {
  const settings = await getSettings();
  for (const { name } of WAN_PRICE_FIELDS) {
    assert.equal(settings.find((field) => field.name === name)?.tab, 'pricing');
    assert.throws(
      () => assertAllowedSettingSubmission({ [name]: '1' }, settings),
      /reserved_pricing_config/
    );
  }
});

test('Polaris model ids are normalized and unsafe identifiers are rejected', () => {
  assert.deepEqual(
    normalizePolarisSettings({
      polaris_wan30_model: '  wan3.0-video  ',
      polaris_wan30_prime_model: '',
    }),
    {
      polaris_wan30_model: 'wan3.0-video',
      polaris_wan30_prime_model: '',
    }
  );
  assert.throws(
    () => normalizePolarisSettings({ polaris_wan30_model: 'wan model' }),
    /invalid_model_id/
  );
  assert.throws(
    () => normalizePolarisSettings({ polaris_wan30_model: 'wan/../../../x' }),
    /invalid_model_id/
  );
});

test('Polaris price settings accept blank, integer or half-credit values only', () => {
  assert.deepEqual(
    normalizePolarisSettings({
      polaris_wan30_standard_480p_credits_per_second: ' 7.5 ',
      polaris_wan25_text_1080p_credits_per_second: ' ',
    }),
    {
      polaris_wan30_standard_480p_credits_per_second: '7.5',
      polaris_wan25_text_1080p_credits_per_second: '',
    }
  );
  for (const value of ['0', '1.25', '-1', '100000', 'five']) {
    assert.throws(
      () =>
        normalizePolarisSettings({
          polaris_wan30_standard_480p_credits_per_second: value,
        }),
      /invalid_price/
    );
  }
});

test('provider endpoints and R2 settings reject unsafe input without exposing secrets', async () => {
  for (const url of [
    'http://api.example.com',
    'https://user:password@api.example.com',
    'https://api.example.com?key=secret',
    'https://127.0.0.1',
    'https://api.local',
  ]) {
    assert.throws(
      () => normalizePolarisSettings({ fal_base_url: url }),
      /^Error: invalid_base_url$/
    );
  }
  for (const host of [
    '*',
    '*.example.com',
    'https://cdn.example.com',
    '127.0.0.1',
  ]) {
    assert.throws(
      () => normalizePolarisSettings({ wan_video_output_hosts: host }),
      /invalid_output_hosts/
    );
  }
  assert.throws(
    () => normalizePolarisSettings({ r2_endpoint: 'https://example.com' }),
    /invalid_r2_settings/
  );
  assert.throws(
    () => normalizePolarisSettings({ r2_account_id: 'not-an-account' }),
    /invalid_r2_settings/
  );
  const fields = await getSettings();
  const view = prepareAdminConfigView(
    {
      r2_access_key: 'r2-private-id',
      r2_secret_key: 'r2-private-secret',
      fal_api_key: 'fal-private',
    },
    fields
  );
  assert.equal(JSON.stringify(view).includes('private'), false);
  assert.equal(view.configuredSecrets.r2_access_key, true);
  assert.equal(view.configuredSecrets.r2_secret_key, true);
});

test('admin config view never serializes stored secrets and reports configured state', () => {
  const fields = [
    {
      name: 'polaris_api_key',
      title: 'Polaris API Key',
      type: 'password',
      metadata: { secret: true, serverOnly: true },
    },
    {
      name: 'polaris_base_url',
      title: 'Polaris base URL',
      type: 'url',
      metadata: { serverOnly: true },
    },
  ];
  const view = prepareAdminConfigView(
    {
      polaris_api_key: 'private-test-key',
      polaris_base_url: 'https://api.polariscore.ai',
      database_url: 'postgres://must-not-reach-the-browser',
    },
    fields
  );

  assert.deepEqual(view.values, {
    polaris_api_key: '',
    polaris_base_url: 'https://api.polariscore.ai',
  });
  assert.deepEqual(view.configuredSecrets, { polaris_api_key: true });
  assert.equal(JSON.stringify(view).includes('private-test-key'), false);
});

test('empty secret submissions preserve stored values and explicit clear removes them', () => {
  const secretNames = ['polaris_api_key', 'polaris_webhook_secret'];
  assert.deepEqual(
    mergeSecretSettingSubmission(
      {
        polaris_api_key: 'stored-key',
        polaris_webhook_secret: 'stored-hook',
      },
      {
        polaris_api_key: '',
        polaris_webhook_secret: 'replacement-hook',
        polaris_base_url: 'https://api.polariscore.ai',
      },
      secretNames
    ),
    {
      polaris_webhook_secret: 'replacement-hook',
      polaris_base_url: 'https://api.polariscore.ai',
    }
  );

  assert.deepEqual(
    mergeSecretSettingSubmission(
      { polaris_api_key: 'stored-key' },
      { polaris_api_key: '', polaris_api_key__clear: 'true' },
      secretNames
    ),
    { polaris_api_key: '' }
  );
});

test('configured secrets gain an explicit clear switch without exposing their value', () => {
  assert.deepEqual(
    decorateAdminSecretFields(
      [
        {
          name: 'polaris_api_key',
          title: 'Polaris API Key',
          type: 'password',
          metadata: { secret: true, revealSecret: true },
        },
      ],
      { polaris_api_key: true },
      { clearTitle: 'Clear saved secret', clearTip: 'Save to remove it.' }
    ),
    [
      {
        name: 'polaris_api_key',
        title: 'Polaris API Key',
        type: 'password',
        metadata: {
          secret: true,
          revealSecret: true,
          configured: true,
        },
      },
      {
        name: 'polaris_api_key__clear',
        title: 'Clear saved secret',
        type: 'switch',
        value: false,
        tip: 'Save to remove it.',
        metadata: { clearsSecret: 'polaris_api_key' },
      },
    ]
  );
});

test('non-empty environment settings override database values while empty values do not', () => {
  assert.deepEqual(
    mergeConfigSources(
      { app_name: 'WanAI' },
      {
        polaris_api_key: 'database-key',
        aliyun_oss_bucket: 'database-bucket',
      },
      {
        POLARIS_API_KEY: 'environment-key',
        ALIYUN_OSS_BUCKET: '',
      },
      ['polaris_api_key', 'aliyun_oss_bucket']
    ),
    {
      app_name: 'WanAI',
      polaris_api_key: 'environment-key',
      aliyun_oss_bucket: 'database-bucket',
    }
  );
});
