import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSitemapEntries } from './sitemap';

test('sitemap includes localized public Wan routes and excludes private routes', () => {
  const entries = buildSitemapEntries('https://wan.example');
  const urls = entries.map((entry) => entry.url);
  for (const path of ['/', '/pricing', '/wan-2-5', '/wan-2-6', '/wan-2-7', '/wan-3']) {
    assert.ok(urls.includes(`https://wan.example${path === '/' ? '' : path}`));
    assert.ok(urls.includes(`https://wan.example/zh${path === '/' ? '' : path}`));
  }
  assert.doesNotMatch(urls.join('\n'), /admin|settings|api|auth-callback/);
});
