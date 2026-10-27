# Kie Wan 3.0 接入结果

已接入 Standard/Prime 的文字、首尾帧图片和参考图片生成。新任务通过 `wan30_provider` 选择供应商，历史任务按已保存的供应商继续查询。Kie 请求、任务状态和结果解析独立于旧通用 Kie 适配器；网站积分、退款、存储及恢复流程保持统一。

本地 `.env.local` 已创建 Kie 选择项和空密钥槽，尚未读取到有效 Kie 密钥。未发送真实视频生成请求，没有供应商扣费。真实生成仍需密钥、账户余额、R2 和本站用户积分。

## 验证

- 全部 334 项测试通过，0 失败、0 跳过。
- 新增检查覆盖 Kie 参数、模型、鉴权头、明确拒绝与未知结果、查询身份匹配、供应商切换、退款幂等、终态保护、通用查询路由和结果 CDN 下载边界。
- TypeScript、改动文件 ESLint 和生产构建通过。
- 本地浏览器确认 Prime 显示 Faster generation，模型可选择；缺配置时仍禁止实际生成。
- 日志：`validation/kie-full-tests.log`、`validation/kie-integration-tests.log`、`validation/kie-build.log`、`validation/kie-lint.log`。

配置及真实验收步骤见 [Kie Wan 3.0 配置](../kie-wan30-setup.md)。
