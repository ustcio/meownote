// ================================================================================
// API 错误处理模块 - 增强版
// 创建日期：2026-02-19
// 目的：增强 API 错误处理，提供重试、降级、熔断等功能
// ================================================================================

// 错误处理配置
const ERROR_HANDLER_CONFIG = {
  maxRetries: 3,                    // 最大重试次数
  baseDelayMs: 1000,                // 基础延迟 (毫秒)
  maxDelayMs: 10000,                // 最大延迟 (毫秒)
  timeoutMs: 5000,                  // 请求超时 (毫秒)
  circuitBreakerThreshold: 5,       // 熔断器触发阈值
  circuitBreakerTimeoutMs: 60000,   // 熔断器超时 (1 分钟)
};

// 错误类型
export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  HTTP_ERROR = 'HTTP_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

// 错误详情
export interface ApiError extends Error {
  type: ErrorType;
  statusCode?: number;
  url?: string;
  method?: string;
  retryable: boolean;
  timestamp: number;
  attempt?: number;
}

// 熔断器状态
enum CircuitBreakerState {
  CLOSED = 'CLOSED',      // 正常状态
  OPEN = 'OPEN',          // 熔断状态
  HALF_OPEN = 'HALF_OPEN' // 半开状态（测试恢复）
}

// 熔断器
class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private successCount = 0;

  constructor(
    private threshold: number = ERROR_HANDLER_CONFIG.circuitBreakerThreshold,
    private timeoutMs: number = ERROR_HANDLER_CONFIG.circuitBreakerTimeoutMs
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      // 检查是否可以进入半开状态
      if (this.lastFailureTime && Date.now() - this.lastFailureTime > this.timeoutMs) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.successCount = 0;
      } else {
        throw this.createCircuitBreakerError();
      }
    }

    try {
      const result = await fn();
      
      // 成功处理
      this.onSuccess();
      return result;
    } catch (error) {
      // 失败处理
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= 2) { // 连续 2 次成功则关闭熔断器
        this.state = CircuitBreakerState.CLOSED;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.threshold) {
      this.state = CircuitBreakerState.OPEN;
      console.warn('[CircuitBreaker] Circuit opened due to repeated failures');
    }
  }

  private createCircuitBreakerError(): ApiError {
    const error = new Error('Circuit breaker is OPEN') as ApiError;
    error.type = ErrorType.NETWORK_ERROR;
    error.retryable = false;
    error.timestamp = Date.now();
    return error;
  }

  getState(): CircuitBreakerState {
    return this.state;
  }
}

// 熔断器实例（按服务隔离）
const circuitBreakers = new Map<string, CircuitBreaker>();

function getCircuitBreaker(serviceName: string): CircuitBreaker {
  if (!circuitBreakers.has(serviceName)) {
    circuitBreakers.set(serviceName, new CircuitBreaker());
  }
  return circuitBreakers.get(serviceName)!;
}

/**
 * 创建 API 错误对象
 */
function createApiError(
  message: string,
  type: ErrorType,
  options?: {
    statusCode?: number;
    url?: string;
    method?: string;
    retryable?: boolean;
    attempt?: number;
  }
): ApiError {
  const error = new Error(message) as ApiError;
  error.type = type;
  error.statusCode = options?.statusCode;
  error.url = options?.url;
  error.method = options?.method;
  error.retryable = options?.retryable ?? true;
  error.timestamp = Date.now();
  error.attempt = options?.attempt;
  return error;
}

/**
 * 计算重试延迟（指数退避 + 抖动）
 */
function calculateRetryDelay(attempt: number): number {
  const exponentialDelay = ERROR_HANDLER_CONFIG.baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 30% 抖动
  return Math.min(exponentialDelay + jitter, ERROR_HANDLER_CONFIG.maxDelayMs);
}

/**
 * 判断错误是否可重试
 */
function isRetryableError(error: ApiError): boolean {
  if (!error.retryable) return false;
  
  // 某些 HTTP 状态码不应重试
  const nonRetryableStatuses = [400, 401, 403, 404, 422];
  if (error.statusCode && nonRetryableStatuses.includes(error.statusCode)) {
    return false;
  }
  
  return true;
}

/**
 * 带重试和超时的 API 调用
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit & {
    timeoutMs?: number;
    maxRetries?: number;
    serviceName?: string;
  }
): Promise<Response> {
  const {
    timeoutMs = ERROR_HANDLER_CONFIG.timeoutMs,
    maxRetries = ERROR_HANDLER_CONFIG.maxRetries,
    serviceName = 'default',
    ...fetchOptions
  } = options || {};

  const circuitBreaker = getCircuitBreaker(serviceName);
  let lastError: ApiError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // 使用熔断器执行请求
      return await circuitBreaker.execute(async () => {
        // 创建带超时的请求
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const response = await fetch(url, {
            ...fetchOptions,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          // 检查 HTTP 状态码
          if (!response.ok) {
            throw createApiError(
              `HTTP error: ${response.status}`,
              ErrorType.HTTP_ERROR,
              {
                statusCode: response.status,
                url,
                method: fetchOptions.method || 'GET',
                retryable: response.status >= 500 || response.status === 429,
                attempt: attempt + 1,
              }
            );
          }

          return response;
        } catch (error) {
          clearTimeout(timeoutId);

          // 转换错误类型
          if (error instanceof Error && error.name === 'AbortError') {
            throw createApiError(
              `Request timeout after ${timeoutMs}ms`,
              ErrorType.TIMEOUT_ERROR,
              {
                url,
                method: fetchOptions.method || 'GET',
                retryable: true,
                attempt: attempt + 1,
              }
            );
          }

          if (error instanceof TypeError && error.message.includes('fetch')) {
            throw createApiError(
              `Network error: ${error.message}`,
              ErrorType.NETWORK_ERROR,
              {
                url,
                method: fetchOptions.method || 'GET',
                retryable: true,
                attempt: attempt + 1,
              }
            );
          }

          throw error;
        }
      });
    } catch (error) {
      lastError = error as ApiError;

      // 记录错误日志
      console.error(`[API Error] Attempt ${attempt + 1}/${maxRetries + 1} failed:`, {
        type: lastError.type,
        message: lastError.message,
        url,
        statusCode: lastError.statusCode,
      });

      // 检查是否应该重试
      if (attempt < maxRetries && isRetryableError(lastError)) {
        const delay = calculateRetryDelay(attempt);
        console.log(`[API] Retrying in ${Math.round(delay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // 不再重试，抛出错误
        break;
      }
    }
  }

  // 所有重试都失败
  throw lastError || createApiError(
    'Unknown error occurred',
    ErrorType.UNKNOWN_ERROR,
    { url, method: options?.method || 'GET' }
  );
}

/**
 * 安全的 JSON 获取
 */
export async function fetchJsonWithRetry<T>(
  url: string,
  options?: RequestInit & {
    timeoutMs?: number;
    maxRetries?: number;
    serviceName?: string;
  }
): Promise<T> {
  const response = await fetchWithRetry(url, options);
  return response.json() as Promise<T>;
}

/**
 * 批量 API 调用（带错误容忍）
 */
export async function fetchAllWithTolerance<T>(
  requests: Array<{
    url: string;
    options?: RequestInit;
    serviceName?: string;
  }>,
  toleranceRate: number = 0.5 // 容忍失败率（默认 50%）
): Promise<Array<{ success: boolean; data?: T; error?: ApiError }>> {
  const results = await Promise.allSettled(
    requests.map(req => 
      fetchJsonWithRetry<T>(req.url, {
        ...req.options,
        serviceName: req.serviceName,
      })
    )
  );

  const successCount = results.filter(r => r.status === 'fulfilled').length;
  const failureRate = 1 - successCount / requests.length;

  if (failureRate > toleranceRate) {
    console.error('[Batch Fetch] Too many failures:', {
      total: requests.length,
      success: successCount,
      failureRate: `${(failureRate * 100).toFixed(2)}%`,
    });
  }

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return {
        success: true,
        data: result.value,
      };
    } else {
      return {
        success: false,
        error: result.reason as ApiError,
      };
    }
  });
}

/**
 * 获取熔断器状态
 */
export function getCircuitBreakerStatus(): Record<string, CircuitBreakerState> {
  const status: Record<string, CircuitBreakerState> = {};
  circuitBreakers.forEach((breaker, serviceName) => {
    status[serviceName] = breaker.getState();
  });
  return status;
}

/**
 * 重置熔断器
 */
export function resetCircuitBreaker(serviceName: string): void {
  const breaker = circuitBreakers.get(serviceName);
  if (breaker) {
    // 通过执行一个空函数来重置状态
    breaker.execute(async () => {}).catch(() => {});
  }
}

// 导出错误类型枚举
export { ErrorType, CircuitBreakerState };

// 默认导出
export default {
  fetchWithRetry,
  fetchJsonWithRetry,
  fetchAllWithTolerance,
  getCircuitBreakerStatus,
  resetCircuitBreaker,
  ErrorType,
};
