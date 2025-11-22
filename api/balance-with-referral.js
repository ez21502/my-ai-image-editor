const { SUPABASE, getUserIdFromInitData, ensureUserWithWelcomeCredit, verifyInitData } = require('./_shared')
const { createLogger, logAudit } = require('./_shared')
const { corsMiddleware, handleOptions } = require('./_cors')

module.exports = async (req, res) => {
  // 应用 CORS 中间件
  corsMiddleware(req, res, () => {})
  
  // 处理 OPTIONS 预检请求
  if (req.method === 'OPTIONS') {
    return handleOptions(req, res)
  }
  
  const requestId = Math.random().toString(36).substr(2, 9)
  const logger = createLogger('balance-with-referral', requestId)
  
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

    logger.info('Processing balance request', { userId, startParam: req.query.startParam })

    // 确保用户存在并获取积分（包含欢迎奖励）
    const credits = await ensureUserWithWelcomeCredit(userId)
    logger.info('User balance retrieved', { userId, credits })

    // 处理推荐奖励
    const startParam = req.query.startParam
    if (startParam && startParam.startsWith('ref_')) {
      const inviterId = parseInt(startParam.replace('ref_', ''))
      if (inviterId && inviterId !== userId) {
        // 检查是否已经记录过推荐关系
        const { data: existingReferral } = await SUPABASE
          .from('referrals')
          .select('id')
          .eq('invitee_id', userId)
          .limit(1)
          .maybeSingle()

        if (!existingReferral) {
          logger.info('New referral detected', { userId, inviterId })
          
          // 记录推荐关系
          await SUPABASE.from('referrals').insert({
            inviter_id: inviterId,
            invitee_id: userId
          }).catch(err => {
            logger.error('Failed to record referral', { userId, inviterId, error: err.message })
          })

          // 为推荐人添加奖励积分
          const { data: inviterData } = await SUPABASE.from('user_credits')
            .select('credits')
            .eq('telegram_user_id', inviterId)
            .limit(1)
            .maybeSingle()
          
          if (inviterData) {
            await SUPABASE.from('user_credits')
              .update({ credits: inviterData.credits + 1 })
              .eq('telegram_user_id', inviterId)
              .catch(err => {
                logger.error('Failed to add referral reward', { userId, inviterId, error: err.message })
              })
            
            logAudit({
              userId: inviterId,
              action: 'referral_reward',
              details: { 
                inviteeId: userId, 
                creditsBefore: inviterData.credits, 
                creditsAfter: inviterData.credits + 1 
              }
            })
            
            logger.info('Referral reward granted', { userId: inviterId, inviteeId: userId, rewardCredits: 1 })
          }
        } else {
          logger.info('Referral already exists', { userId, inviterId })
        }
      }
    }

    logger.info('Balance request completed successfully', { userId, credits })
    return res.status(200).json({ 
      success: true, 
      credits,
      userId
    })

  } catch (error) {
    logger.error('Balance request failed', { userId, error: error.message, stack: error.stack })
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    })
  }
}
