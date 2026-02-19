// ================================================================================
// 交易预警系统 - 动态阈值与实时通知
// ================================================================================

import type {
  GoldPriceData,
  AlertConfiguration,
  AlertEvent,
  TradingSignal,
  MarketTrendAnalysis,
} from './types';

// 预警系统配置
const ALERT_CONFIG = {
  checkIntervalMs: 30 * 1000, // 30秒检查一次
  cooldownMs: 5 * 60 * 1000, // 5分钟冷却期
  maxAlertsPerHour: 10, // 每小时最大预警数
  volatilityThreshold: 2.0, // 波动率阈值 (%)
  trendChangeThreshold: 0.5, // 趋势变化阈值 (%)
};

// 动态阈值计算配置
const DYNAMIC_THRESHOLD_CONFIG = {
  baseBuyTolerance: 2.0,
  baseSellTolerance: 2.0,
  volatilityMultiplier: 0.5, // 波动率乘数
  trendAdjustment: 0.3, // 趋势调整系数
  minTolerance: 0.5,
  maxTolerance: 10.0,
};

/**
 * 预警系统类
 */
export class AlertSystem {
  private configurations: Map<string, AlertConfiguration> = new Map();
  private alertHistory: AlertEvent[] = [];
  private lastAlertTime: Map<string, number> = new Map();
  private priceHistory: Array<{ price: number; timestamp: number }> = [];
  private currentVolatility: number = 0;
  private currentTrend: MarketTrendAnalysis['trend'] = 'unknown';

  /**
   * 创建预警配置
   */
  createConfiguration(config: Omit<AlertConfiguration, 'id' | 'createdAt' | 'updatedAt'>): AlertConfiguration {
    const now = Date.now();
    const newConfig: AlertConfiguration = {
      ...config,
      id: `alert_${now}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: now,
      updatedAt: now,
    };

    this.configurations.set(newConfig.id, newConfig);
    return newConfig;
  }

  /**
   * 更新预警配置
   */
  updateConfiguration(id: string, updates: Partial<AlertConfiguration>): AlertConfiguration | null {
    const config = this.configurations.get(id);
    if (!config) return null;

    const updated = {
      ...config,
      ...updates,
      updatedAt: Date.now(),
    };

    this.configurations.set(id, updated);
    return updated;
  }

  /**
   * 删除预警配置
   */
  deleteConfiguration(id: string): boolean {
    return this.configurations.delete(id);
  }

  /**
   * 获取预警配置
   */
  getConfiguration(id: string): AlertConfiguration | undefined {
    return this.configurations.get(id);
  }

  /**
   * 获取所有预警配置
   */
  getAllConfigurations(): AlertConfiguration[] {
    return Array.from(this.configurations.values());
  }

  /**
   * 计算动态阈值
   */
  calculateDynamicThreshold(
    basePrice: number,
    alertType: 'buy' | 'sell',
    marketVolatility: number,
    trend: MarketTrendAnalysis['trend']
  ): { min: number; max: number } {
    const baseTolerance = alertType === 'buy'
      ? DYNAMIC_THRESHOLD_CONFIG.baseBuyTolerance
      : DYNAMIC_THRESHOLD_CONFIG.baseSellTolerance;

    // 基于波动率调整
    const volatilityAdjustment = marketVolatility * DYNAMIC_THRESHOLD_CONFIG.volatilityMultiplier;

    // 基于趋势调整
    let trendAdjustment = 0;
    if (trend.includes('up') && alertType === 'buy') {
      trendAdjustment = -DYNAMIC_THRESHOLD_CONFIG.trendAdjustment;
    } else if (trend.includes('down') && alertType === 'sell') {
      trendAdjustment = -DYNAMIC_THRESHOLD_CONFIG.trendAdjustment;
    }

    // 计算最终阈值
    const adjustedTolerance = Math.max(
      DYNAMIC_THRESHOLD_CONFIG.minTolerance,
      Math.min(
        DYNAMIC_THRESHOLD_CONFIG.maxTolerance,
        baseTolerance + volatilityAdjustment + trendAdjustment
      )
    );

    return {
      min: basePrice - adjustedTolerance,
      max: basePrice + adjustedTolerance,
    };
  }

  /**
   * 检查价格预警
   */
  checkPriceAlerts(
    currentData: GoldPriceData,
    marketAnalysis: MarketTrendAnalysis
  ): AlertEvent[] {
    const triggeredAlerts: AlertEvent[] = [];
    const currentPrice = currentData.domestic.price;

    // 更新历史数据
    this.updatePriceHistory(currentPrice);

    // 更新波动率和趋势
    this.currentVolatility = marketAnalysis.volatility;
    this.currentTrend = marketAnalysis.trend;

    for (const config of this.configurations.values()) {
      if (!config.isActive) continue;

      // 检查冷却期
      const lastAlert = this.lastAlertTime.get(config.id);
      if (lastAlert && Date.now() - lastAlert < ALERT_CONFIG.cooldownMs) {
        continue;
      }

      // 检查频率限制
      if (this.isRateLimited(config.userId)) {
        continue;
      }

      // 根据预警类型检查
      switch (config.alertType) {
        case 'price_target':
          const priceAlert = this.checkPriceTarget(config, currentPrice, marketAnalysis);
          if (priceAlert) triggeredAlerts.push(priceAlert);
          break;

        case 'trend_change':
          const trendAlert = this.checkTrendChange(config, marketAnalysis);
          if (trendAlert) triggeredAlerts.push(trendAlert);
          break;

        case 'volatility_spike':
          const volatilityAlert = this.checkVolatilitySpike(config, marketAnalysis);
          if (volatilityAlert) triggeredAlerts.push(volatilityAlert);
          break;
      }
    }

    // 记录触发的预警
    triggeredAlerts.forEach(alert => {
      this.alertHistory.push(alert);
      this.lastAlertTime.set(alert.alertId, Date.now());
    });

    return triggeredAlerts;
  }

  /**
   * 检查交易信号预警
   */
  checkSignalAlerts(signal: TradingSignal): AlertEvent | null {
    // 查找匹配的信号预警配置
    const signalConfigs = Array.from(this.configurations.values()).filter(
      config => config.alertType === 'signal_generated' && config.isActive
    );

    for (const config of signalConfigs) {
      // 检查置信度阈值
      if (config.conditions.confidenceThreshold &&
          signal.confidence < config.conditions.confidenceThreshold) {
        continue;
      }

      // 检查冷却期
      const lastAlert = this.lastAlertTime.get(config.id);
      if (lastAlert && Date.now() - lastAlert < ALERT_CONFIG.cooldownMs) {
        continue;
      }

      const alert: AlertEvent = {
        id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        alertId: config.id,
        type: 'signal_generated',
        timestamp: Date.now(),
        triggeredPrice: signal.currentPrice,
        message: this.generateSignalAlertMessage(signal),
        severity: signal.confidence > 0.8 ? 'critical' : signal.confidence > 0.6 ? 'warning' : 'info',
        status: 'pending',
        metadata: {
          signalId: signal.id,
          signalType: signal.type,
          confidence: signal.confidence,
          reasoning: signal.reasoning,
        },
      };

      this.alertHistory.push(alert);
      this.lastAlertTime.set(config.id, Date.now());

      return alert;
    }

    return null;
  }

  /**
   * 检查价格目标
   */
  private checkPriceTarget(
    config: AlertConfiguration,
    currentPrice: number,
    marketAnalysis: MarketTrendAnalysis
  ): AlertEvent | null {
    if (!config.conditions.targetPrice) return null;

    const targetPrice = config.conditions.targetPrice;

    // 计算动态阈值
    const threshold = this.calculateDynamicThreshold(
      targetPrice,
      config.alertType === 'price_target' ? 'buy' : 'sell',
      marketAnalysis.volatility,
      marketAnalysis.trend
    );

    // 检查是否触发
    const isTriggered = currentPrice >= threshold.min && currentPrice <= threshold.max;

    if (!isTriggered) return null;

    return {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      alertId: config.id,
      type: 'price_target',
      timestamp: Date.now(),
      triggeredPrice: currentPrice,
      message: `价格已进入目标区间 ¥${threshold.min.toFixed(2)} - ¥${threshold.max.toFixed(2)}`,
      severity: 'warning',
      status: 'pending',
      metadata: {
        targetPrice,
        threshold,
        volatility: marketAnalysis.volatility,
      },
    };
  }

  /**
   * 检查趋势变化
   */
  private checkTrendChange(
    config: AlertConfiguration,
    marketAnalysis: MarketTrendAnalysis
  ): AlertEvent | null {
    if (!config.conditions.trendDirection) return null;

    const expectedDirection = config.conditions.trendDirection;
    const currentTrend = marketAnalysis.trend;

    // 检查趋势是否匹配
    const isMatch = expectedDirection === 'up'
      ? currentTrend.includes('up')
      : currentTrend.includes('down');

    if (!isMatch) return null;

    // 检查趋势强度
    if (marketAnalysis.strength < ALERT_CONFIG.trendChangeThreshold) {
      return null;
    }

    return {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      alertId: config.id,
      type: 'trend_change',
      timestamp: Date.now(),
      triggeredPrice: marketAnalysis.currentPrice,
      message: `检测到${expectedDirection === 'up' ? '上涨' : '下跌'}趋势，强度: ${marketAnalysis.strength.toFixed(2)}`,
      severity: 'info',
      status: 'pending',
      metadata: {
        trend: currentTrend,
        strength: marketAnalysis.strength,
        expectedDirection,
      },
    };
  }

  /**
   * 检查波动率激增
   */
  private checkVolatilitySpike(
    config: AlertConfiguration,
    marketAnalysis: MarketTrendAnalysis
  ): AlertEvent | null {
    const threshold = config.conditions.volatilityThreshold || ALERT_CONFIG.volatilityThreshold;

    if (marketAnalysis.volatility < threshold) return null;

    return {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      alertId: config.id,
      type: 'volatility_spike',
      timestamp: Date.now(),
      triggeredPrice: marketAnalysis.currentPrice,
      message: `波动率激增: ${marketAnalysis.volatility.toFixed(2)}%，超过阈值 ${threshold}%`,
      severity: marketAnalysis.volatility > threshold * 2 ? 'critical' : 'warning',
      status: 'pending',
      metadata: {
        volatility: marketAnalysis.volatility,
        threshold,
        high: marketAnalysis.high,
        low: marketAnalysis.low,
      },
    };
  }

  /**
   * 更新价格历史
   */
  private updatePriceHistory(price: number): void {
    this.priceHistory.push({
      price,
      timestamp: Date.now(),
    });

    // 保持最近100个数据点
    if (this.priceHistory.length > 100) {
      this.priceHistory = this.priceHistory.slice(-100);
    }
  }

  /**
   * 检查频率限制
   */
  private isRateLimited(userId: string): boolean {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recentAlerts = this.alertHistory.filter(
      alert => alert.timestamp > oneHourAgo && this.configurations.get(alert.alertId)?.userId === userId
    );

    return recentAlerts.length >= ALERT_CONFIG.maxAlertsPerHour;
  }

  /**
   * 生成信号预警消息
   */
  private generateSignalAlertMessage(signal: TradingSignal): string {
    const typeMap = { BUY: '买入', SELL: '卖出', HOLD: '持有' };
    return `AI生成${typeMap[signal.type]}信号，置信度${(signal.confidence * 100).toFixed(1)}%，建议仓位${(signal.suggestedPosition * 100).toFixed(0)}%`;
  }

  /**
   * 获取预警历史
   */
  getAlertHistory(
    userId?: string,
    limit: number = 100,
    status?: AlertEvent['status']
  ): AlertEvent[] {
    let filtered = this.alertHistory;

    if (userId) {
      filtered = filtered.filter(alert =>
        this.configurations.get(alert.alertId)?.userId === userId
      );
    }

    if (status) {
      filtered = filtered.filter(alert => alert.status === status);
    }

    return filtered.slice(-limit);
  }

  /**
   * 更新预警状态
   */
  updateAlertStatus(alertId: string, status: AlertEvent['status']): boolean {
    const alert = this.alertHistory.find(a => a.id === alertId);
    if (alert) {
      alert.status = status;
      return true;
    }
    return false;
  }

  /**
   * 获取统计信息
   */
  getStatistics(userId?: string): {
    totalAlerts: number;
    pendingAlerts: number;
    sentAlerts: number;
    acknowledgedAlerts: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  } {
    let alerts = this.alertHistory;

    if (userId) {
      alerts = alerts.filter(alert =>
        this.configurations.get(alert.alertId)?.userId === userId
      );
    }

    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    alerts.forEach(alert => {
      byType[alert.type] = (byType[alert.type] || 0) + 1;
      bySeverity[alert.severity] = (bySeverity[alert.severity] || 0) + 1;
    });

    return {
      totalAlerts: alerts.length,
      pendingAlerts: alerts.filter(a => a.status === 'pending').length,
      sentAlerts: alerts.filter(a => a.status === 'sent').length,
      acknowledgedAlerts: alerts.filter(a => a.status === 'acknowledged').length,
      byType,
      bySeverity,
    };
  }

  /**
   * 清理过期预警
   */
  cleanupExpiredAlerts(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - maxAgeMs;
    const initialLength = this.alertHistory.length;

    this.alertHistory = this.alertHistory.filter(alert => alert.timestamp > cutoff);

    return initialLength - this.alertHistory.length;
  }

  /**
   * 获取当前市场状态
   */
  getMarketStatus(): {
    volatility: number;
    trend: MarketTrendAnalysis['trend'];
    priceChange24h: number;
  } {
    const prices = this.priceHistory.map(p => p.price);
    const priceChange24h = prices.length > 1
      ? ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100
      : 0;

    return {
      volatility: this.currentVolatility,
      trend: this.currentTrend,
      priceChange24h,
    };
  }
}

// 导出单例实例
export const alertSystem = new AlertSystem();
