import assert from 'node:assert/strict';
import { test } from 'node:test';

test('checkout catalog and displayed annual credit costs use approved server amounts', async () => {
  const catalog = await import('./wan-product-catalog').catch(() => undefined);
  assert.ok(catalog, 'server product catalog must exist');
  const {
    WAN_PRODUCTS,
    findWanProduct,
    unitCreditCost,
    isAnnualMonthlyProduct,
  } = catalog;
  assert.deepEqual(
    WAN_PRODUCTS.map((p) => [p.id, p.amount, p.credits, p.interval]),
    [
      ['starter-monthly-800', 1590, 800, 'month'],
      ['creator-monthly-2400', 4590, 2400, 'month'],
      ['pro-monthly-5200', 9590, 5200, 'month'],
      ['starter-annual-800-v1', 17200, 800, 'year'],
      ['creator-annual-2400-v1', 49500, 2400, 'year'],
      ['pro-annual-5200-v1', 103600, 5200, 'year'],
      ['starter-credits-800-v2', 1990, 800, 'one-time'],
      ['creator-credits-2400-v2', 5490, 2400, 'one-time'],
      ['pro-credits-5200-v2', 10990, 5200, 'one-time'],
    ]
  );
  const creator = findWanProduct('creator-annual-2400-v1')!;
  assert.equal(creator.displayMonthlyDollars, 42);
  assert.equal(creator.amount / 1200, 41.25);
  assert.equal(unitCreditCost(creator), 495 / 28800);
  assert.equal(findWanProduct('__proto__'), undefined);
  assert.equal(findWanProduct({ amount: 1 }), undefined);
  assert.equal(isAnnualMonthlyProduct('creator-annual-2400-v1'), true);
  assert.equal(isAnnualMonthlyProduct('creator-year-made-up'), false);
  assert.equal(findWanProduct('starter-credits-800-v2')?.validDays, 0);
});
