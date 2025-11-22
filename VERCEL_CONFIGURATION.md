# Vercel 配置完整指南

## 🎯 快速开始

你的项目已经推送到 GitHub: **https://github.com/ez21502/my-ai-image-editor**

## 📝 步骤 1: 在 Vercel 中导入项目

1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 点击 **"Add New..."** → **"Project"**
3. 在 "Import Git Repository" 中：
   - 如果看到 **"ez21502/my-ai-image-editor"**，直接选择
   - 如果看不到，点击 **"Adjust GitHub App Permissions"** 授权访问

## ⚙️ 步骤 2: 配置项目设置

### 项目基本信息
- **Project Name**: `my-ai-image-editor` (或保持默认)
- **Framework Preset**: **"Other"** 或 **"Vite"**
- **Root Directory**: 留空（使用根目录）
- **Build Command**: 留空（Vercel 会自动检测 `frontend/package.json`）
- **Output Directory**: 留空（Vercel 会自动处理）

### ⚠️ 重要：关于 vercel.json 中的环境变量

`vercel.json` 中使用了 `@` 前缀（如 `@supabase_url`），这表示引用 **Vercel Secrets**。

**你有两个选择：**

#### 选项 A: 使用 Vercel Secrets（推荐，更安全）

1. 在 Vercel Dashboard → **Settings** → **Secrets**
2. 创建以下 Secrets：
   - `supabase_url` = `https://crsbzrtjqxaeolvtqelg.supabase.co`
   - `supabase_service_role_key` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - `telegram_token` = `7996291998:AAHlfhHrnHnycmYmdXCzQXQD0IHgNIJMBg8`
   - `make_webhook_url` = `https://hook.us2.make.com/6xbib7m7edat288dd074myx7dy882imk`
   - `bot_username` = `@huananren_bot`
   - `app_base_url` = `https://your-project.vercel.app`（部署后更新）

#### 选项 B: 直接使用环境变量（更简单）

如果你想直接使用环境变量而不是 Secrets，需要修改 `vercel.json`：

将 `vercel.json` 中的：
```json
"env": {
  "SUPABASE_URL": "@supabase_url",
  ...
}
```

改为直接使用环境变量名（在 Dashboard 中设置时使用这些名称）：
```json
"env": {
  "SUPABASE_URL": "",
  ...
}
```

然后在 Vercel Dashboard → **Settings** → **Environment Variables** 中直接添加变量。

## 🔧 步骤 3: 配置环境变量（如果选择选项 B）

在 Vercel Dashboard → **Project Settings** → **Environment Variables** 中添加：

```
SUPABASE_URL = https://crsbzrtjqxaeolvtqelg.supabase.co
SUPABASE_SERVICE_ROLE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyc2J6cnRqcXhhZW9sdnRxZWxnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzY4MDY5NiwiZXhwIjoyMDc5MjU2Njk2fQ.SOD6GJqoMDydkhnut6uVZLLJ0IJWAm_QYtcLRzOjqMs
TELEGRAM_BOT_TOKEN = 7996291998:AAHlfhHrnHnycmYmdXCzQXQD0IHgNIJMBg8
TELEGRAM_BOT_USERNAME = @huananren_bot
MAKE_WEBHOOK_URL = https://hook.us2.make.com/6xbib7m7edat288dd074myx7dy882imk
APP_BASE_URL = https://your-project.vercel.app
```

**注意**: 
- 选择 **Production, Preview, Development** 三个环境
- `APP_BASE_URL` 需要在首次部署后更新为实际 URL

## 🚀 步骤 4: 部署

1. 点击 **"Deploy"** 按钮
2. 等待部署完成（通常 1-3 分钟）
3. 部署完成后，复制你的部署 URL（例如：`https://my-ai-image-editor.vercel.app`）

## 🔄 步骤 5: 更新 APP_BASE_URL

部署完成后：

1. 在 Vercel Dashboard → **Settings** → **Environment Variables**（或 **Secrets**）
2. 更新 `APP_BASE_URL`（或 `app_base_url` Secret）为你的实际部署 URL
3. 在 **Deployments** 标签页，点击最新部署的 **"..."** → **"Redeploy"**

## 🤖 步骤 6: 配置 Telegram Bot Webhook

部署完成后，设置 Telegram Bot Webhook：

```bash
curl -X POST "https://api.telegram.org/bot7996291998:AAHlfhHrnHnycmYmdXCzQXQD0IHgNIJMBg8/setWebhook?url=https://YOUR_DEPLOYMENT_URL/api/webhook&drop_pending_updates=true"
```

替换 `YOUR_DEPLOYMENT_URL` 为你的实际 Vercel 部署 URL。

## ✅ 验证清单

### API 端点测试
- [ ] 访问 `https://YOUR_DEPLOYMENT_URL/api/health` 应该返回健康状态
- [ ] 访问 `https://YOUR_DEPLOYMENT_URL/api/balance?initData=test` 应该返回错误（表示 API 正常工作）

### 环境变量验证
- [ ] 所有环境变量已正确配置
- [ ] `APP_BASE_URL` 已更新为实际部署 URL

### Telegram Bot 配置
- [ ] Webhook 已正确设置
- [ ] Bot 可以接收消息

## 🔄 自动部署

配置完成后，每次推送代码到 GitHub 的 `main` 分支，Vercel 会自动触发部署：

```bash
git add .
git commit -m "你的更改描述"
git push origin main
```

## 📁 项目结构

- **`api/`**: Vercel Serverless Functions（后端 API）
- **`frontend/`**: React + Vite 前端应用
- **`vercel.json`**: Vercel 配置文件

## 🛠️ 故障排除

### 部署失败
1. 检查 Vercel 部署日志中的错误信息
2. 确认所有环境变量/Secrets 已正确配置
3. 检查 `vercel.json` 配置是否正确
4. 确认代码已正确推送到 Git 仓库

### API 端点不工作
1. 确认环境变量已正确设置
2. 检查 API 文件路径是否正确（`api/*.js`）
3. 查看 Vercel 函数日志

### CORS 错误
后端已配置 CORS，支持以下源：
- `https://storied-raindrop-eb4089.netlify.app` (Netlify前端)
- `http://localhost:3000` (本地开发)
- `http://localhost:5173` (Vite开发服务器)

## 📞 需要帮助？

如果遇到问题：
1. 查看 Vercel 部署日志
2. 检查环境变量/Secrets 配置
3. 验证 API 端点是否可访问

