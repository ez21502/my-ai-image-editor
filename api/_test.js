/**
 * 测试模式工具
 */

// 检查是否启用测试模式
function isTestMode() {
  return process.env.TEST_MODE === 'true'
}

// 获取测试SKU
function getTestSKUs() {
  return {
    'test_credits_1': { xtr: 1, credits: 10 },
    'test_credits_5': { xtr: 5, credits: 50 },
    'test_credits_10': { xtr: 10, credits: 100 }
  }
}

// 检查是否为测试SKU
function isTestSKU(sku) {
  if (!isTestMode()) return false
  return !!getTestSKUs()[sku]
}

module.exports = {
  isTestMode,
  getTestSKUs,
  isTestSKU
}