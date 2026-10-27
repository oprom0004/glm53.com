import assert from 'node:assert/strict';
import test from 'node:test';

import { loadAccountOverview } from './account-overview';

test('account overview scopes every aggregate to the server session user', async () => {
  const calls: string[] = [];
  const result = await loadAccountOverview('owner', {
    getSubscription: async (userId) => {
      calls.push(`subscription:${userId}`);
      return {
        planName: 'Creator',
        status: 'active',
        currentPeriodEnd: new Date('2026-10-25T00:00:00Z'),
      } as any;
    },
    getCredits: async (userId) => {
      calls.push(`credits:${userId}`);
      return 1234;
    },
    getPayments: async (userId) => {
      calls.push(`payments:${userId}`);
      return [{ orderNo: 'order-1' }] as any;
    },
  });
  assert.deepEqual(calls, [
    'subscription:owner',
    'credits:owner',
    'payments:owner',
  ]);
  assert.equal(result.remainingCredits, 1234);
  assert.equal(result.subscription?.planName, 'Creator');
  assert.equal(result.paymentCount, 1);
  assert.equal(/trial/i.test(JSON.stringify(result)), false);
});
