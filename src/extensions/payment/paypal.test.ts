import assert from 'node:assert/strict';
import test from 'node:test';

import { PayPalProvider } from './paypal';

test('PayPal environment is selected only from server configuration', () => {
  const sandbox = new PayPalProvider({
    clientId: 'client',
    clientSecret: 'secret',
    environment: 'sandbox',
  });
  const production = new PayPalProvider({
    clientId: 'client',
    clientSecret: 'secret',
    environment: 'production',
  });
  assert.match((sandbox as any).baseUrl, /sandbox/);
  assert.doesNotMatch((production as any).baseUrl, /sandbox/);
});
