# Telegram Bot Setup Guide for AI Image Editor

## BotFather Configuration

### 1. Create Bot with BotFather
```
/start
/newbot
[Enter bot name]
[Enter bot username]
```

### 2. Configure Bot Settings

#### Enable Inline Mode
```
/setinline
[Bot username] Yes
```

#### Set Bot Description
```
/setdescription
AI图片重绘助手 - 使用AI技术重绘您的图片，支持遮罩编辑和智能重绘
```

#### Set Bot About Text
```
/setabouttext
专业AI图片重绘工具，支持遮罩编辑和智能重绘功能
```

#### Set Bot Picture
```
/setuserpic
[Upload AI/art-related image]
```

### 3. Configure Payment Settings

#### Enable Telegram Stars
```
/mybots
[Select your bot]
Bot Settings → Payments → Telegram Stars
```

#### Set Payment Description
```
AI图片重绘算力点 - 用于AI图片重绘服务
```

### 4. Set Bot Commands
```
/setcommands
start - 开始使用AI图片重绘
help - 获取使用帮助
create - 创建新的图片重绘任务
balance - 查看账户余额
topup - 充值算力点
referral - 获取推荐链接
```

## Webhook Configuration

### 1. Set Webhook URL
Replace `YOUR_BOT_TOKEN` and `YOUR_DOMAIN`:
```bash
curl -F "url=https://YOUR_DOMAIN/api/webhook" \
     https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook
```

### 2. Verify Webhook Setup
```bash
curl https://api.telegram.org/botYOUR_BOT_TOKEN/getWebhookInfo
```

### 3. Test Payment Webhook
Send a test payment update:
```bash
curl -X POST https://YOUR_DOMAIN/api/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "update_id": 123456789,
    "message": {
      "message_id": 1,
      "from": {"id": 123456789, "is_bot": false, "first_name": "Test"},
      "chat": {"id": 123456789, "type": "private"},
      "date": 1234567890,
      "successful_payment": {
        "currency": "XTR",
        "total_amount": 100,
        "invoice_payload": "{\"userId\":123456789,\"sku\":\"pack30\"}"
      }
    }
  }'
```

## Environment Variables

Add these to your Vercel deployment:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_BOT_USERNAME=your_bot_username
VITE_PAYMENTS_BASE_URL=https://your-domain.vercel.app
```

## Bot Features Overview

### Payment System
- **Currency**: Telegram Stars (XTR)
- **Packages**: 
  - 12 points = 50 XTR
  - 30 points = 100 XTR  
  - 60 points = 180 XTR
  - 88 points = 250 XTR

### Referral System
- **Referrer Reward**: 1 point per successful referral
- **New User Bonus**: 3 points for new users
- **Referral Link**: Generated via `/referral` command

### Usage Flow
1. User starts bot with `/start`
2. Opens web app via inline button
3. Uploads image and creates mask
4. System checks credits before processing
5. If insufficient credits → shows payment modal
6. After payment → processes image via Make.com webhook
7. Results sent back via bot

## Testing Checklist

- [ ] Bot responds to `/start` command
- [ ] Web app opens correctly
- [ ] Payment modal displays packages
- [ ] Invoice creation works
- [ ] Payment completion updates balance
- [ ] Credit consumption works
- [ ] Referral system functions
- [ ] Make.com webhook integration
- [ ] Results delivery via bot

## Common Issues

### Payment Issues
- Ensure bot has Stars enabled in BotFather
- Check webhook URL is accessible
- Verify invoice payload format

### Web App Issues
- Check `VITE_PAYMENTS_BASE_URL` is correct
- Verify Telegram Web App SDK loads
- Test in different Telegram clients

### Credit System
- Ensure database tables exist
- Check Supabase connection
- Verify RLS policies are correct