'use client';

import { createIdempotencyKey } from './idempotency';

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';
export type DraftSection = 'main' | 'feedback';
export type DraftRole = 'A' | 'B';
type DraftInput = { sessionCode: string; taskId: string; role: DraftRole; section: DraftSection; payload: unknown };
export type DraftRecord = DraftInput & { key: string; updatedAt: number; revision: number; mutationId: string; conflict?: boolean };
type QueuedDraft = DraftRecord & { attempts: number; lastError?: string };
export type DraftSyncStatus = { pendingCount: number; syncing: boolean; lastError?: string };
let dbPromise: Promise<IDBDatabase> | null = null;
const syncing = new Map<string, Promise<void>>();

export function draftRecordKey(sessionCode: string, taskId: string, role: DraftRole, section: DraftSection = 'main') {
  return `${sessionCode.toUpperCase()}:${taskId}:${role}:${section}`;
}

function openDb() {
  if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open('multi-cooperation-resilience', 1);
    request.onupgradeneeded = () => {
      for (const name of ['drafts', 'draftQueue']) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { dbPromise = null; reject(request.error); };
  });
  return dbPromise;
}

// Read/modify both stores in one transaction: a late network ACK must not delete newer edits.
async function mutate(key: string, change: (local: DraftRecord | undefined, queued: QueuedDraft | undefined) => { local?: DraftRecord; queued?: QueuedDraft | null }) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['drafts', 'draftQueue'], 'readwrite');
    const local = tx.objectStore('drafts').get(key);
    const queued = tx.objectStore('draftQueue').get(key);
    queued.onsuccess = () => {
      const next = change(local.result, queued.result);
      if (next.local) tx.objectStore('drafts').put(next.local);
      if (next.queued === null) tx.objectStore('draftQueue').delete(key);
      else if (next.queued) tx.objectStore('draftQueue').put(next.queued);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function read<T>(store: string, key?: string): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const objectStore = db.transaction(store, 'readonly').objectStore(store);
    const request = key === undefined ? objectStore.getAll() : objectStore.get(key);
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error);
  });
}

export async function loadLocalDraft(sessionCode: string, taskId: string, role: DraftRole, section: DraftSection = 'main') {
  return (await read<DraftRecord | undefined>('drafts', draftRecordKey(sessionCode, taskId, role, section))) ?? null;
}

export async function hydrateDraft(input: DraftInput, revision: number) {
  const key = draftRecordKey(input.sessionCode, input.taskId, input.role, input.section);
  await mutate(key, (_local, queued) => queued ? {} : { local: { ...input, key, revision, mutationId: '', updatedAt: Date.now() } });
  return loadLocalDraft(input.sessionCode, input.taskId, input.role, input.section);
}

export async function persistDraft(input: DraftInput) {
  const key = draftRecordKey(input.sessionCode, input.taskId, input.role, input.section);
  const mutationId = createIdempotencyKey(`draft:${key}`);
  await mutate(key, (local, queued) => {
    const record = { ...input, key, mutationId, revision: queued?.revision ?? local?.revision ?? 0, updatedAt: Date.now(), conflict: queued?.conflict ?? local?.conflict };
    return { local: record, queued: { ...record, attempts: 0 } };
  });
  await emitDraftSyncStatus();
  await synchronize(key);
  const current = await loadLocalDraft(input.sessionCode, input.taskId, input.role, input.section);
  const queued = await read<QueuedDraft | undefined>('draftQueue', key);
  return { synced: !queued && current?.mutationId === mutationId, conflict: Boolean(queued?.conflict) };
}

function synchronize(key: string): Promise<void> {
  const existing = syncing.get(key);
  if (existing) return existing;
  const promise = syncKey(key).finally(() => syncing.delete(key));
  syncing.set(key, promise);
  return promise;
}

async function syncKey(key: string) {
  // Bound work during continuous typing. Remaining items are picked up by periodic flush.
  for (let i = 0; i < 10; i += 1) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    let item = await read<QueuedDraft | undefined>('draftQueue', key);
    if (!item || item.conflict) return;
    if (!item.mutationId || item.revision === undefined) {
      await mutate(key, (local, queued) => {
        if (!queued) return {};
        const normalized = { ...queued, revision: queued.revision ?? 0, mutationId: queued.mutationId || createIdempotencyKey(`draft:${key}`) };
        return { local: local && { ...local, revision: normalized.revision, mutationId: normalized.mutationId }, queued: normalized };
      });
      item = await read<QueuedDraft | undefined>('draftQueue', key);
      if (!item) return;
    }
    const sending = item;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${serverBaseUrl}/experiment/session/${item.sessionCode}/tasks/${item.taskId}/draft`, {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: item.role, section: item.section, payload: item.payload, expectedRevision: item.revision ?? 0, mutationId: item.mutationId }),
      });
      if (!response.ok) {
        await mutate(key, (local, queued) => {
          if (!queued) return {};
          const conflict = response.status === 409;
          const lastError = conflict ? '草稿版本冲突：本地内容已保留，请勿清缓存，联系研究员处理' : `保存失败 ${response.status}`;
          return { local: local && { ...local, conflict }, queued: { ...queued, conflict, lastError, attempts: queued.attempts + 1 } };
        });
        return;
      }
      const result = await response.json() as { revision: number };
      if (!Number.isSafeInteger(result.revision)) throw new Error('草稿保存响应缺少版本');
      await mutate(key, (local, queued) => {
        // Another tab may already have advanced to a different version; never rebase it backwards.
        if (!local || !queued || queued.revision !== (sending.revision ?? 0)) return {};
        return {
          local: { ...local, revision: result.revision },
          queued: queued.mutationId === sending.mutationId ? null : { ...queued, revision: result.revision },
        };
      });
      window.dispatchEvent(new CustomEvent('task-draft-synced', { detail: item }));
    } catch (error) {
      await mutate(key, (_local, queued) => queued ? { queued: { ...queued, attempts: queued.attempts + 1, lastError: error instanceof Error ? error.message : '保存失败' } } : {});
      return;
    } finally {
      clearTimeout(timer);
      await emitDraftSyncStatus();
    }
  }
}

export async function getPendingDraftCount() { return (await read<QueuedDraft[]>('draftQueue')).length; }

export async function flushDraftQueue() {
  const items = await read<QueuedDraft[]>('draftQueue');
  for (const item of items) await synchronize(item.key);
  return getPendingDraftCount();
}

export async function emitDraftSyncStatus(partial: Partial<DraftSyncStatus> = {}) {
  const items = await read<QueuedDraft[]>('draftQueue').catch(() => []);
  window.dispatchEvent(new CustomEvent<DraftSyncStatus>('draft-sync-status', { detail: {
    pendingCount: items.length, syncing: syncing.size > 0,
    lastError: items.find((item) => item.conflict)?.lastError, ...partial,
  } }));
}
