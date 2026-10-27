import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';

import { Input } from './input';

test('configured provider secret renders masked and empty with an accessible reveal control', () => {
  const markup = renderToStaticMarkup(
    <NextIntlClientProvider
      locale="en"
      timeZone="UTC"
      messages={{
        common: {
          form: {
            show_secret: 'Show saved secret',
            hide_secret: 'Hide saved secret',
          },
        },
      }}
    >
      <Input
        field={{
          name: 'polaris_api_key',
          title: 'Polaris API Key',
          type: 'password',
          metadata: {
            secret: true,
            configured: true,
            revealSecret: true,
          },
        }}
        formField={{
          name: 'polaris_api_key',
          value: '',
          onChange() {},
          onBlur() {},
          ref() {},
        }}
        id="polaris_api_key"
      />
    </NextIntlClientProvider>
  );

  assert.match(markup, /name="polaris_api_key"/);
  assert.match(markup, /type="password"/);
  assert.match(markup, /placeholder="••••••••"/);
  assert.match(markup, /aria-label="Show saved secret"/);
  assert.match(markup, /aria-pressed="false"/);
  assert.doesNotMatch(markup, /private-test-key/);
});
