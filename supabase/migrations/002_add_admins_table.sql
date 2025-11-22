-- 管理员表
CREATE TABLE IF NOT EXISTS admins (
  telegram_user_id BIGINT PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 添加测试管理员 (chatid: 1740576312 来自质量评估文档)
INSERT INTO admins (telegram_user_id, role) VALUES 
  (1740576312, 'admin')
ON CONFLICT (telegram_user_id) DO NOTHING;

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_admins_updated_at 
  BEFORE UPDATE ON admins 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- 设置RLS策略
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- 管理员可以查看所有记录
CREATE POLICY "admins_can_read_all" ON admins
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE telegram_user_id = COALESCE(current_setting('app.current_user_id', true)::BIGINT, 0)
    )
  );

-- 只有超级管理员可以修改管理员表
CREATE POLICY "super_admins_can_modify" ON admins
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE telegram_user_id = COALESCE(current_setting('app.current_user_id', true)::BIGINT, 0)
      AND role = 'super_admin'
    )
  );

-- 授予权限
GRANT SELECT ON admins TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON admins TO authenticated;