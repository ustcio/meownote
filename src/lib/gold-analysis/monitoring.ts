// ================================================================================
// 性能监控与可靠性模块
// ================================================================================

import type { SystemMetrics, DataQualityReport } from './types';

// 监控配置
const MONITORING_CONFIG = {
  metricsRetentionMs: 7 * 24 * 60 * 60 * 1000, // 7天
  alertThresholds: {
    dataLatency: 10000, // 10秒
    analysisLatency: 5000, // 5秒
    errorRate: 0.05, // 5%
    dataQuality: 0.8, // 80%
  },
  healthCheckIntervalMs: 30000, // 30秒
  recoveryAttempts: 3,
};

// 系统健康状态
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: Record<string, {
    status: 'up' | 'down' | 'degraded';
    lastCheck: number;
    latency: number;
    errorRate: number;
  }>;
  overallScore: number; // 0-100
  issues: string[];
}

// 性能指标历史
interface MetricsHistory {
  timestamp: number;
  dataUpdateLatency: number;
  analysisLatency: number;
  alertDeliveryTime: number;
  successRate: number;
  errorCount: number;
}

/**
 * 监控系统类
 */
export class MonitoringSystem {
  private metricsHistory: MetricsHistory[] = [];
  private healthStatus: HealthStatus = {
    status: 'healthy',
    components: {},
    overallScore: 100,
    issues: [],
  };
  private alertCallbacks: Array<(issue: string) => void> = [];
  private recoveryStrategies: Map<string, () => Promise<boolean>> = new Map();
  private isMonitoring = false;
  private monitorTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * 启动监控
   */
  start(): void {
    if (this.isMonitoring) return;

    console.log('[MonitoringSystem] Starting monitoring...');
    this.isMonitoring = true;

    this.monitorTimer = setInterval(
      () => this.runHealthCheck(),
      MONITORING_CONFIG.healthCheckIntervalMs
    );

    // 立即执行一次检查
    this.runHealthCheck();
  }

  /**
   * 停止监控
   */
  stop(): void {
    if (!this.isMonitoring) return;

    console.log('[MonitoringSystem] Stopping monitoring...');
    this.isMonitoring = false;

    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }
  }

  /**
   * 记录指标
   */
  recordMetrics(metrics: Partial<MetricsHistory>): void {
    const entry: MetricsHistory = {
      timestamp: Date.now(),
      dataUpdateLatency: metrics.dataUpdateLatency || 0,
      analysisLatency: metrics.analysisLatency || 0,
      alertDeliveryTime: metrics.alertDeliveryTime || 0,
      successRate: metrics.successRate || 1,
      errorCount: metrics.errorCount || 0,
    };

    this.metricsHistory.push(entry);

    // 清理过期数据
    this.cleanupOldMetrics();

    // 检查阈值
    this.checkThresholds(entry);
  }

  /**
   * 运行健康检查
   */
  private async runHealthCheck(): Promise<void> {
    const components = ['dataCollector', 'aiEngine', 'alertSystem', 'commandSystem'];
    const newStatus: HealthStatus = {
      status: 'healthy',
      components: {},
      overallScore: 100,
      issues: [],
    };

    for (const component of components) {
      const check = await this.checkComponent(component);
      newStatus.components[component] = check;

      if (check.status === 'down') {
        newStatus.issues.push(`Component ${component} is down`);
        // 尝试自动恢复
        await this.attemptRecovery(component);
      } else if (check.status === 'degraded') {
        newStatus.issues.push(`Component ${component} is degraded`);
      }
    }

    // 计算整体健康分数
    const scores = Object.values(newStatus.components).map(c =>
      c.status === 'up' ? 100 : c.status === 'degraded' ? 50 : 0
    );
    newStatus.overallScore = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;

    // 确定整体状态
    if (newStatus.overallScore < 50) {
      newStatus.status = 'unhealthy';
    } else if (newStatus.overallScore < 80) {
      newStatus.status = 'degraded';
    }

    this.healthStatus = newStatus;

    // 如果有问题，发送告警
    if (newStatus.issues.length > 0) {
      this.notifyIssues(newStatus.issues);
    }
  }

  /**
   * 检查组件状态
   */
  private async checkComponent(component: string): Promise<HealthStatus['components'][string]> {
    const startTime = Date.now();

    try {
      // 模拟组件检查
      // 实际实现中应该调用各组件的健康检查方法
      const isHealthy = await this.simulateComponentCheck(component);

      const latency = Date.now() - startTime;

      // 计算错误率 (基于最近100个指标)
      const recentMetrics = this.metricsHistory.slice(-100);
      const errorRate = recentMetrics.length > 0
        ? recentMetrics.filter(m => m.errorCount > 0).length / recentMetrics.length
        : 0;

      let status: 'up' | 'down' | 'degraded' = 'up';

      if (!isHealthy) {
        status = 'down';
      } else if (latency > MONITORING_CONFIG.alertThresholds.dataLatency ||
                 errorRate > MONITORING_CONFIG.alertThresholds.errorRate) {
        status = 'degraded';
      }

      return {
        status,
        lastCheck: Date.now(),
        latency,
        errorRate,
      };
    } catch (error) {
      return {
        status: 'down',
        lastCheck: Date.now(),
        latency: Date.now() - startTime,
        errorRate: 1,
      };
    }
  }

  /**
   * 模拟组件检查
   */
  private async simulateComponentCheck(component: string): Promise<boolean> {
    // 实际实现中应该调用真实的健康检查
    return true;
  }

  /**
   * 尝试自动恢复
   */
  private async attemptRecovery(component: string): Promise<boolean> {
    console.log(`[MonitoringSystem] Attempting recovery for ${component}...`);

    const strategy = this.recoveryStrategies.get(component);
    if (!strategy) {
      console.log(`[MonitoringSystem] No recovery strategy for ${component}`);
      return false;
    }

    for (let attempt = 1; attempt <= MONITORING_CONFIG.recoveryAttempts; attempt++) {
      console.log(`[MonitoringSystem] Recovery attempt ${attempt}/${MONITORING_CONFIG.recoveryAttempts}...`);

      try {
        const success = await strategy();
        if (success) {
          console.log(`[MonitoringSystem] Recovery successful for ${component}`);
          return true;
        }
      } catch (error) {
        console.error(`[MonitoringSystem] Recovery attempt ${attempt} failed:`, error);
      }

      // 等待后重试
      if (attempt < MONITORING_CONFIG.recoveryAttempts) {
        await this.delay(5000 * attempt);
      }
    }

    console.error(`[MonitoringSystem] Recovery failed for ${component} after ${MONITORING_CONFIG.recoveryAttempts} attempts`);
    return false;
  }

  /**
   * 注册恢复策略
   */
  registerRecoveryStrategy(component: string, strategy: () => Promise<boolean>): void {
    this.recoveryStrategies.set(component, strategy);
  }

  /**
   * 检查阈值
   */
  private checkThresholds(metrics: MetricsHistory): void {
    const issues: string[] = [];

    if (metrics.dataUpdateLatency > MONITORING_CONFIG.alertThresholds.dataLatency) {
      issues.push(`Data update latency too high: ${metrics.dataUpdateLatency}ms`);
    }

    if (metrics.analysisLatency > MONITORING_CONFIG.alertThresholds.analysisLatency) {
      issues.push(`Analysis latency too high: ${metrics.analysisLatency}ms`);
    }

    if (metrics.successRate < 1 - MONITORING_CONFIG.alertThresholds.errorRate) {
      issues.push(`Error rate too high: ${((1 - metrics.successRate) * 100).toFixed(2)}%`);
    }

    if (issues.length > 0) {
      this.notifyIssues(issues);
    }
  }

  /**
   * 通知问题
   */
  private notifyIssues(issues: string[]): void {
    issues.forEach(issue => {
      console.warn(`[MonitoringSystem] Issue detected: ${issue}`);
      this.alertCallbacks.forEach(callback => callback(issue));
    });
  }

  /**
   * 注册告警回调
   */
  onAlert(callback: (issue: string) => void): () => void {
    this.alertCallbacks.push(callback);

    // 返回取消注册的函数
    return () => {
      const index = this.alertCallbacks.indexOf(callback);
      if (index > -1) {
        this.alertCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * 清理过期指标
   */
  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - MONITORING_CONFIG.metricsRetentionMs;
    this.metricsHistory = this.metricsHistory.filter(m => m.timestamp > cutoff);
  }

  /**
   * 获取健康状态
   */
  getHealthStatus(): HealthStatus {
    return { ...this.healthStatus };
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport(duration: number = 24 * 60 * 60 * 1000): {
    avgDataLatency: number;
    avgAnalysisLatency: number;
    avgSuccessRate: number;
    totalErrors: number;
    peakLatency: number;
    latencyTrend: 'improving' | 'stable' | 'degrading';
  } {
    const cutoff = Date.now() - duration;
    const recentMetrics = this.metricsHistory.filter(m => m.timestamp > cutoff);

    if (recentMetrics.length === 0) {
      return {
        avgDataLatency: 0,
        avgAnalysisLatency: 0,
        avgSuccessRate: 1,
        totalErrors: 0,
        peakLatency: 0,
        latencyTrend: 'stable',
      };
    }

    const avgDataLatency = recentMetrics.reduce((sum, m) => sum + m.dataUpdateLatency, 0) / recentMetrics.length;
    const avgAnalysisLatency = recentMetrics.reduce((sum, m) => sum + m.analysisLatency, 0) / recentMetrics.length;
    const avgSuccessRate = recentMetrics.reduce((sum, m) => sum + m.successRate, 0) / recentMetrics.length;
    const totalErrors = recentMetrics.reduce((sum, m) => sum + m.errorCount, 0);
    const peakLatency = Math.max(...recentMetrics.map(m => Math.max(m.dataUpdateLatency, m.analysisLatency)));

    // 计算延迟趋势
    const halfPoint = Math.floor(recentMetrics.length / 2);
    const firstHalf = recentMetrics.slice(0, halfPoint);
    const secondHalf = recentMetrics.slice(halfPoint);

    const firstHalfAvg = firstHalf.reduce((sum, m) => sum + m.dataUpdateLatency + m.analysisLatency, 0) / (firstHalf.length * 2);
    const secondHalfAvg = secondHalf.reduce((sum, m) => sum + m.dataUpdateLatency + m.analysisLatency, 0) / (secondHalf.length * 2);

    let latencyTrend: 'improving' | 'stable' | 'degrading' = 'stable';
    const trendThreshold = 0.1; // 10%变化阈值

    if (secondHalfAvg < firstHalfAvg * (1 - trendThreshold)) {
      latencyTrend = 'improving';
    } else if (secondHalfAvg > firstHalfAvg * (1 + trendThreshold)) {
      latencyTrend = 'degrading';
    }

    return {
      avgDataLatency,
      avgAnalysisLatency,
      avgSuccessRate,
      totalErrors,
      peakLatency,
      latencyTrend,
    };
  }

  /**
   * 获取指标历史
   */
  getMetricsHistory(duration: number = 24 * 60 * 60 * 1000): MetricsHistory[] {
    const cutoff = Date.now() - duration;
    return this.metricsHistory.filter(m => m.timestamp > cutoff);
  }

  /**
   * 生成监控仪表板数据
   */
  getDashboardData(): {
    health: HealthStatus;
    performance: {
      avgDataLatency: number;
      avgAnalysisLatency: number;
      avgSuccessRate: number;
      totalErrors: number;
      peakLatency: number;
      latencyTrend: 'improving' | 'stable' | 'degrading';
    };
    recentMetrics: MetricsHistory[];
    uptime: number;
  } {
    const now = Date.now();
    const startTime = this.metricsHistory[0]?.timestamp || now;
    const uptime = now - startTime;

    return {
      health: this.getHealthStatus(),
      performance: this.getPerformanceReport(),
      recentMetrics: this.getMetricsHistory(60 * 60 * 1000), // 最近1小时
      uptime,
    };
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 导出单例实例
export const monitoringSystem = new MonitoringSystem();
