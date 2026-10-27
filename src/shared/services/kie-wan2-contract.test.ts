import assert from 'node:assert/strict';
import { test } from 'node:test';

import { KIE_WAN2_MODELS } from './kie-wan2-contract';
import {
  quoteWanVideo,
  resolveWanVideoQuote,
  wanCapabilities,
} from './wan-video-contract';

const configs = {
  wan30_provider: 'kie',
  kie_api_key: 'fixture-key',
  r2_account_id: 'a'.repeat(32),
  r2_bucket_name: 'test-bucket',
  r2_domain: 'https://media.example.com',
  r2_access_key: 'fixture',
  r2_secret_key: 'fixture',
  polaris_wan25_text_1080p_credits_per_second: '160/7',
  polaris_wan25_image_1080p_credits_per_second: '160/7',
};

test('six Kie Wan 2.x modes quote and advertise their real limits without Polaris credentials', () => {
  for (const version of ['2.5', '2.6', '2.7'] as const)
    for (const mode of ['text', 'image'] as const) {
      const capabilities = wanCapabilities(configs, version, mode);
      assert.equal(capabilities.tiers.standard.enabled, true);
      assert.equal(
        capabilities.tiers.standard.resolutions['480P'].enabled,
        false
      );
      assert.equal(
        capabilities.tiers.standard.resolutions['1080P'].enabled,
        true
      );
      assert.equal(capabilities.duration.min, version === '2.7' ? 2 : 5);
      assert.equal(capabilities.duration.step, version === '2.7' ? 1 : 5);
      assert.equal(capabilities.tiers.prime.enabled, false);
      assert.equal(capabilities.referenceVideo, false);
      const input = {
        version,
        mode,
        duration: 5,
        resolution: '720P',
        tier: 'standard',
        ratio: 'adaptive',
        prompt: 'A moving ocean wave',
      };
      const result = resolveWanVideoQuote(input, configs);
      assert.equal(result.provider, 'kie-wan');
      assert.equal(result.providerModel, KIE_WAN2_MODELS[version][mode]);
      assert.equal(result.credits, 50);
      for (const patch of [
        { resolution: '480P' },
        { prompt: 'x'.repeat(version === '2.5' ? 801 : 5001) },
        { duration: 16 },
        { ratio: '4:3', mode: 'image' },
      ]) {
        assert.throws(
          () => quoteWanVideo({ ...input, ...patch }, configs),
          /invalid_params|unsupported_model/
        );
      }
      if (version !== '2.7')
        assert.throws(
          () => quoteWanVideo({ ...input, duration: 6 }, configs),
          /invalid_params/
        );
      if (version === '2.6' && mode === 'image')
        assert.throws(
          () => quoteWanVideo({ ...input, prompt: 'x' }, configs),
          /invalid_params/
        );
    }
});

test('Kie keeps explicit price disablement and uses exact scaled credit rates', () => {
  const input = {
    version: '2.5',
    mode: 'text',
    duration: 5,
    resolution: '1080P',
    tier: 'standard',
    ratio: '16:9',
  };
  assert.equal(quoteWanVideo(input, configs).credits, 115);
  assert.throws(
    () =>
      quoteWanVideo(input, {
        ...configs,
        polaris_wan25_text_1080p_credits_per_second: '',
      }),
    /pricing_not_configured/
  );
  assert.equal(
    wanCapabilities({ ...configs, kie_api_key: '' }, '2.6').tiers.standard
      .enabled,
    false
  );
});
