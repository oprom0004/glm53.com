import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  getWanGeneratorCopy,
  WAN_GENERATOR_CONFIGS,
} from './generator-copy';

test('all Wan routes share one approved capability-aware generator config', () => {
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(WAN_GENERATOR_CONFIGS).map(([version, config]) => [
        version,
        {
          route: config.route,
          maxDuration: config.maxDuration,
          resolutions: config.resolutions,
          modes: config.modes,
        },
      ])
    ),
    {
      '2.5': {
        route: '/wan-2-5',
        maxDuration: 10,
        resolutions: ['720P', '1080P'],
        modes: ['text', 'image'],
      },
      '2.6': {
        route: '/wan-2-6',
        maxDuration: 15,
        resolutions: ['720P', '1080P'],
        modes: ['text', 'image'],
      },
      '2.7': {
        route: '/wan-2-7',
        maxDuration: 15,
        resolutions: ['720P', '1080P'],
        modes: ['text', 'image'],
      },
      '3.0': {
        route: '/wan-3',
        maxDuration: 30,
        resolutions: ['480P', '720P', '1080P'],
        modes: ['text', 'image', 'reference'],
      },
    }
  );
});

test('English and Chinese generator copy never advertises the excluded 50-credit gift', () => {
  for (const locale of ['en', 'zh'] as const) {
    const serialized = JSON.stringify(getWanGeneratorCopy(locale));
    assert.equal(/赠送|免费.?50|50.?积分|gift.?50|50.?free/i.test(serialized), false);
    assert.ok(serialized.includes(locale === 'zh' ? '生成' : 'Generate'));
  }
});
