const { corsMiddleware, handleOptions } = require('./_cors')

module.exports = async (req, res) => {
  // 处理 OPTIONS 预检请求
  if (req.method === 'OPTIONS') {
    return handleOptions(req, res)
  }
  
  // 应用 CORS 中间件
  corsMiddleware(req, res, () => {})
  
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed',
      allowedMethods: ['GET']
    })
  }

  try {
    // 基础测试响应
    const test = {
      success: true,
      message: 'API test endpoint is working',
      timestamp: new Date().toISOString(),
      environment: {
        node_version: process.version,
        node_env: process.env.NODE_ENV || 'development',
        has_supabase_url: !!process.env.SUPABASE_URL,
        has_supabase_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        has_telegram_token: !!process.env.TELEGRAM_BOT_TOKEN,
        has_webhook_url: !!process.env.MAKE_WEBHOOK_URL
      }
    }

    return res.status(200).json(test)
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Test failed',
      message: error.message,
      timestamp: new Date().toISOString()
    })
  }
}