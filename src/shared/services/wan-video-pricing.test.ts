import assert from 'node:assert/strict';
import { test } from 'node:test';

import { POLARIS_MODELS } from './polaris-models';
import {
  quoteWanVideo,
  resolveWanVideoQuote,
  wanCapabilities,
} from './wan-video-contract';
import {
  parseWanCreditRate,
  WAN_DEFAULT_CREDITS_PER_SECOND,
  WAN_PRICE_FIELDS,
  wanCreditsForDuration,
} from './wan-video-pricing';

const infrastructure = {
  polaris_api_key: 'fixture-key',
  r2_account_id: '0123456789abcdef0123456789abcdef',
  r2_domain: 'https://media.wanai30.com',
  r2_bucket_name: 'fixture-bucket',
  r2_access_key: 'fixture-id',
  r2_secret_key: 'fixture-secret',
};

const models = Object.fromEntries(
  POLARIS_MODELS.map(({ name, value }) => [name, value])
);

test('fractional rates preserve the new credit unit and round once per generation', () => {
  assert.equal(parseWanCreditRate('50/7'), 50 / 7);
  for (const invalid of [
    '1/0',
    '0/7',
    '1/2',
    '-50/7',
    '50/-7',
    '50/7/2',
    '1.5/7',
    ' 50/7 ',
    '700000/7',
    '10000000/100',
  ]) {
    assert.equal(parseWanCreditRate(invalid), null, invalid);
  }
  assert.equal(wanCreditsForDuration('50/7', 7), 50);
  assert.equal(wanCreditsForDuration('100/7', 7), 100);
  assert.equal(wanCreditsForDuration('200/7', 7), 200);
  assert.equal(wanCreditsForDuration('100/7', 5), 72);
  assert.equal(wanCreditsForDuration('50/7', 4.02), 29);
  assert.throws(() => wanCreditsForDuration('50/7', NaN), /invalid_params/);
  const input = {
    version: '3.0',
    tier: 'standard',
    mode: 'text',
    duration: 5,
    resolution: '720P',
    ratio: '16:9',
  };
  const configs = {
    ...infrastructure,
    ...models,
    polaris_wan30_standard_720p_credits_per_second: '10',
    polaris_wan30_prime_720p_credits_per_second: '100/7',
  };
  assert.equal(quoteWanVideo(input, configs).credits, 50);
  assert.equal(quoteWanVideo({ ...input, tier: 'prime' }, configs).credits, 72);
  assert.equal(
    quoteWanVideo({ ...input, tier: 'prime', duration: 7 }, configs).credits,
    100
  );
  assert.equal(1000 / quoteWanVideo(input, configs).credits, 20);
});

test('approved Wan matrix is the single source for models, duration and default rates', () => {
  assert.deepEqual(WAN_DEFAULT_CREDITS_PER_SECOND, {
    '2.5': { '480P': 5, '720P': 10, '1080P': null },
    '2.6': { '480P': 5, '720P': 10, '1080P': 16 },
    '2.7': { '480P': 5, '720P': 10, '1080P': 16 },
    '3.0': {
      standard: { '480P': 3.5, '720P': 7, '1080P': 14 },
      prime: { '480P': 5, '720P': 10, '1080P': 20 },
    },
  });
  assert.equal(WAN_PRICE_FIELDS.length, 24);

  const configs = { ...infrastructure, ...models };
  for (const [input, expected] of [
    [
      {
        version: '2.5',
        tier: 'standard',
        mode: 'text',
        duration: 5,
        resolution: '480P',
        ratio: 'adaptive',
      },
      25,
    ],
    [
      {
        version: '2.6',
        tier: 'standard',
        mode: 'image',
        duration: 15,
        resolution: '1080P',
        ratio: 'adaptive',
      },
      240,
    ],
    [
      {
        version: '2.7',
        tier: 'standard',
        mode: 'text',
        duration: 15,
        resolution: '720P',
        ratio: 'adaptive',
      },
      150,
    ],
    [
      {
        version: '3.0',
        tier: 'standard',
        mode: 'text',
        duration: 3,
        resolution: '480P',
        ratio: '16:9',
      },
      11,
    ],
    [
      {
        version: '3.0',
        tier: 'prime',
        mode: 'reference',
        duration: 30,
        resolution: '1080P',
        ratio: '9:16',
      },
      600,
    ],
  ] as const) {
    assert.equal(quoteWanVideo(input, configs).credits, expected);
  }
});

test('quote normalization enforces mode, duration, resolution and configured model', () => {
  const configs = { ...infrastructure, ...models };
  const valid = {
    version: '2.5',
    tier: 'standard',
    mode: 'text',
    duration: 5,
    resolution: '720P',
    ratio: 'adaptive',
  };
  assert.deepEqual(quoteWanVideo(valid, configs), {
    credits: 50,
    normalizedInput: valid,
    quoteVersion: 'wan-pricing-v1',
  });
  for (const invalid of [
    { duration: 1 },
    { duration: 11 },
    { duration: 2.5 },
    { resolution: '1080P' },
    { tier: 'prime' },
    { mode: 'reference' },
    { ratio: '16:9' },
  ]) {
    assert.throws(
      () => quoteWanVideo({ ...valid, ...invalid }, configs),
      /invalid_params|pricing_not_configured/
    );
  }
  assert.throws(
    () =>
      resolveWanVideoQuote(valid, {
        ...configs,
        polaris_wan25_text_model: 'invalid model',
      }),
    /unsupported_model/
  );
});

test('saved prices override defaults, explicit blanks disable a resolution and rate parsing is strict', () => {
  const configs = {
    ...infrastructure,
    ...models,
    polaris_wan30_standard_480p_credits_per_second: '7.5',
  };
  const input = {
    version: '3.0',
    tier: 'standard',
    mode: 'text',
    duration: 3,
    resolution: '480P',
    ratio: '16:9',
  };
  assert.equal(quoteWanVideo(input, configs).credits, 23);
  assert.throws(
    () =>
      quoteWanVideo(input, {
        ...configs,
        polaris_wan30_standard_480p_credits_per_second: '',
      }),
    /pricing_not_configured/
  );
  assert.equal(parseWanCreditRate('1'), 1);
  assert.equal(parseWanCreditRate('99999.5'), 99999.5);
  for (const invalid of ['', '0', '1.25', '-1', '100000', ' 5 ']) {
    assert.equal(parseWanCreditRate(invalid), null);
  }
});

test('capabilities expose only safe availability and the approved public matrix', () => {
  const capabilities = wanCapabilities(
    { ...infrastructure, ...models },
    '2.5',
    'text'
  );
  assert.deepEqual(capabilities.duration, { min: 2, max: 10, initial: 5, step: 1 });
  assert.equal(capabilities.tiers.standard.resolutions['720P'].enabled, true);
  assert.equal(capabilities.tiers.standard.resolutions['1080P'].enabled, false);
  assert.equal(capabilities.tiers.prime.enabled, false);
  assert.equal(JSON.stringify(capabilities).includes('fixture'), false);
});
