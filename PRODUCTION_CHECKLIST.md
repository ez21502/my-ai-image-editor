# 生产环境部署检查清单

本文档列出了部署到生产环境前需要完成的所有检查和配置。

## ✅ 代码清理

- [x] 删除调试端点 `api/payment-debug.js`
- [x] 限制测试端点 `api/admin-test.js`（生产环境默认禁用）
- [x] 清理前端代码中的调试残留（`testInitData` 等）
- [x] 验证所有环境变量配置正确

## 🔒 安全配置

### 必需的环境变量（后端）

确保在 Vercel Dashboard 中配置以下环境变量：

- [ ] `SUPABASE_URL` - Supabase 项目 URL
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Supabase Service Role Key
- [ ] `TELEGRAM_BOT_TOKEN` - Telegram Bot Token
- [ ] `TELEGRAM_BOT_USERNAME` - Telegram Bot 用户名
- [ ] `MAKE_WEBHOOK_URL` - Make.com Webhook URL（如果使用）
- [ ] `APP_BASE_URL` - 应用部署后的公共网址（例如：`https://your-project.vercel.app`）
  - **说明**：用于生成推荐链接的 Web 版本
  - **获取方式**：部署后从 Vercel Dashboard → Settings → Domains 获取，或使用默认的 `https://your-project.vercel.app` 格式

### 可选的环境变量（后端）

- [ ] `ADMINS` - 管理员用户ID列表（逗号分隔，例如：`123456789,987654321`）
- [ ] `ALLOWED_ORIGINS` - 允许的跨域来源（如果前后端分离部署）
- [ ] `ENABLE_ADMIN_TEST` - 设置为 `true` 以启用管理员测试端点（**仅用于调试，生产环境不建议启用**）

### 前端环境变量（构建时）

**重要**：生产环境**不应**设置以下开发模式变量：

- [ ] ❌ **不要设置** `VITE_DEV_MODE`（生产环境必须为未设置或 `false`）
- [ ] ❌ **不要设置** `VITE_ALLOW_NON_TELEGRAM`（生产环境必须为未设置或 `false`）

可选的前端环境变量：

- [ ] `VITE_PAYMENTS_BASE_URL` - 如果前后端分离部署，设置为完整 API URL（例如：`https://api.yourproject.com/api`）
  - **注意**：如果前后端在同一域名，**不要设置此变量**，系统会自动使用相对路径 `/api`

## 🗄️ 数据库配置

- [ ] 确认 Supabase 数据库迁移已执行
  - [ ] `001_init.sql` - 初始化表结构
  - [ ] `002_add_admins_table.sql` - 管理员表
  - [ ] `003_optimize_rls_performance.sql` - RLS 性能优化
  - [ ] `004_fix_admins_multiple_policies.sql` - 管理员策略修复

- [ ] 验证数据库表结构正确
  - [ ] `user_credits` 表存在
  - [ ] `payments` 表存在
  - [ ] `referrals` 表存在
  - [ ] `admins` 表存在（如果使用管理员功能）

- [ ] 确认 Row Level Security (RLS) 策略已正确配置

## 🤖 Telegram Bot 配置

- [ ] 确认 Telegram Bot Token 正确
- [ ] 确认 Telegram Bot 用户名正确
- [ ] 设置 Webhook（部署后执行）：
  ```bash
  curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook?url=https://YOUR_DEPLOYMENT_URL/api/webhook&drop_pending_updates=true"
  ```
- [ ] 测试 Bot 基本功能

## 🚀 部署前检查

- [ ] 确认代码已推送到主分支（`main` 或 `master`）
- [ ] 确认所有环境变量已在 Vercel Dashboard 中配置
- [ ] 确认 `vercel.json` 配置正确
- [ ] 确认前端构建命令和输出目录正确

## 📦 部署后验证

### 1. 部署状态检查

- [ ] Vercel Dashboard → Deployments → 确认最新部署状态为 **Ready**
- [ ] 检查部署日志，确认无错误

### 2. 前端验证

- [ ] 访问部署 URL，确认页面正常加载
- [ ] 检查浏览器控制台，确认无严重错误
- [ ] 测试页面基本功能（导航、交互等）

### 3. API 端点验证

```bash
# 健康检查
curl https://your-project.vercel.app/api/health

# 应该返回 JSON 响应，包含服务状态
```

### 4. 功能测试

- [ ] 在 Telegram 中打开 WebApp
- [ ] 测试余额查询功能
- [ ] 测试支付功能（创建发票）
- [ ] 测试图片上传和处理功能（如果已实现）

### 5. 安全验证

- [ ] 确认调试端点不可访问：
  ```bash
  # payment-debug 应该返回 404
  curl https://your-project.vercel.app/api/payment-debug
  
  # admin-test 在生产环境应该返回 404（除非设置了 ENABLE_ADMIN_TEST=true）
  curl https://your-project.vercel.app/api/admin-test
  ```

- [ ] 确认环境变量未暴露在前端代码中
- [ ] 检查 Vercel 函数日志，确认无敏感信息泄露

## 🔍 监控和日志

- [ ] 配置 Vercel 日志监控
- [ ] 配置 Supabase 日志监控（如果可用）
- [ ] 设置错误告警（如果使用监控服务）

## 📝 文档更新

- [ ] 更新部署文档（如果需要）
- [ ] 记录生产环境 URL
- [ ] 记录管理员用户 ID（如果使用）

## ⚠️ 重要提醒

1. **永远不要在生产环境设置开发模式变量**：
   - `VITE_DEV_MODE`
   - `VITE_ALLOW_NON_TELEGRAM`

2. **调试端点安全**：
   - `payment-debug` 已删除，不会在生产环境暴露
   - `admin-test` 在生产环境默认禁用，除非明确设置 `ENABLE_ADMIN_TEST=true`

3. **环境变量安全**：
   - 所有敏感信息（Token、Key 等）只存储在 Vercel Secrets/Environment Variables
   - 永远不要提交敏感信息到代码仓库

4. **定期检查**：
   - 定期检查环境变量配置
   - 定期检查部署日志
   - 定期轮换密钥（建议每 3-6 个月）

## 🆘 故障排除

如果遇到问题，请参考：

- [DEPLOYMENT.md](./DEPLOYMENT.md) - 详细部署指南
- [VERCEL_CONFIGURATION.md](./VERCEL_CONFIGURATION.md) - Vercel 配置说明
- Vercel Dashboard → Deployments → 查看部署日志

