import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';

import enCommon from '@/config/locale/messages/en/common.json';
import enIndex from '@/config/locale/messages/en/pages/index.json';
import enHome from '@/config/locale/messages/en/wan-home.json';
import zhCommon from '@/config/locale/messages/zh/common.json';
import zhIndex from '@/config/locale/messages/zh/pages/index.json';
import zhHome from '@/config/locale/messages/zh/wan-home.json';

import { WanComparison } from './wan-comparison';
import { WanCta } from './wan-cta';
import { WanFaq } from './wan-faq';
import { WanFeatures } from './wan-features';
import { WanFooter } from './wan-footer';
import { WanHero } from './wan-hero';
import { WanLineup } from './wan-lineup';
import { WanUseCases } from './wan-use-cases';

Object.assign(globalThis, { React });

function renderHome(locale: 'en' | 'zh') {
  return new JSDOM(
    renderToStaticMarkup(
      <NextIntlClientProvider
        locale={locale}
        timeZone="UTC"
        messages={{
          common: locale === 'zh' ? zhCommon : enCommon,
          'wan-home': locale === 'zh' ? zhHome : enHome,
          pages: { index: locale === 'zh' ? zhIndex : enIndex },
        }}
        onError={(error) => {
          throw error;
        }}
      >
        <WanHero />
        <WanFeatures />
        <WanLineup />
        <WanComparison />
        <WanUseCases />
        <WanCta />
        <WanFaq />
        <WanFooter />
      </NextIntlClientProvider>
    )
  ).window.document;
}

test('Chinese public pages translate all section headings, media names and model specifications', () => {
  const document = renderHome('zh');
  for (const heading of document.querySelectorAll('h1, h2')) {
    assert.match(heading.textContent ?? '', /[\u4e00-\u9fff]/);
  }
  for (const video of document.querySelectorAll('video')) {
    assert.match(video.getAttribute('aria-label') ?? '', /[\u4e00-\u9fff]/);
  }
  for (const row of document.querySelectorAll('tbody tr')) {
    assert.match(row.firstElementChild?.textContent ?? '', /[\u4e00-\u9fff]/);
  }
  assert.doesNotMatch(
    document.body.textContent ?? '',
    /Stable|Now Live|Live 1080P|What’s New|Create Social/
  );
  assert.match(document.querySelector('footer')?.textContent ?? '', /隐私政策/);
});

test('Chinese navigation keeps locale and generator anchors, including the shared version lineup', () => {
  const document = renderHome('zh');
  const modelLinks = Array.from(document.querySelectorAll('a')).filter((link) =>
    link.getAttribute('href')?.includes('/wan-')
  );
  assert.ok(modelLinks.length >= 8);
  assert.ok(
    modelLinks.every((link) =>
      link.getAttribute('href')?.startsWith('/zh/wan-')
    )
  );
  assert.ok(
    modelLinks.every((link) => /[\u4e00-\u9fff]/.test(link.textContent ?? ''))
  );
  assert.ok(document.querySelector('a[href="/zh/wan-3#generator"]'));
  assert.ok(document.querySelector('a[href="mailto:contact@wanai30.com"]'));
});

test('FAQ controls expose all localized answers to accessible disclosure state', () => {
  for (const locale of ['zh', 'en'] as const) {
    const document = renderHome(locale);
    const buttons = Array.from(document.querySelectorAll('#faq button'));
    assert.equal(buttons.length, 7);
    assert.equal(
      buttons.filter(
        (button) => button.getAttribute('aria-expanded') === 'true'
      ).length,
      1
    );
    buttons.forEach((button) => {
      const answer = document.getElementById(
        button.getAttribute('aria-controls') ?? ''
      );
      assert.ok(answer);
      assert.equal(answer.getAttribute('aria-labelledby'), button.id);
      assert.ok(answer.textContent);
      assert.equal(
        answer.hasAttribute('hidden'),
        button.getAttribute('aria-expanded') === 'false'
      );
      if (locale === 'zh') assert.match(answer.textContent!, /[\u4e00-\u9fff]/);
    });
  }
});

test('English public pages retain English copy and unprefixed internal links without credit giveaways', () => {
  const document = renderHome('en');
  assert.match(
    document.querySelector('h1')?.textContent ?? '',
    /WanAI 3.0 Video Generator/
  );
  assert.equal(
    document.querySelector('#features h2')?.textContent,
    'What’s New in Wan 3.0'
  );
  assert.ok(document.querySelector('a[href="/wan-3#generator"]'));
  assert.doesNotMatch(
    document.body.textContent ?? '',
    /[\u4e00-\u9fff]|free credits|50 credits/i
  );
});
