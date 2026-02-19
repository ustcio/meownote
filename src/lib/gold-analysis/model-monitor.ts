// ================================================================================
// AI 模型性能监控模块
// 创建日期：2026-02-19
// 目的：持续跟踪 AI 模型准确率、延迟、成本等指标，优化模型配置
// ================================================================================

import type { AIPredictionResult, TradingSignal } from './types';

// 监控配置
const MONITOR_CONFIG = {
  maxHistorySize: 1000,         // 最大历史记录数
  accuracyWindow: 100,          // 准确率计算窗口（最近 100 次预测）
  latencyWindow: 50,            // 延迟计算窗口（最近 50 次调用）
  costUpdateInterval: 3600000,  // 成本更新间隔（1 小时）
  alertThresholds: {
    minAccuracy: 0.60,          // 最低准确率阈值
    maxLatency: 5000,           // 最大延迟阈值 (ms)
    maxDailyCost: 50,           // 每日最大成本 (元)
  },
};

// 模型性能指标
export interface ModelPerformanceMetrics {
  modelName: string;
  totalPredictions: number;
  accuratePredictions: number;
  accuracy: number;             // 准确率
  avgLatency: number;           // 平均延迟 (ms)
  latencyP50: number;           // P50 延迟
  latencyP95: number;           // P95 延迟
  latencyP99: number;           // P99 延迟
  costToday: number;            // 今日成本 (元)
  costThisMonth: number;        // 本月成本 (元)
  totalCost: number;            // 总成本 (元)
  successRate: number;          // 成功率
  lastPredictionTime: number | null;
  lastUpdated: number;
  trend: {
    accuracy7d: number[];       // 7 天准确率趋势
    latency7d: number[];        // 7 天延迟趋势
  };
}

// 预测记录
interface PredictionRecord {
  signalId: string;
  modelName: string;
  timestamp: number;
  predictedPrice: number;
  actualPrice?: number;
  accuracy?: number;
  latency: number;
  success: boolean;
  cost: number;
}

// 模型权重建议
export interface ModelWeightSuggestion {
  modelName: string;
  currentWeight: number;
  suggestedWeight: number;
  reason: string;
  confidence: number;
}

/**
 * 模型性能监控器
 */
export class ModelPerformanceMonitor {
  private predictionHistory: PredictionRecord[] = [];
  private modelMetrics = new Map<string, ModelPerformanceMetrics>();
  private costCache = new Map<string, { amount: number; timestamp: number }>();
  private lastCostUpdate = 0;

  /**
   * 记录预测结果
   */
  recordPrediction(
    signal: TradingSignal,
    modelName: string,
    latency: number,
    cost: number
  ): void {
    const record: PredictionRecord = {
      signalId: signal.id,
      modelName,
      timestamp: Date.now(),
      predictedPrice: signal.currentPrice,
      latency,
      success: signal.confidence > 0.65, // 高置信度视为成功
      cost,
    };

    this.predictionHistory.push(record);
    
    // 限制历史记录大小
    if (this.predictionHistory.length > MONITOR_CONFIG.maxHistorySize) {
      this.predictionHistory.shift();
    }

    // 更新模型指标
    this.updateModelMetrics(modelName);
  }

  /**
   * 更新预测准确率（当实际价格已知时）
   */
  updatePredictionAccuracy(
    signalId: string,
    actualPrice: number
  ): void {
    const record = this.predictionHistory.find(r => r.signalId === signalId);
    if (!record) return;

    // 计算准确率（1 - 相对误差）
    const relativeError = Math.abs(actualPrice - record.predictedPrice) / record.predictedPrice;
    record.accuracy = 1 - relativeError;
    record.actualPrice = actualPrice;

    // 准确率 > 90% 视为准确预测
    record.success = record.accuracy > 0.90;

    // 更新模型指标
    this.updateModelMetrics(record.modelName);
  }

  /**
   * 获取模型性能指标
   */
  getModelMetrics(modelName: string): ModelPerformanceMetrics | null {
    return this.modelMetrics.get(modelName) || null;
  }

  /**
   * 获取所有模型性能对比
   */
  getAllModelMetrics(): ModelPerformanceMetrics[] {
    return Array.from(this.modelMetrics.values());
  }

  /**
   * 获取模型权重建议
   */
  getWeightSuggestions(
    currentWeights: Record<string, number>
  ): ModelWeightSuggestion[] {
    const suggestions: ModelWeightSuggestion[] = [];

    for (const [modelName, metrics] of this.modelMetrics.entries()) {
      const currentWeight = currentWeights[modelName] || 0;
      
      // 基于准确率和成功率计算建议权重
      const performanceScore = (
        metrics.accuracy * 0.6 +      // 准确率权重 60%
        metrics.successRate * 0.3 +   // 成功率权重 30%
        (1 - Math.min(metrics.avgLatency / 5000, 1)) * 0.1  // 延迟权重 10%
      );

      // 计算建议权重
      let suggestedWeight = performanceScore;
      
      // 应用惩罚
      if (metrics.accuracy < MONITOR_CONFIG.alertThresholds.minAccuracy) {
        suggestedWeight *= 0.5; // 准确率低，减半权重
      }
      if (metrics.avgLatency > MONITOR_CONFIG.alertThresholds.maxLatency) {
        suggestedWeight *= 0.8; // 延迟高，减少 20%
      }

      // 归一化
      const totalWeight = Array.from(this.modelMetrics.values())
        .reduce((sum, m) => {
          const score = (m.accuracy * 0.6 + m.successRate * 0.3) * 
            (m.avgLatency > 5000 ? 0.8 : 1);
          return sum + score;
        }, 0);
      
      suggestedWeight = (suggestedWeight / totalWeight) * 1.0; // 总和为 1

      // 生成建议
      if (Math.abs(suggestedWeight - currentWeight) > 0.05) {
        suggestions.push({
          modelName,
          currentWeight,
          suggestedWeight: Math.round(suggestedWeight * 100) / 100,
          reason: this.generateWeightReason(modelName, metrics, suggestedWeight),
          confidence: 0.8,
        });
      }
    }

    return suggestions;
  }

  /**
   * 检查性能告警
   */
  checkAlerts(): Array<{ modelName: string; type: string; message: string }> {
    const alerts: Array<{ modelName: string; type: string; message: string }> = [];

    for (const [modelName, metrics] of this.modelMetrics.entries()) {
      // 准确率告警
      if (metrics.accuracy < MONITOR_CONFIG.alertThresholds.minAccuracy) {
        alerts.push({
          modelName,
          type: 'LOW_ACCURACY',
          message: `模型准确率过低：${(metrics.accuracy * 100).toFixed(2)}% < ${(MONITOR_CONFIG.alertThresholds.minAccuracy * 100).toFixed(2)}%`,
        });
      }

      // 延迟告警
      if (metrics.avgLatency > MONITOR_CONFIG.alertThresholds.maxLatency) {
        alerts.push({
          modelName,
          type: 'HIGH_LATENCY',
          message: `模型延迟过高：${metrics.avgLatency.toFixed(0)}ms > ${MONITOR_CONFIG.alertThresholds.maxLatency}ms`,
        });
      }

      // 成本告警
      if (metrics.costToday > MONITOR_CONFIG.alertThresholds.maxDailyCost) {
        alerts.push({
          modelName,
          type: 'HIGH_COST',
          message: `模型今日成本过高：¥${metrics.costToday.toFixed(2)} > ¥${MONITOR_CONFIG.alertThresholds.maxDailyCost}`,
        });
      }
    }

    return alerts;
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport(): {
    summary: {
      totalModels: number;
      avgAccuracy: number;
      avgLatency: number;
      totalCostToday: number;
    };
    models: ModelPerformanceMetrics[];
    alerts: Array<{ modelName: string; type: string; message: string }>;
    suggestions: ModelWeightSuggestion[];
  } {
    const models = this.getAllModelMetrics();
    
    return {
      summary: {
        totalModels: models.length,
        avgAccuracy: models.reduce((sum, m) => sum + m.accuracy, 0) / models.length,
        avgLatency: models.reduce((sum, m) => sum + m.avgLatency, 0) / models.length,
        totalCostToday: models.reduce((sum, m) => sum + m.costToday, 0),
      },
      models,
      alerts: this.checkAlerts(),
      suggestions: this.getWeightSuggestions({}),
    };
  }

  /**
   * 记录 API 调用成本
   */
  recordCost(modelName: string, cost: number): void {
    const now = Date.now();
    
    // 更新缓存
    const cached = this.costCache.get(modelName);
    if (cached && now - cached.timestamp < MONITOR_CONFIG.costUpdateInterval) {
      cached.amount += cost;
      cached.timestamp = now;
    } else {
      this.costCache.set(modelName, { amount: cost, timestamp: now });
    }

    // 更新指标
    const metrics = this.modelMetrics.get(modelName);
    if (metrics) {
      metrics.costToday += cost;
      metrics.totalCost += cost;
      metrics.lastUpdated = now;
    }
  }

  /**
   * 清除旧数据
   */
  cleanupOldData(maxAgeHours: number = 24): void {
    const cutoffTime = Date.now() - maxAgeHours * 3600000;
    this.predictionHistory = this.predictionHistory.filter(
      r => r.timestamp > cutoffTime
    );
  }

  /**
   * 更新模型指标
   */
  private updateModelMetrics(modelName: string): void {
    const now = Date.now();
    const modelRecords = this.predictionHistory.filter(r => r.modelName === modelName);
    
    // 获取窗口内的记录
    const accuracyRecords = modelRecords
      .filter(r => r.accuracy !== undefined)
      .slice(-MONITOR_CONFIG.accuracyWindow);
    
    const latencyRecords = modelRecords
      .slice(-MONITOR_CONFIG.latencyWindow);

    // 计算准确率
    const accuracy = accuracyRecords.length > 0
      ? accuracyRecords.reduce((sum, r) => sum + (r.accuracy || 0), 0) / accuracyRecords.length
      : 0;

    // 计算成功率
    const successRate = modelRecords.length > 0
      ? modelRecords.filter(r => r.success).length / modelRecords.length
      : 0;

    // 计算延迟统计
    const latencies = latencyRecords.map(r => r.latency).sort((a, b) => a - b);
    const avgLatency = latencies.length > 0
      ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
      : 0;

    // 获取或创建指标
    let metrics = this.modelMetrics.get(modelName);
    if (!metrics) {
      metrics = {
        modelName,
        totalPredictions: 0,
        accuratePredictions: 0,
        accuracy: 0,
        avgLatency: 0,
        latencyP50: 0,
        latencyP95: 0,
        latencyP99: 0,
        costToday: 0,
        costThisMonth: 0,
        totalCost: 0,
        successRate: 0,
        lastPredictionTime: null,
        lastUpdated: now,
        trend: {
          accuracy7d: [],
          latency7d: [],
        },
      };
      this.modelMetrics.set(modelName, metrics);
    }

    // 更新指标
    metrics.totalPredictions = modelRecords.length;
    metrics.accuratePredictions = accuracyRecords.filter(r => (r.accuracy || 0) > 0.9).length;
    metrics.accuracy = accuracy;
    metrics.avgLatency = avgLatency;
    metrics.successRate = successRate;
    metrics.lastPredictionTime = modelRecords.length > 0 
      ? modelRecords[modelRecords.length - 1].timestamp 
      : null;
    metrics.lastUpdated = now;

    // 计算延迟百分位数
    if (latencies.length > 0) {
      metrics.latencyP50 = latencies[Math.floor(latencies.length * 0.5)];
      metrics.latencyP95 = latencies[Math.floor(latencies.length * 0.95)];
      metrics.latencyP99 = latencies[Math.floor(latencies.length * 0.99)];
    }

    // 更新趋势数据
    this.updateTrend(metrics);
  }

  /**
   * 更新趋势数据
   */
  private updateTrend(metrics: ModelPerformanceMetrics): void {
    const now = Date.now();
    const dayMs = 24 * 3600000;
    
    // 获取每天的准确率
    const accuracyByDay = new Map<number, number[]>();
    const latencyByDay = new Map<number, number[]>();

    for (const record of this.predictionHistory) {
      if (record.modelName !== metrics.modelName) continue;

      const day = Math.floor(record.timestamp / dayMs) * dayMs;
      
      if (record.accuracy !== undefined) {
        if (!accuracyByDay.has(day)) {
          accuracyByDay.set(day, []);
        }
        accuracyByDay.get(day)!.push(record.accuracy);
      }

      latencyByDay.set(day, [record.latency]);
    }

    // 计算最近 7 天的平均值
    metrics.trend.accuracy7d = [];
    metrics.trend.latency7d = [];

    for (let i = 6; i >= 0; i--) {
      const day = now - i * dayMs;
      const dayAccuracies = accuracyByDay.get(day) || [];
      const dayLatencies = latencyByDay.get(day) || [];

      metrics.trend.accuracy7d.push(
        dayAccuracies.length > 0
          ? dayAccuracies.reduce((sum, a) => sum + a, 0) / dayAccuracies.length
          : metrics.accuracy
      );

      metrics.trend.latency7d.push(
        dayLatencies.length > 0
          ? dayLatencies.reduce((sum, l) => sum + l, 0) / dayLatencies.length
          : metrics.avgLatency
      );
    }
  }

  /**
   * 生成权重调整原因
   */
  private generateWeightReason(
    modelName: string,
    metrics: ModelPerformanceMetrics,
    suggestedWeight: number
  ): string {
    const reasons: string[] = [];

    if (metrics.accuracy > 0.75) {
      reasons.push(`高准确率 ${(metrics.accuracy * 100).toFixed(1)}%`);
    } else if (metrics.accuracy < 0.65) {
      reasons.push(`低准确率 ${(metrics.accuracy * 100).toFixed(1)}%`);
    }

    if (metrics.avgLatency < 2000) {
      reasons.push(`低延迟 ${metrics.avgLatency.toFixed(0)}ms`);
    } else if (metrics.avgLatency > 4000) {
      reasons.push(`高延迟 ${metrics.avgLatency.toFixed(0)}ms`);
    }

    if (metrics.successRate > 0.8) {
      reasons.push(`高成功率 ${(metrics.successRate * 100).toFixed(1)}%`);
    }

    return reasons.length > 0 ? reasons.join(', ') : '基于综合性能评估';
  }
}

// 导出单例实例
export const modelMonitor = new ModelPerformanceMonitor();

// 默认导出
export default {
  ModelPerformanceMonitor,
  modelMonitor,
  MONITOR_CONFIG,
};
