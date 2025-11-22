#!/bin/bash

# 重新部署脚本 - 用于 Vercel 项目重新部署
# 项目: my-ai-image-editor-fc7blcgqx-ez21502s-projects.vercel.app

echo "🚀 开始重新部署到 Vercel..."

# 1. 检查 Git 状态
echo "📋 检查 Git 状态..."
git status

# 2. 添加所有更改
echo "📦 添加所有更改..."
git add .

# 3. 创建提交
echo "💾 创建提交..."
git commit -m "feat: 重新配置 Vercel 部署，集成 Telegram Stars 支付系统

- 修复 Vercel 配置文件
- 添加后端 API 路由
- 集成 Supabase 数据库
- 配置 Telegram Stars 支付
- 添加推荐奖励系统"

# 4. 推送到 GitHub
echo "🔄 推送到 GitHub..."
git push origin master

# 5. 提供后续步骤
echo ""
echo "✅ 代码已推送到 GitHub！"
echo ""
echo "📋 下一步："
echo "1. 访问 https://vercel.com/dashboard"
echo "2. 找到项目: my-ai-image-editor-fc7blcgqx-ez21502s-projects"
echo "3. 点击 'Redeploy' 按钮重新部署"
echo "4. 等待部署完成"
echo ""
echo "🔗 项目地址: https://my-ai-image-editor-fc7blcgqx-ez21502s-projects.vercel.app"
echo ""
echo "⚠️  确保已配置以下环境变量："
echo "- SUPABASE_URL"
echo "- SUPABASE_SERVICE_ROLE_KEY"
echo "- TELEGRAM_TOKEN"
echo "- BOT_USERNAME"
echo "- MAKE_WEBHOOK_URL"
echo "- APP_BASE_URL"