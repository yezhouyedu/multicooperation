'use client';

import { createIdempotencyKey } from './idempotency';

const dbName = 'multi-cooperation-resilience';
const dbVersion = 1;
const draftStore = 'drafts';
const queueStore = 'draftQueue';
const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';

export type DraftSection = 'main' | 'feedback';
export type DraftRole = 'A' | 'B';

export type DraftRecord = {
  key: string;
  sessionCode: string;
  taskId: string;
  role: DraftRole;
  section: DraftSection;
  payload: unknown;
  updatedAt: number;
};

type QueuedDraftSave = DraftRecord & {
  idempotencyKey: string;
  attempts: number;
  lastError?: string;
};

export type DraftSyncStatus = {
  pendingCount: number;
  syncing: boolean;
  lastError?: string;
};

let dbPromise: Promise<IDBDatabase> | null = null;
let flushing = false;

export function draftRecordKey(sessionCode: string, taskId: string, role: DraftRole, section: DraftSection = 'main') {
  return `${sessionCode.toUpperCase()}:${taskId}:${role}:${section}`;
}

export async function saveLocalDraft(input: Omit<DraftRecord, 'key' | 'updatedAt'>) {
  const record: DraftRecord = {
    ...input,
    sessionCode: input.sessionCode.toUpperCase(),
    key: draftRecordKey(input.sessionCode, input.taskId, input.role, input.section),
    updatedAt: Date.now(),
  };
  const db = await openDb();
  await putRecord(db, draftStore, record);
  notifyDraftSaved(record);
  return record;
}

export async function loadLocalDraft(
  sessionCode: string,
  taskId: string,
  role: DraftRole,
  section: DraftSection = 'main',
) {
  const db = await openDb();
  return getRecord<DraftRecord>(db, draftStore, draftRecordKey(sessionCode, taskId, role, section));
}

export async function enqueueDraftSave(input: Omit<DraftRecord, 'key' | 'updatedAt'>, error?: unknown) {
  const record = await saveLocalDraft(input);
  const queued: QueuedDraftSave = {
    ...record,
    idempotencyKey: createIdempotencyKey(`draft:${record.key}`),
    attempts: 0,
    lastError: error instanceof Error ? error.message : undefined,
  };
  const db = await openDb();
  await putRecord(db, queueStore, queued);
  await emitDraftSyncStatus();
  return queued;
}

export async function removeQueuedDraft(
  sessionCode: string,
  taskId: string,
  role: DraftRole,
  section: DraftSection = 'main',
) {
  const db = await openDb();
  await deleteRecord(db, queueStore, draftRecordKey(sessionCode, taskId, role, section));
  await emitDraftSyncStatus();
}

export async function getPendingDraftCount() {
  const db = await openDb();
  const items = await getAllRecords<QueuedDraftSave>(db, queueStore);
  return items.length;
}

export async function flushDraftQueue() {
  if (flushing || typeof navigator !== 'undefined' && !navigator.onLine) return getPendingDraftCount();
  flushing = true;
  await emitDraftSyncStatus({ syncing: true });
  let lastError: string | undefined;
  try {
    const db = await openDb();
    const queued = await getAllRecords<QueuedDraftSave>(db, queueStore);
    queued.sort((a, b) => a.updatedAt - b.updatedAt);
    for (const item of queued) {
      try {
        const response = await fetch(
          `${serverBaseUrl}/experiment/session/${item.sessionCode}/tasks/${item.taskId}/draft`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': item.idempotencyKey,
            },
            body: JSON.stringify({
              role: item.role,
              section: item.section,
              payload: item.payload,
            }),
          },
        );
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`.trim());
        await deleteRecord(db, queueStore, item.key);
        window.dispatchEvent(new CustomEvent('task-draft-synced', { detail: item }));
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'sync failed';
        await putRecord(db, queueStore, { ...item, attempts: item.attempts + 1, lastError });
      }
    }
  } finally {
    flushing = false;
    await emitDraftSyncStatus({ syncing: false, lastError });
  }
  return getPendingDraftCount();
}

export async function emitDraftSyncStatus(partial: Partial<DraftSyncStatus> = {}) {
  const pendingCount = await getPendingDraftCount().catch(() => 0);
  window.dispatchEvent(
    new CustomEvent<DraftSyncStatus>('draft-sync-status', {
      detail: {
        pendingCount,
        syncing: false,
        ...partial,
      },
    }),
  );
}

function notifyDraftSaved(record: DraftRecord) {
  window.dispatchEvent(
    new CustomEvent('task-draft-saved', {
      detail: {
        taskId: record.taskId,
        role: record.role,
        section: record.section,
        payload: record.payload,
        source: 'local',
      },
    }),
  );
}

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, dbVersion);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(draftStore)) db.createObjectStore(draftStore, { keyPath: 'key' });
      if (!db.objectStoreNames.contains(queueStore)) db.createObjectStore(queueStore, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('indexedDB open failed'));
  });
  return dbPromise;
}

function txStore(db: IDBDatabase, storeName: string, mode: IDBTransactionMode) {
  return db.transaction(storeName, mode).objectStore(storeName);
}

function putRecord<T>(db: IDBDatabase, storeName: string, record: T) {
  return new Promise<void>((resolve, reject) => {
    const request = txStore(db, storeName, 'readwrite').put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('indexedDB put failed'));
  });
}

function getRecord<T>(db: IDBDatabase, storeName: string, key: string) {
  return new Promise<T | null>((resolve, reject) => {
    const request = txStore(db, storeName, 'readonly').get(key);
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error('indexedDB get failed'));
  });
}

function getAllRecords<T>(db: IDBDatabase, storeName: string) {
  return new Promise<T[]>((resolve, reject) => {
    const request = txStore(db, storeName, 'readonly').getAll();
    request.onsuccess = () => resolve((request.result as T[] | undefined) ?? []);
    request.onerror = () => reject(request.error ?? new Error('indexedDB getAll failed'));
  });
}

function deleteRecord(db: IDBDatabase, storeName: string, key: string) {
  return new Promise<void>((resolve, reject) => {
    const request = txStore(db, storeName, 'readwrite').delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('indexedDB delete failed'));
  });
}
