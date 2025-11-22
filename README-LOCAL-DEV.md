# 本地开发调试指南

本指南将帮助你设置本地开发环境，用于调试 API 函数。

## 📋 前置要求

- Node.js 18+ 
- npm 或 yarn

## 🚀 快速开始

### 1. 安装依赖

```bash
# 安装根目录依赖（本地开发服务器）
npm install

# 安装前端依赖
cd frontend
npm install
cd ..
```

### 2. 配置环境变量

创建 `.env.local` 文件（在项目根目录）：

```bash
# 复制示例文件
cp .env.local.example .env.local
```

然后编辑 `.env.local` 文件，填入你的实际配置：

```env
# Supabase 配置
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Telegram Bot 配置
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_BOT_USERNAME=your_bot_username

# Webhook 配置
MAKE_WEBHOOK_URL=your_make_webhook_url
APP_BASE_URL=http://localhost:3000

# 本地开发服务器端口
PORT=3000
```

### 3. 启动开发服务器

#### 方式一：分别启动（推荐用于调试）

**终端 1 - 启动 API 服务器（在项目根目录）：**
```bash
npm run dev:api
```

**终端 2 - 启动前端开发服务器：**

**选项 A：在项目根目录运行**
```bash
npm run dev:frontend
```

**选项 B：在 frontend 目录运行**
```bash
cd frontend
npm run dev
```

#### 方式二：同时启动（使用 concurrently）

```bash
npm run dev
```

### 4. 访问应用

- **前端**: http://localhost:5173
- **API 服务器**: http://localhost:3000
- **API 健康检查**: http://localhost:3000/api/health

## 🔧 前端环境变量配置

在 `frontend` 目录创建 `.env.local` 文件（可选）：

```env
# 本地开发时，前端会自动使用 http://localhost:3000/api
# 如果需要自定义，可以设置：
VITE_PAYMENTS_BASE_URL=http://localhost:3000/api

# 开发模式（允许非 Telegram 环境测试）
VITE_DEV_MODE=true
VITE_ALLOW_NON_TELEGRAM=true
```

## 🧪 测试 API

### 健康检查
```bash
curl http://localhost:3000/api/health
```

### 测试创建发票（需要有效的 initData）
```bash
curl -X POST http://localhost:3000/api/create-invoice \
  -H "Content-Type: application/json" \
  -d '{
    "initData": "your_telegram_init_data",
    "sku": "pack30"
  }'
```

### 测试查询余额
```bash
curl "http://localhost:3000/api/balance?initData=your_telegram_init_data"
```

## 🐛 调试技巧

### 1. 查看 API 服务器日志

API 服务器会在控制台输出所有请求日志：
```
[2024-01-01T12:00:00.000Z] POST /api/create-invoice
```

### 2. 查看前端控制台

打开浏览器开发者工具（F12），查看 Console 标签页，可以看到：
- API 请求 URL
- 请求参数
- 响应数据
- 错误信息

### 3. 常见问题排查

#### 问题：前端仍在使用生产环境 URL（CORS 错误）

**症状**：
- 控制台显示：`Access to fetch at 'https://traemy-ai-image-editorxtor.vercel.app/...' has been blocked by CORS policy`
- 请求 URL 是生产环境地址而不是 `http://localhost:3000/api`

**原因**：
- `VITE_PAYMENTS_BASE_URL` 环境变量被设置为生产环境 URL
- 浏览器或 Vite 缓存了旧的配置

**解决方案**：
1. **检查环境变量**：确保没有在系统环境变量或 `.env` 文件中设置 `VITE_PAYMENTS_BASE_URL` 为生产环境 URL
2. **清除 Vite 缓存并重启**：
   ```bash
   # 停止前端服务器（Ctrl+C）
   # 清除 Vite 缓存
   cd frontend
   rm -rf node_modules/.vite
   # 或者 Windows PowerShell:
   Remove-Item -Recurse -Force node_modules\.vite -ErrorAction SilentlyContinue
   
   # 重启前端服务器
   npm run dev
   ```
3. **清除浏览器缓存**：按 `Ctrl+Shift+R` 强制刷新，或清除浏览器缓存
4. **创建本地环境变量文件**（可选）：
   在 `frontend` 目录创建 `.env.local` 文件（会被 gitignore 忽略）：
   ```env
   VITE_PAYMENTS_BASE_URL=http://localhost:3000/api
   ```
   然后重启前端服务器

#### 问题：404 错误 "The page could not be found"

**原因**：API 路径不正确

**解决方案**：
1. 检查 `paymentsBaseUrl` 配置是否正确
2. 确认 API 服务器正在运行
3. 检查 API 文件是否存在：`api/create-invoice.js`

#### 问题：CORS 错误

**原因**：跨域请求被阻止

**解决方案**：
- 本地开发服务器已配置 CORS，支持 `localhost:5173` 和 `localhost:3000`
- 如果仍有问题，检查浏览器控制台的错误信息

#### 问题：环境变量未加载

**原因**：`.env.local` 文件不存在或格式错误

**解决方案**：
1. 确认 `.env.local` 文件在项目根目录
2. 检查文件格式（每行一个变量，使用 `KEY=value` 格式）
3. 重启 API 服务器

## 📝 API 端点列表

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/create-invoice` | POST | 创建支付发票 |
| `/api/balance` | GET | 查询用户余额 |
| `/api/consume` | POST | 消耗积分 |
| `/api/referral-link` | GET | 获取推荐链接 |
| `/api/webhook` | POST | Telegram Webhook |

## 🔄 热重载

- **前端**：Vite 自动支持热重载
- **API 服务器**：支持热重载（自动清除 require 缓存）

修改 API 文件后，无需重启服务器，直接刷新浏览器即可。

## 🛑 停止服务器

按 `Ctrl+C` 停止服务器。

## 📚 更多信息

- [Vercel 部署配置](./VERCEL_CONFIGURATION.md)
- [部署指南](./DEPLOYMENT.md)

