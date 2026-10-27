import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, afterEach, before, test } from 'node:test';
import React, { act, useEffect } from 'react';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { PathnameContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { JSDOM } from 'jsdom';
import { NextIntlClientProvider } from 'next-intl';
import { createRoot, type Root } from 'react-dom/client';

import en from '@/config/locale/messages/en/pages/pricing.json';
import zh from '@/config/locale/messages/zh/pages/pricing.json';
import {
  parseWanCatalog,
  WAN_PRODUCTS,
  type WanCatalog,
} from '@/shared/lib/wan-product-catalog';

const initialCatalog = { revision: 'default-v1', products: WAN_PRODUCTS };
const customCatalog = {
  revision: 'custom-v2',
  products: WAN_PRODUCTS.map((product) =>
    product.tier === 'starter'
      ? {
          ...product,
          amount: product.mode === 'annual' ? 19255 : 2000,
          credits: 999,
        }
      : product
  ),
};

let dom: JSDOM, root: Root, container: HTMLDivElement;
let WanPricing: typeof import('./wan-pricing').WanPricing;
let AppContextProvider: typeof import('@/shared/contexts/app').AppContextProvider;
let useAppContext: typeof import('@/shared/contexts/app').useAppContext;
let context: ReturnType<typeof useAppContext>;
let requests: Record<string, unknown>[] = [];
let nav: string[] = [];
const originalFetch = globalThis.fetch;
function Probe() {
  const value = useAppContext();
  useEffect(() => {
    context = value;
  }, [value]);
  return null;
}
before(async () => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'https://wanai30.com/pricing',
    pretendToBeVisual: true,
  });
  for (const name of [
    'window',
    'document',
    'navigator',
    'Node',
    'Element',
    'HTMLElement',
    'DocumentFragment',
    'MutationObserver',
    'CustomEvent',
  ])
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value: (dom.window as any)[name],
    });
  Object.assign(globalThis, {
    IS_REACT_ACT_ENVIRONMENT: true,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
  });
  ({ WanPricing } = await import('./wan-pricing'));
  ({ AppContextProvider, useAppContext } = await import(
    '@/shared/contexts/app'
  ));
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  container?.remove();
  globalThis.fetch = originalFetch;
});
after(() => dom.window.close());
async function render(
  locale: 'en' | 'zh' = 'en',
  search = '',
  catalog: WanCatalog = initialCatalog
) {
  requests = [];
  nav = [];
  dom.reconfigure({ url: 'https://wanai30.com/pricing' + search });
  dom.window.localStorage.clear();
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), '/api/payment/checkout');
    requests.push(JSON.parse(String(init?.body)));
    return Response.json(
      { code: -1, message: 'checkout_retry' },
      { status: 503 }
    );
  };
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  const router = {
    push: (url: string) => nav.push(url),
    replace: (url: string) => nav.push(url),
    refresh() {},
    back() {},
    forward() {},
    prefetch: async () => {},
  };
  await act(async () =>
    root.render(
      <AppRouterContext.Provider value={router as any}>
        <PathnameContext.Provider value="/pricing">
          <NextIntlClientProvider
            locale={locale}
            timeZone="UTC"
            messages={{ pages: { pricing: locale === 'en' ? en : zh } }}
          >
            <AppContextProvider>
              <Probe />
              <WanPricing catalog={catalog} />
            </AppContextProvider>
          </NextIntlClientProvider>
        </PathnameContext.Provider>
      </AppRouterContext.Provider>
    )
  );
}
async function select(mode: string) {
  const button = container.querySelector<HTMLButtonElement>(
    `[role=tab][data-mode="${mode}"]`
  );
  assert.ok(button, `purchase tab ${mode} exists`);
  await act(async () =>
    button.dispatchEvent(
      new dom.window.MouseEvent('mousedown', { bubbles: true, button: 0 })
    )
  );
}
async function signIn(id = 'pricing-user') {
  await act(async () =>
    context.setUser({ id, email: 'test@example.invalid', name: 'Test' } as any)
  );
}
function buy() {
  return container.querySelector<HTMLButtonElement>(
    '[data-product-id] button'
  )!;
}

test('approved subscription prices show monthly first, 15% annual savings and permanent packs', async () => {
  const catalog = parseWanCatalog(
    readFileSync(
      'docs/research/wan-pricing-credit-units-2026-09-27.json',
      'utf8'
    )
  );
  await render('en', '', catalog);
  assert.equal(
    container
      .querySelector('[data-mode="monthly"]')
      ?.getAttribute('aria-selected'),
    'true'
  );
  assert.match(
    container.querySelector('[data-mode="annual"]')!.textContent!,
    /Save 15%/
  );
  for (const price of ['$19.90', '$46.80', '$94.80'])
    assert.ok(container.textContent!.includes(price));
  for (const credits of ['1,000', '2,400', '5,000'])
    assert.ok(container.textContent!.includes(credits));
  await select('annual');
  for (const price of [
    '$202.98',
    '$477.36',
    '$966.96',
    '$16.92',
    '$39.78',
    '$80.58',
  ])
    assert.ok(container.textContent!.includes(price), price);
  assert.match(container.textContent!, /Monthly credits expire/);
  for (const annual of catalog.products.filter((p) => p.mode === 'annual')) {
    const monthly = catalog.products.find(
      (p) => p.tier === annual.tier && p.mode === 'monthly'
    )!;
    assert.equal(annual.amount * 100, monthly.amount * 12 * 85);
    assert.equal(annual.credits, monthly.credits);
  }
  await select('credits');
  for (const price of ['$24.90', '$59.90', '$119.90'])
    assert.ok(container.textContent!.includes(price));
  assert.match(container.textContent!, /Credits never expire/);
});

test('annual tab does not advertise savings for different credit allowances', async () => {
  const catalog = parseWanCatalog(
    readFileSync(
      'docs/research/wan-pricing-credit-units-2026-09-27.json',
      'utf8'
    )
  );
  await render('en', '', {
    ...catalog,
    products: catalog.products.map((p) =>
      p.mode === 'annual' ? { ...p, credits: 1 } : p
    ),
  });
  assert.doesNotMatch(
    container.querySelector('[data-mode="annual"]')!.textContent!,
    /Save/
  );
});
for (const locale of ['en', 'zh'] as const)
  test(`pricing ${locale} exposes exact catalog terms without changing the three-card layout`, async () => {
    await render(locale);
    assert.equal(container.querySelectorAll('[role=tab]').length, 3);
    assert.equal(container.querySelectorAll('[data-product-id]').length, 3);
    for (const price of ['$15.90', '$45.90', '$95.90'])
      assert.ok(container.textContent!.includes(price));
    await select('annual');
    const creator = container.querySelector(
      '[data-product-id="creator-annual-2400-v1"]'
    );
    assert.ok(creator);
    for (const price of ['$495.00', '$41.25'])
      assert.ok(creator.textContent!.includes(price), price);
    assert.equal(container.querySelectorAll('s').length, 3);
    assert.match(container.textContent!, /10%/);
    assert.doesNotMatch(container.textContent!, /20%/);
    await select('credits');
    assert.equal(container.querySelectorAll('[data-product-id]').length, 3);
    for (const price of ['$19.90', '$54.90', '$109.90'])
      assert.ok(container.textContent!.includes(price));
    assert.match(
      container.textContent!,
      locale === 'zh' ? /永久/ : /never expire/
    );
    assert.doesNotMatch(
      container.textContent!,
      /赠送|free credits|trial credits/i
    );
  });
test('purchase selection restores URL, unrelated query, hash and sign-in return mode', async () => {
  await render('zh', '?purchase=annual&ref=test#pricing');
  assert.equal(
    container
      .querySelector('[role=tab][aria-selected=true]')
      ?.getAttribute('data-mode'),
    'annual'
  );
  await select('credits');
  assert.equal(new URL(window.location.href).searchParams.get('ref'), 'test');
  assert.equal(window.location.hash, '#pricing');
  await act(async () => buy().click());
  assert.match(nav[0], /sign-in\?callbackUrl=/);
  assert.match(decodeURIComponent(nav[0]), /purchase=credits#pricing/);
  assert.equal(requests.length, 0);
  window.history.replaceState({}, '', '/pricing?purchase=annual#pricing');
  await act(async () =>
    window.dispatchEvent(new dom.window.PopStateEvent('popstate'))
  );
  assert.equal(
    container
      .querySelector('[role=tab][aria-selected=true]')
      ?.getAttribute('data-mode'),
    'annual'
  );
});
test('configured catalog controls visible USD amounts, credits, and the submitted revision', async () => {
  await render('en', '', customCatalog);
  const starter = container.querySelector('[data-plan="starter"]')!;
  assert.match(starter.textContent!, /\$20\.00/);
  assert.match(starter.textContent!, /999 credits/);
  await signIn();
  await act(async () => buy().click());
  assert.equal(requests[0].catalogRevision, 'custom-v2');
  assert.equal(requests[0].amount, undefined);
  assert.equal(requests[0].credits, undefined);
  await select('annual');
  const annual = container.querySelector('[data-plan="starter"]')!;
  assert.match(annual.textContent!, /Billed \$192\.55 yearly/);
  assert.match(annual.textContent!, /\$16\.05/);
  assert.match(annual.textContent!, /20%/);
});
test('annual cards only compare discounts for equal credits and a lower annual price', async () => {
  await render('en', '?purchase=annual', {
    ...customCatalog,
    products: customCatalog.products.map((product) =>
      product.mode === 'annual'
        ? { ...product, credits: product.credits + 1 }
        : product
    ),
  });
  assert.equal(container.querySelectorAll('s').length, 0);
  assert.doesNotMatch(container.textContent!, /Save about/);
});
test('an annual premium does not advertise savings over monthly billing', async () => {
  await render('en', '?purchase=annual', {
    ...customCatalog,
    products: customCatalog.products.map((product) =>
      product.mode === 'annual' ? { ...product, amount: 999999 } : product
    ),
  });
  assert.equal(container.querySelectorAll('s').length, 0);
  assert.doesNotMatch(container.textContent!, /Save about/);
});
test('stale pricing refresh updates the quote but never automatically purchases', async () => {
  await render();
  await signIn();
  let reads = 0;
  globalThis.fetch = async (input, init) => {
    if (String(input) === '/api/payment/catalog') {
      reads++;
      assert.equal(init?.cache, 'no-store');
      return Response.json({ code: 0, data: customCatalog });
    }
    requests.push(JSON.parse(String(init?.body)));
    return Response.json(
      { code: -1, message: 'pricing_changed' },
      { status: 409 }
    );
  };
  await act(async () => buy().click());
  assert.equal(buy().disabled, true);
  const refresh = container.querySelector<HTMLButtonElement>(
    '[data-refresh-pricing]'
  );
  assert.ok(refresh);
  await act(async () => refresh.click());
  assert.equal(reads, 1);
  assert.equal(requests.length, 1);
  assert.equal(buy().disabled, false);
  assert.match(
    container.querySelector('[role=status]')!.textContent!,
    /updated/i
  );
  assert.match(
    container.querySelector('[data-plan="starter"]')!.textContent!,
    /\$20\.00/
  );
  await act(async () => buy().click());
  assert.equal(requests[1].catalogRevision, 'custom-v2');
});
test('failed quote refresh retains the stale quote warning and prevents another purchase', async () => {
  await render();
  await signIn();
  globalThis.fetch = async (input) =>
    String(input) === '/api/payment/catalog'
      ? Response.json({ code: -1 }, { status: 503 })
      : Response.json(
          { code: -1, message: 'pricing_changed' },
          { status: 409 }
        );
  await act(async () => buy().click());
  const refresh = container.querySelector<HTMLButtonElement>(
    '[data-refresh-pricing]'
  );
  assert.ok(refresh);
  await act(async () => refresh.click());
  assert.equal(buy().disabled, true);
  assert.ok(container.querySelector('[data-refresh-pricing]'));
  assert.match(
    container.querySelector('[role=alert]')!.textContent!,
    /refresh/i
  );
});
test('a malformed refreshed catalog is never accepted as a purchasable quote', async () => {
  await render('zh');
  await signIn();
  globalThis.fetch = async (input) =>
    String(input) === '/api/payment/catalog'
      ? Response.json({
          code: 0,
          data: {
            ...customCatalog,
            products: Array(9).fill(customCatalog.products[0]),
          },
        })
      : Response.json(
          { code: -1, message: 'pricing_changed' },
          { status: 409 }
        );
  await act(async () => buy().click());
  await act(async () =>
    container
      .querySelector<HTMLButtonElement>('[data-refresh-pricing]')!
      .click()
  );
  assert.equal(buy().disabled, true);
  assert.match(
    container.querySelector('[role=alert]')!.textContent!,
    /暂时无法刷新价格/
  );
  assert.match(
    container.querySelector('[data-plan="starter"]')!.textContent!,
    /\$15\.90/
  );
});
test('quote refresh preserves the pack request identity for original-order recovery', async () => {
  await render('en', '?purchase=credits');
  await signIn();
  globalThis.fetch = async (input, init) => {
    if (String(input) === '/api/payment/catalog')
      return Response.json({ code: 0, data: customCatalog });
    requests.push(JSON.parse(String(init?.body)));
    return Response.json(
      { code: -1, message: 'pricing_changed' },
      { status: 409 }
    );
  };
  await act(async () => buy().click());
  await act(async () =>
    container
      .querySelector<HTMLButtonElement>('[data-refresh-pricing]')!
      .click()
  );
  await act(async () => buy().click());
  assert.equal(requests.length, 2);
  assert.equal(requests[0].requestId, requests[1].requestId);
  assert.equal(requests[0].catalogRevision, 'default-v1');
  assert.equal(requests[1].catalogRevision, 'custom-v2');
});
test('late quote refresh after an account change cannot update the new account UI', async () => {
  await render();
  await signIn('old-user');
  let deliver: (value: unknown) => void = () => {};
  globalThis.fetch = async (input) =>
    String(input) === '/api/payment/catalog'
      ? ({
          ok: true,
          status: 200,
          json: () =>
            new Promise((resolve) => {
              deliver = resolve;
            }),
        } as Response)
      : Response.json(
          { code: -1, message: 'pricing_changed' },
          { status: 409 }
        );
  await act(async () => buy().click());
  await act(async () =>
    container
      .querySelector<HTMLButtonElement>('[data-refresh-pricing]')!
      .click()
  );
  assert.equal(
    container
      .querySelector('[data-refresh-pricing]')!
      .getAttribute('aria-busy'),
    'true'
  );
  await signIn('new-user');
  await act(async () => deliver({ code: 0, data: customCatalog }));
  assert.equal(buy().disabled, true);
  assert.equal(
    container
      .querySelector('[data-refresh-pricing]')!
      .getAttribute('aria-busy'),
    'false'
  );
  assert.match(
    container.querySelector('[data-plan="starter"]')!.textContent!,
    /\$15\.90/
  );
});
test('pack retries keep an identity and block duplicate submits when local storage is unavailable', async () => {
  await render();
  await signIn();
  await select('credits');
  const storage = Object.getOwnPropertyDescriptor(dom.window, 'localStorage')!;
  Object.defineProperty(dom.window, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('disabled');
    },
  });
  try {
    await act(async () => {
      const button = buy();
      button.click();
      button.click();
    });
    assert.equal(requests.length, 1);
    await act(async () => buy().click());
    assert.equal(requests.length, 2);
    assert.equal(requests[0].requestId, requests[1].requestId);
    assert.match(String(requests[0].requestId), /^[0-9a-f-]{36}$/i);
    assert.equal(requests[0].productId, 'starter-credits-800-v2');
    assert.ok(container.querySelector('[role=alert]'));
  } finally {
    Object.defineProperty(dom.window, 'localStorage', storage);
  }
});
test('expired pack checkout rotates its request only after authoritative expiry and exposes recovery links', async () => {
  await render();
  await signIn();
  await select('credits');
  let count = 0;
  globalThis.fetch = async (_input, init) => {
    requests.push(JSON.parse(String(init?.body)));
    return Response.json(
      ++count === 1
        ? { code: -1, message: 'checkout_expired_retry' }
        : {
            code: -1,
            message: 'checkout_in_progress',
            data: { checkoutUrl: 'https://checkout.stripe.com/c/pay/safe' },
          },
      { status: 409 }
    );
  };
  await act(async () => buy().click());
  await act(async () => buy().click());
  assert.notEqual(requests[0].requestId, requests[1].requestId);
  assert.equal(
    container.querySelector('a[data-resume-checkout]')?.getAttribute('href'),
    'https://checkout.stripe.com/c/pay/safe'
  );
});
test('stale response after changing account cannot navigate or clear newer pending state', async () => {
  await render();
  await signIn('old-user');
  const deliver: ((value: any) => void)[] = [];
  globalThis.fetch = async () =>
    ({
      ok: true,
      status: 200,
      json: () => new Promise((resolve) => deliver.push(resolve)),
    }) as Response;
  await act(async () => buy().click());
  await signIn('new-user');
  assert.equal(buy().disabled, false);
  await act(async () => buy().click());
  await act(async () =>
    deliver[0]({ code: -1, message: 'subscription_already_exists' })
  );
  assert.equal(buy().disabled, true);
  assert.deepEqual(nav, []);
  await act(async () => deliver[1]({ code: -1, message: 'checkout_retry' }));
  assert.equal(buy().disabled, false);
});
test('existing subscription redirects to billing while packs remain purchasable', async () => {
  await render();
  await signIn();
  globalThis.fetch = async (_input, init) => {
    requests.push(JSON.parse(String(init?.body)));
    return Response.json(
      { code: -1, message: 'subscription_already_exists' },
      { status: 409 }
    );
  };
  await act(async () => buy().click());
  assert.equal(nav[0], '/settings/billing');
  await select('credits');
  await act(async () => buy().click());
  assert.equal(requests[1].productId, 'starter-credits-800-v2');
});
test('unconfigured Stripe shows unavailable checkout without asking for unsafe payment retries', async () => {
  await render();
  await signIn();
  globalThis.fetch = async () =>
    Response.json(
      { code: -1, message: 'stripe_not_configured' },
      { status: 503 }
    );
  await act(async () => buy().click());
  assert.equal(
    container.querySelector('[role=alert]')?.textContent,
    en.messages.payment_unavailable
  );
});
