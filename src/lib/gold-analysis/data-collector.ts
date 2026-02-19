// ================================================================================
// 数据采集与处理模块
// ================================================================================

import type { GoldPriceData, PriceHistoryPoint, DataQualityReport } from './types';
import { validateAndLog } from './data-validator';

// 数据源配置
const DATA_SOURCES = {
  SGE: {
    name: '上海黄金交易所',
    url: 'https://www.sge.com.cn/sjzx/mrhq',
    weight: 0.4,
    reliability: 0.95,
  },
  INTERNATIONAL: {
    name: 'CoinGecko',
    url: 'https://api.coingecko.com/api/v3/simple/price',
    weight: 0.3,
    reliability: 0.9,
  },
  EXCHANGE_RATE: {
    name: 'ExchangeRate-API',
    url: 'https://api.exchangerate-api.com/v4/latest/USD',
    weight: 0.3,
    reliability: 0.95,
  },
};

// 数据质量配置
const DATA_QUALITY_CONFIG = {
  maxAgeMs: 5 * 60 * 1000, // 5分钟
  maxPriceChangePerMin: 0.5, // 每分钟最大价格变动百分比
  minDataPoints: 3, // 最小数据源数量
  outlierThreshold: 3, // 异常值阈值 (标准差倍数)
};

/**
 * 数据收集器类
 */
export class GoldDataCollector {
  private lastUpdateTime: number = 0;
  private priceHistory: PriceHistoryPoint[] = [];
  private dataQualityMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    lastQualityScore: 1.0,
  };

  /**
   * 获取实时金价数据
   */
  async fetchRealTimeData(): Promise<GoldPriceData | null> {
    const startTime = Date.now();
    
    try {
      // 并行获取多个数据源
      const [sgeData, internationalData, exchangeRateData] = await Promise.allSettled([
        this.fetchSGEData(),
        this.fetchInternationalData(),
        this.fetchExchangeRate(),
      ]);

      // 收集成功结果
      const results: Partial<GoldPriceData>[] = [];
      
      if (sgeData.status === 'fulfilled' && sgeData.value) {
        results.push(sgeData.value);
      }
      
      if (internationalData.status === 'fulfilled' && internationalData.value) {
        results.push(internationalData.value);
      }

      // 检查数据质量
      if (results.length < DATA_QUALITY_CONFIG.minDataPoints) {
        console.warn('[DataCollector] Insufficient data sources:', results.length);
        return null;
      }

      // 数据融合与清洗
      const mergedData = this.mergeDataSources(results);
      
      // 异常值检测
      const cleanedData = this.detectAndHandleOutliers(mergedData);
      
      // 数据标准化
      const normalizedData = this.normalizeData(cleanedData);

      // 数据验证
      if (!validateAndLog(normalizedData)) {
        console.warn('[DataCollector] Data validation failed, using fallback');
        // 验证失败时使用历史数据或返回 null
        if (this.priceHistory.length > 0) {
          const lastPrice = this.priceHistory[this.priceHistory.length - 1].price;
          normalizedData.domestic.price = lastPrice;
          normalizedData.international.price = lastPrice * 31.1035 / normalizedData.exchangeRate;
        }
      }

      // 更新历史记录
      this.updatePriceHistory(normalizedData);
      
      // 更新质量指标
      this.updateQualityMetrics(startTime, results.length);

      this.lastUpdateTime = Date.now();
      
      return normalizedData;
    } catch (error) {
      console.error('[DataCollector] Error fetching data:', error);
      this.dataQualityMetrics.failedRequests++;
      return null;
    }
  }

  /**
   * 从上海黄金交易所获取数据
   */
  private async fetchSGEData(): Promise<Partial<GoldPriceData>> {
    try {
      // 使用现有的金价爬取Worker
      const response = await fetch('https://api.ustc.dev/api/gold');
      if (!response.ok) throw new Error(`SGE API error: ${response.status}`);
      
      const data = await response.json();
      
      return {
        timestamp: Date.now(),
        date: new Date().toISOString().split('T')[0],
        domestic: {
          price: data.data?.domestic?.price || 0,
          open: data.data?.domestic?.open || 0,
          high: data.data?.domestic?.high || 0,
          low: data.data?.domestic?.low || 0,
          change: data.data?.domestic?.change || 0,
          changePercent: data.data?.domestic?.changePercent || 0,
        },
        source: 'SGE',
        reliability: DATA_SOURCES.SGE.reliability,
      };
    } catch (error) {
      console.error('[DataCollector] SGE fetch error:', error);
      throw error;
    }
  }

  /**
   * 获取国际金价数据
   */
  private async fetchInternationalData(): Promise<Partial<GoldPriceData>> {
    try {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=gold&vs_currencies=usd&include_24hr_change=true'
      );
      
      if (!response.ok) throw new Error(`CoinGecko API error: ${response.status}`);
      
      const data = await response.json();
      const goldData = data.gold;
      
      return {
        timestamp: Date.now(),
        international: {
          price: goldData?.usd || 0,
          open: 0, // 需要单独获取
          high: 0,
          low: 0,
          change: goldData?.usd_24h_change || 0,
          changePercent: goldData?.usd_24h_change || 0,
        },
        source: 'CoinGecko',
        reliability: DATA_SOURCES.INTERNATIONAL.reliability,
      };
    } catch (error) {
      console.error('[DataCollector] International fetch error:', error);
      throw error;
    }
  }

  /**
   * 获取汇率数据
   */
  private async fetchExchangeRate(): Promise<number> {
    try {
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      if (!response.ok) throw new Error(`Exchange rate API error: ${response.status}`);
      
      const data = await response.json();
      return data.rates?.CNY || 7.2;
    } catch (error) {
      console.error('[DataCollector] Exchange rate fetch error:', error);
      return 7.2; // 使用默认值
    }
  }

  /**
   * 融合多个数据源
   */
  private mergeDataSources(sources: Partial<GoldPriceData>[]): Partial<GoldPriceData> {
    const weights = sources.map(s => s.reliability || 0.5);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    
    const normalizedWeights = weights.map(w => w / totalWeight);
    
    // 加权平均计算
    const merged: Partial<GoldPriceData> = {
      timestamp: Date.now(),
      date: new Date().toISOString().split('T')[0],
      exchangeRate: 7.2,
      domestic: {
        price: 0, open: 0, high: 0, low: 0, change: 0, changePercent: 0,
      },
      international: {
        price: 0, open: 0, high: 0, low: 0, change: 0, changePercent: 0,
      },
      source: 'merged',
      reliability: 0,
    };

    // 计算加权平均值
    sources.forEach((source, index) => {
      const weight = normalizedWeights[index];
      
      if (source.domestic) {
        merged.domestic!.price += (source.domestic.price || 0) * weight;
        merged.domestic!.open += (source.domestic.open || 0) * weight;
        merged.domestic!.high += (source.domestic.high || 0) * weight;
        merged.domestic!.low += (source.domestic.low || 0) * weight;
        merged.domestic!.change += (source.domestic.change || 0) * weight;
        merged.domestic!.changePercent += (source.domestic.changePercent || 0) * weight;
      }
      
      if (source.international) {
        merged.international!.price += (source.international.price || 0) * weight;
        merged.international!.open += (source.international.open || 0) * weight;
        merged.international!.high += (source.international.high || 0) * weight;
        merged.international!.low += (source.international.low || 0) * weight;
        merged.international!.change += (source.international.change || 0) * weight;
        merged.international!.changePercent += (source.international.changePercent || 0) * weight;
      }
      
      if (source.exchangeRate) {
        merged.exchangeRate = (merged.exchangeRate || 0) + source.exchangeRate * weight;
      }
      
      merged.reliability = (merged.reliability || 0) + (source.reliability || 0) * weight;
    });

    return merged;
  }

  /**
   * 异常值检测与处理
   */
  private detectAndHandleOutliers(data: Partial<GoldPriceData>): Partial<GoldPriceData> {
    if (this.priceHistory.length < 10) {
      return data;
    }

    const recentPrices = this.priceHistory.slice(-20).map(p => p.price);
    const mean = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
    const variance = recentPrices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recentPrices.length;
    const stdDev = Math.sqrt(variance);

    const currentPrice = data.domestic?.price || 0;
    const zScore = Math.abs((currentPrice - mean) / stdDev);

    // 如果当前价格是异常值，使用历史均值平滑
    if (zScore > DATA_QUALITY_CONFIG.outlierThreshold) {
      console.warn('[DataCollector] Outlier detected:', { currentPrice, mean, zScore });
      
      const smoothedPrice = mean + (currentPrice - mean) * 0.3; // 30%权重给当前值
      
      return {
        ...data,
        domestic: {
          ...data.domestic!,
          price: smoothedPrice,
        },
        reliability: (data.reliability || 1) * 0.8, // 降低可靠性评分
      };
    }

    return data;
  }

  /**
   * 数据标准化
   */
  private normalizeData(data: Partial<GoldPriceData>): GoldPriceData {
    const now = Date.now();
    const today = new Date().toISOString().split('T')[0];

    return {
      timestamp: now,
      date: today,
      exchangeRate: data.exchangeRate || 7.2,
      domestic: {
        price: Math.round((data.domestic?.price || 0) * 100) / 100,
        open: Math.round((data.domestic?.open || 0) * 100) / 100,
        high: Math.round((data.domestic?.high || 0) * 100) / 100,
        low: Math.round((data.domestic?.low || 0) * 100) / 100,
        change: Math.round((data.domestic?.change || 0) * 100) / 100,
        changePercent: Math.round((data.domestic?.changePercent || 0) * 100) / 100,
      },
      international: {
        price: Math.round((data.international?.price || 0) * 100) / 100,
        open: Math.round((data.international?.open || 0) * 100) / 100,
        high: Math.round((data.international?.high || 0) * 100) / 100,
        low: Math.round((data.international?.low || 0) * 100) / 100,
        change: Math.round((data.international?.change || 0) * 100) / 100,
        changePercent: Math.round((data.international?.changePercent || 0) * 100) / 100,
      },
      source: data.source || 'unknown',
      reliability: data.reliability || 0.5,
    };
  }

  /**
   * 更新价格历史
   */
  private updatePriceHistory(data: GoldPriceData): void {
    this.priceHistory.push({
      timestamp: data.timestamp,
      price: data.domestic.price,
      source: data.source,
    });

    // 保持最近1000个数据点
    if (this.priceHistory.length > 1000) {
      this.priceHistory = this.priceHistory.slice(-1000);
    }
  }

  /**
   * 更新质量指标
   */
  private updateQualityMetrics(startTime: number, successCount: number): void {
    this.dataQualityMetrics.totalRequests++;
    this.dataQualityMetrics.successfulRequests += successCount;
    
    const latency = Date.now() - startTime;
    const successRate = successCount / 3; // 假设3个数据源
    
    // 计算质量分数
    this.dataQualityMetrics.lastQualityScore = 
      successRate * 0.6 + 
      (1 - Math.min(latency / 5000, 1)) * 0.4;
  }

  /**
   * 获取数据质量报告
   */
  getDataQualityReport(): DataQualityReport {
    const now = Date.now();
    const recentHistory = this.priceHistory.filter(
      p => now - p.timestamp < 24 * 60 * 60 * 1000
    );

    // 计算完整性
    const expectedPoints = (24 * 60) / 5; // 每5分钟一个点，24小时
    const completeness = Math.min(recentHistory.length / expectedPoints, 1);

    // 计算准确性 (基于异常值比例)
    const outlierCount = this.detectOutliersInHistory(recentHistory);
    const accuracy = 1 - (outlierCount / Math.max(recentHistory.length, 1));

    // 计算时效性
    const lastUpdate = this.lastUpdateTime;
    const timeliness = lastUpdate > 0 
      ? Math.max(0, 1 - (now - lastUpdate) / DATA_QUALITY_CONFIG.maxAgeMs)
      : 0;

    // 计算一致性
    const consistency = this.dataQualityMetrics.lastQualityScore;

    return {
      timestamp: now,
      period: '24h',
      completeness,
      accuracy,
      timeliness,
      consistency,
      issues: this.generateQualityIssues(completeness, accuracy, timeliness),
    };
  }

  /**
   * 检测历史数据中的异常值
   */
  private detectOutliersInHistory(history: PriceHistoryPoint[]): number {
    if (history.length < 10) return 0;
    
    const prices = history.map(p => p.price);
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);

    return prices.filter(p => Math.abs(p - mean) > DATA_QUALITY_CONFIG.outlierThreshold * stdDev).length;
  }

  /**
   * 生成质量问题列表
   */
  private generateQualityIssues(
    completeness: number, 
    accuracy: number, 
    timeliness: number
  ): DataQualityReport['issues'] {
    const issues: DataQualityReport['issues'] = [];

    if (completeness < 0.9) {
      issues.push({
        type: 'incomplete_data',
        severity: 'medium',
        description: `数据完整性不足: ${(completeness * 100).toFixed(1)}%`,
        count: 1,
      });
    }

    if (accuracy < 0.95) {
      issues.push({
        type: 'low_accuracy',
        severity: 'high',
        description: `数据准确性下降: ${(accuracy * 100).toFixed(1)}%`,
        count: 1,
      });
    }

    if (timeliness < 0.8) {
      issues.push({
        type: 'stale_data',
        severity: 'high',
        description: '数据更新延迟',
        count: 1,
      });
    }

    return issues;
  }

  /**
   * 获取价格历史
   */
  getPriceHistory(duration: number = 24 * 60 * 60 * 1000): PriceHistoryPoint[] {
    const cutoff = Date.now() - duration;
    return this.priceHistory.filter(p => p.timestamp >= cutoff);
  }

  /**
   * 获取最后更新时间
   */
  getLastUpdateTime(): number {
    return this.lastUpdateTime;
  }
}

// 导出单例实例
export const goldDataCollector = new GoldDataCollector();
