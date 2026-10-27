# 合并到现有线上项目

目标：Vercel `oprom0004s-projects/wan30ai-com`，域名 `wanai30.com`，GitHub `oprom0004/wan30ai.com` 的 `main` 分支。

## 发布内容

- 合并本地 WanAI 的 Google 优先登录、视频生成、参考视频、我的视频、账户与积分、套餐、订阅和管理功能，保留线上项目原有工作流文件。
- Next.js 与关联包更新至 16.3.6，React / React DOM 更新至 19.2.8。依据 [Next.js 官方安全版本说明](https://nextjs.org/blog/nextjs-security-update-september-22-2026)。
- 大于 3 MiB 的生成器输入使用分片上传，每个请求不超过 3 MiB，避免 Vercel 的 4.5 MB 请求体限制。上传票据绑定用户、大小、类型、摘要与有效期；服务端合并后再次验证文件、图片或视频内容。依据 [平台限制](https://vercel.com/docs/functions/limitations)。
- 临时分片保存在既有 R2 上传路径下的 `wan-upload-parts/`；成功后删除。需为该前缀配置一天到期的生命周期规则，清理用户中断的上传；不要给整个共享桶添加删除规则。
- Vercel 中关闭常驻视频计时器。新增受 `CRON_SECRET` 保护的 `/api/cron/wan-videos`，每次处理一个待恢复任务，复用数据库租约避免重叠处理。函数执行预算 300 秒。
- 当前 Hobby 只允许每天一次 Cron，配置的是每日兜底；前台查询仍负责及时更新。商业上线需合适的套餐和分钟级调度，不能把每日兜底当作完整的后台处理能力。

## 配置与发布边界

- 独立发布工作目录：`.test/release`，分支 `release/wanai-integration-20260927`。
- 该分支暂时禁止 Vercel 自动部署，原因是现有 Preview 与 Production 共用数据库条目；`main` 的自动部署保持启用。准备好独立预览配置后可移除此分支限制。
- 本地已准备正式域名配置文件，密钥文件在被 Git 排除的 `.test/` 下。不得提交密钥或把文件内容写入文档。
- 用户已选择沿用当前已验证的 WanAI 数据库（独立的 `wanai30` 数据库）。原网站仅有前端；发现原环境变量不能证明存在旧业务数据，不执行推测的数据迁移。
- 若沿用当前 WanAI 库，Google、Kie、R2 和数据库连接凭据需要保存到目标 Vercel 项目的 Production 环境；现有测试订单和测试账户会随数据库保留。
- 用户已明确授权把 WanAI 凭据保存到 Vercel Production。已保存并在列表验证 18 个服务配置：Google 的三个字段、Kie 密钥、Wan 提供商、七个 R2 字段、AUTH_URL、worker 开关、三个支付开关和 CRON_SECRET。均为 Secret、仅 Production。
- 原六个数据库变量已保留为仅 Preview；新增九个数据库配置为仅 Production，连接当前 WanAI 数据库，未删除原配置。AUTH_SECRET 和四个 NEXT_PUBLIC 条目保持原样。Vercel 拒绝编辑带公开前缀的旧 Secret，已取消该表单，未删除这些条目。
- NEXT_PUBLIC_SITE_URL 未新增，代码默认值已是 `https://wanai30.com`；上线后仍需核对既有应用地址对支付回站和页面链接的影响。
- Stripe 正式密钥和 Webhook 尚未完成；准备的生产配置关闭支付入口，避免将测试收款开放给正式访客。

## 验证

- Next.js 16.3.6 正式构建与 TypeScript 已通过。
- 使用当前 WanAI 数据库在独立本地生产进程验证：首页、价格、生成、登录、站点地图、套餐目录、能力接口均返回 200；新套餐与 Google 入口存在。
- 未认证的视频恢复接口和分片上传接口均返回 401。
- ESLint：0 errors；仍有既有警告，详见本地日志。
- 完整测试：364 个测试通过；年付积分测试所在 Windows 子进程退出时出现原生异常，退出码 `3221225477`，因此整轮命令报告 1 个进程失败。该文件随后单独复跑，19 项通过且进程正常退出。不能将首轮记录写成全绿。
- 原始日志保留在本地 `.test/release-tests.log` 与 `.test/release-annual-recheck.log`，不提交日志及密钥。
- 合并请求：[PR #1](https://github.com/oprom0004/wan30ai.com/pull/1)，已合并；正式提交 `76ec2cc26174a001de93afea4994dd69e2f6e404`，Vercel 已构建成功并绑定正式域名。
- 发布资源改用普通 Git 文件，避免新增 Git LFS 拉取配置成为图片或视频上线的依赖。
- 保留原 Docker 工作流；Docker 构建阶段设置 `STANDALONE=true`，与运行镜像复制 `.next/standalone` 的要求一致。提交 `4109abab1d3f2e6bdb7b23af01a95c6fe24023ce` 的 [远端 Docker 构建](https://github.com/oprom0004/wan30ai.com/actions/runs/36316515564) 已通过；PR 无合并冲突。

## 回退

原正式部署提交为 `16dbe18cae813550dc28c3fe931497b7cb6f79c9`。若新版验收失败，使用 Vercel 原部署回退；旧数据库不删除。切换数据库后的新数据需要单独保留，不能通过删除新库回退。

## 本次正式发布

- 部署：[7WMB8UayK](https://vercel.com/oprom0004s-projects/wan30ai-com/7WMB8UayK5fBtEtJ5rU88RdQ81tL)。
- 当前阶段：Ready，正式域名 `https://wanai30.com` 已绑定；Vercel 构建耗时 3m31s。
- 正式验收：首页、价格、生成、登录、站点地图及套餐/能力/公开配置接口均成功。套餐 revision 与当前 WanAI 数据库一致，Starter 月付 $19.90 / 1000 积分；Standard / Prime 与参考视频能力均启用。
- Stripe / Creem / PayPal 正式开关均为 false；未认证 Cron 与分片上传返回 401。
- Google OAuth 服务端返回正确 accounts.google.com 授权地址和正式 callback。通过 `/auth-popup?provider=google` 验证 Google 账号选择、授权回站成功；正式 My Videos 显示 Vincent Lai、1328 积分、6 个视频。
- 六个视频 DOM 均 readyState=4、error=null，分辨率 854x480，时长与原记录一致。未触发新付费生成。
- 内置浏览器中主登录按钮弹窗未持续显示；单独打开 auth-popup 完成验证。普通浏览器按钮弹窗体验仍需复核，不能将此记为按钮全流程验收完成。
- 尚待：Stripe 正式配置、分钟级视频恢复调度、R2 临时分片一天生命周期、Vercel 上大文件上传完整实测。
