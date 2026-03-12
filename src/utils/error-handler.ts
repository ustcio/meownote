export interface ErrorInfo {
  message: string;
  stack?: string;
  componentStack?: string;
  timestamp: string;
  url: string;
  userAgent: string;
  userId?: string;
}

class ErrorHandler {
  private errors: ErrorInfo[] = [];
  private maxErrors = 50;
  
  init(): void {
    window.addEventListener('error', (event) => {
      this.handleError({
        message: event.message,
        stack: event.error?.stack,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      });
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      });
    });
  }
  
  handleError(error: ErrorInfo): void {
    console.error('[ErrorHandler]', error);
    
    this.errors.push(error);
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }
    
    if (this.shouldReport(error)) {
      this.reportError(error);
    }
  }
  
  private shouldReport(error: ErrorInfo): boolean {
    const ignoredMessages = [
      'ResizeObserver loop limit exceeded',
      'Network request failed',
      'Failed to fetch',
    ];
    
    return !ignoredMessages.some(msg => error.message.includes(msg));
  }
  
  private async reportError(error: ErrorInfo): Promise<void> {
    try {
      const apiBase = import.meta.env.PUBLIC_API_BASE || 'https://api.ustc.dev';
      await fetch(`${apiBase}/api/errors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(error),
      });
    } catch (e) {
      console.error('[ErrorHandler] Failed to report error:', e);
    }
  }
  
  getErrors(): ErrorInfo[] {
    return [...this.errors];
  }
  
  clearErrors(): void {
    this.errors = [];
  }
}

export const errorHandler = new ErrorHandler();

export function withErrorBoundary<T>(
  fn: () => T,
  fallback?: T
): T | undefined {
  try {
    return fn();
  } catch (error) {
    errorHandler.handleError({
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    });
    return fallback;
  }
}

export async function withAsyncErrorBoundary<T>(
  fn: () => Promise<T>,
  fallback?: T
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    errorHandler.handleError({
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    });
    return fallback;
  }
}
