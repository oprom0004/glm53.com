import assert from 'node:assert/strict';
import { test } from 'node:test';

test('annual UTC windows preserve the original anchor and exclude the end', async () => {
  const policy = await import('./annual-credit-policy').catch(() => undefined);
  assert.ok(policy, 'annual policy must exist');
  for (const [start, end, feb, march] of [
    [
      '2028-01-31T08:15:00.123Z',
      '2029-01-31T08:15:00.123Z',
      '2028-02-29T08:15:00.123Z',
      '2028-03-31T08:15:00.123Z',
    ],
    [
      '2027-01-31T08:15:00.123Z',
      '2028-01-31T08:15:00.123Z',
      '2027-02-28T08:15:00.123Z',
      '2027-03-31T08:15:00.123Z',
    ],
  ]) {
    const period = { start: new Date(start), end: new Date(end) };
    const windows = policy.annualWindows(period);
    assert.equal(windows.length, 12);
    assert.equal(windows[0].end.toISOString(), feb);
    assert.equal(windows[1].end.toISOString(), march);
    assert.equal(windows[11].end.toISOString(), end);
    assert.equal(policy.currentAnnualWindow(period, new Date(feb))?.index, 1);
    assert.equal(
      policy.currentAnnualWindow(period, new Date(period.start.getTime() - 1)),
      undefined
    );
    assert.equal(policy.currentAnnualWindow(period, period.end), undefined);
    for (let i = 1; i < 12; i++)
      assert.equal(+windows[i].start, +windows[i - 1].end);
  }
  assert.equal(
    policy
      .addUtcMonthsClamped(new Date('2028-02-29T12:00:00Z'), 12)
      .toISOString(),
    '2029-02-28T12:00:00.000Z'
  );
  for (const end of [
    '2028-01-31',
    '2027-01-01',
    '2028-12-01',
    '2029-02-03',
    'invalid',
  ]) {
    assert.throws(() =>
      policy.annualWindows({
        start: new Date('2028-01-31T08:15:00Z'),
        end: new Date(end),
      })
    );
  }
  assert.throws(() => policy.addUtcMonthsClamped(new Date('invalid'), 1));
  assert.throws(() => policy.addUtcMonthsClamped(new Date(), 1.5));
});

test('annual snapshots reject malformed ownership, credits, dates and policy versions', async () => {
  const policy = await import('./annual-credit-policy').catch(() => undefined);
  assert.ok(policy, 'annual policy must exist');
  const snapshot = {
    version: 1,
    policy: 'annual-monthly-v1',
    orderNo: 'o',
    userId: 'u',
    subscriptionNo: 's',
    provider: 'stripe',
    periodStart: '2028-01-31T08:15:00.000Z',
    periodEnd: '2029-01-31T08:15:00.000Z',
    monthlyCredits: 800,
  };
  assert.deepEqual(
    policy.parseAnnualSnapshot(JSON.stringify(snapshot)),
    snapshot
  );
  for (const value of [
    null,
    'not-json',
    '{}',
    ...[
      { version: 99 },
      { userId: '' },
      { monthlyCredits: '800' },
      { monthlyCredits: -1 },
      { monthlyCredits: 1.5 },
      { periodStart: 'garbage' },
      { periodEnd: '2028-02-29T08:15:00.000Z' },
    ].map((patch) => JSON.stringify({ ...snapshot, ...patch })),
  ])
    assert.equal(policy.parseAnnualSnapshot(value), undefined);
  const ids = ['entitlement', 0, 1, 11].map((k) =>
    policy.annualTransactionNo('order1', k as 'entitlement' | number)
  );
  assert.equal(new Set(ids).size, 4);
  assert.equal(policy.annualTransactionNo('order1', 0), ids[1]);
  assert.notEqual(policy.annualTransactionNo('order2', 0), ids[1]);
  for (const k of [-1, 12, 1.5])
    assert.throws(() => policy.annualTransactionNo('order1', k));
});
