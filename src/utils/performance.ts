export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count';
  timestamp: number;
  rating?: 'good' | 'needs-improvement' | 'poor';
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private observers: PerformanceObserver[] = [];
  
  init(): void {
    this.observeWebVitals();
    this.observeLongTasks();
    this.observeLayoutShifts();
  }
  
  private observeWebVitals(): void {
    if (typeof PerformanceObserver === 'undefined') return;
    
    try {
      const paintObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            this.recordMetric({
              name: 'FCP',
              value: entry.startTime,
              unit: 'ms',
              timestamp: Date.now(),
              rating: this.rateFCP(entry.startTime),
            });
          }
        }
      });
      paintObserver.observe({ type: 'paint', buffered: true });
      this.observers.push(paintObserver);
      
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.recordMetric({
          name: 'LCP',
          value: lastEntry.startTime,
          unit: 'ms',
          timestamp: Date.now(),
          rating: this.rateLCP(lastEntry.startTime),
        });
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      this.observers.push(lcpObserver);
      
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric({
            name: 'FID',
            value: (entry as PerformanceEventTiming).processingStart - entry.startTime,
            unit: 'ms',
            timestamp: Date.now(),
            rating: this.rateFID((entry as PerformanceEventTiming).processingStart - entry.startTime),
          });
        }
      });
      fidObserver.observe({ type: 'first-input', buffered: true });
      this.observers.push(fidObserver);
    } catch (e) {
      console.warn('[PerformanceMonitor] Failed to observe web vitals:', e);
    }
  }
  
  private observeLongTasks(): void {
    if (typeof PerformanceObserver === 'undefined') return;
    
    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric({
            name: 'LongTask',
            value: entry.duration,
            unit: 'ms',
            timestamp: Date.now(),
            rating: entry.duration > 100 ? 'poor' : 'needs-improvement',
          });
        }
      });
      longTaskObserver.observe({ type: 'longtask', buffered: true });
      this.observers.push(longTaskObserver);
    } catch (e) {
      // LongTask API may not be supported
    }
  }
  
  private observeLayoutShifts(): void {
    if (typeof PerformanceObserver === 'undefined') return;
    
    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
        this.recordMetric({
          name: 'CLS',
          value: clsValue,
          unit: 'count',
          timestamp: Date.now(),
          rating: this.rateCLS(clsValue),
        });
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
      this.observers.push(clsObserver);
    } catch (e) {
      // Layout Shift API may not be supported
    }
  }
  
  private rateFCP(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 1800) return 'good';
    if (value <= 3000) return 'needs-improvement';
    return 'poor';
  }
  
  private rateLCP(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 2500) return 'good';
    if (value <= 4000) return 'needs-improvement';
    return 'poor';
  }
  
  private rateFID(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 100) return 'good';
    if (value <= 300) return 'needs-improvement';
    return 'poor';
  }
  
  private rateCLS(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 0.1) return 'good';
    if (value <= 0.25) return 'needs-improvement';
    return 'poor';
  }
  
  recordMetric(metric: PerformanceMetric): void {
    const existing = this.metrics.get(metric.name) || [];
    existing.push(metric);
    this.metrics.set(metric.name, existing);
    
    if (metric.rating === 'poor') {
      console.warn(`[PerformanceMonitor] Poor ${metric.name}: ${metric.value}${metric.unit}`);
    }
  }
  
  mark(name: string): void {
    performance.mark(name);
  }
  
  measure(name: string, startMark: string, endMark?: string): void {
    try {
      performance.measure(name, startMark, endMark);
      const entries = performance.getEntriesByName(name, 'measure');
      const lastEntry = entries[entries.length - 1];
      
      this.recordMetric({
        name,
        value: lastEntry.duration,
        unit: 'ms',
        timestamp: Date.now(),
      });
    } catch (e) {
      console.warn('[PerformanceMonitor] Failed to measure:', e);
    }
  }
  
  getMetrics(name?: string): PerformanceMetric[] {
    if (name) {
      return this.metrics.get(name) || [];
    }
    
    const all: PerformanceMetric[] = [];
    for (const values of this.metrics.values()) {
      all.push(...values);
    }
    return all;
  }
  
  getSummary(): Record<string, { avg: number; min: number; max: number; count: number }> {
    const summary: Record<string, { avg: number; min: number; max: number; count: number }> = {};
    
    for (const [name, metrics] of this.metrics) {
      const values = metrics.map(m => m.value);
      summary[name] = {
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length,
      };
    }
    
    return summary;
  }
  
  cleanup(): void {
    for (const observer of this.observers) {
      observer.disconnect();
    }
    this.observers = [];
    this.metrics.clear();
  }
}

export const performanceMonitor = new PerformanceMonitor();

export async function measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const startMark = `${name}-start`;
  const endMark = `${name}-end`;
  
  performance.mark(startMark);
  
  return fn().finally(() => {
    performance.mark(endMark);
    performanceMonitor.measure(name, startMark, endMark);
  });
}
