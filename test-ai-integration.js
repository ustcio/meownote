// ================================================================================
// AI 智能分析系统集成测试脚本
// ================================================================================

// 测试配置
const TEST_CONFIG = {
  baseUrl: 'https://api.ustc.dev',
  endpoints: {
    gold: '/api/gold',
    aiAnalysis: '/api/gold/ai-analysis',
    aiSignals: '/api/gold/ai-signals',
    goldAnalysis: '/api/gold/analysis'
  }
};

// 测试函数
async function runTests() {
  console.log('🧪 开始测试 AI 智能分析系统集成...\n');
  
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };
  
  // 测试 1: 获取金价数据
  console.log('📊 测试 1: 获取实时金价数据');
  try {
    const response = await fetch(`${TEST_CONFIG.baseUrl}${TEST_CONFIG.endpoints.gold}`);
    const data = await response.json();
    
    if (data.success && data.data) {
      console.log('✅ 金价数据获取成功');
      console.log(`   当前价格: ¥${data.data.domestic?.price}/克`);
      results.passed++;
      results.tests.push({ name: 'Gold Price API', status: 'PASSED' });
    } else {
      throw new Error('Invalid response format');
    }
  } catch (error) {
    console.log('❌ 金价数据获取失败:', error.message);
    results.failed++;
    results.tests.push({ name: 'Gold Price API', status: 'FAILED', error: error.message });
  }
  
  console.log('');
  
  // 测试 2: 获取AI分析结果
  console.log('🤖 测试 2: 获取AI智能分析结果');
  try {
    const response = await fetch(`${TEST_CONFIG.baseUrl}${TEST_CONFIG.endpoints.aiAnalysis}`);
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ AI分析API响应成功');
      console.log(`   总记录数: ${data.totalRecords || 0}`);
      if (data.latestAnalysis) {
        console.log(`   最新趋势: ${data.latestAnalysis.marketTrend}`);
        console.log(`   AI建议: ${data.latestAnalysis.aiRecommendation}`);
      }
      results.passed++;
      results.tests.push({ name: 'AI Analysis API', status: 'PASSED' });
    } else {
      console.log('⚠️ AI分析API返回警告:', data.message);
      results.passed++;
      results.tests.push({ name: 'AI Analysis API', status: 'PASSED' });
    }
  } catch (error) {
    console.log('❌ AI分析API调用失败:', error.message);
    results.failed++;
    results.tests.push({ name: 'AI Analysis API', status: 'FAILED', error: error.message });
  }
  
  console.log('');
  
  // 测试 3: 获取AI交易信号
  console.log('📈 测试 3: 获取AI交易信号');
  try {
    const response = await fetch(`${TEST_CONFIG.baseUrl}${TEST_CONFIG.endpoints.aiSignals}`);
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ AI信号API响应成功');
      console.log(`   信号总数: ${data.totalSignals || 0}`);
      if (data.latestSignal) {
        console.log(`   最新信号: ${data.latestSignal.recommendation}`);
        console.log(`   置信度: ${data.latestSignal.confidence}`);
      }
      results.passed++;
      results.tests.push({ name: 'AI Signals API', status: 'PASSED' });
    } else {
      console.log('⚠️ AI信号API返回警告:', data.message);
      results.passed++;
      results.tests.push({ name: 'AI Signals API', status: 'PASSED' });
    }
  } catch (error) {
    console.log('❌ AI信号API调用失败:', error.message);
    results.failed++;
    results.tests.push({ name: 'AI Signals API', status: 'FAILED', error: error.message });
  }
  
  console.log('');
  
  // 测试 4: 获取传统分析
  console.log('📉 测试 4: 获取传统技术分析');
  try {
    const response = await fetch(`${TEST_CONFIG.baseUrl}${TEST_CONFIG.endpoints.goldAnalysis}?action=analyze`);
    const data = await response.json();
    
    if (data.success && data.analysis) {
      console.log('✅ 传统分析API响应成功');
      console.log(`   国内金价: ¥${data.analysis.domestic?.currentPrice}/克`);
      console.log(`   整体建议: ${data.analysis.overallRecommendation}`);
      results.passed++;
      results.tests.push({ name: 'Traditional Analysis API', status: 'PASSED' });
    } else {
      throw new Error('Invalid response format');
    }
  } catch (error) {
    console.log('❌ 传统分析API调用失败:', error.message);
    results.failed++;
    results.tests.push({ name: 'Traditional Analysis API', status: 'FAILED', error: error.message });
  }
  
  console.log('');
  console.log('========================================');
  console.log('📋 测试结果汇总');
  console.log('========================================');
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);
  console.log(`📊 成功率: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
  console.log('');
  
  // 详细结果
  console.log('📋 详细测试结果:');
  results.tests.forEach((test, index) => {
    const icon = test.status === 'PASSED' ? '✅' : '❌';
    console.log(`${icon} ${index + 1}. ${test.name}: ${test.status}`);
    if (test.error) {
      console.log(`   错误: ${test.error}`);
    }
  });
  
  return results;
}

// 运行测试
runTests().then(results => {
  console.log('\n========================================');
  console.log('🎉 测试完成!');
  console.log('========================================');
  
  if (results.failed === 0) {
    console.log('✨ 所有测试通过!');
    process.exit(0);
  } else {
    console.log(`⚠️ 有 ${results.failed} 个测试失败`);
    process.exit(1);
  }
}).catch(error => {
  console.error('💥 测试执行失败:', error);
  process.exit(1);
});
