# WanAI 联系邮箱配置

日期：2026-09-28。

## 已完成

- 网站公开联系邮箱改为 `contact@wanai30.com`，覆盖页脚及中英文隐私、条款、退款、免责声明。
- Cloudflare Email Routing 的目标 `mehelpme@gmail.com` 已由用户验证。
- 精确转发规则：`contact@wanai30.com` → `mehelpme@gmail.com`，规则活跃。
- 域名路由状态刷新后为“已启用”，DNS 为“已锁定”。Catch-all 保持关闭。
- Cloudflare 配置了三个接收 MX、SPF 和 DKIM 记录，没有替换既有收件服务的冲突提示。
- PR #7 已合并，main 提交 `5e27ed583b642607cd16c3c1d6029630e8576695`；Vercel 部署成功。
- 4 项既有页脚/语言测试与 CI 通过。线上英文退款、条款及中文隐私页返回 200，包含新地址，不含旧 support 地址。
- 首页页脚地址经 Cloudflare 邮箱保护混淆；解码公开 data-cfemail 后确认是 contact@wanai30.com。
- 本地工作目录已同步本次 11 个变更文件。

## 验证范围与后续

- 尚未发送实际测试邮件，Gmail 入箱待验证。建议从另一个邮箱发信至 contact 地址，再检查 Gmail 收件箱及垃圾邮件。
- 本次配置为收件转发。以 `contact@wanai30.com` 身份发信或回复需要独立的发信服务配置；当前 Gmail 普通回复仍使用 Gmail 地址。
- 网站自动发送验证码、密码重置及交易邮件的配置不由本次收件转发替代。
- 未创建 `support@wanai30.com` 别名；旧地址来信不会由本次规则转发。

## 发布记录

- PR：https://github.com/oprom0004/wan30ai.com/pull/7
- 部署：https://vercel.com/oprom0004s-projects/wan30ai-com/9HkFJZSF3zj4L82BAfmnYpMFwrvg
