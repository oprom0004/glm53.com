import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';

import enCommon from '@/config/locale/messages/en/common.json';
import enIndex from '@/config/locale/messages/en/pages/index.json';
import zhCommon from '@/config/locale/messages/zh/common.json';
import zhIndex from '@/config/locale/messages/zh/pages/index.json';

import { WanHeader } from './wan-header';

function renderHeader(locale: 'en' | 'zh') {
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

test('anonymous visitors can reach sign-in from both desktop and mobile navigation', () => {
  const englishHeader = renderHeader('en');
  const chineseHeader = renderHeader('zh');

  assert.equal(englishHeader.match(/href="\/sign-in"/g)?.length, 2);
  assert.equal(chineseHeader.match(/href="\/zh\/sign-in"/g)?.length, 2);
});
