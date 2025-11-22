const { corsMiddleware, handleOptions } = require('./_cors')

module.exports = async (req, res) => {
  // 应用 CORS 中间件
  corsMiddleware(req, res, () => {})
  
  // 处理 OPTIONS 预检请求
  if (req.method === 'OPTIONS') {
    return handleOptions(req, res)
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // 基础健康检查
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      services: {
        supabase: process.env.SUPABASE_URL ? 'configured' : 'not_configured',
        telegram: process.env.TELEGRAM_BOT_TOKEN ? 'configured' : 'not_configured',
        webhook: process.env.MAKE_WEBHOOK_URL ? 'configured' : 'not_configured'
      }
    }

    return res.status(200).json({
      success: true,
      data: health
    })

  } catch (error) {
    console.error('Health check failed:', error)
    return res.status(500).json({
      success: false,
      error: 'Health check failed',
      details: error.message
    })
  }
}