// ================================================================================
// API 集成示例 - 展示如何在现有系统中使用新的分析模块
// ================================================================================

import { goldAnalysisSystem, goldDataCollector, goldAIEngine, alertSystem, commandSystem } from './index';
import type { GoldPriceData, TradingSignal, AlertConfiguration } from './types';

/**
 * 初始化智能分析系统
 * 在应用启动时调用
 */
export async function initializeGoldAnalysisSystem(): Promise<void> {
  console.log('[API Integration] Initializing Gold Analysis System...');

  // 启动系统
  await goldAnalysisSystem.start();

  // 创建默认预警配置 (示例)
  const defaultAlertConfig: Omit<AlertConfiguration, 'id' | 'createdAt' | 'updatedAt'> = {
    userId: 'default',
    alertType: 'price_target',
    conditions: {
      targetPrice: 620, // 示例目标价格
      confidenceThreshold: 0.7,
    },
    tolerance: {
      buy: 2.0,
      sell: 2.0,
    },
    notification: {
      channels: ['push'],
      frequency: 'immediate',
    },
    isActive: true,
  };

  alertSystem.createConfiguration(defaultAlertConfig);

  console.log('[API Integration] Gold Analysis System initialized');
}

/**
 * 获取实时金价和分析数据
 * 用于前端展示
 */
export async function getGoldPriceWithAnalysis(): Promise<{
  price: GoldPriceData | null;
  analysis: {
    trend: string;
    signals: TradingSignal[];
    predictions: {
      shortTerm: { min: number; max: number; confidence: number };
      midTerm: { min: number; max: number; confidence: number };
    };
  } | null;
}> {
  // 获取当前数据
  const price = goldAnalysisSystem.getCurrentData();

  // 获取活跃信号
  const signals = goldAnalysisSystem.getActiveSignals();

  // 获取系统指标
  const metrics = goldAnalysisSystem.getMetrics();

  // 构建分析结果
  let analysis = null;
  if (signals.length > 0) {
    const latestSignal = signals[0];
    analysis = {
      trend: latestSignal.metadata.marketContext,
      signals: signals,
      predictions: {
        shortTerm: {
          min: latestSignal.targetPrice ? latestSignal.targetPrice * 0.99 : 0,
          max: latestSignal.targetPrice ? latestSignal.targetPrice * 1.01 : 0,
          confidence: latestSignal.confidence,
        },
        midTerm: {
          min: latestSignal.targetPrice ? latestSignal.targetPrice * 0.95 : 0,
          max: latestSignal.targetPrice ? latestSignal.targetPrice * 1.05 : 0,
          confidence: latestSignal.confidence * 0.9,
        },
      },
    };
  }

  return { price, analysis };
}

/**
 * 创建价格预警
 * 用户设置预警时调用
 */
export function createPriceAlert(
  userId: string,
  alertType: 'buy' | 'sell',
  targetPrice: number,
  tolerance?: number
): AlertConfiguration {
  const config = alertSystem.createConfiguration({
    userId,
    alertType: 'price_target',
    conditions: {
      targetPrice,
    },
    tolerance: {
      buy: tolerance || 2.0,
      sell: tolerance || 2.0,
    },
    notification: {
      channels: ['push'],
      frequency: 'immediate',
    },
    isActive: true,
  });

  console.log(`[API Integration] Created ${alertType} alert at ¥${targetPrice} for user ${userId}`);

  return config;
}

/**
 * 获取交易建议
 * 用户请求交易建议时调用
 */
export async function getTradingAdvice(
  currentPrice: number,
  userRiskLevel: 'low' | 'medium' | 'high' = 'medium'
): Promise<{
  recommendation: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
  suggestedPriceRange: { min: number; max: number };
  riskLevel: 'low' | 'medium' | 'high';
  suggestedPosition: number;
}> {
  // 获取活跃信号
  const signals = goldAnalysisSystem.getActiveSignals();

  // 过滤符合用户风险偏好的信号
  const suitableSignals = signals.filter(signal => {
    if (userRiskLevel === 'low') return signal.riskLevel === 'low';
    if (userRiskLevel === 'medium') return signal.riskLevel !== 'high';
    return true; // high risk accepts all
  });

  if (suitableSignals.length === 0) {
    return {
      recommendation: 'HOLD',
      confidence: 0.5,
      reasoning: '当前市场信号不明确，建议观望',
      suggestedPriceRange: { min: currentPrice * 0.99, max: currentPrice * 1.01 },
      riskLevel: 'low',
      suggestedPosition: 0,
    };
  }

  // 选择置信度最高的信号
  const bestSignal = suitableSignals.reduce((best, current) =>
    current.confidence > best.confidence ? current : best
  );

  return {
    recommendation: bestSignal.type,
    confidence: bestSignal.confidence,
    reasoning: bestSignal.reasoning,
    suggestedPriceRange: {
      min: bestSignal.targetPrice ? bestSignal.targetPrice * 0.995 : currentPrice * 0.995,
      max: bestSignal.targetPrice ? bestSignal.targetPrice * 1.005 : currentPrice * 1.005,
    },
    riskLevel: bestSignal.riskLevel,
    suggestedPosition: bestSignal.suggestedPosition,
  };
}

/**
 * 执行交易指令
 * 用户确认交易时调用
 */
export async function executeTrade(
  signal: TradingSignal,
  quantity?: number
): Promise<{
  success: boolean;
  commandId?: string;
  error?: string;
}> {
  try {
    // 生成交易指令
    const command = commandSystem.generateCommand(signal, {
      quantity,
    });

    // 执行指令
    const result = await commandSystem.executeCommand(command);

    if (result.success) {
      console.log(`[API Integration] Trade executed successfully: ${command.id}`);
      return {
        success: true,
        commandId: command.id,
      };
    } else {
      console.error(`[API Integration] Trade execution failed: ${result.error}`);
      return {
        success: false,
        error: result.error,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[API Integration] Trade execution error: ${errorMessage}`);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 获取系统状态
 * 用于管理后台监控
 */
export function getSystemStatus(): {
  isRunning: boolean;
  currentPrice: number | null;
  lastUpdate: string;
  activeSignals: number;
  dataQuality: number;
  health: string;
} {
  const status = goldAnalysisSystem.getStatus();
  const health = goldAnalysisSystem.getMetrics();

  return {
    isRunning: status.isRunning,
    currentPrice: status.currentPrice,
    lastUpdate: new Date(status.lastUpdate).toLocaleString('zh-CN'),
    activeSignals: status.activeSignals,
    dataQuality: Math.round(status.dataQuality * 100),
    health: health.dataCollection.dataQuality > 0.8 ? '健康' : '需关注',
  };
}

/**
 * 手动触发分析
 * 用于测试或紧急分析
 */
export async function triggerManualAnalysis(): Promise<{
  success: boolean;
  signals: number;
  alerts: number;
  timestamp: string;
}> {
  try {
    const result = await goldAnalysisSystem.triggerAnalysis();

    return {
      success: true,
      signals: result.signals.length,
      alerts: result.alerts.length,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[API Integration] Manual analysis failed:', error);
    return {
      success: false,
      signals: 0,
      alerts: 0,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * 获取数据质量报告
 * 用于数据监控
 */
export function getDataQualityReport(): {
  completeness: number;
  accuracy: number;
  timeliness: number;
  consistency: number;
  overall: number;
  issues: string[];
} {
  const report = goldAnalysisSystem.getDataQualityReport();

  return {
    completeness: Math.round(report.completeness * 100),
    accuracy: Math.round(report.accuracy * 100),
    timeliness: Math.round(report.timeliness * 100),
    consistency: Math.round(report.consistency * 100),
    overall: Math.round(
      (report.completeness +
        report.accuracy +
        report.timeliness +
        report.consistency) /
        4 *
        100
    ),
    issues: report.issues.map(i => i.description),
  };
}

/**
 * 运行回测
 * 用于策略验证
 */
export async function runBacktest(
  startDate: string,
  endDate: string
): Promise<{
  accuracy: number;
  winRate: number;
  avgReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  totalSignals: number;
}> {
  const result = await goldAnalysisSystem.runBacktest(startDate, endDate);

  return {
    accuracy: Math.round(result.accuracy * 100),
    winRate: Math.round(result.winRate * 100),
    avgReturn: result.avgReturn,
    maxDrawdown: result.maxDrawdown,
    sharpeRatio: result.sharpeRatio,
    totalSignals: result.totalSignals,
  };
}

// ================================================================================
// 与现有系统的集成点
// ================================================================================

/**
 * 集成到现有的金价页面
 * 在 kit/gold.astro 中使用
 */
export async function integrateWithGoldPage(): Promise<void> {
  // 获取数据
  const { price, analysis } = await getGoldPriceWithAnalysis();

  if (price && analysis) {
    // 更新页面显示
    console.log('Current Price:', price.domestic.price);
    console.log('Trend:', analysis.trend);
    console.log('Active Signals:', analysis.signals.length);
  }
}

/**
 * 集成到交易页面
 * 在 trading.astro 中使用
 */
export async function integrateWithTradingPage(userId: string): Promise<void> {
  // 获取交易建议
  const currentPrice = goldAnalysisSystem.getCurrentData()?.domestic.price || 0;
  const advice = await getTradingAdvice(currentPrice, 'medium');

  console.log('Trading Advice:', advice);

  // 获取用户预警
  const stats = goldAnalysisSystem.getAlertStatistics(userId);
  console.log('User Alert Stats:', stats);
}

/**
 * Cloudflare Worker 集成示例
 * 在 works.js 中使用
 */
export async function handleAnalysisRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    switch (path) {
      case '/api/analysis':
        const { price, analysis } = await getGoldPriceWithAnalysis();
        return new Response(JSON.stringify({ price, analysis }), {
          headers: { 'Content-Type': 'application/json' },
        });

      case '/api/analysis/trigger':
        const result = await triggerManualAnalysis();
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        });

      case '/api/analysis/status':
        const status = getSystemStatus();
        return new Response(JSON.stringify(status), {
          headers: { 'Content-Type': 'application/json' },
        });

      case '/api/analysis/quality':
        const quality = getDataQualityReport();
        return new Response(JSON.stringify(quality), {
          headers: { 'Content-Type': 'application/json' },
        });

      default:
        return new Response('Not Found', { status: 404 });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
