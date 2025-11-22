-- 优化 RLS 策略性能
-- 修复性能顾问发现的问题：
-- 1. 使用 (select current_setting(...)) 来避免每行重新评估
-- 2. 合并 admins 表的多个允许策略
-- 3. 删除未使用的索引（可选，但建议保留以备将来使用）

-- ============================================
-- 1. 优化 user_credits 表的 RLS 策略
-- ============================================

-- 删除旧的策略
DROP POLICY IF EXISTS "users_can_view_own_credits" ON user_credits;
DROP POLICY IF EXISTS "users_can_update_own_credits" ON user_credits;

-- 创建优化后的策略（使用 select 包装 current_setting）
CREATE POLICY "users_can_view_own_credits" ON user_credits
  FOR SELECT
  TO anon, authenticated
  USING (
    telegram_user_id = COALESCE((SELECT current_setting('app.telegram_user_id', true))::BIGINT, 0)
  );

CREATE POLICY "users_can_update_own_credits" ON user_credits
  FOR UPDATE
  TO anon, authenticated
  USING (
    telegram_user_id = COALESCE((SELECT current_setting('app.telegram_user_id', true))::BIGINT, 0)
  )
  WITH CHECK (
    telegram_user_id = COALESCE((SELECT current_setting('app.telegram_user_id', true))::BIGINT, 0)
  );

-- ============================================
-- 2. 优化 payments 表的 RLS 策略
-- ============================================

-- 删除旧的策略
DROP POLICY IF EXISTS "users_can_view_own_payments" ON payments;
DROP POLICY IF EXISTS "users_can_create_own_payments" ON payments;

-- 创建优化后的策略
CREATE POLICY "users_can_view_own_payments" ON payments
  FOR SELECT
  TO anon, authenticated
  USING (
    telegram_user_id = COALESCE((SELECT current_setting('app.telegram_user_id', true))::BIGINT, 0)
  );

CREATE POLICY "users_can_create_own_payments" ON payments
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    telegram_user_id = COALESCE((SELECT current_setting('app.telegram_user_id', true))::BIGINT, 0)
  );

-- ============================================
-- 3. 优化 referrals 表的 RLS 策略
-- ============================================

-- 删除旧的策略
DROP POLICY IF EXISTS "users_can_view_own_referrals" ON referrals;
DROP POLICY IF EXISTS "users_can_create_own_referrals" ON referrals;

-- 创建优化后的策略
CREATE POLICY "users_can_view_own_referrals" ON referrals
  FOR SELECT
  TO anon, authenticated
  USING (
    inviter_id = COALESCE((SELECT current_setting('app.telegram_user_id', true))::BIGINT, 0)
    OR invitee_id = COALESCE((SELECT current_setting('app.telegram_user_id', true))::BIGINT, 0)
  );

CREATE POLICY "users_can_create_own_referrals" ON referrals
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    inviter_id = COALESCE((SELECT current_setting('app.telegram_user_id', true))::BIGINT, 0)
    OR invitee_id = COALESCE((SELECT current_setting('app.telegram_user_id', true))::BIGINT, 0)
  );

-- ============================================
-- 4. 优化 admins 表的 RLS 策略（合并多个允许策略）
-- ============================================

-- 删除旧的策略
DROP POLICY IF EXISTS "admins_can_read_all" ON admins;
DROP POLICY IF EXISTS "super_admins_can_modify" ON admins;

-- 创建合并后的策略（使用 select 包装 current_setting）
-- 管理员可以查看所有记录
CREATE POLICY "admins_can_read_all" ON admins
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE telegram_user_id = COALESCE((SELECT current_setting('app.current_user_id', true))::BIGINT, 0)
    )
  );

-- 只有超级管理员可以修改管理员表
-- 注意：PostgreSQL 不支持在 FOR 子句中使用多个操作，需要为每个操作创建单独的策略
-- 这些策略在 004_fix_admins_multiple_policies.sql 中定义

-- ============================================
-- 5. 删除未使用的索引（可选）
-- ============================================
-- 注意：这些索引可能在未来有用，所以暂时保留
-- 如果确实不需要，可以取消下面的注释来删除它们

-- DROP INDEX IF EXISTS idx_payments_user;
-- DROP INDEX IF EXISTS idx_referrals_inviter;

-- ============================================
-- 完成
-- ============================================
-- 所有 RLS 策略已优化，使用 (select current_setting(...)) 来避免每行重新评估
-- 这将显著提高查询性能，特别是在处理大量数据时

