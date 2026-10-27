import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';

import { WAN_PRODUCTS } from '../lib/wan-product-catalog';
import { createPaymentDb, type PaymentDbFixture } from '../test/payment-db';

let fixture: PaymentDbFixture;
let catalog: typeof import('./wan-catalog');
let configs: typeof import('../models/config');
let api: typeof import('./wan-catalog-api');
before(async () => {
  fixture = await createPaymentDb();
  catalog = await import('./wan-catalog');
  configs = await import('../models/config');
  api = await import('./wan-catalog-api');
});
beforeEach(async () => {
  await fixture.reset();
  await fixture.client.execute(
    "INSERT INTO role (id,name,title,status) VALUES ('super','super_admin','Super','active'), ('admin','admin','Admin','active')"
  );
  await fixture.client.execute(
    "INSERT INTO user_role (id,user_id,role_id) VALUES ('a','owner','super'), ('b','other','admin')"
  );
});
after(async () => fixture?.close());
const auth = (id: string | null) => ({
  getUser: async () => (id ? { id } : null),
});
const draft = () =>
  Object.fromEntries(
    WAN_PRODUCTS.map((p) => [
      p.id,
      { price: (p.amount / 100).toFixed(2), credits: String(p.credits) },
    ])
  );

test('fresh reads and atomic complete catalog saves do not expose unrelated secrets', async () => {
  await fixture.client.execute(
    "INSERT INTO config (name,value) VALUES ('stripe_secret_key','sk_test_never_public')"
  );
  const initial = await catalog.getWanCatalog();
  const products = draft();
  products['starter-monthly-800'] = { price: '21.23', credits: '1234' };
  const saved = await catalog.saveWanCatalog(
    { expectedRevision: initial.revision, products },
    auth('owner')
  );
  assert.notEqual(saved.revision, initial.revision);
  assert.equal(saved.products[0].amount, 2123);
  assert.equal(saved.products[0].credits, 1234);
  assert.deepEqual(await catalog.getWanCatalog(), saved);
  assert.doesNotMatch(JSON.stringify(saved), /sk_test_never_public/);
});

test('unauthenticated, ordinary admin, inactive and expired super-admin cannot write', async () => {
  for (const [id, code] of [
    [null, 'pricing_unauthorized'],
    ['other', 'pricing_forbidden'],
  ] as const)
    await assert.rejects(
      catalog.saveWanCatalog(
        { expectedRevision: 'default-v1', products: draft() },
        auth(id)
      ),
      new RegExp(code)
    );
  await fixture.client.execute(
    "UPDATE role SET status = 'disabled' WHERE id = 'super'"
  );
  await assert.rejects(
    catalog.saveWanCatalog(
      { expectedRevision: 'default-v1', products: draft() },
      auth('owner')
    ),
    /pricing_forbidden/
  );
  await fixture.client.execute(
    "UPDATE role SET status = 'active' WHERE id = 'super'"
  );
  await fixture.client.execute(
    "UPDATE user_role SET expires_at = 1 WHERE user_id = 'owner'"
  );
  await assert.rejects(
    catalog.saveWanCatalog(
      { expectedRevision: 'default-v1', products: draft() },
      auth('owner')
    ),
    /pricing_forbidden/
  );
  assert.equal((await catalog.getWanCatalog()).revision, 'default-v1');
});

test('simultaneous first saves and stale revisions never overwrite the winning catalog', async () => {
  const a = draft(),
    b = draft();
  b['pro-credits-5200-v2'].credits = '6000';
  const results = await Promise.allSettled([
    catalog.saveWanCatalog(
      { expectedRevision: 'default-v1', products: a },
      auth('owner')
    ),
    catalog.saveWanCatalog(
      { expectedRevision: 'default-v1', products: b },
      auth('owner')
    ),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  const rejected = results.find(
    (r) => r.status === 'rejected'
  ) as PromiseRejectedResult;
  assert.match(rejected.reason.message, /pricing_conflict/);
  const current = await catalog.getWanCatalog();
  await assert.rejects(
    catalog.saveWanCatalog(
      { expectedRevision: 'default-v1', products: b },
      auth('owner')
    ),
    /pricing_conflict/
  );
  assert.deepEqual(await catalog.getWanCatalog(), current);
  const updates = await Promise.allSettled([
    catalog.saveWanCatalog(
      { expectedRevision: current.revision, products: a },
      auth('owner')
    ),
    catalog.saveWanCatalog(
      { expectedRevision: current.revision, products: b },
      auth('owner')
    ),
  ]);
  assert.equal(updates.filter((r) => r.status === 'fulfilled').length, 1);
});

test('invalid inputs cannot partially save and malformed storage does not become a default quote', async () => {
  const products = draft();
  products['pro-annual-5200-v1'].price = '1.001';
  await assert.rejects(
    catalog.saveWanCatalog(
      { expectedRevision: 'default-v1', products },
      auth('owner')
    ),
    /pricing_invalid/
  );
  assert.equal((await catalog.getWanCatalog()).revision, 'default-v1');
  await fixture.client.execute(
    "INSERT INTO config (name,value) VALUES ('wan_pricing_catalog','broken')"
  );
  await assert.rejects(catalog.getWanCatalog(), /pricing_invalid/);
});

test('generic configuration mutations cannot bypass the super-admin pricing write boundary', async () => {
  await assert.rejects(
    configs.saveConfigs({ wan_pricing_catalog: '{}' }),
    /reserved_pricing_config/
  );
  await assert.rejects(
    configs.addConfig({ name: 'wan_pricing_catalog', value: '{}' }),
    /reserved_pricing_config/
  );
  assert.equal((await catalog.getWanCatalog()).revision, 'default-v1');
});

test('case-insensitive database keys cannot bypass the generic pricing write boundary', async () => {
  // Model a supported database's case-insensitive unique config name, in this
  // fixture's temporary database only. A failed cache revalidation after an
  // unauthorized mutation is still a write, so inspect persisted data first.
  await fixture.client.execute('DROP TABLE config');
  await fixture.client.execute(
    'CREATE TABLE config (name TEXT COLLATE NOCASE NOT NULL UNIQUE, value TEXT)'
  );
  const saved = await catalog.saveWanCatalog(
    { expectedRevision: 'default-v1', products: draft() },
    auth('owner')
  );
  for (const name of ['WAN_PRICING_CATALOG', 'Wan_Pricing_Catalog']) {
    let caught: unknown;
    try {
      await configs.saveConfigs({ [name]: '{}' });
    } catch (error) {
      caught = error;
    }
    assert.equal(
      (await catalog.getWanCatalog()).revision,
      saved.revision,
      'ordinary configuration writes must not mutate the protected catalog'
    );
    assert.match(String(caught), /reserved_pricing_config|invalid_config_name/);
  }
  for (const name of [
    'WÁN_PRICING_CATALOG',
    'ｗａｎ_pricing_catalog',
    'wan_prıcing_catalog',
  ]) {
    await assert.rejects(
      configs.saveConfigs({ [name]: '{}' }),
      /reserved_pricing_config|invalid_config_name/
    );
    await assert.rejects(
      configs.addConfig({ name, value: '{}' }),
      /reserved_pricing_config|invalid_config_name/
    );
  }
});

test('HTTP write rechecks roles, returns safe field errors and prevents cross-origin mutation', async () => {
  const request = (body: unknown, origin = 'https://wanai30.com') =>
    new Request('https://wanai30.com/api/admin/pricing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify(body),
    });
  const input = { expectedRevision: 'default-v1', products: draft() };
  assert.equal(
    (await api.createSaveWanCatalogHandler(auth(null))(request(input))).status,
    401
  );
  assert.equal(
    (await api.createSaveWanCatalogHandler(auth('other'))(request(input)))
      .status,
    403
  );
  assert.equal(
    (
      await api.createSaveWanCatalogHandler(auth('owner'))(
        request(input, 'https://evil.invalid')
      )
    ).status,
    403
  );
  input.products['creator-annual-2400-v1'].credits = '-1';
  const invalid = await api.createSaveWanCatalogHandler(auth('owner'))(
    request(input)
  );
  assert.equal(invalid.status, 400);
  assert.equal(
    (await invalid.json()).fieldErrors['creator-annual-2400-v1.credits'],
    'invalid_credits'
  );
  const saved = await api.createSaveWanCatalogHandler(auth('owner'))(
    request({ ...input, products: draft() })
  );
  assert.equal(saved.status, 200);
  assert.equal(
    (
      await api.createSaveWanCatalogHandler(auth('owner'))(
        request({ ...input, products: draft() })
      )
    ).status,
    409
  );
});

test('public catalog is no-store, omits secrets, and fails closed on a corrupt value', async () => {
  const response = await api.getWanCatalogResponse();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('Cache-Control')!, /no-store/);
  assert.equal((await response.json()).data.products.length, 9);
  await fixture.client.execute(
    "INSERT INTO config (name,value) VALUES ('wan_pricing_catalog','secret_bad_value')"
  );
  const failed = await api.getWanCatalogResponse();
  assert.equal(failed.status, 503);
  assert.doesNotMatch(await failed.text(), /secret_bad_value/);
});
