const { getUserIdFromInitData, verifyInitData } = require('./_shared')
const { createLogger } = require('./_shared')
const { corsMiddleware, handleOptions } = require('./_cors')

module.exports = async (req, res) => {
  // 应用 CORS 中间件
  corsMiddleware(req, res, () => {})
  
  // 处理 OPTIONS 预检请求
  if (req.method === 'OPTIONS') {
    return handleOptions(req, res)
  }
  
  const requestId = Math.random().toString(36).substr(2, 9)
  const logger = createLogger('referral-link', requestId)
  
  if (req.method !== 'GET') {
    logger.warn('Method not allowed', { method: req.method })
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { initData } = req.query
    
    if (!initData) {
      logger.warn('Missing initData parameter')
      return res.status(400).json({ error: 'Missing initData' })
    }

    // 验证 initData
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) {
      logger.error('Missing TELEGRAM_BOT_TOKEN configuration')
      return res.status(500).json({ error: 'Server configuration error' })
    }

    // 完整的 initData 验证
    const isValid = verifyInitData(initData, token)
    if (!isValid) {
      logger.warn('Invalid initData verification', { initData: initData.substr(0, 50) + '...' })
      return res.status(401).json({ error: 'Invalid initData' })
    }
    
    const userId = getUserIdFromInitData(initData)
    if (!userId) {
      logger.warn('Failed to extract user ID from initData')
      return res.status(400).json({ error: 'Cannot extract user ID' })
    }

    logger.info('Generating referral links', { userId })

    // 生成推荐链接
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'your_bot_username'
    const baseUrl = process.env.APP_BASE_URL || 'https://my-ai-image-editor-fc7blcgqx-ez21502s-projects.vercel.app'
    
    // Telegram Bot 深度链接
    const botLink = `https://t.me/${botUsername}?start=ref_${userId}`
    
    // Mini App 深度链接
    const miniAppLink = `https://t.me/${botUsername}/my-ai-image-editor?startapp=ref_${userId}`
    
    // Web 链接（备用）
    const webLink = `${baseUrl}?startapp=ref_${userId}`

    logger.info('Referral links generated successfully', { userId, botUsername })

    return res.status(200).json({ 
      success: true, 
      userId,
      links: {
        bot: botLink,
        miniApp: miniAppLink,
        web: webLink
      }
    })

  } catch (error) {
    logger.error('Referral link generation failed', { userId, error: error.message, stack: error.stack })
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    })
  }
}
