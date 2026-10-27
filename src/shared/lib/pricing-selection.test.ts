import assert from 'node:assert/strict';
import test from 'node:test';

test('purchase helpers recover selection and constrain payment navigation', async () => {
  const helpers = await import('./pricing-selection').catch(() => undefined);
  assert.ok(helpers, 'purchase selection helpers exist');
  assert.equal(helpers.parsePurchaseMode('annual'), 'annual');
  assert.equal(helpers.parsePurchaseMode('bogus'), 'monthly');
  assert.equal(
    helpers.pricingCallback('credits'),
    '/pricing?purchase=credits#pricing'
  );
  assert.equal(helpers.safeCheckoutUrl('javascript:alert(1)'), undefined);
  assert.equal(
    helpers.safeCheckoutUrl('https://checkout.stripe.com/c/pay/test'),
    'https://checkout.stripe.com/c/pay/test'
  );
  assert.equal(
    helpers.safeCheckoutUrl('https://attacker.invalid/pay'),
    undefined
  );
  assert.equal(
    helpers.safePaymentCallback('https://evil.invalid', 'https://wanai30.com'),
    undefined
  );
  assert.equal(
    helpers.safePaymentCallback('/settings/credits', 'https://wanai30.com'),
    'https://wanai30.com/settings/credits'
  );
});
