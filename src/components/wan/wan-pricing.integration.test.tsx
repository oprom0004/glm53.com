import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('homepage places pricing after use cases and before FAQ', async () => {
  const source = await readFile(
    new URL('../../app/[locale]/(landing)/page.tsx', import.meta.url),
    'utf8'
  );
  const useCases = source.indexOf('<GlmWorkflows');
  const pricing = source.indexOf('<GlmPricing');
  const faq = source.indexOf('<GlmFaq');
  assert.ok(useCases >= 0 && pricing > useCases && faq > pricing);
});
