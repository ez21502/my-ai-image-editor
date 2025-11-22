// 🔧 开发模式测试脚本
// 在浏览器控制台中运行此脚本来测试开发模式配置

console.log('🚀 开始开发模式测试...');

// 检查环境变量
console.log('📋 环境变量检查:');
console.log('VITE_DEV_MODE:', import.meta.env.VITE_DEV_MODE);
console.log('VITE_ALLOW_NON_TELEGRAM:', import.meta.env.VITE_ALLOW_NON_TELEGRAM);
console.log('VITE_PAYMENTS_BASE_URL:', import.meta.env.VITE_PAYMENTS_BASE_URL);
console.log('VITE_MAKE_WEBHOOK_URL:', import.meta.env.VITE_MAKE_WEBHOOK_URL);

// 测试API连接
async function testAPIConnection() {
  console.log('🔗 测试API连接...');
  try {
    const response = await fetch('https://traemy-ai-image-editorxtor.vercel.app/api/balance?initData=dev_test_init_data_123456789');
    const data = await response.json();
    console.log('✅ API连接成功:', data);
    return data;
  } catch (error) {
    console.error('❌ API连接失败:', error);
    return null;
  }
}

// 测试webhook连接
async function testWebhookConnection() {
  console.log('🔗 测试Webhook连接...');
  try {
    const response = await fetch('https://hook.us2.make.com/6xbib7m7edat288dd074myx7dy882imk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        composite_image_base64: 'test_data',
        prompt: 'test prompt',
        chat_id: 123456789
      })
    });
    console.log('✅ Webhook连接成功，状态码:', response.status);
    return response.ok;
  } catch (error) {
    console.error('❌ Webhook连接失败:', error);
    return false;
  }
}

// 运行所有测试
async function runAllTests() {
  console.log('🧪 运行完整测试套件...');
  
  // 测试1: API连接
  await testAPIConnection();
  
  // 测试2: Webhook连接
  await testWebhookConnection();
  
  console.log('✅ 测试完成！检查上面的结果。');
}

// 运行测试
runAllTests();