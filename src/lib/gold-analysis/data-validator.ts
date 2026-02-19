// ================================================================================
// 数据验证工具模块
// 创建日期：2026-02-19
// 目的：防止脏数据污染 AI 分析，确保数据质量
// ================================================================================

import type { GoldPriceData } from './types';

// 验证配置
const VALIDATION_CONFIG = {
  // 价格范围限制
  MIN_DOMESTIC_PRICE: 100,      // 最低国内金价 (元/克)
  MAX_DOMESTIC_PRICE: 2000,     // 最高国内金价 (元/克)
  MIN_INTERNATIONAL_PRICE: 500, // 最低国际金价 (美元/盎司)
  MAX_INTERNATIONAL_PRICE: 5000,// 最高国际金价 (美元/盎司)
  
  // 涨跌幅限制
  MAX_DAILY_CHANGE_PERCENT: 20, // 单日最大涨跌幅 (%)
  
  // 汇率限制
  MIN_EXCHANGE_RATE: 5,         // 最低汇率
  MAX_EXCHANGE_RATE: 10,        // 最高汇率
  
  // OHLC 数据验证
  MAX_PRICE_RANGE_PERCENT: 10,  // 最高价/最低价最大差异 (%)
  
  // 可靠性评分限制
  MIN_RELIABILITY: 0,           // 最低可靠性评分
  MAX_RELIABILITY: 1,           // 最高可靠性评分
  
  // 时间戳验证
  MAX_TIMESTAMP_AGE_MS: 10 * 60 * 1000, // 最大时间戳年龄 (10 分钟)
};

// 验证结果
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  value: any;
  severity: 'critical' | 'error';
}

export interface ValidationWarning {
  field: string;
  message: string;
  value: any;
  suggestion?: string;
}

/**
 * 验证金价数据
 */
export function validateGoldPriceData(data: GoldPriceData): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // 1. 验证国内金价
  validateDomesticPrice(data, errors, warnings);

  // 2. 验证国际金价
  validateInternationalPrice(data, errors, warnings);

  // 3. 验证汇率
  validateExchangeRate(data, errors, warnings);

  // 4. 验证 OHLC 数据一致性
  validateOHLCData(data, errors, warnings);

  // 5. 验证时间戳
  validateTimestamp(data, errors, warnings);

  // 6. 验证可靠性评分
  validateReliability(data, errors, warnings);

  // 7. 验证数据合理性（国际国内价格对比）
  validatePriceConsistency(data, errors, warnings);

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 验证国内金价
 */
function validateDomesticPrice(
  data: GoldPriceData,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  const { price, open, high, low, changePercent } = data.domestic;

  // 价格范围验证
  if (price <= 0) {
    errors.push({
      field: 'domestic.price',
      message: '国内金价必须大于 0',
      value: price,
      severity: 'critical',
    });
  } else if (price < VALIDATION_CONFIG.MIN_DOMESTIC_PRICE || 
             price > VALIDATION_CONFIG.MAX_DOMESTIC_PRICE) {
    errors.push({
      field: 'domestic.price',
      message: `国内金价超出合理范围 (${VALIDATION_CONFIG.MIN_DOMESTIC_PRICE}-${VALIDATION_CONFIG.MAX_DOMESTIC_PRICE}元/克)`,
      value: price,
      severity: 'error',
    });
  }

  // 涨跌幅验证
  if (Math.abs(changePercent) > VALIDATION_CONFIG.MAX_DAILY_CHANGE_PERCENT) {
    errors.push({
      field: 'domestic.changePercent',
      message: `单日涨跌幅超出合理范围 (±${VALIDATION_CONFIG.MAX_DAILY_CHANGE_PERCENT}%)`,
      value: changePercent,
      severity: 'error',
    });
  }

  // 开盘价验证
  if (open > 0 && Math.abs((open - price) / price) > 0.1) {
    warnings.push({
      field: 'domestic.open',
      message: '开盘价与当前价格差异过大',
      value: open,
      suggestion: `当前价格：${price}`,
    });
  }
}

/**
 * 验证国际金价
 */
function validateInternationalPrice(
  data: GoldPriceData,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  const { price, changePercent } = data.international;

  // 价格范围验证
  if (price <= 0) {
    errors.push({
      field: 'international.price',
      message: '国际金价必须大于 0',
      value: price,
      severity: 'critical',
    });
  } else if (price < VALIDATION_CONFIG.MIN_INTERNATIONAL_PRICE || 
             price > VALIDATION_CONFIG.MAX_INTERNATIONAL_PRICE) {
    errors.push({
      field: 'international.price',
      message: `国际金价超出合理范围 (${VALIDATION_CONFIG.MIN_INTERNATIONAL_PRICE}-${VALIDATION_CONFIG.MAX_INTERNATIONAL_PRICE}美元/盎司)`,
      value: price,
      severity: 'error',
    });
  }

  // 涨跌幅验证
  if (Math.abs(changePercent) > VALIDATION_CONFIG.MAX_DAILY_CHANGE_PERCENT) {
    errors.push({
      field: 'international.changePercent',
      message: `单日涨跌幅超出合理范围 (±${VALIDATION_CONFIG.MAX_DAILY_CHANGE_PERCENT}%)`,
      value: changePercent,
      severity: 'error',
    });
  }
}

/**
 * 验证汇率
 */
function validateExchangeRate(
  data: GoldPriceData,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  const { exchangeRate } = data;

  if (exchangeRate <= 0) {
    errors.push({
      field: 'exchangeRate',
      message: '汇率必须大于 0',
      value: exchangeRate,
      severity: 'critical',
    });
  } else if (exchangeRate < VALIDATION_CONFIG.MIN_EXCHANGE_RATE || 
             exchangeRate > VALIDATION_CONFIG.MAX_EXCHANGE_RATE) {
    errors.push({
      field: 'exchangeRate',
      message: `汇率超出合理范围 (${VALIDATION_CONFIG.MIN_EXCHANGE_RATE}-${VALIDATION_CONFIG.MAX_EXCHANGE_RATE})`,
      value: exchangeRate,
      severity: 'error',
    });
  }
}

/**
 * 验证 OHLC 数据一致性
 */
function validateOHLCData(
  data: GoldPriceData,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  const { open, high, low, price } = data.domestic;

  // 检查 OHLC 完整性
  if (open > 0 && high > 0 && low > 0) {
    // 最高价应该 >= 最低价
    if (high < low) {
      errors.push({
        field: 'domestic.high/low',
        message: '最高价不能低于最低价',
        value: { high, low },
        severity: 'critical',
      });
    }

    // 当前价格应该在最高价和最低价之间
    if (price < low || price > high) {
      warnings.push({
        field: 'domestic.price',
        message: '当前价格不在最高价和最低价范围内',
        value: price,
        suggestion: `合理范围：${low}-${high}`,
      });
    }

    // 价格区间验证
    const rangePercent = ((high - low) / low) * 100;
    if (rangePercent > VALIDATION_CONFIG.MAX_PRICE_RANGE_PERCENT) {
      warnings.push({
        field: 'domestic.high/low',
        message: `价格区间过大 (${rangePercent.toFixed(2)}%)`,
        value: { high, low },
        suggestion: `正常范围：<${VALIDATION_CONFIG.MAX_PRICE_RANGE_PERCENT}%`,
      });
    }
  }
}

/**
 * 验证时间戳
 */
function validateTimestamp(
  data: GoldPriceData,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  const { timestamp } = data;
  const now = Date.now();
  const age = now - timestamp;

  // 时间戳不能是未来
  if (timestamp > now + 60000) { // 允许 1 分钟误差
    errors.push({
      field: 'timestamp',
      message: '时间戳不能是未来时间',
      value: new Date(timestamp).toISOString(),
      severity: 'error',
    });
  }

  // 时间戳不能太旧
  if (age > VALIDATION_CONFIG.MAX_TIMESTAMP_AGE_MS) {
    warnings.push({
      field: 'timestamp',
      message: `数据可能已过时 (${Math.floor(age / 60000)}分钟前)`,
      value: new Date(timestamp).toISOString(),
      suggestion: '建议获取最新数据',
    });
  }
}

/**
 * 验证可靠性评分
 */
function validateReliability(
  data: GoldPriceData,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  const { reliability } = data;

  if (reliability < VALIDATION_CONFIG.MIN_RELIABILITY || 
      reliability > VALIDATION_CONFIG.MAX_RELIABILITY) {
    errors.push({
      field: 'reliability',
      message: `可靠性评分超出范围 (${VALIDATION_CONFIG.MIN_RELIABILITY}-${VALIDATION_CONFIG.MAX_RELIABILITY})`,
      value: reliability,
      severity: 'error',
    });
  } else if (reliability < 0.5) {
    warnings.push({
      field: 'reliability',
      message: '可靠性评分较低',
      value: reliability,
      suggestion: '建议检查数据源质量',
    });
  }
}

/**
 * 验证价格一致性（国际国内对比）
 */
function validatePriceConsistency(
  data: GoldPriceData,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  const { domestic, international, exchangeRate } = data;

  // 将国际金价转换为人民币/克
  // 1 盎司 ≈ 31.1035 克
  const internationalPriceCNYPerGram = 
    (international.price * exchangeRate) / 31.1035;

  const domesticPrice = domestic.price;
  const priceDiff = Math.abs(internationalPriceCNYPerGram - domesticPrice);
  const priceDiffPercent = (priceDiff / domesticPrice) * 100;

  // 价差超过 5% 发出警告
  if (priceDiffPercent > 5) {
    warnings.push({
      field: 'price_consistency',
      message: '国内国际金价差异过大',
      value: {
        domestic: domesticPrice,
        internationalCNY: internationalPriceCNYPerGram,
        diffPercent: priceDiffPercent,
      },
      suggestion: '可能由于市场闭市、数据延迟或套利机会',
    });
  }
}

/**
 * 验证并记录日志
 */
export function validateAndLog(data: GoldPriceData): boolean {
  const result = validateGoldPriceData(data);

  if (!result.isValid) {
    console.error('[DataValidator] Validation failed:', {
      errors: result.errors,
      data: {
        domestic: data.domestic.price,
        international: data.international.price,
        timestamp: data.timestamp,
      },
    });
  }

  if (result.warnings.length > 0) {
    console.warn('[DataValidator] Validation warnings:', result.warnings);
  }

  return result.isValid;
}

/**
 * 安全的数据获取（带验证）
 */
export async function fetchValidatedGoldData(
  fetchFn: () => Promise<GoldPriceData | null>,
  maxRetries: number = 3
): Promise<GoldPriceData | null> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const data = await fetchFn();
      
      if (!data) {
        console.warn(`[DataValidator] Fetch returned null (attempt ${i + 1}/${maxRetries})`);
        continue;
      }

      const result = validateGoldPriceData(data);
      
      if (result.isValid) {
        if (result.warnings.length > 0) {
          console.warn('[DataValidator] Data accepted with warnings:', result.warnings);
        }
        return data;
      }

      console.error(`[DataValidator] Data validation failed (attempt ${i + 1}/${maxRetries}):`, 
        result.errors);

      if (i === maxRetries - 1) {
        // 最后一次尝试仍然失败，返回 null
        return null;
      }

      // 等待后重试（指数退避）
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    } catch (error) {
      console.error(`[DataValidator] Fetch error (attempt ${i + 1}/${maxRetries}):`, error);
      
      if (i === maxRetries - 1) {
        return null;
      }
      
      // 等待后重试（指数退避）
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }

  return null;
}

// 导出默认验证函数
export default {
  validateGoldPriceData,
  validateAndLog,
  fetchValidatedGoldData,
  VALIDATION_CONFIG,
};
