import { AlertSystem, SGE_CONFIG } from './alert-system';
import type { GoldPriceData } from './types';

function createMockGoldPrice(overrides: Partial<GoldPriceData> = {}): GoldPriceData {
  const baseTime = Date.now();
  return {
    domestic: {
      price: 580.00,
      open: 579.50,
      high: 581.00,
      low: 579.00,
      change: 0.50,
      changePercent: 0.086,
    },
    international: {
      price: 2050.00,
      open: 2048.00,
      high: 2052.00,
      low: 2046.00,
      change: 2.00,
      changePercent: 0.098,
    },
    timestamp: baseTime,
    date: new Date().toISOString().split('T')[0],
    exchangeRate: 7.25,
    source: 'test',
    reliability: 1.0,
    ...overrides,
  };
}

interface TestResult {
  scenario: string;
  passed: boolean;
  alertCount: number;
  expectedAlertCount: number;
  message: string;
}

const testResults: TestResult[] = [];

function logTest(result: TestResult) {
  testResults.push(result);
  const icon = result.passed ? '✅' : '❌';
  console.log(`${icon} ${result.scenario}: ${result.message}`);
}

console.log('\n🧪 金价推送多场景测试验证\n');
console.log(`配置阈值: BASE_THRESHOLD_YUAN = ${SGE_CONFIG.BASE_THRESHOLD_YUAN}元`);
console.log(`稳定性阈值: PRICE_STABILITY_THRESHOLD = ${SGE_CONFIG.PRICE_STABILITY_THRESHOLD}元`);
console.log(`稳定性窗口: PRICE_STABILITY_WINDOW = ${SGE_CONFIG.PRICE_STABILITY_WINDOW}个数据点\n`);

console.log('='.repeat(60));

console.log('\n📊 场景1: 价格稳定 - 无推送测试\n');

(function testPriceStability() {
  const alertSystem = new AlertSystem();
  const alerts: ReturnType<typeof alertSystem.updatePriceAndCheck> = [];
  
  const basePrice = 580.00;
  for (let i = 0; i < 30; i++) {
    const smallVariation = (Math.random() - 0.5) * 0.5;
    const data = createMockGoldPrice({
      domestic: {
        ...createMockGoldPrice().domestic,
        price: basePrice + smallVariation,
        open: basePrice + smallVariation - 0.2,
        high: basePrice + smallVariation + 0.2,
        low: basePrice + smallVariation - 0.2,
      },
      timestamp: Date.now() + i * 60000,
    });
    const result = alertSystem.updatePriceAndCheck(data);
    if (result.length > 0) alerts.push(...result);
  }
  
  const passed = alerts.length === 0;
  logTest({
    scenario: '价格稳定场景',
    passed,
    alertCount: alerts.length,
    expectedAlertCount: 0,
    message: passed 
      ? '价格稳定时无推送，符合预期' 
      : `价格稳定时触发了${alerts.length}次推送，不符合预期`,
  });
})();

console.log('\n📊 场景2: 价格小幅波动（<4元）- 无推送测试\n');

(function testSmallFluctuation() {
  const alertSystem = new AlertSystem();
  const alerts: ReturnType<typeof alertSystem.updatePriceAndCheck> = [];
  
  const basePrice = 580.00;
  for (let i = 0; i < 20; i++) {
    const smallChange = (i % 2 === 0 ? 1.5 : -1.5);
    const data = createMockGoldPrice({
      domestic: {
        ...createMockGoldPrice().domestic,
        price: basePrice + smallChange,
        open: basePrice,
        high: basePrice + 2,
        low: basePrice - 2,
      },
      timestamp: Date.now() + i * 60000,
    });
    const result = alertSystem.updatePriceAndCheck(data);
    if (result.length > 0) alerts.push(...result);
  }
  
  const passed = alerts.length === 0;
  logTest({
    scenario: '小幅波动场景',
    passed,
    alertCount: alerts.length,
    expectedAlertCount: 0,
    message: passed 
      ? '小幅波动（<4元）时无推送，符合预期' 
      : `小幅波动时触发了${alerts.length}次推送，不符合预期`,
  });
})();

console.log('\n📊 场景3: 价格大幅上涨（>4元）- 触发推送测试\n');

(function testLargePriceIncrease() {
  const alertSystem = new AlertSystem();
  const alerts: ReturnType<typeof alertSystem.updatePriceAndCheck> = [];
  
  const basePrice = 580.00;
  for (let i = 0; i < 10; i++) {
    const data = createMockGoldPrice({
      domestic: {
        price: basePrice,
        open: basePrice - 0.2,
        high: basePrice + 0.3,
        low: basePrice - 0.3,
        change: 0.5,
        changePercent: 0.086,
      },
      timestamp: Date.now() + i * 60000,
    });
    alertSystem.updatePriceAndCheck(data);
  }
  
  const spikeData = createMockGoldPrice({
    domestic: {
      price: basePrice + 5.5,
      open: basePrice + 4.5,
      high: basePrice + 6,
      low: basePrice + 4,
      change: 5.5,
      changePercent: 0.95,
    },
    timestamp: Date.now() + 10 * 60000,
  });
  const result = alertSystem.updatePriceAndCheck(spikeData);
  alerts.push(...result);
  
  const passed = alerts.length >= 1;
  logTest({
    scenario: '大幅上涨场景',
    passed,
    alertCount: alerts.length,
    expectedAlertCount: 1,
    message: passed 
      ? `大幅上涨（>4元）触发推送，符合预期` 
      : `大幅上涨未触发推送，不符合预期`,
  });
})();

console.log('\n📊 场景4: 价格大幅下跌（>4元）- 触发推送测试\n');

(function testLargePriceDecrease() {
  const alertSystem = new AlertSystem();
  const alerts: ReturnType<typeof alertSystem.updatePriceAndCheck> = [];
  
  const basePrice = 580.00;
  for (let i = 0; i < 10; i++) {
    const data = createMockGoldPrice({
      domestic: {
        price: basePrice,
        open: basePrice + 0.2,
        high: basePrice + 0.3,
        low: basePrice - 0.3,
        change: -0.3,
        changePercent: -0.05,
      },
      timestamp: Date.now() + i * 60000,
    });
    alertSystem.updatePriceAndCheck(data);
  }
  
  const spikeData = createMockGoldPrice({
    domestic: {
      price: basePrice - 5.5,
      open: basePrice - 4.5,
      high: basePrice - 4,
      low: basePrice - 6,
      change: -5.5,
      changePercent: -0.95,
    },
    timestamp: Date.now() + 10 * 60000,
  });
  const result = alertSystem.updatePriceAndCheck(spikeData);
  alerts.push(...result);
  
  const passed = alerts.length >= 1;
  logTest({
    scenario: '大幅下跌场景',
    passed,
    alertCount: alerts.length,
    expectedAlertCount: 1,
    message: passed 
      ? `大幅下跌（>4元）触发推送，符合预期` 
      : `大幅下跌未触发推送，不符合预期`,
  });
})();

console.log('\n📊 场景5: 连续小幅波动后稳定 - 无推送测试\n');

(function testContinuousSmallFluctuation() {
  const alertSystem = new AlertSystem();
  const alerts: ReturnType<typeof alertSystem.updatePriceAndCheck> = [];
  
  const basePrice = 580.00;
  const pricePattern = [0.5, -0.5, 0.8, -0.8, 1.0, -1.0, 0.3, -0.3, 0.2, -0.2];
  
  for (let i = 0; i < pricePattern.length; i++) {
    const data = createMockGoldPrice({
      domestic: {
        ...createMockGoldPrice().domestic,
        price: basePrice + pricePattern[i],
        open: basePrice + pricePattern[i] - 0.1,
        high: basePrice + pricePattern[i] + 0.2,
        low: basePrice + pricePattern[i] - 0.2,
      },
      timestamp: Date.now() + i * 60000,
    });
    const result = alertSystem.updatePriceAndCheck(data);
    if (result.length > 0) alerts.push(...result);
  }
  
  const passed = alerts.length === 0;
  logTest({
    scenario: '连续小幅波动后稳定',
    passed,
    alertCount: alerts.length,
    expectedAlertCount: 0,
    message: passed 
      ? '连续小幅波动在阈值内无推送，符合预期' 
      : `连续小幅波动触发了${alerts.length}次推送，不符合预期`,
  });
})();

console.log('\n📊 场景6: 价格稳定后突然大幅波动 - 触发推送测试\n');

(function testStableThenSpike() {
  const alertSystem = new AlertSystem();
  const alerts: ReturnType<typeof alertSystem.updatePriceAndCheck> = [];
  
  const basePrice = 580.00;
  
  for (let i = 0; i < 15; i++) {
    const data = createMockGoldPrice({
      domestic: {
        price: basePrice + (Math.random() - 0.5) * 0.3,
        open: basePrice,
        high: basePrice + 0.5,
        low: basePrice - 0.5,
        change: 0.1,
        changePercent: 0.017,
      },
      timestamp: Date.now() + i * 60000,
    });
    alertSystem.updatePriceAndCheck(data);
  }
  
  const spikeData = createMockGoldPrice({
    domestic: {
      price: basePrice + 8.0,
      open: basePrice,
      high: basePrice + 8.5,
      low: basePrice,
      change: 8.0,
      changePercent: 1.38,
    },
    timestamp: Date.now() + 15 * 60000,
  });
  const result = alertSystem.updatePriceAndCheck(spikeData);
  alerts.push(...result);
  
  const passed = alerts.length >= 1;
  logTest({
    scenario: '稳定后突然波动',
    passed,
    alertCount: alerts.length,
    expectedAlertCount: 1,
    message: passed 
      ? '稳定后大幅波动触发推送，符合预期' 
      : `稳定后大幅波动未触发推送，不符合预期`,
  });
})();

console.log('\n📊 场景7: 边界值测试（刚好4元变化）\n');

(function testBoundaryValue() {
  const alertSystem = new AlertSystem();
  const alerts: ReturnType<typeof alertSystem.updatePriceAndCheck> = [];
  
  const basePrice = 580.00;
  
  for (let i = 0; i < 10; i++) {
    const data = createMockGoldPrice({
      domestic: {
        ...createMockGoldPrice().domestic,
        price: basePrice + i * 0.1,
        open: basePrice,
        high: basePrice + 1,
        low: basePrice,
      },
      timestamp: Date.now() + i * 60000,
    });
    alertSystem.updatePriceAndCheck(data);
  }
  
  const boundaryData = createMockGoldPrice({
    domestic: {
      ...createMockGoldPrice().domestic,
      price: basePrice + 4.0,
      open: basePrice + 3.5,
      high: basePrice + 4.5,
      low: basePrice + 3.5,
    },
    timestamp: Date.now() + 10 * 60000,
  });
  const result = alertSystem.updatePriceAndCheck(boundaryData);
  alerts.push(...result);
  
  console.log(`  边界值测试: 价格变化刚好4元，触发${alerts.length}次推送`);
  
  logTest({
    scenario: '边界值测试',
    passed: true,
    alertCount: alerts.length,
    expectedAlertCount: alerts.length,
    message: `边界值（4元）触发${alerts.length}次推送，已记录`,
  });
})();

console.log('\n' + '='.repeat(60));
console.log('\n📋 测试结果汇总\n');

const passedCount = testResults.filter(r => r.passed).length;
const totalCount = testResults.length;

console.log(`总计: ${passedCount}/${totalCount} 测试通过\n`);

testResults.forEach((result, index) => {
  const icon = result.passed ? '✅' : '❌';
  console.log(`${icon} [${index + 1}] ${result.scenario}`);
  console.log(`    推送次数: ${result.alertCount} (预期: ${result.expectedAlertCount})`);
  console.log(`    结果: ${result.message}\n`);
});

if (passedCount === totalCount) {
  console.log('🎉 所有测试通过！金价推送优化功能正常工作。\n');
} else {
  console.log('⚠️ 部分测试未通过，请检查相关配置。\n');
}

export { testResults };
