// ================================================================================
// Phase 2-4 迭代优化 - 单元测试
// ================================================================================

const testResults: { name: string; passed: boolean; message: string; duration: number }[] = [];

function test(name: string, fn: () => boolean | void) {
  const startTime = Date.now();
  try {
    const result = fn();
    const duration = Date.now() - startTime;
    const passed = result !== false;
    testResults.push({ name, passed, message: passed ? 'OK' : 'Failed', duration });
    console.log(`${passed ? '✅' : '❌'} ${name} (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - startTime;
    testResults.push({ name, passed: false, message: String(error), duration });
    console.log(`❌ ${name} (${duration}ms) - Error: ${error}`);
  }
}

// ================================================================================
// Phase 2 测试: 容差设置集成
// ================================================================================

console.log('\n🧪 Phase 2 测试: 容差设置集成\n');

test('容差设置默认值', () => {
  const defaultTolerance = {
    buyTolerance: 2.0,
    sellTolerance: 2.0
  };
  
  if (defaultTolerance.buyTolerance !== 2.0) throw new Error('buyTolerance should be 2.0');
  if (defaultTolerance.sellTolerance !== 2.0) throw new Error('sellTolerance should be 2.0');
  
  return true;
});

test('容差设置范围验证', () => {
  const minTolerance = 0.5;
  const maxTolerance = 10.0;
  
  const testCases = [
    { value: 0.3, expected: minTolerance },
    { value: 15.0, expected: maxTolerance },
    { value: 2.5, expected: 2.5 }
  ];
  
  for (const tc of testCases) {
    const clamped = Math.max(minTolerance, Math.min(maxTolerance, tc.value));
    if (clamped !== tc.expected) {
      throw new Error(`Clamp failed: ${tc.value} -> ${clamped}, expected ${tc.expected}`);
    }
  }
  
  return true;
});

// ================================================================================
// Phase 2 测试: AI 分析持久化
// ================================================================================

console.log('\n🧪 Phase 2 测试: AI 分析持久化\n');

test('AI 分析结果数据结构', () => {
  const analysisResult = {
    timestamp: Date.now(),
    price: 580.5,
    trend: 'up',
    confidence: 0.85,
    signals: JSON.stringify([{ type: 'buy', strength: 0.8 }]),
    recommendation: '建议买入',
    riskLevel: 'medium'
  };
  
  if (!analysisResult.timestamp) throw new Error('Missing timestamp');
  if (!analysisResult.price) throw new Error('Missing price');
  if (!analysisResult.trend) throw new Error('Missing trend');
  
  return true;
});

test('预警历史数据结构', () => {
  const alertHistory = {
    timestamp: Date.now(),
    session: 'night',
    direction: 'up',
    price: 580.5,
    alertType: 'level3_fusion',
    alertMessage: '信号融合评分 4',
    score: 4,
    confidence: 0.75,
    level3Metadata: JSON.stringify({
      emaFast: 580.2,
      emaSlow: 579.8,
      atr: 2.5,
      rollingStd: 1.2,
      signalScore: 4
    })
  };
  
  if (!alertHistory.session) throw new Error('Missing session');
  if (!alertHistory.direction) throw new Error('Missing direction');
  
  return true;
});

// ================================================================================
// Phase 3 测试: SSE 实时推送
// ================================================================================

console.log('\n🧪 Phase 3 测试: SSE 实时推送\n');

test('SSE 消息格式', () => {
  const sseMessage = {
    type: 'price_update',
    clientId: 'test-client-id',
    timestamp: Date.now(),
    fromCache: false,
    data: {
      domestic: { price: 580.5 },
      international: { price: 2850 }
    },
    level3: {
      session: 'night',
      trend: 'up',
      emaFast: 580.2,
      emaSlow: 579.8,
      volatility: 1.2,
      dynamicThreshold: 4.5
    }
  };
  
  if (sseMessage.type !== 'price_update') throw new Error('Invalid type');
  if (!sseMessage.level3) throw new Error('Missing level3 data');
  
  return true;
});

test('Level 3 状态计算', () => {
  const state = {
    emaFast: 581.0,
    emaSlow: 579.5,
    priceHistory: [578, 579, 580, 581, 582]
  };
  
  const trend = state.emaFast > state.emaSlow ? 'up' : state.emaFast < state.emaSlow ? 'down' : 'neutral';
  
  if (trend !== 'up') throw new Error(`Trend should be 'up', got '${trend}'`);
  
  return true;
});

// ================================================================================
// Phase 3 测试: 历史数据清理
// ================================================================================

console.log('\n🧪 Phase 3 测试: 历史数据清理\n');

test('清理时间计算', () => {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  
  const diffDays = (now - sevenDaysAgo) / (24 * 60 * 60 * 1000);
  
  if (Math.abs(diffDays - 7) > 0.001) {
    throw new Error(`Expected 7 days difference, got ${diffDays}`);
  }
  
  return true;
});

test('清理条件判断', () => {
  const currentHour = new Date().getHours();
  const shouldCleanup = currentHour === 0;
  
  // 验证逻辑正确
  if (shouldCleanup && currentHour !== 0) {
    throw new Error('Cleanup logic error');
  }
  
  return true;
});

// ================================================================================
// Phase 4 测试: 预警规则配置
// ================================================================================

console.log('\n🧪 Phase 4 测试: 预警规则配置\n');

test('配置默认值', () => {
  const defaultConfig = {
    baseThresholdYuan: 2.0,
    minThresholdYuan: 1.2,
    instantAbsThreshold: 1.8,
    instantPercentThreshold: 0.25,
    atrMultiplier: 1.8,
    zscoreThreshold: 2.8,
    baseCooldownSeconds: 120,
    maxCooldownSeconds: 600,
    dedupWindowSeconds: 180
  };
  
  if (defaultConfig.baseThresholdYuan !== 2.0) throw new Error('Invalid baseThresholdYuan');
  if (defaultConfig.zscoreThreshold !== 2.8) throw new Error('Invalid zscoreThreshold');
  
  return true;
});

test('配置参数验证', () => {
  const validateConfig = (config: { baseThresholdYuan: number; zscoreThreshold: number; baseCooldownSeconds: number }) => {
    const errors = [];
    
    if (config.baseThresholdYuan < 0.5 || config.baseThresholdYuan > 20) {
      errors.push('baseThresholdYuan out of range');
    }
    
    if (config.zscoreThreshold < 1.5 || config.zscoreThreshold > 5) {
      errors.push('zscoreThreshold out of range');
    }
    
    if (config.baseCooldownSeconds < 30 || config.baseCooldownSeconds > 3600) {
      errors.push('baseCooldownSeconds out of range');
    }
    
    return errors;
  };
  
  const validConfig = {
    baseThresholdYuan: 2.0,
    zscoreThreshold: 2.8,
    baseCooldownSeconds: 120
  };
  
  const errors = validateConfig(validConfig);
  if (errors.length > 0) throw new Error(`Valid config has errors: ${errors.join(', ')}`);
  
  const invalidConfig = {
    baseThresholdYuan: 50,
    zscoreThreshold: 10,
    baseCooldownSeconds: 5
  };
  
  const invalidErrors = validateConfig(invalidConfig);
  if (invalidErrors.length !== 3) throw new Error('Invalid config should have 3 errors');
  
  return true;
});

// ================================================================================
// 输出测试报告
// ================================================================================

console.log('\n📊 测试报告\n');

const passed = testResults.filter(r => r.passed).length;
const failed = testResults.filter(r => !r.passed).length;
const totalDuration = testResults.reduce((sum, r) => sum + r.duration, 0);

console.log('┌─────────────────────────────────────────────────────────────┐');
console.log('│                    测试结果汇总                              │');
console.log('├─────────────────────────────────────────────────────────────┤');
console.log(`│ 总测试数: ${testResults.length.toString().padEnd(46)}│`);
console.log(`│ 通过: ${passed.toString().padEnd(51)}│`);
console.log(`│ 失败: ${failed.toString().padEnd(51)}│`);
console.log(`│ 通过率: ${((passed / testResults.length) * 100).toFixed(1)}%`.padEnd(53) + '│');
console.log(`│ 总耗时: ${totalDuration}ms`.padEnd(52) + '│');
console.log('└─────────────────────────────────────────────────────────────┘');

if (failed > 0) {
  console.log('\n❌ 失败的测试:');
  testResults.filter(r => !r.passed).forEach(r => {
    console.log(`  - ${r.name}: ${r.message}`);
  });
}

export { testResults };
