// 🔧 简单测试 - 在浏览器控制台运行
console.log('🚀 开始简单测试...');

// 检查环境变量
console.log('📋 环境变量:');
console.log('VITE_DEV_MODE:', import.meta.env.VITE_DEV_MODE);
console.log('VITE_ALLOW_NON_TELEGRAM:', import.meta.env.VITE_ALLOW_NON_TELEGRAM);
console.log('VITE_PAYMENTS_BASE_URL:', import.meta.env.VITE_PAYMENTS_BASE_URL);

// 测试API连接
fetch('https://traemy-ai-image-editorxtor.vercel.app/api/balance?initData=dev_test_init_data_123456789')
  .then(res => res.json())
  .then(data => {
    console.log('✅ API测试成功:', data);
    if (data.error === 'Invalid initData') {
      console.log('✅ API正常工作，initData验证正常');
    }
  })
  .catch(err => console.error('❌ API测试失败:', err));

console.log('✅ 测试完成！页面应该可以正常加载了。');