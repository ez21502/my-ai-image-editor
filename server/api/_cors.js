// CORS 配置中间件

// CORS 允许的来源列表
// 注意：生产环境应通过环境变量配置允许的来源
const ALLOWED_ORIGINS = [
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []), // 从环境变量读取
  'http://localhost:3000', // 本地开发
  'http://localhost:5173', // Vite 默认端口
  'http://127.0.0.1:3000', // 本地开发（IP）
  'http://127.0.0.1:5173' // Vite 本地开发（IP）
]

/**
 * CORS 中间件
 */
function corsMiddleware(req, res, next) {
  const origin = req.headers.origin
  
  // 检查来源是否在允许列表中
  if (ALLOWED_ORIGINS.includes(origin)) {
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
  
  if (ALLOWED_ORIGINS.includes(origin)) {
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
  ALLOWED_ORIGINS
}