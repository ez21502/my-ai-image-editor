# 积分查询问题诊断报告

## 📋 诊断时间
2025-11-22

## 🔍 诊断方法
使用 Supabase MCP 工具进行数据库和日志检查

## ✅ 诊断结果

### 1. 数据库状态

#### 表结构 ✅ 正常
- `user_credits` 表存在且结构正确
- 字段：
  - `telegram_user_id` (bigint, 主键)
  - `credits` (integer, 默认值 0)
  - `updated_at` (timestamptz, 默认值 now())

#### 数据库权限 ✅ 正常
- `service_role` 拥有完整的 INSERT、SELECT、UPDATE、DELETE 权限
- 测试插入操作成功，权限验证通过

#### 当前数据状态
- **用户记录数**: 0（表中暂无用户记录）
- 这说明：
  - 要么还没有用户调用过积分查询 API
  - 要么 API 调用失败，没有成功创建用户记录

### 2. 日志分析

#### Supabase API 日志
- 只看到健康检查请求（`/auth/v1/health` 和 `/rest-admin/v1/ready`）
- **没有看到实际的业务 API 调用**（如对 `user_credits` 表的查询或插入）

#### Postgres 日志
- 只显示连接日志
- **没有看到实际的业务查询日志**

### 3. 代码分析

#### `ensureUserWithWelcomeCredit` 函数
**原始实现问题**：
- 日志记录不足，难以诊断问题
- 错误处理不够详细

**已改进**：
- ✅ 添加了详细的日志记录（开始、查询、创建、成功/失败）
- ✅ 改进了错误处理，包含错误代码、消息、详情和提示
- ✅ 添加了时间戳记录

### 4. 安全建议

Supabase 安全顾问建议：
- ⚠️ `user_credits` 表未启用 RLS（行级安全）
- ⚠️ `payments` 表未启用 RLS
- ⚠️ `referrals` 表未启用 RLS

**注意**：由于代码使用 `SUPABASE_SERVICE_ROLE_KEY`，RLS 不影响功能，但建议在生产环境中启用 RLS 以提高安全性。

## 🎯 问题分析

### 可能的原因

1. **API 未被调用**
   - 前端可能没有正确调用 `/api/balance` 端点
   - 或者调用失败，但没有被记录

2. **API 调用失败**
   - initData 验证失败
   - 网络错误
   - CORS 问题

3. **日志查看位置错误**
   - 用户查看的是 Supabase 的健康检查日志，而不是业务 API 日志
   - 实际的 API 日志应该在 Vercel 的 Function Logs 中

## 🔧 已实施的改进

### 1. 增强日志记录
在 `api/_shared.js` 中的 `ensureUserWithWelcomeCredit` 函数：
- 添加了详细的日志记录
- 包含时间戳、用户ID、操作状态
- 错误日志包含完整的错误信息

### 2. 改进错误处理
- 区分查询错误和插入错误
- 提供更详细的错误信息

## 📝 建议的后续步骤

### 1. 检查 Vercel 日志
```bash
# 使用 Vercel CLI 查看日志
vercel logs [deployment-url] --follow

# 或在 Vercel Dashboard 中查看
# Dashboard → Functions → balance → View Logs
```

### 2. 测试 API 端点
```bash
# 测试开发模式
curl "https://your-project.vercel.app/api/balance?initData=dev_test_init_data_123456789"

# 测试真实 initData（需要有效的 Telegram initData）
curl "https://your-project.vercel.app/api/balance?initData=YOUR_INIT_DATA"
```

### 3. 检查前端调用
- 打开浏览器开发者工具
- 查看 Network 标签
- 确认是否有对 `/api/balance` 的请求
- 检查请求和响应内容

### 4. 验证环境变量
确认 Vercel 环境变量已正确配置：
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN`

### 5. 监控数据库
执行以下 SQL 查询，监控用户创建：
```sql
-- 查看所有用户
SELECT * FROM user_credits ORDER BY updated_at DESC LIMIT 10;

-- 查看用户统计
SELECT 
  COUNT(*) as total_users,
  SUM(CASE WHEN credits = 3 THEN 1 ELSE 0 END) as new_users_with_3_credits,
  AVG(credits) as avg_credits
FROM user_credits;
```

## 🚀 部署改进后的代码

改进后的代码已保存到 `api/_shared.js`。部署步骤：

1. **提交更改**
   ```bash
   git add api/_shared.js
   git commit -m "feat: 改进 ensureUserWithWelcomeCredit 函数的日志记录"
   git push
   ```

2. **等待 Vercel 自动部署**
   - Vercel 会自动检测推送并触发部署

3. **验证部署**
   - 检查 Vercel Dashboard 中的部署状态
   - 测试 API 端点
   - 查看新的日志输出

## 📊 预期效果

部署改进后的代码后：
1. **更详细的日志**：可以在 Vercel Function Logs 中看到完整的操作流程
2. **更容易诊断**：如果出现问题，日志会显示具体在哪一步失败
3. **更好的监控**：可以追踪用户创建和积分赠送的过程

## ⚠️ 注意事项

1. **日志位置**：
   - Supabase 日志只显示 Supabase 服务的健康检查
   - 实际的业务 API 日志在 **Vercel Function Logs** 中

2. **数据库权限**：
   - 当前使用 `service_role` 权限，可以绕过 RLS
   - 建议在生产环境中启用 RLS 并配置适当的策略

3. **测试数据**：
   - 已清理测试数据（telegram_user_id = 999999999）
   - 数据库当前为空，等待真实用户调用

## 📞 下一步

1. ✅ 代码改进已完成
2. ⏳ 等待部署到 Vercel
3. ⏳ 测试 API 端点
4. ⏳ 查看 Vercel Function Logs
5. ⏳ 验证用户创建和积分赠送流程

---

**诊断完成时间**: 2025-11-22
**诊断工具**: Supabase MCP, 代码审查
**状态**: ✅ 代码已改进，等待部署验证

