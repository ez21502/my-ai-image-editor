# 测试数据模板
# 用于沙盒环境测试

## 用户数据
{
  "telegram_user_id": 1740576312,
  "credits": 100
}

## 支付数据  
{
  "telegram_user_id": 1740576312,
  "xtr_amount": 10,
  "credits_added": 100,
  "payment_ref": "test_payment_001"
}

## 推荐数据
{
  "inviter_id": 1740576312,
  "invitee_id": 123456789
}

## 测试用例
1. 余额查询 - GET /api/balance?initData=VALID
2. 创建发票 - GET /api/create-invoice?initData=VALID&sku=test_credits_10  
3. 管理员测试 - GET /api/admin-test?initData=ADMIN_DATA