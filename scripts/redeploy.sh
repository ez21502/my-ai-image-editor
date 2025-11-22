#!/bin/bash

# 重新部署脚本 - 用于 Vercel 项目重新部署
# 此脚本将代码推送到 GitHub，Vercel 会自动触发部署

echo "🚀 开始重新部署到 Vercel..."

# 检查是否在 Git 仓库中
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ 错误: 当前目录不是 Git 仓库"
    exit 1
fi

# 1. 检查 Git 状态
echo "📋 检查 Git 状态..."
git status

# 2. 检查是否有未提交的更改
if [ -z "$(git status --porcelain)" ]; then
    echo "⚠️  警告: 没有未提交的更改"
    read -p "是否继续推送到远程仓库? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ 操作已取消"
        exit 1
    fi
fi

# 3. 添加所有更改
echo "📦 添加所有更改..."
git add .

# 4. 创建提交（如果没有提供提交消息，使用默认消息）
COMMIT_MSG="${1:-feat: 更新项目配置}"
echo "💾 创建提交: $COMMIT_MSG"
git commit -m "$COMMIT_MSG"

# 5. 获取当前分支名
CURRENT_BRANCH=$(git branch --show-current)
echo "🌿 当前分支: $CURRENT_BRANCH"

# 6. 推送到 GitHub
echo "🔄 推送到 GitHub..."
if git push origin "$CURRENT_BRANCH"; then
    echo ""
    echo "✅ 代码已推送到 GitHub！"
    echo ""
    echo "📋 下一步："
    echo "1. Vercel 会自动检测到推送并触发部署"
    echo "2. 访问 https://vercel.com/dashboard 查看部署状态"
    echo "3. 等待部署完成（通常 1-3 分钟）"
    echo ""
    echo "⚠️  确保已在 Vercel 中配置以下环境变量/Secrets："
    echo "- SUPABASE_URL (或 @supabase_url Secret)"
    echo "- SUPABASE_SERVICE_ROLE_KEY (或 @supabase_service_role_key Secret)"
    echo "- TELEGRAM_BOT_TOKEN (或 @telegram_token Secret)"
    echo "- TELEGRAM_BOT_USERNAME (或 @bot_username Secret)"
    echo "- MAKE_WEBHOOK_URL (或 @make_webhook_url Secret)"
    echo "- APP_BASE_URL (或 @app_base_url Secret)"
    echo ""
    echo "📖 查看 DEPLOYMENT.md 了解详细配置说明"
else
    echo ""
    echo "❌ 推送失败，请检查："
    echo "1. Git 远程仓库配置是否正确"
    echo "2. 是否有推送权限"
    echo "3. 网络连接是否正常"
    exit 1
fi