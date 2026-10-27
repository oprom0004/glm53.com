import assert from 'node:assert/strict';
import test from 'node:test';

import { safeAppRedirect, safeLocalReturnPath } from '@/shared/services/subscription-plans';

test('payment returns only to a same-origin path', () => {
  assert.equal(
    safeLocalReturnPath('/settings/billing?paid=1', '/pricing'),
    '/settings/billing?paid=1'
  );
  assert.equal(
    safeLocalReturnPath('//evil.example/steal', '/pricing'),
    '/pricing'
  );
  assert.equal(
    safeAppRedirect(
      'https://evil.example/steal',
      'https://wan.example',
      '/pricing'
    ),
    'https://wan.example/pricing'
  );
});
