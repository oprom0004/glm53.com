import assert from 'node:assert/strict';
import test from 'node:test';

import { buildProductJsonLd, serializeJsonLd } from './json-ld';
import { WAN_PRODUCTS } from './wan-product-catalog';

test('product JSON-LD exposes real charge amounts and links to the matching purchase mode', () => {
  const graph = buildProductJsonLd('en');
  assert.match(graph.url, /^https?:\/\//);
  assert.deepEqual(
    graph.offers.map((offer) => [offer.name, offer.price, offer.priceCurrency]),
    [
      ['Starter Monthly', '15.90', 'USD'],
      ['Creator Monthly', '45.90', 'USD'],
      ['Pro Monthly', '95.90', 'USD'],
      ['Starter Annual', '172.00', 'USD'],
      ['Creator Annual', '495.00', 'USD'],
      ['Pro Annual', '1036.00', 'USD'],
      ['Starter Credits', '19.90', 'USD'],
      ['Creator Credits', '54.90', 'USD'],
      ['Pro Credits', '109.90', 'USD'],
    ]
  );
  assert.match(graph.offers[4].url, /\/pricing\?purchase=annual#pricing$/);
  assert.match(
    buildProductJsonLd('zh').offers[8].url,
    /\/zh\/pricing\?purchase=credits#pricing$/
  );
});

test('JSON-LD uses configured prices rather than the default catalog', () => {
  const graph = buildProductJsonLd(
    'zh',
    WAN_PRODUCTS.map((product) => ({
      ...product,
      amount: product.mode === 'annual' ? 19255 : 2000,
    }))
  );
  assert.equal(graph.offers[0].price, '20.00');
  assert.equal(graph.offers[3].price, '192.55');
});

test('JSON-LD serialization escapes tag boundaries', () => {
  assert.equal(
    serializeJsonLd({ value: '</script>' }),
    '{"value":"\\u003c/script>"}'
  );
});
