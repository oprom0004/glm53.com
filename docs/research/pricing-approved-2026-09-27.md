# Approved subscription pricing — 2026-09-27

The later [credit unit conversion](credit-unit-conversion-2026-09-27.md) supersedes this document's credit allowances while retaining its USD prices and annual discount.

The user approved monthly subscriptions as the primary purchase option and a 15% annual discount.

| Tier | Credits | Monthly USD | Annual USD | Permanent pack USD |
| --- | ---: | ---: | ---: | ---: |
| Starter | 700 | 19.90 | 202.98 | 24.90 |
| Creator | 1,700 | 46.80 | 477.36 | 59.90 |
| Pro | 3,500 | 94.80 | 966.96 | 119.90 |

Subscription credits are monthly allowances, not annual totals. Annual plans charge once yearly and release credits each service month. Subscription credits expire at the corresponding period boundary with no rollover. Purchased packs remain permanent.

## Application

- Saved all nine plans through `saveWanCatalog` after checking the existing owner's super-admin role and the expected catalog revision.
- The active database `wan_pricing_catalog` revision is `f65ebd08-98b8-460a-ad98-a38bb631a88e`.
- The approved import values are in `wan-pricing-2026-09-27.json`; amounts are integer US cents.
- Product identifiers stay fixed, including their historical numeric suffixes. Current credit quantities come from the catalog values, not those suffixes. Existing order and subscription snapshots are preserved.
- Historical code defaults remain for compatibility. A deployment using this database receives the saved catalog; a deployment using a new database must apply these nine approved values in the admin pricing screen before accepting purchases.
- The landing page and pricing page share the same catalog as checkout. Old quote revisions are rejected before a new payable order can be created.
- Monthly remains selected by default and Creator remains featured. The annual tab now shows the minimum whole-percent saving across equal-allowance annual plans. The approved configuration displays `Save 15%` / `省 15%`.

## Validation

- Read back the database and `/api/payment/catalog`: all nine amounts and allowances match.
- Browser checked monthly, annual and credit-pack tabs, annual totals, monthly allowances, expiry descriptions and featured Creator card.
- 64 focused pricing, catalog, checkout and annual-credit tests passed with the project's `--expose-gc` setting. The first invocation omitted this flag and hit Windows SQLite cleanup locks; all assertions passed and the corrected run passed fully.
- TypeScript, changed-file ESLint and the production build passed.
- No real payment was submitted; live payment-provider setup and transaction acceptance remain separate work.

The pre-change catalog backup is `.test/pricing-before-20260927.json`.
