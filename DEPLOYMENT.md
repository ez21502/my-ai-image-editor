# 部署指南

本文档说明如何安全地配置和部署项目，**不包含任何敏感信息**。

## 🔒 安全原则

- ✅ 敏感信息只存储在：
  - 本地 `.env.local` 文件（不提交到仓库）
  - GitHub Secrets（用于 CI/CD）
  - Vercel Secrets/Environment Variables（用于生产环境）
  - Netlify Environment Variables（用于前端部署）
- ❌ **永远不要**将敏感信息提交到代码仓库

## 📋 环境变量清单

### 后端环境变量（Vercel）

以下变量需要在 Vercel Dashboard 中配置（使用 Secrets 或 Environment Variables）：

| 变量名 | 说明 | 获取方式 |
|--------|------|----------|
| `SUPABASE_URL` | Supabase 项目 URL | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key | Supabase Dashboard → Settings → API |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token | @BotFather → /token |
| `TELEGRAM_BOT_USERNAME` | Telegram Bot 用户名 | @BotFather → /setusername |
| `MAKE_WEBHOOK_URL` | Make.com Webhook URL | Make.com 场景 → Webhook 模块 |
| `APP_BASE_URL` | 应用部署 URL | 部署后从 Vercel Dashboard 获取 |

### 前端环境变量（Netlify）

以下变量需要在 Netlify Dashboard 中配置：

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `VITE_PAYMENTS_BASE_URL` | 后端 API 基础 URL | `https://your-project.vercel.app/api` |

## 🏠 本地开发配置

### 1. 创建本地环境变量文件

在项目根目录创建 `.env.local` 文件（**此文件已在 .gitignore 中，不会被提交**）：

```bash
# 后端环境变量（用于本地测试 API）
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_BOT_USERNAME=your_bot_username
MAKE_WEBHOOK_URL=your_make_webhook_url
APP_BASE_URL=http://localhost:3000

# 前端环境变量
VITE_PAYMENTS_BASE_URL=http://localhost:3000/api
```

### 2. 运行本地开发服务器

```bash
# 前端开发服务器
cd frontend
npm install
npm run dev

# 后端 API（如果使用 Vercel CLI）
vercel dev
```

## ☁️ GitHub Secrets 配置（用于 CI/CD）

如果你使用 GitHub Actions 进行 CI/CD，需要在 GitHub 仓库中配置 Secrets：

1. 访问你的 GitHub 仓库
2. 进入 **Settings** → **Secrets and variables** → **Actions**
3. 点击 **New repository secret**
4. 添加以下 Secrets：

| Secret 名称 | 说明 |
|------------|------|
| `VERCEL_TOKEN` | Vercel API Token（从 Vercel Dashboard → Settings → Tokens 获取） |
| `VERCEL_ORG_ID` | Vercel Organization ID（从 Vercel Dashboard → Settings → General 获取） |
| `VERCEL_PROJECT_ID` | Vercel Project ID（从项目 Settings → General 获取） |
| `VITE_PAYMENTS_BASE_URL` | 前端构建时使用的 API URL（可选，用于 GitHub Actions 构建） |

### 获取 Vercel 凭证

1. **VERCEL_TOKEN**:
   - 访问 https://vercel.com/account/tokens
   - 点击 **Create Token**
   - 复制生成的 token

2. **VERCEL_ORG_ID** 和 **VERCEL_PROJECT_ID**:
   - 访问 Vercel Dashboard → 项目 Settings → General
   - 在页面底部找到 Organization ID 和 Project ID

## 🚀 Vercel 部署配置

### 方法 1: 使用 Vercel Secrets（推荐）

1. 访问 Vercel Dashboard → 项目 → **Settings** → **Secrets**
2. 创建以下 Secrets：
   - `supabase_url`
   - `supabase_service_role_key`
   - `telegram_token`
   - `bot_username`
   - `make_webhook_url`
   - `app_base_url`

3. `vercel.json` 会自动从这些 Secrets 读取值（使用 `@` 前缀）

### 方法 2: 使用环境变量

1. 访问 Vercel Dashboard → 项目 → **Settings** → **Environment Variables**
2. 添加所有后端环境变量（见上方清单）
3. 选择应用环境：**Production**, **Preview**, **Development**

## 🌐 Netlify 部署配置（前端）

1. 访问 Netlify Dashboard → 项目 → **Site settings** → **Environment variables**
2. 添加前端环境变量：
   - `VITE_PAYMENTS_BASE_URL`

## 🔄 CI/CD 流程

### 自动部署

项目配置了 GitHub Actions 工作流（`.github/workflows/deploy.yml`）：

- **触发条件**：
  - 推送到 `main` 或 `master` 分支
  - 创建 Pull Request
  - 手动触发（workflow_dispatch）

- **执行步骤**：
  1. 检查代码
  2. 安装依赖
  3. 运行代码检查（lint）
  4. 构建前端
  5. 部署到 Vercel（仅限 main/master 分支推送）

### 手动部署

使用提供的部署脚本：

```bash
# 使用默认提交消息
./scripts/redeploy.sh

# 使用自定义提交消息
./scripts/redeploy.sh "feat: 更新功能"
```

脚本会：
1. 检查 Git 状态
2. 添加所有更改
3. 创建提交
4. 推送到 GitHub
5. Vercel 会自动检测推送并触发部署

## 📝 部署后验证

### 1. 检查部署状态

- Vercel Dashboard → Deployments
- 确认最新部署状态为 **Ready**

### 2. 测试 API 端点

```bash
# 健康检查
curl https://your-project.vercel.app/api/health

# 余额查询（需要有效的 initData）
curl "https://your-project.vercel.app/api/balance?initData=your_init_data"
```

### 3. 配置 Telegram Bot Webhook

部署完成后，设置 Telegram Bot Webhook：

```bash
curl -X POST "https://api.telegram.org/botYOUR_TELEGRAM_BOT_TOKEN/setWebhook?url=https://YOUR_DEPLOYMENT_URL/api/webhook&drop_pending_updates=true"
```

**注意**：将 `YOUR_TELEGRAM_BOT_TOKEN` 和 `YOUR_DEPLOYMENT_URL` 替换为实际值。

## 🛠️ 故障排除

### 部署失败

1. **检查 Vercel 部署日志**：
   - Vercel Dashboard → Deployments → 选择失败的部署 → View Function Logs

2. **验证环境变量**：
   - 确认所有必需的环境变量已正确配置
   - 检查变量名拼写是否正确

3. **检查代码**：
   - 确认代码已正确推送到 GitHub
   - 检查 `vercel.json` 配置是否正确

### API 端点不工作

1. **检查环境变量**：
   - 确认所有后端环境变量已正确设置
   - 验证 Supabase 连接信息是否正确

2. **查看函数日志**：
   - Vercel Dashboard → Functions → 选择函数 → View Logs

3. **测试本地环境**：
   - 使用 `vercel dev` 在本地测试 API

### CORS 错误

后端已配置 CORS，支持以下源：
- 通过 `ALLOWED_ORIGINS` 环境变量配置的域名（逗号分隔，例如：`https://your-frontend.netlify.app,https://your-frontend.vercel.app`）
- `http://localhost:3000` (本地开发)
- `http://localhost:5173` (Vite 开发服务器)
- `http://127.0.0.1:3000` 和 `http://127.0.0.1:5173` (本地开发 IP)

**配置方法**：在 Vercel 环境变量中添加 `ALLOWED_ORIGINS`，值为逗号分隔的允许来源列表。

## 📚 相关文档

- [VERCEL_CONFIGURATION.md](./VERCEL_CONFIGURATION.md) - Vercel 详细配置说明
- [scripts/redeploy.sh](./scripts/redeploy.sh) - 部署脚本说明

## ⚠️ 安全提醒

1. **立即撤销已暴露的密钥**：
   - 如果敏感信息已提交到仓库，立即在相关服务中撤销并重新生成密钥
   - 使用 `git filter-branch` 或 `git-filter-repo` 从历史记录中删除敏感信息

2. **定期轮换密钥**：
   - 建议每 3-6 个月轮换一次 API 密钥和 tokens

3. **使用最小权限原则**：
   - 只授予必要的权限
   - 使用 Service Role Key 时格外小心

4. **监控访问日志**：
   - 定期检查 Supabase、Telegram Bot 和 Make.com 的访问日志
   - 发现异常活动立即采取措施

