# Git 历史记录清理脚本
# 从所有 Git 历史记录中删除包含敏感信息的文件

Write-Host "🔍 开始清理 Git 历史记录..." -ForegroundColor Yellow

# 需要删除的文件列表
$filesToRemove = @(
    "QUICK_START.md",
    "VERCEL_SETUP_GUIDE.md",
    "vercel-env-setup.md",
    "DEPLOYMENT_GUIDE.md",
    "TESTING_GUIDE.md"
)

Write-Host "📋 要删除的文件:" -ForegroundColor Cyan
foreach ($file in $filesToRemove) {
    Write-Host "  - $file" -ForegroundColor Gray
}

# 检查是否有未提交的更改
$status = git status --porcelain
if ($status) {
    Write-Host "⚠️  警告: 有未提交的更改，请先提交或暂存" -ForegroundColor Yellow
    Write-Host "建议执行: git stash" -ForegroundColor Yellow
    exit 1
}

# 创建备份分支
$backupBranch = "backup-before-history-cleanup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Write-Host "💾 创建备份分支: $backupBranch" -ForegroundColor Cyan
git branch $backupBranch

# 使用 git filter-branch 删除文件
Write-Host "🧹 开始清理历史记录（这可能需要几分钟）..." -ForegroundColor Yellow

$filesPattern = $filesToRemove -join "|"
git filter-branch --force --index-filter `
    "git rm --cached --ignore-unmatch QUICK_START.md VERCEL_SETUP_GUIDE.md vercel-env-setup.md DEPLOYMENT_GUIDE.md TESTING_GUIDE.md" `
    --prune-empty --tag-name-filter cat -- --all

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Git 历史记录清理完成！" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 下一步操作:" -ForegroundColor Cyan
    Write-Host "1. 检查清理结果: git log --all --oneline" -ForegroundColor Gray
    Write-Host "2. 强制推送到 GitHub: git push origin --force --all" -ForegroundColor Gray
    Write-Host "3. 强制推送标签: git push origin --force --tags" -ForegroundColor Gray
    Write-Host ""
    Write-Host "⚠️  警告: 强制推送会覆盖远程历史记录，请确保所有协作者已同步！" -ForegroundColor Red
} else {
    Write-Host "❌ 清理失败，请检查错误信息" -ForegroundColor Red
    exit 1
}





