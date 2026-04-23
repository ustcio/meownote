// ================================================================================
// Target Material Types - 靶材数据类型定义
// ================================================================================

export interface TargetRecord {
  id: string;
  dateTime: string;     // 入库时间 (ISO 8601 format)
  user: string;         // 记录人
  name: string;         // 靶材名称
  batch: string;        // 靶材批次
  ratio: string;        // 化学计量比
  createdAt: string;
  updatedAt: string;
}

export interface CreateTargetInput {
  dateTime: string;
  user: string;
  name: string;
  batch: string;
  ratio: string;
}

export interface UpdateTargetInput {
  dateTime?: string;
  user?: string;
  name?: string;
  batch?: string;
  ratio?: string;
}
