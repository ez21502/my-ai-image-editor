-- Supabase 迁移文件 - 创建支付系统所需的三张核心表

-- 用户积分表：存储用户的算力点余额
CREATE TABLE IF NOT EXISTS user_credits (
  telegram_user_id BIGINT PRIMARY KEY,
  credits INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 支付记录表：记录所有 Stars 支付历史
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id BIGINT NOT NULL,
  xtr_amount INT NOT NULL,
  credits_added INT NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL,
  payment_ref TEXT UNIQUE,
  payload JSONB,
  status TEXT DEFAULT 'pending',
  error TEXT
);

-- 推荐关系表：跟踪用户邀请关系
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id BIGINT NOT NULL,
  invitee_id BIGINT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 为匿名用户和认证用户授予基本权限
GRANT SELECT ON user_credits TO anon;
GRANT SELECT ON user_credits TO authenticated;
GRANT ALL ON user_credits TO authenticated;

GRANT SELECT ON payments TO anon;
GRANT SELECT ON payments TO authenticated;
GRANT ALL ON payments TO authenticated;

GRANT SELECT ON referrals TO anon;
GRANT SELECT ON referrals TO authenticated;
GRANT ALL ON referrals TO authenticated;