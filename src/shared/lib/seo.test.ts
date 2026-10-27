import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPageMetadata, PUBLIC_PAGE_SEO } from './seo';

test('every public Wan page has unique localized metadata and absolute alternates', () => {
  for (const locale of ['en', 'zh'] as const) {
    const rows = Object.values(PUBLIC_PAGE_SEO).map((page) =>
      buildPageMetadata({ locale, ...page[locale] })
    );
    assert.equal(new Set(rows.map((row) => row.title)).size, rows.length);
    for (const row of rows) {
      assert.match(String(row.alternates?.canonical), /^https?:\/\//);
      assert.match(String(row.openGraph?.url), /^https?:\/\//);
      assert.equal((row.twitter as { card?: string })?.card, 'summary_large_image');
      assert.match(
        String(row.alternates?.languages?.en),
        /^https?:\/\//
      );
      assert.match(
        String(row.alternates?.languages?.zh),
        /^https?:\/\//
      );
    }
  }
});

test('private metadata is noindex and nofollow', () => {
  const metadata = buildPageMetadata({
    locale: 'en',
    path: '/settings/tasks',
    title: 'Private tasks',
    description: 'Private tasks',
    noIndex: true,
  });
  assert.deepEqual(metadata.robots, { index: false, follow: false });
});
