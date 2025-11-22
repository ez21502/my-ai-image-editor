-- 检查当前数据库中的所有表
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 检查表结构
\d user_credits
\d payments  
\d referrals

-- 检查权限设置
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
AND grantee IN ('anon', 'authenticated') 
ORDER BY table_name, grantee;