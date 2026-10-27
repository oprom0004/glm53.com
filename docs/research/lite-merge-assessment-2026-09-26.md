# wanai30.com 与 lite：功能和合并调查

日期：2026-09-26。范围：本地源码、项目文档、依赖、路由、数据库结构与少量自动化检查。没有修改业务代码、配置或数据库，没有执行合并或部署。

## 1. 结论

两个项目使用同一套 Next.js / ShipAny 风格 SaaS 基础。当前 wanai30.com 偏向品牌展示和基础框架；lite 在这个基础上补充了可调用外部接口的视频生成流程，以及商品、支付、积分、账户和管理功能。

从文件比较看，lite 是主站的较大功能增量：`src / scripts / content` 中，主站 468 个文件、lite 615 个文件；356 个相同、147 个新增、112 个修改，没有删除。这里只能证明当前文件相似性，不能证明 Git 分支关系，因为两个目录都没有 Git 元数据。

建议以 wanai30.com 为目标，按完整业务模块迁入 lite 的实现。优先保留主站身份、运行配置和数据，对支付接口、赠送策略、存储限制、全局样式和运行环境单独处理。仅替换生成器组件无法完成合并。

## 2. 已确认的项目位置

- 主站：`I:/jp/code/wanai30.com`
- lite：`E:/wechat-files/xwechat_files/mehelpme_92cf/msg/file/2026-09/wanai30-lite_1/wanai30-lite_1`

用户最初提供的路径与实际目录存在下划线和分隔符差异，已定位到包含 package.json 的内层项目。外层 `__MACOSX` 是压缩包附带的资源目录，不参与比较。

## 3. 共同基础与现状

| 项目 | 调查结果 |
| --- | --- |
| 前端 | Next.js 16.0.7、React 19.2.1、TypeScript、Tailwind CSS 4、Radix/shadcn 风格组件 |
| 路由与语言 | App Router，`[locale]`，英文默认无前缀、中文 `/zh`，next-intl |
| 登录 | Better Auth，邮箱、Google/GitHub OAuth、可选 One Tap |
| 数据 | Drizzle ORM；均导出 SQLite schema，本地环境均使用 SQLite |
| 通用能力 | 用户、RBAC、后台、文章、文档、聊天、通用图像/视频/音乐生成、订单、订阅、积分 |
| 扩展组织 | `extensions` 对接供应商；`shared/services` 编排业务；`shared/models` 操作数据库 |
| 数据库表定义 | 两边 SQLite/MySQL/PostgreSQL schema 文件内容一致，共用现有实体 |
| 本地静态资源 | 主站 75 个，lite 74 个；同路径文件字节相同，lite 少了 `public/sitemap.xml`，改用动态 sitemap |
| 依赖安装 | 主站有 node_modules；lite 压缩包没有 node_modules |

lite 新增的依赖主要是三个本地字体包、ali-oss、proxy-agent，以及 jsdom 和相关类型。核心框架版本没有变化。虽然当前服务只启用 R2，OSS 文件仍由 storage/index.ts 导出；精简依赖前必须检查导出与加载关系。

### 本地数据库：只读检查

| 数据 | 主站 | lite |
| --- | ---: | ---: |
| 用户 | 0 | 1 |
| 订单 / 订阅 / 积分 / AI 任务 | 均为 0 | 均为 0 |
| config 记录 | 0 | 0 |
| 角色 / 用户角色关联 | 0 / 0 | 4 / 1 |

未输出任何用户身份或密钥。这里仅描述随项目提供的本地数据库，不能代表线上数据。主站 `.env` 的应用地址是正式域名，lite 是 localhost；两边都有非空认证 secret，不能直接覆盖环境文件。

## 4. 功能对照

| 模块 | wanai30.com 当前实现 | lite 增量 |
| --- | --- | --- |
| 首页 | Wan 品牌展示、版本介绍、特性、比较、场景、FAQ | 补充中英文本、登录/积分入口、商品定价、结构化数据、媒体加载控制 |
| `/wan-3` | setInterval 模拟进度，播放固定演示视频；图片仅生成浏览器对象 URL | 实际报价、图片上传、提交、轮询、结果保存、下载与恢复 |
| Wan 版本页 | 仅 `/wan-3` 独立实现 | 新增 `/wan-2-5`、`/wan-2-6`、`/wan-2-7`，共用生成器 |
| 通用 AI | `/api/ai/generate` 与 `/query`；固定场景积分 | 保留旧链路；另增独立 Wan API 和服务，不能混用 |
| 商品 | 定价翻译 JSON 驱动，通用 product_id 和多渠道结账 | 三档月付、三档年付、三档永久积分包；服务端商品目录和版本校验 |
| 支付 | Stripe / PayPal / Creem 通用基础 | 新购买限定 Stripe；补充订单预占、恢复、事件去重、退款权益处理 |
| 积分 | 通用授予/消费及任务失败返还 | 并发处理加强、年付按月结算、永久包、退款撤销与审计 |
| 账户 | 原有账单、支付、积分等设置页面 | 账户概览、Wan 任务记录 `/settings/tasks`、订阅状态和购买方式说明 |
| 后台 | 通用设置、用户、权限和业务记录 | 模型检查、供应商地址、密钥不回填、九商品配置、24 项视频费率 |
| 注册 | 创建用户后调用可配置的赠送积分函数 | 去除创建用户时的赠送调用，保留分配角色 |
| 存储 | R2 / S3 可配置 | 运行服务只加载 R2；视频输入与输出增加校验 |
| SEO | 现有 metadata、robots、静态 sitemap | 站点身份独立于本地访问地址，逐页双语 metadata、JSON-LD、动态 sitemap |

README 仍保留“模拟生成”介绍，已落后于 lite 实际源码；调查以源码和较新的专项文档为准。

## 5. 视频生成的完整调用链

```text
WanGenerator + useWanGeneration
  → GET /api/ai/wan/capabilities：读取已配置能力
  → POST /api/ai/wan/quote：服务端计算积分
  → POST /api/ai/wan/upload：图片进入 R2
  → POST /api/ai/wan/generate
      → 请求校验、重新计算费用、图片归属校验
      → 本地 ai_task 与扣积分在事务内写入
      → PolarisVideoProvider 提交外部任务
      → 保存供应商 taskId
  → POST /api/ai/wan/query 或后台 worker
      → 查询供应商状态
      → 成功后下载并转存 R2
      → 保存结果，返回公开视频 URL
      → 明确失败时尝试一次性返还原消费积分
```

### 版本与参数：这是项目配置范围，不代表供应商已实测支持

| 版本 | 模式 | 前端分辨率 | 时长 |
| --- | --- | --- | --- |
| 2.5 | 文生、图生 | 480P / 720P | 2–10 秒 |
| 2.6 / 2.7 | 文生、图生 | 480P / 720P / 1080P | 2–15 秒 |
| 3.0 | 文生、首尾帧图生、最多 10 张参考图 | 480P / 720P / 1080P，Standard / Prime | 2–30 秒 |

2.x 只允许 standard 和 adaptive 比例；3.0 提供六种比例选择。2.5 后台有 1080P 费率项，但默认禁用，而且生成器前端固定只列出两种分辨率；将来开启该规格时要同步前后端能力。

- Wan 2.x 使用 `/v1/videos` 协议；3.0 使用 `/api/v1/services/aigc/video-generation/video-synthesis` 提交、`/api/v1/tasks/{id}` 查询。
- 内部供应商名仍为 polaris，但支持自定义兼容接口地址和模型映射。填写其他服务商地址不等于自动适配其协议。
- 模型字段、API 密钥、R2、对应费率需要可用；capabilities 主要检查这些配置条件，没有自动进行真实模型能力探测。
- 默认计价：2.5 每秒 5/10 积分；2.6、2.7 为 5/10/16；3.0 Standard 为 3.5/7/14，Prime 为 5/10/20。顺序为 480P、720P、1080P。总额按整段视频向上取整。
- 图片支持 JPG/PNG/WebP，单文件最多 10 MB；结果转存最多 128 MB，并验证 MP4 文件头、来源主机和重定向。
- 本地任务 ID 由用户 ID 和 requestId 计算；重复请求返回原任务，参数不同则拒绝。供应商地址与模型映射保存进任务快照。
- 请求超时或提交结果未知时，不自动再次提交，也不直接退款，避免重复生成和重复扣费。
- 浏览器只按用户与版本保存任务 ID，不持久化提示词或图片；刷新可继续查询，换账号和卸载会取消旧界面的后续操作。
- 服务端任务状态包含 queued、processing、saving、storage_pending、query_error、submission_unknown 等阶段，界面不再伪造百分比。

关键限制：`submission_unknown` 会停止自动恢复，当前未看到完整的专用人工对账处理入口。已有供应商 ID 的任务可以继续查；缺失供应商 ID 的不确定提交仍需人工核查。不能把所有“恢复”理解为自动解决。

## 6. 支付、积分和定价

### 默认商品

| 模式 | Starter | Creator | Pro |
| --- | --- | --- | --- |
| 月付 | $15.90 / 800 积分 | $45.90 / 2400 积分 | $95.90 / 5200 积分 |
| 年付 | $172 / 年，每月 800 | $495 / 年，每月 2400 | $1036 / 年，每月 5200 |
| 永久积分包 | $19.90 / 800 | $54.90 / 2400 | $109.90 / 5200 |

这是源码默认目录，管理员保存后新购买使用后台值。

业务链路：WanPricing → `/api/payment/checkout` → wan-checkout → 预占本地订单 → Stripe Checkout → callback/webhook → 校验金额、归属和付款标识 → 订单/订阅/积分事务入账。

- 浏览器提交 productId、catalogRevision 等，不允许覆盖金额、积分或支付渠道。
- 年付保存年度权益凭据，按 UTC 服务月发放当前月积分。查询余额/流水和扣费前触发结算，不需要为每个用户建立按月定时任务，也不会补发已经过期月份。
- 有期限的积分优先消费，永久积分后消费。取消续费保留已付服务期。
- 明确全额退款会撤销未用及未来权益；部分退款或已消耗权益需要人工审核。此处是接收支付退款事件后的权益处理，不等于新增了站内发起退款功能。
- 价格修改只影响新购买，原订单和年付权益使用购买快照。
- 九商品目录存于 `config.wan_pricing_catalog`；24 项视频费率存于 `config.wan_pricing_video_rates`。使用版本检查防止管理员并发覆盖。
- 仅有效 super_admin 可以修改这些配置，普通设置写入入口也阻止绕过保留键。
- Stripe 的内部应用标识为 `wanai30-lite`。与元数据、回调归属和 Portal 识别关联，不能因为合并进主站就简单全局替换字符串。
- 新流程不支持优惠码、试用、自动税率、拆分付款或中途升降级；已有多渠道或促销业务需要额外兼容设计。

## 7. 数据和代码应该如何迁入

表结构相同使结构迁移成本较低，但很多业务状态存放于现有 JSON/text 字段：

| 现有实体 | lite 新用途 |
| --- | --- |
| ai_task.options | 请求、版本、规格、报价等输入 |
| ai_task.taskResult | 供应商映射、任务阶段、恢复租约、源地址及输出状态 |
| ai_task.taskInfo | 展示结果和安全错误信息 |
| credit.metadata / consumedDetail | 年度权益快照、消费来源、退款和返还审计 |
| order.checkoutInfo 等 | 创建结账时的金额、积分快照和恢复数据 |
| config | 商品目录、费率、供应商和存储配置 |

因此不应只复制组件，也不应仅因为 schema 相同就断言历史记录完全兼容。

建议按依赖顺序分组落地：

1. **建立可回退基线**：主站目前无 Git 元数据。实施前先保存项目和配置备份、建立版本基线；线上数据单独核实。
2. **基础模型与配置**：事务封装、credit/ai_task/order/subscription、配置读取和保留键规则、业务类型及商品策略。
3. **Wan 生成模块**：provider、contract、pricing、storage、service、worker、五个 API 与对应测试。
4. **支付与账户模块**：新目录、结账、回调/通知、退款权益、年付结算、账户概览与任务记录，整条链路一起迁入。
5. **生成器、公共页面和后台**：登录状态、版本页、定价卡、管理表单、翻译、导航、metadata、sitemap。
6. **目标环境验收**：安装依赖、全套测试、类型检查、构建，再进行测试环境中的真实登录、支付、生成、R2 和故障恢复联调。

这是后续实施建议，本轮未执行以上合并步骤。

## 8. 直接覆盖会遇到的具体冲突

| 冲突 | 已观察到的依据 | 合并处理 |
| --- | --- | --- |
| 旧结账请求不兼容 | 主站发送 product_id/payment_provider；lite handler 明确拒绝这些字段 | 替换所有实际购买入口，或明确保留独立兼容入口 |
| 通用定价组件残留 | lite 的 themes/default/blocks/pricing.tsx 仍使用旧请求协议 | 排查动态页/模板是否仍会渲染它，不能只测新定价页 |
| 通用任务查询不识别 Wan | getAIService 没注册 polaris；旧 activity 刷新仍走该 manager | Wan 任务统一走专用 query/recovery，修正旧入口的导航或分流 |
| 注册赠送行为改变 | lite 删除 auth 创建钩子中的 grantCreditsForNewUser | 按主站明确的赠送策略决定是否迁入此改变 |
| 存储能力收窄 | lite storage service 仅加载 R2 | 核实主站是否依赖 S3 或已有媒体地址，不能随代码切换配置 |
| sitemap 路径冲突 | 主站有 public/sitemap.xml，lite 新增 app/sitemap.ts | 两者不能照单叠加，明确采用动态版本并处理静态文件 |
| 全局视觉变化 | theme.css 字体改为 Noto Sans Mono Variable；新增认证色彩，global.css 改滚动条 | 功能合并时单独评估字体、布局与登录页视觉，避免无意改变主站 |
| 首页运行依赖变化 | lite 首页 force-dynamic 且直接读取 getWanCatalog | 数据库/目录损坏可能导致整个首页无法渲染；考虑营销内容与购买故障的显示边界 |
| Stripe 应用身份 | WANAI_PAYMENT_APP 固定为 wanai30-lite | 先核实既有客户/订单/Portal 归属，制定标识兼容方案 |
| 本地环境不可互拷 | 主站 app_url 为正式域名，lite 为 localhost；均含 auth secret | 保留目标环境，按配置清单补项，禁止覆盖 .env 和 data |

### 部署适配是功能前提

- worker 由 `src/instrumentation.ts` 在 Node runtime 启动，首次约 10 秒后执行，之后每轮结束再等待 20 秒。每次筛选前 50 个在途任务，最多处理其中 10 个到期任务。
- 该设计依赖进程持续运行。仓库虽然保留 Vercel 和 Cloudflare 命令，不代表自动恢复已适配短生命周期/serverless 环境；vercel.json 的 crons 为空。
- `paymentTransaction` 明确拒绝 D1，且 Wan 建任务也使用它。因此当前这套 Wan 生成与财务功能不能直接套用 D1 配置。
- 当前 schema 固定导出 SQLite；切换 PostgreSQL/MySQL 不能只改 DATABASE_PROVIDER。MySQL `.returning()` 使用兼容封装，一些“是否更新成功”的判断需要专项验证。
- Dockerfile 复制 `.next/standalone`，next.config 仅在 STANDALONE=true 时输出该目录；实际构建环境必须匹配。

### 仍需完善的运维体验

- 任务记录页主要展示状态和打开结果，没有完整的单任务人工恢复/对账工作台。
- 失败返还可能因原积分已撤销而被阻止，底层有审计信息，但任务记录界面仍统一写“积分已自动退回”；上线前应让文案与实际返还结果一致。
- 年付/永久积分和支付回调已有较强的本地事务逻辑，跨数据库、多实例和真实外部事件仍需要验证。

## 9. 验证证据与边界

本次实际执行：

- 规范化换行后的完整源码文件比较；静态资源字节哈希比较。
- 只读打开两个 local.db，核实表名、关键表行数和配置是否存在。
- 主站 `tsc --noEmit --incremental false`：退出码 0。
- 使用主站已有 tsx 执行 lite 四个测试文件：annual-credit-policy、wan-product-catalog、wan-catalog-config、stripe-scope，共 **10/10 通过**。这些检查不写业务数据库、不调用真实服务。

lite 现有材料：

- 共有 69 个测试文件，涉及 UI、API、任务、存储、计费、退款、配置权限和并发等。
- 最新视频费率验收文档记录 310/310 测试、类型检查、构建通过；ESLint 0 错误、218 警告。这是交付包自带记录，本次未重新复现全套结果。
- ESLint 配置关闭了一些规则，包括 rules-of-hooks 等，因此“零错误”也不能替代人工审查。

尚未验证：lite 完整依赖安装与当前机器上的全套构建；浏览器实际交互；真实 Google OAuth、Stripe、AI、R2；生产数据库内容；生产数据库并发及部署恢复。已提供的配置表均为空，不能据此宣称功能已在外部环境跑通。

## 10. 后续合并时需要确定的范围

目前可以继续以“迁入 lite 业务功能、保留主站作为目标”进行设计。真正实施前需要明确：主站视觉是否保持、是否继续使用其他支付渠道、注册是否赠送积分、部署采用常驻 Node 还是其他平台，以及线上是否已有用户/订单/订阅。

这些事项本轮先记录，不影响对代码结构和依赖关系的理解。

## 11. 关键源码索引

主站当前生成器：[wan-generator.tsx](I:/jp/code/wanai30.com/src/components/wan/wan-generator.tsx)

lite 关键入口：

- [前端生成流水线](E:/wechat-files/xwechat_files/mehelpme_92cf/msg/file/2026-09/wanai30-lite_1/wanai30-lite_1/src/components/wan/use-wan-generation.ts)
- [视频任务编排与恢复](E:/wechat-files/xwechat_files/mehelpme_92cf/msg/file/2026-09/wanai30-lite_1/wanai30-lite_1/src/shared/services/wan-video.ts)
- [视频协议适配器](E:/wechat-files/xwechat_files/mehelpme_92cf/msg/file/2026-09/wanai30-lite_1/wanai30-lite_1/src/extensions/ai/polaris-video.ts)
- [视频输入和结果存储](E:/wechat-files/xwechat_files/mehelpme_92cf/msg/file/2026-09/wanai30-lite_1/wanai30-lite_1/src/shared/services/wan-video-storage.ts)
- [新商品结账](E:/wechat-files/xwechat_files/mehelpme_92cf/msg/file/2026-09/wanai30-lite_1/wanai30-lite_1/src/shared/services/wan-checkout.ts)
- [支付事件处理](E:/wechat-files/xwechat_files/mehelpme_92cf/msg/file/2026-09/wanai30-lite_1/wanai30-lite_1/src/shared/services/payment-events.ts)
- [年付积分结算](E:/wechat-files/xwechat_files/mehelpme_92cf/msg/file/2026-09/wanai30-lite_1/wanai30-lite_1/src/shared/services/annual-credits.ts)
- [配置说明](E:/wechat-files/xwechat_files/mehelpme_92cf/msg/file/2026-09/wanai30-lite_1/wanai30-lite_1/docs/configuration.md)
- [交付包中的最新测试记录](E:/wechat-files/xwechat_files/mehelpme_92cf/msg/file/2026-09/wanai30-lite_1/wanai30-lite_1/docs/verification-video-rates-2026-09-26.md)

完整文件差异：[lite-file-comparison-2026-09-26.json](I:/jp/code/wanai30.com/docs/research/lite-file-comparison-2026-09-26.json)。
