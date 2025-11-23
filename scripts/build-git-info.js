const { execSync } = require('child_process')
const fs = require('fs')

try {
  const commitSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
  const shortSha = commitSha.substring(0, 7)
  const commitMessage = execSync('git log -1 --pretty=%B', { encoding: 'utf8' }).trim()
  const commitDate = execSync('git log -1 --pretty=%ci', { encoding: 'utf8' }).trim()
  const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim()
  
  const gitInfo = {
    commitSha,
    shortSha,
    commitMessage,
    commitDate,
    branch
  }
  
  fs.writeFileSync('git-info.json', JSON.stringify(gitInfo, null, 2))
  console.log('✅ Git 信息已写入 git-info.json')
  console.log('版本:', shortSha)
  console.log('提交信息:', commitMessage)
} catch (error) {
  console.error('❌ 获取Git信息失败:', error.message)
  // 创建默认文件
  const defaultInfo = {
    commitSha: null,
    shortSha: null,
    commitMessage: 'Unknown',
    commitDate: new Date().toISOString(),
    branch: 'main'
  }
  fs.writeFileSync('git-info.json', JSON.stringify(defaultInfo, null, 2))
  process.exit(1)
}