# Git 历史清理脚本
# 从所有 Git 历史记录中删除包含敏感信息的文件

Write-Host "开始清理 Git 历史记录..." -ForegroundColor Yellow

# 要删除的文件列表
$filesToRemove = @(
    "VERCEL_SETUP_GUIDE.md",
    "vercel-env-setup.md",
    "QUICK_START.md",
    "DEPLOYMENT_GUIDE.md",
    "TESTING_GUIDE.md"
)

# 创建备份分支
Write-Host "创建备份分支 backup-before-cleanup..." -ForegroundColor Cyan
git branch backup-before-cleanup

# 使用 git filter-branch 从所有历史中删除这些文件
Write-Host "从 Git 历史中删除敏感文件..." -ForegroundColor Cyan
$filesPattern = $filesToRemove -join "|"

git filter-branch --force --index-filter `
    "git rm --cached --ignore-unmatch VERCEL_SETUP_GUIDE.md vercel-env-setup.md QUICK_START.md DEPLOYMENT_GUIDE.md TESTING_GUIDE.md" `
    --prune-empty --tag-name-filter cat -- --all

if ($LASTEXITCODE -eq 0) {
    Write-Host "Git 历史清理完成！" -ForegroundColor Green
    
    # 清理引用
    Write-Host "清理引用..." -ForegroundColor Cyan
    git for-each-ref --format="%(refname)" refs/original/ | ForEach-Object { git update-ref -d $_ }
    git reflog expire --expire=now --all
    git gc --prune=now --aggressive
    
    Write-Host "`n清理完成！" -ForegroundColor Green
    Write-Host "`n下一步操作：" -ForegroundColor Yellow
    Write-Host "1. 检查清理结果：git log --all --oneline" -ForegroundColor White
    Write-Host "2. 如果满意，强制推送到 GitHub：" -ForegroundColor White
    Write-Host "   git push origin --force --all" -ForegroundColor White
    Write-Host "   git push origin --force --tags" -ForegroundColor White
    Write-Host "`n警告：强制推送会覆盖远程仓库的历史记录！" -ForegroundColor Red
    Write-Host "如果出现问题，可以使用备份分支恢复：git checkout backup-before-cleanup" -ForegroundColor Yellow
} else {
    Write-Host "清理失败！请检查错误信息。" -ForegroundColor Red
}

