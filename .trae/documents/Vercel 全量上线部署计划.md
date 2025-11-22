## 概览
- 前端：`React + Vite + TypeScript + Tailwind`
- 后端：Vercel Serverless（`server/api/*.js`）
- 数据库：Supabase（`user_credits`、`payments`、`referrals`、`admins`）
- 支付与外部服务：Telegram Bot（Stars）、Make Webhook
- 部署平台：Vercel（根配置见 `vercel.json:1-34`，静态构建与 Node 函数路由）

## 前置准备
- 创建/选择 Supabase 项目并获取 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`
- 创建/配置 Telegram Bot，获取 `TELEGRAM_BOT_TOKEN`、`TELEGRAM_BOT_USERNAME`
- 准备 Make.com 场景并获取 `MAKE_WEBHOOK_URL`
- 确认生产域名（临时使用 Vercel 默认域，后续绑定自定义域）

## 环境变量配置（Vercel 项目 Settings → Environment Variables）
- 服务端（`vercel.json:26-33` 已约定 secret 映射；在 Vercel 中创建对应 Secrets 并关联）：
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `TELEGRAM_BOT_TOKEN`
  - `TELEGRAM_BOT_USERNAME`
  - `MAKE_WEBHOOK_URL`
  - `APP_BASE_URL`（生产域名，如 `https://your-app.vercel.app`）
  - `ADMINS`（可选，逗号分隔 Telegram 用户ID，参见 `server/api/_admin.js:1-22`）
- 前端（Vite 构建时读取）：
  - `VITE_PAYMENTS_BASE_URL` = `https://<APP_BASE_URL>/api`（`frontend/src/pages/Home.tsx:35-42`）

## 数据库迁移（Supabase SQL 控制台执行）
- 核心表结构：`supabase/migrations/001_init.sql:1-22`
- 管理员表：`supabase/migrations/002_add_admins_table.sql:1-52`
- 如遇权限/缺表问题，可使用修复脚本：
  - 快速修复：`supabase/cleanup/emergency_fix.sql`
  - 完整修复与诊断：`supabase/cleanup/comprehensive_fix.sql`

## Telegram Webhook 配置
- 设置 Bot Webhook 指向生产地址：
  - `https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=<APP_BASE_URL>/api/webhook&drop_pending_updates=true`
- Webhook 处理端点：`server/api/webhook.js`（由 `vercel.json:16-24` 路由到 `/api/webhook`）

## Vercel 部署
- 导入仓库并创建项目（根 `vercel.json` 生效）：
  - 静态前端构建：`frontend/package.json:6-12`（`npm run build` 输出至 `frontend/dist`，`vercel.json:5-10` 指定 `@vercel/static-build`）
  - Serverless 函数：`server/api/*.js`（`vercel.json:11-14`）
- 在 Vercel 项目中填入环境变量后，触发一次部署（Deploy/Redeploy）

## 上线验证
- 前端可访问：`https://<APP_BASE_URL>/`
- API 核心端点：
  - `GET /api/balance`（`server/api/balance.js`）
  - `GET /api/balance-with-referral`（`server/api/balance-with-referral.js:41-78` 推荐关系与欢迎积分）
  - `POST /api/create-invoice`（Stars 发票）
  - `POST /api/webhook`（支付回调）
  - `POST /api/consume`（积分消耗，含速率限制，`server/api/consume.js:33-79`）
  - `GET /api/referral-link`
- 管理员校验：`GET /api/admin-test`（需要 `ADMINS` 或 `admins` 表权限，参见 `server/api/admin-test.js:1-20`、`server/api/_admin.js:1-22`）

## 监控与安全
- 确认 `SUPABASE_SERVICE_ROLE_KEY` 仅在服务端使用，不进入前端构建输出
- 开启 Vercel 与 Supabase 的日志/监控；设置必要的速率限制（`server/api/_rateLimit.js`）
- 定期核对 RLS 与表权限（`supabase/cleanup/*` 脚本提供权限修复）

## 风险与一致性处理
- 仓库中存在 `frontend/vercel.json:1-24`；上线以根目录 `vercel.json` 为准，避免重复配置造成冲突（暂不改动配置，仅说明用法）
- 全流程使用相对路径与统一路由（符合用户规则）；不新增文件，仅执行数据库迁移与云端配置

## 下一步（执行）
1. 在 Vercel 设置所有环境变量与 Secrets；填充 `VITE_PAYMENTS_BASE_URL`
2. 在 Supabase 执行 `001_init.sql` 与 `002_add_admins_table.sql`
3. 通过 Bot API 设置 Webhook 指向 `/api/webhook`
4. 触发部署并完成上线；按“上线验证”清单逐项检查