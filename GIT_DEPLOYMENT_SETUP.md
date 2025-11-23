# Git 仓库和 Vercel 自动部署配置指南

## ✅ 已完成

1. ✅ Git 仓库已初始化
2. ✅ 已创建 `.gitignore` 文件
3. ✅ 所有文件已添加到 Git
4. ✅ 已创建初始提交

## 📋 下一步：连接远程仓库

### 1. 在 GitHub/GitLab 创建新仓库

1. 访问 [GitHub](https://github.com/new) 或 [GitLab](https://gitlab.com/projects/new)
2. 创建新仓库（建议命名为 `my-ai-image-editor`）
3. **不要**初始化 README、.gitignore 或 license（仓库已包含这些）

### 2. 连接本地仓库到远程仓库

在项目根目录执行以下命令（替换 `<your-repo-url>` 为你的仓库地址）：

```bash
# GitHub 示例
git remote add origin https://github.com/your-username/my-ai-image-editor.git

# 或者使用 SSH
git remote add origin git@github.com:your-username/my-ai-image-editor.git
```

### 3. 推送代码到远程仓库

```bash
# 重命名分支为 main（如果默认是 master）
git branch -M main

# 推送代码
git push -u origin main
```

## 🚀 配置 Vercel 自动部署

### 方法 1：通过 Vercel 控制台（推荐）

1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 点击 **"Add New..."** → **"Project"**
3. 选择你刚创建的 Git 仓库
4. Vercel 会自动检测项目配置：
   - **Framework Preset**: 会自动检测为 "Other" 或 "Vite"
   - **Root Directory**: 保持为空（根目录）
   - **Build Command**: 留空（Vercel 会自动处理）
   - **Output Directory**: 留空（Vercel 会自动处理）

5. **配置环境变量**：
   在 "Environment Variables" 部分，添加以下变量：
   - `SUPABASE_URL` → 使用 `@supabase_url`（Vercel 会自动从 Vercel Secrets 获取）
   - `SUPABASE_SERVICE_ROLE_KEY` → 使用 `@supabase_service_role_key`
   - `TELEGRAM_BOT_TOKEN` → 使用 `@telegram_token`
   - `MAKE_WEBHOOK_URL` → 使用 `@make_webhook_url`
   - `TELEGRAM_BOT_USERNAME` → 使用 `@bot_username`
   - `APP_BASE_URL` → 使用 `@app_base_url`

6. 点击 **"Deploy"**

### 方法 2：通过 Vercel CLI

```bash
# 安装 Vercel CLI（如果还没有）
npm i -g vercel

# 登录
vercel login

# 在项目根目录链接项目
vercel link

# 部署到生产环境
vercel --prod
```

## 🔄 自动部署工作流

配置完成后，每次你执行以下操作时，Vercel 会自动部署：

```bash
# 1. 修改代码后，提交更改
git add .
git commit -m "描述你的更改"

# 2. 推送到远程仓库
git push origin main

# Vercel 会自动检测推送并触发部署！
```

## 📝 项目结构说明

- **`api/`**: Vercel Serverless Functions（后端 API）
- **`frontend/`**: React + Vite 前端应用
- **`vercel.json`**: Vercel 配置文件
- **`.gitignore`**: Git 忽略文件配置

## ⚙️ Vercel 配置说明

当前 `vercel.json` 配置：
- 后端 API 路由：`/api/*` → `api/*.js`
- 函数最大执行时间：30 秒
- 环境变量通过 Vercel Secrets 管理

## 🔍 验证部署

部署完成后，你可以：

1. 检查部署状态：访问 Vercel Dashboard
2. 测试 API 端点：`https://your-project.vercel.app/api/health`
3. 访问前端：`https://your-project.vercel.app`

## 🛠️ 故障排除

### 如果部署失败：

1. 检查 Vercel 部署日志
2. 确认所有环境变量已正确配置
3. 检查 `vercel.json` 配置是否正确
4. 确认代码已正确推送到 Git 仓库

### 如果需要更新 Git 用户信息：

```bash
git config user.name "你的名字"
git config user.email "你的邮箱"
```

## 📚 相关文档

- [Vercel Git 集成文档](https://vercel.com/docs/concepts/git)
- [Vercel 环境变量文档](https://vercel.com/docs/concepts/projects/environment-variables)
- [Git 基础命令](https://git-scm.com/docs)

---

**提示**：配置完成后，每次 `git push` 都会自动触发 Vercel 部署，无需手动操作！






