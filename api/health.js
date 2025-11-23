const { corsMiddleware, handleOptions } = require('./_cors')
const { SUPABASE, SKU_MAP } = require('./_shared')
const { createLogger } = require('./_shared')

module.exports = async (req, res) => {
  const requestId = Math.random().toString(36).substr(2, 9)
  const logger = createLogger('health', requestId)
  
  // 处理 OPTIONS 预检请求
  if (req.method === 'OPTIONS') {
    return handleOptions(req, res)
  }
  
  // 应用 CORS 中间件
  corsMiddleware(req, res, () => {})
  
  if (req.method !== 'GET') {
    logger.warn('Method not allowed', { method: req.method })
    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed',
      allowedMethods: ['GET']
    })
  }

  try {
    const startTime = Date.now()
    
    // 基础健康检查
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      requestId,
      services: {
        supabase: {
          configured: !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          status: 'unknown',
          error: null
        },
        telegram: {
          configured: !!process.env.TELEGRAM_BOT_TOKEN,
          status: 'unknown',
          error: null
        },
        webhook: {
          configured: !!process.env.MAKE_WEBHOOK_URL,
          status: 'unknown'
        },
        payment: {
          configured: false,
          availableSKUs: Object.keys(SKU_MAP).length,
          status: 'unknown'
        }
      }
    }

    // 检查支付系统配置
    health.services.payment.configured = 
      !!process.env.TELEGRAM_BOT_TOKEN && 
      !!process.env.SUPABASE_URL && 
      !!process.env.SUPABASE_SERVICE_ROLE_KEY

    // 检查测试模式状态
    health.testMode = process.env.TEST_MODE === 'true'

    // 测试 Supabase 连接
    if (health.services.supabase.configured) {
      try {
        const { data, error } = await SUPABASE
          .from('user_credits')
          .select('telegram_user_id')
          .limit(1)
        
        if (error) {
          health.services.supabase.status = 'error'
          health.services.supabase.error = error.message
          health.status = 'degraded'
        } else {
          health.services.supabase.status = 'ok'
        }
      } catch (supabaseError) {
        health.services.supabase.status = 'error'
        health.services.supabase.error = supabaseError.message
        health.status = 'degraded'
      }
    } else {
      health.services.supabase.status = 'not_configured'
      health.status = 'degraded'
    }

    // 测试 Telegram Bot API 连接
    if (health.services.telegram.configured) {
      try {
        const token = process.env.TELEGRAM_BOT_TOKEN
        // 创建超时控制器（兼容性处理）
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000) // 5秒超时
        
        const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (response.ok) {
          const result = await response.json()
          if (result.ok) {
            health.services.telegram.status = 'ok'
            health.services.payment.status = health.services.supabase.status === 'ok' ? 'ok' : 'degraded'
          } else {
            health.services.telegram.status = 'error'
            health.services.telegram.error = result.description || 'Unknown error'
            health.services.payment.status = 'error'
            health.status = 'degraded'
          }
        } else {
          health.services.telegram.status = 'error'
          health.services.telegram.error = `HTTP ${response.status}`
          health.services.payment.status = 'error'
          health.status = 'degraded'
        }
      } catch (telegramError) {
        health.services.telegram.status = 'error'
        health.services.telegram.error = telegramError.name === 'AbortError' ? 'Request timeout' : telegramError.message
        health.services.payment.status = 'error'
        health.status = 'degraded'
      }
    } else {
      health.services.telegram.status = 'not_configured'
      health.services.payment.status = 'not_configured'
      health.status = 'degraded'
    }

    // 检查支付系统整体状态
    if (health.services.payment.configured && 
        health.services.supabase.status === 'ok' && 
        health.services.telegram.status === 'ok') {
      health.services.payment.status = 'ok'
    } else if (health.services.payment.configured) {
      health.services.payment.status = 'degraded'
    } else {
      health.services.payment.status = 'not_configured'
    }

    const responseTime = Date.now() - startTime
    health.responseTime = responseTime

    logger.info('Health check completed', {
      status: health.status,
      responseTime,
      services: {
        supabase: health.services.supabase.status,
        telegram: health.services.telegram.status,
        payment: health.services.payment.status
      }
    })

    // 如果任何关键服务失败，返回503
    const httpStatus = health.status === 'healthy' ? 200 : 503

    return res.status(httpStatus).json({
      success: health.status === 'healthy',
      data: health
    })

  } catch (error) {
    logger.error('Health check failed', { 
      error: error.message,
      stack: error.stack 
    })
    return res.status(500).json({
      success: false,
      error: 'Health check failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    })
  }
}