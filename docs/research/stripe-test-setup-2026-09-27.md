# Stripe test setup — 2026-09-27

## Current state

WanAI local development now uses KIROOAI INC's **test-mode** Stripe credentials. This setup did not configure live credentials or a production webhook endpoint. The user confirmed that `wanai30.com` is already online; the deployed version and its payment configuration have not been audited here.

- Existing test public/secret keys saved through the WanAI administrator payment form, with user approval. Secret values are not included in this report.
- Test signing secret saved in WanAI's configuration database; Stripe enabled and selected as the default provider.
- Stripe Connect account field left empty because this integration uses the account directly.
- Checkout uses the server's existing catalog and dynamic Stripe prices. No legacy Price IDs are required.
- An isolated, non-default billing portal configuration was created: `bpc_1UKFWYJxgDIaf3uhoKorDzw4`. It supports invoice history and payment method updates. Cancellation remains in WanAI's subscription flow.
- Stripe created a default portal configuration on the initial creation in this test environment; WanAI uses the second, explicitly scoped configuration. No live configuration was changed.
- Stripe CLI 1.52.0 forwards test events to `http://localhost:3000/api/payment/notify/stripe`, using API version `2025-08-27.basil`.

## Verified using Stripe-hosted Checkout and its test card

| Purchase | Charged in test mode | Credits granted | Expiry |
| --- | ---: | ---: | --- |
| Starter monthly | $19.90 | 1,000 | One billing month |
| Starter annual | $202.98 | 1,000 for the first month | One month for this installment |
| Starter credit pack | $24.90 | 1,000 | None |

Three dedicated users have IDs beginning with `stripe-test-20260927-` and `.invalid` email addresses. These are test records; the owner's 1,328 credits were verified unchanged. No real money was charged.

The production checkout handler was invoked with injected test identities and real database/catalog/provider dependencies. The browser completed the three Stripe test payments, and the running HTTP webhook route settled them. The browser's existing Google session belongs to the owner, so the separate test identities' success redirects are intentionally not a test of the same-user callback path.

Verified:

- All three orders are paid and have the exact approved amounts and credit allowances.
- Stripe's invoice and checkout notifications return HTTP 200.
- Replaying each checkout completion event does not grant additional credits.
- Unsigned webhook requests return HTTP 400.
- Both test subscriptions were canceled through WanAI's cancellation service: local status is `pending_cancel`, Stripe has `cancel_at_period_end=true`, and paid-period credits remain available.
- The billing portal opens and shows the invoice and test card.
- Annual checkout creates the monthly allowance schedule and first installment. Future wall-clock installments were not exercised in this run.
- Pricing page displays enabled subscription buttons and Stripe checkout information.

## Code fix

The admin settings server action captured the `next-intl` translation function in its closure, preventing serialization and breaking Save. Translation lookup now runs inside the server action. Saving the test keys through the browser succeeded after this fix.

Validation: 44 focused Stripe/secret-handling tests passed; TypeScript and changed-file ESLint passed.

## Local operation

The forwarding process must remain running while testing payment notifications:

```powershell
Set-Location I:\jp\code\wanai30.com
pnpm exec tsx .test/listen-stripe-test.ts
```

The helper loads the saved test key without printing it and redacts the signing secret. It uses the locally cached Stripe CLI installation. Restart the helper if this computer or its process is restarted. Do not run multiple forwarding processes concurrently.

Supporting scripts:

- `.test/stripe-readiness.ts`: reports configuration flags without secrets.
- `.test/setup-stripe-test.ts`: account-guarded, test-only setup; already applied.
- `.test/e2e-stripe-test.ts`: prepare/audit/cancel/verify workflow for the three named test users. Setup files and private test evidence stay local.

## Before live payments

1. Inspect the existing `https://wanai30.com` deployment, determine which local changes still need publishing, and confirm the production webhook route is reachable over HTTPS.
2. Configure approved live credentials and a separate live webhook signing secret in the production environment. Do not reuse the CLI signing secret.
3. Create the corresponding WanAI-scoped billing portal configuration in live mode.
4. Register snapshot events using API version `2025-08-27.basil`: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `invoice.payment_succeeded`, `invoice.paid`, `invoice.payment_failed`, `refund.created`, `refund.updated`, `customer.subscription.updated`, `customer.subscription.deleted`.
5. Confirm production return URLs, customer-facing merchant branding, and the deployment's annual monthly-grant processing. Keep test users and orders distinguishable from real customers.
