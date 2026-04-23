// ================================================================================
// Experiment Record Local Storage API
// ================================================================================
// Currently uses localStorage for persistence.
// Can be swapped for a backend API in the future.
// ================================================================================

import type {
  ExperimentRecord,
  CreateExperimentInput,
  UpdateExperimentInput,
  SortConfig,
  ExperimentFilters,
} from './types';

const STORAGE_KEY = 'meownote_experiments';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function getAllRecords(): ExperimentRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAllRecords(records: ExperimentRecord[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

// Demo data for first-time users
const DEMO_RECORDS: ExperimentRecord[] = [
  {
    id: 'demo-1',
    dateTime: '2025-04-15T09:30',
    user: 'YangHao',
    targetBatch: 'CoNb3S6-2025-A',
    targetRatio: 'Co:Nb:S = 1:3:6',
    pressure: 2.5e-3,
    gateValve: '50%',
    growthTemp: 850,
    annealingTemp: 400,
    sampleHeight: 12.5,
    sampleThickness: 0.18,
    remanence: 0.92,
    coercivity: 0.135,
    saturationMagnetization: 1.42,
    notes: '初次尝试CoNb3S6薄膜生长，基底使用SiO2/Si，观察到较好的结晶性。',
    createdAt: '2025-04-15T09:30:00Z',
    updatedAt: '2025-04-15T16:00:00Z',
  },
  {
    id: 'demo-2',
    dateTime: '2025-04-18T14:00',
    user: 'YangHao',
    targetBatch: 'ZrAs2-2024-B',
    targetRatio: 'Zr:As = 1:2',
    pressure: 1.8e-3,
    gateValve: '70%',
    growthTemp: 720,
    annealingTemp: 350,
    sampleHeight: 10.0,
    sampleThickness: 0.12,
    remanence: 0.65,
    coercivity: 0.098,
    saturationMagnetization: 1.10,
    notes: 'ZrAs2生长温度较低，需要注意腔体真空度。薄膜表面较为平整。',
    createdAt: '2025-04-18T14:00:00Z',
    updatedAt: '2025-04-18T20:30:00Z',
  },
  {
    id: 'demo-3',
    dateTime: '2025-04-20T10:00',
    user: 'YangHao',
    targetBatch: 'Nb3I8-2025-C',
    targetRatio: 'Nb:I = 3:8',
    pressure: 3.0e-3,
    gateValve: '30%',
    growthTemp: 600,
    annealingTemp: 300,
    sampleHeight: 15.0,
    sampleThickness: 0.095,
    remanence: 0.48,
    coercivity: 0.072,
    saturationMagnetization: 0.89,
    notes: 'Nb3I8对氧敏感，生长过程中需严格控制本底真空。样品盘高度调整到15mm以优化薄膜均匀性。',
    createdAt: '2025-04-20T10:00:00Z',
    updatedAt: '2025-04-20T18:00:00Z',
  },
];

function initDemoData(): void {
  const existing = getAllRecords();
  if (existing.length === 0) {
    saveAllRecords(DEMO_RECORDS);
  }
}

export const experimentStorage = {
  init(): void {
    initDemoData();
  },

  list(filters?: ExperimentFilters, sort?: SortConfig): ExperimentRecord[] {
    let records = getAllRecords();

    // Apply filters
    if (filters) {
      if (filters.target) {
        const term = filters.target.toLowerCase();
        records = records.filter((r) =>
          r.targetBatch.toLowerCase().includes(term) ||
          r.targetRatio.toLowerCase().includes(term)
        );
      }
      if (filters.dateFrom) {
        records = records.filter((r) => r.dateTime >= filters.dateFrom!);
      }
      if (filters.dateTo) {
        records = records.filter((r) => r.dateTime <= filters.dateTo!);
      }
    }

    // Apply sorting
    if (sort) {
      records.sort((a, b) => {
        let comparison = 0;
        switch (sort.field) {
          case 'dateTime':
            comparison = a.dateTime.localeCompare(b.dateTime);
            break;
          case 'targetBatch':
            comparison = a.targetBatch.localeCompare(b.targetBatch);
            break;
          case 'pressure':
            comparison = a.pressure - b.pressure;
            break;
          case 'growthTemp':
            comparison = a.growthTemp - b.growthTemp;
            break;
          case 'createdAt':
            comparison = a.createdAt.localeCompare(b.createdAt);
            break;
        }
        return sort.direction === 'asc' ? comparison : -comparison;
      });
    } else {
      // Default sort: newest first
      records.sort((a, b) => b.dateTime.localeCompare(a.dateTime));
    }

    return records;
  },

  get(id: string): ExperimentRecord | null {
    return getAllRecords().find((r) => r.id === id) || null;
  },

  create(input: CreateExperimentInput): ExperimentRecord {
    const now = new Date().toISOString();
    const record: ExperimentRecord = {
      id: generateId(),
      ...input,
      createdAt: now,
      updatedAt: now,
    };
    const records = getAllRecords();
    records.push(record);
    saveAllRecords(records);
    return record;
  },

  update(id: string, input: UpdateExperimentInput): ExperimentRecord | null {
    const records = getAllRecords();
    const index = records.findIndex((r) => r.id === id);
    if (index === -1) return null;

    records[index] = {
      ...records[index],
      ...input,
      updatedAt: new Date().toISOString(),
    };
    saveAllRecords(records);
    return records[index];
  },

  remove(id: string): boolean {
    const records = getAllRecords();
    const filtered = records.filter((r) => r.id !== id);
    if (filtered.length === records.length) return false;
    saveAllRecords(filtered);
    return true;
  },

  clear(): void {
    saveAllRecords([]);
  },

  exportToJSON(): string {
    return JSON.stringify(getAllRecords(), null, 2);
  },

  importFromJSON(json: string): { success: number; failed: number } {
    try {
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) return { success: 0, failed: 0 };

      let success = 0;
      let failed = 0;
      const existing = getAllRecords();

      for (const item of parsed) {
        if (
          item.id &&
          item.dateTime &&
          typeof item.target === 'string'
        ) {
          const index = existing.findIndex((r) => r.id === item.id);
          if (index !== -1) {
            existing[index] = { ...item, updatedAt: new Date().toISOString() };
          } else {
            existing.push(item);
          }
          success++;
        } else {
          failed++;
        }
      }

      saveAllRecords(existing);
      return { success, failed };
    } catch {
      return { success: 0, failed: 0 };
    }
  },
};
