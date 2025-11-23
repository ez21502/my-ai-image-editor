const { SUPABASE, SKU_MAP, verifyInitData, getUserIdFromInitData } = require('./_shared')
const { validateRequiredFields, validateSKU, createErrorResponse, createSuccessResponse } = require('./_validation')
const { invoiceRateLimiter } = require('./_rateLimit')
const { isTestMode, isTestSKU, getTestSKUs } = require('./_test')
const { createLogger, logAudit } = require('./_shared')
const { corsMiddleware, handleOptions } = require('./_cors')

module.exports = async (req, res) => {
  const requestId = Math.random().toString(36).substr(2, 9)
  const logger = createLogger('create-invoice', requestId)
  
  // 处理 OPTIONS 预检请求（必须在CORS中间件之前）
  if (req.method === 'OPTIONS') {
    return handleOptions(req, res)
  }
  
  // 应用 CORS 中间件
  corsMiddleware(req, res, () => {})
  
  if (req.method !== 'POST') {
    logger.warn('Method not allowed', { method: req.method, url: req.url })
    return res.status(405).json(createErrorResponse('Method not allowed', `Expected POST, got ${req.method}`))
  }

  try {
    const { initData, sku } = req.body
    
    logger.info('Creating invoice request received', { 
      hasInitData: !!initData, 
      sku, 
      isTestMode: isTestMode(),
      requestId 
    })
    
    // 输入验证
    const requiredValidation = validateRequiredFields(req.body, ['initData', 'sku'])
    if (!requiredValidation.valid) {
      logger.warn('Validation failed - missing required fields', { 
        error: requiredValidation.error,
        body: { hasInitData: !!req.body.initData, hasSku: !!req.body.sku }
      })
      return res.status(400).json(createErrorResponse('Validation failed', requiredValidation.error))
    }
    
    // 验证 SKU
    const skuValidation = validateSKU(sku)
    if (!skuValidation.valid) {
      logger.warn('Validation failed - invalid SKU', { sku, error: skuValidation.error })
      return res.status(400).json(createErrorResponse('Invalid SKU', skuValidation.error))
    }

    // 获取 Telegram Bot Token（必须在所有模式下都可用）
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) {
      logger.error('Missing TELEGRAM_BOT_TOKEN configuration', {
        hasToken: !!process.env.TELEGRAM_BOT_TOKEN,
        envKeys: Object.keys(process.env).filter(k => k.includes('TELEGRAM'))
      })
      return res.status(500).json(createErrorResponse(
        'Server configuration error', 
        'Missing TELEGRAM_BOT_TOKEN. Please configure the bot token in environment variables.'
      ))
    }

    // 验证 initData
    const isValidInitData = verifyInitData(initData, token)
    if (!isValidInitData) {
      logger.warn('Invalid initData', { 
        hasInitData: !!initData,
        initDataLength: initData?.length,
        initDataPreview: initData?.substring(0, 50)
      })
      return res.status(401).json(createErrorResponse(
        'Invalid initData', 
        'The provided initData is invalid or has been tampered with. Please ensure you are using the app from Telegram.'
      ))
    }

    const userId = getUserIdFromInitData(initData)
    if (!userId) {
      logger.warn('Cannot extract user ID from initData', {
        hasInitData: !!initData,
        initDataPreview: initData?.substring(0, 100)
      })
      return res.status(400).json(createErrorResponse(
        'Cannot extract user ID', 
        'Unable to extract user ID from initData. Please ensure you are using the app from Telegram.'
      ))
    }
    
    logger.info('Invoice creation validated', { userId, sku })
    
    // 设置用户ID用于速率限制
    req.userId = userId
    
    // 应用速率限制
    try {
      const rateLimitMiddleware = invoiceRateLimiter.middleware('invoice')
      let rateLimitPassed = false
      
      // 手动调用速率限制中间件
      rateLimitMiddleware(req, res, (error) => {
        if (error) {
          logger.warn('Rate limit exceeded', { userId, error: error.message })
          // 速率限制中间件已经发送了响应
          return
        }
        rateLimitPassed = true
      })
      
      // 如果速率限制失败，中间件已经发送响应，直接返回
      if (!rateLimitPassed && res.headersSent) {
        return
      }
    } catch (rateLimitError) {
      logger.error('Rate limit middleware error', { userId, error: rateLimitError.message })
      // 继续处理，不阻止请求
    }

    // 获取商品配置（支持测试SKU）
    let mapping = SKU_MAP[sku]
    
    // 如果启用测试模式且是测试SKU，使用测试配置
    if (isTestMode() && isTestSKU(sku)) {
      mapping = getTestSKUs()[sku]
      logger.info('Using test SKU configuration', { userId, sku, mapping })
    }
    
    if (!mapping) {
      logger.warn('Invalid SKU - no mapping found', { userId, sku, availableSKUs: Object.keys(SKU_MAP) })
      return res.status(400).json(createErrorResponse(
        'Invalid SKU', 
        `SKU "${sku}" is not available. Valid options: ${Object.keys(SKU_MAP).join(', ')}`
      ))
    }

    // 调用 Telegram Bot API 创建发票链接
    const botApiUrl = `https://api.telegram.org/bot${token}/createInvoiceLink`
    
    // 验证价格数据
    if (!mapping.xtr || mapping.xtr <= 0) {
      logger.error('Invalid XTR amount', { userId, sku, xtr: mapping.xtr })
      return res.status(400).json(createErrorResponse(
        'Invalid price configuration', 
        `Invalid XTR amount for SKU ${sku}: ${mapping.xtr}`
      ))
    }
    
    const safeLabel = mapping.label || `测试算力点${mapping.credits || ''}`.trim()
    const invoiceData = {
      title: 'AI图片编辑算力点',
      description: `${safeLabel} - 可用于AI图片重绘`,
      payload: JSON.stringify({ userId, sku }),
      provider_token: '', // Stars支付不需要provider_token
      currency: 'XTR', // Stars货币
      prices: [{
        label: safeLabel,
        amount: mapping.xtr // Stars数量
      }]
    }
    
    // 验证发票数据完整性
    if (!invoiceData.title || !invoiceData.description || !invoiceData.payload) {
      logger.error('Invalid invoice data', { userId, sku, invoiceData })
      return res.status(500).json(createErrorResponse(
        'Invalid invoice configuration', 
        'Missing required invoice fields'
      ))
    }

    logger.debug('Calling Telegram Bot API', { 
      botApiUrl: botApiUrl.replace(token, '***'),
      invoiceData: { ...invoiceData, payload: '***' }
    })

    let response
    let result
    
    try {
      response = await fetch(botApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceData)
      })

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`
        try {
          const errorText = await response.text()
          // 尝试解析为 JSON 以获取更详细的错误信息
          try {
            const errorJson = JSON.parse(errorText)
            if (errorJson.description) {
              errorMessage = errorJson.description
            } else if (errorJson.error_code) {
              errorMessage = `Error ${errorJson.error_code}: ${errorJson.description || 'Unknown error'}`
            } else {
              errorMessage = errorText.substring(0, 200) || errorMessage
            }
          } catch {
            // 如果不是 JSON，使用原始文本（限制长度）
            errorMessage = errorText.substring(0, 200) || errorMessage
          }
        } catch (e) {
          logger.warn('Failed to read error response body', { error: e.message })
        }
        
        logger.error('Telegram Bot API HTTP error', { 
          userId, 
          sku, 
          status: response.status,
          statusText: response.statusText,
          errorMessage
        })
        return res.status(500).json(createErrorResponse(
          'Failed to create invoice', 
          errorMessage
        ))
      }

      result = await response.json()
    } catch (fetchError) {
      logger.error('Telegram Bot API fetch error', { 
        userId, 
        sku, 
        error: fetchError.message,
        stack: fetchError.stack
      })
      return res.status(500).json(createErrorResponse(
        'Failed to create invoice', 
        `Network error: ${fetchError.message}. Please check your internet connection and try again.`
      ))
    }

    if (!result.ok) {
      // 安全提取错误消息
      const errorDescription = result.description || result.error_code 
        ? `Error ${result.error_code}: ${result.description || 'Unknown error'}` 
        : 'Unknown error from Telegram API'
      
      logger.error('Bot API error response', { 
        userId, 
        sku, 
        error: errorDescription,
        errorCode: result.error_code,
        fullResponse: result
      })
      return res.status(500).json(createErrorResponse(
        'Failed to create invoice', 
        errorDescription
      ))
    }

    if (!result.result) {
      logger.error('Bot API returned no invoice link', { userId, sku, result })
      return res.status(500).json(createErrorResponse(
        'Failed to create invoice', 
        'Telegram API did not return an invoice link'
      ))
    }

    logAudit({
      userId,
      action: 'invoice_created',
      details: { sku, xtrAmount: mapping.xtr, credits: mapping.credits, invoiceLink: result.result }
    })

    logger.info('Invoice created successfully', { 
      userId, 
      sku, 
      invoiceLink: result.result,
      xtrAmount: mapping.xtr,
      credits: mapping.credits
    })

    return res.status(200).json(createSuccessResponse({ 
      invoiceLink: result.result 
    }))

  } catch (error) {
    // 详细记录错误信息（生产环境也需要详细日志用于调试）
    logger.error('Create invoice unexpected error', { 
      userId: req.userId || 'unknown', 
      sku: req.body?.sku, 
      error: error.message,
      errorName: error.name,
      stack: error.stack,
      requestId,
      env: {
        hasToken: !!process.env.TELEGRAM_BOT_TOKEN,
        hasSupabase: !!SUPABASE,
        nodeEnv: process.env.NODE_ENV
      }
    })
    
    // 根据错误类型提供更有用的错误信息
    let userFriendlyMessage = 'An unexpected error occurred. Please try again later.'
    let errorCode = 'UNKNOWN_ERROR'
    
    if (error.message) {
      // 网络错误
      if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
        userFriendlyMessage = 'Network error: Unable to connect to Telegram API. Please check your internet connection and try again.'
        errorCode = 'NETWORK_ERROR'
      }
      // 配置错误
      else if (error.message.includes('TELEGRAM_BOT_TOKEN') || error.message.includes('configuration')) {
        userFriendlyMessage = 'Server configuration error. Please contact support.'
        errorCode = 'CONFIG_ERROR'
      }
      // JSON 解析错误
      else if (error.message.includes('JSON') || error.message.includes('parse')) {
        userFriendlyMessage = 'Invalid response from server. Please try again.'
        errorCode = 'PARSE_ERROR'
      }
      // 开发环境显示详细错误
      else if (process.env.NODE_ENV === 'development') {
        userFriendlyMessage = error.message
      }
    }
    
    return res.status(500).json(createErrorResponse(
      'Internal server error', 
      userFriendlyMessage,
      { errorCode, requestId } // 提供错误代码和请求ID用于追踪
    ))
  }
}
