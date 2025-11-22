# 重新部署指南

## 🚀 手动部署步骤

由于 Vercel CLI 需要浏览器登录授权，请按照以下步骤手动部署：

### 1. 推送代码到 GitHub

```bash
# 添加所有更改
git add .
git commit -m "feat: 重新配置 Vercel 部署，修复 Supabase 集成"
git push origin master
```

### 2. 登录 Vercel 控制台

访问：https://vercel.com/dashboard

### 3. 找到你的项目

项目名：`my-ai-image-editor-fc7blcgqx-ez21502s-projects`
项目域名：`my-ai-image-editor-fc7blcgqx-ez21502s-projects.vercel.app`

### 4. 配置环境变量

在 Vercel 项目设置中，添加以下环境变量：

#### Supabase 配置
- `SUPABASE_URL` = 你的 Supabase 项目 URL
- `SUPABASE_SERVICE_ROLE_KEY` = 你的 Supabase service_role 密钥

#### Telegram Bot 配置
- `TELEGRAM_TOKEN` = 你的 Telegram Bot Token
- `BOT_USERNAME` = 你的 Telegram Bot 用户名

#### 应用配置
- `APP_BASE_URL` = https://my-ai-image-editor-fc7blcgqx-ez21502s-projects.vercel.app
- `MAKE_WEBHOOK_URL` = 你的 Make.com Webhook URL

### 5. 重新部署

在 Vercel 控制台中：
1. 进入项目页面
2. 点击 "Redeploy" 或 "Deploy" 按钮
3. 等待部署完成

## 📋 部署配置说明

### Vercel 配置文件 (`vercel.json`)
```json
{
  "version": 2,
  "builds": [
    {
      "src": "frontend/package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    },
    {
      "src": "server/api/*.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "server/api/$1.js"
    },
    {
      "src": "/(.*)",
      "dest": "frontend/dist/$1"
    }
  ],
  "env": {
    "SUPABASE_URL": "@supabase_url",
    "SUPABASE_SERVICE_ROLE_KEY": "@supabase_service_role_key",
    "TELEGRAM_TOKEN": "@telegram_token",
    "MAKE_WEBHOOK_URL": "@make_webhook_url",
    "BOT_USERNAME": "@bot_username",
    "APP_BASE_URL": "@app_base_url"
  }
}
```

### 前端配置更新
前端已配置为使用新的 API 端点：
- API 基础地址：`https://my-ai-image-editor-fc7blcgqx-ez21502s-projects.vercel.app/api`
- 支付集成：支持 Telegram Stars
- 推荐系统：完整的邀请奖励机制

### 后端 API 端点
部署后将提供以下 API：
- `POST /api/create-invoice` - 创建 Stars 支付发票
- `POST /api/webhook` - 处理支付回调
- `GET /api/balance` - 查询用户余额
- `POST /api/consume` - 消耗积分
- `GET /api/referral-link` - 生成推荐链接

## 🔧 验证部署

部署完成后，访问以下地址验证：

### 前端页面
https://my-ai-image-editor-fc7blcgqx-ez21502s-projects.vercel.app

### API 测试
https://my-ai-image-editor-fc7blcgqx-ez21502s-projects.vercel.app/api/balance

### 预期响应
```json
{
  "error": "missing_initData"
}
```

## ⚠️ 重要提醒

1. **确保 Supabase 表已创建** - 执行之前提供的 SQL 脚本
2. **配置 Telegram Bot Webhook** - 指向新的 API 端点
3. **测试支付流程** - 验证 Stars 支付正常工作
4. **检查环境变量** - 所有变量都必须正确设置

## 🆘 常见问题

### 部署失败
- 检查环境变量是否完整
- 验证 Supabase 连接是否正常
- 查看 Vercel 构建日志

### API 500 错误
- 检查 Supabase 表结构和权限
- 验证 Telegram Token 是否有效
- 查看函数日志获取详细错误信息

### 前端无法加载
- 确认前端构建成功
- 检查静态文件路径配置
- 验证域名解析是否正常