import { config } from '@/config';
import { getAuthToken } from '@/utils/storage';

interface RequestConfig extends RequestInit {
  timeout?: number;
  retryAttempts?: number;
  skipAuth?: boolean;
  cacheTTL?: number;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

interface CacheEntry<T = unknown> {
  data: ApiResponse<T>;
  timestamp: number;
  promise?: Promise<ApiResponse<T>>;
}

class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const pendingRequests = new Map<string, Promise<ApiResponse<unknown>>>();
const responseCache = new Map<string, CacheEntry>();

function getCacheKey(endpoint: string, options: RequestConfig): string {
  return `${options.method || 'GET'}:${endpoint}`;
}

function getFromCache<T>(cacheKey: string, ttl: number): ApiResponse<T> | null {
  const entry = responseCache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ttl) {
    responseCache.delete(cacheKey);
    return null;
  }
  return entry.data;
}

function setCache<T>(cacheKey: string, data: ApiResponse<T>): void {
  responseCache.set(cacheKey, { data, timestamp: Date.now() });
}

function clearCache(endpoint?: string): void {
  if (endpoint) {
    for (const key of responseCache.keys()) {
      if (key.includes(endpoint)) {
        responseCache.delete(key);
      }
    }
  } else {
    responseCache.clear();
  }
}

function getCSRFToken(): string | null {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === config.security.csrfCookieName) {
      return value;
    }
  }
  return null;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout: number = config.api.timeout
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestConfig = {}
): Promise<ApiResponse<T>> {
  const {
    timeout = config.api.timeout,
    retryAttempts = config.api.retryAttempts,
    skipAuth = false,
    cacheTTL = 0,
    headers: customHeaders = {},
    ...fetchOptions
  } = options;
  
  const cacheKey = getCacheKey(endpoint, options);
  
  if (cacheTTL > 0 && (fetchOptions.method === 'GET' || !fetchOptions.method)) {
    const cached = getFromCache<T>(cacheKey, cacheTTL);
    if (cached) return cached;
    
    const pending = pendingRequests.get(cacheKey);
    if (pending) return pending as Promise<ApiResponse<T>>;
  }
  
  const url = `${config.api.baseUrl}${endpoint}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  };
  
  if (!skipAuth) {
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  
  const csrfToken = getCSRFToken();
  if (csrfToken) {
    headers[config.security.csrfHeaderName] = csrfToken;
  }
  
  const requestPromise = (async () => {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < retryAttempts; attempt++) {
      try {
        const response = await fetchWithTimeout(
          url,
          {
            ...fetchOptions,
            headers,
          },
          timeout
        );
        
        if (!response.ok) {
          if (response.status === 401) {
            const event = new CustomEvent('auth:unauthorized');
            window.dispatchEvent(event);
          }
          
          if (response.status >= 500 && attempt < retryAttempts - 1) {
            await sleep(config.api.retryDelay * (attempt + 1));
            continue;
          }
          
          throw new ApiError(
            response.status,
            response.statusText,
            `HTTP ${response.status}: ${response.statusText}`
          );
        }
        
        const data = await response.json();
        
        if (cacheTTL > 0 && (fetchOptions.method === 'GET' || !fetchOptions.method)) {
          setCache(cacheKey, data as ApiResponse<T>);
        }
        
        return data as ApiResponse<T>;
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (error instanceof ApiError) {
          throw error;
        }
        
        if (attempt < retryAttempts - 1) {
          await sleep(config.api.retryDelay * (attempt + 1));
        }
      }
    }
    
    throw lastError || new Error('Request failed');
  })();
  
  if (cacheTTL > 0 && (fetchOptions.method === 'GET' || !fetchOptions.method)) {
    pendingRequests.set(cacheKey, requestPromise);
    requestPromise.finally(() => pendingRequests.delete(cacheKey));
  }
  
  return requestPromise;
}

export const api = {
  get<T = unknown>(endpoint: string, options?: RequestConfig): Promise<ApiResponse<T>> {
    return apiRequest<T>(endpoint, { ...options, method: 'GET' });
  },
  
  post<T = unknown>(endpoint: string, body?: unknown, options?: RequestConfig): Promise<ApiResponse<T>> {
    const result = apiRequest<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
    result.finally(() => clearCache());
    return result;
  },
  
  put<T = unknown>(endpoint: string, body?: unknown, options?: RequestConfig): Promise<ApiResponse<T>> {
    const result = apiRequest<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
    result.finally(() => clearCache());
    return result;
  },
  
  patch<T = unknown>(endpoint: string, body?: unknown, options?: RequestConfig): Promise<ApiResponse<T>> {
    const result = apiRequest<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
    result.finally(() => clearCache());
    return result;
  },
  
  delete<T = unknown>(endpoint: string, options?: RequestConfig): Promise<ApiResponse<T>> {
    const result = apiRequest<T>(endpoint, { ...options, method: 'DELETE' });
    result.finally(() => clearCache());
    return result;
  },
  
  clearCache(endpoint?: string): void {
    clearCache(endpoint);
  },
};

export { ApiError };
