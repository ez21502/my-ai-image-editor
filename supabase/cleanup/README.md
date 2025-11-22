# Supabase 修复指南

## 问题诊断

基于后端 API 代码分析，发现以下潜在问题：

### 🔍 主要问题
1. **权限配置错误** - anon 和 authenticated 角色权限不足
2. **表结构不完整** - 可能缺少必要的表或字段
3. **索引缺失** - 影响查询性能
4. **环境变量配置** - SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY 可能未正确设置

### 🔧 后端依赖分析
从 `server/api/_shared.js` 分析：
- 使用 `@supabase/supabase-js` 客户端
- 依赖环境变量：`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- 核心表：`user_credits`, `payments`, `referrals`
- 关键操作：查询、插入、更新用户积分

## 修复方案

### 🚀 快速修复（推荐）
执行 `emergency_fix.sql`：
```sql
-- 修复权限和表结构
GRANT SELECT ON user_credits TO anon;
GRANT ALL ON user_credits TO authenticated;
-- ... 更多修复
```

### 🔧 完整修复
执行 `comprehensive_fix.sql`：
- 完整诊断当前状态
- 修复所有表结构
- 优化索引配置
- 验证修复结果

### 🎯 核心修复点

#### 1. 权限修复（最关键）
```sql
-- 为用户积分表设置权限
GRANT SELECT ON user_credits TO anon;
GRANT SELECT, INSERT, UPDATE ON user_credits TO authenticated;
GRANT ALL ON user_credits TO service_role;
```

#### 2. 表结构修复
```sql
-- 确保核心表存在且结构正确
CREATE TABLE IF NOT EXISTS user_credits (
  telegram_user_id BIGINT PRIMARY KEY,
  credits INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3. 索引优化
```sql
-- 创建必要索引提升性能
CREATE INDEX IF NOT EXISTS idx_user_credits_user ON user_credits(telegram_user_id);
```

## 环境变量检查

确保 Vercel 环境变量正确设置：
```
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
TELEGRAM_TOKEN=your_bot_token
MAKE_WEBHOOK_URL=your_make_webhook_url
BOT_USERNAME=your_bot_username
APP_BASE_URL=your_app_url
```

## 验证步骤

1. **执行修复脚本**后，检查表结构
2. **测试 API 端点**确保无权限错误
3. **验证积分功能**正常工作
4. **检查支付流程**完整可用

## 常见错误修复

### ❌ "permission denied for table user_credits"
**解决：** 执行权限修复脚本

### ❌ "relation does not exist"
**解决：** 创建缺失的表结构

### ❌ "connection refused"
**解决：** 检查环境变量配置

## 文件位置

所有修复脚本位于：
- `e:\my-ai-image-editor\supabase\cleanup\emergency_fix.sql` - 快速修复
- `e:\my-ai-image-editor\supabase\cleanup\comprehensive_fix.sql` - 完整修复
- `e:\my-ai-image-editor\supabase\cleanup\check_tables.sql` - 状态检查