// ================================================================================
// Workspace Types - 数据类型定义
// ================================================================================

export interface WorkspaceFile {
  id: string;
  title: string;
  content: string;
  type: string;
  fileSize: number;
  createdAt: string;
  updatedAt: string;
  fileUrl?: string;
  downloadUrl?: string;
}

export interface CreateFileInput {
  title: string;
  content: string;
  type: string;
  fileSize: number;
  fileUrl?: string;
  downloadUrl?: string;
}

export interface UpdateFileInput {
  title?: string;
  content?: string;
  type?: string;
  fileSize?: number;
  fileUrl?: string;
  downloadUrl?: string;
}

export type SortBy = 'updated_at' | 'created_at' | 'title';
export type SortOrder = 'asc' | 'desc';

export interface SortOptions {
  sortBy: SortBy;
  order: SortOrder;
}

export interface WorkspaceListResponse {
  success: boolean;
  data: WorkspaceFile[];
  total: number;
}

export interface WorkspaceResponse {
  success: boolean;
  data: WorkspaceFile | null;
  message?: string;
}
