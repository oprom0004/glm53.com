# Stripe 正式支付配置

更新日期：2026-09-27。

## 当前配置

- 网站：https://wanai30.com；Vercel 项目：oprom0004s-projects/wan30ai-com。
- Stripe 账户：KIROOAI INC（acct_1SCyUOJxgDIaf3uh）。
- 用户已授权创建正式受限密钥、保存至 Vercel Production、配置回调和启用支付；没有授权真实付款。
- 用户已完成身份验证，并将正式受限密钥保存至本地环境文件。仅核对存在性和正式模式，未输出密钥。
- Vercel Production 已保存 STRIPE_SECRET_KEY、STRIPE_SIGNING_SECRET、STRIPE_PUBLISHABLE_KEY、DEFAULT_PAYMENT_PROVIDER=stripe，并更新 STRIPE_ENABLED=true。
- 新部署 3LVtmVBkpGyYoaStHLjd8Aa2DXzw 已 Ready，来源 main / 76ec2cc，构建 5m51s，已绑定 wanai30.com。

## 专用资源

- 回调：we_1UKHCRJxgDIaf3uhobhedoaz。
- URL：https://wanai30.com/api/payment/notify/stripe。
- API 版本：2025-08-27.basil。
- 回调已在部署及签名检查通过后启用（enabled）。
- 账单门户：bpc_1UKHCQJxgDIaf3uhpMMVZoAe，独立且非默认，metadata.wanai_app=wanai30-lite。
- 开启账单历史和付款方式更新；取消续订走 WanAI 自己的服务。
- 账单门户返回：https://wanai30.com/settings/billing。
- 隐私及条款页：https://wanai30.com/privacy-policy、https://wanai30.com/terms-of-service，HTTP 检查均为 200。
- 没有修改共享 Stripe 账户的全局品牌、其他站点密钥、回调或默认门户。

事件：checkout.session.completed、checkout.session.async_payment_succeeded、checkout.session.async_payment_failed、invoice.payment_succeeded、invoice.paid、invoice.payment_failed、refund.created、refund.updated、customer.subscription.updated、customer.subscription.deleted。

## 密钥权限

写：Customers、Checkout Sessions、Subscriptions、Products、Prices、Customer Portal、Webhook Endpoints / Event Destinations。

读：Invoices、Payment Intents、Charges and Refunds。

没有 Payouts、Transfers、银行账户或 Accounts Read 权限。账户状态 API 因缺少 Accounts Read 返回 403，尚未完整核验 charges_enabled / payouts_enabled / requirements。未为此扩大权限。

## 验收范围

已从管理员真实登录的正式价格页打开三个 Starter 正式收银台：月付 $19.90 / month、年付 $202.98 / year、积分包 $24.90 一次性。页面与 Stripe API 双重核对金额、USD、live 模式、周期及正式域名返回地址。验证会话均 unpaid，核验后显式过期关闭，没有输入银行卡或提交付款。实际点击 Stripe 返回链接可回到相应价格分类。独立账单门户 session 创建成功。真实支付、到账、退款及真实续费不属于本轮无扣款验证结果。

## 另行发现

价格页页脚的 /privacy 和 /terms 返回 404，而实际文档地址是 /privacy-policy 和 /terms-of-service。需修正页脚链接，退款及免责声明入口也需统一核对。

密钥值不得写入日志、聊天、Git 或此文档。部署临时配置位于 Git 忽略目录。

## 最终技术检查

- 正式公共配置 stripe_enabled=true；首页、价格页、生成页、登录页、站点地图及能力接口均 HTTP 200。
- 未签名回调 HTTP 400；使用正式签名的无业务副作用探针 HTTP 200，未伪造已支付订单。
- 验证脚本记录位于忽略目录 .test/stripe-live-verification.json 和 .test/stripe-live-checkout-{monthly,annual,credits}.json。
- Stripe 收银台商户名称目前显示 KIROOAI INC；未修改共享账户全局品牌。
- 验证只新建了未付款会话及其订单记录，没有创建已付款订阅，也没有增加积分。

