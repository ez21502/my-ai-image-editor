-- 修复 Supabase 数据库 - 清理和优化脚本

-- 第一步：检查当前所有表
SELECT '=== 当前数据库表 ===' as info;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 第二步：删除不需要的表（如果有）
-- 这里可以根据实际情况添加需要删除的表
-- DROP TABLE IF EXISTS unnecessary_table CASCADE;

-- 第三步：确保核心表存在且结构正确
SELECT '=== 创建/更新核心表 ===' as info;

-- 用户积分表
CREATE TABLE IF NOT EXISTS user_credits (
  telegram_user_id BIGINT PRIMARY KEY,
  credits INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 支付记录表
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id BIGINT NOT NULL,
  xtr_amount INT NOT NULL,
  credits_added INT NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL,
  payment_ref TEXT UNIQUE,
  payload JSONB
);

-- 推荐关系表
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id BIGINT NOT NULL,
  invitee_id BIGINT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 第四步：修复权限设置
SELECT '=== 修复权限设置 ===' as info;

-- 为用户积分表设置权限
GRANT SELECT ON user_credits TO anon;
GRANT SELECT, INSERT, UPDATE ON user_credits TO authenticated;

-- 为支付记录表设置权限
GRANT SELECT ON payments TO anon;
GRANT SELECT, INSERT ON payments TO authenticated;

-- 为推荐关系表设置权限
GRANT SELECT ON referrals TO anon;
GRANT SELECT, INSERT ON referrals TO authenticated;

-- 第五步：验证修复结果
SELECT '=== 验证表结构 ===' as info;

-- 检查表结构
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('user_credits', 'payments', 'referrals')
ORDER BY table_name, ordinal_position;

-- 检查权限
SELECT '=== 验证权限 ===' as info;
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
AND table_name IN ('user_credits', 'payments', 'referrals')
AND grantee IN ('anon', 'authenticated') 
ORDER BY table_name, grantee;

SELECT '=== 数据库修复完成 ===' as info;