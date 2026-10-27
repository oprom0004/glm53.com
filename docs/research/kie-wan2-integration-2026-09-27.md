# Wan 2.x integration through Kie

Date: 2026-09-27.

## Scope

The selected Wan provider now applies to versions 2.5, 2.6, 2.7 and 3.0. The stored setting remains `wan30_provider` for compatibility; the admin label describes all versions. Existing task snapshots retain their original provider, endpoint and model, so changing the setting does not reroute previously submitted jobs.

Kie uses the existing server-side KIE_API_KEY, with six official model IDs: `wan/2-5-text-to-video`, `wan/2-5-image-to-video`, `wan/2-6-text-to-video`, `wan/2-6-image-to-video`, `wan/2-7-text-to-video`, `wan/2-7-image-to-video`. All use createTask and recordInfo. Wan 3.0's existing adapter fields and reference workflow are preserved.

| Version | Durations | Resolution | Prompt limit | Image field |
| --- | --- | --- | ---: | --- |
| 2.5 | 5 or 10 seconds | 720p / 1080p | 800 | image_url |
| 2.6 | 5, 10 or 15 seconds | 720p / 1080p | 5000 | image_urls, one item |
| 2.7 | 2–15 whole seconds | 720p / 1080p | 5000 | first_frame_url |

Text-to-video aspect ratios use aspect_ratio for 2.5 and ratio for 2.7. The 2.6 API has no corresponding input. Image mode follows its source image. 2.5 and 2.6 durations are strings; 2.7 durations are integers. Unsupported options fail before credits are consumed. The UI follows capability duration steps, prompt limits and aspect ratios. Wan 2.x reference/video-edit/continuation modes are outside this change.

## Pricing

Keep existing 720p/1080p prices for 2.6 and 2.7, and 720p prices for 2.5. Existing production rates use the approved scaled credit unit: 100/7 credits per second at 720p, 160/7 at 1080p. The formerly unavailable 2.5 1080p option uses the same 160/7 rate after its explicit pricing configuration is saved. This is 72 credits for 5 seconds at 720p and 115 at 1080p, rounded once per task. Explicit blank rates still disable an option. Subscription and pack prices are unchanged.

## Validation

- Provider/quote/readiness tests: 19 passed.
- Generator UI, lineup, existing Polaris adapter and persisted task workflow: 32 passed.
- Six-mode workflow fixtures verify exact model snapshots, completion and a single debit across replay/recovery and configuration changes.
- Paid provider tests require the owner's response to the requested $5 maximum budget; no paid calls were made during implementation.
- Production build, release and live results are recorded in the root project's copy of this document after deployment.

## Sources

Official Kie OpenAPI specifications were retrieved as Markdown on this date:

- https://docs.kie.ai/market/wan/2-5-text-to-video.md
- https://docs.kie.ai/market/wan/2-5-image-to-video.md
- https://docs.kie.ai/market/wan/2-6-text-to-video.md
- https://docs.kie.ai/market/wan/2-6-image-to-video.md
- https://docs.kie.ai/market/wan/2-7-text-to-video.md
- https://docs.kie.ai/market/wan/2-7-image-to-video.md

## Production result

- PR #3 merged as 52bbb567872cb8d8dd94427053fd6dc4d33c14a0: https://github.com/oprom0004/wan30ai.com/pull/3
- Vercel production reached Ready on 2026-09-27 at 13:47:43 UTC: https://vercel.com/oprom0004s-projects/wan30ai-com/6mZxpD1QyXFBwHMtfxi1nFFFvBJT
- All six Wan 2.x text/image capability endpoints returned 200, with 720P/1080P enabled and 480P disabled. Duration steps and prompt limits matched the documented model contract. Wan 3.0 text/image capabilities remain enabled.
- All four version routes returned 200. Browser verified Wan 2.5 text/image switching, 1080P selection, and authenticated 5-second 1080P quote of 115 credits with an enabled Generate button. No generation was submitted; account balance remained 1328 credits.
- Final code passed TypeScript, local production build and GitHub Docker build after correcting a missing localized prompt-length message. The UI/copy tests were rerun successfully after that correction.
- The two Wan 2.5 1080P pricing fields were saved through the existing admin pricing service with its revision and role checks. Re-read verified 160/7 for both and no changes to other rates.
- This is an integration/configuration/quote verification. Real provider generation tests remain pending the owner's $5 budget response; no Kie balance was spent in this turn.
