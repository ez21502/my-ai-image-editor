const crypto = require('crypto')
const { createClient } = require('@supabase/supabase-js')

const SUPABASE = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Admin 权限验证工具
const ADMIN_WHITELIST = process.env.ADMINS ? process.env.ADMINS.split(',').map(id => id.trim()) : []

/**
 * 检查用户是否为管理员
 * @param {string|number} userId - Telegram用户ID
 * @returns {Promise<boolean>} - 是否为管理员
 */
async function isAdmin(userId) {
  if (!userId) return false
  
  // 首先检查环境变量白名单（快速检查）
  if (ADMIN_WHITELIST.includes(String(userId))) {
    return true
  }
  
  // 然后检查数据库表（推荐长期方案）
  try {
    const { data, error } = await SUPABASE
      .from('admins')
      .select('role')
      .eq('telegram_user_id', userId)
      .limit(1)
      .maybeSingle()
    
    if (error) {
      console.error('Error checking admin status:', error)
      return false
    }
    
    return !!data
  } catch (error) {
    console.error('Exception checking admin status:', error)
    return false
  }
}

/**
 * 检查用户是否为超级管理员
 * @param {string|number} userId - Telegram用户ID
 * @returns {Promise<boolean>} - 是否为超级管理员
 */
async function isSuperAdmin(userId) {
  if (!userId) return false
  
  try {
    const { data, error } = await SUPABASE
      .from('admins')
      .select('role')
      .eq('telegram_user_id', userId)
      .eq('role', 'super_admin')
      .limit(1)
      .maybeSingle()
    
    if (error) {
      console.error('Error checking super admin status:', error)
      return false
    }
    
    return !!data
  } catch (error) {
    console.error('Exception checking super admin status:', error)
    return false
  }
}

const SKU_MAP = { 
  pack12: { xtr: 50, credits: 12, label: '12算力点' }, 
  pack30: { xtr: 100, credits: 30, label: '30算力点' }, 
  pack60: { xtr: 180, credits: 60, label: '60算力点' }, 
  pack88: { xtr: 250, credits: 88, label: '88算力点' } 
}

function verifyInitData(initData, token) { 
  try { 
    const url = new URLSearchParams(initData); 
    const hash = url.get('hash'); 
    url.delete('hash'); 
    const keys = Array.from(url.keys()).sort(); 
    const dataCheckString = keys.map(k => `${k}=${url.get(k)}`).join('\n'); 
    const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest(); 
    const hmac = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex'); 
    return hmac === hash 
  } catch { 
    return false 
  } 
}

function getUserIdFromInitData(initData) { 
  const p = new URLSearchParams(initData); 
  const userJson = p.get('user'); 
  if (!userJson) return null; 
  try { 
    const user = JSON.parse(userJson); 
    return user && user.id ? Number(user.id) : null 
  } catch { 
    return null 
  } 
}

function getStartParam(initData) { 
  const p = new URLSearchParams(initData); 
  return p.get('start_param') || p.get('startapp') || null 
}

async function ensureUserWithWelcomeCredit(userId) { 
  const { data } = await SUPABASE.from('user_credits').select('credits').eq('telegram_user_id', userId).limit(1).maybeSingle(); 
  if (data) return data.credits; 
  const { error } = await SUPABASE.from('user_credits').insert({ telegram_user_id: userId, credits: 3 }); 
  if (error) {
    console.error('Failed to create user with welcome credit:', error);
    throw new Error(`Failed to create user: ${error.message}`);
  }
  return 3 
}

async function addCredits(userId, credits) { 
  const { data } = await SUPABASE.from('user_credits').select('credits').eq('telegram_user_id', userId).limit(1).maybeSingle(); 
  if (!data) { 
    await SUPABASE.from('user_credits').insert({ telegram_user_id: userId, credits }); 
    return credits 
  } 
  const newCredits = Number(data.credits) + Number(credits); 
  await SUPABASE.from('user_credits').update({ credits: newCredits }).eq('telegram_user_id', userId); 
  return newCredits 
}

async function consumeOneCredit(userId) { 
  const { data } = await SUPABASE.from('user_credits').select('credits').eq('telegram_user_id', userId).limit(1).maybeSingle(); 
  if (!data || Number(data.credits) <= 0) return false; 
  await SUPABASE.from('user_credits').update({ credits: Number(data.credits) - 1 }).eq('telegram_user_id', userId); 
  return true 
}

async function getUserCredits(userId) { 
  const { data } = await SUPABASE.from('user_credits').select('credits').eq('telegram_user_id', userId).limit(1).maybeSingle(); 
  return data ? data.credits : 0 
}

// 统一日志和审计系统

/**
 * 生成请求ID
 */
function generateRequestId() {
  return crypto.randomBytes(16).toString('hex')
}

/**
 * 结构化日志记录
 */
class Logger {
  constructor() {
    this.requestId = generateRequestId()
  }

  /**
   * 记录信息日志
   */
  info(message, data = {}) {
    console.log(JSON.stringify({
      level: 'INFO',
      timestamp: new Date().toISOString(),
      requestId: this.requestId,
      message,
      ...data
    }))
  }

  /**
   * 记录错误日志
   */
  error(message, error = null, data = {}) {
    const logData = {
      level: 'ERROR',
      timestamp: new Date().toISOString(),
      requestId: this.requestId,
      message,
      ...data
    }

    if (error) {
      logData.error = {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    }

    console.error(JSON.stringify(logData))
  }

  /**
   * 记录警告日志
   */
  warn(message, data = {}) {
    console.warn(JSON.stringify({
      level: 'WARN',
      timestamp: new Date().toISOString(),
      requestId: this.requestId,
      message,
      ...data
    }))
  }

  /**
   * 记录调试日志
   */
  debug(message, data = {}) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(JSON.stringify({
        level: 'DEBUG',
        timestamp: new Date().toISOString(),
        requestId: this.requestId,
        message,
        ...data
      }))
    }
  }
}

/**
 * 审计记录器
 */
class AuditLogger {
  constructor(logger) {
    this.logger = logger
  }

  /**
   * 记录用户操作
   */
  logUserAction(userId, action, details = {}) {
    this.logger.info('User action', {
      userId,
      action,
      details,
      category: 'user_action'
    })
  }

  /**
   * 记录积分变更
   */
  logCreditChange(userId, change, reason, previousBalance, newBalance, details = {}) {
    this.logger.info('Credit balance changed', {
      userId,
      change,
      reason,
      previousBalance,
      newBalance,
      details,
      category: 'credit_change'
    })
  }

  /**
   * 记录支付操作
   */
  logPayment(userId, amount, currency, status, paymentId, details = {}) {
    this.logger.info('Payment processed', {
      userId,
      amount,
      currency,
      status,
      paymentId,
      details,
      category: 'payment'
    })
  }

  /**
   * 记录API调用
   */
  logApiCall(userId, endpoint, method, status, duration, details = {}) {
    this.logger.info('API call', {
      userId,
      endpoint,
      method,
      status,
      duration,
      details,
      category: 'api_call'
    })
  }

  /**
   * 记录安全事件
   */
  logSecurityEvent(userId, event, details = {}) {
    this.logger.warn('Security event', {
      userId,
      event,
      details,
      category: 'security'
    })
  }

  /**
   * 记录系统错误
   */
  logSystemError(error, context = {}) {
    this.logger.error('System error', error, {
      context,
      category: 'system_error'
    })
  }
}

/**
 * 创建日志记录器中间件
 */
function createLoggingMiddleware() {
  return (req, res, next) => {
    const logger = new Logger()
    const auditLogger = new AuditLogger(logger)
    
    // 添加到请求对象
    req.logger = logger
    req.auditLogger = auditLogger
    
    // 记录请求开始
    const startTime = Date.now()
    logger.info('Request started', {
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress
    })
    
    // 重写 res.json 以记录响应
    const originalJson = res.json
    res.json = function(data) {
      const duration = Date.now() - startTime
      
      logger.info('Request completed', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
        response: data
      })
      
      // 记录API调用审计
      if (req.userId) {
        auditLogger.logApiCall(
          req.userId,
          req.url,
          req.method,
          res.statusCode,
          duration,
          { response: data }
        )
      }
      
      return originalJson.call(this, data)
    }
    
    next()
  }
}

/**
 * 创建日志记录器
 */
function createLogger(service, requestId = null) {
  const logger = new Logger()
  if (requestId) logger.requestId = requestId
  return logger
}

/**
 * 记录审计日志
 */
function logAudit(data) {
  const logger = new Logger()
  logger.info('Audit log', data)
}

module.exports = { 
  SUPABASE, 
  SKU_MAP, 
  verifyInitData, 
  getUserIdFromInitData, 
  getStartParam, 
  ensureUserWithWelcomeCredit, 
  addCredits, 
  consumeOneCredit, 
  getUserCredits,
  isAdmin,
  isSuperAdmin,
  Logger,
  AuditLogger,
  createLoggingMiddleware,
  generateRequestId,
  createLogger,
  logAudit
}