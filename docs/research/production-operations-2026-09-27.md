# Production operations follow-up

Date: 2026-09-27.

## Changes

- Replace template privacy/terms content with WanAI / KIROOAI INC information in English and Chinese. Add refund and disclaimer pages. Fix footer links and permanently redirect the former privacy/terms paths, including Chinese paths.
- Refund baseline authorized by the owner: reference wan30ai.com; first purchase within seven days with all purchased credits unused. Applied to first subscription or credit pack, with billing-error/service-failure review and mandatory consumer rights preserved. No promise of automatic cash refunds; requests go to support.
- Add `/api/cron/annual-credits`, authenticated by the existing CRON_SECRET. Each run settles at most 100 eligible users, reports processed/failed/backlog counts, and returns 503 on processing failures. It reuses the existing order-then-credit lock order and monthly transaction identity.
- Keep synchronous monthly settlement on balance/history reads and before spending. The daily run covers unattended accounts; balances remain correct at a monthly boundary even before the next scheduled invocation. No expired allowance is accumulated.
- Recovery scans bounded pages of pending tasks, skipping leases/backoffs without allowing the first page to hide later ready tasks. Transfer work remains one task per serverless invocation. Query/storage failures are reported as HTTP 503 rather than a misleading successful cron response. Retries do not regenerate videos or charge again.

## Schedule

Current Hobby-compatible schedule: video recovery daily at 03:00 UTC; annual credits daily at 04:00 UTC; temporary upload cleanup daily at 05:00 UTC. Hobby execution can occur within the scheduled hour. This is not minute-level recovery. The owner chose not to upgrade Vercel yet. After any future verified upgrade, set video recovery to `* * * * *` and annual settlement to `*/15 * * * *`, redeploy, and verify protected endpoints. No plan purchase performed.

## R2 cleanup

Target account: 890529cf303eac850f070097d3aa2d85; shared bucket: wav2lip-fr. Exact prefix: `wanai30/wan-upload-parts/`; expire objects after one day. Preserve every existing lifecycle rule and all objects outside this prefix. Upload tickets expire after 30 minutes; completed uploads already delete their parts.

The configured object key returned AccessDenied for lifecycle configuration. The user signed into the account containing the lipsync.pro domain, but that account has wav2lip rather than wav2lip-fr and a different account ID. No bucket lifecycle rule was changed.

Instead, `/api/cron/upload-parts` uses existing object credentials and CRON_SECRET to clean the exact staging directory daily. ListObjectsV2 permission was verified against the real prefix (200; zero objects). Only keys matching the uploader's user hash / UUID ticket / numeric part layout, with LastModified older than 24 hours, are deleted. New parts and all other paths are skipped. Reads are bounded to 1 MiB per response, pages to 500 objects and 10 pages, requests have timeouts, and deletion concurrency is four. A 220-second work budget leaves room within the 300-second function limit. A remaining backlog is reported via `hasMore`; failures return 503. Objects can remain approximately 24–49 hours with a daily schedule. Native R2 lifecycle is an optional future replacement, not a prerequisite for this fallback.

## Validation

- Annual policy, settlement and cron tests: 27 passed (includes two video-cron cases).
- Video recovery, cron and worker tests: 16 passed (the two video-cron cases are shared).
- Upload cleanup: four tests passed for strict scope/age, pagination, partial failures, invalid listings, and authorization.
- TypeScript and scoped ESLint passed; existing baseline-browser-mapping data-age notice only.
- Local production build passed. English/Chinese policy pages returned 200; old privacy/terms URLs redirect with 308; unauthenticated annual cron returned 401. Refund page visually checked. Updated production build also passed after adding cleanup. Release branch head: c7b84c3 (PR #2); merged to main as 7ee28be257b7e91b295426164ef7ff68013d13da. Production deployment 6yJb5g2WBfHwwx1f2fyX54mGiAEd reached Ready at 2026-09-27 13:06:44 UTC (2m25s build).

No real payment or paid video generation was initiated. Stripe production credentials and existing prices are unchanged.

## Sources

- https://wan30ai.com/refund (first purchase, seven days, unused credits)
- https://clipdance.ai/refund (comparison; different 14-day policy not adopted)
- https://developers.cloudflare.com/r2/buckets/object-lifecycles/
- https://vercel.com/docs/cron-jobs/usage-and-pricing

## Verified production result

- Deployment: https://vercel.com/oprom0004s-projects/wan30ai-com/6yJb5g2WBfHwwx1f2fyX54mGiAEd
- Merged PR: https://github.com/oprom0004/wan30ai.com/pull/2
- All eight English/Chinese policy pages: HTTP 200, KIROOAI INC present, no YourAppName template. All four legacy privacy/terms URLs: HTTP 308 to canonical pages.
- All three cron endpoints: unauthenticated 401; authenticated 200. Annual sweep processed 0, failed 0, no backlog. Upload cleanup scanned/deleted 0, failed 0, no backlog. Video recovery scanned/processed/failed 0. There was no eligible work at verification time; future scheduled delivery has not yet occurred.
- Public homepage, pricing, generator, sign-in, sitemap, payment catalog and reference capabilities returned 200. Google readiness and Stripe enabled both remain true. Upload initiation still rejects unauthenticated requests.
- Live refund page verified in the browser. Existing production object permissions successfully listed the isolated staging prefix; no object deletion was needed.
- Total distinct targeted test cases: 45. Updated production build, TypeScript, scoped ESLint, secret scan and GitHub Docker build all passed.
- The root workspace source and fast-xml-parser dependency were synchronized. This document and launch-checklist.md are the current local verification record; the merged PR contains the pre-deployment operations notes.

## Remaining owner-facing checks

- Minute-level unattended video recovery deferred at the owner's request; Hobby daily schedule retained.
- A real payment/renewal and a complete production upload/generation/download flow (including mobile and large reference video) remain outside this verification. No paid generation or actual payment was initiated.
- Google login-button popup compatibility across browsers still needs broader acceptance testing. Password reset and email verification delivery are not configured; Google is the primary login.
