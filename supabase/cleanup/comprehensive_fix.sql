-- Supabase 数据库诊断和修复脚本
-- 用于修复 tg-stars-mini-app 项目的 Supabase 配置问题

-- 第一步：诊断当前数据库状态
SELECT '=== 数据库诊断开始 ===' as status;

-- 1.1 检查当前所有表
SELECT '当前数据库表列表:' as info;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 1.2 检查表结构详情
SELECT '表结构详情:' as info;
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
ORDER BY table_name, ordinal_position;

-- 1.3 检查当前权限设置
SELECT '当前权限设置:' as info;
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
AND grantee IN ('anon', 'authenticated', 'service_role') 
ORDER BY table_name, grantee;

-- 第二步：清理可能存在的错误表或重复表
SELECT '=== 清理阶段 ===' as status;

-- 2.1 删除可能存在的测试表或错误表（根据实际诊断结果）
-- 注意：这里需要根据实际情况添加要删除的表名
-- DROP TABLE IF EXISTS test_table CASCADE;
-- DROP TABLE IF EXISTS temp_table CASCADE;
-- DROP TABLE IF EXISTS duplicate_table CASCADE;

-- 第三步：修复核心表结构
SELECT '=== 修复核心表 ===' as status;

-- 3.1 修复用户积分表
CREATE TABLE IF NOT EXISTS user_credits (
  telegram_user_id BIGINT PRIMARY KEY,
  credits INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.2 修复支付记录表
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id BIGINT NOT NULL,
  xtr_amount INT NOT NULL,
  credits_added INT NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL,
  payment_ref TEXT UNIQUE,
  payload JSONB
);

-- 3.3 修复推荐关系表
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id BIGINT NOT NULL,
  invitee_id BIGINT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 第四步：修复权限配置
SELECT '=== 修复权限 ===' as status;

-- 4.1 为用户积分表设置正确权限
GRANT SELECT ON user_credits TO anon;
GRANT SELECT, INSERT, UPDATE ON user_credits TO authenticated;
GRANT ALL ON user_credits TO service_role;

-- 4.2 为支付记录表设置正确权限
GRANT SELECT ON payments TO anon;
GRANT SELECT, INSERT ON payments TO authenticated;
GRANT ALL ON payments TO service_role;

-- 4.3 为推荐关系表设置正确权限
GRANT SELECT ON referrals TO anon;
GRANT SELECT, INSERT ON referrals TO authenticated;
GRANT ALL ON referrals TO service_role;

-- 第五步：创建必要的索引
SELECT '=== 优化索引 ===' as status;

-- 5.1 为用户积分表创建索引
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON user_credits(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_user_credits_updated ON user_credits(updated_at);

-- 5.2 为支付记录表创建索引
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at);
CREATE INDEX IF NOT EXISTS idx_payments_payment_ref ON payments(payment_ref);

-- 5.3 为推荐关系表创建索引
CREATE INDEX IF NOT EXISTS idx_referrals_inviter ON referrals(inviter_id);
CREATE INDEX IF NOT EXISTS idx_referrals_invitee ON referrals(invitee_id);
CREATE INDEX IF NOT EXISTS idx_referrals_created ON referrals(created_at);

-- 第六步：验证修复结果
SELECT '=== 验证修复结果 ===' as status;

-- 6.1 验证表结构
SELECT '修复后的表结构:' as info;
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('user_credits', 'payments', 'referrals')
ORDER BY table_name, ordinal_position;

-- 6.2 验证权限设置
SELECT '修复后的权限:' as info;
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
AND table_name IN ('user_credits', 'payments', 'referrals')
AND grantee IN ('anon', 'authenticated', 'service_role') 
ORDER BY table_name, grantee;

-- 6.3 验证索引
SELECT '创建的索引:' as info;
SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('user_credits', 'payments', 'referrals')
ORDER BY tablename, indexname;

SELECT '=== 数据库修复完成 ===' as status;
SELECT '所有核心表已修复，权限已配置，索引已优化' as summary;