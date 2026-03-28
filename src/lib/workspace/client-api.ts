const API_BASE = 'https://api.ustc.dev';
const ENDPOINT = '/api/workspace';

interface RequestConfig {
  timeout?: number;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  config?: RequestConfig
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    config?.timeout || 10000
  );

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    const token = localStorage.getItem('meownote_auth_token');
    if (token) {
      try {
        const decoded = decodeURIComponent(atob(token));
        headers['Authorization'] = `Bearer ${decoded}`;
      } catch {}
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || errorData.error || `HTTP ${response.status}`
      );
    }

    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

export const workspaceApi = {
  async list(options?: {
    sortBy?: string;
    order?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const params = new URLSearchParams();
    if (options?.sortBy) params.set('sortBy', options.sortBy);
    if (options?.order) params.set('order', options.order);
    if (options?.search) params.set('search', options.search);
    if (options?.page) params.set('page', String(options.page));
    if (options?.limit) params.set('limit', String(options.limit));
    const query = params.toString();
    return request<any>(`${ENDPOINT}${query ? '?' + query : ''}`);
  },

  async get(id: string) {
    return request<any>(`${ENDPOINT}/${id}`);
  },

  async create(data: {
    title: string;
    content?: string;
    type?: string;
    fileSize?: number;
    fileUrl?: string;
  }) {
    return request<any>(ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(
    id: string,
    data: { title?: string; content?: string }
  ) {
    return request<any>(`${ENDPOINT}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async remove(id: string) {
    return request<any>(`${ENDPOINT}/${id}`, { method: 'DELETE' });
  },

  async batchDelete(ids: string[]) {
    return request<any>(`${ENDPOINT}/batch-delete`, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  },

  async duplicate(id: string) {
    return request<any>(`${ENDPOINT}/${id}/duplicate`, {
      method: 'POST',
    });
  },
};
