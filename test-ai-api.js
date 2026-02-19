#!/usr/bin/env node
/**
 * AI API 集成测试脚本
 * 测试通义千问 Max 和豆包的 API 调用
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 模拟环境配置
const mockEnv = {
  DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY || '',
  DOUBAO_API_KEY: process.env.DOUBAO_API_KEY || ''
};

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
  ]
};

console.log('🧪 AI API 集成测试\n');
console.log('='.repeat(60));

// 检查 API 密钥
if (!mockEnv.DASHSCOPE_API_KEY) {
  console.warn('⚠️  警告：DASHSCOPE_API_KEY 未设置');
  console.log('   请在 .env 文件中设置通义千问 API 密钥\n');
} else {
  console.log('✅ DASHSCOPE_API_KEY 已配置');
}

if (!mockEnv.DOUBAO_API_KEY) {
  console.warn('⚠️  警告：DOUBAO_API_KEY 未设置');
  console.log('   请在 .env 文件中设置豆包 API 密钥\n');
} else {
  console.log('✅ DOUBAO_API_KEY 已配置');
}

console.log('='.repeat(60));
console.log('\n📊 测试数据:');
console.log(`   当前价格：¥${testData.currentPrice}/克`);
console.log(`   今日涨跌：${testData.changePercent.toFixed(2)}%`);
console.log(`   价格趋势：${testData.priceHistory.length} 个数据点`);
console.log('\n');

// 测试通义千问 API (使用 OpenAI 兼容协议)
async function testQwenAPI() {
  console.log('🔵 测试通义千问 3.5-Max API...\n');
  
  const prompt = `【市场数据】
当前价格：¥${testData.currentPrice}/克
今日开盘：¥${testData.openPrice}/克
今日最高：¥${testData.high}/克
今日最低：¥${testData.low}/克
日内涨跌：${testData.changePercent.toFixed(2)}%

请分析以上数据并提供：
1. 短期价格预测 (1-4 小时)
2. 趋势判断及置信度
3. 交易建议

请以 JSON 格式返回，包含以下字段：
{
  "direction": "bullish/bearish/neutral",
  "confidence": 0.0-1.0,
  "shortTermTarget": 目标价格，
  "factors": ["因素 1", "因素 2"],
  "risk": "low/medium/high"
}`;

  try {
    const startTime = Date.now();
    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mockEnv.DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen3-max-2026-01-23',
        messages: [
          { role: 'system', content: '你是黄金交易分析专家，擅长技术分析和趋势判断。请基于提供的数据进行分析，并以 JSON 格式返回结果。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    const elapsed = Date.now() - startTime;
    console.log(`   响应时间：${elapsed}ms`);
    console.log(`   状态码：${response.status}`);

    if (response.ok) {
      const result = await response.json();
      const aiResponse = result.choices?.[0]?.message?.content;
      
      console.log('   ✅ API 调用成功\n');
      console.log('   AI 分析结果:');
      console.log('   ' + '-'.repeat(56));
      
      if (aiResponse) {
        // 尝试解析 JSON
        try {
          const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            console.log('   方向:', parsed.direction);
            console.log('   置信度:', parsed.confidence);
            console.log('   目标价:', parsed.shortTermTarget);
            console.log('   风险等级:', parsed.risk);
            console.log('   关键因素:', parsed.factors?.join(', '));
          } else {
            console.log('   原始响应:', aiResponse.substring(0, 200) + '...');
          }
        } catch (e) {
          console.log('   原始响应:', aiResponse.substring(0, 200) + '...');
        }
      }
      console.log('   ' + '-'.repeat(56));
      console.log('\n');
      return true;
    } else {
      const error = await response.text();
      console.log('   ❌ API 调用失败');
      console.log('   错误:', error);
      console.log('\n');
      return false;
    }
  } catch (error) {
    console.log('   ❌ 异常:', error.message);
    console.log('\n');
    return false;
  }
}

// 测试豆包 API
async function testDoubaoAPI() {
  console.log('🟢 测试豆包 API...\n');
  
  const prompt = `【市场数据】
当前价格：¥${testData.currentPrice}/克
今日开盘：¥${testData.openPrice}/克
今日最高：¥${testData.high}/克
今日最低：¥${testData.low}/克
日内涨跌：${testData.changePercent.toFixed(2)}%

请分析以上数据并提供：
1. 短期价格预测 (1-4 小时)
2. 趋势判断及置信度
3. 交易建议

请以 JSON 格式返回，包含以下字段：
{
  "direction": "bullish/bearish/neutral",
  "confidence": 0.0-1.0,
  "shortTermTarget": 目标价格，
  "factors": ["因素 1", "因素 2"],
  "risk": "low/medium/high"
}`;

  try {
    const startTime = Date.now();
    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mockEnv.DOUBAO_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'doubao-seed-2-0-pro-260215',
        messages: [
          { role: 'system', content: '你是黄金交易分析专家，擅长技术分析和趋势判断。请基于提供的数据进行分析，并以 JSON 格式返回结果。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    const elapsed = Date.now() - startTime;
    console.log(`   响应时间：${elapsed}ms`);
    console.log(`   状态码：${response.status}`);

    if (response.ok) {
      const result = await response.json();
      const aiResponse = result.choices?.[0]?.message?.content;
      
      console.log('   ✅ API 调用成功\n');
      console.log('   AI 分析结果:');
      console.log('   ' + '-'.repeat(56));
      
      if (aiResponse) {
        try {
          const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            console.log('   方向:', parsed.direction);
            console.log('   置信度:', parsed.confidence);
            console.log('   目标价:', parsed.shortTermTarget);
            console.log('   风险等级:', parsed.risk);
            console.log('   关键因素:', parsed.factors?.join(', '));
          } else {
            console.log('   原始响应:', aiResponse.substring(0, 200) + '...');
          }
        } catch (e) {
          console.log('   原始响应:', aiResponse.substring(0, 200) + '...');
        }
      }
      console.log('   ' + '-'.repeat(56));
      console.log('\n');
      return true;
    } else {
      const error = await response.text();
      console.log('   ❌ API 调用失败');
      console.log('   错误:', error);
      console.log('\n');
      return false;
    }
  } catch (error) {
    console.log('   ❌ 异常:', error.message);
    console.log('\n');
    return false;
  }
}

// 主函数
async function main() {
  console.log('🚀 开始测试 AI API 集成\n');
  
  const results = {
    qwen: false,
    doubao: false
  };

  // 测试通义千问
  if (mockEnv.DASHSCOPE_API_KEY) {
    results.qwen = await testQwenAPI();
  } else {
    console.log('⏭️  跳过通义千问测试（API 密钥未配置）\n');
  }

  console.log('='.repeat(60));
  console.log('\n');

  // 测试豆包
  if (mockEnv.DOUBAO_API_KEY) {
    results.doubao = await testDoubaoAPI();
  } else {
    console.log('⏭️  跳过豆包测试（API 密钥未配置）\n');
  }

  console.log('='.repeat(60));
  console.log('\n📋 测试总结:\n');
  console.log(`   通义千问 Max: ${results.qwen ? '✅ 通过' : '❌ 失败'}`);
  console.log(`   豆包：${results.doubao ? '✅ 通过' : '❌ 失败'}`);
  console.log('\n');

  if (results.qwen && results.doubao) {
    console.log('🎉 所有测试通过！AI API 集成正常。');
    process.exit(0);
  } else if (results.qwen || results.doubao) {
    console.log('⚠️  部分测试通过。请检查失败的 API 配置。');
    process.exit(1);
  } else {
    console.log('❌ 所有测试失败。请检查 API 密钥配置和网络连接。');
    process.exit(1);
  }
}

// 运行测试
main().catch(error => {
  console.error('💥 测试执行出错:', error);
  process.exit(1);
});
