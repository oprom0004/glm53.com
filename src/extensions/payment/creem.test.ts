import assert from 'node:assert/strict';
import test from 'node:test';

import { CreemProvider } from './creem';

test('Creem environment is selected only from server configuration', () => {
  const sandbox = new CreemProvider({ apiKey: 'test', environment: 'sandbox' });
  const production = new CreemProvider({
    apiKey: 'live',
    environment: 'production',
  });
  assert.equal((sandbox as any).baseUrl, 'https://test-api.creem.io');
  assert.equal((production as any).baseUrl, 'https://api.creem.io');
});
