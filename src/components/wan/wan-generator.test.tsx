import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, test } from 'node:test';
import React from 'react';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { PathnameContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { JSDOM } from 'jsdom';
import { NextIntlClientProvider } from 'next-intl';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';

import { useWanGeneration } from './use-wan-generation';
import { WanGenerator } from './wan-generator';

const dom = new JSDOM('<div></div>', { url: 'https://wan.example/wan-3' });
for (const name of [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'Node',
  'Element',
  'localStorage',
]) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value: dom.window[name as keyof Window],
  });
}
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
const { act } = React;
after(() => dom.window.close());

function render(version: '2.5' | '3.0', locale: 'en' | 'zh' = 'en') {
  return renderToStaticMarkup(
    <AppRouterContext.Provider
      value={
        {
          push() {},
          replace() {},
          refresh() {},
          back() {},
          forward() {},
          prefetch: async () => {},
        } as any
      }
    >
      <PathnameContext.Provider value="/wan-3">
        <NextIntlClientProvider locale={locale} messages={{}}>
          <WanGenerator version={version} />
        </NextIntlClientProvider>
      </PathnameContext.Provider>
    </AppRouterContext.Provider>
  );
}

test('Wan 2.5 renders Kie duration, prompt and HD limits without Prime or reference mode', () => {
  const html = render('2.5');
  assert.ok(html.includes('Wan 2.5 AI Video Generator'));
  assert.ok(html.includes('max="10"'));
  assert.equal(html.includes('Prime'), false);
  assert.equal(html.includes('Reference to Video'), false);
  assert.equal(html.includes('1080P'), true);
  assert.equal(html.includes('480P'), false);
  assert.ok(html.includes('min="5"'));
  assert.ok(html.includes('step="5"'));
  assert.ok(html.includes('maxLength="800"'));
  assert.ok(html.includes('720P'));
});

test('Wan 3.0 exposes all modes and tiers with a direct generation action', () => {
  const html = render('3.0');
  assert.ok(html.includes('Text to Video'));
  assert.ok(html.includes('Image to Video'));
  assert.ok(html.includes('Reference to Video'));
  assert.ok(html.includes('Standard'));
  assert.ok(html.includes('Prime'));
  assert.ok(html.includes('1080P'));
  assert.ok(html.includes('Generate video'));
  assert.equal(html.includes('aria-haspopup="dialog"'), false);
});

test('generator supplies Chinese labels and never includes trial-credit marketing', () => {
  const html = render('3.0', 'zh');
  assert.ok(html.includes('Wan 3.0 AI 视频生成器'));
  assert.ok(html.includes('生成视频'));
  assert.equal(/赠送|免费.?50|50.?积分/.test(html), false);
});

function HookHarness({
  userId,
  onSignIn,
}: {
  userId?: string;
  onSignIn: () => void;
}) {
  const generation = useWanGeneration({
    version: '3.0',
    mode: 'text',
    userId,
    onRequireSignIn: onSignIn,
  });
  const draft = {
    version: '3.0' as const,
    tier: 'standard' as const,
    mode: 'text' as const,
    duration: 3,
    resolution: '480P' as const,
    ratio: '16:9' as const,
    prompt: 'Ocean wave',
    media: [],
  };
  return (
    <div>
      <output data-phase={generation.phase} data-error={generation.errorCode} />
      <button
        type="button"
        data-action="generate"
        onClick={() => generation.generate(draft)}
      >
        Generate
      </button>
    </div>
  );
}

test('generation hook gates sign-in, blocks duplicate quotes and surfaces safe task failure', async () => {
  const originalFetch = global.fetch;
  const calls: string[] = [];
  let signIns = 0;
  global.fetch = async (url, init) => {
    const path = String(url);
    calls.push(`${init?.method || 'GET'} ${path}`);
    if (path.includes('capabilities')) {
      return Response.json({ code: 0, data: { tiers: {} } });
    }
    if (path.includes('/quote')) {
      return Response.json({
        code: 0,
        data: {
          credits: 11,
          normalizedInput: {
            version: '3.0',
            tier: 'standard',
            mode: 'text',
            duration: 3,
            resolution: '480P',
            ratio: '16:9',
          },
          quoteVersion: 'wan-pricing-v1',
        },
      });
    }
    if (path.includes('/generate')) {
      const submitted = JSON.parse(String(init?.body));
      return Response.json({
        code: 0,
        data: {
          id:
            'wan-' +
            createHash('sha256')
              .update(`user-1\0${submitted.requestId}`)
              .digest('hex'),
          status: 'failed',
          phase: 'failed',
          costCredits: 11,
          errorCode: 'generation_rejected',
        },
      });
    }
    throw new Error(`unexpected request: ${path}`);
  };

  const unauthenticatedHost = document.createElement('div');
  document.body.appendChild(unauthenticatedHost);
  const unauthenticatedRoot = createRoot(unauthenticatedHost);
  await act(async () => {
    unauthenticatedRoot.render(
      <HookHarness userId={undefined} onSignIn={() => signIns++} />
    );
  });
  await act(async () => {
    (
      unauthenticatedHost.querySelector(
        '[data-action="generate"]'
      ) as HTMLButtonElement
    ).click();
  });
  assert.equal(signIns, 1);
  assert.equal(
    unauthenticatedHost.querySelector('output')?.getAttribute('data-error'),
    'unauthenticated'
  );
  await act(async () => unauthenticatedRoot.unmount());

  const authenticatedHost = document.createElement('div');
  document.body.appendChild(authenticatedHost);
  const authenticatedRoot = createRoot(authenticatedHost);
  await act(async () => {
    authenticatedRoot.render(
      <HookHarness userId="user-1" onSignIn={() => signIns++} />
    );
  });
  await act(async () => {
    const generate = authenticatedHost.querySelector(
      '[data-action="generate"]'
    ) as HTMLButtonElement;
    generate.click();
    generate.click();
  });
  assert.equal(calls.filter((call) => call.includes('/quote')).length, 1);
  for (
    let count = 0;
    count < 50 && !calls.some((call) => call.includes('/generate'));
    count++
  ) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  assert.equal(
    authenticatedHost.querySelector('output')?.getAttribute('data-phase'),
    'failed'
  );
  assert.equal(calls.filter((call) => call.includes('/generate')).length, 1);
  assert.equal(
    authenticatedHost.querySelector('output')?.getAttribute('data-error'),
    'generation_rejected'
  );
  await act(async () => authenticatedRoot.unmount());
  global.fetch = originalFetch;
});
