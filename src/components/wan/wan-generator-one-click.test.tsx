import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, afterEach, before, test } from 'node:test';
import React, { act, useEffect } from 'react';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { PathnameContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { JSDOM } from 'jsdom';
import { NextIntlClientProvider } from 'next-intl';
import type { Root } from 'react-dom/client';

import type { WanUiVersion } from './generator-copy';

let dom: JSDOM, root: Root | undefined, host: HTMLDivElement;
let createRoot: typeof import('react-dom/client').createRoot;
let WanGenerator: typeof import('./wan-generator').WanGenerator;
let useWanGeneration: typeof import('./use-wan-generation').useWanGeneration;
let AppContextProvider: typeof import('@/shared/contexts/app').AppContextProvider;
let useAppContext: typeof import('@/shared/contexts/app').useAppContext;
let context: ReturnType<typeof useAppContext>;
let calls: { path: string; body: any }[] = [];
let nav: string[] = [];
let respond: (path: string, body: any) => Promise<Response>;
const originalFetch = globalThis.fetch;
let creditRefreshes = 0;
const success = (id: string) =>
  Response.json({
    code: 0,
    data: {
      id,
      status: 'success',
      phase: 'success',
      costCredits: 11,
      videoUrl: 'https://media.wanai30.com/output.mp4',
    },
  });
function Probe() {
  const value = useAppContext();
  useEffect(() => {
    context = value;
  }, [value]);
  return null;
}
function HookOnly() {
  const { user } = useAppContext();
  const generation = useWanGeneration({
    version: '3.0',
    mode: 'text',
    userId: user?.id,
    onRequireSignIn() {},
    onCreditsChanged: async () => {
      creditRefreshes++;
      throw new Error('balance offline');
    },
  });
  return (
    <>
      <output data-phase={generation.phase} data-error={generation.errorCode} />
      <button
        disabled={generation.isLocked}
        onClick={() =>
          generation.generate({
            version: '3.0',
            tier: 'standard',
            mode: 'text',
            duration: 5,
            resolution: '720P',
            ratio: '16:9',
            prompt: 'Ocean wave',
            media: [],
          })
        }
      >
        Generate video
      </button>
    </>
  );
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
before(async () => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'https://wanai30.com/wan-3',
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
    'HTMLTextAreaElement',
    'HTMLInputElement',
    'DocumentFragment',
    'MutationObserver',
    'CustomEvent',
    'localStorage',
  ])
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value: (dom.window as any)[name],
    });
  Object.assign(globalThis, {
    self: dom.window,
    IS_REACT_ACT_ENVIRONMENT: true,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
  });
  ({ createRoot } = await import('react-dom/client'));
  ({ WanGenerator } = await import('./wan-generator'));
  ({ useWanGeneration } = await import('./use-wan-generation'));
  ({ AppContextProvider, useAppContext } = await import(
    '@/shared/contexts/app'
  ));
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  host?.remove();
  globalThis.fetch = originalFetch;
});
after(() => dom.window.close());
async function render(
  version: WanUiVersion = '3.0',
  locale: 'en' | 'zh' = 'en',
  owner?: string,
  hookOnly = false
) {
  calls = [];
  nav = [];
  dom.window.localStorage.clear();
  respond = async (path, body) => {
    if (path.endsWith('/quote'))
      return Response.json({
        code: 0,
        data: {
          credits: 11,
          normalizedInput: body,
          quoteVersion: 'wan-pricing-v1',
        },
      });
    if (path.endsWith('/upload'))
      return Response.json({
        code: 0,
        data: { url: 'https://media.wanai30.com/input.png' },
      });
    if (path.endsWith('/generate'))
      return success(
        'wan-' +
          createHash('sha256')
            .update(`${owner}\0${body.requestId}`)
            .digest('hex')
      );
    if (path.endsWith('/query')) return success(body.taskId);
    throw new Error(`Unexpected ${path}`);
  };
  globalThis.fetch = async (input, init) => {
    const path = String(input);
    if (path.includes('capabilities')) {
      const tier = {
        enabled: true,
        resolutions: {
          '480P': { enabled: true },
          '720P': { enabled: true },
          '1080P': { enabled: true },
        },
      };
      return Response.json({
        code: 0,
        data: { tiers: { standard: tier, prime: tier }, referenceVideo: true },
      });
    }
    if (path.includes('/get-user-credits'))
      return Response.json({
        code: 0,
        data: { remainingCredits: 0, expiresAt: null },
      });
    const body =
      typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body;
    calls.push({ path, body });
    return respond(path, body);
  };
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  const router = {
    push: (url: string) => nav.push(url),
    replace: (url: string) => nav.push(url),
    refresh() {},
    back() {},
    forward() {},
    prefetch: async () => {},
  };
  await act(async () =>
    root!.render(
      <AppRouterContext.Provider value={router as any}>
        <PathnameContext.Provider value="/wan-3">
          <NextIntlClientProvider locale={locale} messages={{}} timeZone="UTC">
            <AppContextProvider>
              <Probe />
              {hookOnly ? <HookOnly /> : <WanGenerator version={version} />}
            </AppContextProvider>
          </NextIntlClientProvider>
        </PathnameContext.Provider>
      </AppRouterContext.Provider>
    )
  );
  await act(async () => {
    context.setIsCheckSign(false);
    if (owner)
      context.setUser({
        id: owner,
        credits: { remainingCredits: 0, expiresAt: null },
      } as any);
  });
  if (owner && !hookOnly) {
    await until(() =>
      /This generation:|本次生成/.test(
        host.querySelector('[data-testid="generation-price"]')?.textContent ||
          ''
      )
    );
    calls = [];
  }
}
function action() {
  const button = [...host.querySelectorAll('button')].find((button) =>
    /Generate video|生成视频/.test(button.textContent || '')
  );
  assert.ok(button, 'generation action exists');
  return button;
}
async function prompt() {
  await act(async () => {
    const input = host.querySelector('textarea')!;
    Object.getOwnPropertyDescriptor(
      dom.window.HTMLTextAreaElement.prototype,
      'value'
    )!.set!.call(input, 'Ocean wave');
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
}
async function until(predicate: () => boolean) {
  for (let i = 0; i < 120 && !predicate(); i++)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  assert.ok(predicate(), 'expected generation state arrived');
}

async function chooseMode(label: string) {
  await act(async () =>
    [...host.querySelectorAll('button')]
      .find((b) => b.textContent === label)!
      .click()
  );
}
async function selectImages(count = 1, index = 0) {
  const input =
    host.querySelectorAll<HTMLInputElement>('input[type=file]')[index];
  await act(async () => {
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: Array.from(
        { length: count },
        (_, i) => new File(['image'], `source-${i}.png`, { type: 'image/png' })
      ),
    });
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
  if (count <= 10) await until(() => !action().disabled);
}

test('switching image/reference modes removes incompatible uploads before submission', async () => {
  await render('3.0', 'en', 'owner');
  await chooseMode('Image to Video');
  await selectImages();
  await selectImages(1, 1);
  await chooseMode('Reference to Video');
  await act(async () => action().click());
  assert.equal(calls.filter((c) => !c.path.endsWith('/quote')).length, 0);
  assert.match(host.textContent!, /Add the required source image/);
  await selectImages(2);
  await chooseMode('Image to Video');
  await selectImages();
  await act(async () => action().click());
  await until(() => calls.some((c) => c.path.endsWith('/generate')));
  const body = calls.find((c) => c.path.endsWith('/generate'))!.body;
  assert.equal(body.mode, 'image');
  assert.deepEqual(
    body.media.map((m: any) => m.type),
    ['first_frame']
  );
});

test('reference mode rejects more than ten images instead of silently dropping files', async () => {
  await render('3.0', 'en', 'owner');
  await chooseMode('Reference to Video');
  await selectImages(11);
  assert.match(host.textContent!, /Choose up to 10 reference images/);
  await act(async () => action().click());
  assert.equal(calls.filter((c) => !c.path.endsWith('/quote')).length, 0);
  await selectImages(10);
  await act(async () => action().click());
  await until(() => calls.some((c) => c.path.endsWith('/generate')));
  assert.equal(
    calls.find((c) => c.path.endsWith('/generate'))!.body.media.length,
    10
  );
});

test('video-only references upload before quoting and retain the receipt in generation', async () => {
  await render('3.0', 'en', 'owner');
  await chooseMode('Reference to Video');
  const original = respond;
  respond = (path, body) =>
    path.endsWith('/upload-video')
      ? Promise.resolve(
          Response.json({
            code: 0,
            data: {
              url: 'https://media.wanai30.com/ref.mp4',
              token: 'verified-duration-receipt',
              durationMs: 2000,
            },
          })
        )
      : original(path, body);
  const input = host.querySelector<HTMLInputElement>(
    'input[accept*="video/mp4"]'
  )!;
  await act(async () => {
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [new File(['video'], 'clip.mp4', { type: 'video/mp4' })],
    });
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
  assert.match(host.textContent!, /clip.mp4/);
  await until(() => !action().disabled);
  assert.match(
    host.querySelector('[data-testid="generation-price"]')!.textContent!,
    /11 credits/
  );
  assert.equal(
    calls.some((c) => c.path.endsWith('/generate')),
    false
  );
  await act(async () => action().click());
  await until(() => calls.some((c) => c.path.endsWith('/generate')));
  assert.deepEqual(
    calls.filter((c) => c.path.startsWith('/api/ai/wan')).map((c) => c.path),
    [
      '/api/ai/wan/upload-video',
      '/api/ai/wan/quote',
      '/api/ai/wan/quote',
      '/api/ai/wan/generate',
    ]
  );
  const q = calls.find((c) => c.path.endsWith('/quote'))!.body;
  const generated = calls.find((c) => c.path.endsWith('/generate'))!.body;
  assert.equal(q.referenceVideos[0].token, 'verified-duration-receipt');
  assert.deepEqual(generated.referenceVideos, q.referenceVideos);
  assert.deepEqual(generated.media, [
    { type: 'reference_video', url: q.referenceVideos[0].url },
  ]);
});
for (const version of ['2.5', '2.6', '2.7', '3.0'] as const)
  test(`Wan ${version} click quotes and submits once without a confirmation even when displayed credits are zero`, async () => {
    await render(version, 'en', 'owner');
    await prompt();
    const quote = deferred<Response>();
    const original = respond;
    respond = (path, body) =>
      path.endsWith('/quote') ? quote.promise : original(path, body);
    await act(async () => {
      const button = action();
      button.click();
      button.click();
    });
    assert.equal(
      calls.filter((call) => call.path.endsWith('/quote')).length,
      1
    );
    const quoteInput = calls[0].body;
    await act(async () =>
      quote.resolve(
        Response.json({
          code: 0,
          data: {
            credits: 11,
            normalizedInput: quoteInput,
            quoteVersion: 'wan-pricing-v1',
          },
        })
      )
    );
    await until(() => calls.some((call) => call.path.endsWith('/generate')));
    assert.equal(
      calls.filter((call) => call.path.endsWith('/generate')).length,
      1
    );
    const body = calls.find((call) => call.path.endsWith('/generate'))!.body;
    assert.equal(body.version, version);
    assert.equal(body.expectedCredits, 11);
    assert.equal(body.quoteVersion, 'wan-pricing-v1');
    assert.equal(body.prompt, 'Ocean wave');
    assert.match(body.requestId, /^[0-9a-f-]{36}$/i);
    assert.equal(host.querySelector('[role=dialog]'), null);
    assert.equal(host.querySelector('[aria-haspopup=dialog]'), null);
    await until(
      () =>
        !!host.querySelector(
          'video[src="https://media.wanai30.com/output.mp4"]'
        )
    );
  });
test('anonymous generation opens sign-in before validating or making any quote/upload/submit request', async () => {
  await render();
  await act(async () => action().click());
  assert.equal(context.isShowSignModal, true);
  assert.deepEqual(calls, []);
});
for (const locale of ['en', 'zh'] as const)
  test(`server insufficient credits opens the ${locale} pricing route`, async () => {
    await render('3.0', locale, 'owner');
    await prompt();
    const original = respond;
    respond = (path, body) =>
      path.endsWith('/generate')
        ? Promise.resolve(
            Response.json(
              { code: -1, message: 'insufficient_credits' },
              { status: 402 }
            )
          )
        : original(path, body);
    await act(async () => action().click());
    await until(() => nav.length > 0);
    assert.deepEqual(nav, [locale === 'zh' ? '/zh/pricing' : '/pricing']);
  });
for (const result of ['quote', 'insufficient'] as const)
  test(`old ${result} response after account switch cannot submit or redirect the new owner`, async () => {
    await render('3.0', 'en', 'old-owner');
    await prompt();
    const pending = deferred<Response>();
    const original = respond;
    respond = () => pending.promise;
    await act(async () => action().click());
    await act(async () => context.setUser({ id: 'new-owner' } as any));
    await act(async () =>
      pending.resolve(
        result === 'quote'
          ? Response.json({
              code: 0,
              data: {
                credits: 11,
                normalizedInput: calls[0].body,
                quoteVersion: 'wan-pricing-v1',
              },
            })
          : Response.json(
              { code: -1, message: 'insufficient_credits' },
              { status: 402 }
            )
      )
    );
    assert.equal(
      calls.some((call) => call.path.endsWith('/generate')),
      false
    );
    assert.deepEqual(nav, []);
    assert.equal(
      action().disabled,
      true,
      'new owner must receive their own quote'
    );
    respond = original;
    await until(() => !action().disabled);
    assert.equal(
      calls.some((call) => call.path.endsWith('/generate')),
      false
    );
  });
test('account change while an image upload is pending prevents remaining uploads and submission', async () => {
  await render('3.0', 'en', 'old-owner');
  await act(async () =>
    [...host.querySelectorAll('button')]
      .find((button) => button.textContent === 'Image to Video')!
      .click()
  );
  const inputs = host.querySelectorAll<HTMLInputElement>('input[type=file]');
  await act(async () => {
    for (const input of inputs) {
      Object.defineProperty(input, 'files', {
        configurable: true,
        value: [new File(['image'], 'frame.png', { type: 'image/png' })],
      });
      input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    }
  });
  await until(() => !action().disabled);
  const pending = deferred<Response>();
  const original = respond;
  respond = (path, body) =>
    path.endsWith('/upload') ? pending.promise : original(path, body);
  await act(async () => action().click());
  await until(() => calls.some((call) => call.path.endsWith('/upload')));
  await act(async () => context.setUser({ id: 'new-owner' } as any));
  await act(async () =>
    pending.resolve(
      Response.json({
        code: 0,
        data: { url: 'https://media.wanai30.com/input.png' },
      })
    )
  );
  assert.equal(calls.filter((call) => call.path.endsWith('/upload')).length, 1);
  assert.equal(
    calls.some((call) => call.path.endsWith('/generate')),
    false
  );
});
test('unknown submission is owner scoped and can only query the original task instead of generating twice', async () => {
  await render('3.0', 'en', 'owner');
  await prompt();
  const original = respond;
  respond = (path, body) =>
    path.endsWith('/generate')
      ? Promise.reject(new Error('lost response'))
      : original(path, body);
  await act(async () => action().click());
  await until(() => calls.some((call) => call.path.endsWith('/generate')));
  await until(() =>
    [...host.querySelectorAll('button')].some(
      (button) => button.textContent === 'Continue checking'
    )
  );
  const created = calls.find((call) => call.path.endsWith('/generate'))!.body;
  const expectedId =
    'wan-' +
    createHash('sha256').update(`owner\0${created.requestId}`).digest('hex');
  assert.equal(
    dom.window.localStorage.getItem('wan-task:owner:3.0'),
    expectedId
  );
  assert.equal(action().disabled, true);
  await act(async () =>
    [...host.querySelectorAll('button')]
      .find((button) => button.textContent === 'Continue checking')!
      .click()
  );
  assert.equal(
    calls.filter((call) => call.path.endsWith('/generate')).length,
    1
  );
  assert.deepEqual(calls.find((call) => call.path.endsWith('/query'))!.body, {
    taskId: expectedId,
  });
  assert.equal(dom.window.localStorage.getItem('wan-task:owner:3.0'), null);
});
test('blocked local storage cannot turn a successful task into failure', async () => {
  await render('3.0', 'en', 'owner');
  await prompt();
  const descriptor = Object.getOwnPropertyDescriptor(
    dom.window,
    'localStorage'
  )!;
  Object.defineProperty(dom.window, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('blocked');
    },
  });
  try {
    await act(async () => action().click());
    await until(() => !!host.querySelector('video[src]'));
    assert.equal(host.querySelector('[role=alert]'), null);
    assert.equal(action().disabled, false);
  } finally {
    Object.defineProperty(dom.window, 'localStorage', descriptor);
  }
});
test('a rejected balance refresh cannot discard a successful task or mark it failed', async () => {
  creditRefreshes = 0;
  await render('3.0', 'en', 'owner', true);
  await act(async () => action().click());
  await until(
    () =>
      host.querySelector('output')?.getAttribute('data-phase') === 'succeeded'
  );
  assert.equal(creditRefreshes, 1);
  assert.equal(host.querySelector('output')?.getAttribute('data-error'), '');
});
test('HTTP 5xx retains the original identity across account switch and never restores another owner task', async () => {
  await render('3.0', 'en', 'owner-5xx');
  await prompt();
  const original = respond;
  respond = (path, body) =>
    path.endsWith('/generate')
      ? Promise.resolve(
          Response.json(
            { code: -1, message: 'request_failed' },
            { status: 500 }
          )
        )
      : original(path, body);
  await act(async () => action().click());
  await until(() => !!host.querySelector('a[href="/my-videos"]'));
  const saved = dom.window.localStorage.getItem('wan-task:owner-5xx:3.0');
  assert.match(saved!, /^wan-[a-f0-9]{64}$/);
  await act(async () => context.setUser({ id: 'different-owner' } as any));
  assert.equal(
    calls.some((call) => call.path.endsWith('/query')),
    false
  );
  await until(() => !action().disabled);
  await act(async () => context.setUser({ id: 'owner-5xx' } as any));
  assert.deepEqual(calls.find((call) => call.path.endsWith('/query'))?.body, {
    taskId: saved,
  });
  assert.equal(
    calls.filter((call) => call.path.endsWith('/generate')).length,
    1
  );
});
test('unmount during a quote never continues to upload or submit', async () => {
  await render('3.0', 'en', 'owner');
  await prompt();
  const pending = deferred<Response>();
  respond = () => pending.promise;
  await act(async () => action().click());
  const body = calls[0].body;
  await act(async () => root!.unmount());
  root = undefined;
  await act(async () =>
    pending.resolve(
      Response.json({
        code: 0,
        data: {
          credits: 11,
          normalizedInput: body,
          quoteVersion: 'wan-pricing-v1',
        },
      })
    )
  );
  assert.equal(calls.length, 1);
});

test('changing settings hides the old price and ignores late quotes without generating', async () => {
  await render('3.0', 'en', 'quote-owner');
  assert.match(
    host.querySelector('[data-testid="generation-price"]')!.textContent!,
    /11 credits/
  );
  const older = deferred<Response>();
  const original = respond;
  respond = (path, body) =>
    path.endsWith('/quote')
      ? body.resolution === '480P'
        ? older.promise
        : Promise.resolve(
            Response.json({
              code: 0,
              data: {
                credits: 29,
                normalizedInput: body,
                quoteVersion: 'wan-pricing-v1',
              },
            })
          )
      : original(path, body);
  await chooseMode('480P');
  assert.equal(action().disabled, true);
  assert.doesNotMatch(
    host.querySelector('[data-testid="generation-price"]')!.textContent!,
    /11 credits/
  );
  await until(() => calls.some((c) => c.body?.resolution === '480P'));
  const oldInput = calls.find((c) => c.body?.resolution === '480P')!.body;
  await chooseMode('1080P');
  await until(() => !action().disabled);
  await act(async () =>
    older.resolve(
      Response.json({
        code: 0,
        data: {
          credits: 4,
          normalizedInput: oldInput,
          quoteVersion: 'wan-pricing-v1',
        },
      })
    )
  );
  assert.match(
    host.querySelector('[data-testid="generation-price"]')!.textContent!,
    /29 credits/
  );
  assert.equal(
    calls.some((c) => c.path.endsWith('/generate')),
    false
  );
});

test('a changed server price blocks generation and refreshes the visible cost', async () => {
  await render('3.0', 'en', 'price-owner');
  await prompt();
  const original = respond;
  respond = (path, body) =>
    path.endsWith('/quote')
      ? Promise.resolve(
          Response.json({
            code: 0,
            data: {
              credits: 19,
              normalizedInput: body,
              quoteVersion: 'wan-pricing-v1',
            },
          })
        )
      : original(path, body);
  await act(async () => action().click());
  await until(() =>
    /19 credits/.test(
      host.querySelector('[data-testid="generation-price"]')!.textContent!
    )
  );
  assert.equal(
    calls.some((c) => c.path.endsWith('/generate')),
    false
  );
  assert.match(host.querySelector('[role=alert]')!.textContent!, /updated/);
});

test('selected images have previews and removing a required frame invalidates the quote', async () => {
  await render('3.0', 'en', 'preview-owner');
  await chooseMode('Image to Video');
  await selectImages();
  assert.match(
    host.querySelector('img[alt="First frame"]')!.getAttribute('src')!,
    /^blob:/
  );
  await act(async () =>
    host
      .querySelector<HTMLButtonElement>(
        'button[aria-label="Remove First frame"]'
      )!
      .click()
  );
  assert.equal(host.querySelector('img[alt="First frame"]'), null);
  assert.match(
    host.querySelector('[data-testid="generation-price"]')!.textContent!,
    /Add source media/
  );
  await act(async () => action().click());
  assert.equal(
    calls.some((c) => c.path.endsWith('/generate')),
    false
  );
});
