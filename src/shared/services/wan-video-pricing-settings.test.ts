import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';

import { createPaymentDb, type PaymentDbFixture } from '../test/payment-db';
import { quoteWanVideo } from './wan-video-contract';
import { WAN_DEFAULT_PRICE_CONFIG } from './wan-video-pricing';

let fixture: PaymentDbFixture;
let runtime: typeof import('./wan-video-config');
let configModel: typeof import('../models/config');
let editor: typeof import('./wan-video-pricing-settings');
before(async () => {
  fixture = await createPaymentDb();
  runtime = await import('./wan-video-config');
  configModel = await import('../models/config');
  editor = await import('./wan-video-pricing-settings');
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

const key = 'polaris_wan30_standard_480p_credits_per_second';
const auth = (id: string | null) => ({
  getUser: async () => (id ? { id } : null),
});

test('exact fractional rates survive admin save and fresh generation reads', async () => {
  const current = await editor.getWanVideoPricing();
  const rates = { ...current.rates, [key]: '50/7' };
  const saved = await editor.saveWanVideoPricing(
    { expectedRevision: current.revision, rates },
    auth('owner')
  );
  assert.equal(saved.rates[key], '50/7');
  assert.equal((await runtime.getWanVideoConfigs())[key], '50/7');
});

test('fresh generation configuration uses the atomic video-rate settings over legacy values', async () => {
  await fixture.client.execute({
    sql: 'INSERT INTO config (name,value) VALUES (?,?), (?,?)',
    args: [
      key,
      '4',
      'wan_pricing_video_rates',
      JSON.stringify({
        version: 1,
        revision: 'test-1',
        rates: { ...WAN_DEFAULT_PRICE_CONFIG, [key]: '7.5' },
      }),
    ],
  });
  assert.equal((await runtime.getWanVideoConfigs())[key], '7.5');
  assert.equal(
    quoteWanVideo(
      {
        version: '3.0',
        tier: 'standard',
        mode: 'text',
        duration: 3,
        resolution: '480P',
        ratio: '16:9',
      },
      {
        ...(await runtime.getWanVideoConfigs()),
        polaris_api_key: 'test-key',
        polaris_wan30_model: 'wan3.0-video',
        r2_account_id: '0123456789abcdef0123456789abcdef',
        r2_bucket_name: 'test-bucket',
        r2_access_key: 'test-access',
        r2_secret_key: 'test-secret',
        r2_domain: 'https://media.wanai30.com',
      }
    ).credits,
    23
  );
  await fixture.client.execute({
    sql: 'UPDATE config SET value=? WHERE name=?',
    args: [
      JSON.stringify({
        version: 1,
        revision: 'test-2',
        rates: { ...WAN_DEFAULT_PRICE_CONFIG, [key]: '' },
      }),
      'wan_pricing_video_rates',
    ],
  });
  assert.equal((await runtime.getWanVideoConfigs())[key], '');
});

test('corrupt atomic video rates stop generation instead of using a default price', async () => {
  await fixture.client.execute(
    "INSERT INTO config (name,value) VALUES ('wan_pricing_video_rates','broken')"
  );
  await assert.rejects(runtime.getWanVideoConfigs(), /pricing_invalid/);
});

test('ordinary config writes cannot modify per-second rates or their case aliases', async () => {
  for (const name of [key, key.toUpperCase(), 'wan_pricing_video_rates']) {
    await assert.rejects(
      configModel.saveConfigs({ [name]: '1' }),
      /reserved_pricing_config|invalid_config_name/
    );
    const saved = await fixture.client.execute({
      sql: 'SELECT value FROM config WHERE name=?',
      args: [name],
    });
    assert.equal(saved.rows.length, 0);
  }
});

test('editor preserves old per-second values and saves the complete rate matrix atomically', async () => {
  await fixture.client.execute({
    sql: 'INSERT INTO config (name,value) VALUES (?,?)',
    args: [key, '6'],
  });
  const initial = await editor.getWanVideoPricing();
  assert.equal(initial.rates[key], '6');
  const saved = await editor.saveWanVideoPricing(
    {
      expectedRevision: initial.revision,
      rates: { ...initial.rates, [key]: ' 7.5 ' },
    },
    auth('owner')
  );
  assert.equal(saved.rates[key], '7.5');
  assert.deepEqual(await editor.getWanVideoPricing(), saved);
  assert.equal((await runtime.getWanVideoConfigs())[key], '7.5');
  assert.equal(
    (
      await fixture.client.execute({
        sql: 'SELECT value FROM config WHERE name=?',
        args: [key],
      })
    ).rows[0].value,
    '6',
    'legacy data is preserved'
  );
});

test('video rate saves reject missing, ordinary, inactive and expired administrators', async () => {
  const initial = await editor.getWanVideoPricing();
  const input = { expectedRevision: initial.revision, rates: initial.rates };
  await assert.rejects(
    editor.saveWanVideoPricing(input, auth(null)),
    /pricing_unauthorized/
  );
  await assert.rejects(
    editor.saveWanVideoPricing(input, auth('other')),
    /pricing_forbidden/
  );
  await fixture.client.execute(
    "UPDATE role SET status='disabled' WHERE id='super'"
  );
  await assert.rejects(
    editor.saveWanVideoPricing(input, auth('owner')),
    /pricing_forbidden/
  );
  await fixture.client.execute(
    "UPDATE role SET status='active' WHERE id='super'"
  );
  await fixture.client.execute(
    "UPDATE user_role SET expires_at=1 WHERE user_id='owner'"
  );
  await assert.rejects(
    editor.saveWanVideoPricing(input, auth('owner')),
    /pricing_forbidden/
  );
});

test('invalid or incomplete rates never partially persist', async () => {
  const initial = await editor.getWanVideoPricing();
  for (const value of ['0', '-1', '1.25', '1e2', '100000', 3.5]) {
    await assert.rejects(
      editor.saveWanVideoPricing(
        {
          expectedRevision: initial.revision,
          rates: { ...initial.rates, [key]: value },
        },
        auth('owner')
      ),
      /pricing_invalid/
    );
  }
  const missing = { ...initial.rates };
  delete missing[key];
  await assert.rejects(
    editor.saveWanVideoPricing(
      { expectedRevision: initial.revision, rates: missing },
      auth('owner')
    ),
    /pricing_invalid/
  );
  await assert.rejects(
    editor.saveWanVideoPricing(
      {
        expectedRevision: initial.revision,
        rates: { ...initial.rates, forged: '1' },
      },
      auth('owner')
    ),
    /pricing_invalid/
  );
  assert.deepEqual(await editor.getWanVideoPricing(), initial);
});

test('stale and simultaneous edits cannot overwrite a newer video rate matrix', async () => {
  const initial = await editor.getWanVideoPricing();
  const input = { expectedRevision: initial.revision, rates: initial.rates };
  const first = await Promise.allSettled([
    editor.saveWanVideoPricing(input, auth('owner')),
    editor.saveWanVideoPricing(input, auth('owner')),
  ]);
  assert.equal(first.filter((r) => r.status === 'fulfilled').length, 1);
  await assert.rejects(
    editor.saveWanVideoPricing(input, auth('owner')),
    /pricing_conflict/
  );
  const current = await editor.getWanVideoPricing();
  const second = await Promise.allSettled(
    [4, 5].map((rate) =>
      editor.saveWanVideoPricing(
        {
          expectedRevision: current.revision,
          rates: { ...current.rates, [key]: String(rate) },
        },
        auth('owner')
      )
    )
  );
  assert.equal(second.filter((r) => r.status === 'fulfilled').length, 1);
});

test('environment overrides are visible, immutable in the editor, and do not replace stored rates', async () => {
  const envKey = key.toUpperCase();
  const previous = process.env[envKey];
  try {
    process.env[envKey] = ' 9.5 ';
    const initial = await editor.getWanVideoPricing();
    assert.equal(initial.rates[key], '9.5');
    assert.equal(initial.overrides[key], '9.5');
    assert.equal((await runtime.getWanVideoConfigs())[key], '9.5');
    await assert.rejects(
      editor.saveWanVideoPricing(
        {
          expectedRevision: initial.revision,
          rates: { ...initial.rates, [key]: '8' },
        },
        auth('owner')
      ),
      /pricing_environment_override/
    );
    await editor.saveWanVideoPricing(
      { expectedRevision: initial.revision, rates: initial.rates },
      auth('owner')
    );
    delete process.env[envKey];
    assert.equal((await editor.getWanVideoPricing()).rates[key], '3.5');
  } finally {
    if (previous === undefined) delete process.env[envKey];
    else process.env[envKey] = previous;
  }
});

test('video-rate HTTP endpoints protect reads and writes and return safe validation errors', async () => {
  const request = (body?: unknown, origin = 'https://wanai30.com') =>
    new Request(
      'https://wanai30.com/api/admin/video-pricing',
      body === undefined
        ? undefined
        : {
            method: 'POST',
            headers: { Origin: origin, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }
    );
  const initial = await editor.getWanVideoPricing();
  const input = { expectedRevision: initial.revision, rates: initial.rates };
  assert.equal(
    (await editor.createVideoPricingHandler('GET', auth(null))(request()))
      .status,
    401
  );
  assert.equal(
    (await editor.createVideoPricingHandler('GET', auth('other'))(request()))
      .status,
    403
  );
  assert.equal(
    (
      await editor.createVideoPricingHandler(
        'POST',
        auth('owner')
      )(request(input, 'https://evil.invalid'))
    ).status,
    403
  );
  const invalid = await editor.createVideoPricingHandler(
    'POST',
    auth('owner')
  )(request({ ...input, rates: { ...input.rates, [key]: '0.25' } }));
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).fieldErrors[key], 'invalid_rate');
  const saved = await editor.createVideoPricingHandler(
    'POST',
    auth('owner')
  )(request(input));
  assert.equal(saved.status, 200);
  assert.match(saved.headers.get('Cache-Control')!, /no-store/);
});
