import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { runInThisContext } from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);

async function fixture() {
  let user: { id: string } | null = { id: 'render-owner' };
  const updates: string[] = [];
  const dependencies: Record<string, unknown> = {
    'next-intl/server': { getTranslations: async () => (key: string) => key },
    '@/shared/blocks/common': { Empty: () => null },
    '@/shared/blocks/form': { FormCard: () => null },
    '@/shared/models/user': {
      getUserInfo: async () => user,
      updateUser: async (id: string) => {
        updates.push(id);
      },
    },
  };
  const code = ts.transpileModule(
    readFileSync(
      new URL(
        '../../../app/[locale]/(landing)/settings/profile/page.tsx',
        import.meta.url
      ),
      'utf8'
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }
  ).outputText;
  const module = { exports: {} as any };
  runInThisContext(`(function(require,module,exports){${code}\n})`)(
    (id: string) => dependencies[id] ?? require(id),
    module,
    module.exports
  );
  const page = await module.exports.default();
  const handler = page.props.children.props.form.submit.handler;
  const data = new FormData();
  data.set('name', 'Updated name');
  data.set('image', '');
  return {
    updates,
    setUser: (next: typeof user) => {
      user = next;
    },
    submit: () => handler(data, { user: { id: 'forged-owner' } }),
  };
}

test('profile updates reauthenticate at submission and ignore forged or stale user data', async () => {
  const f = await fixture();
  f.setUser({ id: 'current-owner' });
  await f.submit();
  assert.deepEqual(f.updates, ['current-owner']);
});

test('a profile form submitted after sign-out cannot update the previously signed-in user', async () => {
  const f = await fixture();
  f.setUser(null);
  await assert.rejects(f.submit, /no auth/);
  assert.deepEqual(f.updates, []);
});
