const { SUPABASE, getUserIdFromInitData, ensureUserWithWelcomeCredit, verifyInitData } = require('./_shared')
const { validateInitData, createErrorResponse, createSuccessResponse } = require('./_validation')
const { balanceRateLimiter } = require('./_rateLimit')
const { createLoggingMiddleware } = require('./_shared')
const { corsMiddleware, handleOptions } = require('./_cors')

module.exports = async (req, res) => {
  // 应用 CORS 中间件
  corsMiddleware(req, res, () => {})
  
  // 处理 OPTIONS 预检请求
  if (req.method === 'OPTIONS') {
    return handleOptions(req, res)
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json(createErrorResponse('Method not allowed'))
  }

  try {
    const { initData } = req.query
    
    // 输入验证
    if (!initData) {
      return res.status(400).json(createErrorResponse('Missing initData'))
    }
    
    // 验证 initData 格式
    const initDataValidation = validateInitData(initData)
    if (!initDataValidation.valid) {
      return res.status(400).json(createErrorResponse('Validation failed', initDataValidation.error))
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
    if (!userId) {
      return res.status(400).json(createErrorResponse('Cannot extract user ID'))
    }
    
    // 设置用户ID用于速率限制
    req.userId = userId
    
    // 应用速率限制
    const rateLimitMiddleware = balanceRateLimiter.middleware('balance')
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

    // 获取用户积分（如果是新用户，会自动创建并赠送3点算力）
    const credits = await ensureUserWithWelcomeCredit(userId)

    return res.status(200).json(createSuccessResponse({ 
      credits,
      userId
    }))

  } catch (error) {
    console.error('Get balance error:', error)
    return res.status(500).json(createErrorResponse('Internal server error', error.message))
  }
}
