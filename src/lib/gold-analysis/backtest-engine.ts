// ================================================================================
// 回测引擎模块
// 创建日期：2026-02-19
// 目的：基于真实历史数据验证交易策略有效性
// ================================================================================

import type {
  GoldPriceData,
  PriceHistoryPoint,
  TradingSignal,
  BacktestResult,
  MarketTrendAnalysis,
} from './types';
import { goldAIEngine } from './ai-engine';

// 回测配置
const BACKTEST_CONFIG = {
  initialCapital: 100000,        // 初始资金 (元)
  maxPosition: 0.9,              // 最大仓位比例
  transactionFee: 0.001,         // 交易手续费 (0.1%)
  slippage: 0.002,               // 滑点 (0.2%)
  minHoldingPeriod: 1,           // 最小持仓时间 (小时)
  maxHoldingPeriod: 72,          // 最大持仓时间 (小时)
};

// 交易记录
interface BacktestTrade {
  signalId: string;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice?: number;
  entryTime: number;
  exitTime?: number;
  quantity: number;
  profit?: number;
  profitPercent?: number;
  status: 'open' | 'closed';
}

// 回测状态
interface BacktestState {
  capital: number;               // 可用资金
  position: number;              // 持仓量 (克)
  avgCost: number;               // 平均成本
  trades: BacktestTrade[];
  currentValue: number;          // 当前总资产
}

/**
 * 回测引擎类
 */
export class BacktestEngine {
  /**
   * 运行回测
   */
  async runBacktest(
    startDate: string,
    endDate: string,
    initialCapital: number = BACKTEST_CONFIG.initialCapital
  ): Promise<BacktestResult> {
    console.log('[Backtest] Starting backtest...', { startDate, endDate });

    const state: BacktestState = {
      capital: initialCapital,
      position: 0,
      avgCost: 0,
      trades: [],
      currentValue: initialCapital,
    };

    // 1. 获取历史数据
    const historicalData = await this.getHistoricalData(startDate, endDate);
    
    if (historicalData.length === 0) {
      throw new Error('No historical data available for backtest');
    }

    console.log(`[Backtest] Loaded ${historicalData.length} data points`);

    // 2. 按时间顺序处理数据
    const signals: TradingSignal[] = [];
    const priceMap = new Map<number, number>(); // timestamp -> price

    for (const dataPoint of historicalData) {
      priceMap.set(dataPoint.timestamp, dataPoint.price);

      // 模拟 AI 分析（使用历史数据）
      const signal = await this.generateHistoricalSignal(dataPoint, historicalData);
      
      if (signal) {
        signals.push(signal);
        
        // 执行交易
        await this.executeSignal(signal, state, dataPoint.price);
      }

      // 更新当前价值
      state.currentValue = state.capital + (state.position * dataPoint.price);
    }

    // 3. 平仓所有未平仓位（按期末价格）
    const finalPrice = historicalData[historicalData.length - 1].price;
    await this.closeAllPositions(state, finalPrice, Date.now());

    // 4. 计算统计指标
    const result = this.calculateStatistics(
      state,
      signals,
      historicalData,
      initialCapital,
      startDate,
      endDate
    );

    console.log('[Backtest] Completed:', {
      totalSignals: signals.length,
      accuracy: result.accuracy,
      totalReturn: ((state.currentValue - initialCapital) / initialCapital * 100).toFixed(2) + '%',
    });

    return result;
  }

  /**
   * 获取历史数据
   */
  private async getHistoricalData(
    startDate: string,
    endDate: string
  ): Promise<PriceHistoryPoint[]> {
    // 实际实现需要从 D1 数据库或 KV 存储获取数据
    // 这里使用模拟数据
    
    const points: PriceHistoryPoint[] = [];
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    
    // 模拟生成每小时一个数据点
    let currentTime = start;
    let basePrice = 450; // 基础价格
    
    while (currentTime < end) {
      // 随机价格波动
      const change = (Math.random() - 0.5) * 5;
      basePrice += change;
      
      points.push({
        timestamp: currentTime,
        price: Math.round(basePrice * 100) / 100,
        source: 'historical',
      });
      
      currentTime += 60 * 60 * 1000; // 每小时
    }
    
    return points;
  }

  /**
   * 基于历史数据生成信号
   */
  private async generateHistoricalSignal(
    dataPoint: PriceHistoryPoint,
    allData: PriceHistoryPoint[]
  ): Promise<TradingSignal | null> {
    // 构建模拟的 GoldPriceData
    const currentData: GoldPriceData = {
      timestamp: dataPoint.timestamp,
      date: new Date(dataPoint.timestamp).toISOString().split('T')[0],
      exchangeRate: 7.2,
      domestic: {
        price: dataPoint.price,
        open: dataPoint.price,
        high: dataPoint.price * 1.01,
        low: dataPoint.price * 0.99,
        change: 0,
        changePercent: 0,
      },
      international: {
        price: dataPoint.price * 31.1035 / 7.2,
        open: 0,
        high: 0,
        low: 0,
        change: 0,
        changePercent: 0,
      },
      source: 'historical',
      reliability: 1.0,
    };

    // 使用 AI 引擎生成信号
    const analysis = await goldAIEngine.analyzeMarket(
      currentData,
      allData.slice(-100) // 使用最近 100 个数据点
    );

    // 返回第一个信号（如果有）
    return analysis.signals.length > 0 ? analysis.signals[0] : null;
  }

  /**
   * 执行交易信号
   */
  private async executeSignal(
    signal: TradingSignal,
    state: BacktestState,
    currentPrice: number
  ): Promise<void> {
    // 应用滑点
    const executedPrice = signal.type === 'BUY'
      ? currentPrice * (1 + BACKTEST_CONFIG.slippage)
      : currentPrice * (1 - BACKTEST_CONFIG.slippage);

    if (signal.type === 'BUY') {
      // 买入逻辑
      const maxAffordable = state.capital / executedPrice;
      const targetQuantity = maxAffordable * signal.suggestedPosition;
      const actualQuantity = Math.min(targetQuantity, state.capital / executedPrice);

      if (actualQuantity > 0.01) { // 最小交易量
        const cost = actualQuantity * executedPrice;
        const fee = cost * BACKTEST_CONFIG.transactionFee;

        state.capital -= (cost + fee);
        state.position += actualQuantity;
        
        // 更新平均成本
        const totalCost = state.avgCost * state.position + cost;
        state.avgCost = totalCost / (state.position + actualQuantity);

        state.trades.push({
          signalId: signal.id,
          type: 'BUY',
          entryPrice: executedPrice,
          entryTime: signal.timestamp,
          quantity: actualQuantity,
          status: 'open',
        });

        console.log(`[Backtest] BUY: ${actualQuantity.toFixed(3)}g @ ¥${executedPrice.toFixed(2)}`);
      }
    } else if (signal.type === 'SELL') {
      // 卖出逻辑
      const sellQuantity = state.position * signal.suggestedPosition;

      if (sellQuantity > 0.01 && state.position > 0) {
        const revenue = sellQuantity * executedPrice;
        const fee = revenue * BACKTEST_CONFIG.transactionFee;
        const profit = revenue - fee - (sellQuantity * state.avgCost);

        state.capital += (revenue - fee);
        state.position -= sellQuantity;

        // 更新未平仓交易
        const openTrades = state.trades.filter(t => t.status === 'open' && t.type === 'BUY');
        for (const trade of openTrades) {
          trade.exitPrice = executedPrice;
          trade.exitTime = signal.timestamp;
          trade.profit = profit * (trade.quantity / state.position);
          trade.profitPercent = ((executedPrice - trade.entryPrice) / trade.entryPrice) * 100;
          trade.status = 'closed';
          break; // 只平最早的交易
        }

        console.log(`[Backtest] SELL: ${sellQuantity.toFixed(3)}g @ ¥${executedPrice.toFixed(2)}, Profit: ¥${profit.toFixed(2)}`);
      }
    }
  }

  /**
   * 平仓所有未平仓位
   */
  private async closeAllPositions(
    state: BacktestState,
    exitPrice: number,
    timestamp: number
  ): Promise<void> {
    if (state.position > 0) {
      const revenue = state.position * exitPrice;
      const fee = revenue * BACKTEST_CONFIG.transactionFee;
      const profit = revenue - fee - (state.position * state.avgCost);

      state.capital += (revenue - fee);

      // 更新未平仓交易
      const openTrades = state.trades.filter(t => t.status === 'open');
      for (const trade of openTrades) {
        trade.exitPrice = exitPrice;
        trade.exitTime = timestamp;
        trade.profit = profit * (trade.quantity / state.position);
        trade.profitPercent = ((exitPrice - trade.entryPrice) / trade.entryPrice) * 100;
        trade.status = 'closed';
      }

      console.log(`[Backtest] Closing all positions: ${state.position.toFixed(3)}g @ ¥${exitPrice.toFixed(2)}, Total Profit: ¥${profit.toFixed(2)}`);
      
      state.position = 0;
      state.avgCost = 0;
    }
  }

  /**
   * 计算统计指标
   */
  private calculateStatistics(
    state: BacktestState,
    signals: TradingSignal[],
    priceData: PriceHistoryPoint[],
    initialCapital: number,
    startDate: string,
    endDate: string
  ): BacktestResult {
    const closedTrades = state.trades.filter(t => t.status === 'closed');
    
    // 计算胜率
    const winningTrades = closedTrades.filter(t => (t.profit || 0) > 0);
    const winRate = closedTrades.length > 0 
      ? winningTrades.length / closedTrades.length 
      : 0;

    // 计算总收益
    const totalReturn = ((state.currentValue - initialCapital) / initialCapital) * 100;

    // 计算平均收益
    const avgReturn = closedTrades.length > 0
      ? closedTrades.reduce((sum, t) => sum + (t.profitPercent || 0), 0) / closedTrades.length
      : 0;

    // 计算最大回撤
    const maxDrawdown = this.calculateMaxDrawdown(state.trades, initialCapital);

    // 计算夏普比率（简化版）
    const sharpeRatio = this.calculateSharpeRatio(state.trades, initialCapital);

    // 计算盈亏比
    const grossProfit = winningTrades.reduce((sum, t) => sum + Math.abs(t.profit || 0), 0);
    const grossLoss = Math.abs(
      closedTrades.filter(t => (t.profit || 0) < 0)
        .reduce((sum, t) => sum + (t.profit || 0), 0)
    );
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;

    // 按模型分类统计
    const byModel: Record<string, { signals: number; accuracy: number; avgReturn: number }> = {};
    const modelSignals = new Map<string, TradingSignal[]>();
    
    signals.forEach(signal => {
      const modelName = signal.metadata?.marketContext || 'unknown';
      if (!modelSignals.has(modelName)) {
        modelSignals.set(modelName, []);
      }
      modelSignals.get(modelName)!.push(signal);
    });

    modelSignals.forEach((modelSignals, modelName) => {
      const modelTrades = closedTrades.filter(t => 
        modelSignals.some(s => s.id === t.signalId)
      );
      const modelWinning = modelTrades.filter(t => (t.profit || 0) > 0);
      
      byModel[modelName] = {
        signals: modelSignals.length,
        accuracy: modelTrades.length > 0 ? modelWinning.length / modelTrades.length : 0,
        avgReturn: modelTrades.length > 0 
          ? modelTrades.reduce((sum, t) => sum + (t.profitPercent || 0), 0) / modelTrades.length 
          : 0,
      };
    });

    return {
      period: { start: startDate, end: endDate },
      totalSignals: signals.length,
      successfulSignals: winningTrades.length,
      failedSignals: closedTrades.length - winningTrades.length,
      accuracy: winRate,
      avgReturn,
      maxDrawdown,
      sharpeRatio,
      winRate,
      profitFactor,
      byModel,
    };
  }

  /**
   * 计算最大回撤
   */
  private calculateMaxDrawdown(trades: BacktestTrade[], initialCapital: number): number {
    let peak = initialCapital;
    let maxDrawdown = 0;
    let currentValue = initialCapital;

    for (const trade of trades) {
      if (trade.status === 'closed') {
        currentValue += trade.profit || 0;
        
        if (currentValue > peak) {
          peak = currentValue;
        }
        
        const drawdown = (peak - currentValue) / peak;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }
      }
    }

    return maxDrawdown * 100; // 转换为百分比
  }

  /**
   * 计算夏普比率
   */
  private calculateSharpeRatio(trades: BacktestTrade[], initialCapital: number): number {
    const riskFreeRate = 0.03; // 无风险利率 3%
    
    if (trades.length < 2) return 0;

    const returns = trades
      .filter(t => t.status === 'closed' && t.profitPercent !== undefined)
      .map(t => t.profitPercent! / 100);

    if (returns.length === 0) return 0;

    // 计算平均收益
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;

    // 计算标准差
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    // 年化夏普比率（假设每日交易）
    const annualizedReturn = avgReturn * 365;
    const annualizedStdDev = stdDev * Math.sqrt(365);

    return annualizedStdDev > 0 
      ? (annualizedReturn - riskFreeRate) / annualizedStdDev 
      : 0;
  }
}

// 导出单例实例
export const backtestEngine = new BacktestEngine();
