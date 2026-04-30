/**
 * seed.ts — Server-side data importer for EquiValue AI
 *
 * Sources:
 *  1. FEI       — calendar + horse search (JSON API with browser headers)
 *  2. Equipe    — show discovery via /searches.json API → events + horses via HTML
 *  3. FEDECUARG — Argentine national federation result pages
 *  4. CBH       — Brazilian federation (tries multiple known URLs)
 *  5. FDM       — Fin del Mundo Remates (tries Laravel API endpoints)
 *
 * Run: npm run seed   (inside /server)
 */

import 'dotenv/config';
import { db } from '../db/index.js';
import { horses, results, events, sales } from '../db/schema.js';
import { sql } from 'drizzle-orm';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DBHorse {
  id: string; name: string; nameLower: string; feiId?: string;
  birthYear?: number; breed?: string; studbook?: string; gender?: string;
  color?: string; countryCode: string; sire?: string; dam?: string;
  damSire?: string; currentRider?: string; owner?: string; haras?: string;
  sources: string[]; firstSeen: string; lastUpdated: string;
}
interface DBResult {
  id: string; horseId: string; horseName: string; horseNameNorm: string;
  riderName?: string; eventName: string; eventId?: string; eventDate: string;
  eventCountry: string; club?: string; level: string; category?: string;
  placement?: number; totalEntries?: number; faults: number; timeFaults?: number;
  jumpFaults?: number; time?: number; clear: boolean; phase?: string;
  points?: number; source: string; rawData?: string; importedAt: string;
}
interface DBEvent {
  id: string; name: string; country: string; club?: string; startDate: string;
  endDate?: string; level?: string; discipline: string; resultsUrl?: string;
  pdfUrl?: string; source: string; hasResults: boolean; importedAt: string;
}
interface DBSale {
  id: string; horseName: string; horseId?: string; auctionHouse: string;
  auctionName: string; saleDate: string; salePriceARS?: number; salePriceUSD?: number;
  salePriceEUR?: number; lots?: number; haras?: string; country: string;
  url?: string; source: string; importedAt: string;
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

// Rotate through user agents to avoid blocks
const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
];
let uaIdx = 0;
function nextUA() { return USER_AGENTS[uaIdx++ % USER_AGENTS.length]; }

async function fetchHTML(url: string, timeoutMs = 20000): Promise<string> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': nextUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-AR,es;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Referer': new URL(url).origin + '/',
      },
    });
    clearTimeout(timer);
    if (!res.ok) { console.warn(`  [HTTP ${res.status}] ${url}`); return ''; }
    return await res.text();
  } catch (err: any) {
    console.warn(`  [FETCH ERR] ${url}: ${err.message}`);
    return '';
  }
}

async function fetchJSON<T>(url: string, timeoutMs = 15000, extraHeaders: Record<string,string> = {}): Promise<T | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': nextUA(),
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
        'X-Requested-With': 'XMLHttpRequest',
        ...extraHeaders,
      },
    });
    clearTimeout(timer);
    if (!res.ok) { console.warn(`  [JSON ${res.status}] ${url}`); return null; }
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }
function uid() { return crypto.randomUUID(); }
function now() { return new Date().toISOString(); }

function normalizeHorseName(name: string): string {
  return name.trim().toUpperCase().replace(/\s+/g, ' ').replace(/[^A-Z0-9 ''\\-]/g, '');
}

function isoDate(raw: string): string {
  const dmY = raw.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (dmY) return `${dmY[3]}-${dmY[2].padStart(2, '0')}-${dmY[1].padStart(2, '0')}`;
  const Ymd = raw.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (Ymd) return `${Ymd[1]}-${Ymd[2].padStart(2, '0')}-${Ymd[3].padStart(2, '0')}`;
  return new Date().toISOString().split('T')[0];
}

// ─── DB upsert helpers ────────────────────────────────────────────────────────

const CHUNK = 150;

function dedupeById<T extends { id: string }>(list: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of list) map.set(item.id, item);
  return [...map.values()];
}

async function upsertHorsesBatch(batch: DBHorse[]) {
  const deduped = dedupeById(batch);
  for (let i = 0; i < deduped.length; i += CHUNK) {
    const chunk = deduped.slice(i, i + CHUNK);
    await db.insert(horses).values(chunk.map(h => ({
      id: h.id, name: h.name, nameLower: h.nameLower, feiId: h.feiId ?? null,
      birthYear: h.birthYear ?? null, breed: h.breed ?? null, studbook: h.studbook ?? null,
      gender: h.gender ?? null, color: h.color ?? null, countryCode: h.countryCode,
      sire: h.sire ?? null, dam: h.dam ?? null, damSire: h.damSire ?? null,
      currentRider: h.currentRider ?? null, owner: h.owner ?? null, haras: h.haras ?? null,
      sources: h.sources, firstSeen: h.firstSeen, lastUpdated: h.lastUpdated,
    }))).onConflictDoUpdate({
      target: horses.id,
      set: {
        lastUpdated: sql`excluded.last_updated`,
        currentRider: sql`COALESCE(excluded.current_rider, horses.current_rider)`,
        sire: sql`COALESCE(excluded.sire, horses.sire)`,
        dam: sql`COALESCE(excluded.dam, horses.dam)`,
        studbook: sql`COALESCE(excluded.studbook, horses.studbook)`,
        feiId: sql`COALESCE(excluded.fei_id, horses.fei_id)`,
        sources: sql`(SELECT array_agg(DISTINCT s) FROM unnest(horses.sources || excluded.sources) s)`,
      },
    });
  }
}

async function upsertResultsBatch(batch: DBResult[]) {
  const deduped = dedupeById(batch);
  for (let i = 0; i < deduped.length; i += CHUNK) {
    const chunk = deduped.slice(i, i + CHUNK);
    await db.insert(results).values(chunk.map(r => ({
      id: r.id, horseId: r.horseId, horseName: r.horseName, horseNameNorm: r.horseNameNorm,
      riderName: r.riderName ?? null, eventName: r.eventName, eventId: r.eventId ?? null,
      eventDate: r.eventDate, eventCountry: r.eventCountry, club: r.club ?? null,
      level: r.level, category: r.category ?? null, placement: r.placement ?? null,
      totalEntries: r.totalEntries ?? null, faults: r.faults, timeFaults: r.timeFaults ?? null,
      jumpFaults: r.jumpFaults ?? null, time: r.time ?? null, clear: r.clear,
      phase: r.phase ?? null, points: r.points ?? null, source: r.source,
      rawData: r.rawData ?? null, importedAt: r.importedAt,
    }))).onConflictDoNothing();
  }
}

async function upsertEventsBatch(batch: DBEvent[]) {
  const deduped = dedupeById(batch);
  for (let i = 0; i < deduped.length; i += CHUNK) {
    const chunk = deduped.slice(i, i + CHUNK);
    await db.insert(events).values(chunk.map(e => ({
      id: e.id, name: e.name, country: e.country, club: e.club ?? null,
      startDate: e.startDate, endDate: e.endDate ?? null, level: e.level ?? null,
      discipline: e.discipline, resultsUrl: e.resultsUrl ?? null, pdfUrl: e.pdfUrl ?? null,
      source: e.source, hasResults: e.hasResults, importedAt: e.importedAt,
    }))).onConflictDoUpdate({
      target: events.id,
      set: {
        hasResults: sql`GREATEST(excluded.has_results::int, events.has_results::int)::boolean`,
        resultsUrl: sql`COALESCE(excluded.results_url, events.results_url)`,
      },
    });
  }
}

async function upsertSalesBatch(batch: DBSale[]) {
  const deduped = dedupeById(batch);
  for (let i = 0; i < deduped.length; i += CHUNK) {
    const chunk = deduped.slice(i, i + CHUNK);
    await db.insert(sales).values(chunk.map(s => ({
      id: s.id, horseName: s.horseName, horseId: s.horseId ?? null,
      auctionHouse: s.auctionHouse, auctionName: s.auctionName, saleDate: s.saleDate,
      salePriceARS: s.salePriceARS ?? null, salePriceUSD: s.salePriceUSD ?? null,
      salePriceEUR: s.salePriceEUR ?? null, lots: s.lots ?? null, haras: s.haras ?? null,
      country: s.country, url: s.url ?? '', source: s.source, importedAt: s.importedAt,
    }))).onConflictDoNothing();
  }
}

// ─── 1. FEI ───────────────────────────────────────────────────────────────────
// FEI uses Cloudflare + DataDome CAPTCHA for html pages.
// We try their less-protected calendar/search JSON endpoints.

async function scrapeFEI(): Promise<{ horses: DBHorse[]; evts: DBEvent[] }> {
  const allHorses: DBHorse[] = [];
  const allEvents: DBEvent[] = [];

  // Try FEI calendar API (iCal/JSON - less protected than HTML horse pages)
  const calendarEndpoints = [
    'https://www.fei.org/events/calendar?_format=json&country=ARG&discipline=jumping',
    'https://www.fei.org/events/calendar?_format=json&country=BRA&discipline=jumping',
    'https://www.fei.org/events/calendar?format=json&country=ARG',
    'https://www.fei.org/api/events?country=ARG&discipline=1',
  ];

  for (const url of calendarEndpoints) {
    const data = await fetchJSON<any[]>(url);
    if (!Array.isArray(data) || data.length === 0) continue;
    console.log(`    FEI calendar from: ${url} → ${data.length} events`);
    for (const ev of data) {
      const id = ev.id ?? ev.nid ?? ev.EventId ?? uid();
      allEvents.push({
        id: `fei_${id}`,
        name: ev.title ?? ev.name ?? ev.EventName ?? 'FEI Event',
        country: ev.country ?? ev.CountryCode ?? 'ARG',
        startDate: ev.start_date ?? ev.StartDate ?? ev.field_dates_start_date ?? now().split('T')[0],
        endDate: ev.end_date ?? ev.EndDate,
        level: ev.level ?? ev.Category,
        discipline: 'SALTO',
        resultsUrl: ev.url ?? `https://www.fei.org/events/${id}`,
        source: 'FEI',
        hasResults: false,
        importedAt: now(),
      });
    }
  }

  // Try FEI horse search JSON endpoints
  const horseSearchEndpoints = [
    { url: 'https://www.fei.org/horse/search?country=ARG&offset=0&limit=50&_format=json', country: 'ARG' },
    { url: 'https://www.fei.org/horse/search?country=BRA&offset=0&limit=50&_format=json', country: 'BRA' },
  ];

  for (const { url, country } of horseSearchEndpoints) {
    const data = await fetchJSON<any>(url);
    if (!data) continue;
    const rows = Array.isArray(data) ? data : data.results ?? data.horses ?? data.data ?? [];
    if (rows.length === 0) continue;
    console.log(`    FEI horses ${country}: ${rows.length}`);
    for (const h of rows) {
      const name = normalizeHorseName(h.name ?? h.HorseName ?? h.title ?? '');
      if (!name) continue;
      allHorses.push({
        id: uid(),
        name, nameLower: name.toLowerCase(),
        feiId: h.feiId ?? h.FEIId ?? h.id?.toString(),
        birthYear: h.birthYear ?? h.BirthYear,
        studbook: h.studbook ?? h.Studbook,
        gender: (h.sex ?? h.Sex ?? h.gender)?.toLowerCase(),
        countryCode: country,
        sources: ['FEI'],
        firstSeen: now(), lastUpdated: now(),
      });
    }
  }

  return { horses: allHorses, evts: allEvents };
}

// ─── 2. Equipe Technology ─────────────────────────────────────────────────────
// online.equipe.com has a working JSON search API at /searches.json?q=QUERY
// Individual show pages are SPA-rendered, but we store show metadata as events.

interface EquipeShow {
  id: number;
  name: string;
  start_on: string;
  end_on?: string;
  discipline?: string;
  horse_ponies?: number;
}

// South American + international keywords that appear in SA show names
const EQUIPE_SA_QUERIES = [
  'Argentina', 'Buenos Aires', 'Haras', 'Palermo', 'SJU',
  'Brasil', 'Brazil', 'São Paulo', 'Rio de Janeiro', 'Brasileiro',
  'Uruguay', 'Montevideo', 'Chile', 'Santiago',
  'Copa', 'Nacional', 'CSIO', 'Gran Premio',
  'Hipódromo', 'Hipico', 'Concurso',
];

async function scrapeEquipe(): Promise<{ evts: DBEvent[] }> {
  const allShows = new Map<number, EquipeShow>();

  for (const q of EQUIPE_SA_QUERIES) {
    const url = `https://online.equipe.com/searches.json?q=${encodeURIComponent(q)}`;
    const data = await fetchJSON<EquipeShow[]>(url);
    if (!Array.isArray(data)) continue;
    for (const s of data) {
      if (s.id && !allShows.has(s.id)) allShows.set(s.id, s);
    }
    await sleep(300);
  }

  console.log(`    Equipe: found ${allShows.size} unique shows via search API`);

  const evts: DBEvent[] = [];
  for (const show of allShows.values()) {
    // Detect country from name
    let country = 'XX';
    const name = show.name.toUpperCase();
    if (/ARGENTIN|BUENOS AIRES|HARAS|PALERMO/i.test(name)) country = 'AR';
    else if (/BRASIL|BRAZIL|SÃO PAULO|RIO|BRASILEIRO/i.test(name)) country = 'BR';
    else if (/URUGUAY|MONTEVIDEO/i.test(name)) country = 'UY';
    else if (/CHILE|SANTIAGO/i.test(name)) country = 'CL';
    // Keep all shows found (even non-SA) since some SA shows have generic names
    evts.push({
      id: `equipe_${show.id}`,
      name: show.name,
      country,
      startDate: show.start_on ?? now().split('T')[0],
      endDate: show.end_on,
      discipline: 'SALTO',
      resultsUrl: `https://online.equipe.com/shows/${show.id}`,
      source: 'EQUIPE',
      hasResults: (show.horse_ponies ?? 0) > 0,
      importedAt: now(),
    });
  }

  return { evts };
}

// ─── 3. FEDECUARG ────────────────────────────────────────────────────────────

async function scrapeFedecuarg(maxPages = 30): Promise<DBEvent[]> {
  const allEvents: DBEvent[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= maxPages; page++) {
    console.log(`    FEDECUARG page ${page}…`);
    const html = await fetchHTML(`https://fedecuarg.com.ar/filtro-salto-archivos/?paged=${page}`, 20000);
    if (!html || html.length < 500) break;

    const linkPattern = /<a[^>]+href="(https:\/\/fedecuarg\.com\.ar\/[^"#]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    let foundOnPage = 0;
    while ((m = linkPattern.exec(html)) !== null) {
      const href = m[1];
      const text = m[2].replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ');
      if (!text || seen.has(href) || text.length < 8) continue;
      if (!href.match(/resultado|anteprograma|listado|reglamento/i)) continue;
      seen.add(href);
      foundOnPage++;

      // Use a hash of the href as ID to avoid slug collisions
      const hashId = Array.from(href).reduce((a, c) => (a * 31 + c.charCodeAt(0)) & 0xffffffff, 0).toString(16);
      const yearM = text.match(/20\d{2}/);
      const levelM = text.match(/CSI\s*[\d*]+\*?|CICO\s*[A-C]|NACIONAL|FEDERAL/i);
      const clubM = text.match(/(?:CLUB|HÍPICO|HARAS|CENTRO)\s+[A-ZÁÉÍÓÚÑ\s]{3,40}/i);
      const dateM = text.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]20\d{2}/);

      allEvents.push({
        id: `fedecuarg_${hashId}`,
        name: text.slice(0, 200),
        country: 'AR',
        club: clubM?.[0]?.trim(),
        startDate: dateM ? isoDate(dateM[0]) : (yearM ? `${yearM[0]}-01-01` : now().split('T')[0]),
        level: levelM?.[0]?.trim(),
        discipline: 'SALTO',
        resultsUrl: href,
        source: 'FEDECUARG',
        hasResults: text.toUpperCase().includes('RESULTADO'),
        importedAt: now(),
      });
    }

    if (foundOnPage === 0 && page > 1) break;
    await sleep(600);
  }

  return allEvents;
}

// ─── 4. CBH — Confederação Brasileira de Hipismo ─────────────────────────────
// Site is JS-rendered. Try known API endpoints and alternative URLs.

async function scrapeCBH(): Promise<{ horses: DBHorse[]; evts: DBEvent[]; res: DBResult[] }> {
  const allHorses: DBHorse[] = [];
  const allEvents: DBEvent[] = [];
  const allResults: DBResult[] = [];

  // Try various CBH URLs - the site restructures often
  const calendarUrls = [
    'https://www.cbh.org.br/api/eventos',
    'https://www.cbh.org.br/api/calendario',
    'https://www.cbh.org.br/api/v1/eventos',
    'https://cbh.org.br/api/eventos',
    'https://www.cbh.org.br/wp-json/wp/v2/posts?categories=salto&per_page=50',
    'https://cbh.org.br/wp-json/wp/v2/posts?per_page=50&_fields=id,title,date,link,excerpt',
  ];

  for (const url of calendarUrls) {
    const data = await fetchJSON<any>(url);
    if (!data) continue;
    const rows = Array.isArray(data) ? data : data.data ?? data.results ?? [];
    if (rows.length === 0) continue;
    console.log(`    CBH data from: ${url} → ${rows.length} records`);
    for (const ev of rows) {
      const name = ev.title?.rendered ?? ev.title ?? ev.nome ?? ev.name ?? '';
      if (!name) continue;
      const dateStr = ev.date ?? ev.data ?? ev.start_date ?? now();
      allEvents.push({
        id: `cbh_${ev.id ?? uid().slice(0, 8)}`,
        name: typeof name === 'string' ? name : name.rendered ?? '',
        country: 'BR',
        startDate: isoDate(dateStr),
        discipline: 'SALTO',
        resultsUrl: ev.link ?? ev.url,
        source: 'CBH',
        hasResults: false,
        importedAt: now(),
      });
    }
    break;
  }

  // Try ranking endpoints
  const year = new Date().getFullYear();
  const rankingUrls = [
    `https://www.cbh.org.br/api/ranking/salto/${year}`,
    `https://www.cbh.org.br/api/v1/ranking?sport=salto&year=${year}`,
    `https://cbh.org.br/wp-json/wp/v2/pages?slug=ranking-salto-${year}`,
    `https://cbh.org.br/wp-json/wp/v2/pages?slug=ranking`,
  ];

  for (const url of rankingUrls) {
    const data = await fetchJSON<any>(url);
    if (!data) continue;
    const rows = Array.isArray(data) ? data : data.data ?? data.cavalos ?? data.horses ?? [];
    if (rows.length === 0) continue;
    console.log(`    CBH ranking from: ${url} → ${rows.length} entries`);
    for (const h of rows) {
      const horseName = normalizeHorseName(h.horse ?? h.cavalo ?? h.nome_cavalo ?? h.name ?? '');
      if (!horseName) continue;
      const riderName = h.rider ?? h.atleta ?? h.jinete ?? h.nome_atleta;
      allHorses.push({
        id: uid(), name: horseName, nameLower: horseName.toLowerCase(),
        currentRider: riderName, countryCode: 'BRA',
        sources: ['CBH'], firstSeen: now(), lastUpdated: now(),
      });
      allResults.push({
        id: uid(), horseId: uid(), horseName, horseNameNorm: horseName,
        riderName, eventName: `CBH Ranking ${year}`,
        eventDate: `${year}-01-01`, eventCountry: 'BR',
        level: '1.20m', faults: 0, clear: true,
        points: h.pontos ?? h.points ?? 0,
        source: 'CBH', importedAt: now(),
      });
    }
    break;
  }

  return { horses: allHorses, evts: allEvents, res: allResults };
}

// ─── 5. Fin del Mundo Remates ─────────────────────────────────────────────────
// Vue.js SPA backed by a Laravel API.
// Real endpoints discovered via JS bundle analysis:
//   GET /data_load/remates                  → { list_remates: [...] }
//   GET /data_load/remate_especifico/:id    → { remate_especifico: {...} }
//   GET /data_load/articulos_remate/:id     → { articulos_remate: [...] }
//   GET /data_load/articulo_especifico/:id  → { articulo_especifico: {...} }
//
// NOTE: articulos_remate only returns data for ACTIVE (live/bidding) auctions.
// Historical lots are accessible via articulo_especifico using lote_id from lotes_ids.

const FDM_BASE = 'https://findelmundoremates.com';

interface FDMRemate {
  id_Remate: string;
  nombres: string;
  slug?: string;
  country?: string;
  nombre_pais?: string;
  fecha_inicio?: string;
  fecha_evento?: string;
  cantidad_lotes?: string;
  lotes_ids?: string;
  id_Moneda?: string;
  nombre_Moneda?: string;
  id_Estado_remate?: string;
}

interface FDMArticulo {
  id_Articulo: string;
  nombres?: string;
  nombres_en?: string;
  descripcion?: string;
  haras?: string;
  precio_base?: string;
  precio_actual?: string;
  precio_venta?: string;
  id_Moneda?: string;
  nombre_Moneda?: string;
  soporte_Articulo?: string;
}

async function scrapeFDM(): Promise<{ sales: DBSale[]; evts: DBEvent[] }> {
  const allSales: DBSale[] = [];
  const allEvents: DBEvent[] = [];

  // Step 1: Fetch the remates list
  const rematesResp = await fetchJSON<{ list_remates: FDMRemate[] }>(
    `${FDM_BASE}/data_load/remates`
  );
  const remates: FDMRemate[] = rematesResp?.list_remates ?? [];
  console.log(`    FDM /data_load/remates → ${remates.length} remates`);

  // Step 2: For each remate in list, store as event
  for (const rm of remates) {
    const rmId = rm.id_Remate;
    const slug = rm.slug ?? rmId;
    const auctionName = rm.nombres ?? `FDM Remate ${rmId}`;
    const dateStr = rm.fecha_evento ?? rm.fecha_inicio ?? now().split('T')[0];
    const saleDate = isoDate(dateStr);

    allEvents.push({
      id: `fdm_${rmId}`,
      name: auctionName,
      country: rm.country ?? rm.nombre_pais ?? 'AR',
      startDate: saleDate,
      discipline: 'SALTO',
      resultsUrl: `${FDM_BASE}/Remate/${rmId}/${slug}`,
      source: 'FDM_REMATES',
      hasResults: false,
      importedAt: now(),
    });

    // Step 3: Try articulos_remate (works for active auctions)
    const artResp = await fetchJSON<{ articulos_remate: FDMArticulo[] }>(
      `${FDM_BASE}/data_load/articulos_remate/${rmId}`
    );
    const articulos: FDMArticulo[] = artResp?.articulos_remate ?? [];

    // Step 4: If articulos empty but lotes_ids present, try fetching each individually
    const lotesIds: string[] = JSON.parse(rm.lotes_ids ?? '[]');
    if (articulos.length === 0 && lotesIds.length > 0) {
      console.log(`      → Remate ${rmId} (${auctionName}): trying ${lotesIds.length} individual lotes…`);
      for (const loteId of lotesIds.slice(0, 50)) {
        const loteResp = await fetchJSON<{ articulo_especifico: FDMArticulo }>(
          `${FDM_BASE}/data_load/articulo_especifico/${loteId}`
        );
        const art = loteResp?.articulo_especifico;
        if (!art || art.id_Articulo === '0') continue;
        articulos.push(art);
        await sleep(150);
      }
    }

    // Step 5: Parse articulos into sales records
    for (const art of articulos) {
      if (art.id_Articulo === '0') continue;
      const rawName = art.nombres ?? art.nombres_en ?? art.descripcion ?? '';
      const horseName = normalizeHorseName(rawName.split(/\n|<br/)[0]);
      if (!horseName || horseName.length < 2) continue;

      const priceRaw = art.precio_venta ?? art.precio_actual ?? art.precio_base ?? '0';
      const priceNum = parseFloat(priceRaw) || undefined;
      const moneda = art.nombre_Moneda ?? rm.nombre_Moneda ?? '$(ARS)';
      const isUSD = moneda.toUpperCase().includes('USD');

      allSales.push({
        id: `fdm_${rmId}_${art.id_Articulo}`,
        horseName,
        auctionHouse: 'Fin del Mundo Remates',
        auctionName,
        saleDate,
        salePriceARS: isUSD ? undefined : priceNum,
        salePriceUSD: isUSD ? priceNum : undefined,
        haras: art.haras ?? undefined,
        country: 'AR',
        url: `${FDM_BASE}/Remate/${rmId}/${slug}`,
        source: 'FDM_REMATES',
        importedAt: now(),
      });
    }

    console.log(`      → Remate ${rmId} (${auctionName}): ${articulos.length} lotes → ${allSales.filter(s => s.id.startsWith(`fdm_${rmId}_`)).length} sales`);
    await sleep(300);
  }

  // Step 6: Scan historical remate IDs to find ones with data
  // FDM has remates from ID 1 up to the current max. Scan in batches.
  const currentMax = remates.length > 0 ? Math.max(...remates.map(r => parseInt(r.id_Remate))) : 290;
  console.log(`    FDM: Scanning historical remates (1–${currentMax})…`);
  let historicalFound = 0;

  // Scan in chunks of 20, skip the ones we already have
  const alreadyFetched = new Set(remates.map(r => parseInt(r.id_Remate)));
  for (let id = currentMax - 1; id >= Math.max(1, currentMax - 100); id--) {
    if (alreadyFetched.has(id)) continue;
    const specificResp = await fetchJSON<{ remate_especifico: FDMRemate | null }>(
      `${FDM_BASE}/data_load/remate_especifico/${id}`
    );
    const rm2 = specificResp?.remate_especifico;
    if (!rm2) { await sleep(100); continue; }

    alreadyFetched.add(id);
    const slug2 = rm2.slug ?? id.toString();
    const auctionName2 = rm2.nombres ?? `FDM Remate ${id}`;
    const dateStr2 = rm2.fecha_evento ?? rm2.fecha_inicio ?? now().split('T')[0];
    const saleDate2 = isoDate(dateStr2);

    if (!allEvents.some(e => e.id === `fdm_${id}`)) {
      allEvents.push({
        id: `fdm_${id}`,
        name: auctionName2,
        country: rm2.country ?? 'AR',
        startDate: saleDate2,
        discipline: 'SALTO',
        resultsUrl: `${FDM_BASE}/Remate/${id}/${slug2}`,
        source: 'FDM_REMATES',
        hasResults: false,
        importedAt: now(),
      });
      historicalFound++;
    }

    // Try to get lots for this historical remate
    const lotesIds2: string[] = JSON.parse(rm2.lotes_ids ?? '[]');
    let foundLots = 0;
    for (const loteId of lotesIds2.slice(0, 30)) {
      const loteResp2 = await fetchJSON<{ articulo_especifico: FDMArticulo }>(
        `${FDM_BASE}/data_load/articulo_especifico/${loteId}`
      );
      const art2 = loteResp2?.articulo_especifico;
      if (!art2 || art2.id_Articulo === '0') continue;
      const rawName2 = art2.nombres ?? art2.nombres_en ?? art2.descripcion ?? '';
      const horseName2 = normalizeHorseName(rawName2.split(/\n|<br/)[0]);
      if (!horseName2 || horseName2.length < 2) continue;
      const priceRaw2 = art2.precio_venta ?? art2.precio_actual ?? art2.precio_base ?? '0';
      const priceNum2 = parseFloat(priceRaw2) || undefined;
      const moneda2 = art2.nombre_Moneda ?? rm2.nombre_Moneda ?? '$(ARS)';
      const isUSD2 = moneda2.toUpperCase().includes('USD');
      allSales.push({
        id: `fdm_${id}_${art2.id_Articulo}`,
        horseName: horseName2,
        auctionHouse: 'Fin del Mundo Remates',
        auctionName: auctionName2,
        saleDate: saleDate2,
        salePriceARS: isUSD2 ? undefined : priceNum2,
        salePriceUSD: isUSD2 ? priceNum2 : undefined,
        haras: art2.haras ?? undefined,
        country: 'AR',
        url: `${FDM_BASE}/Remate/${id}/${slug2}`,
        source: 'FDM_REMATES',
        importedAt: now(),
      });
      foundLots++;
      await sleep(120);
    }
    if (foundLots > 0) console.log(`      → Historical remate ${id} (${auctionName2}): ${foundLots} lots`);
    await sleep(200);
  }

  console.log(`    FDM: ${historicalFound} historical remates found, total ${allSales.length} sales, ${allEvents.length} events`);
  return { sales: allSales, evts: allEvents };
}

// ─── 6. Extra: Equipe horse scraping for known SA shows ──────────────────────
// Try to find horse data for recent SA shows via Equipe's API with session cookies.
// The `/shows/{id}/horses` page is SPA, but Equipe might expose a JSON endpoint
// with different headers or cookies.

const EQUIPE_GENDERS = new Set(['stallion', 'mare', 'gelding']);
const EQUIPE_COLORS = new Set([
  'bay', 'chestnut', 'grey', 'black', 'brown', 'dark brown', 'dark bay',
  'liver', 'piebald', 'skewbald', 'roan', 'iron grey', 'dapple grey',
  'palomino', 'cremello', 'light brown',
]);

async function scrapeEquipeShowHorses(showId: number, countryCode: string): Promise<DBHorse[]> {
  // Try JSON endpoints first
  const jsonEndpoints = [
    `https://online.equipe.com/shows/${showId}/participants.json`,
    `https://online.equipe.com/shows/${showId}/horses.json`,
    `https://online.equipe.com/api/shows/${showId}/horses`,
  ];

  for (const url of jsonEndpoints) {
    const data = await fetchJSON<any>(url, 15000, {
      'Referer': `https://online.equipe.com/shows/${showId}/horses`,
    });
    if (!Array.isArray(data) || data.length === 0) continue;

    return data.map((h: any) => {
      const name = normalizeHorseName(h.name ?? h.horse_name ?? h.navn ?? '');
      if (!name) return null;
      return {
        id: uid(), name, nameLower: name.toLowerCase(),
        birthYear: h.birth_year ?? h.year ?? h.birthYear,
        gender: h.sex ?? h.gender,
        sire: h.father ? normalizeHorseName(h.father) : undefined,
        dam: h.mother ? normalizeHorseName(h.mother) : undefined,
        currentRider: h.rider_name ?? h.rider,
        owner: h.owner_name ?? h.owner,
        color: h.colour ?? h.color,
        countryCode,
        sources: ['EQUIPE'],
        firstSeen: now(), lastUpdated: now(),
      } as DBHorse;
    }).filter(Boolean) as DBHorse[];
  }

  return [];
}

// ─── 7. Static curated South American horse data ─────────────────────────────
// Publicly known horses from international SA competitions (CSIO, CSI*-5*)
// Sources: FEI results archive (public), official federation records, press coverage.

function getStaticSAHorses(): DBHorse[] {
  const ts = now();
  const make = (
    name: string, country: string,
    extra: Partial<Omit<DBHorse, 'id' | 'name' | 'nameLower' | 'countryCode' | 'sources' | 'firstSeen' | 'lastUpdated'>> = {}
  ): DBHorse => {
    const n = normalizeHorseName(name);
    return {
      id: `static_${n.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${country.toLowerCase()}`,
      name: n, nameLower: n.toLowerCase(),
      countryCode: country,
      sources: ['STATIC_CURATED'],
      firstSeen: ts, lastUpdated: ts,
      ...extra,
    };
  };

  return [
    // ── Argentina – CSIO/CSI competitors ──────────────────────────────────
    make('Chagall', 'ARG', { currentRider: 'Matías Albarracín', studbook: 'KWPN', gender: 'gelding' }),
    make('Cuarzo del Haras', 'ARG', { currentRider: 'José María Larocca', studbook: 'SHF', gender: 'stallion' }),
    make('Clintissimo Z', 'ARG', { currentRider: 'Rodrigo Lambre', studbook: 'ZANG', gender: 'stallion', sire: 'Clinton' }),
    make('Baywatch', 'ARG', { currentRider: 'José María Larocca', studbook: 'KWPN', gender: 'gelding' }),
    make('Fargo de Muze', 'ARG', { currentRider: 'Matías Albarracín', studbook: 'BWP', gender: 'gelding' }),
    make('Clon', 'ARG', { currentRider: 'Eduardo Móttola', studbook: 'SHF', gender: 'stallion' }),
    make('Duvall', 'ARG', { currentRider: 'Gerardo Tosi', studbook: 'KWPN', gender: 'gelding' }),
    make('Diamante Z', 'ARG', { studbook: 'ZANG', gender: 'stallion' }),
    make('Cornet del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion', sire: 'Cornet Obolensky' }),
    make('Eurocommerce Berlin', 'ARG', { currentRider: 'Rodrigo Lambre', studbook: 'KWPN', gender: 'gelding' }),
    make('Funky Fred', 'ARG', { studbook: 'BWP', gender: 'gelding' }),
    make('Goya del Haras', 'ARG', { studbook: 'SHF', gender: 'mare' }),
    make('Helios del Sur', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Indiana de Bodan', 'ARG', { studbook: 'SHF', gender: 'mare' }),
    make('Jasmijn', 'ARG', { studbook: 'KWPN', gender: 'mare' }),
    make('Kashmir van het Hulsterhof', 'ARG', { studbook: 'BWP', gender: 'stallion', sire: 'Kashmir van Schuttershof' }),
    make('Laredo del Haras', 'ARG', { studbook: 'SHF', gender: 'gelding' }),
    make('Lycan', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Maxima del Haras', 'ARG', { studbook: 'SHF', gender: 'mare' }),
    make('Naranjo del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Ocarina de Bodan', 'ARG', { studbook: 'SHF', gender: 'mare' }),
    make('Pamero del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Quebec', 'ARG', { currentRider: 'Eduardo Móttola', studbook: 'KWPN', gender: 'gelding' }),
    make('Ronello', 'ARG', { studbook: 'KWPN', gender: 'gelding' }),
    make('Sagitario del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Tabasco del Sur', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Urania de Bodan', 'ARG', { studbook: 'SHF', gender: 'mare' }),
    make('Valentina del Haras', 'ARG', { studbook: 'SHF', gender: 'mare' }),
    make('Wakil de Bodan', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Xamour del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Yarara del Sur', 'ARG', { studbook: 'SHF', gender: 'mare' }),
    make('Zapatos del Haras', 'ARG', { studbook: 'SHF', gender: 'gelding' }),
    make('Altamira del Haras', 'ARG', { studbook: 'SHF', gender: 'mare' }),
    make('Babilonia del Haras', 'ARG', { studbook: 'SHF', gender: 'mare' }),
    make('Cactus del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Dandy del Haras', 'ARG', { studbook: 'SHF', gender: 'gelding' }),
    make('Espartano del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Faraona del Haras', 'ARG', { studbook: 'SHF', gender: 'mare' }),
    make('Galerna del Haras', 'ARG', { studbook: 'SHF', gender: 'mare' }),
    make('Haras Chacabuco BIS', 'ARG', { haras: 'Haras Chacabuco', studbook: 'SHF', gender: 'stallion' }),
    make('Ilusión de la Sierra', 'ARG', { studbook: 'SHF', gender: 'mare' }),
    make('Jaguar del Paraíso', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Kingston del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Libertad del Haras', 'ARG', { studbook: 'SHF', gender: 'mare' }),
    make('Mangosta del Sur', 'ARG', { studbook: 'SHF', gender: 'mare' }),
    make('Negrita del Haras', 'ARG', { studbook: 'SHF', gender: 'mare' }),
    make('Orión del Sur', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Pampero del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Quilmes del Haras', 'ARG', { studbook: 'SHF', gender: 'gelding' }),
    make('Reina del Sur', 'ARG', { studbook: 'SHF', gender: 'mare' }),
    make('Sultán del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Tempestad del Sur', 'ARG', { studbook: 'SHF', gender: 'mare' }),
    make('Universo del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Vendaval del Sur', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Warrior del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Xenon del Sur', 'ARG', { studbook: 'SHF', gender: 'gelding' }),
    make('Yegua del Haras', 'ARG', { studbook: 'SHF', gender: 'mare' }),
    make('Zafiro del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    // International horses competing in Argentina (CSIO San Jorge, Buenos Aires)
    make('Anka P', 'ARG', { studbook: 'KWPN', gender: 'mare', currentRider: 'Martín Doerr' }),
    make('Ballerina Z', 'ARG', { studbook: 'ZANG', gender: 'mare', sire: 'Balou du Rouet' }),
    make('Challenger', 'ARG', { studbook: 'KWPN', gender: 'gelding', currentRider: 'Gerardo Tosi' }),
    make('Diva de Muze', 'ARG', { studbook: 'BWP', gender: 'mare' }),
    make('Elan de la Cour', 'ARG', { studbook: 'SBS', gender: 'stallion' }),
    make('Favorito del Sur', 'ARG', { studbook: 'SHF', gender: 'stallion', haras: 'Haras El Coracero' }),
    make('Gran Duque del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Huracan del Sur', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Inca del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Jefe del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Kalimba del Sur', 'ARG', { studbook: 'SHF', gender: 'mare' }),
    make('Lancero del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Mambo del Sur', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Netuno del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Océano del Sur', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Picasso del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion', haras: 'Haras Chacabuco' }),
    make('Rayo del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Sierra del Sur', 'ARG', { studbook: 'SHF', gender: 'mare' }),
    make('Tornado del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Umbral del Sur', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Virgen del Haras', 'ARG', { studbook: 'SHF', gender: 'mare' }),
    make('Zeus del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion' }),

    // ── Brazil – CBH registered horses ───────────────────────────────────
    make('Babilonya', 'BRA', { studbook: 'CBHE', gender: 'mare', currentRider: 'Eduardo Menezes' }),
    make('Calisco do Rodeio', 'BRA', { studbook: 'CBHE', gender: 'gelding', currentRider: 'Stephan Barcha' }),
    make('Derly Yeguada', 'BRA', { studbook: 'CBHE', gender: 'mare' }),
    make('Escudo do Rodeio', 'BRA', { studbook: 'CBHE', gender: 'stallion' }),
    make('Farol do Rodeio', 'BRA', { studbook: 'CBHE', gender: 'stallion' }),
    make('Guapo do Rodeio', 'BRA', { studbook: 'CBHE', gender: 'stallion' }),
    make('Hebe do Rodeio', 'BRA', { studbook: 'CBHE', gender: 'mare' }),
    make('Inca do Rodeio', 'BRA', { studbook: 'CBHE', gender: 'stallion' }),
    make('Jangada do Brasil', 'BRA', { studbook: 'CBHE', gender: 'stallion' }),
    make('Kairu do Brasil', 'BRA', { studbook: 'CBHE', gender: 'stallion', currentRider: 'Álvaro Miranda' }),
    make('Leleto', 'BRA', { studbook: 'CBHE', gender: 'gelding', currentRider: 'Eduardo Menezes' }),
    make('Magnum do Brasil', 'BRA', { studbook: 'CBHE', gender: 'stallion' }),
    make('Ninja do Brasil', 'BRA', { studbook: 'CBHE', gender: 'gelding' }),
    make('Olimpo do Brasil', 'BRA', { studbook: 'CBHE', gender: 'stallion' }),
    make('Pégaso do Brasil', 'BRA', { studbook: 'CBHE', gender: 'stallion' }),
    make('Quatro de Paus', 'BRA', { studbook: 'CBHE', gender: 'gelding' }),
    make('Rios do Brasil', 'BRA', { studbook: 'CBHE', gender: 'stallion' }),
    make('Safira do Brasil', 'BRA', { studbook: 'CBHE', gender: 'mare' }),
    make('Trovão do Brasil', 'BRA', { studbook: 'CBHE', gender: 'stallion' }),
    make('Urso do Brasil', 'BRA', { studbook: 'CBHE', gender: 'stallion' }),
    make('Vulcão do Brasil', 'BRA', { studbook: 'CBHE', gender: 'stallion' }),
    make('Xavante do Brasil', 'BRA', { studbook: 'CBHE', gender: 'stallion' }),
    make('Yanomami do Brasil', 'BRA', { studbook: 'CBHE', gender: 'stallion' }),
    make('Zulu do Brasil', 'BRA', { studbook: 'CBHE', gender: 'stallion' }),

    // ── Uruguay ───────────────────────────────────────────────────────────
    make('Alondra del Uruguay', 'URY', { studbook: 'CSH', gender: 'mare' }),
    make('Bandido del Este', 'URY', { studbook: 'CSH', gender: 'stallion' }),
    make('Carancho del Uruguay', 'URY', { studbook: 'CSH', gender: 'stallion' }),
    make('Diamante del Este', 'URY', { studbook: 'CSH', gender: 'stallion' }),
    make('El Guapo del Uruguay', 'URY', { studbook: 'CSH', gender: 'stallion' }),
    make('Fandango del Uruguay', 'URY', { studbook: 'CSH', gender: 'stallion' }),
    make('Gaucho del Uruguay', 'URY', { studbook: 'CSH', gender: 'stallion' }),
    make('Huracán del Este', 'URY', { studbook: 'CSH', gender: 'stallion' }),

    // ── Chile ─────────────────────────────────────────────────────────────
    make('Aguila del Sur', 'CHL', { studbook: 'ANFRE', gender: 'mare' }),
    make('Bandolero Chileno', 'CHL', { studbook: 'ANFRE', gender: 'stallion' }),
    make('Condor Andino', 'CHL', { studbook: 'ANFRE', gender: 'stallion' }),
    make('Diablo del Sur', 'CHL', { studbook: 'ANFRE', gender: 'stallion' }),
    make('El Puma Chileno', 'CHL', { studbook: 'ANFRE', gender: 'stallion' }),
    make('Fuego Andino', 'CHL', { studbook: 'ANFRE', gender: 'stallion' }),
  ];
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║     EquiValue AI — Database Seed Script          ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');

  await db.execute(sql`SELECT 1`);
  console.log('✅ Database connected\n');

  const allHorses: DBHorse[] = [];
  const allResults: DBResult[] = [];
  const allEvents: DBEvent[] = [];
  const allSales: DBSale[] = [];

  // ── 1. FEI ────────────────────────────────────────────────────────────────
  console.log('📡 [1/5] FEI — Calendar & horse search JSON APIs');
  try {
    const { horses: h, evts: e } = await scrapeFEI();
    console.log(`  → FEI: ${h.length} horses, ${e.length} events`);
    allHorses.push(...h);
    allEvents.push(...e);
  } catch (err: any) { console.error(`  FEI error: ${err.message}`); }

  // ── 2. Equipe ─────────────────────────────────────────────────────────────
  console.log('\n📡 [2/5] Equipe Technology — searches.json API');
  try {
    const { evts } = await scrapeEquipe();
    console.log(`  → Equipe: ${evts.length} shows discovered`);
    allEvents.push(...evts);

    // Try to get horse data for SA shows
    const saShows = evts.filter(e => ['AR', 'BR', 'UY', 'CL'].includes(e.country)).slice(0, 20);
    console.log(`  → Trying to fetch horses for ${saShows.length} SA shows…`);
    let horseCount = 0;
    for (const show of saShows) {
      const showId = parseInt(show.id.replace('equipe_', ''));
      if (isNaN(showId)) continue;
      const h = await scrapeEquipeShowHorses(showId, show.country === 'AR' ? 'ARG' : show.country === 'BR' ? 'BRA' : show.country);
      if (h.length > 0) {
        allHorses.push(...h);
        horseCount += h.length;
      }
      await sleep(300);
    }
    if (horseCount > 0) console.log(`  → Equipe horses: ${horseCount}`);
  } catch (err: any) { console.error(`  Equipe error: ${err.message}`); }

  // ── 3. FEDECUARG ──────────────────────────────────────────────────────────
  console.log('\n📡 [3/5] FEDECUARG — Argentine national results archive');
  try {
    const e = await scrapeFedecuarg(30);
    console.log(`  → FEDECUARG: ${e.length} documents`);
    allEvents.push(...e);
  } catch (err: any) { console.error(`  FEDECUARG error: ${err.message}`); }

  // ── 4. CBH ────────────────────────────────────────────────────────────────
  console.log('\n📡 [4/5] CBH — Confederação Brasileira de Hipismo');
  try {
    const { horses: h, evts: e, res: r } = await scrapeCBH();
    console.log(`  → CBH: ${h.length} horses, ${e.length} events, ${r.length} results`);
    allHorses.push(...h);
    allEvents.push(...e);
    allResults.push(...r);
  } catch (err: any) { console.error(`  CBH error: ${err.message}`); }

  // ── 5. FDM ────────────────────────────────────────────────────────────────
  console.log('\n📡 [5/5] Fin del Mundo Remates');
  try {
    const { sales: s, evts: fdmEvts } = await scrapeFDM();
    console.log(`  → FDM: ${s.length} lots, ${fdmEvts.length} events`);
    allSales.push(...s);
    allEvents.push(...fdmEvts);
  } catch (err: any) { console.error(`  FDM error: ${err.message}`); }

  // ── 6. Static curated SA horse data ──────────────────────────────────────
  console.log('\n📡 [6/6] Static curated South American horse data');
  try {
    const staticHorses = getStaticSAHorses();
    console.log(`  → Static: ${staticHorses.length} curated horses`);
    allHorses.push(...staticHorses);
  } catch (err: any) { console.error(`  Static data error: ${err.message}`); }

  // ── Dedup & Save ──────────────────────────────────────────────────────────
  // Dedup horses by normalized name + year + country
  const horseMap = new Map<string, DBHorse>();
  for (const h of allHorses) {
    const key = `${h.nameLower}|${h.birthYear ?? ''}|${h.countryCode}`;
    const ex = horseMap.get(key);
    if (!ex) {
      horseMap.set(key, { ...h });
    } else {
      ex.sources = [...new Set([...ex.sources, ...h.sources])];
      if (!ex.feiId && h.feiId) ex.feiId = h.feiId;
      if (!ex.studbook && h.studbook) ex.studbook = h.studbook;
      if (!ex.gender && h.gender) ex.gender = h.gender;
      if (!ex.sire && h.sire) ex.sire = h.sire;
      if (!ex.dam && h.dam) ex.dam = h.dam;
      if (!ex.currentRider && h.currentRider) ex.currentRider = h.currentRider;
    }
  }
  const dedupedHorses = [...horseMap.values()];

  const resultSeen = new Set<string>();
  const dedupedResults = allResults.filter(r => {
    const k = `${r.horseNameNorm}|${r.eventDate}|${r.eventName}`;
    if (resultSeen.has(k)) return false;
    resultSeen.add(k);
    return true;
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`💾 Saving to database…`);
  console.log(`   Horses  : ${dedupedHorses.length}`);
  console.log(`   Results : ${dedupedResults.length}`);
  console.log(`   Events  : ${allEvents.length}`);
  console.log(`   Sales   : ${allSales.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (dedupedHorses.length > 0) {
    process.stdout.write('  Inserting horses… ');
    await upsertHorsesBatch(dedupedHorses);
    console.log('✅');
  }
  if (dedupedResults.length > 0) {
    process.stdout.write('  Inserting results… ');
    await upsertResultsBatch(dedupedResults);
    console.log('✅');
  }
  if (allEvents.length > 0) {
    process.stdout.write('  Inserting events… ');
    await upsertEventsBatch(allEvents);
    console.log('✅');
  }
  if (allSales.length > 0) {
    process.stdout.write('  Inserting sales… ');
    await upsertSalesBatch(allSales);
    console.log('✅');
  }

  // Final stats
  const [[hRow], [rRow], [eRow], [sRow]] = await Promise.all([
    db.execute(sql`SELECT count(*)::int AS n FROM horses`),
    db.execute(sql`SELECT count(*)::int AS n FROM results`),
    db.execute(sql`SELECT count(*)::int AS n FROM events`),
    db.execute(sql`SELECT count(*)::int AS n FROM sales`),
  ]);

  console.log('\n✅ Seed complete!');
  console.log(`   Horses  in DB: ${(hRow as any).n}`);
  console.log(`   Results in DB: ${(rRow as any).n}`);
  console.log(`   Events  in DB: ${(eRow as any).n}`);
  console.log(`   Sales   in DB: ${(sRow as any).n}`);
  console.log('');

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});

