# Google 登录接入

登录页、注册页和生成器登录弹窗均优先显示 Google 登录。

## 当前配置（2026-09-27）

- 独立 Google Cloud 项目：`wanai30-oauth`（WanAI 30 OAuth）。
- OAuth 应用名称：`WanAI 3.0`；Web 客户端：`WanAI Web`。
- 支持邮箱与开发者联系人：`mehelpme@gmail.com`。
- 品牌首页：`https://wanai30.com`；隐私政策：`https://wanai30.com/privacy-policy`；服务条款：`https://wanai30.com/terms-of-service`。三个地址均已检查返回 HTTP 200。
- 授权域名：`wanai30.com`；JavaScript 来源为 `https://wanai30.com` 和 `http://localhost:3000`。
- 已登记下文列出的本地、正式环境 Google 回调地址。
- Client ID、Client Secret、登录开关及本地应用地址已配置在 `.env.local`，保留原有 Kie 和 R2 配置。密钥不记录在文档中。
- 发布状态仍为“测试”，已添加上述账号为测试用户。尚未发布 Google OAuth 应用或部署生产环境凭证。
- 真实本地登录已验证：注册页进入账号页面；数据库中存在该邮箱的 Google 关联账号、已验证邮箱和登录会话。尚未在正式域名验证登录，也未完成所有取消授权及生成器状态保留场景的真实回归。

## 历史接入说明

可以直接把下面这段发给同事：

> 我在把 lite 的功能接到 wanai30.com。你之前有没有创建 Google OAuth 的 Web 客户端？需要确认 Client ID、Client Secret，以及客户端允许的回调地址。密钥请通过安全渠道交接或直接填到本地配置中。开发环境的回调地址是 `http://localhost:3000/api/auth/callback/google`，正式环境是 `https://wanai30.com/api/auth/callback/google`。

如果没有现成客户端，需要在 Google Cloud 创建 Web 应用的 OAuth 客户端。`/auth-popup` 和 `/auth-callback` 是站内页面；Google 客户端应登记上面的 `/api/auth/callback/google` 地址。

## 本地配置

在项目根目录 `I:\jp\code\wanai30.com` 的 `.env.local` 中添加以下配置。已有文件时只合并这些字段，保留其他设置。该文件已被 Git 忽略。不要给密钥加 `NEXT_PUBLIC_` 前缀。

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000
AUTH_URL=http://localhost:3000
GOOGLE_AUTH_ENABLED=true
GOOGLE_CLIENT_ID=填入客户端ID
GOOGLE_CLIENT_SECRET=填入客户端密钥
```

填好后，在运行开发服务器的终端中按 Ctrl+C，再执行：

```powershell
Set-Location 'I:\jp\code\wanai30.com'
pnpm dev
```

如果当前终端已经设置同名环境变量，终端变量会覆盖文件值。URL 应是普通文本，不能使用 Markdown 链接格式。

有管理员账号时，也可以在 `/admin/settings/auth` 设置 Google 登录开关、Client ID 和 Client Secret。环境变量优先于后台保存的值。不需要先通过邮箱注册，配置完成后即可用 Google 创建账号。

## 正式环境

部署平台设置相同的三个 `GOOGLE_*` 变量，应用地址和认证地址使用 `https://wanai30.com`，并在 OAuth 客户端允许正式环境回调。Client Secret 只保存在服务端环境变量或后台配置中。

## 配置后的验收

1. 在 `/sign-in` 点击 Google，使用真实账号完成授权，检查登录状态。
2. 在 `/wan-3` 输入提示词，再从弹窗使用 Google 登录，检查提示词保留、弹窗关闭和账号状态更新。
3. 退出后重新登录，确认仍是同一个账号。
4. 取消 Google 授权、关闭弹窗后，确认可以重新尝试。

早期检查使用模拟 OAuth 通知和模拟会话；真实登录验证进度见上方“当前配置”。视频生成验收与 Google 登录验收分开进行，选择 Standard 或 Prime 并不代表真实出片已验证。
