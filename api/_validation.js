// 输入验证工具函数

/**
 * 验证 initData 格式
 */
function validateInitData(initData) {
  if (!initData || typeof initData !== 'string') {
    return { valid: false, error: 'Missing or invalid initData' }
  }
  
  try {
    const params = new URLSearchParams(initData)
    const hash = params.get('hash')
    const user = params.get('user')
    
    if (!hash || !user) {
      return { valid: false, error: 'Missing required initData parameters' }
    }
    
    // 验证 user 字段是否为有效的 JSON
    JSON.parse(user)
    
    return { valid: true }
  } catch (error) {
    return { valid: false, error: 'Invalid initData format' }
  }
}

/**
 * 验证 SKU 格式
 */
function validateSKU(sku) {
  const validSKUs = ['pack12', 'pack30', 'pack60', 'pack88']
  if (!sku || typeof sku !== 'string') {
    return { valid: false, error: 'Missing or invalid SKU' }
  }
  
  if (!validSKUs.includes(sku)) {
    return { valid: false, error: 'Invalid SKU. Valid options: pack12, pack30, pack60, pack88' }
  }
  
  return { valid: true }
}

/**
 * 验证 base64 图片数据
 */
function validateBase64Image(base64Data) {
  if (!base64Data || typeof base64Data !== 'string') {
    return { valid: false, error: 'Missing or invalid image data' }
  }
  
  // 检查是否为有效的 base64 格式
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/
  const pureBase64 = base64Data.split(',')[1] || base64Data
  
  if (!base64Regex.test(pureBase64)) {
    return { valid: false, error: 'Invalid base64 image format' }
  }
  
  // 检查大小限制 (3MB)
  const sizeInBytes = Buffer.byteLength(pureBase64, 'base64')
  const sizeInMB = sizeInBytes / (1024 * 1024)
  if (sizeInMB > 3) {
    return { valid: false, error: 'Image size exceeds 5MB limit' }
  }
  
  return { valid: true }
}

/**
 * 验证 prompt 文本
 */
function validatePrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    return { valid: false, error: 'Missing or invalid prompt' }
  }
  
  if (prompt.length > 1000) {
    return { valid: false, error: 'Prompt exceeds maximum length of 1000 characters' }
  }
  
  if (prompt.length < 3) {
    return { valid: false, error: 'Prompt must be at least 3 characters long' }
  }
  
  return { valid: true }
}

/**
 * 验证 chat_id
 */
function validateChatId(chatId) {
  if (!chatId) {
    return { valid: false, error: 'Missing chat_id' }
  }
  
  const chatIdStr = String(chatId)
  if (!/^\d+$/.test(chatIdStr)) {
    return { valid: false, error: 'Invalid chat_id format' }
  }
  
  return { valid: true }
}

/**
 * 验证请求体中的必填字段
 */
function validateRequiredFields(body, requiredFields) {
  const missingFields = []
  const invalidFields = []
  
  for (const field of requiredFields) {
    if (!(field in body)) {
      missingFields.push(field)
      continue
    }
    
    if (body[field] === null || body[field] === undefined || body[field] === '') {
      invalidFields.push(field)
    }
  }
  
  if (missingFields.length > 0) {
    return { 
      valid: false, 
      error: `Missing required fields: ${missingFields.join(', ')}` 
    }
  }
  
  if (invalidFields.length > 0) {
    return { 
      valid: false, 
      error: `Invalid field values: ${invalidFields.join(', ')}` 
    }
  }
  
  return { valid: true }
}

/**
 * 统一的错误响应格式
 */
function createErrorResponse(error, details = null) {
  return {
    success: false,
    error: error,
    details: details,
    timestamp: new Date().toISOString()
  }
}

/**
 * 统一的成功响应格式
 */
function createSuccessResponse(data = {}) {
  return {
    success: true,
    ...data,
    timestamp: new Date().toISOString()
  }
}

module.exports = {
  validateInitData,
  validateSKU,
  validateBase64Image,
  validatePrompt,
  validateChatId,
  validateRequiredFields,
  createErrorResponse,
  createSuccessResponse
}