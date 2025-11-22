const { SUPABASE, SKU_MAP } = require('./_shared')
const { corsMiddleware, handleOptions } = require('./_cors')
const { createLogger } = require('./_shared')

module.exports = async (req, res) => {
  const requestId = Math.random().toString(36).substr(2, 9)
  const logger = createLogger('payment-debug', requestId)
  
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
    const debugInfo = {
      timestamp: new Date().toISOString(),
      requestId,
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        testMode: process.env.TEST_MODE === 'true'
      },
      configuration: {
        telegramBotToken: {
          configured: !!process.env.TELEGRAM_BOT_TOKEN,
          length: process.env.TELEGRAM_BOT_TOKEN?.length || 0,
          preview: process.env.TELEGRAM_BOT_TOKEN ? 
            `${process.env.TELEGRAM_BOT_TOKEN.substring(0, 10)}...${process.env.TELEGRAM_BOT_TOKEN.substring(process.env.TELEGRAM_BOT_TOKEN.length - 5)}` : 
            'Not configured'
        },
        supabase: {
          url: {
            configured: !!process.env.SUPABASE_URL,
            value: process.env.SUPABASE_URL ? 
              `${process.env.SUPABASE_URL.substring(0, 20)}...` : 
              'Not configured'
          },
          serviceRoleKey: {
            configured: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
            length: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0
          }
        },
        webhook: {
          makeWebhookUrl: {
            configured: !!process.env.MAKE_WEBHOOK_URL,
            value: process.env.MAKE_WEBHOOK_URL ? 
              `${process.env.MAKE_WEBHOOK_URL.substring(0, 30)}...` : 
              'Not configured'
          }
        },
        cors: {
          allowedOrigins: process.env.ALLOWED_ORIGINS ? 
            process.env.ALLOWED_ORIGINS.split(',') : 
            []
        }
      },
      skuConfiguration: {
        availableSKUs: Object.keys(SKU_MAP),
        skuDetails: SKU_MAP
      },
      health: {
        supabase: 'unknown',
        telegram: 'unknown'
      }
    }

    // 测试 Supabase 连接
    try {
      const { data, error } = await SUPABASE
        .from('user_credits')
        .select('telegram_user_id')
        .limit(1)
      
      if (error) {
        debugInfo.health.supabase = {
          status: 'error',
          error: error.message,
          code: error.code
        }
      } else {
        debugInfo.health.supabase = {
          status: 'ok',
          connected: true
        }
      }
    } catch (supabaseError) {
      debugInfo.health.supabase = {
        status: 'error',
        error: supabaseError.message
      }
    }

    // 测试 Telegram Bot API 连接
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (token) {
      try {
        const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        })
        
        if (response.ok) {
          const result = await response.json()
          if (result.ok) {
            debugInfo.health.telegram = {
              status: 'ok',
              botUsername: result.result.username,
              botId: result.result.id,
              botFirstName: result.result.first_name
            }
          } else {
            debugInfo.health.telegram = {
              status: 'error',
              error: result.description || 'Unknown error'
            }
          }
        } else {
          debugInfo.health.telegram = {
            status: 'error',
            error: `HTTP ${response.status} ${response.statusText}`
          }
        }
      } catch (telegramError) {
        debugInfo.health.telegram = {
          status: 'error',
          error: telegramError.message
        }
      }
    } else {
      debugInfo.health.telegram = {
        status: 'error',
        error: 'TELEGRAM_BOT_TOKEN not configured'
      }
    }

    // 计算总体健康状态
    const allHealthy = 
      debugInfo.health.supabase.status === 'ok' && 
      debugInfo.health.telegram.status === 'ok' &&
      debugInfo.configuration.telegramBotToken.configured &&
      debugInfo.configuration.supabase.url.configured &&
      debugInfo.configuration.supabase.serviceRoleKey.configured

    debugInfo.overallHealth = allHealthy ? 'healthy' : 'unhealthy'

    logger.info('Payment debug info generated', { 
      overallHealth: debugInfo.overallHealth,
      supabaseHealth: debugInfo.health.supabase.status,
      telegramHealth: debugInfo.health.telegram.status
    })

    return res.status(200).json({
      success: true,
      data: debugInfo
    })

  } catch (error) {
    logger.error('Payment debug error', { 
      error: error.message,
      stack: error.stack 
    })
    return res.status(500).json({
      success: false,
      error: 'Failed to generate debug info',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}

