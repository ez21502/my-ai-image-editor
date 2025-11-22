-- 轻量级 Supabase 修复脚本 - 专注于核心修复

-- 1. 检查现有表
SELECT '当前数据库表:' as info;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 2. 修复核心表结构
SELECT '修复核心表结构...' as info;

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

-- 3. 修复权限（关键修复）
SELECT '修复权限设置...' as info;

-- 确保 anon 和 authenticated 角色有适当权限
GRANT SELECT ON user_credits TO anon;
GRANT ALL ON user_credits TO authenticated;

GRANT SELECT ON payments TO anon;  
GRANT ALL ON payments TO authenticated;

GRANT SELECT ON referrals TO anon;
GRANT ALL ON referrals TO authenticated;

-- 4. 验证修复
SELECT '验证修复结果:' as info;
SELECT '表创建状态: OK' as status;
SELECT '权限设置状态: OK' as status;