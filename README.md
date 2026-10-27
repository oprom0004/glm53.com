# WanAI 3.0

以 wanai30.com 原有前端为基础，接入 lite 的视频生成、账户、积分、Stripe 支付和后台管理功能。保留原站的紫色视觉风格、首页内容结构及本地演示素材。

## 功能

- Wan 2.5 / 2.6 / 2.7 / 3.0 生成器：按版本提供文生视频、图生视频及参考视频能力，服务端报价、上传、提交和任务恢复。
- 邮箱登录、可选 Google 登录、修改密码和邮件找回密码、个人任务记录、积分明细和账单。
- 三档月付、三档年付及三档永久积分包，Stripe 结账、回调校验及退款处理。
- 后台管理 AI 接口、R2 存储、商品价格、积分额度和视频积分费率。
- 中英文页面、动态 sitemap 和页面 SEO 信息。

真实生成、上传和收款需要配置相应服务。演示视频是首页素材；生成器不再用固定视频模拟生成结果。

## 本地运行

```powershell
pnpm install --frozen-lockfile
$env:NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
$env:AUTH_URL = 'http://localhost:3000'
pnpm dev
```

现有 `.env` 和数据库在合并中保留。新环境需配置数据库及 `AUTH_SECRET`；不要把密钥提交到仓库。首次建立数据库使用 `pnpm db:push`，操作已有生产库前先备份。

生产构建使用 `pnpm build`，运行使用 `pnpm start`。生产环境的 `NEXT_PUBLIC_APP_URL` 和 `AUTH_URL` 应为实际站点地址。

## 初始化管理员

先在站内注册自己的账户，再运行：

```powershell
pnpm rbac:init
pnpm rbac:assign --email=your-email@example.com --role=super_admin
```

随后访问 `/admin/settings/setup`，按配置检查页完成 Google、AI、R2、Stripe、邮件服务及商品目录。不要直接复制 lite 的用户数据库或密钥。详细说明见 [配置文档](docs/configuration.md)。

## 验证

```powershell
pnpm test
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```

测试使用独立临时数据库和模拟外部服务，不代表真实供应商已经完成联调。测试脚本启用 GC，以便 Windows 释放 libSQL 临时数据库句柄。

## 运行要求

当前 Wan 和支付流程依赖数据库事务；Cloudflare D1 不满足此实现要求。后台任务恢复使用 Node 进程内调度，部署前需确认运行环境允许持续执行，并验证重启恢复。保留的 Cloudflare 脚本不代表该部署方案已验收。

项目合并记录和检查结果见 `docs/research/`。
