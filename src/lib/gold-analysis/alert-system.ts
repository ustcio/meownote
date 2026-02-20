// ================================================================================
// SGE Level 3 预警系统 - 专业级实时预警引擎
// ================================================================================

import type {
  GoldPriceData,
  AlertConfiguration,
  AlertEvent,
  TradingSignal,
  MarketTrendAnalysis,
  SGEAlertConfig,
  SGESession,
  EMAState,
  ATRState,
  AlertSignal,
  SignalFusionResult,
  Level3AlertEvent,
  PriceCrossEvent,
  AlertStateCache,
} from './types';

// ================================================================================
// SGE Level 3 生产配置
// ================================================================================
export const SGE_CONFIG: SGEAlertConfig = {
  WINDOW_SIZE: 5,
  SHORT_TERM_POINTS: 12,
  VOL_WINDOW: 20,
  BASE_THRESHOLD_YUAN: 2.0,
  MIN_THRESHOLD_YUAN: 1.2,
  INSTANT_ABS_THRESHOLD: 1.8,
  INSTANT_PERCENT_THRESHOLD: 0.25,
  INSTANT_CONFIRM_TICKS: 2,
  ATR_PERIOD: 14,
  ATR_MULTIPLIER: 1.8,
  ZSCORE_THRESHOLD: 2.8,
  EMA_FAST: 3,
  EMA_SLOW: 8,
  BASE_COOLDOWN_SECONDS: 120,
  MAX_COOLDOWN_SECONDS: 600,
  DEDUP_WINDOW_SECONDS: 180,
};

// ================================================================================
// 工具函数
// ================================================================================

function ema(prev: number, price: number, period: number): number {
  const k = 2 / (period + 1);
  return price * k + prev * (1 - k);
}

function std(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getBeijingHour(timestamp: number): number {
  const date = new Date(timestamp);
  return (date.getUTCHours() + 8) % 24;
}

function getSessionMultiplier(beijingHour: number): number {
  if (beijingHour >= 20 || beijingHour <= 2) return 1.25;
  if (beijingHour >= 13 && beijingHour <= 15) return 1.1;
  return 1.0;
}

function getSession(beijingHour: number): SGESession {
  if (beijingHour >= 20 || beijingHour <= 2) return 'night';
  if (beijingHour >= 13 && beijingHour <= 15) return 'afternoon';
  return 'asian_morning';
}

// ================================================================================
// Level 3 预警系统类
// ================================================================================
export class AlertSystem {
  private configurations: Map<string, AlertConfiguration> = new Map();
  private alertHistory: Level3AlertEvent[] = [];
  private lastAlertTime: Map<string, number> = new Map();
  private stateCache: Map<string, AlertStateCache> = new Map();
  private prevPrices: Map<string, number> = new Map();

  constructor() {
    this.initializeStateCache('global');
  }

  private initializeStateCache(key: string): void {
    this.stateCache.set(key, {
      priceHistory: [],
      timestamps: [],
      emaState: { fast: 0, slow: 0, lastPrice: 0 },
      atrState: { values: [], trValues: [] },
      instantConfirmCount: 0,
      lastAlertTime: 0,
      lastAlertDirection: 'neutral',
      rollingMean: 0,
      rollingStd: 0,
    });
  }

  // ================================================================================
  // Step 1: EMA 价格平滑
  // ================================================================================
  private updateEMA(state: AlertStateCache, price: number): EMAState {
    if (state.emaState.lastPrice === 0) {
      return {
        fast: price,
        slow: price,
        lastPrice: price,
      };
    }

    return {
      fast: ema(state.emaState.fast, price, SGE_CONFIG.EMA_FAST),
      slow: ema(state.emaState.slow, price, SGE_CONFIG.EMA_SLOW),
      lastPrice: price,
    };
  }

  // ================================================================================
  // Step 2: 波动率自适应阈值
  // ================================================================================
  private calculateDynamicThreshold(state: AlertStateCache): number {
    const rollingStd = state.rollingStd || 0;
    const dynamicThreshold = Math.max(
      SGE_CONFIG.MIN_THRESHOLD_YUAN,
      SGE_CONFIG.BASE_THRESHOLD_YUAN + 2.2 * rollingStd
    );
    return dynamicThreshold;
  }

  // ================================================================================
  // Step 3: ATR 计算
  // ================================================================================
  private calculateATR(state: AlertStateCache, high: number, low: number, close: number): number {
    const tr = Math.max(
      high - low,
      Math.abs(high - close),
      Math.abs(low - close)
    );

    const trValues = [...state.atrState.trValues, tr].slice(-SGE_CONFIG.ATR_PERIOD);
    
    if (trValues.length < SGE_CONFIG.ATR_PERIOD) {
      return mean(trValues);
    }

    return mean(trValues);
  }

  // ================================================================================
  // Step 4: Z-score 计算
  // ================================================================================
  private calculateZScore(price: number, state: AlertStateCache): number {
    if (state.rollingStd === 0) return 0;
    return (price - state.rollingMean) / state.rollingStd;
  }

  // ================================================================================
  // Step 5: 即时变化检测（带确认）
  // ================================================================================
  private checkInstantMove(
    price: number,
    prevPrice: number,
    state: AlertStateCache
  ): { triggered: boolean; confirmCount: number } {
    const absChange = Math.abs(price - prevPrice);
    const pctChange = prevPrice > 0 ? (absChange / prevPrice) * 100 : 0;

    const isInstantMove = 
      absChange >= SGE_CONFIG.INSTANT_ABS_THRESHOLD ||
      pctChange >= SGE_CONFIG.INSTANT_PERCENT_THRESHOLD;

    const newConfirmCount = isInstantMove 
      ? state.instantConfirmCount + 1 
      : 0;

    return {
      triggered: newConfirmCount >= SGE_CONFIG.INSTANT_CONFIRM_TICKS,
      confirmCount: newConfirmCount,
    };
  }

  // ================================================================================
  // Step 6: EMA 斜率确认
  // ================================================================================
  private checkEMASlope(state: AlertStateCache): { direction: 'up' | 'down' | 'neutral'; confirmed: boolean } {
    const { fast, slow } = state.emaState;
    const diff = fast - slow;
    const threshold = state.rollingStd * 0.5;

    if (diff > threshold) return { direction: 'up', confirmed: true };
    if (diff < -threshold) return { direction: 'down', confirmed: true };
    return { direction: 'neutral', confirmed: false };
  }

  // ================================================================================
  // Step 7: 信号融合评分
  // ================================================================================
  private fuseSignals(
    price: number,
    prevPrice: number,
    state: AlertStateCache,
    atr: number
  ): SignalFusionResult {
    const signals: AlertSignal[] = [];
    let score = 0;
    const timestamp = Date.now();

    const instantResult = this.checkInstantMove(price, prevPrice, state);
    signals.push({
      type: 'instant_move',
      triggered: instantResult.triggered,
      strength: instantResult.triggered ? 1 : 0,
      direction: price > prevPrice ? 'up' : price < prevPrice ? 'down' : 'neutral',
      timestamp,
    });
    if (instantResult.triggered) score += 1;

    const atrSignal = Math.abs(price - prevPrice) >= SGE_CONFIG.ATR_MULTIPLIER * atr;
    signals.push({
      type: 'atr_breakout',
      triggered: atrSignal,
      strength: atrSignal ? 2 : 0,
      direction: price > prevPrice ? 'up' : 'down',
      value: Math.abs(price - prevPrice),
      threshold: SGE_CONFIG.ATR_MULTIPLIER * atr,
      timestamp,
    });
    if (atrSignal) score += 2;

    const zscore = this.calculateZScore(price, state);
    const zSignal = Math.abs(zscore) >= SGE_CONFIG.ZSCORE_THRESHOLD;
    signals.push({
      type: 'zscore_anomaly',
      triggered: zSignal,
      strength: zSignal ? 2 : 0,
      direction: zscore > 0 ? 'up' : 'down',
      value: zscore,
      threshold: SGE_CONFIG.ZSCORE_THRESHOLD,
      timestamp,
    });
    if (zSignal) score += 2;

    const emaSlope = this.checkEMASlope(state);
    signals.push({
      type: 'ema_cross',
      triggered: emaSlope.confirmed,
      strength: emaSlope.confirmed ? 1 : 0,
      direction: emaSlope.direction,
      timestamp,
    });
    if (emaSlope.confirmed) score += 1;

    const directionVotes = signals.filter(s => s.triggered);
    const upVotes = directionVotes.filter(s => s.direction === 'up').length;
    const downVotes = directionVotes.filter(s => s.direction === 'down').length;
    
    let finalDirection: 'up' | 'down' | 'neutral' = 'neutral';
    if (upVotes > downVotes) finalDirection = 'up';
    else if (downVotes > upVotes) finalDirection = 'down';

    const triggeredSignals = signals.filter(s => s.triggered);
    const confidence = triggeredSignals.length > 0 
      ? triggeredSignals.reduce((sum, s) => sum + s.strength, 0) / 6 
      : 0;

    return {
      score,
      triggered: score >= 3,
      signals,
      direction: finalDirection,
      confidence: clamp(confidence, 0, 1),
    };
  }

  // ================================================================================
  // Step 8: 动态冷却计算
  // ================================================================================
  private calculateDynamicCooldown(state: AlertStateCache, price: number): number {
    const volFactor = state.rollingStd / price;
    let cooldown = SGE_CONFIG.BASE_COOLDOWN_SECONDS * (1 + 5 * volFactor);
    return clamp(cooldown, SGE_CONFIG.BASE_COOLDOWN_SECONDS, SGE_CONFIG.MAX_COOLDOWN_SECONDS);
  }

  // ================================================================================
  // Step 9: 去重保护
  // ================================================================================
  private shouldSuppress(
    state: AlertStateCache,
    direction: 'up' | 'down' | 'neutral',
    now: number
  ): boolean {
    if (state.lastAlertDirection === direction) {
      const timeSinceLastAlert = (now - state.lastAlertTime) / 1000;
      if (timeSinceLastAlert < SGE_CONFIG.DEDUP_WINDOW_SECONDS) {
        return true;
      }
    }
    return false;
  }

  // ================================================================================
  // Step 10: 价格穿越检测
  // ================================================================================
  private checkPriceCross(
    currentPrice: number,
    prevPrice: number,
    config: AlertConfiguration
  ): PriceCrossEvent | null {
    if (!config.conditions.targetPrice) return null;

    const targetPrice = config.conditions.targetPrice;
    const tolerance = config.tolerance.buy || config.tolerance.sell || 1.0;

    const buyTrigger = prevPrice > targetPrice && currentPrice <= targetPrice + tolerance;
    const sellTrigger = prevPrice < targetPrice && currentPrice >= targetPrice - tolerance;

    if (buyTrigger) {
      return {
        type: 'buy',
        targetPrice,
        prevPrice,
        currentPrice,
        timestamp: Date.now(),
        configId: config.id,
      };
    }

    if (sellTrigger) {
      return {
        type: 'sell',
        targetPrice,
        prevPrice,
        currentPrice,
        timestamp: Date.now(),
        configId: config.id,
      };
    }

    return null;
  }

  // ================================================================================
  // 公共 API: 更新价格并检查预警
  // ================================================================================
  updatePriceAndCheck(
    currentData: GoldPriceData,
    marketAnalysis?: MarketTrendAnalysis
  ): Level3AlertEvent[] {
    const price = currentData.domestic.price;
    const timestamp = currentData.timestamp;
    const now = Date.now();
    const beijingHour = getBeijingHour(timestamp);
    const session = getSession(beijingHour);
    const sessionMultiplier = getSessionMultiplier(beijingHour);

    let state = this.stateCache.get('global')!;
    const prevPrice = this.prevPrices.get('global') || price;

    state.priceHistory.push(price);
    state.timestamps.push(timestamp);
    
    if (state.priceHistory.length > SGE_CONFIG.VOL_WINDOW) {
      state.priceHistory = state.priceHistory.slice(-SGE_CONFIG.VOL_WINDOW);
      state.timestamps = state.timestamps.slice(-SGE_CONFIG.VOL_WINDOW);
    }

    state.rollingMean = mean(state.priceHistory);
    state.rollingStd = std(state.priceHistory);

    state.emaState = this.updateEMA(state, price);

    const atr = this.calculateATR(
      state,
      currentData.domestic.high,
      currentData.domestic.low,
      currentData.domestic.open
    );

    const dynamicThreshold = this.calculateDynamicThreshold(state) * sessionMultiplier;

    const fusionResult = this.fuseSignals(price, prevPrice, state, atr);

    const instantResult = this.checkInstantMove(price, prevPrice, state);
    state.instantConfirmCount = instantResult.confirmCount;

    const triggeredAlerts: Level3AlertEvent[] = [];

    if (fusionResult.triggered && !this.shouldSuppress(state, fusionResult.direction, now)) {
      const cooldown = this.calculateDynamicCooldown(state, price);
      
      const alertEvent: Level3AlertEvent = {
        id: `l3_${now}_${Math.random().toString(36).substr(2, 9)}`,
        alertId: 'level3_global',
        type: 'volatility_spike',
        timestamp: now,
        triggeredPrice: price,
        message: this.generateLevel3Message(fusionResult, price, session),
        severity: fusionResult.score >= 5 ? 'critical' : fusionResult.score >= 4 ? 'warning' : 'info',
        status: 'pending',
        metadata: {
          score: fusionResult.score,
          direction: fusionResult.direction,
          confidence: fusionResult.confidence,
        },
        level3Metadata: {
          session,
          sessionMultiplier,
          dynamicThreshold,
          emaFast: state.emaState.fast,
          emaSlow: state.emaState.slow,
          atr,
          zscore: this.calculateZScore(price, state),
          rollingStd: state.rollingStd,
          signalScore: fusionResult.score,
          signals: fusionResult.signals,
          cooldown,
        },
      };

      triggeredAlerts.push(alertEvent);
      this.alertHistory.push(alertEvent);
      
      state.lastAlertTime = now;
      state.lastAlertDirection = fusionResult.direction;
    }

    for (const config of this.configurations.values()) {
      if (!config.isActive) continue;

      const lastAlert = this.lastAlertTime.get(config.id);
      const cooldown = this.calculateDynamicCooldown(state, price);
      if (lastAlert && (now - lastAlert) / 1000 < cooldown) continue;

      const crossEvent = this.checkPriceCross(price, prevPrice, config);
      if (crossEvent) {
        const alertEvent: Level3AlertEvent = {
          id: `cross_${now}_${Math.random().toString(36).substr(2, 9)}`,
          alertId: config.id,
          type: 'price_target',
          timestamp: now,
          triggeredPrice: price,
          message: crossEvent.type === 'buy'
            ? `买入机会：价格 ${price.toFixed(2)} 已跌破目标价 ${config.conditions.targetPrice!.toFixed(2)}`
            : `卖出机会：价格 ${price.toFixed(2)} 已突破目标价 ${config.conditions.targetPrice!.toFixed(2)}`,
          severity: 'warning',
          status: 'pending',
          metadata: {
            crossType: crossEvent.type,
            targetPrice: config.conditions.targetPrice,
          },
          level3Metadata: {
            session,
            sessionMultiplier,
            dynamicThreshold,
            emaFast: state.emaState.fast,
            emaSlow: state.emaState.slow,
            atr,
            zscore: this.calculateZScore(price, state),
            rollingStd: state.rollingStd,
            signalScore: fusionResult.score,
            signals: fusionResult.signals,
            cooldown,
          },
        };

        triggeredAlerts.push(alertEvent);
        this.alertHistory.push(alertEvent);
        this.lastAlertTime.set(config.id, now);
      }
    }

    this.prevPrices.set('global', price);
    this.stateCache.set('global', state);

    return triggeredAlerts;
  }

  private generateLevel3Message(
    fusion: SignalFusionResult,
    price: number,
    session: SGESession
  ): string {
    const directionText = fusion.direction === 'up' ? '上涨' : fusion.direction === 'down' ? '下跌' : '震荡';
    const sessionText = session === 'night' ? '夜盘' : session === 'afternoon' ? '午盘' : '早盘';
    const triggeredTypes = fusion.signals
      .filter(s => s.triggered)
      .map(s => {
        switch (s.type) {
          case 'instant_move': return '即时变化';
          case 'atr_breakout': return 'ATR突破';
          case 'zscore_anomaly': return 'Z-score异常';
          case 'ema_cross': return 'EMA交叉';
          default: return s.type;
        }
      })
      .join('、');

    return `【${sessionText}】检测到${directionText}信号（评分:${fusion.score}）\n` +
           `当前价格: ¥${price.toFixed(2)}/克\n` +
           `触发指标: ${triggeredTypes}\n` +
           `置信度: ${(fusion.confidence * 100).toFixed(1)}%`;
  }

  // ================================================================================
  // 配置管理 API
  // ================================================================================
  createConfiguration(
    config: Omit<AlertConfiguration, 'id' | 'createdAt' | 'updatedAt'>
  ): AlertConfiguration {
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

  updateConfiguration(id: string, updates: Partial<AlertConfiguration>): AlertConfiguration | null {
    const config = this.configurations.get(id);
    if (!config) return null;
    const updated = { ...config, ...updates, updatedAt: Date.now() };
    this.configurations.set(id, updated);
    return updated;
  }

  deleteConfiguration(id: string): boolean {
    return this.configurations.delete(id);
  }

  getConfiguration(id: string): AlertConfiguration | undefined {
    return this.configurations.get(id);
  }

  getAllConfigurations(): AlertConfiguration[] {
    return Array.from(this.configurations.values());
  }

  // ================================================================================
  // 信号预警
  // ================================================================================
  checkSignalAlerts(signal: TradingSignal): Level3AlertEvent | null {
    const signalConfigs = Array.from(this.configurations.values()).filter(
      config => config.alertType === 'signal_generated' && config.isActive
    );

    for (const config of signalConfigs) {
      if (config.conditions.confidenceThreshold &&
          signal.confidence < config.conditions.confidenceThreshold) {
        continue;
      }

      const lastAlert = this.lastAlertTime.get(config.id);
      if (lastAlert && Date.now() - lastAlert < SGE_CONFIG.BASE_COOLDOWN_SECONDS * 1000) {
        continue;
      }

      const state = this.stateCache.get('global')!;
      const beijingHour = getBeijingHour(Date.now());
      
      const alert: Level3AlertEvent = {
        id: `signal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
        level3Metadata: {
          session: getSession(beijingHour),
          sessionMultiplier: getSessionMultiplier(beijingHour),
          dynamicThreshold: this.calculateDynamicThreshold(state),
          emaFast: state.emaState.fast,
          emaSlow: state.emaState.slow,
          atr: mean(state.atrState.values),
          zscore: 0,
          rollingStd: state.rollingStd,
          signalScore: Math.round(signal.confidence * 5),
          signals: [],
          cooldown: SGE_CONFIG.BASE_COOLDOWN_SECONDS,
        },
      };

      this.alertHistory.push(alert);
      this.lastAlertTime.set(config.id, Date.now());
      return alert;
    }

    return null;
  }

  private generateSignalAlertMessage(signal: TradingSignal): string {
    const typeMap = { BUY: '买入', SELL: '卖出', HOLD: '持有' };
    return `AI生成${typeMap[signal.type]}信号，置信度${(signal.confidence * 100).toFixed(1)}%，建议仓位${(signal.suggestedPosition * 100).toFixed(0)}%`;
  }

  // ================================================================================
  // 历史与统计
  // ================================================================================
  getAlertHistory(
    userId?: string,
    limit: number = 100,
    status?: AlertEvent['status']
  ): Level3AlertEvent[] {
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

  updateAlertStatus(alertId: string, status: AlertEvent['status']): boolean {
    const alert = this.alertHistory.find(a => a.id === alertId);
    if (alert) {
      alert.status = status;
      return true;
    }
    return false;
  }

  getStatistics(userId?: string): {
    totalAlerts: number;
    pendingAlerts: number;
    sentAlerts: number;
    acknowledgedAlerts: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    bySession: Record<string, number>;
    avgSignalScore: number;
  } {
    let alerts = this.alertHistory;

    if (userId) {
      alerts = alerts.filter(alert =>
        this.configurations.get(alert.alertId)?.userId === userId
      );
    }

    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const bySession: Record<string, number> = {};
    let totalSignalScore = 0;

    alerts.forEach(alert => {
      byType[alert.type] = (byType[alert.type] || 0) + 1;
      bySeverity[alert.severity] = (bySeverity[alert.severity] || 0) + 1;
      bySession[alert.level3Metadata.session] = (bySession[alert.level3Metadata.session] || 0) + 1;
      totalSignalScore += alert.level3Metadata.signalScore;
    });

    return {
      totalAlerts: alerts.length,
      pendingAlerts: alerts.filter(a => a.status === 'pending').length,
      sentAlerts: alerts.filter(a => a.status === 'sent').length,
      acknowledgedAlerts: alerts.filter(a => a.status === 'acknowledged').length,
      byType,
      bySeverity,
      bySession,
      avgSignalScore: alerts.length > 0 ? totalSignalScore / alerts.length : 0,
    };
  }

  cleanupExpiredAlerts(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - maxAgeMs;
    const initialLength = this.alertHistory.length;
    this.alertHistory = this.alertHistory.filter(alert => alert.timestamp > cutoff);
    return initialLength - this.alertHistory.length;
  }

  // ================================================================================
  // 市场状态
  // ================================================================================
  getMarketStatus(): {
    volatility: number;
    trend: 'up' | 'down' | 'neutral';
    priceChange24h: number;
    emaFast: number;
    emaSlow: number;
    atr: number;
    session: SGESession;
    dynamicThreshold: number;
  } {
    const state = this.stateCache.get('global')!;
    const prices = state.priceHistory;
    const priceChange24h = prices.length > 1
      ? ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100
      : 0;

    const beijingHour = getBeijingHour(Date.now());
    const trend = state.emaState.fast > state.emaState.slow ? 'up' 
      : state.emaState.fast < state.emaState.slow ? 'down' 
      : 'neutral';

    return {
      volatility: state.rollingStd,
      trend,
      priceChange24h,
      emaFast: state.emaState.fast,
      emaSlow: state.emaState.slow,
      atr: mean(state.atrState.values),
      session: getSession(beijingHour),
      dynamicThreshold: this.calculateDynamicThreshold(state),
    };
  }

  // ================================================================================
  // 兼容旧 API
  // ================================================================================
  checkPriceAlerts(
    currentData: GoldPriceData,
    marketAnalysis: MarketTrendAnalysis
  ): AlertEvent[] {
    return this.updatePriceAndCheck(currentData, marketAnalysis);
  }

  calculateThresholdRange(
    basePrice: number,
    alertType: 'buy' | 'sell',
    marketVolatility: number,
    trend: MarketTrendAnalysis['trend']
  ): { min: number; max: number } {
    const state = this.stateCache.get('global')!;
    const dynamicThreshold = this.calculateDynamicThreshold(state);
    
    return {
      min: basePrice - dynamicThreshold,
      max: basePrice + dynamicThreshold,
    };
  }
}

export const alertSystem = new AlertSystem();
