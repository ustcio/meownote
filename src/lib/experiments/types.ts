// ================================================================================
// Experiment Record Types - 实验记录数据类型定义
// ================================================================================

export interface ExperimentRecord {
  id: string;
  dateTime: string;           // 实验时间 (ISO 8601 format)
  targetBatch: string;        // 靶材批次
  targetRatio: string;         // 靶材成分计量比
  pressure: number;           // 气压 (Pa)
  gateValve: string;          // 闸板阀状态/开度
  growthTemp: number;         // 生长温度 (°C)
  annealingTemp: number;      // 退火温度 (°C)
  sampleHeight: number;       // 样品盘高度 (mm)
  sampleThickness: number;     // 样品厚度 (μm)
  remanence: number;           // 剩磁 (T)
  coercivity: number;          // 矫顽力 (T)
  saturationMagnetization: number; // 饱和磁化强度 (T)
  notes: string;              // 备注
  createdAt: string;
  updatedAt: string;
}

export interface CreateExperimentInput {
  dateTime: string;
  targetBatch: string;
  targetRatio: string;
  pressure: number;
  gateValve: string;
  growthTemp: number;
  annealingTemp: number;
  sampleHeight: number;
  sampleThickness: number;
  remanence: number;
  coercivity: number;
  saturationMagnetization: number;
  notes: string;
}

export interface UpdateExperimentInput {
  dateTime?: string;
  targetBatch?: string;
  targetRatio?: string;
  pressure?: number;
  gateValve?: string;
  growthTemp?: number;
  annealingTemp?: number;
  sampleHeight?: number;
  sampleThickness?: number;
  remanence?: number;
  coercivity?: number;
  saturationMagnetization?: number;
  notes?: string;
}

export type SortField = 'dateTime' | 'targetBatch' | 'pressure' | 'growthTemp' | 'createdAt';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

export interface ExperimentFilters {
  target?: string;
  dateFrom?: string;
  dateTo?: string;
}
