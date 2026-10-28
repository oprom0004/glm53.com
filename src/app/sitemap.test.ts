import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSitemapEntries } from './sitemap';

test('sitemap includes localized public GLM routes and excludes private routes', () => {
  const entries = buildSitemapEntries('https://glm53.example');
  const urls = entries.map((entry) => entry.url);
  for (const path of ['/', '/chat', '/pricing']) {
    assert.ok(urls.includes(`https://glm53.example${path === '/' ? '' : path}`));
    assert.ok(urls.includes(`https://glm53.example/zh${path === '/' ? '' : path}`));
  }
  assert.doesNotMatch(urls.join('\n'), /admin|settings|api|auth-callback/);
});
