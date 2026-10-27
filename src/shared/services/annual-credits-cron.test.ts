import assert from 'node:assert/strict';
import { test } from 'node:test';

import { handleAnnualCreditsCron } from './annual-credits-cron';

test('annual cron never settles without a valid bearer secret', async () => {
  let calls = 0;
  const sweep = async () => {
    calls++;
    return { processed: 0, failed: 0, hasMore: false };
  };
  for (const token of ['', 'Bearer wrong']) {
    const response = await handleAnnualCreditsCron(
      new Request('https://wanai30.com/api/cron/annual-credits', {
        headers: { authorization: token },
      }),
      'test-secret',
      sweep
    );
    assert.equal(response.status, 401);
  }
  assert.equal(calls, 0);
});

test('annual cron exposes a bounded summary and reports partial or fatal failures for retry', async () => {
  const request = () =>
    new Request('https://wanai30.com/api/cron/annual-credits', {
      headers: { authorization: 'Bearer test-secret' },
    });
  const ok = await handleAnnualCreditsCron(
    request(),
    'test-secret',
    async () => ({ processed: 2, failed: 0, hasMore: false })
  );
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('cache-control'), 'private, no-store');
  const partial = await handleAnnualCreditsCron(
    request(),
    'test-secret',
    async () => ({ processed: 1, failed: 1, hasMore: true })
  );
  assert.equal(partial.status, 503);
  const failed = await handleAnnualCreditsCron(
    request(),
    'test-secret',
    async () => {
      throw new Error('private connection details');
    }
  );
  assert.equal(failed.status, 503);
  assert.deepEqual(await failed.json(), {
    error: 'annual_credit_settlement_unavailable',
  });
});
