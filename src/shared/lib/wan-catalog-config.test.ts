import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DEFAULT_WAN_CATALOG,
  parseWanCatalog,
  validateWanCatalogDraft,
  WAN_PRODUCTS,
  WanCatalogValidationError,
} from './wan-product-catalog';

const draft = () =>
  Object.fromEntries(
    WAN_PRODUCTS.map((p) => [
      p.id,
      { price: (p.amount / 100).toFixed(2), credits: String(p.credits) },
    ])
  );

test('missing catalog retains the nine canonical products and legacy defaults', () => {
  assert.deepEqual(parseWanCatalog(), DEFAULT_WAN_CATALOG);
  assert.equal(DEFAULT_WAN_CATALOG.products.length, 9);
  assert.equal(DEFAULT_WAN_CATALOG.revision, 'default-v1');
});

test('exact decimal parsing and independent credits preserve fixed identifiers and policies', () => {
  const values = draft();
  values['starter-monthly-800'] = { price: '19.99', credits: '999' };
  values['starter-annual-800-v1'] = { price: '200.01', credits: '1200' };
  const products = validateWanCatalogDraft(values);
  assert.deepEqual(products['starter-monthly-800'], {
    amount: 1999,
    credits: 999,
  });
  const catalog = parseWanCatalog(
    JSON.stringify({ version: 1, revision: 'revision-2', products })
  );
  assert.equal(catalog.products[0].id, 'starter-monthly-800');
  assert.equal(catalog.products[0].credits, 999);
  const annual = catalog.products.find(
    (p) => p.id === 'starter-annual-800-v1'
  )!;
  assert.equal(annual.amount, 20001);
  assert.equal(annual.credits, 1200);
  assert.equal(annual.creditPolicy, 'annual-monthly-v1');
  assert.equal(
    annual.originalMonthlyAmount,
    undefined,
    'different allowances must not imply an annual discount'
  );
});

test('invalid, incomplete and manipulated drafts are rejected with field errors', () => {
  for (const price of [
    '',
    '0',
    '-1',
    'NaN',
    'Infinity',
    '1e2',
    '1.001',
    '1,000',
    '1000000',
    ' 1.00 ',
    '0x10',
  ]) {
    const values = draft();
    values['starter-monthly-800'].price = price;
    assert.throws(
      () => validateWanCatalogDraft(values),
      (err: unknown) =>
        err instanceof WanCatalogValidationError &&
        err.fieldErrors['starter-monthly-800.price'] === 'invalid_price'
    );
  }
  for (const credits of [
    '',
    '0',
    '-1',
    '1.5',
    '1e3',
    '1000000001',
    'Infinity',
  ]) {
    const values = draft();
    values['starter-monthly-800'].credits = credits;
    assert.throws(
      () => validateWanCatalogDraft(values),
      WanCatalogValidationError
    );
  }
  const incomplete = draft();
  delete incomplete['starter-monthly-800'];
  assert.throws(
    () => validateWanCatalogDraft(incomplete),
    WanCatalogValidationError
  );
  assert.throws(
    () =>
      validateWanCatalogDraft({
        ...draft(),
        forged: { price: '1', credits: '1' },
      }),
    WanCatalogValidationError
  );
  assert.throws(
    () =>
      validateWanCatalogDraft({
        ...draft(),
        'starter-monthly-800': { price: 20, credits: '10' },
      }),
    WanCatalogValidationError
  );
});

test('malformed stored catalogs fail closed instead of silently reverting to defaults', () => {
  for (const raw of [
    '',
    '{bad',
    '{}',
    'null',
    JSON.stringify({ version: 1, revision: 'x', products: {} }),
  ])
    assert.throws(() => parseWanCatalog(raw), /pricing_invalid/);
  const products = validateWanCatalogDraft(draft());
  products['starter-monthly-800'].amount = 1.1;
  assert.throws(
    () =>
      parseWanCatalog(JSON.stringify({ version: 1, revision: 'x', products })),
    /pricing_invalid/
  );
});

test('annual comparison only exists for equal allowances with genuine savings', () => {
  const products = validateWanCatalogDraft(draft());
  let catalog = parseWanCatalog(
    JSON.stringify({ version: 1, revision: 'x', products })
  );
  assert.equal(
    catalog.products.find((p) => p.mode === 'annual')!.originalMonthlyAmount,
    1590
  );
  products['starter-annual-800-v1'].amount = 20000;
  catalog = parseWanCatalog(
    JSON.stringify({ version: 1, revision: 'y', products })
  );
  assert.equal(
    catalog.products.find((p) => p.mode === 'annual')!.originalMonthlyAmount,
    undefined
  );
});
