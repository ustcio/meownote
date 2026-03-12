import { config } from '@/config';
import { getAuthToken } from '@/utils/storage';

interface RequestConfig extends RequestInit {
  timeout?: number;
  retryAttempts?: number;
  skipAuth?: boolean;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
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
    headers: customHeaders = {},
    ...fetchOptions
  } = options;
  
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
}

export const api = {
  get<T = unknown>(endpoint: string, options?: RequestConfig): Promise<ApiResponse<T>> {
    return apiRequest<T>(endpoint, { ...options, method: 'GET' });
  },
  
  post<T = unknown>(endpoint: string, body?: unknown, options?: RequestConfig): Promise<ApiResponse<T>> {
    return apiRequest<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  },
  
  put<T = unknown>(endpoint: string, body?: unknown, options?: RequestConfig): Promise<ApiResponse<T>> {
    return apiRequest<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  },
  
  patch<T = unknown>(endpoint: string, body?: unknown, options?: RequestConfig): Promise<ApiResponse<T>> {
    return apiRequest<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  },
  
  delete<T = unknown>(endpoint: string, options?: RequestConfig): Promise<ApiResponse<T>> {
    return apiRequest<T>(endpoint, { ...options, method: 'DELETE' });
  },
};

export { ApiError };
