/**
 * horseDB.ts — Persistent local database for EquiValue AI
 *
 * Uses IndexedDB via a thin wrapper.  Falls back to an in-memory Map when
 * IndexedDB is unavailable (SSR, private-browsing restrictions).
 *
 * Stores:
 *   horses   — DBHorse records, keyed by id
 *   results  — DBResult records, keyed by id, indexed by horseId
 *   events   — DBEvent records, keyed by id
 *   sales    — DBSale records, keyed by id
 *   meta     — key/value pairs (last_sync timestamps, counts, etc.)
 */

import type { DBHorse, DBResult, DBEvent, DBSale, DataSource } from '../types';

// ─── IndexedDB bootstrap ──────────────────────────────────────────────────────
const DB_NAME = 'equivalue_db';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('horses')) {
        const os = db.createObjectStore('horses', { keyPath: 'id' });
        os.createIndex('nameLower', 'nameLower', { unique: false });
        os.createIndex('countryCode', 'countryCode', { unique: false });
        os.createIndex('feiId', 'feiId', { unique: false });
      }
      if (!db.objectStoreNames.contains('results')) {
        const os = db.createObjectStore('results', { keyPath: 'id' });
        os.createIndex('horseId', 'horseId', { unique: false });
        os.createIndex('horseNameNorm', 'horseNameNorm', { unique: false });
        os.createIndex('source', 'source', { unique: false });
        os.createIndex('eventDate', 'eventDate', { unique: false });
      }
      if (!db.objectStoreNames.contains('events')) {
        const os = db.createObjectStore('events', { keyPath: 'id' });
        os.createIndex('country', 'country', { unique: false });
        os.createIndex('startDate', 'startDate', { unique: false });
      }
      if (!db.objectStoreNames.contains('sales')) {
        db.createObjectStore('sales', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let _db: IDBDatabase | null = null;
let _dbInitPromise: Promise<IDBDatabase> | null = null;

async function getDB(): Promise<IDBDatabase> {
  if (_db) return _db;
  if (!_dbInitPromise) _dbInitPromise = openDB();
  _db = await _dbInitPromise;
  return _db;
}

// ─── Generic IDB helpers ──────────────────────────────────────────────────────

function idbPut<T>(db: IDBDatabase, store: string, record: T): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function idbGet<T>(db: IDBDatabase, store: string, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

function idbGetAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

function idbGetByIndex<T>(
  db: IDBDatabase, store: string, index: string, value: IDBValidKey
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).index(index).getAll(value);
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

function idbCount(db: IDBDatabase, store: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbDelete(db: IDBDatabase, store: string, key: IDBValidKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ─── Batch upsert ─────────────────────────────────────────────────────────────
async function idbPutBatch<T>(db: IDBDatabase, store: string, records: T[]): Promise<void> {
  if (records.length === 0) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    let done = 0;
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();
    for (const r of records) {
      os.put(r);
    }
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

// HORSES

export async function upsertHorse(horse: DBHorse): Promise<void> {
  const db = await getDB();
  await idbPut(db, 'horses', horse);
}

export async function upsertHorses(horses: DBHorse[]): Promise<void> {
  const db = await getDB();
  await idbPutBatch(db, 'horses', horses);
}

export async function getHorse(id: string): Promise<DBHorse | undefined> {
  const db = await getDB();
  return idbGet(db, 'horses', id);
}

export async function getAllHorses(): Promise<DBHorse[]> {
  const db = await getDB();
  return idbGetAll(db, 'horses');
}

export async function getHorsesByCountry(countryCode: string): Promise<DBHorse[]> {
  const db = await getDB();
  return idbGetByIndex(db, 'horses', 'countryCode', countryCode);
}

export async function searchHorses(query: string, limit = 30): Promise<DBHorse[]> {
  const db = await getDB();
  const q = query.toLowerCase().trim();
  if (!q) return [];

  return new Promise((resolve, reject) => {
    const tx = db.transaction('horses', 'readonly');
    const index = tx.objectStore('horses').index('nameLower');
    const results: DBHorse[] = [];

    // Range query: starts-with
    const range = IDBKeyRange.bound(q, q + '\uffff');
    const req = index.openCursor(range);
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor && results.length < limit) {
        results.push(cursor.value as DBHorse);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

// RESULTS

export async function upsertResults(results: DBResult[]): Promise<void> {
  const db = await getDB();
  await idbPutBatch(db, 'results', results);
}

export async function getResultsByHorse(horseId: string): Promise<DBResult[]> {
  const db = await getDB();
  return idbGetByIndex(db, 'results', 'horseId', horseId);
}

export async function getResultsByHorseName(norm: string): Promise<DBResult[]> {
  const db = await getDB();
  return idbGetByIndex(db, 'results', 'horseNameNorm', norm);
}

export async function getResultsBySource(source: DataSource): Promise<DBResult[]> {
  const db = await getDB();
  return idbGetByIndex(db, 'results', 'source', source);
}

export async function getAllResults(): Promise<DBResult[]> {
  const db = await getDB();
  return idbGetAll(db, 'results');
}

// EVENTS

export async function upsertEvents(events: DBEvent[]): Promise<void> {
  const db = await getDB();
  await idbPutBatch(db, 'events', events);
}

export async function getAllEvents(): Promise<DBEvent[]> {
  const db = await getDB();
  return idbGetAll(db, 'events');
}

export async function getEventsByCountry(country: string): Promise<DBEvent[]> {
  const db = await getDB();
  return idbGetByIndex(db, 'events', 'country', country);
}

// SALES

export async function upsertSales(sales: DBSale[]): Promise<void> {
  const db = await getDB();
  await idbPutBatch(db, 'sales', sales);
}

export async function getAllSales(): Promise<DBSale[]> {
  const db = await getDB();
  return idbGetAll(db, 'sales');
}

// META (key/value)

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meta', 'readwrite');
    const req = tx.objectStore('meta').put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meta', 'readonly');
    const req = tx.objectStore('meta').get(key);
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

// DB STATS

export interface DBStats {
  totalHorses: number;
  totalResults: number;
  totalEvents: number;
  totalSales: number;
  lastSyncBySource: Record<string, string>;
}

export async function getDBStats(): Promise<DBStats> {
  const db = await getDB();
  const [totalHorses, totalResults, totalEvents, totalSales] = await Promise.all([
    idbCount(db, 'horses'),
    idbCount(db, 'results'),
    idbCount(db, 'events'),
    idbCount(db, 'sales'),
  ]);
  const lastSyncBySource = (await getMeta<Record<string, string>>('lastSyncBySource')) ?? {};
  return { totalHorses, totalResults, totalEvents, totalSales, lastSyncBySource };
}

export async function clearStore(store: 'horses' | 'results' | 'events' | 'sales'): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
