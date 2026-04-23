// ================================================================================
// Equipment Fault Record Local Storage API
// ================================================================================

import type {
  EquipmentRecord,
  CreateEquipmentInput,
  UpdateEquipmentInput,
  EquipmentSortConfig,
  EquipmentFilters,
} from './types';

const STORAGE_KEY = 'meownote_equipment_faults';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function getAllRecords(): EquipmentRecord[] {
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

function saveAllRecords(records: EquipmentRecord[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export const equipmentStorage = {
  list(filters?: EquipmentFilters, sort?: EquipmentSortConfig): EquipmentRecord[] {
    let records = getAllRecords();

    if (filters) {
      if (filters.search) {
        const term = filters.search.toLowerCase();
        records = records.filter((r) =>
          r.summary.toLowerCase().includes(term) ||
          r.user.toLowerCase().includes(term) ||
          r.details.toLowerCase().includes(term)
        );
      }
      if (filters.dateFrom) {
        records = records.filter((r) => r.dateTime >= filters.dateFrom!);
      }
      if (filters.dateTo) {
        records = records.filter((r) => r.dateTime <= filters.dateTo!);
      }
    }

    if (sort) {
      records.sort((a, b) => {
        let comparison = 0;
        switch (sort.field) {
          case 'dateTime':
            comparison = a.dateTime.localeCompare(b.dateTime);
            break;
          case 'user':
            comparison = a.user.localeCompare(b.user);
            break;
          case 'summary':
            comparison = a.summary.localeCompare(b.summary);
            break;
          case 'createdAt':
            comparison = a.createdAt.localeCompare(b.createdAt);
            break;
        }
        return sort.direction === 'asc' ? comparison : -comparison;
      });
    } else {
      records.sort((a, b) => b.dateTime.localeCompare(a.dateTime));
    }

    return records;
  },

  get(id: string): EquipmentRecord | null {
    return getAllRecords().find((r) => r.id === id) || null;
  },

  create(input: CreateEquipmentInput): EquipmentRecord {
    const now = new Date().toISOString();
    const record: EquipmentRecord = {
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

  update(id: string, input: UpdateEquipmentInput): EquipmentRecord | null {
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

  importFromJSON(json: string): { success: number; failed: number } {
    try {
      let parsed = JSON.parse(json);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        parsed = parsed.equipments;
      }
      if (!Array.isArray(parsed)) return { success: 0, failed: 0 };

      let success = 0;
      let failed = 0;
      const existing = getAllRecords();

      for (const item of parsed) {
        if (item.id && item.dateTime && typeof item.summary === 'string') {
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
