/**
 * sync.ts — Background data sync orchestrator for EquiValue AI
 *
 * Manages crawling all data sources in priority order and persisting
 * everything into horseDB (IndexedDB).
 *
 * Priority order:
 *   1. FEI ARG horses list
 *   2. FEI BRA horses list
 *   3. FEI events ARG + BRA
 *   4. Equipe ARG shows
 *   5. Equipe BRA shows
 *   6. FEDECUARG docs metadata
 *   7. CBH Brazil ranking + results
 *   8. Fin del Mundo lots
 *
 * Each source stores a "lastSync" timestamp so it won't re-crawl within 24h.
 */

import {
  feiFetchHorsesByCountry,
  feiFetchEventsByCountry,
  equipeSearchShows,
  equipeFetchShowResults,
  fedecuargFetchAll,
  cbhFetchRanking,
  cbhFetchResults,
  fdmFetchAllRecentLots,
  deduplicateHorses,
  deduplicateResults,
} from './scrapers2';
import {
  upsertHorses,
  upsertResults,
  upsertEvents,
  upsertSales,
  getMeta,
  setMeta,
  getDBStats,
} from './horseDB';
import type { DBHorse, DBResult, DBEvent, DataSource } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SyncStatus = 'idle' | 'syncing' | 'done' | 'error';

export interface SyncProgress {
  status: SyncStatus;
  currentSource?: string;
  stepsTotal: number;
  stepsDone: number;
  horsesImported: number;
  resultsImported: number;
  eventsImported: number;
  salesImported: number;
  lastError?: string;
  startedAt?: string;
  finishedAt?: string;
}

type ProgressCallback = (p: SyncProgress) => void;

const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Check if source needs sync ──────────────────────────────────────────────

async function needsSync(source: DataSource): Promise<boolean> {
  const key = `lastSync_${source}`;
  const last = await getMeta<string>(key);
  if (!last) return true;
  return Date.now() - new Date(last).getTime() > SYNC_INTERVAL_MS;
}

async function markSynced(source: DataSource): Promise<void> {
  await setMeta(`lastSync_${source}`, new Date().toISOString());
  // Update the aggregated lastSyncBySource meta
  const existing = (await getMeta<Record<string, string>>('lastSyncBySource')) ?? {};
  existing[source] = new Date().toISOString();
  await setMeta('lastSyncBySource', existing);
}

// ─── Main sync runner ─────────────────────────────────────────────────────────

export async function runSync(
  onProgress: ProgressCallback,
  forceAll = false,
): Promise<SyncProgress> {
  const STEPS = 8;
  const progress: SyncProgress = {
    status: 'syncing',
    stepsTotal: STEPS,
    stepsDone: 0,
    horsesImported: 0,
    resultsImported: 0,
    eventsImported: 0,
    salesImported: 0,
    startedAt: new Date().toISOString(),
  };

  const emit = (partial?: Partial<SyncProgress>) => {
    Object.assign(progress, partial);
    onProgress({ ...progress });
  };

  const step = (source: string) => {
    progress.currentSource = source;
    progress.stepsDone++;
    emit();
  };

  try {
    // ── Step 1: FEI ARG horses ────────────────────────────────────────────
    step('FEI ARG — Caballos Argentina');
    if (forceAll || await needsSync('FEI_ARG')) {
      const horses = await feiFetchHorsesByCountry('ARG', 8);
      const deduped = deduplicateHorses(horses);
      await upsertHorses(deduped);
      progress.horsesImported += deduped.length;
      await markSynced('FEI_ARG');
      emit();
    }

    // ── Step 2: FEI BRA horses ────────────────────────────────────────────
    step('FEI BRA — Caballos Brasil');
    if (forceAll || await needsSync('FEI_BRA')) {
      const horses = await feiFetchHorsesByCountry('BRA', 8);
      const deduped = deduplicateHorses(horses);
      await upsertHorses(deduped);
      progress.horsesImported += deduped.length;
      await markSynced('FEI_BRA');
      emit();
    }

    // ── Step 3: FEI events ARG + BRA ─────────────────────────────────────
    step('FEI — Eventos Argentina + Brasil');
    if (forceAll || await needsSync('FEI')) {
      const [evARG, evBRA] = await Promise.all([
        feiFetchEventsByCountry('ARG'),
        feiFetchEventsByCountry('BRA'),
      ]);
      const allEvents = [...evARG, ...evBRA];
      await upsertEvents(allEvents);
      progress.eventsImported += allEvents.length;
      await markSynced('FEI');
      emit();
    }

    // ── Step 4: Equipe ARG shows ──────────────────────────────────────────
    step('Equipe Technology — Shows Argentina');
    if (forceAll || await needsSync('EQUIPE')) {
      const queries = ['Argentina', 'Buenos Aires', 'Haras', 'Argentina Jumping'];
      const allResults: DBResult[] = [];
      for (const q of queries) {
        const shows = await equipeSearchShows(q);
        for (const show of shows.slice(0, 4)) {
          const res = await equipeFetchShowResults(show.id);
          allResults.push(...res);
          await new Promise(r => setTimeout(r, 300));
        }
      }
      const deduped = deduplicateResults(allResults);
      await upsertResults(deduped);
      progress.resultsImported += deduped.length;
      emit();
    }

    // ── Step 5: Equipe BRA shows ──────────────────────────────────────────
    step('Equipe Technology — Shows Brasil');
    if (forceAll || await needsSync('EQUIPE')) {
      const queries = ['Brazil', 'Brasil', 'São Paulo', 'Rio de Janeiro'];
      const allResults: DBResult[] = [];
      for (const q of queries) {
        const shows = await equipeSearchShows(q);
        for (const show of shows.slice(0, 4)) {
          const res = await equipeFetchShowResults(show.id);
          allResults.push(...res);
          await new Promise(r => setTimeout(r, 300));
        }
      }
      const deduped = deduplicateResults(allResults);
      await upsertResults(deduped);
      progress.resultsImported += deduped.length;
      await markSynced('EQUIPE');
      emit();
    }

    // ── Step 6: FEDECUARG metadata ────────────────────────────────────────
    step('FEDECUARG — Resultados Nacionales Argentina');
    if (forceAll || await needsSync('FEDECUARG')) {
      const docs = await fedecuargFetchAll(15); // 15 pages = ~225 docs
      // Convert docs to DBEvent records
      const events: DBEvent[] = docs.map(doc => ({
        id: doc.id,
        name: doc.title,
        country: 'AR',
        club: doc.club,
        startDate: doc.dateStr ? new Date().toISOString().split('T')[0] : '',
        level: doc.level,
        discipline: 'SALTO',
        resultsUrl: doc.postUrl,
        pdfUrl: doc.driveUrl ?? undefined,
        source: 'FEDECUARG' as DataSource,
        hasResults: false,
        importedAt: doc.importedAt,
      }));
      await upsertEvents(events);
      progress.eventsImported += events.length;
      await markSynced('FEDECUARG');
      emit();
    }

    // ── Step 7: CBH Brazil ────────────────────────────────────────────────
    step('CBH — Confederação Brasileira de Hipismo');
    if (forceAll || await needsSync('CBH')) {
      const [rankings, results] = await Promise.all([
        cbhFetchRanking(),
        cbhFetchResults(),
      ]);

      // Convert rankings to DBHorse entries
      if (rankings.length > 0) {
        const rankHorses: DBHorse[] = rankings
          .filter(r => r.horseName.length > 2)
          .map(r => ({
            id: crypto.randomUUID(),
            name: r.horseName,
            nameLower: r.horseName.toLowerCase(),
            countryCode: 'BR',
            currentRider: r.riderName,
            sources: ['CBH' as DataSource],
            firstSeen: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
          }));
        await upsertHorses(deduplicateHorses(rankHorses));
        progress.horsesImported += rankHorses.length;
      }

      if (results.length > 0) {
        await upsertResults(deduplicateResults(results));
        progress.resultsImported += results.length;
      }

      await markSynced('CBH');
      emit();
    }

    // ── Step 8: Fin del Mundo Remates ─────────────────────────────────────
    step('Fin del Mundo — Subastas Argentina');
    if (forceAll || await needsSync('FDM_REMATES')) {
      const sales = await fdmFetchAllRecentLots(6);

      // Also add horses from auction data to horse DB
      if (sales.length > 0) {
        const auctionHorses: DBHorse[] = sales
          .filter(s => s.horseName.length > 2)
          .map(s => ({
            id: crypto.randomUUID(),
            name: s.horseName,
            nameLower: s.horseName.toLowerCase(),
            countryCode: 'AR',
            haras: s.haras,
            sources: ['FDM_REMATES' as DataSource],
            firstSeen: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
          }));
        await upsertHorses(deduplicateHorses(auctionHorses));
        await upsertSales(sales);
        progress.horsesImported += auctionHorses.length;
        progress.salesImported += sales.length;
      }
      await markSynced('FDM_REMATES');
      emit();
    }

    emit({
      status: 'done',
      currentSource: undefined,
      finishedAt: new Date().toISOString(),
    });
  } catch (err) {
    emit({
      status: 'error',
      lastError: err instanceof Error ? err.message : String(err),
      finishedAt: new Date().toISOString(),
    });
  }

  return progress;
}

// ─── Auto-sync on app start (if > 24h since last full sync) ──────────────────

export async function autoSync(onProgress: ProgressCallback): Promise<void> {
  const lastFull = await getMeta<string>('lastFullSync');
  if (lastFull && Date.now() - new Date(lastFull).getTime() < SYNC_INTERVAL_MS) {
    return; // Already synced today
  }
  await runSync(onProgress);
  await setMeta('lastFullSync', new Date().toISOString());
}

// ─── Quick stats without running a sync ──────────────────────────────────────

export { getDBStats };
