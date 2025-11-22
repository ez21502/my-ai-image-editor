# 更新 TELEGRAM_BOT_TOKEN 并重新部署脚本
# 使用方法: .\update-and-deploy.ps1

$TELEGRAM_BOT_TOKEN = "7996291998:AAE6j-EfQH2Y7USt9S8dLNqXuguGis58WPE"
$PROJECT_NAME = "my-ai-image-editor"

Write-Host "🚀 开始更新 TELEGRAM_BOT_TOKEN 并重新部署..." -ForegroundColor Green
Write-Host ""

# 检查 Vercel CLI 是否安装
Write-Host "📋 检查 Vercel CLI..." -ForegroundColor Yellow
$vercelInstalled = Get-Command vercel -ErrorAction SilentlyContinue

if (-not $vercelInstalled) {
    Write-Host "❌ Vercel CLI 未安装" -ForegroundColor Red
    Write-Host "正在安装 Vercel CLI..." -ForegroundColor Yellow
    npm install -g vercel
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 安装失败，请手动安装: npm install -g vercel" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Vercel CLI 安装成功" -ForegroundColor Green
} else {
    Write-Host "✅ Vercel CLI 已安装" -ForegroundColor Green
}

Write-Host ""
Write-Host "📝 步骤 1: 登录 Vercel（如果需要）" -ForegroundColor Yellow
Write-Host "如果未登录，请在浏览器中完成登录..." -ForegroundColor Gray
vercel login

Write-Host ""
Write-Host "📝 步骤 2: 更新环境变量 TELEGRAM_BOT_TOKEN" -ForegroundColor Yellow
Write-Host "正在更新环境变量..." -ForegroundColor Gray

# 更新环境变量（所有环境）
Write-Host "设置 Production 环境..." -ForegroundColor Gray
echo $TELEGRAM_BOT_TOKEN | vercel env add TELEGRAM_BOT_TOKEN production

Write-Host "设置 Preview 环境..." -ForegroundColor Gray
echo $TELEGRAM_BOT_TOKEN | vercel env add TELEGRAM_BOT_TOKEN preview

Write-Host "设置 Development 环境..." -ForegroundColor Gray
echo $TELEGRAM_BOT_TOKEN | vercel env add TELEGRAM_BOT_TOKEN development

Write-Host "✅ 环境变量更新完成" -ForegroundColor Green

Write-Host ""
Write-Host "📝 步骤 3: 列出所有项目" -ForegroundColor Yellow
vercel projects ls

Write-Host ""
Write-Host "⚠️  请手动检查并删除多余的项目：" -ForegroundColor Yellow
Write-Host "   1. 在 Vercel Dashboard 中查看所有项目" -ForegroundColor Gray
Write-Host "   2. 删除不是 '$PROJECT_NAME' 的项目" -ForegroundColor Gray
Write-Host "   3. 或者使用命令: vercel projects rm PROJECT_NAME" -ForegroundColor Gray

Write-Host ""
$continue = Read-Host "删除多余项目后，按 Enter 继续部署..."

Write-Host ""
Write-Host "📝 步骤 4: 重新部署项目" -ForegroundColor Yellow
Write-Host "正在部署到生产环境..." -ForegroundColor Gray
vercel --prod

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ 部署完成！" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 下一步：" -ForegroundColor Yellow
    Write-Host "   1. 访问 Vercel Dashboard 查看部署状态" -ForegroundColor Gray
    Write-Host "   2. 测试 API 端点是否正常工作" -ForegroundColor Gray
    Write-Host "   3. 验证环境变量是否正确应用" -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "❌ 部署失败，请检查错误信息" -ForegroundColor Red
    exit 1
}

