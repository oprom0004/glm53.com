import assert from 'node:assert/strict';
import { after, afterEach, before, test } from 'node:test';
import React, { act } from 'react';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import {
  PathnameContext,
  SearchParamsContext,
} from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { JSDOM } from 'jsdom';
import { NextIntlClientProvider } from 'next-intl';
import { createRoot, type Root } from 'react-dom/client';

import en from '@/config/locale/messages/en/common.json';
import zh from '@/config/locale/messages/zh/common.json';

let dom: JSDOM;
let root: Root | undefined;
let LocaleSelector: typeof import('./locale-selector').LocaleSelector;
let navigations: string[];

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

before(async () => {
  dom = new JSDOM('<div id="root"></div>', {
    url: 'http://localhost/pricing?purchase=annual#pricing',
    pretendToBeVisual: true,
  });
  for (const name of [
    'window',
    'document',
    'navigator',
    'HTMLElement',
    'HTMLInputElement',
    'Element',
    'Node',
    'DocumentFragment',
    'CustomEvent',
    'MutationObserver',
    'localStorage',
  ]) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value: (dom.window as any)[name],
    });
  }
  Object.assign(globalThis, {
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
  });
  ({ LocaleSelector } = await import('./locale-selector'));
});

afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: dom.window.localStorage,
  });
});
after(() => dom.window.close());

async function mount(locale: 'en' | 'zh' = 'en') {
  navigations = [];
  const router = {
    push: (href: string) => navigations.push(href),
    replace() {},
    refresh() {},
    back() {},
    forward() {},
    prefetch() {},
    hmrRefresh() {},
  };
  root = createRoot(document.getElementById('root')!);
  await act(async () =>
    root!.render(
      <NextIntlClientProvider
        locale={locale}
        timeZone="UTC"
        messages={{ common: locale === 'zh' ? zh : en }}
      >
        <AppRouterContext.Provider value={router as any}>
          <PathnameContext.Provider
            value={locale === 'zh' ? '/zh/pricing' : '/pricing'}
          >
            <SearchParamsContext.Provider
              value={new URLSearchParams('purchase=annual')}
            >
              <LocaleSelector type="button" />
            </SearchParamsContext.Provider>
          </PathnameContext.Provider>
        </AppRouterContext.Provider>
      </NextIntlClientProvider>
    )
  );
}

async function selectChinese() {
  const trigger = document.querySelector('button')!;
  await act(async () =>
    trigger.dispatchEvent(
      new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
    )
  );
  const choice = Array.from(
    document.querySelectorAll('[role^="menuitem"]')
  ).find((item) => item.textContent === '中文');
  assert.ok(choice, 'the real language menu exposes Chinese');
  await act(async () => (choice as HTMLElement).click());
}

test('language switch keeps the annual purchase selection and pricing anchor', async () => {
  await mount();
  await selectChinese();
  assert.deepEqual(navigations, ['/zh/pricing?purchase=annual#pricing']);
});

test('restricted browser storage cannot block a language change', async () => {
  await mount();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('storage disabled');
    },
  });
  await selectChinese();
  assert.deepEqual(navigations, ['/zh/pricing?purchase=annual#pricing']);
});

test('language control announces its purpose in the active locale', async () => {
  await mount('zh');
  assert.equal(
    document.querySelector('button')?.getAttribute('aria-label'),
    '切换语言'
  );
});
