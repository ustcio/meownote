// ================================================================================
// 实时金价智能分析系统 - 主入口
// ================================================================================

export * from './types';
export * from './data-collector';
export * from './ai-engine';
export * from './command-system';
export * from './alert-system';

import { goldDataCollector } from './data-collector';
import { goldAIEngine } from './ai-engine';
import { commandSystem } from './command-system';
import { alertSystem, SGE_CONFIG } from './alert-system';
import type {
  GoldPriceData,
  TradingSignal,
  AlertEvent,
  SystemMetrics,
  BacktestResult,
  SGEAlertConfig,
  SGESession,
  Level3AlertEvent,
  AlertSignal,
  SignalFusionResult,
} from './types';

export { SGE_CONFIG };

const SYSTEM_CONFIG: SGEAlertConfig & {
  dataUpdateIntervalMs: number;
  analysisIntervalMs: number;
  alertCheckIntervalMs: number;
  maxSignalAgeMs: number;
} = {
  dataUpdateIntervalMs: 60 * 1000,
  analysisIntervalMs: 2 * 60 * 1000,
  alertCheckIntervalMs: 60 * 1000,
  maxSignalAgeMs: 4 * 60 * 60 * 1000,
  ...SGE_CONFIG,
};

/**
 * 实时金价智能分析系统主类
 */
export class GoldAnalysisSystem {
  private isRunning = false;
  private dataUpdateTimer: ReturnType<typeof setInterval> | null = null;
  private analysisTimer: ReturnType<typeof setInterval> | null = null;
  private alertTimer: ReturnType<typeof setInterval> | null = null;
  private currentData: GoldPriceData | null = null;
  private activeSignals: TradingSignal[] = [];
  private metrics: SystemMetrics = {
    timestamp: Date.now(),
    dataCollection: {
      lastUpdate: 0,
      updateLatency: 0,
      dataQuality: 1,
      sourceReliability: {},
    },
    aiProcessing: {
      lastAnalysis: 0,
      analysisLatency: 0,
      modelPerformance: {},
    },
    alertSystem: {
      alertsGenerated: 0,
      alertsSent: 0,
      deliveryRate: 1,
      avgDeliveryTime: 0,
    },
    tradingEngine: {
      signalsGenerated: 0,
      commandsExecuted: 0,
      successRate: 1,
    },
  };

  /**
   * 启动系统
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[GoldAnalysisSystem] System already running');
      return;
    }

    console.log('[GoldAnalysisSystem] Starting system...');

    // 初始化数据
    await this.updateData();

    // 启动定时任务
    this.startTimers();

    this.isRunning = true;
    console.log('[GoldAnalysisSystem] System started successfully');
  }

  /**
   * 停止系统
   */
  stop(): void {
    if (!this.isRunning) return;

    console.log('[GoldAnalysisSystem] Stopping system...');

    if (this.dataUpdateTimer) clearInterval(this.dataUpdateTimer);
    if (this.analysisTimer) clearInterval(this.analysisTimer);
    if (this.alertTimer) clearInterval(this.alertTimer);

    this.isRunning = false;
    console.log('[GoldAnalysisSystem] System stopped');
  }

  /**
   * 启动定时器
   */
  private startTimers(): void {
    // 数据更新定时器
    this.dataUpdateTimer = setInterval(
      () => this.updateData(),
      SYSTEM_CONFIG.dataUpdateIntervalMs
    );

    // AI分析定时器
    this.analysisTimer = setInterval(
      () => this.runAnalysis(),
      SYSTEM_CONFIG.analysisIntervalMs
    );

    // 预警检查定时器
    this.alertTimer = setInterval(
      () => this.checkAlerts(),
      SYSTEM_CONFIG.alertCheckIntervalMs
    );
  }

  /**
   * 更新数据
   */
  private async updateData(): Promise<void> {
    const startTime = Date.now();

    try {
      const data = await goldDataCollector.fetchRealTimeData();

      if (data) {
        this.currentData = data;
        this.metrics.dataCollection.lastUpdate = Date.now();
        this.metrics.dataCollection.updateLatency = Date.now() - startTime;

        // 获取数据质量报告
        const qualityReport = goldDataCollector.getDataQualityReport();
        this.metrics.dataCollection.dataQuality =
          (qualityReport.completeness +
            qualityReport.accuracy +
            qualityReport.timeliness +
            qualityReport.consistency) / 4;

        console.log('[GoldAnalysisSystem] Data updated:', {
          price: data.domestic.price,
          quality: this.metrics.dataCollection.dataQuality.toFixed(2),
          latency: `${this.metrics.dataCollection.updateLatency}ms`,
        });
      }
    } catch (error) {
      console.error('[GoldAnalysisSystem] Data update failed:', error);
    }
  }

  /**
   * 运行AI分析
   */
  private async runAnalysis(): Promise<void> {
    if (!this.currentData) {
      console.log('[GoldAnalysisSystem] No data available for analysis');
      return;
    }

    const startTime = Date.now();

    try {
      const priceHistory = goldDataCollector.getPriceHistory(24 * 60 * 60 * 1000);

      const analysis = await goldAIEngine.analyzeMarket(
        this.currentData,
        priceHistory
      );

      // 更新活跃信号
      this.activeSignals = analysis.signals.filter(
        signal => signal.expiryTime > Date.now()
      );

      // 更新指标
      this.metrics.aiProcessing.lastAnalysis = Date.now();
      this.metrics.aiProcessing.analysisLatency = Date.now() - startTime;
      this.metrics.tradingEngine.signalsGenerated += analysis.signals.length;

      console.log('[GoldAnalysisSystem] Analysis completed:', {
        signals: analysis.signals.length,
        trend: analysis.trend.trend,
        confidence: analysis.predictions[0]?.predictions.shortTerm.confidence.toFixed(2),
        latency: `${this.metrics.aiProcessing.analysisLatency}ms`,
      });

      // 检查信号预警
      for (const signal of analysis.signals) {
        const alert = alertSystem.checkSignalAlerts(signal);
        if (alert) {
          this.metrics.alertSystem.alertsGenerated++;
        }
      }
    } catch (error) {
      console.error('[GoldAnalysisSystem] Analysis failed:', error);
    }
  }

  /**
   * 检查预警
   */
  private checkAlerts(): void {
    if (!this.currentData) return;

    try {
      const alerts = alertSystem.updatePriceAndCheck(this.currentData);

      if (alerts.length > 0) {
        this.metrics.alertSystem.alertsGenerated += alerts.length;
        console.log('[GoldAnalysisSystem] Level 3 Alerts triggered:', alerts.length);
        
        alerts.forEach(alert => {
          console.log(`[GoldAnalysisSystem] Alert: ${alert.message}`);
          console.log(`  - Session: ${alert.level3Metadata.session}`);
          console.log(`  - Signal Score: ${alert.level3Metadata.signalScore}`);
          console.log(`  - EMA Fast/Slow: ${alert.level3Metadata.emaFast.toFixed(2)}/${alert.level3Metadata.emaSlow.toFixed(2)}`);
        });
      }
    } catch (error) {
      console.error('[GoldAnalysisSystem] Alert check failed:', error);
    }
  }

  /**
   * 获取当前状态
   */
  getStatus(): {
    isRunning: boolean;
    currentPrice: number | null;
    lastUpdate: number;
    activeSignals: number;
    dataQuality: number;
  } {
    return {
      isRunning: this.isRunning,
      currentPrice: this.currentData?.domestic.price || null,
      lastUpdate: this.metrics.dataCollection.lastUpdate,
      activeSignals: this.activeSignals.length,
      dataQuality: this.metrics.dataCollection.dataQuality,
    };
  }

  /**
   * 获取当前数据
   */
  getCurrentData(): GoldPriceData | null {
    return this.currentData;
  }

  /**
   * 获取活跃信号
   */
  getActiveSignals(): TradingSignal[] {
    // 过滤过期信号
    this.activeSignals = this.activeSignals.filter(
      signal => signal.expiryTime > Date.now()
    );
    return this.activeSignals;
  }

  /**
   * 获取系统指标
   */
  getMetrics(): SystemMetrics {
    this.metrics.timestamp = Date.now();
    return { ...this.metrics };
  }

  /**
   * 手动触发分析
   */
  async triggerAnalysis(): Promise<{
    signals: TradingSignal[];
    alerts: AlertEvent[];
  }> {
    await this.runAnalysis();
    this.checkAlerts();

    return {
      signals: this.getActiveSignals(),
      alerts: alertSystem.getAlertHistory(undefined, 10, 'pending'),
    };
  }

  /**
   * 执行回测
   */
  async runBacktest(
    startDate: string,
    endDate: string,
    initialCapital: number = 100000
  ): Promise<BacktestResult> {
    console.log('[GoldAnalysisSystem] Running backtest...', { startDate, endDate });

    // 模拟回测结果
    // 实际实现需要从历史数据中获取价格并模拟交易
    const mockResult: BacktestResult = {
      period: { start: startDate, end: endDate },
      totalSignals: 150,
      successfulSignals: 98,
      failedSignals: 52,
      accuracy: 0.653,
      avgReturn: 2.35,
      maxDrawdown: 5.2,
      sharpeRatio: 1.45,
      winRate: 0.653,
      profitFactor: 1.88,
      byModel: {
        '通义千问': { signals: 60, accuracy: 0.68, avgReturn: 2.5 },
        '豆包': { signals: 55, accuracy: 0.64, avgReturn: 2.2 },
        '技术分析': { signals: 35, accuracy: 0.62, avgReturn: 2.1 },
      },
    };

    return mockResult;
  }

  /**
   * 获取数据质量报告
   */
  getDataQualityReport() {
    return goldDataCollector.getDataQualityReport();
  }

  /**
   * 获取预警统计
   */
  getAlertStatistics(userId?: string) {
    return alertSystem.getStatistics(userId);
  }

  getMarketStatus() {
    return alertSystem.getMarketStatus();
  }

  getSGEConfig(): SGEAlertConfig {
    return SGE_CONFIG;
  }
}

// 导出单例实例
export const goldAnalysisSystem = new GoldAnalysisSystem();

// 默认导出
export default goldAnalysisSystem;
