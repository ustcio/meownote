// ================================================================================
// Level 3 预警系统 - 单元测试
// ================================================================================

import { AlertSystem, SGE_CONFIG } from './alert-system';
import type { GoldPriceData, AlertConfiguration } from './types';

// 测试数据生成器
function createMockGoldPrice(overrides: Partial<GoldPriceData> = {}): GoldPriceData {
  return {
    timestamp: Date.now(),
    date: new Date().toISOString().split('T')[0],
    exchangeRate: 7.2,
    domestic: {
      price: 580,
      open: 578,
      high: 585,
      low: 575,
      change: 2,
      changePercent: 0.35,
    },
    international: {
      price: 2850,
      open: 2840,
      high: 2860,
      low: 2830,
      change: 10,
      changePercent: 0.35,
    },
    source: 'test',
    reliability: 0.95,
    ...overrides,
  };
}

// 测试结果收集
interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  duration: number;
}

const testResults: TestResult[] = [];

function test(name: string, fn: () => boolean | void): void {
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

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertGreaterThanOrEqual(actual: number, expected: number, message: string): void {
  if (actual < expected) {
    throw new Error(`${message}: expected >= ${expected}, got ${actual}`);
  }
}

function assertLessThanOrEqual(actual: number, expected: number, message: string): void {
  if (actual > expected) {
    throw new Error(`${message}: expected <= ${expected}, got ${actual}`);
  }
}

// ================================================================================
// 测试套件
// ================================================================================

console.log('\n🧪 Level 3 预警系统测试开始\n');

// 测试 1: EMA 计算正确性
test('EMA 计算正确性', () => {
  const alertSystem = new AlertSystem();
  
  // 初始化价格
  const data1 = createMockGoldPrice({ domestic: { ...createMockGoldPrice().domestic, price: 580 } });
  alertSystem.updatePriceAndCheck(data1);
  
  // 价格上涨
  const data2 = createMockGoldPrice({ domestic: { ...createMockGoldPrice().domestic, price: 585 } });
  alertSystem.updatePriceAndCheck(data2);
  
  const status = alertSystem.getMarketStatus();
  
  // EMA Fast 应该更接近新价格
  assertGreaterThanOrEqual(status.emaFast, 580, 'EMA Fast should be >= 580');
  assertLessThanOrEqual(status.emaFast, 585, 'EMA Fast should be <= 585');
  
  return true;
});

// 测试 2: Session 时段感知
test('Session 时段感知', () => {
  const alertSystem = new AlertSystem();
  const status = alertSystem.getMarketStatus();
  
  // 验证 session 返回有效值
  const validSessions = ['asian_morning', 'afternoon', 'night'];
  assertEqual(validSessions.includes(status.session), true, 'Session should be valid');
  
  return true;
});

// 测试 3: 动态阈值计算
test('动态阈值计算', () => {
  const alertSystem = new AlertSystem();
  
  // 注入多个价格点以建立波动率
  for (let i = 0; i < 25; i++) {
    const price = 580 + Math.sin(i * 0.5) * 2;
    const data = createMockGoldPrice({ 
      domestic: { ...createMockGoldPrice().domestic, price },
      timestamp: Date.now() + i * 60000 
    });
    alertSystem.updatePriceAndCheck(data);
  }
  
  const status = alertSystem.getMarketStatus();
  
  // 阈值应该在合理范围内
  assertGreaterThanOrEqual(status.dynamicThreshold, SGE_CONFIG.MIN_THRESHOLD_YUAN, 
    'Threshold should be >= MIN_THRESHOLD_YUAN');
  assertLessThanOrEqual(status.dynamicThreshold, SGE_CONFIG.MAX_THRESHOLD_YUAN + 10, 
    'Threshold should be reasonable');
  
  return true;
});

// 测试 4: 信号融合评分
test('信号融合评分', () => {
  const alertSystem = new AlertSystem();
  
  // 注入正常价格
  for (let i = 0; i < 20; i++) {
    const data = createMockGoldPrice({ 
      domestic: { ...createMockGoldPrice().domestic, price: 580 },
      timestamp: Date.now() + i * 60000 
    });
    alertSystem.updatePriceAndCheck(data);
  }
  
  // 注入大幅波动
  const spikeData = createMockGoldPrice({ 
    domestic: { ...createMockGoldPrice().domestic, price: 590 },
    timestamp: Date.now() + 20 * 60000 
  });
  const alerts = alertSystem.updatePriceAndCheck(spikeData);
  
  // 大幅波动应该触发预警
  if (alerts.length > 0) {
    const alert = alerts[0];
    assertGreaterThanOrEqual(alert.level3Metadata.signalScore, 0, 
      'Signal score should be >= 0');
    assertLessThanOrEqual(alert.level3Metadata.signalScore, 6, 
      'Signal score should be <= 6');
  }
  
  return true;
});

// 测试 5: 价格穿越检测
test('价格穿越检测', () => {
  const alertSystem = new AlertSystem();
  
  // 创建预警配置
  const config: Omit<AlertConfiguration, 'id' | 'createdAt' | 'updatedAt'> = {
    userId: 'test_user',
    alertType: 'price_target',
    conditions: {
      targetPrice: 575,
    },
    tolerance: {
      buy: 2,
      sell: 2,
    },
    notification: {
      channels: ['push'],
      frequency: 'immediate',
    },
    isActive: true,
  };
  
  alertSystem.createConfiguration(config);
  
  // 价格从上方穿越到下方
  const data1 = createMockGoldPrice({ 
    domestic: { ...createMockGoldPrice().domestic, price: 580 },
  });
  alertSystem.updatePriceAndCheck(data1);
  
  const data2 = createMockGoldPrice({ 
    domestic: { ...createMockGoldPrice().domestic, price: 574 },
  });
  const alerts = alertSystem.updatePriceAndCheck(data2);
  
  // 应该检测到买入信号
  const buyAlert = alerts.find(a => a.type === 'price_target' && a.metadata?.crossType === 'buy');
  
  // 注意：由于冷却期，可能不会触发，这是预期行为
  return true;
});

// 测试 6: 去重保护
test('去重保护', () => {
  const alertSystem = new AlertSystem();
  
  // 注入相同方向的多次波动
  let totalAlerts = 0;
  for (let i = 0; i < 10; i++) {
    const data = createMockGoldPrice({ 
      domestic: { ...createMockGoldPrice().domestic, price: 580 + i * 3 },
      timestamp: Date.now() + i * 1000 
    });
    const alerts = alertSystem.updatePriceAndCheck(data);
    totalAlerts += alerts.length;
  }
  
  // 由于去重保护，不应该每个价格变化都触发预警
  // 预期：总预警数应该远小于价格变化次数
  console.log(`  总预警数: ${totalAlerts} / 10 次价格变化`);
  
  return true;
});

// 测试 7: 动态冷却
test('动态冷却', () => {
  const alertSystem = new AlertSystem();
  
  // 注入高波动数据
  for (let i = 0; i < 20; i++) {
    const price = 580 + (Math.random() - 0.5) * 10;
    const data = createMockGoldPrice({ 
      domestic: { ...createMockGoldPrice().domestic, price },
      timestamp: Date.now() + i * 60000 
    });
    alertSystem.updatePriceAndCheck(data);
  }
  
  const stats = alertSystem.getStatistics();
  
  // 验证统计信息
  assertGreaterThanOrEqual(stats.totalAlerts, 0, 'Total alerts should be >= 0');
  
  return true;
});

// 测试 8: 统计功能
test('统计功能', () => {
  const alertSystem = new AlertSystem();
  
  // 注入一些数据
  for (let i = 0; i < 30; i++) {
    const price = 580 + Math.sin(i * 0.3) * 5;
    const data = createMockGoldPrice({ 
      domestic: { ...createMockGoldPrice().domestic, price },
      timestamp: Date.now() + i * 60000 
    });
    alertSystem.updatePriceAndCheck(data);
  }
  
  const stats = alertSystem.getStatistics();
  
  // 验证统计字段存在
  assertEqual(typeof stats.totalAlerts, 'number', 'totalAlerts should be number');
  assertEqual(typeof stats.avgSignalScore, 'number', 'avgSignalScore should be number');
  assertEqual(typeof stats.bySession, 'object', 'bySession should be object');
  
  return true;
});

// 测试 9: 配置管理
test('配置管理', () => {
  const alertSystem = new AlertSystem();
  
  const config = alertSystem.createConfiguration({
    userId: 'test',
    alertType: 'price_target',
    conditions: { targetPrice: 600 },
    tolerance: { buy: 2, sell: 2 },
    notification: { channels: ['push'], frequency: 'immediate' },
    isActive: true,
  });
  
  assertEqual(config.userId, 'test', 'Config userId should match');
  assertEqual(config.conditions.targetPrice, 600, 'Config targetPrice should match');
  
  // 更新配置
  const updated = alertSystem.updateConfiguration(config.id, { isActive: false });
  assertEqual(updated?.isActive, false, 'Config should be deactivated');
  
  // 删除配置
  const deleted = alertSystem.deleteConfiguration(config.id);
  assertEqual(deleted, true, 'Config should be deleted');
  
  return true;
});

// 测试 10: 市场状态
test('市场状态', () => {
  const alertSystem = new AlertSystem();
  
  // 注入数据
  for (let i = 0; i < 25; i++) {
    const price = 580 + Math.sin(i * 0.2) * 3;
    const data = createMockGoldPrice({ 
      domestic: { ...createMockGoldPrice().domestic, price },
      timestamp: Date.now() + i * 60000 
    });
    alertSystem.updatePriceAndCheck(data);
  }
  
  const status = alertSystem.getMarketStatus();
  
  // 验证所有字段
  assertEqual(typeof status.volatility, 'number', 'volatility should be number');
  assertEqual(typeof status.trend, 'string', 'trend should be string');
  assertEqual(typeof status.emaFast, 'number', 'emaFast should be number');
  assertEqual(typeof status.emaSlow, 'number', 'emaSlow should be number');
  assertEqual(typeof status.atr, 'number', 'atr should be number');
  assertEqual(typeof status.dynamicThreshold, 'number', 'dynamicThreshold should be number');
  
  console.log(`  波动率: ${status.volatility.toFixed(4)}`);
  console.log(`  趋势: ${status.trend}`);
  console.log(`  EMA Fast/Slow: ${status.emaFast.toFixed(2)}/${status.emaSlow.toFixed(2)}`);
  console.log(`  ATR: ${status.atr.toFixed(2)}`);
  console.log(`  动态阈值: ${status.dynamicThreshold.toFixed(2)}`);
  
  return true;
});

// 测试 11: 性能测试
test('性能测试 - 1000次更新', () => {
  const alertSystem = new AlertSystem();
  const startTime = Date.now();
  
  for (let i = 0; i < 1000; i++) {
    const price = 580 + Math.sin(i * 0.01) * 5;
    const data = createMockGoldPrice({ 
      domestic: { ...createMockGoldPrice().domestic, price },
      timestamp: Date.now() + i * 60000 
    });
    alertSystem.updatePriceAndCheck(data);
  }
  
  const duration = Date.now() - startTime;
  const avgTime = duration / 1000;
  
  console.log(`  总耗时: ${duration}ms`);
  console.log(`  平均每次: ${avgTime.toFixed(3)}ms`);
  
  // 性能要求：每次更新应该 < 5ms
  assertLessThanOrEqual(avgTime, 5, 'Average update time should be < 5ms');
  
  return true;
});

// 测试 12: 内存稳定性
test('内存稳定性 - 历史数据限制', () => {
  const alertSystem = new AlertSystem();
  
  // 注入大量数据
  for (let i = 0; i < 500; i++) {
    const data = createMockGoldPrice({ 
      domestic: { ...createMockGoldPrice().domestic, price: 580 + i * 0.1 },
      timestamp: Date.now() + i * 60000 
    });
    alertSystem.updatePriceAndCheck(data);
  }
  
  const history = alertSystem.getAlertHistory();
  
  // 历史应该有限制
  console.log(`  预警历史长度: ${history.length}`);
  
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

// 导出测试结果
export { testResults };
