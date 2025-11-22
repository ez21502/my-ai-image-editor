# 更新 TELEGRAM_BOT_TOKEN 并重新部署指南

## 📋 步骤概览

1. 更新 Vercel 环境变量 `TELEGRAM_BOT_TOKEN`
2. 删除多余的项目（只保留当前项目）
3. 重新部署项目

## 🔧 方法 1: 使用 Vercel Dashboard（推荐）

### 步骤 1: 更新环境变量

1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 找到你的项目 `my-ai-image-editor`
3. 进入 **Settings** → **Environment Variables**
4. 找到 `TELEGRAM_BOT_TOKEN` 环境变量
5. 点击编辑，更新值为：`7996291998:AAE6j-EfQH2Y7USt9S8dLNqXuguGis58WPE`
6. 确保选择所有环境：**Production**, **Preview**, **Development**
7. 点击 **Save**

### 步骤 2: 删除多余项目

1. 在 Vercel Dashboard 主页查看所有项目
2. 对于每个**不是** `my-ai-image-editor` 的项目：
   - 点击项目进入详情页
   - 进入 **Settings** → **General**
   - 滚动到底部，点击 **Delete Project**
   - 确认删除

### 步骤 3: 重新部署

1. 回到 `my-ai-image-editor` 项目
2. 进入 **Deployments** 标签页
3. 找到最新的部署，点击 **"..."** → **Redeploy**
4. 或者推送代码到 Git 仓库触发自动部署

## 🚀 方法 2: 使用 Vercel CLI

### 安装 Vercel CLI（如果未安装）

```bash
npm install -g vercel
```

### 登录 Vercel

```bash
vercel login
```

### 更新环境变量

```bash
# 设置环境变量（所有环境）
vercel env add TELEGRAM_BOT_TOKEN production preview development

# 输入值：7996291998:AAE6j-EfQH2Y7USt9S8dLNqXuguGis58WPE
```

### 列出并删除多余项目

```bash
# 列出所有项目
vercel projects ls

# 删除项目（替换 PROJECT_NAME 为实际项目名）
vercel projects rm PROJECT_NAME
```

### 重新部署

```bash
# 在项目根目录执行
vercel --prod
```

## 📝 方法 3: 使用 Vercel API（高级）

如果需要通过 API 更新，可以使用以下 curl 命令：

```bash
# 注意：需要先获取 VERCEL_TOKEN 和 PROJECT_ID
# 1. 获取 VERCEL_TOKEN: https://vercel.com/account/tokens
# 2. 获取 PROJECT_ID: 在 Vercel Dashboard 项目设置中查看

# 更新环境变量
curl -X POST "https://api.vercel.com/v10/projects/{PROJECT_ID}/env" \
  -H "Authorization: Bearer {VERCEL_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "TELEGRAM_BOT_TOKEN",
    "value": "7996291998:AAE6j-EfQH2Y7USt9S8dLNqXuguGis58WPE",
    "type": "encrypted",
    "target": ["production", "preview", "development"]
  }'
```

## ✅ 验证部署

部署完成后，验证环境变量是否正确：

1. 访问 `https://your-project.vercel.app/api/health`
2. 检查 Vercel 函数日志，确认没有 `Missing TELEGRAM_BOT_TOKEN` 错误
3. 测试 API 端点是否正常工作

## 🔒 安全提醒

- ✅ 环境变量已正确加密存储在 Vercel
- ✅ Token 不会出现在代码或日志中
- ⚠️ 不要在代码中硬编码 Token
- ⚠️ 不要将 Token 提交到 Git 仓库

