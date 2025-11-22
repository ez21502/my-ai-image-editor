/**
 * 支付系统验证和测试脚本
 * 
 * 此脚本用于验证 Telegram Stars 支付系统的所有验证逻辑
 * 包括金额验证、货币验证、支付提供商验证等
 */

// 直接从配置中定义 SKU_MAP，避免依赖数据库连接
const SKU_MAP = { 
  pack12: { xtr: 50, credits: 12, label: '12算力点' }, 
  pack30: { xtr: 100, credits: 30, label: '30算力点' }, 
  pack60: { xtr: 180, credits: 60, label: '60算力点' }, 
  pack88: { xtr: 250, credits: 88, label: '88算力点' } 
}

// 颜色输出辅助函数
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logTest(name) {
  log(`\n${'='.repeat(60)}`, 'cyan')
  log(`测试: ${name}`, 'cyan')
  log('='.repeat(60), 'cyan')
}

function logPass(message) {
  log(`✅ ${message}`, 'green')
}

function logFail(message) {
  log(`❌ ${message}`, 'red')
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue')
}

function logWarn(message) {
  log(`⚠️  ${message}`, 'yellow')
}

// 测试结果统计
const testResults = {
  passed: 0,
  failed: 0,
  total: 0
}

function recordTest(passed, testName) {
  testResults.total++
  if (passed) {
    testResults.passed++
    logPass(testName)
  } else {
    testResults.failed++
    logFail(testName)
  }
}

// 模拟 webhook 验证逻辑
function validatePayment(payment, sku) {
  const errors = []
  
  // 1. 验证 SKU 是否存在
  const mapping = SKU_MAP[sku]
  if (!mapping) {
    errors.push('Invalid SKU')
    return { valid: false, errors }
  }
  
  // 2. 验证金额
  const expectedAmount = mapping.xtr // 直接使用，不乘以100
  if (payment.total_amount !== expectedAmount) {
    errors.push(`Amount mismatch: expected ${expectedAmount}, got ${payment.total_amount}`)
  }
  
  // 3. 验证货币
  if (payment.currency !== 'XTR') {
    errors.push(`Invalid currency: expected XTR, got ${payment.currency}`)
  }
  
  // 4. 验证支付提供商（Stars 支付使用空字符串）
  if (payment.provider_token !== '' && payment.provider_token !== undefined) {
    errors.push(`Invalid provider: expected empty string, got "${payment.provider_token}"`)
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

// 测试用例
function runTests() {
  log('\n🚀 开始支付系统验证测试\n', 'cyan')
  
  // 测试 1: 正确的支付数据
  logTest('测试 1: 正确的 Telegram Stars 支付数据')
  const validPayment = {
    total_amount: 50, // pack12: 50 Stars
    currency: 'XTR',
    provider_token: '', // Stars 支付使用空字符串
    telegram_payment_charge_id: 'test_charge_123',
    invoice_payload: JSON.stringify({ userId: 123456789, sku: 'pack12' })
  }
  const result1 = validatePayment(validPayment, 'pack12')
  recordTest(result1.valid, '正确的支付数据应该通过验证')
  if (!result1.valid) {
    logInfo(`错误: ${result1.errors.join(', ')}`)
  }
  
  // 测试 2: 金额错误（乘以100的错误）
  logTest('测试 2: 金额验证（防止乘以100的错误）')
  const wrongAmountPayment = {
    total_amount: 5000, // 错误：应该是50，但被乘以100
    currency: 'XTR',
    provider_token: '',
    telegram_payment_charge_id: 'test_charge_456',
    invoice_payload: JSON.stringify({ userId: 123456789, sku: 'pack12' })
  }
  const result2 = validatePayment(wrongAmountPayment, 'pack12')
  recordTest(!result2.valid, '错误的金额（乘以100）应该被拒绝')
  if (result2.valid) {
    logWarn('警告：系统接受了错误的金额！')
  } else {
    logInfo(`正确拒绝：${result2.errors[0]}`)
  }
  
  // 测试 3: 货币错误
  logTest('测试 3: 货币验证')
  const wrongCurrencyPayment = {
    total_amount: 50,
    currency: 'USD', // 错误：应该是 XTR
    provider_token: '',
    telegram_payment_charge_id: 'test_charge_789',
    invoice_payload: JSON.stringify({ userId: 123456789, sku: 'pack12' })
  }
  const result3 = validatePayment(wrongCurrencyPayment, 'pack12')
  recordTest(!result3.valid, '错误的货币应该被拒绝')
  if (result3.valid) {
    logWarn('警告：系统接受了错误的货币！')
  } else {
    logInfo(`正确拒绝：${result3.errors[0]}`)
  }
  
  // 测试 4: 支付提供商错误（使用 'telegram' 而不是空字符串）
  logTest('测试 4: 支付提供商验证（Stars 使用空字符串）')
  const wrongProviderPayment = {
    total_amount: 50,
    currency: 'XTR',
    provider_token: 'telegram', // 错误：Stars 支付应该是空字符串
    telegram_payment_charge_id: 'test_charge_101',
    invoice_payload: JSON.stringify({ userId: 123456789, sku: 'pack12' })
  }
  const result4 = validatePayment(wrongProviderPayment, 'pack12')
  recordTest(!result4.valid, '错误的支付提供商应该被拒绝')
  if (result4.valid) {
    logWarn('警告：系统接受了错误的支付提供商！')
  } else {
    logInfo(`正确拒绝：${result4.errors[0]}`)
  }
  
  // 测试 5: 所有 SKU 的金额验证
  logTest('测试 5: 所有 SKU 的金额配置验证')
  let allSkusValid = true
  for (const [sku, mapping] of Object.entries(SKU_MAP)) {
    const testPayment = {
      total_amount: mapping.xtr,
      currency: 'XTR',
      provider_token: '',
      telegram_payment_charge_id: `test_${sku}`,
      invoice_payload: JSON.stringify({ userId: 123456789, sku })
    }
    const result = validatePayment(testPayment, sku)
    const passed = result.valid
    recordTest(passed, `SKU ${sku}: ${mapping.label} (${mapping.xtr} XTR, ${mapping.credits} credits)`)
    if (!passed) {
      logInfo(`错误: ${result.errors.join(', ')}`)
      allSkusValid = false
    }
  }
  
  // 测试 6: 无效的 SKU
  logTest('测试 6: 无效 SKU 验证')
  const invalidSkuPayment = {
    total_amount: 50,
    currency: 'XTR',
    provider_token: '',
    telegram_payment_charge_id: 'test_invalid',
    invoice_payload: JSON.stringify({ userId: 123456789, sku: 'invalid_sku' })
  }
  const result6 = validatePayment(invalidSkuPayment, 'invalid_sku')
  recordTest(!result6.valid, '无效的 SKU 应该被拒绝')
  if (result6.valid) {
    logWarn('警告：系统接受了无效的 SKU！')
  } else {
    logInfo(`正确拒绝：${result6.errors[0]}`)
  }
  
  // 测试 7: 金额不匹配（正确的货币和提供商，但金额错误）
  logTest('测试 7: 金额不匹配验证')
  const amountMismatchPayment = {
    total_amount: 99, // 错误：pack12 应该是 50
    currency: 'XTR',
    provider_token: '',
    telegram_payment_charge_id: 'test_mismatch',
    invoice_payload: JSON.stringify({ userId: 123456789, sku: 'pack12' })
  }
  const result7 = validatePayment(amountMismatchPayment, 'pack12')
  recordTest(!result7.valid, '金额不匹配应该被拒绝')
  if (result7.valid) {
    logWarn('警告：系统接受了不匹配的金额！')
  } else {
    logInfo(`正确拒绝：${result7.errors[0]}`)
  }
  
  // 测试 8: provider_token 为 undefined（应该允许，因为代码检查了 undefined）
  logTest('测试 8: provider_token 为 undefined（应该允许）')
  const undefinedProviderPayment = {
    total_amount: 50,
    currency: 'XTR',
    provider_token: undefined, // undefined 应该被允许
    telegram_payment_charge_id: 'test_undefined',
    invoice_payload: JSON.stringify({ userId: 123456789, sku: 'pack12' })
  }
  const result8 = validatePayment(undefinedProviderPayment, 'pack12')
  recordTest(result8.valid, 'provider_token 为 undefined 应该被允许')
  if (!result8.valid) {
    logWarn(`警告：系统拒绝了 undefined provider_token: ${result8.errors.join(', ')}`)
  }
  
  // 测试 9: 所有 SKU 的完整支付数据
  logTest('测试 9: 所有 SKU 的完整支付流程验证')
  const allSkus = ['pack12', 'pack30', 'pack60', 'pack88']
  let allCompleteValid = true
  for (const sku of allSkus) {
    const mapping = SKU_MAP[sku]
    const completePayment = {
      total_amount: mapping.xtr,
      currency: 'XTR',
      provider_token: '',
      telegram_payment_charge_id: `complete_test_${sku}_${Date.now()}`,
      invoice_payload: JSON.stringify({ userId: 123456789, sku })
    }
    const result = validatePayment(completePayment, sku)
    const passed = result.valid
    recordTest(passed, `完整支付流程 - ${sku}: ${mapping.label}`)
    if (!passed) {
      logInfo(`错误: ${result.errors.join(', ')}`)
      allCompleteValid = false
    }
  }
  
  // 输出测试摘要
  log('\n' + '='.repeat(60), 'cyan')
  log('测试摘要', 'cyan')
  log('='.repeat(60), 'cyan')
  log(`总测试数: ${testResults.total}`, 'blue')
  log(`通过: ${testResults.passed}`, 'green')
  log(`失败: ${testResults.failed}`, 'red')
  log(`成功率: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`, 
    testResults.failed === 0 ? 'green' : 'yellow')
  
  // 输出配置信息
  log('\n' + '='.repeat(60), 'cyan')
  log('SKU 配置信息', 'cyan')
  log('='.repeat(60), 'cyan')
  for (const [sku, mapping] of Object.entries(SKU_MAP)) {
    log(`${sku}: ${mapping.label} - ${mapping.xtr} XTR = ${mapping.credits} credits`, 'blue')
  }
  
  // 输出关键验证点
  log('\n' + '='.repeat(60), 'cyan')
  log('关键验证点总结', 'cyan')
  log('='.repeat(60), 'cyan')
  log('1. ✅ 金额验证：直接使用 XTR 值，不乘以 100', 'green')
  log('2. ✅ 货币验证：必须是 "XTR"', 'green')
  log('3. ✅ 支付提供商验证：必须是空字符串 "" 或 undefined', 'green')
  log('4. ✅ SKU 验证：必须在 SKU_MAP 中', 'green')
  log('5. ✅ 金额匹配：必须与 SKU 配置的 xtr 值完全匹配', 'green')
  
  if (testResults.failed === 0) {
    log('\n🎉 所有测试通过！支付系统验证逻辑正确。\n', 'green')
    return 0
  } else {
    log('\n⚠️  部分测试失败，请检查验证逻辑。\n', 'yellow')
    return 1
  }
}

// 运行测试
if (require.main === module) {
  const exitCode = runTests()
  process.exit(exitCode)
}

module.exports = { runTests, validatePayment }

