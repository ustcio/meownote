// ================================================================================
// 实时金价智能分析系统 - 类型定义
// ================================================================================

// 金价数据源类型
export interface GoldPriceData {
  timestamp: number;
  date: string;
  exchangeRate: number;
  domestic: {
    price: number;
    open: number;
    high: number;
    low: number;
    change: number;
    changePercent: number;
    volume?: number;
    turnover?: number;
  };
  international: {
    price: number;
    open: number;
    high: number;
    low: number;
    change: number;
    changePercent: number;
    volume?: number;
    turnover?: number;
  };
  source: string;
  reliability: number; // 0-1 数据可靠性评分
}

// 历史价格数据点
export interface PriceHistoryPoint {
  timestamp: number;
  price: number;
  volume?: number;
  source: string;
}

// 市场趋势分析结果
export interface MarketTrendAnalysis {
  trend: 'strong_up' | 'up' | 'sideways' | 'down' | 'strong_down' | 'unknown';
  strength: number; // 0-100 趋势强度
  dayChange: number; // 日内涨跌幅
  volatility: number; // 波动率
  high: number; // 今日最高
  low: number; // 今日最低
  openPrice: number; // 开盘价
  currentPrice: number; // 当前价格
  supportLevel: number; // 支撑位
  resistanceLevel: number; // 阻力位
  movingAverages: {
    ma5: number;
    ma10: number;
    ma20: number;
    ma60: number;
  };
}

// AI 预测结果
export interface AIPredictionResult {
  modelName: string;
  modelVersion: string;
  timestamp: number;
  predictions: {
    shortTerm: PricePrediction; // 短期预测 (1-4小时)
    midTerm: PricePrediction; // 中期预测 (1-3天)
    longTerm?: PricePrediction; // 长期预测 (1周)
  };
  trendAnalysis: {
    direction: 'bullish' | 'bearish' | 'neutral';
    confidence: number;
    keyFactors: string[];
  };
  riskAssessment: {
    level: 'low' | 'medium' | 'high';
    maxDrawdown: number;
    volatilityForecast: number;
  };
}

// 价格预测
export interface PricePrediction {
  targetPrice: number;
  priceRange: {
    min: number;
    max: number;
  };
  confidence: number; // 0-1 置信度
  probabilityDistribution: {
    belowTarget: number;
    atTarget: number;
    aboveTarget: number;
  };
  timeHorizon: string;
}

// 交易信号
export interface TradingSignal {
  id: string;
  type: 'BUY' | 'SELL' | 'HOLD';
  timestamp: number;
  currentPrice: number;
  targetPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  confidence: number;
  urgency: 'immediate' | 'normal' | 'low';
  reasoning: string;
  riskLevel: 'low' | 'medium' | 'high';
  suggestedPosition: number; // 建议仓位比例 0-1
  expiryTime: number; // 信号过期时间
  metadata: {
    modelContributions: Record<string, number>;
    technicalIndicators: TechnicalIndicator[];
    marketContext: string;
  };
}

// 技术指标
export interface TechnicalIndicator {
  name: string;
  value: number;
  signal: 'buy' | 'sell' | 'neutral';
  strength: number; // 0-100
}

// 交易指令
export interface TradingCommand {
  id: string;
  type: 'BUY' | 'SELL';
  priceRange: {
    min: number;
    max: number;
  };
  quantity?: number;
  conditions: {
    triggerPrice: number;
    stopLoss?: number;
    takeProfit?: number;
    timeLimit?: number;
  };
  execution: {
    strategy: 'market' | 'limit' | 'twap' | 'vwap';
    urgency: 'immediate' | 'normal' | 'low';
  };
  validation: {
    maxSlippage: number;
    minConfidence: number;
  };
}

// 预警配置
export interface AlertConfiguration {
  id: string;
  userId: string;
  alertType: 'price_target' | 'trend_change' | 'volatility_spike' | 'signal_generated';
  conditions: {
    targetPrice?: number;
    priceRange?: { min: number; max: number };
    trendDirection?: 'up' | 'down';
    volatilityThreshold?: number;
    confidenceThreshold?: number;
  };
  tolerance: {
    buy: number;
    sell: number;
  };
  notification: {
    channels: ('push' | 'email' | 'sms' | 'webhook')[];
    frequency: 'immediate' | 'batched' | 'digest';
    quietHours?: { start: string; end: string };
  };
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

// 预警事件
export interface AlertEvent {
  id: string;
  alertId: string;
  type: string;
  timestamp: number;
  triggeredPrice: number;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  status: 'pending' | 'sent' | 'acknowledged' | 'expired';
  metadata: Record<string, any>;
}

// 系统性能指标
export interface SystemMetrics {
  timestamp: number;
  dataCollection: {
    lastUpdate: number;
    updateLatency: number;
    dataQuality: number;
    sourceReliability: Record<string, number>;
  };
  aiProcessing: {
    lastAnalysis: number;
    analysisLatency: number;
    modelPerformance: Record<string, {
      accuracy: number;
      latency: number;
      successRate: number;
    }>;
  };
  alertSystem: {
    alertsGenerated: number;
    alertsSent: number;
    deliveryRate: number;
    avgDeliveryTime: number;
  };
  tradingEngine: {
    signalsGenerated: number;
    commandsExecuted: number;
    successRate: number;
  };
}

// AI 模型配置
export interface AIModelConfig {
  name: string;
  provider: 'qwen' | 'doubao' | 'timegpt' | 'finbert' | 'custom';
  version: string;
  capabilities: string[];
  parameters: {
    temperature: number;
    maxTokens: number;
    topP: number;
    frequencyPenalty: number;
  };
  performance: {
    accuracy: number;
    latency: number;
    costPerRequest: number;
  };
  enabled: boolean;
  weight: number; // 在集成模型中的权重
}

// 数据质量报告
export interface DataQualityReport {
  timestamp: number;
  period: string;
  completeness: number;
  accuracy: number;
  timeliness: number;
  consistency: number;
  issues: {
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    count: number;
  }[];
}

// 回测结果
export interface BacktestResult {
  period: { start: string; end: string };
  totalSignals: number;
  successfulSignals: number;
  failedSignals: number;
  accuracy: number;
  avgReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  profitFactor: number;
  byModel: Record<string, {
    signals: number;
    accuracy: number;
    avgReturn: number;
  }>;
}

// ================================================================================
// SGE Level 3 预警系统类型定义
// ================================================================================

// SGE 交易时段
export type SGESession = 'asian_morning' | 'afternoon' | 'night';

// SGE 预警配置
export interface SGEAlertConfig {
  WINDOW_SIZE: number;
  SHORT_TERM_POINTS: number;
  VOL_WINDOW: number;
  BASE_THRESHOLD_YUAN: number;
  MIN_THRESHOLD_YUAN: number;
  INSTANT_ABS_THRESHOLD: number;
  INSTANT_PERCENT_THRESHOLD: number;
  INSTANT_CONFIRM_TICKS: number;
  ATR_PERIOD: number;
  ATR_MULTIPLIER: number;
  ZSCORE_THRESHOLD: number;
  EMA_FAST: number;
  EMA_SLOW: number;
  BASE_COOLDOWN_SECONDS: number;
  MAX_COOLDOWN_SECONDS: number;
  DEDUP_WINDOW_SECONDS: number;
  STATE_CACHE_TTL: number;
  TOLERANCE_MIN: number;
  TOLERANCE_MAX: number;
  QUIET_HOURS_START: number;
  QUIET_HOURS_END: number;
  TICK_NOISE_FILTER: number;
  MICRO_VOL_THRESHOLD: number;
  NIGHT_SCORE_BOOST: number;
  TREND_CONFIRM_BARS: number;
  MIN_DIRECTION_CONSENSUS: number;
  EMA_THRESHOLD_FACTOR: number;
  EMA_MIN_PERCENT: number;
}

// EMA 状态
export interface EMAState {
  fast: number;
  slow: number;
  lastPrice: number;
}

// ATR 状态
export interface ATRState {
  values: number[];
  trValues: number[];
}

// 预警信号类型
export type AlertSignalType = 
  | 'instant_move'
  | 'atr_breakout'
  | 'zscore_anomaly'
  | 'ema_cross'
  | 'price_target'
  | 'trend_change';

// 预警信号
export interface AlertSignal {
  type: AlertSignalType;
  triggered: boolean;
  strength: number;
  direction: 'up' | 'down' | 'neutral';
  value?: number;
  threshold?: number;
  timestamp: number;
}

// 信号融合结果
export interface SignalFusionResult {
  score: number;
  triggered: boolean;
  signals: AlertSignal[];
  direction: 'up' | 'down' | 'neutral';
  confidence: number;
}

// Level 3 预警事件
export interface Level3AlertEvent extends AlertEvent {
  level3Metadata: {
    session: SGESession;
    sessionMultiplier: number;
    dynamicThreshold: number;
    emaFast: number;
    emaSlow: number;
    atr: number;
    zscore: number;
    rollingStd: number;
    signalScore: number;
    signals: AlertSignal[];
    cooldown: number;
  };
}

// 价格穿越事件
export interface PriceCrossEvent {
  type: 'buy' | 'sell';
  targetPrice: number;
  prevPrice: number;
  currentPrice: number;
  timestamp: number;
  configId: string;
}

// 预警状态缓存
export interface AlertStateCache {
  priceHistory: number[];
  timestamps: number[];
  emaState: EMAState;
  atrState: ATRState;
  instantConfirmCount: number;
  lastAlertTime: number;
  lastAlertDirection: 'up' | 'down' | 'neutral';
  rollingMean: number;
  rollingStd: number;
}
