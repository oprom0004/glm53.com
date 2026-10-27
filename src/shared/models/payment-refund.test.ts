import assert from 'node:assert/strict';
import test from 'node:test';

import { planPaymentRefund } from './payment-refund';

test('full refunds reclaim only remaining source credits and keep consumed credits for review', () => {
  assert.deepEqual(
    planPaymentRefund({
      paidAmount: 1590,
      refundAmount: 1590,
      totalRefundedAmount: 1590,
      grants: [
        { credits: 500, remainingCredits: 300 },
        { credits: 300, remainingCredits: 300 },
      ],
      alreadyReclaimed: 0,
    }),
    {
      full: true,
      reclaimedCredits: 600,
      consumedCredits: 200,
      reviewRequired: true,
    }
  );
});

test('partial refunds never create negative credit and require manual review', () => {
  assert.deepEqual(
    planPaymentRefund({
      paidAmount: 1590,
      refundAmount: 500,
      totalRefundedAmount: 500,
      grants: [{ credits: 800, remainingCredits: 800 }],
      alreadyReclaimed: 0,
    }),
    {
      full: false,
      reclaimedCredits: 0,
      consumedCredits: 0,
      reviewRequired: true,
    }
  );
});

test('refund validation rejects cumulative amounts beyond the paid order', () => {
  assert.throws(
    () =>
      planPaymentRefund({
        paidAmount: 1590,
        refundAmount: 100,
        totalRefundedAmount: 1600,
        grants: [],
        alreadyReclaimed: 0,
      }),
    /refund amount/i
  );
});
