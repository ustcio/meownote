// ================================================================================
// Target Material Local Storage API
// ================================================================================

import type { TargetRecord, CreateTargetInput, UpdateTargetInput } from './types';

const STORAGE_KEY = 'meownote_targets';

function generateId(): string {
  return `tgt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function getAllRecords(): TargetRecord[] {
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

function saveAllRecords(records: TargetRecord[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

// Demo data for first-time users
const DEMO_TARGETS: TargetRecord[] = [
  {
    id: 'tgt-demo-1',
    dateTime: '2025-04-10T10:00',
    user: 'YangHao',
    name: 'CoNb3S6',
    batch: 'CoNb3S6-2025-A',
    ratio: 'Co:Nb:S = 1:3:6',
    createdAt: '2025-04-10T10:00:00Z',
    updatedAt: '2025-04-10T10:00:00Z',
  },
  {
    id: 'tgt-demo-2',
    dateTime: '2025-04-12T14:00',
    user: 'YangHao',
    name: 'ZrAs2',
    batch: 'ZrAs2-2024-B',
    ratio: 'Zr:As = 1:2',
    createdAt: '2025-04-12T14:00:00Z',
    updatedAt: '2025-04-12T14:00:00Z',
  },
  {
    id: 'tgt-demo-3',
    dateTime: '2025-04-14T09:00',
    user: 'YangHao',
    name: 'Nb3I8',
    batch: 'Nb3I8-2025-C',
    ratio: 'Nb:I = 3:8',
    createdAt: '2025-04-14T09:00:00Z',
    updatedAt: '2025-04-14T09:00:00Z',
  },
];

function initDemoData(): void {
  const existing = getAllRecords();
  if (existing.length === 0) {
    saveAllRecords(DEMO_TARGETS);
  }
}

export const targetStorage = {
  init(): void {
    initDemoData();
  },

  list(): TargetRecord[] {
    const records = getAllRecords();
    records.sort((a, b) => b.dateTime.localeCompare(a.dateTime));
    return records;
  },

  get(id: string): TargetRecord | null {
    return getAllRecords().find((r) => r.id === id) || null;
  },

  create(input: CreateTargetInput): TargetRecord {
    const now = new Date().toISOString();
    const record: TargetRecord = {
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

  update(id: string, input: UpdateTargetInput): TargetRecord | null {
    const records = getAllRecords();
    const index = records.findIndex((r) => r.id === id);
    if (index === -1) return null;
    records[index] = { ...records[index], ...input, updatedAt: new Date().toISOString() };
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
};
