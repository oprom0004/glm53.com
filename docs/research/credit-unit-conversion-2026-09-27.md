# Credit unit conversion — 2026-09-27

## Approved terms

The user approved 1,000 / 2,400 / 5,000 credits across monthly, annual and permanent credit packs, keeping every USD price and the 15% annual discount unchanged. Generation rates are scaled by 10/7. Creator's new allowance is rounded down from 2,428.571 to the explicitly approved 2,400 (about 1.18% less underlying usage).

The current nine-plan configuration is `wan-pricing-credit-units-2026-09-27.json`. It supersedes the allowances in `wan-pricing-2026-09-27.json`.

| Tier | Monthly allowance / pack credits | Monthly USD | Annual USD | Permanent pack USD |
| --- | ---: | ---: | ---: | ---: |
| Starter | 1,000 | 19.90 | 202.98 | 24.90 |
| Creator | 2,400 | 46.80 | 477.36 | 59.90 |
| Pro | 5,000 | 94.80 | 966.96 | 119.90 |

Annual allowances remain monthly grants with monthly expiry. Pack credits stay permanent.

## Generation rates

| Wan 3.0 | 480P credits/sec | 720P credits/sec | 1080P credits/sec |
| --- | ---: | ---: | ---: |
| Standard | 5 | 10 | 20 |
| Prime | 50/7 | 100/7 | 200/7 |

Wan 2.5–2.7 text/image rates also scale by 10/7; disabled specifications remain disabled. Exact fractions are supported by the shared rate validator, admin form and quote calculator. Total input-video plus output duration is multiplied first, then rounded up once. The customer sees a whole-credit quote, not a fraction. For example, Standard 720P 5s costs 50 credits; Prime 720P 5s costs 72. Prime 720P 7s costs exactly 100.

## Database cutover and balance preservation

- Catalog revision: `4875f992-4dee-46fe-bfc1-56bf97c824c7`.
- Rate revision: `d7f03e58-07c8-4e1a-b79c-32144f6d00a5`.
- Migration marker: `wan_credit_units_20260927`.
- Audited the actual database: no orders or subscriptions; all six video tasks successful. The migration refuses to run if orders, subscriptions, paid grants or unfinished tasks appear, because those require a separate entitlement/refund migration.
- Applied catalog, rates and balance compensation in one PostgreSQL transaction with table locks and expected-state checks.
- The owner's unspent gift balance was 929 credits. Added an auditable 399-credit conversion grant, bringing it to `ceil(929 × 10/7) = 1,328`. Existing ledger entries and completed task charges remain historical records. Any source expiry is retained on the adjustment.
- Re-ran the migration and verified `alreadyApplied: true`; the idempotency marker prevents repeat grants. Pre-change backup: `.test/credit-units-before-20260927.json`. This backup includes account identifiers and should remain local.
- Historical product identifiers remain stable. Their numeric suffixes do not determine current allowances.
- Configuration lives in the database. A deployment sharing this database gets the new catalog and rates. For a new database, import both the approved catalog and generation rates before accepting purchases; legacy code defaults alone do not activate this conversion.

## Verification

- 39 focused pricing, rate-setting, reference-video and UI tests passed.
- Full regression run: 360 passed, one checkout test-file process exited with Windows status 3221225477. Independently reran `wan-checkout.test.ts` with the same Node/tsx/GC settings: all 19 tests passed. The full run was not clean; no assertion failure was reported for the exited process. Logs: `.test/credit-unit-tests.log`, `.test/credit-unit-checkout-retry.log`.
- TypeScript, changed-file ESLint and production build passed.
- Browser confirmed Standard 720P 5s = 50, Prime 720P 5s = 72, balance = 1,328, and monthly/annual/permanent-pack catalog values.
- No real generation or payment was submitted.
