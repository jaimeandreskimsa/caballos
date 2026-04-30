/**
 * serverDB.ts — API client for the EquiValue backend (Hono + PostgreSQL)
 *
 * Mirrors the interface of horseDB.ts so components can swap between
 * local IndexedDB and the remote server DB without changing call sites.
 *
 * Uses VITE_API_URL (default: http://localhost:3000).
 */

import type { DBHorse, DBResult, DBEvent, DBSale, DataSource } from '../types';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ─── Horses ───────────────────────────────────────────────────────────────────

/** List horses with pagination and optional name/country filter. */
export async function serverListHorses(opts: {
  page?: number; limit?: number; q?: string; country?: string;
} = {}): Promise<{ total: number; page: number; limit: number; data: DBHorse[] }> {
  const params = new URLSearchParams();
  if (opts.page)    params.set('page',    String(opts.page));
  if (opts.limit)   params.set('limit',   String(opts.limit));
  if (opts.q)       params.set('q',       opts.q);
  if (opts.country) params.set('country', opts.country);
  return get(`/api/horses?${params}`);
}

/** Upsert an array of horses. Merges sources on conflict. */
export async function serverUpsertHorses(horses: DBHorse[]): Promise<{ inserted: number }> {
  return post('/api/horses/bulk', horses);
}

/** Full-text prefix search by name. Returns up to `limit` results. */
export async function serverSearchHorses(query: string, limit = 20): Promise<DBHorse[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  return get(`/api/horses/search?${params}`);
}

/** Get a single horse by ID. */
export async function serverGetHorse(id: string): Promise<DBHorse | null> {
  try {
    return await get(`/api/horses/${encodeURIComponent(id)}`);
  } catch {
    return null;
  }
}

// ─── Results ──────────────────────────────────────────────────────────────────

/** Upsert an array of competition results. */
export async function serverUpsertResults(results: DBResult[]): Promise<{ inserted: number }> {
  return post('/api/results/bulk', results);
}

/** Get all results for a horse. */
export async function serverGetResultsByHorse(horseId: string): Promise<DBResult[]> {
  return get(`/api/results?horseId=${encodeURIComponent(horseId)}`);
}

// ─── Events ───────────────────────────────────────────────────────────────────

/** Upsert an array of events. */
export async function serverUpsertEvents(events: DBEvent[]): Promise<{ inserted: number }> {
  return post('/api/events/bulk', events);
}

/** Get events filtered by country code. */
export async function serverGetEvents(country?: string): Promise<DBEvent[]> {
  const path = country
    ? `/api/events?country=${encodeURIComponent(country)}`
    : '/api/events';
  return get(path);
}

// ─── Sales ────────────────────────────────────────────────────────────────────

/** Upsert an array of auction sales. */
export async function serverUpsertSales(sales: DBSale[]): Promise<{ inserted: number }> {
  return post('/api/sales/bulk', sales);
}

// ─── Meta (sync state) ────────────────────────────────────────────────────────

export async function serverGetMeta(key: string): Promise<string | null> {
  const data = await get<{ value: string | null }>(`/api/meta/${encodeURIComponent(key)}`);
  return data.value;
}

export async function serverSetMeta(key: string, value: string): Promise<void> {
  await put(`/api/meta/${encodeURIComponent(key)}`, { value });
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface ServerDBStats {
  totalHorses: number;
  totalResults: number;
  totalEvents: number;
  totalSales: number;
}

export async function serverGetDBStats(): Promise<ServerDBStats> {
  return get('/api/stats');
}

// ─── Availability check ───────────────────────────────────────────────────────

/** Returns true if the API server is reachable. */
export async function isServerAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** 
 * Batch-sync a full scrape run to the server.
 * Automatically falls back silently if the server is down (dev mode without API).
 */
export async function syncToServer(data: {
  horses?: DBHorse[];
  results?: DBResult[];
  events?: DBEvent[];
  sales?: DBSale[];
  source: DataSource;
}): Promise<void> {
  const available = await isServerAvailable();
  if (!available) {
    console.warn('[serverDB] Server not reachable — skipping remote sync');
    return;
  }

  const tasks: Promise<unknown>[] = [];

  if (data.horses?.length) tasks.push(serverUpsertHorses(data.horses));
  if (data.results?.length) tasks.push(serverUpsertResults(data.results));
  if (data.events?.length) tasks.push(serverUpsertEvents(data.events));
  if (data.sales?.length) tasks.push(serverUpsertSales(data.sales));

  const results2 = await Promise.allSettled(tasks);
  const failed = results2.filter(r => r.status === 'rejected');
  if (failed.length) {
    console.error('[serverDB] Some syncs failed:', failed);
  }

  await serverSetMeta(`last_sync_${data.source}`, new Date().toISOString());
}
