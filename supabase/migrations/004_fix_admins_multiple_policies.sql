-- 修复 admins 表的多个允许策略问题
-- PostgreSQL 不支持在 FOR 子句中使用多个操作，需要为每个操作创建单独的策略
-- 这样可以避免多个允许策略的性能问题

-- 删除旧的策略（如果存在）
DROP POLICY IF EXISTS "super_admins_can_modify" ON admins;

-- 为 INSERT 创建策略
CREATE POLICY "super_admins_can_insert" ON admins
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE telegram_user_id = COALESCE((SELECT current_setting('app.current_user_id', true))::BIGINT, 0)
      AND role = 'super_admin'
    )
  );

-- 为 UPDATE 创建策略
CREATE POLICY "super_admins_can_update" ON admins
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE telegram_user_id = COALESCE((SELECT current_setting('app.current_user_id', true))::BIGINT, 0)
      AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE telegram_user_id = COALESCE((SELECT current_setting('app.current_user_id', true))::BIGINT, 0)
      AND role = 'super_admin'
    )
  );

-- 为 DELETE 创建策略
CREATE POLICY "super_admins_can_delete" ON admins
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE telegram_user_id = COALESCE((SELECT current_setting('app.current_user_id', true))::BIGINT, 0)
      AND role = 'super_admin'
    )
  );

