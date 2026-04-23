// ================================================================================
// Equipment Fault Record Types - 设备故障记录数据类型定义
// ================================================================================

export interface EquipmentRecord {
  id: string;
  dateTime: string;           // 记录时间 (ISO 8601 format)
  user: string;               // 记录人
  summary: string;            // 故障概述
  details: string;            // 故障详情
  createdAt: string;
  updatedAt: string;
}

export interface CreateEquipmentInput {
  dateTime: string;
  user: string;
  summary: string;
  details: string;
}

export interface UpdateEquipmentInput {
  dateTime?: string;
  user?: string;
  summary?: string;
  details?: string;
}

export type EquipmentSortField = 'dateTime' | 'user' | 'summary' | 'createdAt';
export type SortDirection = 'asc' | 'desc';

export interface EquipmentSortConfig {
  field: EquipmentSortField;
  direction: SortDirection;
}

export interface EquipmentFilters {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}
