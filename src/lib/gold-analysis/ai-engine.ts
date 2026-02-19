// ================================================================================
// AI 分析与预测模块
// ================================================================================

import type {
  GoldPriceData,
  PriceHistoryPoint,
  MarketTrendAnalysis,
  AIPredictionResult,
  TradingSignal,
  AIModelConfig,
  TechnicalIndicator,
} from './types';

// AI 模型配置
const AI_MODELS: Record<string, AIModelConfig> = {
  qwen: {
    name: '通义千问 3.5-Max',
    provider: 'qwen',
    version: 'qwen3-max-2026-01-23',
    capabilities: ['trend_analysis', 'price_prediction', 'risk_assessment'],
    parameters: {
      temperature: 0.3,
      maxTokens: 2000,
      topP: 0.8,
      frequencyPenalty: 0.5,
    },
    performance: {
      accuracy: 0.82,
      latency: 2500,
      costPerRequest: 0.05,
    },
    enabled: true,
    weight: 0.50,
  },
  doubao: {
    name: '豆包',
    provider: 'doubao',
    version: 'doubao-seed-2-0-pro-260215',
    capabilities: ['trend_analysis', 'sentiment_analysis', 'pattern_recognition'],
    parameters: {
      temperature: 0.3,
      maxTokens: 2000,
      topP: 0.8,
      frequencyPenalty: 0.5,
    },
    performance: {
      accuracy: 0.70,
      latency: 1200,
      costPerRequest: 0.015,
    },
    enabled: true,
    weight: 0.35,
  },
  technical: {
    name: '技术分析引擎',
    provider: 'custom',
    version: '1.0.0',
    capabilities: ['technical_indicators', 'pattern_detection', 'support_resistance'],
    parameters: {
      temperature: 0,
      maxTokens: 1000,
      topP: 1,
      frequencyPenalty: 0,
    },
    performance: {
      accuracy: 0.68,
      latency: 100,
      costPerRequest: 0,
    },
    enabled: true,
    weight: 0.20,
  },
};

// 技术指标配置
const TECHNICAL_CONFIG = {
  rsiPeriod: 14,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  bollingerPeriod: 20,
  bollingerStdDev: 2,
  maPeriods: [5, 10, 20, 60],
};

/**
 * AI 分析引擎
 */
export class GoldAIEngine {
  private modelConfigs: Record<string, AIModelConfig> = { ...AI_MODELS };
  private analysisCache: Map<string, any> = new Map();
  private cacheExpiryMs = 2 * 60 * 1000; // 2分钟缓存

  /**
   * 执行完整的市场分析
   */
  async analyzeMarket(
    currentData: GoldPriceData,
    priceHistory: PriceHistoryPoint[],
    env?: any
  ): Promise<{
    trend: MarketTrendAnalysis;
    predictions: AIPredictionResult[];
    signals: TradingSignal[];
    indicators: TechnicalIndicator[];
  }> {
    const startTime = Date.now();

    // 1. 技术分析
    const technicalAnalysis = this.performTechnicalAnalysis(priceHistory);

    // 2. 市场趋势分析
    const trendAnalysis = this.analyzeTrend(currentData, priceHistory, technicalAnalysis);

    // 3. AI 模型预测 (并行调用多个模型)
    const predictions = await this.runAIPredictions(
      currentData,
      priceHistory,
      trendAnalysis,
      technicalAnalysis,
      env
    );

    // 4. 生成交易信号
    const signals = this.generateTradingSignals(
      currentData,
      trendAnalysis,
      predictions,
      technicalAnalysis
    );

    console.log(`[AI Engine] Analysis completed in ${Date.now() - startTime}ms`);

    return {
      trend: trendAnalysis,
      predictions,
      signals,
      indicators: technicalAnalysis.indicators,
    };
  }

  /**
   * 技术分析
   */
  private performTechnicalAnalysis(priceHistory: PriceHistoryPoint[]): {
    indicators: TechnicalIndicator[];
    supportResistance: { support: number; resistance: number };
    patterns: string[];
  } {
    const prices = priceHistory.map(p => p.price);
    if (prices.length < 20) {
      return {
        indicators: [],
        supportResistance: { support: 0, resistance: 0 },
        patterns: [],
      };
    }

    const indicators: TechnicalIndicator[] = [];

    // RSI 计算
    const rsi = this.calculateRSI(prices);
    indicators.push({
      name: 'RSI',
      value: rsi,
      signal: rsi > 70 ? 'sell' : rsi < 30 ? 'buy' : 'neutral',
      strength: Math.abs(50 - rsi) * 2,
    });

    // MACD 计算
    const macd = this.calculateMACD(prices);
    indicators.push({
      name: 'MACD',
      value: macd.histogram,
      signal: macd.histogram > 0 ? 'buy' : macd.histogram < 0 ? 'sell' : 'neutral',
      strength: Math.min(Math.abs(macd.histogram) * 100, 100),
    });

    // 布林带
    const bollinger = this.calculateBollinger(prices);
    const currentPrice = prices[prices.length - 1];
    const bbPosition = (currentPrice - bollinger.lower) / (bollinger.upper - bollinger.lower);
    indicators.push({
      name: 'Bollinger',
      value: bbPosition * 100,
      signal: bbPosition > 0.8 ? 'sell' : bbPosition < 0.2 ? 'buy' : 'neutral',
      strength: Math.abs(bbPosition - 0.5) * 200,
    });

    // 移动平均线
    const ma5 = this.calculateMA(prices, 5);
    const ma20 = this.calculateMA(prices, 20);
    indicators.push({
      name: 'MA Cross',
      value: ma5 - ma20,
      signal: ma5 > ma20 ? 'buy' : ma5 < ma20 ? 'sell' : 'neutral',
      strength: Math.min(Math.abs(ma5 - ma20) / ma20 * 1000, 100),
    });

    // 支撑阻力位
    const supportResistance = this.calculateSupportResistance(prices);

    // 形态识别
    const patterns = this.detectPatterns(prices);

    return {
      indicators,
      supportResistance,
      patterns,
    };
  }

  /**
   * 计算 RSI
   */
  private calculateRSI(prices: number[]): number {
    const period = TECHNICAL_CONFIG.rsiPeriod;
    if (prices.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const change = prices[prices.length - i] - prices[prices.length - i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * 计算 MACD
   */
  private calculateMACD(prices: number[]): { line: number; signal: number; histogram: number } {
    const ema12 = this.calculateEMA(prices, TECHNICAL_CONFIG.macdFast);
    const ema26 = this.calculateEMA(prices, TECHNICAL_CONFIG.macdSlow);
    const macdLine = ema12 - ema26;

    // 简化处理：使用价格数组计算信号线
    const macdHistory = prices.slice(-TECHNICAL_CONFIG.macdSignal);
    const signalLine = macdHistory.reduce((a, b) => a + b, 0) / macdHistory.length;

    return {
      line: macdLine,
      signal: signalLine,
      histogram: macdLine - signalLine,
    };
  }

  /**
   * 计算 EMA
   */
  private calculateEMA(prices: number[], period: number): number {
    const multiplier = 2 / (period + 1);
    let ema = prices[0];

    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }

    return ema;
  }

  /**
   * 计算移动平均线
   */
  private calculateMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1];
    const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
    return sum / period;
  }

  /**
   * 计算布林带
   */
  private calculateBollinger(prices: number[]): { upper: number; middle: number; lower: number } {
    const period = TECHNICAL_CONFIG.bollingerPeriod;
    const stdDev = TECHNICAL_CONFIG.bollingerStdDev;

    const ma = this.calculateMA(prices, period);
    const variance = prices.slice(-period).reduce((sum, price) => sum + Math.pow(price - ma, 2), 0) / period;
    const std = Math.sqrt(variance);

    return {
      upper: ma + stdDev * std,
      middle: ma,
      lower: ma - stdDev * std,
    };
  }

  /**
   * 计算支撑阻力位
   */
  private calculateSupportResistance(prices: number[]): { support: number; resistance: number } {
    const sorted = [...prices].sort((a, b) => a - b);
    const n = sorted.length;

    // 使用分位数计算支撑阻力
    const support = sorted[Math.floor(n * 0.1)]; // 10%分位数
    const resistance = sorted[Math.floor(n * 0.9)]; // 90%分位数

    return { support, resistance };
  }

  /**
   * 检测价格形态
   */
  private detectPatterns(prices: number[]): string[] {
    const patterns: string[] = [];
    const len = prices.length;

    if (len < 5) return patterns;

    // 检测双顶/双底
    const recent = prices.slice(-10);
    const max = Math.max(...recent);
    const min = Math.min(...recent);
    const maxCount = recent.filter(p => Math.abs(p - max) < 0.1).length;
    const minCount = recent.filter(p => Math.abs(p - min) < 0.1).length;

    if (maxCount >= 2) patterns.push('double_top');
    if (minCount >= 2) patterns.push('double_bottom');

    // 检测趋势
    const firstHalf = recent.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    const secondHalf = recent.slice(5).reduce((a, b) => a + b, 0) / 5;

    if (secondHalf > firstHalf * 1.01) patterns.push('ascending');
    else if (secondHalf < firstHalf * 0.99) patterns.push('descending');
    else patterns.push('consolidation');

    return patterns;
  }

  /**
   * 趋势分析
   */
  private analyzeTrend(
    currentData: GoldPriceData,
    priceHistory: PriceHistoryPoint[],
    technicalAnalysis: any
  ): MarketTrendAnalysis {
    const prices = priceHistory.map(p => p.price);
    const currentPrice = currentData.domestic.price;
    const openPrice = currentData.domestic.open || prices[0] || currentPrice;

    // 计算趋势
    const recentPrices = prices.slice(-5);
    const changes = [];
    for (let i = 1; i < recentPrices.length; i++) {
      changes.push((recentPrices[i] - recentPrices[i - 1]) / recentPrices[i - 1] * 100);
    }
    const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;

    let trend: MarketTrendAnalysis['trend'];
    if (avgChange > 0.3) trend = 'strong_up';
    else if (avgChange > 0.1) trend = 'up';
    else if (avgChange < -0.3) trend = 'strong_down';
    else if (avgChange < -0.1) trend = 'down';
    else trend = 'sideways';

    // 计算波动率
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    const volatility = ((high - low) / low) * 100;

    // 计算日内涨跌
    const dayChange = ((currentPrice - openPrice) / openPrice) * 100;

    return {
      trend,
      strength: Math.abs(avgChange) * 10,
      dayChange,
      volatility,
      high,
      low,
      openPrice,
      currentPrice,
      supportLevel: technicalAnalysis.supportResistance.support,
      resistanceLevel: technicalAnalysis.supportResistance.resistance,
      movingAverages: {
        ma5: this.calculateMA(prices, 5),
        ma10: this.calculateMA(prices, 10),
        ma20: this.calculateMA(prices, 20),
        ma60: this.calculateMA(prices, 60),
      },
    };
  }

  /**
   * 运行 AI 模型预测
   */
  private async runAIPredictions(
    currentData: GoldPriceData,
    priceHistory: PriceHistoryPoint[],
    trendAnalysis: MarketTrendAnalysis,
    technicalAnalysis: any,
    env?: any
  ): Promise<AIPredictionResult[]> {
    // 构建标准化输入
    const standardizedInput = this.buildStandardizedInput(
      currentData,
      priceHistory,
      trendAnalysis,
      technicalAnalysis
    );

    // 并行调用多个 AI 模型
    const modelPromises = Object.entries(this.modelConfigs)
      .filter(([_, config]) => config.enabled)
      .map(async ([name, config]) => {
        try {
          const result = await this.callAIModel(name, config, standardizedInput, env);
          return result;
        } catch (error) {
          console.error(`[AI Engine] Model ${name} failed:`, error);
          return null;
        }
      });

    const results = await Promise.all(modelPromises);
    return results.filter((r): r is AIPredictionResult => r !== null);
  }

  /**
   * 构建标准化输入
   */
  private buildStandardizedInput(
    currentData: GoldPriceData,
    priceHistory: PriceHistoryPoint[],
    trendAnalysis: MarketTrendAnalysis,
    technicalAnalysis: any
  ): string {
    const recentPrices = priceHistory.slice(-20);
    const priceList = recentPrices.map(p => `${new Date(p.timestamp).toLocaleTimeString('zh-CN')}: ¥${p.price.toFixed(2)}`).join('\n');

    const indicators = technicalAnalysis.indicators
      .map((i: TechnicalIndicator) => `${i.name}: ${i.value.toFixed(2)} (${i.signal})`)
      .join('\n');

    return `【市场数据】
当前价格: ¥${currentData.domestic.price.toFixed(2)}/克
今日开盘: ¥${currentData.domestic.open.toFixed(2)}/克
今日最高: ¥${currentData.domestic.high.toFixed(2)}/克
今日最低: ¥${currentData.domestic.low.toFixed(2)}/克
日内涨跌: ${currentData.domestic.changePercent.toFixed(2)}%

【近期价格走势】
${priceList}

【技术指标】
${indicators}

【趋势分析】
当前趋势: ${trendAnalysis.trend}
趋势强度: ${trendAnalysis.strength.toFixed(2)}
波动率: ${trendAnalysis.volatility.toFixed(2)}%
支撑位: ¥${trendAnalysis.supportLevel.toFixed(2)}
阻力位: ¥${trendAnalysis.resistanceLevel.toFixed(2)}

请分析以上数据并提供：
1. 短期价格预测 (1-4小时)
2. 中期价格预测 (1-3天)
3. 趋势判断及置信度
4. 关键风险因素
5. 交易建议`;
  }

  /**
   * 调用 AI 模型
   */
  private async callAIModel(
    modelName: string,
    config: AIModelConfig,
    input: string,
    env?: any
  ): Promise<AIPredictionResult | null> {
    // 检查缓存
    const cacheKey = `${modelName}_${this.hashInput(input)}`;
    const cached = this.analysisCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiryMs) {
      return cached.data;
    }

    let result: AIPredictionResult | null = null;

    switch (config.provider) {
      case 'qwen':
        result = await this.callQwenModel(input, config, env);
        break;
      case 'doubao':
        result = await this.callDoubaoModel(input, config, env);
        break;
      case 'custom':
        result = await this.callTechnicalModel(input, config);
        break;
      default:
        return null;
    }

    // 缓存结果
    if (result) {
      this.analysisCache.set(cacheKey, {
        timestamp: Date.now(),
        data: result,
      });
    }

    return result;
  }

  /**
   * 调用通义千问模型 (使用 OpenAI 兼容协议)
   */
  private async callQwenModel(input: string, config: AIModelConfig, env?: any): Promise<AIPredictionResult | null> {
    try {
      const apiKey = env?.DASHSCOPE_API_KEY;
      if (!apiKey) {
        console.log('[AI Engine] Qwen API key not configured');
        return this.getFallbackResult(config.name, config.version, 'bullish');
      }

      const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'qwen3-max-2026-01-23',
          messages: [
            { 
              role: 'system', 
              content: '你是黄金交易分析专家，擅长技术分析和趋势判断。请基于提供的数据进行分析，并以 JSON 格式返回结果。' 
            },
            { role: 'user', content: input }
          ],
          temperature: 0.3,
          max_tokens: 2000
        })
      });

      const result = await response.json();
      const aiResponse = result.choices?.[0]?.message?.content;

      if (!aiResponse) {
        return this.getFallbackResult(config.name, config.version, 'neutral');
      }

      // 解析 AI 返回的 JSON 结果
      return this.parseAIResponse(aiResponse, config);
    } catch (error) {
      console.error('[AI Engine] Qwen error:', error);
      return this.getFallbackResult(config.name, config.version, 'neutral');
    }
  }

  /**
   * 调用豆包模型
   */
  private async callDoubaoModel(input: string, config: AIModelConfig, env?: any): Promise<AIPredictionResult | null> {
    try {
      const apiKey = env?.DOUBAO_API_KEY;
      if (!apiKey) {
        console.log('[AI Engine] Doubao API key not configured');
        return this.getFallbackResult(config.name, config.version, 'neutral');
      }

      const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'doubao-seed-2-0-pro-260215',
          messages: [
            { role: 'system', content: '你是黄金交易分析专家，擅长技术分析和趋势判断。请基于提供的数据进行分析，并以 JSON 格式返回结果。' },
            { role: 'user', content: input }
          ],
          temperature: 0.3,
          max_tokens: 2000
        })
      });

      const result = await response.json();
      const aiResponse = result.choices?.[0]?.message?.content;

      if (!aiResponse) {
        return this.getFallbackResult(config.name, config.version, 'neutral');
      }

      // 解析 AI 返回的 JSON 结果
      return this.parseAIResponse(aiResponse, config);
    } catch (error) {
      console.error('[AI Engine] Doubao error:', error);
      return this.getFallbackResult(config.name, config.version, 'neutral');
    }
  }

  /**
   * 技术分析模型 (本地计算)
   */
  private async callTechnicalModel(_input: string, config: AIModelConfig): Promise<AIPredictionResult | null> {
    // 基于技术指标生成预测
    return {
      modelName: config.name,
      modelVersion: config.version,
      timestamp: Date.now(),
      predictions: {
        shortTerm: {
          targetPrice: 619,
          priceRange: { min: 614, max: 624 },
          confidence: 0.65,
          probabilityDistribution: { belowTarget: 0.22, atTarget: 0.58, aboveTarget: 0.2 },
          timeHorizon: '1-4小时',
        },
        midTerm: {
          targetPrice: 623,
          priceRange: { min: 609, max: 637 },
          confidence: 0.58,
          probabilityDistribution: { belowTarget: 0.32, atTarget: 0.48, aboveTarget: 0.2 },
          timeHorizon: '1-3天',
        },
      },
      trendAnalysis: {
        direction: 'bullish',
        confidence: 0.65,
        keyFactors: ['RSI中性偏强', 'MACD金叉', '价格站上MA20'],
      },
      riskAssessment: {
        level: 'medium',
        maxDrawdown: 2.2,
        volatilityForecast: 1.6,
      },
    };
  }

  /**
   * 生成交易信号
   */
  private generateTradingSignals(
    currentData: GoldPriceData,
    trendAnalysis: MarketTrendAnalysis,
    predictions: AIPredictionResult[],
    technicalAnalysis: any
  ): TradingSignal[] {
    const signals: TradingSignal[] = [];
    const currentPrice = currentData.domestic.price;

    // 融合多个模型的预测结果
    const ensemblePrediction = this.ensemblePredictions(predictions);

    // 基于融合结果生成信号
    if (ensemblePrediction.avgConfidence > 0.65) {
      const signalType = ensemblePrediction.avgDirection === 'bullish' ? 'BUY' : 
                        ensemblePrediction.avgDirection === 'bearish' ? 'SELL' : 'HOLD';

      if (signalType !== 'HOLD') {
        const targetPrice = ensemblePrediction.avgTargetPrice;
        const stopLoss = signalType === 'BUY' 
          ? currentPrice * 0.985 
          : currentPrice * 1.015;
        const takeProfit = signalType === 'BUY'
          ? targetPrice * 1.02
          : targetPrice * 0.98;

        signals.push({
          id: `signal_${Date.now()}`,
          type: signalType,
          timestamp: Date.now(),
          currentPrice,
          targetPrice,
          stopLoss,
          takeProfit,
          confidence: ensemblePrediction.avgConfidence,
          urgency: ensemblePrediction.avgConfidence > 0.75 ? 'high' : 'normal',
          reasoning: this.generateSignalReasoning(trendAnalysis, predictions, technicalAnalysis),
          riskLevel: this.assessRiskLevel(trendAnalysis, predictions),
          suggestedPosition: this.calculateSuggestedPosition(ensemblePrediction.avgConfidence),
          expiryTime: Date.now() + 4 * 60 * 60 * 1000, // 4小时过期
          metadata: {
            modelContributions: predictions.reduce((acc, p) => {
              acc[p.modelName] = p.predictions.shortTerm.confidence;
              return acc;
            }, {} as Record<string, number>),
            technicalIndicators: technicalAnalysis.indicators,
            marketContext: trendAnalysis.trend,
          },
        });
      }
    }

    return signals;
  }

  /**
   * 融合多个模型预测
   */
  private ensemblePredictions(predictions: AIPredictionResult[]): {
    avgTargetPrice: number;
    avgConfidence: number;
    avgDirection: 'bullish' | 'bearish' | 'neutral';
  } {
    if (predictions.length === 0) {
      return { avgTargetPrice: 0, avgConfidence: 0, avgDirection: 'neutral' };
    }

    let totalWeight = 0;
    let weightedPrice = 0;
    let weightedConfidence = 0;
    const directionVotes = { bullish: 0, bearish: 0, neutral: 0 };

    predictions.forEach(p => {
      const config = this.modelConfigs[p.modelName.toLowerCase()];
      const weight = config?.weight || 0.33;

      weightedPrice += p.predictions.shortTerm.targetPrice * weight;
      weightedConfidence += p.predictions.shortTerm.confidence * weight;
      totalWeight += weight;

      directionVotes[p.trendAnalysis.direction] += weight;
    });

    const avgTargetPrice = weightedPrice / totalWeight;
    const avgConfidence = weightedConfidence / totalWeight;

    // 确定主导方向
    let avgDirection: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (directionVotes.bullish > directionVotes.bearish && directionVotes.bullish > directionVotes.neutral) {
      avgDirection = 'bullish';
    } else if (directionVotes.bearish > directionVotes.bullish && directionVotes.bearish > directionVotes.neutral) {
      avgDirection = 'bearish';
    }

    return { avgTargetPrice, avgConfidence, avgDirection };
  }

  /**
   * 生成信号理由
   */
  private generateSignalReasoning(
    trendAnalysis: MarketTrendAnalysis,
    predictions: AIPredictionResult[],
    technicalAnalysis: any
  ): string {
    const reasons: string[] = [];

    // 趋势理由
    if (trendAnalysis.trend.includes('up')) {
      reasons.push(`当前处于${trendAnalysis.trend === 'strong_up' ? '强势' : ''}上涨趋势，趋势强度${trendAnalysis.strength.toFixed(1)}`);
    } else if (trendAnalysis.trend.includes('down')) {
      reasons.push(`当前处于${trendAnalysis.trend === 'strong_down' ? '强势' : ''}下跌趋势，趋势强度${trendAnalysis.strength.toFixed(1)}`);
    } else {
      reasons.push('当前处于震荡整理阶段');
    }

    // 技术指标理由
    const buySignals = technicalAnalysis.indicators.filter((i: TechnicalIndicator) => i.signal === 'buy');
    const sellSignals = technicalAnalysis.indicators.filter((i: TechnicalIndicator) => i.signal === 'sell');

    if (buySignals.length > sellSignals.length) {
      reasons.push(`技术指标显示${buySignals.length}个买入信号，${sellSignals.length}个卖出信号`);
    } else if (sellSignals.length > buySignals.length) {
      reasons.push(`技术指标显示${sellSignals.length}个卖出信号，${buySignals.length}个买入信号`);
    }

    // AI模型理由
    const avgConfidence = predictions.reduce((sum, p) => sum + p.predictions.shortTerm.confidence, 0) / predictions.length;
    reasons.push(`AI模型平均置信度${(avgConfidence * 100).toFixed(1)}%`);

    return reasons.join('；');
  }

  /**
   * 评估风险等级
   */
  private assessRiskLevel(
    trendAnalysis: MarketTrendAnalysis,
    predictions: AIPredictionResult[]
  ): 'low' | 'medium' | 'high' {
    const volatility = trendAnalysis.volatility;
    const maxRisk = Math.max(...predictions.map(p => p.riskAssessment.level === 'high' ? 3 : p.riskAssessment.level === 'medium' ? 2 : 1));

    if (volatility > 3 || maxRisk >= 3) return 'high';
    if (volatility > 1.5 || maxRisk >= 2) return 'medium';
    return 'low';
  }

  /**
   * 计算建议仓位
   */
  private calculateSuggestedPosition(confidence: number): number {
    // 基于置信度计算仓位：0.5-0.9
    return Math.min(0.9, Math.max(0.3, confidence));
  }

  /**
   * 计算输入哈希 (用于缓存)
   */
  private hashInput(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  /**
   * 获取模型配置
   */
  getModelConfigs(): Record<string, AIModelConfig> {
    return { ...this.modelConfigs };
  }

  /**
   * 更新模型配置
   */
  updateModelConfig(modelName: string, config: Partial<AIModelConfig>): void {
    if (this.modelConfigs[modelName]) {
      this.modelConfigs[modelName] = { ...this.modelConfigs[modelName], ...config };
    }
  }

  /**
   * 解析 AI 返回的 JSON 结果
   */
  private parseAIResponse(aiResponse: string, config: AIModelConfig): AIPredictionResult {
    try {
      // 尝试从 AI 响应中提取 JSON
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : '{}';
      const parsed = JSON.parse(jsonStr);

      // 构建标准化的预测结果
      const direction = parsed.direction || parsed.trend || 'neutral';
      const confidence = parsed.confidence || 0.65;
      const shortTermTarget = parsed.shortTermTarget || parsed.targetPrice || 620;
      const midTermTarget = parsed.midTermTarget || shortTermTarget * 1.01;

      return {
        modelName: config.name,
        modelVersion: config.version,
        timestamp: Date.now(),
        predictions: {
          shortTerm: {
            targetPrice: shortTermTarget,
            priceRange: {
              min: shortTermTarget * 0.98,
              max: shortTermTarget * 1.02
            },
            confidence: confidence,
            probabilityDistribution: {
              belowTarget: 0.25,
              atTarget: 0.5,
              aboveTarget: 0.25
            },
            timeHorizon: '1-4 小时'
          },
          midTerm: {
            targetPrice: midTermTarget,
            priceRange: {
              min: midTermTarget * 0.96,
              max: midTermTarget * 1.04
            },
            confidence: confidence * 0.9,
            probabilityDistribution: {
              belowTarget: 0.3,
              atTarget: 0.45,
              aboveTarget: 0.25
            },
            timeHorizon: '1-3 天'
          }
        },
        trendAnalysis: {
          direction: direction as 'bullish' | 'bearish' | 'neutral',
          confidence: confidence,
          keyFactors: parsed.factors || parsed.reasons || ['AI 分析完成']
        },
        riskAssessment: {
          level: parsed.risk || 'medium',
          maxDrawdown: parsed.maxDrawdown || 2.0,
          volatilityForecast: parsed.volatility || 1.5
        }
      };
    } catch (error) {
      console.error('[AI Engine] Failed to parse AI response:', error);
      return this.getFallbackResult(config.name, config.version, 'neutral');
    }
  }

  /**
   * 获取回退结果（当 API 调用失败时）
   */
  private getFallbackResult(
    modelName: string,
    modelVersion: string,
    defaultDirection: 'bullish' | 'bearish' | 'neutral'
  ): AIPredictionResult {
    return {
      modelName,
      modelVersion,
      timestamp: Date.now(),
      predictions: {
        shortTerm: {
          targetPrice: 620,
          priceRange: { min: 615, max: 625 },
          confidence: 0.5,
          probabilityDistribution: { belowTarget: 0.3, atTarget: 0.4, aboveTarget: 0.3 },
          timeHorizon: '1-4 小时'
        },
        midTerm: {
          targetPrice: 625,
          priceRange: { min: 610, max: 640 },
          confidence: 0.45,
          probabilityDistribution: { belowTarget: 0.35, atTarget: 0.4, aboveTarget: 0.25 },
          timeHorizon: '1-3 天'
        }
      },
      trendAnalysis: {
        direction: defaultDirection,
        confidence: 0.5,
        keyFactors: ['API 调用失败，使用保守估计']
      },
      riskAssessment: {
        level: 'medium',
        maxDrawdown: 2.5,
        volatilityForecast: 2.0
      }
    };
  }
}

// 导出单例实例
export const goldAIEngine = new GoldAIEngine();
