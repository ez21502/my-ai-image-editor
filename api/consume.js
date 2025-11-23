const { SUPABASE, getUserIdFromInitData, consumeOneCredit, verifyInitData, ensureUserWithWelcomeCredit } = require('./_shared')
const { validateRequiredFields, validateBase64Image, validatePrompt, validateChatId, validateInitData, createErrorResponse, createSuccessResponse } = require('./_validation')
const { consumeRateLimiter } = require('./_rateLimit')
const { createLoggingMiddleware } = require('./_shared')
const { corsMiddleware, handleOptions } = require('./_cors')

module.exports = async (req, res) => {
  // 应用 CORS 中间件
  corsMiddleware(req, res, () => {})
  
  // 处理 OPTIONS 预检请求
  if (req.method === 'OPTIONS') {
    return handleOptions(req, res)
  }
  
  // 应用日志中间件
  const loggingMiddleware = createLoggingMiddleware()
  loggingMiddleware(req, res, () => {})
  
  if (req.method !== 'POST') {
    return res.status(405).json(createErrorResponse('Method not allowed'))
  }

  try {
    const { initData, composite_image_base64, prompt, chat_id } = req.body
    let userIdVar = null
    
    // 输入验证
    const requiredValidation = validateRequiredFields(req.body, ['initData', 'composite_image_base64', 'prompt', 'chat_id'])
    if (!requiredValidation.valid) {
      return res.status(400).json(createErrorResponse('Validation failed', requiredValidation.error))
    }
    
    // 验证 initData 格式
    const initDataValidation = validateInitData(initData)
    if (!initDataValidation.valid) {
      return res.status(400).json(createErrorResponse('Validation failed', initDataValidation.error))
    }
    
    // 验证 base64 图片数据
    const imageValidation = validateBase64Image(composite_image_base64)
    if (!imageValidation.valid) {
      return res.status(400).json(createErrorResponse('Validation failed', imageValidation.error))
    }
    
    // 验证 prompt
    const promptValidation = validatePrompt(prompt)
    if (!promptValidation.valid) {
      return res.status(400).json(createErrorResponse('Validation failed', promptValidation.error))
    }
    
    // 验证 chat_id
    const chatIdValidation = validateChatId(chat_id)
    if (!chatIdValidation.valid) {
      return res.status(400).json(createErrorResponse('Validation failed', chatIdValidation.error))
    }

    // 验证 initData
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) {
      return res.status(500).json(createErrorResponse('Server configuration error', 'Missing Telegram token'))
    }

    // 完整的 initData 验证
    const isValid = verifyInitData(initData, token)
    if (!isValid) {
      return res.status(401).json(createErrorResponse('Invalid initData'))
    }
    
    const userId = getUserIdFromInitData(initData)
    userIdVar = userId
    if (!userId) {
      return res.status(400).json(createErrorResponse('Cannot extract user ID'))
    }
    
    // 设置用户ID用于速率限制
    req.userId = userId
    
    // 应用速率限制
    const rateLimitMiddleware = consumeRateLimiter.middleware('consume')
    let rateLimitResult = null
    let rateLimitError = null
    
    // 手动调用速率限制中间件
    rateLimitMiddleware(req, res, (error) => {
      if (error) {
        rateLimitError = error
      }
    })
    
    if (rateLimitError) {
      return // 速率限制中间件已经发送了响应
    }

    // 确保新用户有欢迎积分（如果是新用户，会自动创建并赠送3点算力）
    await ensureUserWithWelcomeCredit(userId)

    // 消耗一个积分
    const ok = await consumeOneCredit(userId)
    if (!ok) {
      req.auditLogger.logUserAction(userId, 'consume_credit_failed', { 
        reason: 'insufficient_credits',
        prompt: prompt.substring(0, 100) // 记录部分prompt用于调试
      })
      return res.status(402).json(createErrorResponse('insufficient_credits', '积分不足，请先充值'))
    }
    
    // 记录积分消耗审计
    req.auditLogger.logUserAction(userId, 'consume_credit_success', { 
      prompt: prompt.substring(0, 100),
      imageSize: composite_image_base64.length
    })

    // 调用 Make Webhook 处理重绘任务
    const makeWebhookUrl = process.env.MAKE_WEBHOOK_URL
    if (!makeWebhookUrl) {
      return res.status(500).json(createErrorResponse('server_configuration_error', 'Webhook URL not configured'))
    }
    const payload = {
      composite_image_base64,
      prompt,
      chat_id: String(chat_id || userId)
    }

    // 添加超时控制 (30秒)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)
    
    let response
    try {
      response = await fetch(makeWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      })
    } finally {
      clearTimeout(timeoutId)
    }

    if (!response.ok) {
      // 如果 Make Webhook 失败，返还积分
      const uid = req.userId || userIdVar
      const { data: userData } = await SUPABASE.from('user_credits')
        .select('credits')
        .eq('telegram_user_id', uid)
        .limit(1)
        .maybeSingle()
      
      if (userData) {
        await SUPABASE.from('user_credits')
          .update({ credits: userData.credits + 1 })
          .eq('telegram_user_id', uid)
      }
      
      req.auditLogger.logUserAction(userId, 'webhook_failed_credit_refunded', {
        webhookStatus: response.status,
        previousBalance: userData?.credits || 0,
        newBalance: (userData?.credits || 0) + 1
      })
      
      return res.status(500).json(createErrorResponse('webhook_failed', '任务处理失败，积分已返还'))
    }

    return res.status(200).json(createSuccessResponse({
      message: '任务已提交，正在处理中'
    }))

  } catch (error) {
    console.error('Consume credit error:', error)
    
    // 处理超时错误
    if (error.name === 'AbortError') {
      // 超时也需要返还积分
      const uid = req.userId || userIdVar
      const { data: userData } = await SUPABASE.from('user_credits')
        .select('credits')
        .eq('telegram_user_id', uid)
        .limit(1)
        .maybeSingle()
      
      if (userData) {
        await SUPABASE.from('user_credits')
          .update({ credits: userData.credits + 1 })
          .eq('telegram_user_id', uid)
      }
      
      req.auditLogger.logUserAction(userId, 'webhook_timeout_credit_refunded', {
        previousBalance: userData?.credits || 0,
        newBalance: (userData?.credits || 0) + 1
      })
      
      return res.status(504).json(createErrorResponse('webhook_timeout', '任务处理超时，积分已返还'))
    }
    
    return res.status(500).json(createErrorResponse('Internal server error', error.message))
  }
}
