# WanAI 数据库迁移（2026-09-27）

## 结果

本地 WanAI 从 SQLite 切换到现有 Neon 项目中的独立 PostgreSQL 数据库 `wanai30`，使用专用登录角色 `wanai30_app`。lipsync.pro 继续使用原来的 `neondb`，没有改动其业务表、记录或环境文件。

- 新角色没有创建数据库、创建角色或超级管理员权限。
- 新数据库已撤销 PUBLIC 的默认访问权限；WanAI 角色有连接、临时表和数据库内创建对象的权限，可执行自身迁移。
- 实测 WanAI 角色没有读取或插入 lipsync `public.user` 表的权限。
- 两个数据库仍共享 Neon 项目的计算与资源配额。

18 张业务表完成结构迁移，72 条源记录逐字段校验一致：账号 1、Google 绑定 1、会话 2、积分流水 1、角色 4、权限 29、角色权限映射 34。其余表为空；不存在需要迁移的视频任务或订单。

`mehelpme@gmail.com` 的有效积分余额为 1,000。角色绑定表仍为空，本次未授予用户管理员权限。

SQLite 的毫秒时间戳转换为 PostgreSQL UTC 时间，整数布尔值转换为 boolean。复制在一个事务内执行，校验失败时整批回滚。最终全部记录通过内容校验后，才更新 `.env.local` 并重启本地开发服务。

## 配置与迁移文件

- `.env.local` 保存专用数据库连接，`DATABASE_PROVIDER=postgresql`。
- `DB_SCHEMA_FILE=./src/config/db/schema.postgres.ts`，`DB_SCHEMA=public`。
- `DB_MIGRATIONS_OUT=./src/config/db/migrations-postgres`。
- 迁移日志：`drizzle.__drizzle_migrations`。
- `src/config/db/schema.ts` 按运行环境选择表定义；SQLite 仍用于隔离的自动化测试。
- 数据库脚本默认优先读取 `.env.local`，也可显式指定 `--env`。
- Google、Kie、R2 和 AUTH_SECRET 保留原值，不在本文记录密钥。

后续结构变更通过 `pnpm db:generate` 和 `pnpm db:migrate` 管理。PostgreSQL 初始迁移和快照保存在 `src/config/db/migrations-postgres`，不再被忽略。

## 备份与回退

迁移前的一致性备份：`I:/jp/backups/wanai30-before-neon-20260927`。

包含 `local.db`、原 `.env` / `.env.local`、原 schema 导出文件及迁移校验报告。该目录含凭据和会话信息，应保留在本机，不上传代码仓库。

若需立即回退：先停止 WanAI 开发服务，保存新数据库产生的数据，再恢复备份的 `.env.local`，确认 SQLite 路径指向原 `data/local.db`，重新启动服务。运行时 schema 会随 `DATABASE_PROVIDER=sqlite` 自动选择 SQLite。原数据库文件仍保留；不要在 PostgreSQL 已有新业务数据后直接回退旧快照，否则会遗漏新数据。

本次切换用于本地运行，尚未配置线上部署平台的数据库环境变量。上线前需决定线上与开发环境的数据隔离方式。

## 验证

- 新 PostgreSQL 数据库的真实事务测试通过：创建临时账号和积分，在应用模型中扣除 1 积分，验证日期映射，随后主动回滚；临时数据没有留下，真实账号仍有 1,000 积分。
- 对比迁移前后的 `.env.local`，所有非数据库配置值保持一致。
- 浏览器保留原登录会话，显示 Vincent Lai、1,000 积分及赠送流水；“我的视频”和 `/wan-3` 正常加载。
- `pnpm db:migrate` 在已完成迁移的数据库上再次执行成功，没有重复导入数据。
- TypeScript、所改代码的 ESLint、生产构建均通过。
- 全量回归运行记录为 335 项、332 通过、3 失败。其中两个失败来自此前页面改版后过期的测试：旧 `/settings/tasks` 路径断言、视频列表缺少路由上下文及旧状态文案。已更新，相关测试单独重跑 3/3 通过。
- 另一次失败为 Windows 测试子进程退出码 `3221225477`：年度积分的 19 个断言已通过，进程结束时异常退出。该文件单独重跑 19/19 通过、退出码为 0。本次没有再次运行整套测试，因此不将最初的全量结果标为全绿。日志位于本地 `.test/neon-regression.log`、`.test/neon-ui-regression.log` 和 `.test/neon-annual-recheck.log`。

本次没有提交付费视频生成任务。
