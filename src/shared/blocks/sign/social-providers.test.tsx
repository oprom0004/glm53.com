import assert from 'node:assert/strict';
import { after, afterEach, before, test } from 'node:test';
import React, { act, useState } from 'react';
import { JSDOM } from 'jsdom';
import { NextIntlClientProvider } from 'next-intl';
import type { Root } from 'react-dom/client';

import messages from '@/config/locale/messages/en/common.json';

let dom: JSDOM;
let root: Root | undefined;
let host: HTMLDivElement;
let createRoot: typeof import('react-dom/client').createRoot;
let SocialProviders: typeof import('./social-providers').SocialProviders;
let AppContextProvider: typeof import('@/shared/contexts/app').AppContextProvider;
let authClient: typeof import('@/core/auth/client').authClient;
const originalFetch = globalThis.fetch;
let popupUrls: string[] = [];

before(async () => {
  dom = new JSDOM('<html><body></body></html>', {
    url: 'http://localhost:3000/wan-3',
  });
  for (const key of [
    'window',
    'document',
    'navigator',
    'HTMLElement',
    'Node',
  ]) {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value: dom.window[key as keyof Window],
    });
  }
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  ({ createRoot } = await import('react-dom/client'));
  ({ SocialProviders } = await import('./social-providers'));
  ({ AppContextProvider } = await import('@/shared/contexts/app'));
  ({ authClient } = await import('@/core/auth/client'));
  dom.window.open = ((url: string) => {
    popupUrls.push(url);
    return { closed: false };
  }) as typeof window.open;
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  host?.remove();
  popupUrls = [];
  globalThis.fetch = originalFetch;
});
after(() => dom.window.close());

async function mount(ready: boolean, onAuthenticated = () => {}) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  function Harness() {
    const [loading, setLoading] = useState(false);
    return (
      <SocialProviders
        configs={{ auth_google_ready: String(ready) }}
        callbackUrl="/wan-3"
        loading={loading}
        setLoading={setLoading}
        onAuthenticated={onAuthenticated}
      />
    );
  }
  await act(async () => {
    root!.render(
      <NextIntlClientProvider locale="en" messages={{ common: messages }}>
        <AppContextProvider>
          <Harness />
        </AppContextProvider>
      </NextIntlClientProvider>
    );
  });
}

async function notifyCompletion() {
  await act(async () => {
    window.dispatchEvent(
      new dom.window.StorageEvent('storage', {
        key: 'auth-callback-success',
        newValue: String(Date.now()),
      })
    );
  });
}

test('Google remains visible without credentials and does not start unavailable OAuth', async () => {
  await mount(false);
  const button = host.querySelector('button')!;
  assert.match(button.textContent || '', /Continue with Google/);
  await act(async () => button.click());
  assert.match(
    host.querySelector('[role=alert]')?.textContent || '',
    /unavailable/
  );
  assert.deepEqual(popupUrls, []);
});

test('OAuth notification without a server session cannot complete sign-in', async () => {
  let completed = 0;
  globalThis.fetch = async () => Response.json(null);
  await mount(true, () => completed++);
  await act(async () => host.querySelector('button')!.click());
  assert.deepEqual(popupUrls, [
    'http://localhost:3000/auth-popup?provider=google',
  ]);
  await notifyCompletion();
  assert.equal(completed, 0);
  assert.match(
    host.querySelector('[role=alert]')?.textContent || '',
    /didn't complete/
  );
  assert.equal(host.querySelector('button')!.disabled, false);
});

test('valid OAuth completion refreshes the shared session and completes the modal once', async () => {
  let completed = 0;
  let refreshed = 0;
  globalThis.fetch = async () => Response.json({ user: { id: 'oauth-test' } });
  const unsubscribe = authClient.$store.atoms.$sessionSignal.subscribe(
    () => refreshed++
  );
  try {
    await mount(true, () => completed++);
    await act(async () => host.querySelector('button')!.click());
    const beforeCompletion = refreshed;
    await notifyCompletion();
    assert.equal(completed, 1);
    assert.equal(refreshed, beforeCompletion + 1);
    await notifyCompletion();
    assert.equal(completed, 1);
    assert.equal(host.querySelector('button')!.disabled, false);
  } finally {
    unsubscribe();
  }
});
