const assert = require('node:assert/strict');
const { after, test } = require('node:test');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<div id="app"></div>', {
  url: 'http://localhost/admin/settings/ai',
});

for (const name of [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'Node',
  'Element',
]) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value: dom.window[name],
  });
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = require('react');
const { act } = React;
const { createRoot } = require('react-dom/client');
const { NextIntlClientProvider } = require('next-intl');
const { PolarisModelCheck } = require('./model-check.tsx');

after(() => dom.window.close());

for (const locale of ['en', 'zh']) {
  test(`${locale}: model check is explicit, safe, retryable and abortable`, async () => {
    const messages = require(
      `../../../config/locale/messages/${locale}/admin/settings.json`
    );
    const copy = messages.polaris.check;
    const originalFetch = global.fetch;
    const root = createRoot(document.getElementById('app'));
    let resolve;
    const calls = [];

    global.fetch = async (url, options) => {
      calls.push({ url, options });
      return new Promise((done) => {
        resolve = done;
      });
    };

    try {
      await act(async () =>
        root.render(
          React.createElement(
            NextIntlClientProvider,
            {
              locale,
              timeZone: 'UTC',
              messages: { admin: { settings: messages } },
            },
            React.createElement(PolarisModelCheck)
          )
        )
      );

      assert.equal(calls.length, 0, 'mount must not trigger a request');
      const button = document.querySelector('button');
      await act(async () => {
        button.click();
        button.click();
      });
      assert.equal(calls.length, 1, 'duplicate checks are blocked');
      assert.equal(button.disabled, true);
      assert.equal(button.getAttribute('aria-busy'), 'true');
      assert.equal(calls[0].url, '/api/admin/polaris/models');
      assert.equal(calls[0].options.body, undefined, 'the key stays server-side');

      await act(async () =>
        resolve(
          new Response(JSON.stringify({ error: 'raw-secret-error' }), {
            status: 502,
          })
        )
      );
      assert.equal(
        document.querySelector('[role="alert"]').textContent,
        copy.errors.unavailable
      );
      assert.ok(!document.body.textContent.includes('raw-secret-error'));

      await act(async () => button.click());
      await act(async () =>
        resolve(
          new Response(JSON.stringify({ models: ['wan3.0-video-prime'] }))
        )
      );
      assert.equal(
        document.querySelector('code').textContent,
        'wan3.0-video-prime'
      );

      await act(async () => button.click());
      await act(async () =>
        resolve(
          new Response(JSON.stringify({ error: 'unauthenticated' }), {
            status: 401,
          })
        )
      );
      assert.equal(document.querySelector('code'), null);
      assert.equal(
        document.querySelector('[role="alert"]').textContent,
        copy.errors.unauthenticated
      );

      await act(async () => button.click());
      await act(async () => resolve(new Response(JSON.stringify({ models: [] }))));
      assert.ok(document.body.textContent.includes(copy.empty));

      await act(async () => button.click());
      const lastSignal = calls.at(-1).options.signal;
      await act(async () => root.unmount());
      assert.equal(lastSignal.aborted, true, 'unmount aborts the request');
      await act(async () =>
        resolve(new Response(JSON.stringify({ models: ['wan2.7-t2v'] })))
      );
    } finally {
      global.fetch = originalFetch;
    }
  });
}
