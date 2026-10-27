import assert from 'node:assert/strict';
import test from 'node:test';

import enIndex from './messages/en/pages/index.json';
import enPricing from './messages/en/pages/pricing.json';
import enPayments from './messages/en/settings/payments.json';
import zhIndex from './messages/zh/pages/index.json';
import zhPricing from './messages/zh/pages/pricing.json';
import zhPayments from './messages/zh/settings/payments.json';

function keys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    const nested = keys(child, path);
    return nested.length ? nested : [path];
  });
}

test('English and Chinese Wan-facing message resources have matching key sets', () => {
  for (const [english, chinese] of [
    [enIndex, zhIndex],
    [enPricing, zhPricing],
    [enPayments, zhPayments],
  ] as const) {
    assert.deepEqual(keys(english).sort(), keys(chinese).sort());
  }
});
