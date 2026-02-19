// ================================================================================
// 指令系统 - 标准化指令格式与参数体系
// ================================================================================

import type { TradingSignal, TradingCommand, AIModelConfig } from './types';

// 指令模板配置
const COMMAND_TEMPLATES = {
  BUY: {
    version: '1.0.0',
    schema: {
      type: 'BUY',
      required: ['priceRange', 'conditions', 'execution'],
      optional: ['quantity', 'validation'],
      defaults: {
        execution: { strategy: 'limit', urgency: 'normal' },
        validation: { maxSlippage: 0.5, minConfidence: 0.65 },
      },
    },
  },
  SELL: {
    version: '1.0.0',
    schema: {
      type: 'SELL',
      required: ['priceRange', 'conditions', 'execution'],
      optional: ['quantity', 'validation'],
      defaults: {
        execution: { strategy: 'limit', urgency: 'normal' },
        validation: { maxSlippage: 0.5, minConfidence: 0.65 },
      },
    },
  },
};

// 指令验证规则
const VALIDATION_RULES = {
  priceRange: {
    minSpread: 0.1, // 最小价差
    maxSpread: 10, // 最大价差
    maxDeviation: 5, // 最大偏离当前价格百分比
  },
  confidence: {
    min: 0.5,
    max: 1.0,
    critical: 0.8,
  },
  slippage: {
    min: 0.1,
    max: 2.0,
    default: 0.5,
  },
};

/**
 * 指令系统类
 */
export class CommandSystem {
  private commandHistory: TradingCommand[] = [];
  private retryQueue: Array<{ command: TradingCommand; attempts: number; maxAttempts: number }> = [];
  private readonly maxRetries = 3;
  private readonly retryDelayMs = 5000;

  /**
   * 从交易信号生成标准化指令
   */
  generateCommand(signal: TradingSignal, userConfig?: Partial<TradingCommand>): TradingCommand {
    const baseCommand: TradingCommand = {
      id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: signal.type === 'HOLD' ? 'BUY' : signal.type,
      priceRange: {
        min: signal.targetPrice ? signal.targetPrice * 0.995 : signal.currentPrice * 0.995,
        max: signal.targetPrice ? signal.targetPrice * 1.005 : signal.currentPrice * 1.005,
      },
      conditions: {
        triggerPrice: signal.targetPrice || signal.currentPrice,
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
        timeLimit: signal.expiryTime,
      },
      execution: {
        strategy: this.determineExecutionStrategy(signal),
        urgency: signal.urgency,
      },
      validation: {
        maxSlippage: VALIDATION_RULES.slippage.default,
        minConfidence: signal.confidence,
      },
    };

    // 合并用户配置
    const command = this.mergeCommandConfig(baseCommand, userConfig);

    // 验证指令
    const validation = this.validateCommand(command);
    if (!validation.valid) {
      throw new Error(`Command validation failed: ${validation.errors.join(', ')}`);
    }

    // 记录历史
    this.commandHistory.push(command);

    return command;
  }

  /**
   * 确定执行策略
   */
  private determineExecutionStrategy(signal: TradingSignal): TradingCommand['execution']['strategy'] {
    if (signal.urgency === 'immediate') return 'market';
    if (signal.confidence > 0.8) return 'limit';
    if (signal.suggestedPosition > 0.7) return 'twap';
    return 'vwap';
  }

  /**
   * 合并指令配置
   */
  private mergeCommandConfig(
    base: TradingCommand,
    override?: Partial<TradingCommand>
  ): TradingCommand {
    if (!override) return base;

    return {
      ...base,
      ...override,
      priceRange: { ...base.priceRange, ...override.priceRange },
      conditions: { ...base.conditions, ...override.conditions },
      execution: { ...base.execution, ...override.execution },
      validation: { ...base.validation, ...override.validation },
    };
  }

  /**
   * 验证指令
   */
  validateCommand(command: TradingCommand): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 检查必填字段
    const template = COMMAND_TEMPLATES[command.type];
    if (!template) {
      errors.push(`Unknown command type: ${command.type}`);
      return { valid: false, errors, warnings };
    }

    for (const field of template.schema.required) {
      if (!(field in command) || command[field as keyof TradingCommand] === undefined) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // 验证价格区间
    if (command.priceRange) {
      const spread = command.priceRange.max - command.priceRange.min;
      if (spread < VALIDATION_RULES.priceRange.minSpread) {
        warnings.push(`Price spread too small: ${spread.toFixed(2)}`);
      }
      if (spread > VALIDATION_RULES.priceRange.maxSpread) {
        errors.push(`Price spread too large: ${spread.toFixed(2)}`);
      }
    }

    // 验证置信度
    if (command.validation?.minConfidence !== undefined) {
      if (command.validation.minConfidence < VALIDATION_RULES.confidence.min) {
        errors.push(`Confidence too low: ${command.validation.minConfidence}`);
      }
      if (command.validation.minConfidence > VALIDATION_RULES.confidence.max) {
        errors.push(`Confidence exceeds maximum: ${command.validation.minConfidence}`);
      }
    }

    // 验证滑点
    if (command.validation?.maxSlippage !== undefined) {
      if (command.validation.maxSlippage < VALIDATION_RULES.slippage.min) {
        warnings.push(`Slippage too tight: ${command.validation.maxSlippage}%`);
      }
      if (command.validation.maxSlippage > VALIDATION_RULES.slippage.max) {
        warnings.push(`Slippage too loose: ${command.validation.maxSlippage}%`);
      }
    }

    // 验证时间限制
    if (command.conditions?.timeLimit) {
      const timeLimit = new Date(command.conditions.timeLimit);
      if (timeLimit.getTime() <= Date.now()) {
        errors.push('Time limit has already passed');
      }
      if (timeLimit.getTime() > Date.now() + 7 * 24 * 60 * 60 * 1000) {
        warnings.push('Time limit exceeds 7 days');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 解析 AI 返回结果
   */
  parseAIResponse(response: string): Partial<TradingCommand> {
    try {
      // 尝试解析 JSON
      const parsed = JSON.parse(response);
      return this.normalizeAIParsedResult(parsed);
    } catch {
      // 如果不是 JSON，尝试从文本中提取
      return this.extractCommandFromText(response);
    }
  }

  /**
   * 标准化 AI 解析结果
   */
  private normalizeAIParsedResult(parsed: any): Partial<TradingCommand> {
    const normalized: Partial<TradingCommand> = {};

    if (parsed.type) {
      normalized.type = parsed.type.toUpperCase() as 'BUY' | 'SELL';
    }

    if (parsed.priceRange || parsed.price) {
      const price = parsed.price || parsed.targetPrice;
      const range = parsed.priceRange || {};
      normalized.priceRange = {
        min: range.min || price * 0.995,
        max: range.max || price * 1.005,
      };
    }

    if (parsed.conditions || parsed.stopLoss || parsed.takeProfit) {
      normalized.conditions = {
        triggerPrice: parsed.targetPrice || parsed.price,
        stopLoss: parsed.stopLoss,
        takeProfit: parsed.takeProfit,
        timeLimit: parsed.timeLimit ? Date.now() + parsed.timeLimit * 60 * 60 * 1000 : undefined,
      };
    }

    if (parsed.execution || parsed.strategy || parsed.urgency) {
      normalized.execution = {
        strategy: parsed.strategy || 'limit',
        urgency: parsed.urgency || 'normal',
      };
    }

    if (parsed.validation || parsed.slippage || parsed.confidence) {
      normalized.validation = {
        maxSlippage: parsed.slippage || VALIDATION_RULES.slippage.default,
        minConfidence: parsed.confidence || 0.65,
      };
    }

    return normalized;
  }

  /**
   * 从文本提取指令
   */
  private extractCommandFromText(text: string): Partial<TradingCommand> {
    const extracted: Partial<TradingCommand> = {};

    // 提取操作类型
    if (/买入|buy|做多/i.test(text)) {
      extracted.type = 'BUY';
    } else if (/卖出|sell|做空/i.test(text)) {
      extracted.type = 'SELL';
    }

    // 提取价格
    const priceMatch = text.match(/(?:价格|price|目标价)[：:]?\s*¥?(\d+(?:\.\d+)?)/i);
    if (priceMatch) {
      const price = parseFloat(priceMatch[1]);
      extracted.priceRange = {
        min: price * 0.995,
        max: price * 1.005,
      };
    }

    // 提取止损
    const stopLossMatch = text.match(/(?:止损|stop.?loss)[：:]?\s*¥?(\d+(?:\.\d+)?)/i);
    if (stopLossMatch) {
      extracted.conditions = {
        triggerPrice: extracted.priceRange?.min || 0,
        stopLoss: parseFloat(stopLossMatch[1]),
      };
    }

    // 提取止盈
    const takeProfitMatch = text.match(/(?:止盈|take.?profit)[：:]?\s*¥?(\d+(?:\.\d+)?)/i);
    if (takeProfitMatch && extracted.conditions) {
      extracted.conditions.takeProfit = parseFloat(takeProfitMatch[1]);
    }

    return extracted;
  }

  /**
   * 执行指令
   */
  async executeCommand(command: TradingCommand): Promise<{
    success: boolean;
    result?: any;
    error?: string;
    retryable: boolean;
  }> {
    try {
      // 再次验证
      const validation = this.validateCommand(command);
      if (!validation.valid) {
        return {
          success: false,
          error: `Validation failed: ${validation.errors.join(', ')}`,
          retryable: false,
        };
      }

      // 模拟执行 (实际应调用交易 API)
      console.log(`[CommandSystem] Executing command:`, command);

      // 这里应该调用实际的交易 API
      // const result = await tradingAPI.execute(command);

      return {
        success: true,
        result: { commandId: command.id, status: 'executed', timestamp: Date.now() },
        retryable: false,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const retryable = this.isRetryableError(errorMessage);

      if (retryable) {
        this.queueForRetry(command);
      }

      return {
        success: false,
        error: errorMessage,
        retryable,
      };
    }
  }

  /**
   * 判断错误是否可重试
   */
  private isRetryableError(error: string): boolean {
    const retryablePatterns = [
      /timeout/i,
      /network/i,
      /connection/i,
      /temporarily/i,
      /rate.?limit/i,
      /busy/i,
    ];

    return retryablePatterns.some(pattern => pattern.test(error));
  }

  /**
   * 加入重试队列
   */
  private queueForRetry(command: TradingCommand): void {
    const existingIndex = this.retryQueue.findIndex(item => item.command.id === command.id);

    if (existingIndex >= 0) {
      // 更新现有重试项
      this.retryQueue[existingIndex].attempts++;
    } else {
      // 添加新重试项
      this.retryQueue.push({
        command,
        attempts: 1,
        maxAttempts: this.maxRetries,
      });
    }

    // 启动重试处理
    this.processRetryQueue();
  }

  /**
   * 处理重试队列
   */
  private async processRetryQueue(): Promise<void> {
    if (this.retryQueue.length === 0) return;

    const item = this.retryQueue[0];

    if (item.attempts >= item.maxAttempts) {
      console.error(`[CommandSystem] Max retries exceeded for command: ${item.command.id}`);
      this.retryQueue.shift();
      return;
    }

    // 等待延迟
    await this.delay(this.retryDelayMs * item.attempts);

    // 重试执行
    const result = await this.executeCommand(item.command);

    if (result.success) {
      this.retryQueue.shift();
    } else if (!result.retryable) {
      console.error(`[CommandSystem] Non-retryable error for command: ${item.command.id}`);
      this.retryQueue.shift();
    } else {
      item.attempts++;
    }

    // 继续处理队列
    if (this.retryQueue.length > 0) {
      this.processRetryQueue();
    }
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取指令历史
   */
  getCommandHistory(limit: number = 100): TradingCommand[] {
    return this.commandHistory.slice(-limit);
  }

  /**
   * 获取重试队列状态
   */
  getRetryQueueStatus(): Array<{
    commandId: string;
    attempts: number;
    maxAttempts: number;
    type: string;
  }> {
    return this.retryQueue.map(item => ({
      commandId: item.command.id,
      attempts: item.attempts,
      maxAttempts: item.maxAttempts,
      type: item.command.type,
    }));
  }

  /**
   * 取消指令
   */
  cancelCommand(commandId: string): boolean {
    const index = this.retryQueue.findIndex(item => item.command.id === commandId);
    if (index >= 0) {
      this.retryQueue.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * 格式化指令为可读文本
   */
  formatCommandForDisplay(command: TradingCommand): string {
    const lines = [
      `【指令类型】${command.type === 'BUY' ? '买入' : '卖出'}`,
      `【价格区间】¥${command.priceRange.min.toFixed(2)} - ¥${command.priceRange.max.toFixed(2)}`,
    ];

    if (command.conditions.stopLoss) {
      lines.push(`【止损价格】¥${command.conditions.stopLoss.toFixed(2)}`);
    }

    if (command.conditions.takeProfit) {
      lines.push(`【止盈价格】¥${command.conditions.takeProfit.toFixed(2)}`);
    }

    lines.push(`【执行策略】${command.execution.strategy.toUpperCase()}`);
    lines.push(`【紧急程度】${command.execution.urgency}`);
    lines.push(`【最小置信度】${(command.validation.minConfidence * 100).toFixed(1)}%`);
    lines.push(`【最大滑点】${command.validation.maxSlippage}%`);

    return lines.join('\n');
  }
}

// 导出单例实例
export const commandSystem = new CommandSystem();
