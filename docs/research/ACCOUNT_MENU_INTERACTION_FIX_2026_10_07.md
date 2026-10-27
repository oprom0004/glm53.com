# Account menu interaction fix — 2026-10-07

- aihotellobbyvideo.com: added 180 ms mouse-exit dismissal to the existing account menu wrapper. Reentry cancels dismissal; touch does not trigger it. Existing outside-click and Escape remain. Credit and sign-out actions close the menu. No CSS change.
- TypeScript and production OpenNext build passed. Published Cloudflare version: dd9a0d20-988a-4d9e-973f-36d644250675.
- Rendered actual Header and WanAccountMenu with fixture account contexts; mouse exit, reentry, touch, Escape and outside click passed. Wan trigger-to-portal transit also passed. Script: .local/menu-verification/check.mjs (no real payment or generation).
- Live signed-in Hotel account menu opens and Escape closes. Screenshot: account-menu-updated-2026-10-07.png.
- WanAI source change is in the separate release checkout and synchronized to the main local source; PR https://github.com/oprom0004/wan30ai.com/pull/8. Vercel preview passed. Main merge: 852c463f940a02ee75b59a383c51a6d357971642. Production verification follows.
- aizombiegenerator.com current production navigates directly to account; no dropdown changed. Old video-i18n runtime is not the production homepage runtime.
- hotellobbyvideoai.com skipped because the owner selected that it is not their site.

Production completed: Vercel CGfR4SuQZhiXWHGa4UYDuxw9Dx3q, Ready, 2026-10-07 15:20:31 Asia/Shanghai. wanai30.com returns 200 and serves updated account-menu code in /_next/static/immutable/chunks/09tvs-809w60m.js. Screenshot for Wan is an authenticated local fixture with preview@example.invalid, not a real signed-in production account. Screenshot for Hotel is the live signed-in account menu. No payment, credit alteration, generation or permissions changes performed.
