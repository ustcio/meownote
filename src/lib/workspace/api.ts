import { api } from '@/utils/api';
import type { CreateFileInput, UpdateFileInput, WorkspaceFile } from './types';

type SortBy = 'updated_at' | 'created_at' | 'title';
type SortOrder = 'asc' | 'desc';

const ENDPOINT = '/api/workspace';

export const workspaceApi = {
  async list(options?: {
    sortBy?: SortBy;
    order?: SortOrder;
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
    const res = await api.get<WorkspaceFile[]>(`${ENDPOINT}${query ? '?' + query : ''}`);
    const total = typeof (res as { total?: number }).total === 'number'
      ? (res as { total?: number }).total ?? 0
      : (res.data?.length ?? 0);

    return {
      success: res.success,
      data: res.data ?? [],
      total,
      message: res.message,
    };
  },

  async get(id: string) {
    const res = await api.get<WorkspaceFile>(`${ENDPOINT}/${id}`);
    return { success: res.success, data: res.data || null, message: res.message };
  },

  async create(input: CreateFileInput) {
    const res = await api.post<WorkspaceFile>(ENDPOINT, input, { includeCsrf: true });
    return { success: res.success, data: res.data || null, message: res.message };
  },

  async update(id: string, input: UpdateFileInput) {
    const res = await api.put<WorkspaceFile>(`${ENDPOINT}/${id}`, input, { includeCsrf: true });
    return { success: res.success, data: res.data || null, message: res.message };
  },

  async remove(id: string) {
    return api.delete(`${ENDPOINT}/${id}`, { includeCsrf: true });
  },

  async batchDelete(ids: string[]) {
    return api.post<{ deleted: number }>(`${ENDPOINT}/batch-delete`, { ids }, { includeCsrf: true });
  },

  async duplicateFile(id: string) {
    const res = await api.post<WorkspaceFile>(`${ENDPOINT}/${id}/duplicate`, {}, { includeCsrf: true });
    return { success: res.success, data: res.data || null };
  },
};
