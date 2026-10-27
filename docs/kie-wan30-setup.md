# Kie Wan 3.0 配置与验收

## 已完成的代码

- Wan 3.0 可在 Polaris 与 Kie 之间选择，新任务按所选供应商提交。
- Kie Standard 使用 `wan/3-0-video`，Prime 使用 `wan/3-0-video-prime`。
- 文生视频、首帧/首尾帧图片及最多 10 张参考图片均按 Kie 参数格式发送。启用音频，时长 2–30 秒，沿用现有分辨率和画幅选项。
- 创建任务调用 `/api/v1/jobs/createTask`，轮询 `/api/v1/jobs/recordInfo`。当前使用轮询，不配置未经验证的回调入口。
- `duration` 使用秒数，图片使用 `first_frame_url`、`last_frame_url` 或 `reference_image_urls`，不使用原通用 Kie 适配器的 `n_frames` 参数。
- 任务保存供应商、模型和地址。切换新任务的供应商不改变旧任务；修改供应商地址后，旧任务暂缓查询，恢复地址即可继续。
- 复用积分扣除、明确失败退款、结果不明时不重复提交、视频保存及任务恢复流程。
- Wan 2.5/2.6/2.7 仍使用原有 Polaris 配置，本次没有将这些版本迁移到 Kie。

## 填入密钥

本地 `.env.local` 已准备以下字段。只填真实密钥，不写 `Bearer` 前缀，不提交该文件：

```dotenv
WAN30_PROVIDER=kie
KIE_API_KEY=
```

默认接口为 `https://api.kie.ai/api/v1`。后台 `/admin/settings/ai` 也有 Wan 3.0 Provider 和 Kie API Key 字段；非空环境变量优先于后台设置。

保存后执行只读鉴权检查：

```powershell
Set-Location 'I:\jp\code\wanai30.com'
node scripts/check-kie.mjs
```

检查只访问 Kie 的账户余额接口，输出是否通过鉴权及供应商账户余额，不输出密钥、不提交生成任务。账户余额是 Kie 积分，与本站用户积分不是同一单位。检查通过不代表已经完成视频生成验收。

Next.js 开发服务通常会重新载入 `.env.local`；如果页面未更新，在原终端停止并重新运行 `pnpm dev`。

## 网站生成需要的其他配置

当前网站将上传图片和生成结果保存至 R2，因此还需要有效 R2 配置：

```dotenv
R2_ACCOUNT_ID=
R2_ACCESS_KEY=
R2_SECRET_KEY=
R2_BUCKET_NAME=
R2_DOMAIN=
```

`R2_DOMAIN` 为公开 HTTPS 域名，不能使用私有 S3 API 地址。填 `R2_ENDPOINT` 时可替代 Account ID。密钥和存储缺失时，服务会明确报告缺项，不发送收费生成请求。

已允许 Kie 官方示例中的结果域名 `tempfile.aiquickdraw.com`。其他实际返回域名需要管理员通过 `WAN_VIDEO_OUTPUT_HOSTS` 配置精确主机名；下载仍检查 HTTPS、禁止重定向并校验视频格式和大小。

生成还需要登录用户有足够的本站积分。当前积分费率沿用网站既有设置，没有按照 Kie 的供应商成本自动改价，正式开放付费生成前应核对费率。

## 验收顺序

真实验收已补齐 Prime 文生、Standard 图生、首尾帧及明显动作变化的参考视频，四条均成功保存和播放。见 [真实生成验收结果](research/live-modes-acceptance-2026-09-27.md)。

参考视频已接入，使用方式、时长计费及部署限制见 [参考视频接入](research/reference-video-2026-09-27.md)。

最新代码及模式检查见 [Prime、图生视频与参考图检查](research/wan-modes-review-2026-09-27.md)。上传图片现已在服务端完整解码校验，每边 240–8000 像素、长宽比不超过 8:1，不含透明区域，网站大小上限仍为 10 MB。

1. 验证密钥与 Kie 账户余额。
2. 验证网站登录、本站积分、R2 上传及公开读取。
3. 先生成一条短视频，核对 Kie 任务、网站扣分、查询、保存、播放与下载。
4. 分别验证 Standard/Prime、图片输入、参考输入和取消浏览器后的任务恢复。

目前自动化检查使用模拟供应商响应与临时数据库，真实生成是否通过应以实际账号验收结果为准。

## 官方协议来源

- [Standard](https://docs.kie.ai/market/wan/3-0-video)
- [Prime](https://docs.kie.ai/market/wan/3-0-video-prime)
- [任务查询](https://docs.kie.ai/market/common/get-task-detail)
- [账户余额](https://docs.kie.ai/common-api/get-account-credits)

文档核对日期：2026-09-27。
