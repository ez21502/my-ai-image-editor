const { SUPABASE, SKU_MAP, verifyInitData, getUserIdFromInitData } = require('./_shared')
const { validateRequiredFields, validateSKU, createErrorResponse, createSuccessResponse } = require('./_validation')
const { invoiceRateLimiter } = require('./_rateLimit')
const { isTestMode, isTestSKU, getTestSKUs } = require('./_test')
const { createLogger, logAudit } = require('./_shared')
const { corsMiddleware, handleOptions } = require('./_cors')

module.exports = async (req, res) => {
  const requestId = Math.random().toString(36).substr(2, 9)
  const logger = createLogger('create-invoice', requestId)
  
  // 应用 CORS 中间件
  corsMiddleware(req, res, () => {})
  
  // 处理 OPTIONS 预检请求
  if (req.method === 'OPTIONS') {
    return handleOptions(req, res)
  }
  
  if (req.method !== 'POST') {
    logger.warn('Method not allowed', { method: req.method })
    return res.status(405).json(createErrorResponse('Method not allowed'))
  }

  try {
    const { initData, sku } = req.body
    
    logger.info('Creating invoice', { userId: 'unknown', sku, isTestMode: isTestMode() })
    
    // 输入验证
    const requiredValidation = validateRequiredFields(req.body, ['initData', 'sku'])
    if (!requiredValidation.valid) {
      logger.warn('Validation failed', { error: requiredValidation.error })
      return res.status(400).json(createErrorResponse('Validation failed', requiredValidation.error))
    }
    
    // 验证 SKU
    const skuValidation = validateSKU(sku)
    if (!skuValidation.valid) {
      return res.status(400).json(createErrorResponse('Validation failed', skuValidation.error))
    }

    // 开发模式支持
    const isDevMode = initData === 'dev_test_init_data_123456789'
    
    if (!isDevMode) {
      // 验证 initData
      const token = process.env.TELEGRAM_BOT_TOKEN
      if (!token) {
        return res.status(500).json({ error: 'Server configuration error' })
      }

      if (!verifyInitData(initData, token)) {
        return res.status(401).json(createErrorResponse('Invalid initData'))
      }
    }

    let userId
    if (isDevMode) {
      // 开发模式使用固定用户ID
      userId = 123456789
      logger.info('Development mode detected', { userId })
    } else {
      userId = getUserIdFromInitData(initData)
      if (!userId) {
        logger.warn('Cannot extract user ID from initData')
        return res.status(400).json(createErrorResponse('Cannot extract user ID'))
      }
    }
    
    logger.info('Invoice creation validated', { userId, sku })
    
    // 设置用户ID用于速率限制
    req.userId = userId
    
    // 应用速率限制
    const rateLimitMiddleware = invoiceRateLimiter.middleware('invoice')
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

    // 获取商品配置（支持测试SKU）
    let mapping = SKU_MAP[sku]
    
    // 如果启用测试模式且是测试SKU，使用测试配置
    if (isTestMode() && isTestSKU(sku)) {
      mapping = getTestSKUs()[sku]
      logger.info('Using test SKU configuration', { userId, sku, mapping })
    }
    
    if (!mapping) {
      return res.status(400).json(createErrorResponse('Invalid SKU'))
    }

    // 调用 Telegram Bot API 创建发票链接
    const botApiUrl = `https://api.telegram.org/bot${token}/createInvoiceLink`
    const invoiceData = {
      title: 'AI图片编辑算力点',
      description: `${mapping.label} - 可用于AI图片重绘`,
      payload: JSON.stringify({ userId, sku }),
      provider_token: '', // Stars支付不需要provider_token
      currency: 'XTR', // Stars货币
      prices: [{
        label: mapping.label,
        amount: mapping.xtr // Stars数量
      }]
    }

    const response = await fetch(botApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoiceData)
    })

    const result = await response.json()

    if (!result.ok) {
      logger.error('Bot API error', { userId, sku, error: result.description || 'Unknown error' })
      return res.status(500).json(createErrorResponse('Failed to create invoice', result.description || 'Unknown error'))
    }

    logAudit({
      userId,
      action: 'invoice_created',
      details: { sku, xtrAmount: mapping.xtr, credits: mapping.credits }
    })

    logger.info('Invoice created successfully', { userId, sku, invoiceLink: result.result })

    return res.status(200).json(createSuccessResponse({ 
      invoiceLink: result.result 
    }))

  } catch (error) {
    logger.error('Create invoice error', { userId: 'unknown', sku: req.body?.sku, error: error.message })
    return res.status(500).json(createErrorResponse('Internal server error', error.message))
  }
}
