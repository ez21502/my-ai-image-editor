# 沙盒环境部署与测试指南

## 环境准备

### 1. 创建测试环境
- **Vercel项目**: 创建新的Vercel项目用于测试
- **Supabase项目**: 创建独立的Supabase项目
- **Telegram Bot**: 创建测试Bot（@BotFather）

### 2. 环境变量配置
复制 `.env.sandbox.example` 为 `.env.sandbox` 并填写：

```bash
# Telegram Bot配置
TELEGRAM_BOT_TOKEN=你的测试Bot Token
TELEGRAM_BOT_USERNAME=你的测试Bot用户名

# Supabase配置  
SUPABASE_URL=你的测试Supabase URL
SUPABASE_SERVICE_ROLE_KEY=你的测试Service Role Key

# 应用配置
VITE_PAYMENTS_BASE_URL=https://你的测试域名.vercel.app/api
APP_BASE_URL=https://你的测试域名.vercel.app
MAKE_WEBHOOK_URL=你的Make.com Webhook URL

# 管理员配置
ADMINS=1740576312,123456789
```

### 3. 数据库迁移
执行管理员表迁移：
```bash
# 在Supabase控制台执行
supabase/migrations/002_add_admins_table.sql
```

## 测试清单

### ✅ 基础功能测试
1. **WebApp加载测试**
   - 在Telegram中打开WebApp
   - 验证页面正常加载
   - 检查控制台错误

2. **图片上传测试**
   - 上传小于3MB的图片
   - 验证上传成功
   - 检查预览功能

3. **支付功能测试**
   - 创建发票：`/api/create-invoice`
   - 验证支付后余额增加
   - 检查支付记录

4. **余额查询测试**
   - 正常查询余额
   - 测试推荐奖励
   - 验证积分变化

### ✅ 管理员功能测试
1. **管理员权限验证**
   ```bash
   curl -X GET "https://你的测试域名.vercel.app/api/admin-test?initData=ADMIN_INIT_DATA"
   ```

2. **系统统计查看**（仅超级管理员）
   - 用户总数统计
   - 支付记录查看
   - 推荐关系查询

### ✅ 边界条件测试
1. **错误处理测试**
   - 无效参数处理
   - 网络超时处理
   - 重复支付处理

2. **性能测试**
   - 并发请求处理
   - 大图片处理
   - 弱网环境测试

## 问题反馈流程

### 1. 问题报告模板
```
问题类型: [功能错误/性能问题/用户体验]
发生时间: [具体时间]
用户ID: [Telegram用户ID]
操作步骤: [详细步骤]
错误信息: [控制台错误/响应错误]
截图: [相关截图]
环境: [测试/生产]
```

### 2. 紧急回滚流程

#### 代码回滚
```bash
# Vercel控制台回滚到上一个版本
# 或使用Vercel CLI
vercel rollback [deployment-url]
```

#### 数据回滚
```sql
-- 撤销错误支付记录
UPDATE payments SET status = 'cancelled' WHERE payment_ref = '错误支付ID';

-- 恢复用户积分
UPDATE user_credits SET credits = credits - 错误积分 WHERE telegram_user_id = 用户ID;

-- 撤销推荐关系
DELETE FROM referrals WHERE invitee_id = 被推荐人ID;
```

## 验收标准

### ✅ 功能验收
- [ ] WebApp正常打开
- [ ] 图片上传成功
- [ ] 支付功能正常
- [ ] 余额正确显示
- [ ] 推荐功能工作
- [ ] 管理员功能可用

### ✅ 性能验收
- [ ] 页面加载时间 < 3秒
- [ ] API响应时间 < 500ms
- [ ] 并发处理正常
- [ ] 错误率 < 1%

### ✅ 安全验收
- [ ] 身份验证正确
- [ ] 支付验证完整
- [ ] 管理员权限控制
- [ ] 审计日志完整

## 联系方式
- 技术支持: [您的联系方式]
- 问题反馈: [问题反馈渠道]
- 紧急联系: [紧急联系方式]