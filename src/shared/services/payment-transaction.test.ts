import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldApplyPaymentState } from './payment-events';

test('subscription state rejects duplicate and out-of-order signed events', () => {
  assert.equal(shouldApplyPaymentState(undefined, 100), true);
  assert.equal(shouldApplyPaymentState(100, 101), true);
  assert.equal(shouldApplyPaymentState(100, 100), false);
  assert.equal(shouldApplyPaymentState(100, 99), false);
  assert.equal(shouldApplyPaymentState(100, Number.NaN), false);
});
