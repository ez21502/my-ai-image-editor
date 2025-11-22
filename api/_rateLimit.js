// 简单的内存速率限制器

class RateLimiter {
  constructor(maxRequests = 10, windowMs = 60000) { // 默认: 10 请求/分钟
    this.maxRequests = maxRequests
    this.windowMs = windowMs
    this.requests = new Map() // userId -> { count, resetTime }
  }

  /**
   * 检查是否超过速率限制
   */
  isRateLimited(userId) {
    const now = Date.now()
    const userData = this.requests.get(userId)

    if (!userData) {
      // 新用户，创建记录
      this.requests.set(userId, {
        count: 1,
        resetTime: now + this.windowMs
      })
      return { limited: false, remaining: this.maxRequests - 1, resetTime: now + this.windowMs }
    }

    // 检查是否需要重置计数器
    if (now >= userData.resetTime) {
      this.requests.set(userId, {
        count: 1,
        resetTime: now + this.windowMs
      })
      return { limited: false, remaining: this.maxRequests - 1, resetTime: now + this.windowMs }
    }

    // 检查是否超过限制
    if (userData.count >= this.maxRequests) {
      return { 
        limited: true, 
        remaining: 0, 
        resetTime: userData.resetTime,
        retryAfter: Math.ceil((userData.resetTime - now) / 1000)
      }
    }

    // 增加计数
    userData.count++
    return { 
      limited: false, 
      remaining: this.maxRequests - userData.count, 
      resetTime: userData.resetTime 
    }
  }

  /**
   * 清理过期的用户记录
   */
  cleanup() {
    const now = Date.now()
    for (const [userId, userData] of this.requests.entries()) {
      if (now >= userData.resetTime) {
        this.requests.delete(userId)
      }
    }
  }

  /**
   * 获取速率限制中间件
   */
  middleware(action = 'default') {
    return (req, res, next) => {
      const userId = req.userId || req.query.userId || 'anonymous'
      const result = this.isRateLimited(`${action}:${userId}`)

      // 添加速率限制头信息
      res.setHeader('X-RateLimit-Limit', this.maxRequests)
      res.setHeader('X-RateLimit-Remaining', result.remaining)
      res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString())

      if (result.limited) {
        res.setHeader('Retry-After', result.retryAfter)
        return res.status(429).json({
          success: false,
          error: 'rate_limit_exceeded',
          message: `Rate limit exceeded. Try again in ${result.retryAfter} seconds.`,
          retryAfter: result.retryAfter
        })
      }

      next()
    }
  }
}

// 创建不同的速率限制器实例
const consumeRateLimiter = new RateLimiter(5, 60000) // 5 请求/分钟 (消耗积分)
const balanceRateLimiter = new RateLimiter(20, 60000) // 20 请求/分钟 (查询余额)
const invoiceRateLimiter = new RateLimiter(10, 60000) // 10 请求/分钟 (创建发票)

// 定期清理过期记录 (每5分钟)
setInterval(() => {
  consumeRateLimiter.cleanup()
  balanceRateLimiter.cleanup()
  invoiceRateLimiter.cleanup()
}, 300000)

module.exports = {
  consumeRateLimiter,
  balanceRateLimiter,
  invoiceRateLimiter,
  RateLimiter
}