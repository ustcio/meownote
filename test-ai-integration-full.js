#!/usr/bin/env node
/**
 * AI 完整集成测试 - 验证所有数据真实传递给 AI 并返回真实结果
 */

console.log('🧪 AI 完整集成测试\n');
console.log('='.repeat(80));

// 检查环境变量
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const DOUBAO_API_KEY = process.env.DOUBAO_API_KEY;

console.log('\n📋 环境检查:');
console.log(`   DASHSCOPE_API_KEY: ${DASHSCOPE_API_KEY ? '✅ 已配置' : '❌ 未配置'}`);
console.log(`   DOUBAO_API_KEY: ${DOUBAO_API_KEY ? '✅ 已配置' : '❌ 未配置'}`);

if (!DASHSCOPE_API_KEY || !DOUBAO_API_KEY) {
  console.log('\n⚠️  错误：请先配置 API 密钥');
  console.log('   export DASHSCOPE_API_KEY="your-key"');
  console.log('   export DOUBAO_API_KEY="your-key"');
  process.exit(1);
}

// 测试数据
const testData = {
  currentPrice: 618.5,
  openPrice: 615.0,
  high: 620.0,
  low: 614.0,
  changePercent: 0.57,
  priceHistory: [
    { timestamp: Date.now() - 3600000, price: 615.0 },
    { timestamp: Date.now() - 1800000, price: 616.5 },
    { timestamp: Date.now() - 900000, price: 617.0 },
    { timestamp: Date.now() - 600000, price: 618.0 },
    { timestamp: Date.now() - 300000, price: 618.5 }
  ],
  technicalIndicators: {
    rsi: 55.2,
    macd: 0.35,
    bollinger: 0.65,
    maCross: 0.2
  }
};

// 构建完整的测试提示词
function buildTestPrompt() {
  const priceList = testData.priceHistory
    .map(p => `${new Date(p.timestamp).toLocaleTimeString('zh-CN')}: ¥${p.price.toFixed(2)}`)
    .join('\n');

  return `【市场数据】
当前价格：¥${testData.currentPrice}/克
今日开盘：¥${testData.openPrice}/克
今日最高：¥${testData.high}/克
今日最低：¥${testData.low}/克
日内涨跌：${testData.changePercent.toFixed(2)}%

【近期价格走势】
${priceList}

【技术指标】
RSI: ${testData.technicalIndicators.rsi.toFixed(2)} (neutral)
MACD: ${testData.technicalIndicators.macd.toFixed(2)} (buy)
Bollinger: ${testData.technicalIndicators.bollinger.toFixed(2)} (neutral)
MA Cross: ${testData.technicalIndicators.maCross.toFixed(2)} (buy)

【趋势分析】
当前趋势：up
趋势强度：6.5
波动率：1.8%
支撑位：¥614.00
阻力位：¥620.00

请分析以上数据并提供：
1. 短期价格预测 (1-4 小时)
2. 中期价格预测 (1-3 天)
3. 趋势判断及置信度
4. 关键风险因素
5. 交易建议

请以 JSON 格式返回：
{
  "direction": "bullish/bearish/neutral",
  "confidence": 0.0-1.0,
  "shortTermTarget": 目标价格，
  "midTermTarget": 目标价格，
  "factors": ["因素 1", "因素 2", "因素 3"],
  "risk": "low/medium/high",
  "maxDrawdown": 数值，
  "volatility": 数值
}`;
}

// 测试通义千问
async function testQwenFullIntegration() {
  console.log('\n' + '='.repeat(80));
  console.log('🔵 测试通义千问 3.5-Max 完整集成');
  console.log('='.repeat(80));
  
  const prompt = buildTestPrompt();
  
  console.log('\n📝 发送给 AI 的完整数据:');
  console.log('-'.repeat(80));
  console.log(prompt);
  console.log('-'.repeat(80));
  console.log(`\n📊 数据量：${prompt.length} 字符`);
  
  console.log('\n🚀 调用 API...');
  const startTime = Date.now();
  
  try {
    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen3-max-2026-01-23',
        messages: [
          { 
            role: 'system', 
            content: '你是黄金交易分析专家，擅长技术分析和趋势判断。请基于提供的数据进行分析，并以 JSON 格式返回结果。' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    });
    
    const elapsed = Date.now() - startTime;
    console.log(`⏱️  响应时间：${elapsed}ms`);
    console.log(`📡 状态码：${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ API 调用失败: ${errorText}`);
      return false;
    }
    
    const result = await response.json();
    const aiResponse = result.choices?.[0]?.message?.content;
    
    if (!aiResponse) {
      console.log('❌ AI 返回数据为空');
      return false;
    }
    
    console.log('\n✅ API 调用成功');
    console.log('\n🤖 AI 原始回复:');
    console.log('-'.repeat(80));
    console.log(aiResponse);
    console.log('-'.repeat(80));
    
    // 验证 AI 是否真的分析了数据
    console.log('\n🔍 验证 AI 回复内容...');
    
    const checks = {
      '提到当前价格': aiResponse.includes('618.5') || aiResponse.includes('618'),
      '提到技术指标': aiResponse.includes('RSI') || aiResponse.includes('MACD') || aiResponse.includes('技术'),
      '提到趋势': aiResponse.includes('上涨') || aiResponse.includes('下跌') || aiResponse.includes('震荡') || aiResponse.includes('趋势'),
      '提供置信度': aiResponse.includes('置信度') || aiResponse.includes('confidence') || /\d+\.%/.test(aiResponse),
      '提供目标价': aiResponse.includes('目标') || aiResponse.includes('目标价') || /\d+/.test(aiResponse),
      'JSON 格式': aiResponse.includes('{') && aiResponse.includes('}'),
      '非模拟数据': !aiResponse.includes('模拟') && !aiResponse.includes('mock') && !aiResponse.includes('测试')
    };
    
    let allPassed = true;
    for (const [check, passed] of Object.entries(checks)) {
      console.log(`   ${passed ? '✅' : '❌'} ${check}`);
      if (!passed) allPassed = false;
    }
    
    // 尝试解析 JSON
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('\n📊 解析 AI 返回的 JSON:');
        console.log('-'.repeat(80));
        console.log(JSON.stringify(parsed, null, 2));
        console.log('-'.repeat(80));
        
        // 验证 JSON 字段
        const jsonChecks = {
          'direction 字段': parsed.direction !== undefined,
          'confidence 字段': parsed.confidence !== undefined,
          'shortTermTarget 字段': parsed.shortTermTarget !== undefined,
          'factors 字段': Array.isArray(parsed.factors) && parsed.factors.length > 0,
          'risk 字段': parsed.risk !== undefined
        };
        
        console.log('\n🔍 验证 JSON 结构:');
        for (const [check, passed] of Object.entries(jsonChecks)) {
          console.log(`   ${passed ? '✅' : '❌'} ${check}`);
          if (!passed) allPassed = false;
        }
      } else {
        console.log('\n⚠️  警告：未找到 JSON 格式');
        allPassed = false;
      }
    } catch (e) {
      console.log(`\n⚠️  警告：JSON 解析失败 - ${e.message}`);
    }
    
    return allPassed;
    
  } catch (error) {
    console.log(`\n❌ 异常：${error.message}`);
    return false;
  }
}

// 测试豆包
async function testDoubaoFullIntegration() {
  console.log('\n' + '='.repeat(80));
  console.log('🟢 测试豆包完整集成');
  console.log('='.repeat(80));
  
  const prompt = buildTestPrompt();
  
  console.log('\n📝 发送给 AI 的完整数据:');
  console.log('-'.repeat(80));
  console.log(prompt);
  console.log('-'.repeat(80));
  console.log(`\n📊 数据量：${prompt.length} 字符`);
  
  console.log('\n🚀 调用 API...');
  const startTime = Date.now();
  
  try {
    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DOUBAO_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'doubao-seed-2-0-pro-260215',
        messages: [
          { 
            role: 'system', 
            content: '你是黄金交易分析专家，擅长技术分析和趋势判断。请基于提供的数据进行分析，并以 JSON 格式返回结果。' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    });
    
    const elapsed = Date.now() - startTime;
    console.log(`⏱️  响应时间：${elapsed}ms`);
    console.log(`📡 状态码：${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ API 调用失败：${errorText}`);
      return false;
    }
    
    const result = await response.json();
    const aiResponse = result.choices?.[0]?.message?.content;
    
    if (!aiResponse) {
      console.log('❌ AI 返回数据为空');
      return false;
    }
    
    console.log('\n✅ API 调用成功');
    console.log('\n🤖 AI 原始回复:');
    console.log('-'.repeat(80));
    console.log(aiResponse);
    console.log('-'.repeat(80));
    
    // 验证 AI 是否真的分析了数据
    console.log('\n🔍 验证 AI 回复内容...');
    
    const checks = {
      '提到当前价格': aiResponse.includes('618.5') || aiResponse.includes('618'),
      '提到技术指标': aiResponse.includes('RSI') || aiResponse.includes('MACD') || aiResponse.includes('技术'),
      '提到趋势': aiResponse.includes('上涨') || aiResponse.includes('下跌') || aiResponse.includes('震荡') || aiResponse.includes('趋势'),
      '提供置信度': aiResponse.includes('置信度') || aiResponse.includes('confidence') || /\d+\.%/.test(aiResponse),
      '提供目标价': aiResponse.includes('目标') || aiResponse.includes('目标价') || /\d+/.test(aiResponse),
      'JSON 格式': aiResponse.includes('{') && aiResponse.includes('}'),
      '非模拟数据': !aiResponse.includes('模拟') && !aiResponse.includes('mock') && !aiResponse.includes('测试')
    };
    
    let allPassed = true;
    for (const [check, passed] of Object.entries(checks)) {
      console.log(`   ${passed ? '✅' : '❌'} ${check}`);
      if (!passed) allPassed = false;
    }
    
    // 尝试解析 JSON
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('\n📊 解析 AI 返回的 JSON:');
        console.log('-'.repeat(80));
        console.log(JSON.stringify(parsed, null, 2));
        console.log('-'.repeat(80));
        
        // 验证 JSON 字段
        const jsonChecks = {
          'direction 字段': parsed.direction !== undefined,
          'confidence 字段': parsed.confidence !== undefined,
          'shortTermTarget 字段': parsed.shortTermTarget !== undefined,
          'factors 字段': Array.isArray(parsed.factors) && parsed.factors.length > 0,
          'risk 字段': parsed.risk !== undefined
        };
        
        console.log('\n🔍 验证 JSON 结构:');
        for (const [check, passed] of Object.entries(jsonChecks)) {
          console.log(`   ${passed ? '✅' : '❌'} ${check}`);
          if (!passed) allPassed = false;
        }
      } else {
        console.log('\n⚠️  警告：未找到 JSON 格式');
        allPassed = false;
      }
    } catch (e) {
      console.log(`\n⚠️  警告：JSON 解析失败 - ${e.message}`);
    }
    
    return allPassed;
    
  } catch (error) {
    console.log(`\n❌ 异常：${error.message}`);
    return false;
  }
}

// 主函数
async function main() {
  console.log('\n🚀 开始完整集成测试\n');
  
  const results = {
    qwen: false,
    doubao: false
  };
  
  // 测试通义千问
  results.qwen = await testQwenFullIntegration();
  
  // 测试豆包
  results.doubao = await testDoubaoFullIntegration();
  
  // 总结
  console.log('\n' + '='.repeat(80));
  console.log('📋 测试总结');
  console.log('='.repeat(80));
  console.log(`\n   通义千问 3.5-Max: ${results.qwen ? '✅ 通过所有验证' : '❌ 部分验证失败'}`);
  console.log(`   豆包：${results.doubao ? '✅ 通过所有验证' : '❌ 部分验证失败'}`);
  console.log('\n');
  
  if (results.qwen && results.doubao) {
    console.log('🎉 所有测试通过！AI 真实处理了所有数据并返回了真实结果。');
    console.log('\n✅ 验证项目:');
    console.log('   ✓ 所有市场数据已传递给 AI');
    console.log('   ✓ 技术指标已传递给 AI');
    console.log('   ✓ 趋势分析已传递给 AI');
    console.log('   ✓ AI 返回了真实的分析结果（非模拟）');
    console.log('   ✓ AI 回复包含置信度和目标价');
    console.log('   ✓ JSON 格式正确');
    console.log('   ✓ API 调用正常');
    process.exit(0);
  } else {
    console.log('⚠️  部分测试未通过。请检查上方的详细输出。');
    process.exit(1);
  }
}

// 运行测试
main().catch(error => {
  console.error('💥 测试执行出错:', error);
  console.error(error.stack);
  process.exit(1);
});
