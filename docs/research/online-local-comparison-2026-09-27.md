# 线上与本地版本核对

检查日期：2026-09-27。

## 结论

`wanai30.com` 已上线，但公开访问到的线上版本尚未包含本地合并后的完整功能。应更新现有部署；不需要重新购买域名或重建站点。

## 实际差异

| 项目 | 线上检查结果 | 本地版本 |
| --- | --- | --- |
| 首页 | HTTP 200，WanAI 品牌首页 | WanAI 首页，接入账户与商品目录 |
| `/pricing` | HTTP 200；显示 ShipAny Pricing 和 Get ShipAny，月付 $89 / $169 / $249，100 / 200 / 300 积分 | 已批准的月付 $19.90 / $46.80 / $94.80，1000 / 2400 / 5000 积分，另有年付和永久积分包 |
| `/sign-in` | 浏览器加载后仍只有邮箱、密码和 Sign Up | Google 为首选入口，邮箱入口可展开 |
| `/my-videos` | HTTP 404 | 路由存在，未登录访问会转到登录页 |
| `/api/payment/catalog` | HTTP 404 | HTTP 200，返回已批准的九个商品和目录版本 |
| `/api/ai/wan/capabilities` | HTTP 404 | HTTP 200，返回当前模型档位和分辨率能力 |
| `/wan-3` | HTTP 200，旧版生成器界面 | 新版账户、报价、Kie 生成和参考视频功能 |

没有点击线上生成或付款按钮，未产生真实生成任务或扣款。新接口返回 404 说明本地新增路由未在该公开部署上提供；不能据此断言线上所有旧接口都不可用。

## 部署来源证据与未确认项

- 线上响应包含 `x-vercel-id`、`x-vercel-cache` 和 `Server: cloudflare`，表明请求经过 Cloudflare，并带有 Vercel 部署标记。
- 当前本地目录 `I:\jp\code\wanai30.com` 没有 `.git` 和 `.vercel/project.json`；用户登录后，已从 Vercel 控制台确认以下部署来源。
- 项目：[oprom0004s-projects / wan30ai-com](https://vercel.com/oprom0004s-projects/wan30ai-com)，域名 `wanai30.com`，别名 `wan30ai-com-lake.vercel.app`。
- 连接的私有 GitHub 仓库为 `oprom0004/wan30ai.com`，正式分支 `main`。推送到此分支会触发正式部署。
- 当前正式部署 Ready，控制台日期 9 月 15 日，提交 `16dbe18cae813550dc28c3fe931497b7cb6f79c9`，提交说明为 `fix: use production domain for SEO metadata when URL env is blank`。
- 已只读克隆线上源码至 `.test/production-baseline`。在源码、静态资源、内容、脚本、文档和非敏感根文件范围内，忽略换行差异后，本地新增 264 个、修改 139 个、缺少 1 个文件。缺少的静态 `public/sitemap.xml` 在本地已有 `src/app/sitemap.ts` 对应动态实现；发布时应验证 `/sitemap.xml`。清单为 `.test/production-source-diff.json`。远端 `.github` 等工作流文件不在该同步范围内，应保留。
- 线上环境变量、数据库连接、Stripe 模式以及与本地是否共用数据库尚未确认。公开页面不能回答这些问题。

### Vercel 配置检查

- 框架 Next.js，根目录为空（仓库根目录），项目 Node.js 版本为 24.x。
- 当前正式部署覆盖的构建命令为 `pnpm build`，安装命令为 `pnpm install --frozen-lockfile`，与本地 `vercel.json` 一致。
- Cron Jobs 功能开关开启，但没有已配置的任务，页面仍显示入门示例。
- 项目有 11 个环境变量，均标记为 Secret，同时作用于 Production 和 Preview：`NEXT_PUBLIC_APP_URL`、`NEXT_PUBLIC_APP_NAME`、`NEXT_PUBLIC_THEME`、`NEXT_PUBLIC_APPEARANCE`、`DATABASE_PROVIDER`、`DATABASE_URL`、`DB_SCHEMA_FILE`、`DB_MIGRATIONS_OUT`、`DB_SINGLETON_ENABLED`、`DB_MAX_CONNECTIONS`、`AUTH_SECRET`。
- 没有关联 Shared Variables。没有直接看到 Google、Kie、R2、Stripe 的环境变量名称，但这些也可能保存在应用数据库内，不能据此断言未配置。
- 控制台明确显示已保存的 Secret 只写不可读取。本轮没有读取或改写这些值，尚不能确认数据库种类、连接目标或是否与本地共用。
- 生产和预览使用相同的 `DATABASE_URL` 条目；部署预览前需提供独立的预览配置，避免测试写入现有生产库。
- 团队当前为 Hobby。Vercel 官方说明该套餐只供个人非商业用途；订阅收费站应先选择合适的商业托管方案。参见 [Hobby 说明](https://vercel.com/docs/plans/hobby)。
- Hobby Cron 最多每天一次，Pro 可每分钟一次。因此不能用当前套餐的 Cron 直接实现分钟级视频恢复。参见 [Cron 限制](https://vercel.com/docs/cron-jobs/usage-and-pricing)。

本轮未推送代码、部署预览或正式版本、修改 Vercel 配置、升级套餐或产生付费操作。

## 发布前发现的问题

1. 本地开发服务在并发请求首页和价格页时出现间歇性 HTTP 500。日志指向 `WanHeader` 的 `useTranslations` 缺少 `NextIntlClientProvider` 上下文。顺序请求恢复 200，但后续并发请求再次复现。尚未确认生产运行是否受影响，不应写成已修复。
2. 视频恢复任务依赖 `src/instrumentation.ts` 启动的进程内计时器，`wan-video-worker.ts` 约每 20 秒执行一次。现有 `vercel.json` 的 `crons` 为空。发布到现有 Vercel 环境前，需要验证并适配任务在请求结束后的处理与恢复。
3. 年付积分通过读取余额和扣积分时触发结算，不能简单认定“缺少定时任务就不会发年付积分”。仍需验收跨月行为。
4. 本地支付配置为测试模式；不能直接把测试配置作为正式收款配置发布。

## 本轮已做的发布准备

- 补齐 `.vercelignore` 对 `.env*`、`.dev.vars*` 的排除，保留 `.env.example`。
- 补齐 `.dockerignore` 对本地环境密钥、测试产物和数据库文件的排除。
- 在 `.gitignore` 增加 `.dev.vars*`，避免后续建立 Git 仓库时误提交本地凭据。
- 未改变线上网站、DNS、生产数据库或 Stripe 正式配置。

本轮尝试重启本地开发服务时被自动审批策略拒绝，操作未执行。使用生产构建和独立运行检查继续诊断；具体结果以本文后续补充为准。

### 生产构建与运行检查结果

- `pnpm build` 已成功完成，包括 TypeScript 和页面生成。日志：`.test/predeploy-audit-build.log`。
- 在独立端口 3001 启动正式构建，关闭该检查进程的视频恢复 worker，避免重复后台处理。
- 两轮同时请求 `/`、`/pricing`、`/wan-3`、`/sign-in`，共 8 次请求全部返回 200；Google 入口和新套餐内容存在，没有出现翻译上下文报错。
- 检查服务结束后已自行退出，原开发服务未重启。结果：`.test/production-pages-audit.json`。
- 这次没有在生产构建中复现开发服务的间歇性 500，但不能把开发问题记为已修复；也不代表 Vercel 预览部署已验收。

## 下一步

1. 部署来源已确认；接下来确认生产数据库目标，并准备独立预览数据库和测试支付配置。
2. 为 Vercel 补齐可靠的视频后台任务处理，确认商业托管套餐；升级套餐本身不能替代代码适配。
3. 使用独立分支准备预览发布，保留远端工作流，验证数据库迁移、已批准的价格目录、Google 登录、视频和支付回站流程。正式构建已通过，本地开发并发渲染问题仍单独追踪。
4. 预览验收后更新正式站，再配置、验收 Stripe 正式收款。

本地原始检查记录：`.test/online-local-audit-20260927.json`。它保留首次并发请求中的 500；后续顺序请求曾恢复 200，不应只选取成功结果。
