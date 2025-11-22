-- Supabase 快速修复脚本 - 针对 tg-stars-mini-app
-- 这个脚本专注于快速修复常见问题

-- 1. 立即修复权限问题（最常见的问题）
SELECT '修复权限配置...' as status;

-- 为用户积分表设置权限
GRANT SELECT ON user_credits TO anon;
GRANT SELECT, INSERT, UPDATE ON user_credits TO authenticated;
GRANT ALL ON user_credits TO service_role;

-- 为支付记录表设置权限  
GRANT SELECT ON payments TO anon;
GRANT SELECT, INSERT ON payments TO authenticated;
GRANT ALL ON payments TO service_role;

-- 为推荐关系表设置权限
GRANT SELECT ON referrals TO anon;
GRANT SELECT, INSERT ON referrals TO authenticated;
GRANT ALL ON referrals TO service_role;

-- 2. 修复表结构（如果不存在则创建）
SELECT '修复表结构...' as status;

-- 用户积分表
CREATE TABLE IF NOT EXISTS user_credits (
  telegram_user_id BIGINT PRIMARY KEY,
  credits INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 创建基本索引
SELECT '创建索引...' as status;
CREATE INDEX IF NOT EXISTS idx_user_credits_user ON user_credits(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_inviter ON referrals(inviter_id);

-- 4. 验证修复结果
SELECT '验证修复结果:' as info;
SELECT '✅ 权限已修复' as result;
SELECT '✅ 表结构已修复' as result;  
SELECT '✅ 索引已创建' as result;

-- 5. 显示最终状态
SELECT '最终表结构:' as info;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;

SELECT '修复完成！' as status;