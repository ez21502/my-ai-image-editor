# 创建发票失败故障排除指南

## 错误信息
```
创建发票失败: A server error has occurred
```

## 快速检查清单

### 1. 环境变量配置
检查 Vercel Dashboard → Settings → Environment Variables 中是否配置了：

- [ ] `TELEGRAM_BOT_TOKEN` - Telegram Bot Token（**必需**）
- [ ] `TELEGRAM_BOT_USERNAME` - Telegram Bot 用户名（可选，但建议配置）
- [ ] `SUPABASE_URL` - Supabase 项目 URL（**必需**）
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Supabase Service Role Key（**必需**）

**检查方法：**
```bash
# 在 Vercel Dashboard 中检查环境变量
# 或使用 Vercel CLI
vercel env ls
```

### 2. 检查 Vercel 函数日志
在 Vercel Dashboard → Deployments → 选择最新部署 → Functions → `api/create-invoice` → Logs

**查找以下错误：**

#### 2.1 缺少 Token
```
Missing TELEGRAM_BOT_TOKEN configuration
```
**解决方案：** 在 Vercel 环境变量中添加 `TELEGRAM_BOT_TOKEN`

#### 2.2 网络错误
```
Telegram Bot API fetch error
Network error: Unable to connect to Telegram API
```
**可能原因：**
- Vercel 函数无法访问 Telegram API
- 网络超时
- Telegram API 临时不可用

**解决方案：**
- 等待几分钟后重试
- 检查 Vercel 函数执行时间限制
- 检查是否有防火墙或网络限制

#### 2.3 Telegram API 错误
```
Bot API error response
Error 400: Bad Request
```
**可能原因：**
- Bot Token 无效或已过期
- 发票数据格式错误
- Bot 未启用支付功能

**解决方案：**
1. 验证 Bot Token 是否有效：
   ```bash
   curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getMe
   ```
2. 确认 Bot 已启用支付功能（在 @BotFather 中配置）
3. 检查 SKU 配置是否正确

#### 2.4 配置错误
```
Invalid XTR amount
Invalid SKU - no mapping found
```
**解决方案：** 检查 `api/_shared.js` 中的 `SKU_MAP` 配置

### 3. 常见问题诊断

#### 问题 1: Bot Token 未配置或无效
**症状：**
- 日志显示 "Missing TELEGRAM_BOT_TOKEN"
- 或 "Invalid token" 错误

**解决步骤：**
1. 在 Telegram 中打开 @BotFather
2. 使用 `/token` 命令获取或重置 Bot Token
3. 在 Vercel Dashboard → Settings → Environment Variables 中添加：
   - 变量名：`TELEGRAM_BOT_TOKEN`
   - 值：从 @BotFather 获取的 Token
4. 重新部署应用

#### 问题 2: Bot 未启用支付功能
**症状：**
- Telegram API 返回 "Bad Request" 或 "Method not found"

**解决步骤：**
1. 在 Telegram 中打开 @BotFather
2. 选择你的 Bot
3. 选择 "Payments" → "Enable Payments"
4. 按照提示完成配置

#### 问题 3: 网络连接问题
**症状：**
- 日志显示 "fetch error" 或 "ECONNREFUSED"
- 请求超时

**解决步骤：**
1. 检查 Vercel 函数执行时间（默认 10 秒，Pro 计划可延长）
2. 检查是否有网络限制或防火墙
3. 尝试增加重试次数（前端已实现自动重试）

#### 问题 4: Supabase 配置问题
**症状：**
- 日志显示 Supabase 相关错误
- 无法记录审计日志

**解决步骤：**
1. 检查 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY` 是否正确
2. 确认 Supabase 项目处于活动状态
3. 检查 Supabase 数据库表是否已创建（`audit_logs` 表）

### 4. 详细日志分析

改进后的错误处理会记录以下信息：

```json
{
  "level": "ERROR",
  "message": "Create invoice unexpected error",
  "userId": "123456789",
  "sku": "pack12",
  "error": "错误消息",
  "errorName": "Error",
  "stack": "错误堆栈",
  "requestId": "请求ID",
  "env": {
    "hasToken": true,
    "hasSupabase": true,
    "nodeEnv": "production"
  }
}
```

**关键字段：**
- `hasToken`: 是否配置了 Bot Token
- `hasSupabase`: 是否配置了 Supabase
- `error`: 具体错误消息
- `requestId`: 用于追踪的请求ID

### 5. 测试步骤

#### 5.1 本地测试（如果可能）
```bash
# 设置环境变量
export TELEGRAM_BOT_TOKEN="your_token"
export SUPABASE_URL="your_url"
export SUPABASE_SERVICE_ROLE_KEY="your_key"

# 运行本地服务器
npm run dev

# 测试创建发票
curl -X POST http://localhost:3000/api/create-invoice \
  -H "Content-Type: application/json" \
  -d '{
    "initData": "your_init_data",
    "sku": "pack12"
  }'
```

#### 5.2 生产环境测试
1. 在 Telegram 中打开你的 Mini App
2. 尝试创建发票
3. 如果失败，检查：
   - 浏览器控制台（F12）中的错误
   - Vercel 函数日志
   - 网络请求详情

### 6. 错误代码参考

改进后的错误响应包含 `errorCode` 字段：

- `NETWORK_ERROR` - 网络连接问题
- `CONFIG_ERROR` - 服务器配置错误
- `PARSE_ERROR` - 响应解析错误
- `UNKNOWN_ERROR` - 未知错误

### 7. 联系支持

如果以上步骤都无法解决问题，请提供以下信息：

1. **错误详情：**
   - 完整的错误消息
   - 错误代码（如果有）
   - 请求ID（如果有）

2. **环境信息：**
   - Vercel 部署 URL
   - 部署时间
   - 使用的 SKU

3. **日志信息：**
   - Vercel 函数日志（从 Vercel Dashboard 复制）
   - 浏览器控制台错误（如果有）

4. **配置信息：**
   - 是否配置了所有必需的环境变量
   - Bot Token 是否有效
   - Bot 是否启用了支付功能

## 预防措施

1. **定期检查环境变量**：确保所有必需的环境变量都已配置
2. **监控日志**：定期查看 Vercel 函数日志，及时发现问题
3. **测试部署**：每次部署后测试支付功能
4. **备份配置**：记录所有环境变量的配置（但不要提交到代码仓库）

## 相关文档

- [DEPLOYMENT.md](./DEPLOYMENT.md) - 部署指南
- [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) - 生产环境检查清单
- [VERCEL_CONFIGURATION.md](./VERCEL_CONFIGURATION.md) - Vercel 配置说明

