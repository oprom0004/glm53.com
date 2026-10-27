import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { runInThisContext } from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
// Execute the real server page; replace only data/session boundaries that need a request/DB.
function loadPage(path: string, overrides: Record<string, unknown>) {
  const filename = new URL(
    '../../app/[locale]/(landing)/settings/billing/' + path,
    import.meta.url
  );
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} as any };
  const defaults: Record<string, unknown> = {
    'next-intl/server': {
      getTranslations: async () => (key: string, values?: object) =>
        key + (values ? JSON.stringify(values) : ''),
    },
    '@/shared/blocks/common': { Empty: 'empty' },
    '@/shared/blocks/form': { FormCard: 'form-card' },
    '@/shared/blocks/panel': { PanelCard: 'panel-card' },
    '@/shared/blocks/table': { TableCard: 'table-card' },
    '@/shared/components/ui/button': { Button: 'button' },
    '@/shared/lib/annual-credit-policy': {
      ANNUAL_MONTHLY_SCENE: 'annual_monthly_v1',
    },
    '@/shared/lib/wan-product-catalog': {
      isAnnualMonthlyProduct: (id: string) => id === 'creator-annual-2400-v1',
    },
  };
  const dependencies = { ...defaults, ...overrides };
  runInThisContext(`(function(require, module, exports) {${code}\n})`, {
    filename: filename.pathname,
  })(
    (id: string) => (id in dependencies ? dependencies[id] : require(id)),
    module,
    module.exports
  );
  return module.exports.default;
}
test('credits page settles the current annual month before counting and reading the ledger', async () => {
  const sequence: string[] = [];
  const Page = loadPage('../credits/page.tsx', {
    '@/shared/models/user': { getUserInfo: async () => ({ id: 'owner' }) },
    '@/shared/services/annual-credits': {
      ensureAnnualCredits: async (id: string) => {
        assert.equal(id, 'owner');
        sequence.push('settle');
      },
    },
    '@/shared/models/credit': {
      CreditStatus: { ACTIVE: 'active' },
      CreditTransactionType: {},
      getCreditsCount: async () => {
        sequence.push('count');
        return 1;
      },
      getCredits: async () => {
        sequence.push('list');
        return [];
      },
      getRemainingCredits: async () => 2400,
    },
  });
  const page = await Page({ searchParams: Promise.resolve({}) });
  assert.deepEqual(sequence.slice(0, 3), ['settle', 'count', 'list']);
  const children = page.props.children;
  assert.match(children[0].props.buttons[0].url, /purchase=credits/);
  const description = children[1].props.table.columns.find(
    (column: any) => column.name === 'description'
  );
  assert.equal(
    description.callback({ transactionScene: 'annual_monthly_v1' }),
    'annual_monthly_scene'
  );
});
test('cancel action reauthenticates instead of trusting the rendered user and delegates verified subscription cancellation', async () => {
  let signedIn = 'owner';
  let canceled: unknown;
  const subscription = {
    userId: 'owner',
    subscriptionNo: 'sub-1',
    subscriptionId: 'stripe-sub-1',
    paymentProvider: 'stripe',
    status: 'active',
    amount: 49500,
    interval: 'year',
    intervalCount: 1,
  };
  const manager = { getProvider: () => ({}) };
  const Page = loadPage('./cancel/page.tsx', {
    '@/shared/models/user': {
      getUserInfo: async () => (signedIn ? { id: signedIn } : null),
    },
    '@/shared/models/subscription': {
      findSubscriptionBySubscriptionNo: async () => subscription,
      SubscriptionStatus: { ACTIVE: 'active', TRIALING: 'trialing' },
    },
    '@/shared/services/payment': {
      getPaymentService: async () => manager,
      cancelSubscriptionForUser: async (args: any) => {
        canceled = args;
      },
    },
  });
  const page = await Page({
    params: Promise.resolve({ locale: 'en' }),
    searchParams: Promise.resolve({ subscription_no: 'sub-1' }),
  });
  const form = page.props.children.props.form;
  signedIn = '';
  await assert.rejects(
    form.submit.handler(new FormData(), {
      subscription,
      user: { id: 'owner' },
    }),
    /auth/
  );
  assert.equal(canceled, undefined);
  signedIn = 'current-owner';
  const result = await form.submit.handler(new FormData(), {
    subscription,
    user: { id: 'owner' },
  });
  assert.deepEqual(canceled, {
    subscriptionNo: 'sub-1',
    userId: 'current-owner',
    paymentManager: manager,
  });
  assert.equal(result.redirect_url, '/settings/billing');
});
test('billing includes non-terminated paused subscriptions and explains annual monthly allowances', async () => {
  const subscription = {
    productId: 'creator-annual-2400-v1',
    creditsAmount: 2400,
    status: 'paused',
    paymentProvider: 'stripe',
    subscriptionNo: 'sub-annual',
    paymentUserId: 'customer',
  };
  const Page = loadPage('./page.tsx', {
    '@/shared/models/user': { getUserInfo: async () => ({ id: 'owner' }) },
    '@/shared/models/subscription': {
      getCurrentSubscription: async () => undefined,
      getBillingSubscription: async () => subscription,
      getSubscriptionsCount: async () => 1,
      getSubscriptions: async () => [subscription],
      SubscriptionStatus: {
        ACTIVE: 'active',
        TRIALING: 'trialing',
        PAUSED: 'paused',
        EXPIRED: 'expired',
        PENDING_CANCEL: 'pending_cancel',
      },
    },
  });
  const page = await Page({ searchParams: Promise.resolve({}) });
  const panel = page.props.children[0];
  assert.equal(panel.props.label, 'paused');
  assert.ok(
    panel.props.buttons.some((button: any) =>
      button.url.includes('subscription_no=sub-annual')
    )
  );
  assert.ok(
    JSON.stringify(panel.props.children).includes('annual_credits_tip')
  );
  assert.ok(JSON.stringify(panel.props.children).includes('payment_attention'));
});
