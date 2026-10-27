import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';

import en from '@/config/locale/messages/en/wan-home.json';
import zh from '@/config/locale/messages/zh/wan-home.json';

import { WanLineup } from './wan-lineup';

for (const locale of ['en', 'zh'] as const)
  test(`version lineup ${locale} links to each generator with Kie Wan 2.5 resolutions`, () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider
        locale={locale}
        timeZone="UTC"
        messages={{ 'wan-home': locale === 'zh' ? zh : en }}
      >
        <WanLineup />
      </NextIntlClientProvider>
    );
    for (const route of ['/wan-2-5', '/wan-2-6', '/wan-2-7', '/wan-3']) {
      assert.ok(
        html.includes(`href="${locale === 'zh' ? '/zh' : ''}${route}"`),
        route
      );
    }
    const wan25 = new JSDOM(html).window.document
      .querySelector(`a[href="${locale === 'zh' ? '/zh' : ''}/wan-2-5"]`)!
      .closest('article')!.textContent!;
    assert.match(wan25, /1080p/i);
    assert.doesNotMatch(wan25, /480P/);
    assert.match(wan25, /720P/);
    assert.equal(/free|赠送.?50/i.test(html), false);
  });
