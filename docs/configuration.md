# WanAI 配置说明

当前上线状态与正式收款待办见 [上线清单](launch-checklist.md)。`wanai30.com` 原站已上线；Stripe 已于 2026-09-27 完成本地测试接入，本轮尚未配置生产收款，线上现有配置需另行核对。下文的初始价格不代表目前后台已批准的套餐价格。

本文件随 lite 功能合并到 wanai30.com，描述当前代码支持的配置。站点域名为 `wanai30.com`，文件存储使用 Cloudflare R2，保留 Studio 的全部 AI 供应商配置入口，注册默认不赠送积分。原站的环境文件和数据库未被 lite 覆盖。

## 数据库

本地已切换到 Neon 的 WanAI 独立数据库（2026-09-27），详情及回退办法见 [迁移记录](research/neon-migration-2026-09-27.md)。数据库脚本优先读取 `.env.local`。

## 存储：后台 → 设置 → 存储

项目只启用 R2。历史 OSS / S3 配置即使还在数据库，也不会被加载成存储服务；不删除旧数据，不迁移历史文件。

- Account ID：Cloudflare 的 32 位账户 ID；填完整 S3 Endpoint 时可留空。
- Access Key ID / Secret Access Key：R2 S3 API 访问密钥，不是 Cloudflare 管理 API Token。按需填写，不提供默认密钥。
- Bucket Name：实际存储桶名称。
- Upload Path：默认 `uploads`。
- S3 API Endpoint：默认由账户 ID 推导为 `https://<account-id>.r2.cloudflarestorage.com`；特殊管辖区可填完整端点。不包含存储桶名。
- Public Domain：该桶实际绑定的 HTTPS 公开访问域名，例如 `https://media.wanai30.com`。这只是示例，不代表已创建 DNS 或绑定。也可填已开启的 `r2.dev` 地址；生产推荐自定义域名。

上传采用 S3 签名、region `auto`。图片和生成结果返回公开访问域名，不会把私有 S3 地址当成播放地址。未填完整时生成/上传显示未配置，不回退到 OSS。

参考：[R2 S3 API](https://developers.cloudflare.com/r2/api/s3/api/)、[R2 公开访问](https://developers.cloudflare.com/r2/buckets/public-buckets/)。

## AI：后台 → 设置 → AI

| 配置组       | 密钥      | 默认接口地址 / 协议                                            |
| ------------ | --------- | -------------------------------------------------------------- |
| Wan 视频接口 | API Key   | `https://api.polariscore.ai`；可改为同协议兼容网关             |
| OpenRouter   | API Key   | `https://openrouter.ai/api/v1`；OpenAI 兼容聊天接口            |
| Replicate    | API Token | `https://api.replicate.com/v1`；Replicate API                  |
| Fal          | API Key   | `https://queue.fal.run`；Fal 队列 API                          |
| Gemini       | API Key   | `https://generativelanguage.googleapis.com/v1beta`；Gemini API |
| Kie          | API Key   | `https://api.kie.ai/api/v1`；Kie API                           |

Base URL 会传给实际请求，不仅是保存到后台。每个供应商仍使用自己的适配器；填写另一家密钥不会自动把请求转换成另一套协议。OpenRouter 用于聊天，其余独立适配器由项目原有通用 AI 接口使用；Wan 2.x 生成器使用 Wan 视频接口配置；Wan 3.0 可用 `WAN30_PROVIDER=kie` 选择 Kie，具体见 [Kie Wan 3.0 配置](kie-wan30-setup.md)。

### Wan 生成器

- 使用 Polaris 或同协议网关时，Wan 2.x 提交/查询使用 `/v1/videos`，Wan 3.0 提交使用 `/api/v1/services/aigc/video-generation/video-synthesis`，查询使用 `/api/v1/tasks/{id}`。
- Base URL 支持域名、网关前缀或以 `/v1`、`/api/v1` 结尾的地址；尾部版本段会规范化，避免重复拼接。
- 各版本/模式的 Model ID 可填写供应商模型别名；产品版本、参数限制和积分报价仍由站点控制。留空模型 ID 表示禁用对应能力。
- “检查模型”访问保存的接口地址 `/v1/models`。供应商不支持这个接口时，可手动填写模型 ID；检查按钮不会生成视频或扣费。
- 非默认结果 CDN 需在 Video Download Hosts 中填写精确主机名，支持逗号/换行，不支持通配符。下载禁止重定向，继续验证视频格式和大小。仅添加你信任的供应商公开 CDN 域名。
- 已提交任务记录模型映射和接口地址；修改模型映射不改变在途任务。切换接口地址后，旧任务暂缓查询，恢复原地址后可继续；不会重新提交或重复扣费。
- 生成器采用一次“生成视频”操作，后台完成报价、上传和提交，不再弹出费用确认框。服务器仍校验实际积分与报价版本；积分不足会进入当前语言的定价页。状态不明时仅恢复查询原任务，不自动重复提交。
- 为兼容现有数据库、任务记录和环境变量，Wan 字段内部仍保留 `polaris_*` 名称，这不再限制接口必须使用 Polaris。Webhook Secret 是保留字段，当前 Wan 流程通过轮询恢复任务，不启用回调。

密钥全部为服务端配置，后台默认遮罩且不回填已保存明文；留空保存保留原值，显式清除才删除。可通过大写同名环境变量覆盖，非空环境变量优先，通常直接用后台填写即可。

## 域名

`NEXT_PUBLIC_SITE_URL` 默认 `https://wanai30.com`，用于 canonical、Open Graph、JSON-LD、robots 和 sitemap。它独立于本地 `NEXT_PUBLIC_APP_URL=http://localhost:3000`，不会把开发地址写进公开 SEO 信息。

实际生产运行时，应用访问地址 `NEXT_PUBLIC_APP_URL` 和认证地址 `AUTH_URL` 应使用 `https://wanai30.com`。本次不修改 DNS、不连接外部账户、不发布部署，也不代填真实密钥。

## Google 授权登录：后台 → 设置 → 认证

入口 `/zh/admin/settings/auth`。项目复用 Better Auth 的 Google OAuth 流程，登录、注册与登录弹窗共享 Google 按钮；邮箱登录独立保留。不需要 Gemini API Key，也不需要新增数据库表。

1. 在 [Google Cloud 控制台](https://console.cloud.google.com/) 配置 OAuth 同意屏幕，并创建类型为 **Web 应用** 的 OAuth 客户端。
2. 配置所用环境的授权重定向 URI，必须完全匹配：
   - 本地：`http://localhost:3000/api/auth/callback/google`
   - 生产：`https://wanai30.com/api/auth/callback/google`
   - 不添加语言前缀 `/zh` 或末尾斜杠。项目中的 `/auth-callback` 是弹窗完成页，不是填给 Google 的重定向 URI。
3. 将配套的 **Client ID** 和 **Client Secret** 填入后台 Google 认证配置，开启“启用 Google 登录”并保存。Google 按钮作为首选入口显示；两项凭据缺一或开关关闭时，点击后提示不可用。
4. Google One Tap 为可选功能，普通按钮授权不需要开启。若使用 One Tap，还需配置对应 JavaScript 来源 `http://localhost:3000` / `https://wanai30.com`。
5. 本地和生产数据库相互独立，需分别保存凭据；建议使用不同的 OAuth 客户端。生产的 `AUTH_URL` 与 `NEXT_PUBLIC_APP_URL` 应为 `https://wanai30.com`。

密钥只供服务器使用，不在后台回填明文，也不包含在公开配置中。留空保存保留原密钥，显式清除后才删除。非空的 `GOOGLE_AUTH_ENABLED`、`GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET` 等环境变量优先于数据库配置；采用后台管理时避免同时设置冲突的环境变量。

尚未提供真实 Google 凭据，因此没有启用或完成真实 Google 账户授权验收。配置完成后，用无痕窗口访问登录页，点击 Google 按钮，完成授权并检查回站登录状态；本地、生产应分别验收。出现 `redirect_uri_mismatch` 时优先核对协议、域名、端口和回调路径。

参考：[Better Auth Google 登录](https://better-auth.com/docs/authentication/google)、[Google Web OAuth 配置](https://developers.google.com/identity/protocols/oauth2/web-server)。

## 支付更新（2026-09-26）

后台 → 设置 → 支付保留 Stripe 开关、密钥、Webhook Signing Secret、可选 Connect Account ID。服务端目录现在包含三档月付、三档年付、三档永久积分包。价格由目录决定，浏览器不能覆盖金额或积分。

原有三个 Monthly Price ID 配置继续保留，改为可选：留空使用目录动态价格；只有月付售价等于原始 USD 15.90、45.90、95.90 时才使用相应的已填 Price ID，并在创建付款前核对金额、货币和周期。超级管理员更改月付售价后自动使用动态价格，不复用旧 Price ID，也不修改 Stripe 上的历史 Price。年付与积分包始终使用服务端动态价格。

以下为初始默认值，保存后台定价后以后台值为准：

| 模式             | Starter                  | Creator                   | Pro                        |
| ---------------- | ------------------------ | ------------------------- | -------------------------- |
| 月付             | $15.90 / 800 积分        | $45.90 / 2400 积分        | $95.90 / 5200 积分         |
| 年付             | $172 / 年，每月 800 积分 | $495 / 年，每月 2400 积分 | $1036 / 年，每月 5200 积分 |
| 一次性永久积分包 | $19.90 / 800 积分        | $54.90 / 2400 积分        | $109.90 / 5200 积分        |

### 超级管理员：后台 → 设置 → 定价与积分

入口 `/admin/settings/pricing`（中文 `/zh/admin/settings/pricing`），仅有效 `super_admin` 角色可访问并保存；普通管理员即便拥有设置写权限，也不能经通用设置入口修改商品目录。

- 九个商品分别配置价格和积分。月付填写“每月价格＋每月积分”；年付填写“全年价格＋每月积分”；积分包填写“一次性价格＋永久积分”。不会自动把年付积分乘以 12 一次发放。
- 统一 USD。价格最多两位小数，范围 $0.01–$999,999.99；积分为 1–1,000,000,000 的正整数。支付供应商仍可能拒绝低于其最低收款额度的金额。
- 全部商品作为一份配置原子保存；并发修改出现冲突时需明确重新载入最新配置再编辑，不会覆盖另一个管理员的修改。保存响应丢失时先重读核对，不盲目重试。
- 保存后，首页、定价页、公开结构化数据及新结账读取同一份最新目录。买家留在旧页面时，新购买会要求刷新报价，再自行点击购买；刷新不会触发支付。
- 只影响新购买。已经创建的订单、未完成的原结账、既有订阅续费，以及年付每月发放继续使用购买时快照，不追溯改价、改额度。要改变已有订阅需另行明确制定迁移策略，本次不做。
- 商品 ID、计费周期与有效期策略固定。商品 ID 中历史数字不再代表当前积分，实际以配置及订单快照为准。年付折扣仅在同档月付与年付的每月积分相等且确有节省时显示。
- 目录储存在现有 `config` 表的 `wan_pricing_catalog`，无需结构迁移；公开接口仅返回商品及版本，不暴露任何密钥。数据库故障或目录损坏时停止报价，不静默按旧默认金额售卖。

年付不是一次到账全年积分：每个 UTC 服务月发放当月额度；未使用的订阅积分按服务月到期。永久积分包不自动续费、不过期。消费优先使用临期积分。取消续费不撤销已付服务期；全额退款撤销剩余和未来权益，部分退款进入人工审查。

Stripe SDK 固定 API 版本 `2025-08-27.basil`。Webhook 需要相同版本的 snapshot 事件：`checkout.session.completed`、`checkout.session.async_payment_succeeded`、`checkout.session.async_payment_failed`、`invoice.paid`/`invoice.payment_succeeded`、`customer.subscription.updated`、`customer.subscription.deleted`、`refund.created`、`refund.updated`。签名、环境、Connect 账户和 `wanai_app=wanai30-lite` 都会校验；结账和发票统一按 PaymentIntent 去重，并兼容旧订单的发票退款关联。

账户账单入口使用独立 Stripe Billing Portal 配置：metadata `wanai_app=wanai30-lite`，启用 invoice_history/payment_method_update，禁用 subscription_update/subscription_cancel/customer_update，且不是默认配置。取消续费通过站内已鉴权入口执行。不自动修改共享客户或共享 Portal 配置，旧共享客户需人工核对后处理。

当前九商品不支持试用、优惠码、自动税率、调整/拆分付款或中途升降级。请保持 Promotion Codes 关闭；不满足条件时系统拒绝结账/权益发放，不会静默按错误金额入账。结账中断请用页面的“继续原结账”或重试恢复；未知结果超过 23 小时需要核对，不会自动新建一笔扣费。

本次合并不需要数据库结构迁移。年付积分按访问结算；视频恢复另有 Node 进程内调度，需要持续运行的服务进程。Cloudflare D1 不支持当前业务所需的事务，不能直接用于该流程。仅完成本地模拟验证，未配置真实 Stripe/R2/AI 密钥，未部署。参考 [Stripe Checkout](https://docs.stripe.com/api/checkout/sessions/create)、[Invoice Payments](https://docs.stripe.com/api/invoice-payment/list)。
