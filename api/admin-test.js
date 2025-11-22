const { SUPABASE, verifyInitData, getUserIdFromInitData, isAdmin, isSuperAdmin, createLogger, logAudit } = require('./_shared')
const { corsMiddleware, handleOptions } = require('./_cors')

module.exports = async (req, res) => {
  // 生产环境禁用此端点（仅用于开发/测试）
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_ADMIN_TEST !== 'true') {
    return res.status(404).json({ error: 'Not found' })
  }
  
  // 应用 CORS 中间件
  corsMiddleware(req, res, () => {})
  
  // 处理 OPTIONS 预检请求
  if (req.method === 'OPTIONS') {
    return handleOptions(req, res)
  }
  
  const requestId = Math.random().toString(36).substr(2, 9)
  const logger = createLogger('admin-test', requestId)
  
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

    logger.info('Admin test access', { userId })

    // 检查管理员权限
    const isUserAdmin = await isAdmin(userId)
    const isUserSuperAdmin = await isSuperAdmin(userId)
    
    if (!isUserAdmin) {
      logger.warn('Non-admin user attempted to access admin test', { userId })
      return res.status(403).json({ error: 'Admin access required' })
    }

    // 获取测试环境信息
    const testInfo = {
      environment: process.env.NODE_ENV || 'development',
      isAdmin: isUserAdmin,
      isSuperAdmin: isUserSuperAdmin,
      userId: userId,
      timestamp: new Date().toISOString(),
      features: {
        canAccessAdminPanel: true,
        canViewSystemLogs: isUserSuperAdmin,
        canManageUsers: isUserSuperAdmin,
        canModifySystemSettings: isUserSuperAdmin
      }
    }

    // 如果是超级管理员，提供额外的系统信息
    if (isUserSuperAdmin) {
      try {
        // 获取用户统计
        const { count: totalUsers } = await SUPABASE
          .from('user_credits')
          .select('*', { count: 'exact', head: true })

        // 获取支付统计
        const { count: totalPayments } = await SUPABASE
          .from('payments')
          .select('*', { count: 'exact', head: true })

        // 获取推荐统计
        const { count: totalReferrals } = await SUPABASE
          .from('referrals')
          .select('*', { count: 'exact', head: true })

        testInfo.systemStats = {
          totalUsers: totalUsers || 0,
          totalPayments: totalPayments || 0,
          totalReferrals: totalReferrals || 0
        }

        // 获取最近的支付记录（用于测试）
        const { data: recentPayments } = await SUPABASE
          .from('payments')
          .select('telegram_user_id, xtr_amount, credits_added, paid_at')
          .order('paid_at', { ascending: false })
          .limit(5)

        testInfo.recentPayments = recentPayments || []

      } catch (statsError) {
        logger.error('Failed to get system stats', { userId, error: statsError.message })
        testInfo.systemStatsError = 'Failed to retrieve system statistics'
      }
    }

    logAudit({
      userId,
      action: 'admin_test_access',
      details: { 
        isAdmin: isUserAdmin,
        isSuperAdmin: isUserSuperAdmin,
        environment: testInfo.environment
      }
    })

    logger.info('Admin test completed successfully', { userId, role: isUserSuperAdmin ? 'super_admin' : 'admin' })

    return res.status(200).json({
      success: true,
      message: 'Admin test access granted',
      data: testInfo
    })

  } catch (error) {
    logger.error('Admin test failed', { userId, error: error.message, stack: error.stack })
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    })
  }
}