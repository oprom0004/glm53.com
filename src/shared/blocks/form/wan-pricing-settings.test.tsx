import assert from 'node:assert/strict';
import { after, afterEach, before, test } from 'node:test';
import React, { act } from 'react';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { JSDOM } from 'jsdom';
import { NextIntlClientProvider } from 'next-intl';
import type { Root } from 'react-dom/client';

import {
  WAN_PRODUCTS,
  type WanCatalog,
} from '@/shared/lib/wan-product-catalog';
import type { WanVideoPricing } from '@/shared/lib/wan-video-rate-config';
import { WAN_DEFAULT_PRICE_CONFIG } from '@/shared/services/wan-video-pricing';

let dom: JSDOM, root: Root | undefined, host: HTMLDivElement;
let createRoot: typeof import('react-dom/client').createRoot;
let WanPricingSettings: typeof import('./wan-pricing-settings').WanPricingSettings;
let PricingNavigationProvider: typeof import('./wan-pricing-settings').PricingNavigationProvider;
let messages: Record<string, any>;
const originalFetch = globalThis.fetch;
const catalog: WanCatalog = {
  revision: 'initial-version',
  products: WAN_PRODUCTS.map((p, index) =>
    index === 0 ? { ...p, amount: 1234, credits: 999 } : p
  ),
};
let calls: { url: string; body: any; signal?: AbortSignal | null }[];
let respond: (url: string, body: any) => Promise<Response>;
let nav: string[];

before(async () => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'https://wanai30.com/admin/settings/pricing',
    pretendToBeVisual: true,
  });
  for (const name of [
    'window',
    'document',
    'navigator',
    'Node',
    'NodeFilter',
    'Element',
    'HTMLElement',
    'HTMLInputElement',
    'HTMLAnchorElement',
    'DocumentFragment',
    'MutationObserver',
    'CustomEvent',
  ]) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value: (dom.window as any)[name],
    });
  }
  Object.assign(globalThis, {
    IS_REACT_ACT_ENVIRONMENT: true,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
  });
  ({ createRoot } = await import('react-dom/client'));
  ({ WanPricingSettings, PricingNavigationProvider } = await import(
    './wan-pricing-settings'
  ));
  messages = {
    en: (await import('@/config/locale/messages/en/admin/pricing.json'))
      .default,
    zh: (await import('@/config/locale/messages/zh/admin/pricing.json'))
      .default,
  };
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  host?.remove();
  globalThis.fetch = originalFetch;
});
after(() => dom.window.close());

async function render(
  locale: 'en' | 'zh' = 'en',
  videoPricing?: WanVideoPricing,
  both = false
) {
  calls = [];
  nav = [];
  respond = async () =>
    Response.json({ code: 0, data: { ...catalog, revision: 'saved-version' } });
  globalThis.fetch = async (input, init) => {
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url: String(input), body, signal: init?.signal });
    return respond(String(input), body);
  };
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  const router = {
    push: (url: string) => nav.push(url),
    replace() {},
    refresh() {},
    back() {},
    forward() {},
    prefetch: async () => {},
  };
  await act(async () =>
    root!.render(
      <AppRouterContext.Provider value={router as any}>
        <NextIntlClientProvider
          locale={locale}
          timeZone="UTC"
          messages={{ admin: { pricing: messages[locale] } }}
        >
          <PricingNavigationProvider>
            {both && <WanPricingSettings catalog={catalog} />}
            <WanPricingSettings catalog={catalog} videoPricing={videoPricing} />
          </PricingNavigationProvider>
        </NextIntlClientProvider>
      </AppRouterContext.Provider>
    )
  );
}

const videoKey = 'polaris_wan30_standard_480p_credits_per_second';
const videoPricing: WanVideoPricing = {
  revision: 'video-initial',
  rates: { ...WAN_DEFAULT_PRICE_CONFIG },
  overrides: {},
};

for (const locale of ['en', 'zh'] as const)
  test(`video rate editor ${locale} exposes 24 labeled rates and preserves disabled blanks`, async () => {
    await render(locale, videoPricing);
    assert.equal(host.querySelectorAll('input[name^="rates."]').length, 24);
    assert.equal(
      host.querySelector<HTMLInputElement>(`input[name="rates.${videoKey}"]`)!
        .value,
      '3.5'
    );
    assert.equal(
      host.querySelector<HTMLInputElement>(
        'input[name="rates.polaris_wan25_text_1080p_credits_per_second"]'
      )!.value,
      ''
    );
    assert.match(
      host.textContent!,
      locale === 'zh' ? /积分\/秒/ : /credits\/second/
    );
    for (const input of host.querySelectorAll('input'))
      assert.ok(host.querySelector(`label[for="${input.id}"]`));
  });

test('invalid video rate stays inline and focuses the field without sending a save', async () => {
  await render('zh', videoPricing);
  const input = host.querySelector<HTMLInputElement>(
    `input[name="rates.${videoKey}"]`
  )!;
  assert.ok(input);
  await change(input, '1.25');
  await save();
  assert.equal(calls.length, 0);
  assert.equal(input.getAttribute('aria-invalid'), 'true');
  assert.equal(document.activeElement, input);
});

test('video editor sends rates to its own endpoint, disables overrides and recovers conflicts', async () => {
  await render('en', { ...videoPricing, overrides: { [videoKey]: '3.5' } });
  assert.equal(
    host.querySelector<HTMLInputElement>(`input[name="rates.${videoKey}"]`)!
      .readOnly,
    true
  );
  respond = async () =>
    Response.json({ code: -1, message: 'pricing_conflict' }, { status: 409 });
  await save();
  assert.equal(calls[0].url, '/api/admin/video-pricing');
  assert.equal(calls[0].body.expectedRevision, 'video-initial');
  assert.equal(calls[0].body.products, undefined);
  assert.equal(saveButton().disabled, true);
  respond = async () =>
    Response.json({
      code: 0,
      data: { ...videoPricing, revision: 'video-reloaded' },
    });
  await act(async () => reloadButton().click());
  assert.equal(calls[1].url, '/api/admin/video-pricing');
  assert.equal(saveButton().disabled, false);
});

test('video save normalizes saved values, clears dirty state and uses the new revision', async () => {
  await render('en', videoPricing);
  const input = host.querySelector<HTMLInputElement>(
    `input[name="rates.${videoKey}"]`
  )!;
  await change(input, '7.5');
  respond = async (_url, body) =>
    Response.json({
      code: 0,
      data: {
        ...videoPricing,
        revision: 'video-saved',
        rates: body.rates,
      },
    });
  await save();
  assert.equal(calls[0].body.rates[videoKey], '7.5');
  assert.equal(input.value, '7.5');
  assert.match(host.textContent!, /Video rates saved/);
  const unload = new dom.window.Event('beforeunload', { cancelable: true });
  window.dispatchEvent(unload);
  assert.equal(unload.defaultPrevented, false);
  await change(input, '8');
  await save();
  assert.equal(calls[1].body.expectedRevision, 'video-saved');
});

test('unknown video save preserves the draft, blocks repeats and locks on expired reload session', async () => {
  await render('en', videoPricing);
  const input = host.querySelector<HTMLInputElement>(
    `input[name="rates.${videoKey}"]`
  )!;
  await change(input, '7.5');
  respond = async () => {
    throw new Error('connection reset');
  };
  await save();
  await save();
  assert.equal(calls.length, 1);
  assert.equal(input.value, '7.5');
  assert.equal(saveButton().disabled, true);
  assert.match(host.textContent!, /may have been saved/);
  respond = async () =>
    Response.json(
      { code: -1, message: 'pricing_unauthorized' },
      { status: 401 }
    );
  await act(async () => reloadButton().click());
  assert.equal(calls[1].url, '/api/admin/video-pricing');
  assert.equal(input.value, '7.5');
  assert.equal(saveButton().disabled, true);
  assert.equal(reloadButton().disabled, true);
});

test('both pricing forms share pending navigation warnings and release all unload guards', async () => {
  await render('en', videoPricing, true);
  await change(field('starter-monthly-800', 'credits'), '3456');
  const input = host.querySelector<HTMLInputElement>(
    `input[name="rates.${videoKey}"]`
  )!;
  await change(input, '7.5');
  let complete!: (response: Response) => void;
  respond = () =>
    new Promise((resolve) => {
      complete = resolve;
    });
  await act(async () =>
    host
      .querySelectorAll('form')[1]
      .dispatchEvent(
        new dom.window.Event('submit', { bubbles: true, cancelable: true })
      )
  );
  assert.equal(
    host.querySelectorAll('button[type="submit"]')[1].getAttribute('aria-busy'),
    'true'
  );
  const link = document.createElement('a');
  link.href = '/admin/settings/general';
  host.append(link);
  await act(async () => link.click());
  assert.equal(document.querySelectorAll('[role="dialog"]').length, 1);
  assert.match(
    document.querySelector('[role="dialog"]')!.textContent!,
    /request is still running/
  );
  const keep = [...document.querySelectorAll('button')].find(
    (b) => b.textContent === 'Keep editing'
  )!;
  await act(async () => keep.click());
  assert.equal(field('starter-monthly-800', 'credits').value, '3456');
  assert.equal(input.value, '7.5');
  await act(async () => link.click());
  const leave = [...document.querySelectorAll('button')].find(
    (b) => b.textContent === 'Leave settings'
  )!;
  await act(async () => leave.click());
  assert.deepEqual(nav, ['/admin/settings/general']);
  const unload = new dom.window.Event('beforeunload', { cancelable: true });
  window.dispatchEvent(unload);
  assert.equal(unload.defaultPrevented, false);
  await act(async () =>
    complete(Response.json({ code: 0, data: videoPricing }))
  );
});
function field(id: string, name: 'price' | 'credits') {
  const input = host.querySelector<HTMLInputElement>(
    `input[name="products.${id}.${name}"]`
  );
  assert.ok(input);
  return input;
}
async function change(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      dom.window.HTMLInputElement.prototype,
      'value'
    )!.set!.call(input, value);
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
}
async function save() {
  await act(async () =>
    host
      .querySelector('form')!
      .dispatchEvent(
        new dom.window.Event('submit', { bubbles: true, cancelable: true })
      )
  );
}
function saveButton() {
  return host.querySelector<HTMLButtonElement>('button[type="submit"]')!;
}
function reloadButton() {
  return host.querySelector<HTMLButtonElement>(
    '[data-action="reload-pricing"]'
  )!;
}

for (const locale of ['en', 'zh'] as const)
  test(`admin catalog ${locale} shows nine products with precise price and credit labels`, async () => {
    await render(locale);
    assert.equal(host.querySelectorAll('input').length, 18);
    assert.equal(host.querySelectorAll('[data-pricing-mode]').length, 3);
    assert.equal(field('starter-monthly-800', 'price').value, '12.34');
    assert.equal(field('starter-monthly-800', 'credits').value, '999');
    assert.equal(host.querySelector('form')!.noValidate, true);
    for (const input of host.querySelectorAll('input'))
      assert.ok(host.querySelector(`label[for="${input.id}"]`));
    const annual = host.querySelector(
      '[data-pricing-mode="annual"]'
    )!.textContent!;
    assert.match(
      annual,
      locale === 'en' ? /Annual price \(USD\)/ : /全年价格（USD）/
    );
    assert.match(annual, locale === 'en' ? /Credits per month/ : /每月积分/);
    assert.match(
      host.textContent!,
      locale === 'en' ? /existing orders and subscriptions/i : /已有订单和订阅/
    );
  });

test('invalid fractional cents and zero credits remain visible and focus the first field without a request', async () => {
  await render();
  const price = field('starter-monthly-800', 'price');
  await change(price, '0.009');
  await change(field('creator-monthly-2400', 'credits'), '0');
  await save();
  assert.equal(calls.length, 0);
  assert.equal(price.value, '0.009');
  assert.equal(price.getAttribute('aria-invalid'), 'true');
  assert.equal(document.activeElement, price);
  assert.match(
    host.querySelector('[role="alert"]')!.textContent!,
    /Check the highlighted fields/
  );
  assert.match(host.textContent!, /two decimal places/);
  assert.match(host.textContent!, /whole number/);
});

test('save submits the complete draft and original revision once and accepts only confirmed server values', async () => {
  await render();
  await change(field('starter-monthly-800', 'price'), '20.01');
  await change(field('starter-annual-800-v1', 'credits'), '1234');
  let complete!: (r: Response) => void;
  respond = () =>
    new Promise((resolve) => {
      complete = resolve;
    });
  await save();
  await save();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/admin/pricing');
  assert.equal(calls[0].body.expectedRevision, 'initial-version');
  assert.equal(Object.keys(calls[0].body.products).length, 9);
  assert.deepEqual(calls[0].body.products['starter-monthly-800'], {
    price: '20.01',
    credits: '999',
  });
  assert.equal(calls[0].body.products['starter-annual-800-v1'].credits, '1234');
  assert.equal(saveButton().disabled, true);
  assert.equal(saveButton().getAttribute('aria-busy'), 'true');
  assert.doesNotMatch(host.textContent!, /Pricing saved/);
  await act(async () =>
    complete(
      Response.json({ code: 0, data: { ...catalog, revision: 'new-version' } })
    )
  );
  assert.match(host.textContent!, /Pricing saved/);
  respond = async () =>
    Response.json({ code: 0, data: { ...catalog, revision: 'next-version' } });
  await change(field('starter-monthly-800', 'price'), '18.01');
  await save();
  assert.equal(calls[1].body.expectedRevision, 'new-version');
});

test('conflict preserves unsaved values and blocks overwrite until the admin explicitly reloads', async () => {
  await render();
  await change(field('starter-monthly-800', 'price'), '22.22');
  respond = async () =>
    Response.json({ code: -1, message: 'pricing_conflict' }, { status: 409 });
  await save();
  assert.equal(field('starter-monthly-800', 'price').value, '22.22');
  assert.equal(calls.length, 1);
  assert.equal(saveButton().disabled, true);
  assert.match(host.textContent!, /changed by another administrator/);
  respond = async () =>
    Response.json({
      code: 0,
      data: {
        ...catalog,
        revision: 'another-version',
        products: catalog.products.map((p, i) =>
          i === 0 ? { ...p, amount: 3333 } : p
        ),
      },
    });
  await act(async () => reloadButton().click());
  assert.equal(calls[1].url, '/api/payment/catalog');
  assert.equal(field('starter-monthly-800', 'price').value, '33.33');
  assert.match(host.textContent!, /Saved values loaded/);
  await change(field('starter-monthly-800', 'credits'), '1111');
  await save();
  assert.equal(calls[2].body.expectedRevision, 'another-version');
});

test('an unknown save outcome blocks repeat writes and a failed reload still preserves the draft', async () => {
  await render();
  await change(field('starter-monthly-800', 'price'), '44.44');
  respond = async () => {
    throw new Error('connection reset');
  };
  await save();
  await save();
  assert.equal(calls.length, 1);
  assert.equal(saveButton().disabled, true);
  assert.match(host.textContent!, /may have been saved/);
  await act(async () => reloadButton().click());
  assert.equal(field('starter-monthly-800', 'price').value, '44.44');
  assert.equal(saveButton().disabled, true);
  assert.match(host.textContent!, /Could not load saved pricing/);
});

test('server field validation is mapped to the input while permission loss locks all saves', async () => {
  await render('zh');
  const focusedWhileDisabled: boolean[] = [];
  field('pro-credits-5200-v2', 'credits').addEventListener('focus', () => {
    focusedWhileDisabled.push(
      field('pro-credits-5200-v2', 'credits').closest('fieldset')!.disabled
    );
  });
  let complete!: (r: Response) => void;
  respond = () =>
    new Promise((resolve) => {
      complete = resolve;
    });
  await save();
  assert.equal(
    field('pro-credits-5200-v2', 'credits').closest('fieldset')!.disabled,
    true
  );
  await act(async () =>
    complete(
      Response.json(
        {
          code: -1,
          message: 'pricing_invalid',
          fieldErrors: { 'pro-credits-5200-v2.credits': 'invalid_credits' },
        },
        { status: 400 }
      )
    )
  );
  assert.equal(
    document.activeElement?.getAttribute('name'),
    'products.pro-credits-5200-v2.credits'
  );
  assert.deepEqual(focusedWhileDisabled, [false]);
  assert.equal(
    field('pro-credits-5200-v2', 'credits').getAttribute('aria-invalid'),
    'true'
  );
  respond = async () =>
    Response.json({ code: -1, message: 'pricing_forbidden' }, { status: 403 });
  await save();
  assert.match(host.textContent!, /仅超级管理员/);
  assert.equal(saveButton().disabled, true);
  await save();
  assert.equal(calls.length, 2);
});

test('leaving a dirty form uses the shared dialog and keeping edits preserves the draft', async () => {
  await render();
  await change(field('starter-monthly-800', 'credits'), '3456');
  const link = document.createElement('a');
  link.href = '/admin/settings/general';
  link.textContent = 'General';
  host.append(link);
  await act(async () => link.click());
  assert.ok(document.querySelector('[role="dialog"]'));
  assert.equal(nav.length, 0);
  const keep = [...document.querySelectorAll('button')].find(
    (b) => b.textContent === 'Keep editing'
  )!;
  await act(async () => keep.click());
  assert.equal(field('starter-monthly-800', 'credits').value, '3456');
  assert.equal(document.querySelector('[role="dialog"]'), null);
});

test('unmount aborts an in-flight save so a late response cannot commit UI state', async () => {
  await render();
  let complete!: (r: Response) => void;
  respond = () =>
    new Promise((resolve) => {
      complete = resolve;
    });
  await save();
  const signal = calls[0].signal;
  await act(async () => root!.unmount());
  root = undefined;
  assert.equal(signal?.aborted, true);
  await act(async () =>
    complete(
      Response.json({ code: 0, data: { ...catalog, revision: 'late-version' } })
    )
  );
  assert.equal(host.textContent, '');
});

test('discarding edits allows navigation without a second native unload warning', async () => {
  await render();
  await change(field('starter-monthly-800', 'credits'), '3456');
  const before = new dom.window.Event('beforeunload', { cancelable: true });
  window.dispatchEvent(before);
  assert.equal(before.defaultPrevented, true);
  const link = document.createElement('a');
  link.href = '/admin/settings/general';
  host.append(link);
  await act(async () => link.click());
  const leave = [...document.querySelectorAll('button')].find(
    (button) => button.textContent === 'Leave settings'
  )!;
  await act(async () => leave.click());
  assert.deepEqual(nav, ['/admin/settings/general']);
  const after = new dom.window.Event('beforeunload', { cancelable: true });
  window.dispatchEvent(after);
  assert.equal(after.defaultPrevented, false);
});

test('IME commit Enter cannot trigger a pricing form submission', async () => {
  await render('zh');
  const event = new dom.window.KeyboardEvent('keydown', {
    key: 'Enter',
    isComposing: true,
    bubbles: true,
    cancelable: true,
  });
  await act(async () =>
    field('starter-monthly-800', 'credits').dispatchEvent(event)
  );
  assert.equal(event.defaultPrevented, true);
  assert.equal(calls.length, 0);
});
