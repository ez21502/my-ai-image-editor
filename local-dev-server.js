/**
 * 本地开发服务器
 * 用于在本地运行 Vercel Serverless Functions
 * 
 * ⚠️ 警告：此文件仅用于本地开发，不应在生产环境中使用
 * 
 * 使用方法:
 * 1. 安装依赖: npm install express cors dotenv
 * 2. 创建 .env.local 文件并配置环境变量
 * 3. 运行: node local-dev-server.js
 * 
 * 生产环境部署：
 * - 使用 Vercel 或其他支持 Serverless Functions 的平台
 * - 确保所有环境变量已在生产环境中正确配置
 * - 不要在生产环境中运行此服务器
 */

const express = require('express')
const cors = require('cors')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

const app = express()
const PORT = process.env.PORT || 3000

// 中间件
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000'
  ],
  credentials: true
}))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// 请求日志
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
  next()
})

// 模拟 Vercel 函数环境
function createVercelRequest(req) {
  return {
    method: req.method,
    url: req.url,
    path: req.path,
    query: req.query,
    headers: req.headers,
    body: req.body,
    // Vercel 特定的属性
    cookies: req.cookies || {},
    ip: req.ip || req.connection.remoteAddress,
  }
}

function createVercelResponse(res) {
  const vercelRes = {
    status: (code) => {
      res.status(code)
      return vercelRes
    },
    json: (data) => {
      res.json(data)
      return vercelRes
    },
    send: (data) => {
      res.send(data)
      return vercelRes
    },
    setHeader: (name, value) => {
      res.setHeader(name, value)
      return vercelRes
    },
    end: (data) => {
      res.end(data)
      return vercelRes
    },
    // 支持链式调用
    statusCode: res.statusCode,
  }
  return vercelRes
}

// 动态加载并运行 API 函数
async function handleApiRoute(req, res, apiPath) {
  try {
    // 构建函数文件路径
    const functionPath = path.join(__dirname, 'api', apiPath)
    
    // 检查文件是否存在
    const fs = require('fs')
    if (!fs.existsSync(functionPath)) {
      console.error(`API 函数不存在: ${functionPath}`)
      return res.status(404).json({
        error: 'The page could not be found',
        message: `API function not found: ${apiPath}`
      })
    }

    // 清除 require 缓存（开发模式下支持热重载）
    delete require.cache[require.resolve(functionPath)]
    
    // 加载函数
    const handler = require(functionPath)
    
    // 创建 Vercel 风格的请求和响应对象
    const vercelReq = createVercelRequest(req)
    const vercelRes = createVercelResponse(res)
    
    // 执行函数
    if (typeof handler === 'function') {
      await handler(vercelReq, vercelRes)
    } else if (handler.default && typeof handler.default === 'function') {
      await handler.default(vercelReq, vercelRes)
    } else {
      throw new Error('Handler is not a function')
    }
  } catch (error) {
    console.error(`处理 API 请求时出错: ${req.path}`, error)
    
    // 如果响应还没有发送
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    }
  }
}

// API 路由处理
app.all('/api/*', async (req, res) => {
  // 提取 API 路径（去掉 /api/ 前缀）
  const apiPath = req.path.replace(/^\/api\//, '')
  
  // 如果没有扩展名，尝试添加 .js
  const finalPath = apiPath.includes('.') ? apiPath : `${apiPath}.js`
  
  await handleApiRoute(req, res, finalPath)
})

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  })
})

// 根路径
app.get('/', (req, res) => {
  res.json({
    message: 'Local Development Server',
    endpoints: [
      'GET /api/health - 健康检查',
      'POST /api/create-invoice - 创建发票',
      'GET /api/balance - 查询余额',
      'POST /api/consume - 消耗积分',
      'GET /api/referral-link - 获取推荐链接',
    ]
  })
})

// 启动服务器
app.listen(PORT, () => {
  console.log('\n🚀 本地开发服务器已启动')
  console.log(`📍 服务器地址: http://localhost:${PORT}`)
  console.log(`📡 API 端点: http://localhost:${PORT}/api`)
  console.log(`\n💡 提示:`)
  console.log(`   - 确保已创建 .env.local 文件并配置环境变量`)
  console.log(`   - 前端应配置 VITE_PAYMENTS_BASE_URL=http://localhost:${PORT}/api`)
  console.log(`   - 按 Ctrl+C 停止服务器\n`)
})

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('\n正在关闭服务器...')
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...')
  process.exit(0)
})

