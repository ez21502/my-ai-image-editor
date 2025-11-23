// CORS 配置中间件

const ENV_ALLOWED = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []
const LOCAL_ALLOWED = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173'
]
const ALLOWED_ORIGINS = process.env.NODE_ENV === 'production' ? ENV_ALLOWED : (ENV_ALLOWED.length ? ENV_ALLOWED : LOCAL_ALLOWED)

/**
 * 检查是否为同源请求（前后端在同一域名）
 */
function isSameOrigin(req) {
  const origin = req.headers.origin
  const host = req.headers.host
  const referer = req.headers.referer
  
  // 如果没有 Origin 头，可能是同源请求
  if (!origin) {
    return true
  }
  
  // 如果 Origin 和 Host 匹配，则是同源请求
  if (host && origin) {
    try {
      const originUrl = new URL(origin)
      const hostUrl = host.startsWith('http') ? new URL(host) : { hostname: host.split(':')[0] }
      if (originUrl.hostname === hostUrl.hostname) {
        return true
      }
    } catch (e) {
      // URL 解析失败，继续其他检查
    }
  }
  
  return false
}

/**
 * CORS 中间件
 */
function corsMiddleware(req, res, next) {
  const origin = req.headers.origin
  
  // 同源请求：允许所有同源请求（前后端在同一域名）
  if (isSameOrigin(req)) {
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin)
    }
  } else if (origin && ALLOWED_ORIGINS.includes(origin)) {
    // 跨域请求：检查是否在允许列表中
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  
  // 设置其他 CORS 头
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  
  // 处理预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  next()
}

/**
 * 通用的 OPTIONS 处理器
 */
function handleOptions(req, res) {
  const origin = req.headers.origin
  
  // 同源请求：允许所有同源请求（前后端在同一域名）
  if (isSameOrigin(req)) {
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin)
    }
  } else if (origin && ALLOWED_ORIGINS.includes(origin)) {
    // 跨域请求：检查是否在允许列表中
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Max-Age', '86400') // 24小时缓存
  
  return res.status(200).end()
}

module.exports = {
  corsMiddleware,
  handleOptions,
  ALLOWED_ORIGINS,
  isSameOrigin
}
