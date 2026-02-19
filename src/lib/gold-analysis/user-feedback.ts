// ================================================================================
// 用户反馈机制模块
// 创建日期：2026-02-19
// 目的：收集用户对 AI 信号的反馈，持续优化信号质量和用户满意度
// ================================================================================

import type { TradingSignal } from './types';

// 反馈配置
const FEEDBACK_CONFIG = {
  maxHistorySize: 500,          // 最大反馈记录数
  minFeedbackForOptimization: 20, // 触发优化的最小反馈数
  optimizationInterval: 86400000, // 优化间隔（24 小时）
  weightAdjustmentFactor: 0.1,    // 权重调整因子
};

// 用户反馈数据结构
export interface UserFeedback {
  id: string;
  signalId: string;
  userId: string;
  timestamp: number;
  
  // 用户行为
  action: 'followed' | 'ignored' | 'partial';  // 跟随/忽略/部分跟随
  
  // 评分（1-5 星）
  rating: 1 | 2 | 3 | 4 | 5;
  
  // 实际结果
  profitLoss?: number;            // 实际盈亏 (元)
  profitLossPercent?: number;     // 盈亏百分比
  holdingPeriod?: number;         // 持仓时间 (小时)
  
  // 反馈详情
  comment?: string;               // 用户备注
  tags: string[];                 // 标签（如：'及时', '准确', '保守' 等）
  
  // 信号快照
  signalSnapshot: {
    type: 'BUY' | 'SELL';
    confidence: number;
    targetPrice?: number;
    stopLoss?: number;
    suggestedPosition: number;
  };
}

// 反馈统计
export interface FeedbackStatistics {
  totalFeedback: number;
  byAction: {
    followed: number;
    ignored: number;
    partial: number;
  };
  avgRating: number;
  ratingDistribution: Record<number, number>;
  followRate: number;
  profitableRate: number;
  avgProfitLoss: number;
  avgHoldingPeriod: number;
  bySignalType: {
    BUY: { count: number; avgRating: number; profitableRate: number };
    SELL: { count: number; avgRating: number; profitableRate: number };
  };
  trend: {
    date: string;
    avgRating: number;
    followRate: number;
  }[];
}

// 优化建议
export interface OptimizationSuggestion {
  type: 'confidence_threshold' | 'position_size' | 'signal_frequency' | 'risk_level';
  current: any;
  suggested: any;
  reason: string;
  expectedImprovement: string;
  confidence: number;
}

/**
 * 用户反馈管理器
 */
export class UserFeedbackManager {
  private feedbackHistory: UserFeedback[] = [];
  private lastOptimizationTime = 0;
  private userRatings = new Map<string, UserFeedback[]>(); // userId -> feedback[]

  /**
   * 提交用户反馈
   */
  submitFeedback(feedback: Omit<UserFeedback, 'id' | 'timestamp'>): UserFeedback {
    const completeFeedback: UserFeedback = {
      ...feedback,
      id: this.generateFeedbackId(),
      timestamp: Date.now(),
    };

    this.feedbackHistory.push(completeFeedback);
    
    // 限制历史记录大小
    if (this.feedbackHistory.length > FEEDBACK_CONFIG.maxHistorySize) {
      this.feedbackHistory.shift();
    }

    // 按用户组织反馈
    if (!this.userRatings.has(feedback.userId)) {
      this.userRatings.set(feedback.userId, []);
    }
    this.userRatings.get(feedback.userId)!.push(completeFeedback);

    // 检查是否需要优化
    this.checkAndOptimize();

    return completeFeedback;
  }

  /**
   * 获取反馈统计
   */
  getStatistics(timeRange?: '7d' | '30d' | 'all'): FeedbackStatistics {
    let filteredFeedback = this.feedbackHistory;

    // 按时间范围过滤
    if (timeRange) {
      const now = Date.now();
      const cutoffTime = {
        '7d': now - 7 * 24 * 3600000,
        '30d': now - 30 * 24 * 3600000,
        'all': 0,
      }[timeRange];

      filteredFeedback = filteredFeedback.filter(f => f.timestamp > cutoffTime);
    }

    // 计算统计指标
    const totalFeedback = filteredFeedback.length;
    const byAction = {
      followed: filteredFeedback.filter(f => f.action === 'followed').length,
      ignored: filteredFeedback.filter(f => f.action === 'ignored').length,
      partial: filteredFeedback.filter(f => f.action === 'partial').length,
    };

    // 平均评分
    const avgRating = totalFeedback > 0
      ? filteredFeedback.reduce((sum, f) => sum + f.rating, 0) / totalFeedback
      : 0;

    // 评分分布
    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    filteredFeedback.forEach(f => {
      ratingDistribution[f.rating]++;
    });

    // 跟随率
    const followRate = totalFeedback > 0 ? byAction.followed / totalFeedback : 0;

    // 盈利率
    const feedbackWithPL = filteredFeedback.filter(f => f.profitLoss !== undefined);
    const profitableFeedback = feedbackWithPL.filter(f => (f.profitLoss || 0) > 0);
    const profitableRate = feedbackWithPL.length > 0
      ? profitableFeedback.length / feedbackWithPL.length
      : 0;

    // 平均盈亏
    const avgProfitLoss = feedbackWithPL.length > 0
      ? feedbackWithPL.reduce((sum, f) => sum + (f.profitLoss || 0), 0) / feedbackWithPL.length
      : 0;

    // 平均持仓时间
    const feedbackWithHolding = filteredFeedback.filter(f => f.holdingPeriod !== undefined);
    const avgHoldingPeriod = feedbackWithHolding.length > 0
      ? feedbackWithHolding.reduce((sum, f) => sum + (f.holdingPeriod || 0), 0) / feedbackWithHolding.length
      : 0;

    // 按信号类型统计
    const buyFeedback = filteredFeedback.filter(f => f.signalSnapshot.type === 'BUY');
    const sellFeedback = filteredFeedback.filter(f => f.signalSnapshot.type === 'SELL');

    const bySignalType = {
      BUY: {
        count: buyFeedback.length,
        avgRating: buyFeedback.length > 0
          ? buyFeedback.reduce((sum, f) => sum + f.rating, 0) / buyFeedback.length
          : 0,
        profitableRate: this.calculateProfitableRate(buyFeedback),
      },
      SELL: {
        count: sellFeedback.length,
        avgRating: sellFeedback.length > 0
          ? sellFeedback.reduce((sum, f) => sum + f.rating, 0) / sellFeedback.length
          : 0,
        profitableRate: this.calculateProfitableRate(sellFeedback),
      },
    };

    // 趋势数据（最近 7 天）
    const trend = this.calculateTrend(filteredFeedback);

    return {
      totalFeedback,
      byAction,
      avgRating,
      ratingDistribution,
      followRate,
      profitableRate,
      avgProfitLoss,
      avgHoldingPeriod,
      bySignalType,
      trend,
    };
  }

  /**
   * 获取优化建议
   */
  getOptimizationSuggestions(): OptimizationSuggestion[] {
    const stats = this.getStatistics('30d');
    const suggestions: OptimizationSuggestion[] = [];

    // 1. 置信度阈值优化
    if (stats.followRate < 0.5 && stats.avgRating > 4.0) {
      suggestions.push({
        type: 'confidence_threshold',
        current: 0.65,
        suggested: 0.60,
        reason: '跟随率偏低但评分较高，建议降低置信度阈值以增加信号数量',
        expectedImprovement: '跟随率提升 10-15%',
        confidence: 0.75,
      });
    } else if (stats.followRate > 0.8 && stats.profitableRate < 0.6) {
      suggestions.push({
        type: 'confidence_threshold',
        current: 0.65,
        suggested: 0.70,
        reason: '跟随率高但盈利率低，建议提高置信度阈值以提升信号质量',
        expectedImprovement: '盈利率提升 8-12%',
        confidence: 0.80,
      });
    }

    // 2. 仓位建议优化
    const avgPositionFeedback = stats.byAction.followed > 0
      ? this.feedbackHistory
          .filter(f => f.action === 'followed' && f.profitLossPercent !== undefined)
          .map(f => ({
            position: f.signalSnapshot.suggestedPosition,
            profit: f.profitLossPercent || 0,
          }));

    if (avgPositionFeedback && avgPositionFeedback.length > 10) {
      const highPosition = avgPositionFeedback.filter(p => p.position > 0.7);
      const lowPosition = avgPositionFeedback.filter(p => p.position < 0.4);

      const highPositionAvgProfit = highPosition.length > 0
        ? highPosition.reduce((sum, p) => sum + p.profit, 0) / highPosition.length
        : 0;

      const lowPositionAvgProfit = lowPosition.length > 0
        ? lowPosition.reduce((sum, p) => sum + p.profit, 0) / lowPosition.length
        : 0;

      if (highPositionAvgProfit < 0 && highPosition.length > 5) {
        suggestions.push({
          type: 'position_size',
          current: '0.7-0.9',
          suggested: '0.5-0.7',
          reason: '高仓位信号平均亏损，建议降低最大仓位建议',
          expectedImprovement: '减少亏损风险 15-20%',
          confidence: 0.70,
        });
      }
    }

    // 3. 信号频率优化
    const dailyFeedbackCount = stats.totalFeedback / 30; // 日均反馈数
    if (dailyFeedbackCount > 10 && stats.avgRating < 3.5) {
      suggestions.push({
        type: 'signal_frequency',
        current: '高频（>10 条/天）',
        suggested: '中频（5-8 条/天）',
        reason: '信号过多导致质量下降，用户评分偏低',
        expectedImprovement: '平均评分提升 0.5-1.0 分',
        confidence: 0.65,
      });
    }

    // 4. 风险等级优化
    const lowRatingFeedback = stats.ratingDistribution[1] + stats.ratingDistribution[2];
    if (lowRatingFeedback > stats.totalFeedback * 0.2) {
      suggestions.push({
        type: 'risk_level',
        current: '中等风险',
        suggested: '保守策略',
        reason: '低评分占比较高，建议采用更保守的策略',
        expectedImprovement: '用户满意度提升 15-25%',
        confidence: 0.70,
      });
    }

    return suggestions;
  }

  /**
   * 获取用户反馈历史
   */
  getUserFeedback(userId: string, limit: number = 50): UserFeedback[] {
    const userFeedback = this.userRatings.get(userId) || [];
    return userFeedback.slice(-limit);
  }

  /**
   * 获取信号反馈
   */
  getSignalFeedback(signalId: string): UserFeedback | null {
    return this.feedbackHistory.find(f => f.signalId === signalId) || null;
  }

  /**
   * 清除用户数据（GDPR 合规）
   */
  clearUserData(userId: string): void {
    // 清除用户反馈
    this.userRatings.delete(userId);
    
    // 匿名化反馈历史中的用户数据
    this.feedbackHistory.forEach(f => {
      if (f.userId === userId) {
        f.userId = 'anonymous';
      }
    });
  }

  /**
   * 导出反馈数据
   */
  exportFeedbackData(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.feedbackHistory, null, 2);
    } else {
      // CSV 格式
      const headers = ['id', 'signalId', 'userId', 'timestamp', 'action', 'rating', 'profitLoss', 'comment'];
      const rows = this.feedbackHistory.map(f => 
        headers.map(h => (f as any)[h] || '').join(',')
      );
      return [headers.join(','), ...rows].join('\n');
    }
  }

  /**
   * 检查并执行优化
   */
  private checkAndOptimize(): void {
    const now = Date.now();
    const totalFeedback = this.feedbackHistory.length;

    if (totalFeedback >= FEEDBACK_CONFIG.minFeedbackForOptimization &&
        now - this.lastOptimizationTime >= FEEDBACK_CONFIG.optimizationInterval) {
      
      this.lastOptimizationTime = now;
      
      // 触发优化事件
      const suggestions = this.getOptimizationSuggestions();
      if (suggestions.length > 0) {
        console.log('[UserFeedback] Optimization suggestions available:', suggestions.length);
        // 这里可以触发回调或发送通知
      }
    }
  }

  /**
   * 计算盈利率
   */
  private calculateProfitableRate(feedback: UserFeedback[]): number {
    const withPL = feedback.filter(f => f.profitLoss !== undefined);
    if (withPL.length === 0) return 0;
    
    const profitable = withPL.filter(f => (f.profitLoss || 0) > 0);
    return profitable.length / withPL.length;
  }

  /**
   * 计算趋势数据
   */
  private calculateTrend(feedback: UserFeedback[]): Array<{ date: string; avgRating: number; followRate: number }> {
    const trend: Array<{ date: string; avgRating: number; followRate: number }> = [];
    const now = Date.now();
    const dayMs = 24 * 3600000;

    // 最近 7 天
    for (let i = 6; i >= 0; i--) {
      const dayStart = now - i * dayMs;
      const dayEnd = dayStart + dayMs;

      const dayFeedback = feedback.filter(f => 
        f.timestamp >= dayStart && f.timestamp < dayEnd
      );

      if (dayFeedback.length > 0) {
        const avgRating = dayFeedback.reduce((sum, f) => sum + f.rating, 0) / dayFeedback.length;
        const followRate = dayFeedback.filter(f => f.action === 'followed').length / dayFeedback.length;

        trend.push({
          date: new Date(dayStart).toISOString().split('T')[0],
          avgRating: Math.round(avgRating * 100) / 100,
          followRate: Math.round(followRate * 100) / 100,
        });
      }
    }

    return trend;
  }

  /**
   * 生成反馈 ID
   */
  private generateFeedbackId(): string {
    return `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 导出单例实例
export const userFeedbackManager = new UserFeedbackManager();

// 默认导出
export default {
  UserFeedbackManager,
  userFeedbackManager,
  FEEDBACK_CONFIG,
};
