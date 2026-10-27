import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import React from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';

import enCommon from '@/config/locale/messages/en/common.json';
import enIndex from '@/config/locale/messages/en/pages/index.json';
import zhCommon from '@/config/locale/messages/zh/common.json';
import zhIndex from '@/config/locale/messages/zh/pages/index.json';

import { WanHeader } from './wan-header';

function renderNavigation(locale: 'en' | 'zh') {
  const page = locale === 'zh' ? zhIndex : enIndex;
  const common = locale === 'zh' ? zhCommon : enCommon;
  return renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      timeZone="UTC"
      messages={{ common, pages: { index: page } }}
    >
      <WanHeader />
    </NextIntlClientProvider>
  );
}

test('desktop and mobile navigation reach every Wan version, pricing and sign-in', () => {
  for (const locale of ['en', 'zh'] as const) {
    const html = renderNavigation(locale);
    const prefix = locale === 'zh' ? '/zh' : '';
    for (const path of [
      '/wan-2-5',
      '/wan-2-6',
      '/wan-2-7',
      '/wan-3',
      '/pricing',
    ]) {
      assert.ok(
        (html.match(new RegExp(`href="${prefix}${path}"`, 'g')) || []).length >=
          2,
        `${locale}:${path}`
      );
    }
    assert.equal(
      (html.match(new RegExp(`href="${prefix}/sign-in"`, 'g')) || []).length,
      2
    );
  }
});

test('navigation includes authenticated account target and keyboard-close behavior', async () => {
  const source = await readFile(
    new URL('./wan-header.tsx', import.meta.url),
    'utf8'
  );
  assert.match(source, /\/my-videos/);
  assert.match(source, /event\.key !== 'Escape'/);
  assert.match(source, /mobileMenuButtonRef\.current\?\.focus/);
  assert.match(source, /onClick=\{\(\) => setMobileMenuOpen\(false\)\}/);
});
