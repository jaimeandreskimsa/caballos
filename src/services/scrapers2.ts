/**
 * scrapers2.ts — Full data collection layer for EquiValue AI
 *
 * Sources covered:
 *  1. FEI — horses + events filtered by country (ARG, BRA, URU, PAR, CHI, BOL)
 *  2. Equipe Technology — competition management software used in 80%+ SA events
 *  3. FEDECUARG — Argentine national federation (764+ result PDFs + metadata)
 *  4. CBH — Confederação Brasileira de Hipismo (Brazil national)
 *  5. Fin del Mundo Remates — Argentine horse auction house (market prices)
 *  6. DATAFECH Chile — REST API (already exists, re-exported here for consistency)
 *
 * All client-side fetches go through allorigins.win CORS proxy.
 * Heavy parsing (PDF, large HTML) should be done server-side — these functions
 * return structured metadata + raw HTML/links for a background worker to process.
 */

import axios from 'axios';
import type { DBHorse, DBResult, DBEvent, DBSale, DataSource, JumpingLevel } from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PROXY = 'https://api.allorigins.win/get?url=';

async function fetchHTML(url: string, timeoutMs = 15000): Promise<string> {
  try {
    const { data } = await axios.get(`${PROXY}${encodeURIComponent(url)}`, { timeout: timeoutMs });
    return data?.contents ?? '';
  } catch {
    return '';
  }
}

function normalizeHorseName(name: string): string {
  return name.trim().toUpperCase().replace(/\s+/g, ' ').replace(/[^A-Z0-9 ''\-]/g, '');
}

function isoDate(raw: string): string {
  // try to parse dates in common formats: dd/mm/yyyy, yyyy-mm-dd, "05 MAY 2025"
  const dmY = raw.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (dmY) return `${dmY[3]}-${dmY[2].padStart(2, '0')}-${dmY[1].padStart(2, '0')}`;
  const Ymd = raw.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (Ymd) return `${Ymd[1]}-${Ymd[2].padStart(2, '0')}-${Ymd[3].padStart(2, '0')}`;
  const monthNames: Record<string, string> = {
    ENE:'01',FEB:'02',MAR:'03',ABR:'04',MAY:'05',JUN:'06',
    JUL:'07',AGO:'08',SEP:'09',OCT:'10',NOV:'11',DIC:'12',
    JAN:'01',AUG:'08',
  };
  const mdy = raw.match(/(\d{1,2})\s+([A-Z]{3})\s+(\d{4})/i);
  if (mdy) {
    const m = monthNames[mdy[2].toUpperCase()];
    if (m) return `${mdy[3]}-${m}-${mdy[1].padStart(2, '0')}`;
  }
  return new Date().toISOString().split('T')[0];
}

function mapLevel(raw: string): JumpingLevel {
  const heights: [string, JumpingLevel][] = [
    ['1.60', '1.60m'], ['1.55', '1.55m'], ['1.50', '1.50m'],
    ['1.45', '1.45m'], ['1.40', '1.40m'], ['1.35', '1.35m'],
    ['1.30', '1.30m'], ['1.25', '1.25m'], ['1.20', '1.20m'],
    ['1.10', '1.10m'], ['1.00', '1.00m'],
  ];
  const s = raw.toLowerCase();
  for (const [k, v] of heights) if (s.includes(k)) return v;
  if (/gran\s*prix|gp\b/i.test(raw)) return 'GP';
  return '1.20m';
}

// ─── 1. FEI Horse Search by Country ─────────────────────────────────────────
// fei.org/jumping/horses renders an HTML table we can paginate with ?country=XX

export async function feiFetchHorsesByCountry(
  countryCode: string,
  maxPages = 5
): Promise<DBHorse[]> {
  const horses: DBHorse[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= maxPages; page++) {
    const url = `https://www.fei.org/jumping/horses?country=${countryCode}&page=${page}`;
    const html = await fetchHTML(url);
    if (!html) break;

    // Pattern: table rows with horse name, studbook, birth year, sex
    // <td>Jumping 'NAME'  Born: YYYY Studbook: XX Sex: Mare</td>
    const rowPattern = /Jumping\s+['"]?([A-Z][A-Z\s''\-\d]{1,60})['"]?\s*Born:\s*(\d{4})\s*(?:Studbook:\s*([A-Z\s]+))?\s*(?:Sex:\s*(Stallion|Mare|Gelding))?/gi;
    let m: RegExpExecArray | null;
    while ((m = rowPattern.exec(html)) !== null) {
      const name = normalizeHorseName(m[1]);
      if (!name || seen.has(name)) continue;
      seen.add(name);
      horses.push({
        id: crypto.randomUUID(),
        name,
        nameLower: name.toLowerCase(),
        birthYear: m[2] ? parseInt(m[2]) : undefined,
        studbook: m[3]?.trim(),
        gender: (m[4]?.toLowerCase() as DBHorse['gender']) ?? undefined,
        countryCode,
        sources: ['FEI'],
        firstSeen: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      });
    }

    // Also grab horse links for further detail scraping
    const linkPattern = /href="(https:\/\/www\.fei\.org\/horse\/(\d+)\/[^"]+)"/g;
    let lm: RegExpExecArray | null;
    while ((lm = linkPattern.exec(html)) !== null) {
      // Store FEI ID hints — can be used for detail page
      const feiId = lm[2];
      const existing = horses.find(h => h.feiId === feiId);
      if (!existing && feiId) {
        // Will be enriched by feiFetchHorseDetail()
      }
    }

    if (!html.includes('page=' + (page + 1)) && !html.includes('LOAD MORE')) break;
  }

  return horses;
}

// ─── FEI Horse Detail (results history) ──────────────────────────────────────
export async function feiFetchHorseDetail(feiHorseId: string): Promise<{
  horse: Partial<DBHorse>;
  results: DBResult[];
}> {
  const url = `https://www.fei.org/horse/${feiHorseId}`;
  const html = await fetchHTML(url);
  if (!html) return { horse: {}, results: [] };

  const horse: Partial<DBHorse> = { feiId: feiHorseId, sources: ['FEI'] };
  const results: DBResult[] = [];

  // Extract name
  const nameM = html.match(/<h1[^>]*>\s*([A-Z][A-Z\s''\-]{1,60})\s*<\/h1>/i);
  if (nameM) horse.name = normalizeHorseName(nameM[1]);

  // Extract birth year
  const birthM = html.match(/Born[:\s]*(\d{4})/i);
  if (birthM) horse.birthYear = parseInt(birthM[1]);

  // Extract studbook
  const sbM = html.match(/Studbook[:\s]*([A-Z\s]{2,30})/i);
  if (sbM) horse.studbook = sbM[1].trim();

  // Parse competition results table
  // Format: | EventName | Date | Country | Level | Placement | Faults |
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowM: RegExpExecArray | null;
  while ((rowM = rowPattern.exec(html)) !== null) {
    const row = rowM[1].replace(/<[^>]+>/g, '\t');
    const cells = row.split('\t').map(s => s.trim()).filter(Boolean);
    if (cells.length < 4) continue;

    const dateM = cells.find(c => /\d{4}/.test(c) && /\d{2}/.test(c));
    const levelM = cells.find(c => /\d\.\d|grand prix|CSI/i.test(c));
    const faultsM = cells.find(c => /^\d{1,2}$/.test(c));
    const placeM = cells.find(c => /^\d{1,3}\/\d{1,3}$/.test(c));

    if (!dateM || !levelM) continue;

    const [placement, totalEntries] = placeM
      ? placeM.split('/').map(Number)
      : [undefined, undefined];

    results.push({
      id: crypto.randomUUID(),
      horseId: feiHorseId,
      horseName: horse.name ?? '',
      horseNameNorm: normalizeHorseName(horse.name ?? ''),
      eventName: cells[0] ?? '',
      eventDate: isoDate(dateM),
      eventCountry: cells.find(c => /^[A-Z]{3}$/.test(c)) ?? '',
      level: mapLevel(levelM),
      placement,
      totalEntries,
      faults: faultsM ? parseInt(faultsM) : 0,
      clear: faultsM === '0',
      source: 'FEI',
      importedAt: new Date().toISOString(),
    });
  }

  return { horse, results };
}

// ─── FEI Events by Country ────────────────────────────────────────────────────
export async function feiFetchEventsByCountry(countryCode: string): Promise<DBEvent[]> {
  const events: DBEvent[] = [];
  const html = await fetchHTML(`https://www.fei.org/jumping/events?country=${countryCode}`);
  if (!html) return events;

  // Pattern: <a href="/events/2026_CI_XXXX/CITY">CITY Jumping</a>  COUNTRY  CSI1*, CSI3*
  const eventPattern = /href="(\/events\/([\w_]+)\/([^"]+))"[^>]*>([\s\S]*?)<\/a>[\s\S]{0,400}?([A-Z]{3})\s+(CSI[\w,\s*]+|CSIO[\w,\s*]+)/g;
  let m: RegExpExecArray | null;
  while ((m = eventPattern.exec(html)) !== null) {
    const name = m[4].replace(/<[^>]+>/g, '').trim();
    if (!name) continue;
    events.push({
      id: m[2],
      name: `${name} (${m[3].replace(/-/g, ' ')})`,
      country: m[5],
      startDate: new Date().toISOString().split('T')[0], // enriched separately
      level: m[6]?.trim(),
      discipline: 'SALTO',
      resultsUrl: `https://www.fei.org${m[1]}`,
      source: 'FEI',
      hasResults: false,
      importedAt: new Date().toISOString(),
    });
  }

  // Fallback: simpler pattern for event dates
  const datePattern = /(\d{2})\s*-\s*(\d{2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)/gi;
  const dateMatches = [...html.matchAll(datePattern)];
  events.forEach((ev, i) => {
    if (dateMatches[i]) {
      const [, , endD, startM, endM] = dateMatches[i];
      const year = new Date().getFullYear();
      const monthMap: Record<string, string> = {
        JAN:'01',FEB:'02',MAR:'03',APR:'04',MAY:'05',JUN:'06',
        JUL:'07',AUG:'08',SEP:'09',OCT:'10',NOV:'11',DEC:'12',
      };
      ev.startDate = `${year}-${monthMap[startM.toUpperCase()] ?? '01'}-01`;
      ev.endDate = `${year}-${monthMap[endM.toUpperCase()] ?? '01'}-${endD}`;
    }
  });

  return events;
}

// ─── FEI Event Results ────────────────────────────────────────────────────────
export async function feiFetchEventResults(eventId: string): Promise<DBResult[]> {
  const url = `https://www.fei.org/events/${eventId}`;
  const html = await fetchHTML(url);
  if (!html) return [];

  const results: DBResult[] = [];

  // FEI renders results table: | Rank | Horse | Rider | NF | Faults | Time
  const tableSection = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
  for (const table of tableSection) {
    const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    for (const row of rows.slice(1)) { // skip header
      const cells = row[1].replace(/<[^>]+>/g, '\t').split('\t').map(s => s.trim()).filter(Boolean);
      if (cells.length < 4) continue;

      const [rank, horseName, riderName, country, faultsStr, timeStr] = cells;
      const placement = parseInt(rank);
      const faults = parseFloat(faultsStr ?? '0') || 0;
      const time = timeStr ? parseFloat(timeStr) : undefined;

      if (!horseName || horseName.length < 2) continue;

      results.push({
        id: crypto.randomUUID(),
        horseId: normalizeHorseName(horseName),
        horseName,
        horseNameNorm: normalizeHorseName(horseName),
        riderName,
        eventName: eventId,
        eventId,
        eventDate: new Date().toISOString().split('T')[0],
        eventCountry: country ?? '',
        level: '1.20m',
        placement: isNaN(placement) ? undefined : placement,
        faults,
        time,
        clear: faults === 0,
        source: 'FEI',
        importedAt: new Date().toISOString(),
      });
    }
  }

  return results;
}

// ─── 2. Equipe Technology — online.equipe.com ────────────────────────────────
// Public live results portal: https://online.equipe.com/
// Shows listed on homepage with 3-letter country code in title (e.g. "ARG", "BRA")
// Horse list:   https://online.equipe.com/shows/{ID}/horses
// Rider list:   https://online.equipe.com/shows/{ID}/riders
// Horse detail: https://online.equipe.com/horses/{HORSE_ID}

export interface EquipeShow {
  id: string;
  name: string;
  country: string;
  startDate: string;
  endDate?: string;
  level?: string;
  url: string;
}

const EQUIPE_BASE = 'https://online.equipe.com';

const EQUIPE_COLORS = new Set([
  'bay', 'chestnut', 'grey', 'black', 'brown', 'dark brown', 'dark bay',
  'liver', 'piebald', 'skewbald', 'roan', 'iron grey', 'dapple grey',
  'palomino', 'cremello', 'light brown', 'born darkbay', 'aubere',
]);
const EQUIPE_GENDERS = new Set(['stallion', 'mare', 'gelding']);

const EQUIPE_MONTH_ES: Record<string, string> = {
  enero:'01', febrero:'02', marzo:'03', abril:'04', mayo:'05', junio:'06',
  julio:'07', agosto:'08', septiembre:'09', octubre:'10', noviembre:'11', diciembre:'12',
};

function equipeParseSpanishDate(text: string): string {
  const m = text.match(/(\d{1,2})\s+([a-záéíóúñ]+)\s+(\d{4})/i);
  if (m) {
    const mo = EQUIPE_MONTH_ES[m[2].toLowerCase()];
    if (mo) return `${m[3]}-${mo}-${m[1].padStart(2, '0')}`;
  }
  return new Date().toISOString().split('T')[0];
}

function equipeParseShows(html: string, countryFilter?: string): EquipeShow[] {
  const shows: EquipeShow[] = [];
  const seen = new Set<string>();
  const pattern = /<a[^>]+href="\/shows\/(\d+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const id = m[1];
    if (seen.has(id)) continue;
    const text = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text || text.length < 5) continue;
    if (countryFilter && !text.includes(countryFilter)) continue;

    // Country code: 3-letter uppercase before a " | " or at end of name segment
    const countryM = text.match(/\b([A-Z]{3})\s*\|/) ?? text.match(/\s([A-Z]{3})\s/);
    const country = countryM?.[1] ?? countryFilter ?? '';

    const levelM = text.match(/\b(Internacional|Élite|Nacional|Autonómico|Local|Club)\b/i);

    // Extract all Spanish dates
    const dateRx = /(\d{1,2})\s+([a-záéíóúñ]+)\s+(\d{4})/gi;
    const dates: string[] = [];
    let dm: RegExpExecArray | null;
    while ((dm = dateRx.exec(text)) !== null) {
      const mo = EQUIPE_MONTH_ES[dm[2].toLowerCase()];
      if (mo) dates.push(`${dm[3]}-${mo}-${dm[1].padStart(2, '0')}`);
    }

    seen.add(id);
    shows.push({
      id,
      name: text.split('|')[0].replace(/\s+/g, ' ').trim(),
      country,
      startDate: dates[0] ?? new Date().toISOString().split('T')[0],
      endDate: dates.length > 1 ? dates[dates.length - 1] : undefined,
      level: levelM?.[1],
      url: `${EQUIPE_BASE}/shows/${id}`,
    });
  }
  return shows;
}

/** Find active shows for a given country code (e.g. "ARG", "BRA") */
export async function equipeSearchByCountry(countryCode: string): Promise<EquipeShow[]> {
  const html = await fetchHTML(EQUIPE_BASE);
  if (!html) return [];
  return equipeParseShows(html, countryCode.toUpperCase());
}

/** Generic show search — tries search endpoint then falls back to homepage */
export async function equipeSearchShows(query: string): Promise<EquipeShow[]> {
  const searchHtml = await fetchHTML(`${EQUIPE_BASE}/searches?q=${encodeURIComponent(query)}`);
  const searchResults = equipeParseShows(searchHtml);
  if (searchResults.length > 0) return searchResults;
  return equipeSearchByCountry(query.slice(0, 3));
}

/**
 * Fetch and parse the complete horse list for a show.
 *
 * Equipe horse-list format per link text:
 *   "{stallNo} {HorseName} [{Sire} - {Dam}] | {Color} | {Gender} | {Year} | {Rider} [| {Owner}]"
 * OR (no sire/dam):
 *   "{stallNo} {HorseName} {Color} | {Gender} | {Year} | {Rider}"
 */
export async function equipeFetchShowHorses(showId: string, countryCode = 'AR'): Promise<{
  horses: DBHorse[];
  event: Partial<DBEvent>;
}> {
  const url = `${EQUIPE_BASE}/shows/${showId}/horses`;
  const html = await fetchHTML(url, 20000);
  if (!html) return { horses: [], event: {} };

  // Show name
  const nameM = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ?? html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  const showName = nameM?.[1]?.replace(/<[^>]+>/g, '').trim() ?? `Equipe Show ${showId}`;

  // Show dates from page (look for date text in show header)
  const pageText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const startDate = equipeParseSpanishDate(pageText);

  const horses: DBHorse[] = [];
  const seen = new Set<string>();

  // Studbook suffixes that terminate the horse name
  const STUDBOOK = new Set([
    'Z','VDL','VH','VD','PS','TN','W','HS','SF','SG','HF','DK','AJ',
    'EC','BDA','DD','OS','CS','WW','AA','GH','JR','DP','SR','GS','NPS',
  ]);

  const horsePattern = /<a[^>]+href="\/horses\/(\d+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = horsePattern.exec(html)) !== null) {
    const equipeHorseId = m[1];
    if (seen.has(equipeHorseId)) continue;
    seen.add(equipeHorseId);

    const raw = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    // Drop leading stall / boot number (1–4 digits)
    const withoutStall = raw.replace(/^\d{1,4}\s+/, '');
    if (!withoutStall || withoutStall.length < 2) continue;

    const parts = withoutStall.split(/\s*\|\s*/);
    const firstPart = parts[0] ?? '';
    const p1 = (parts[1] ?? '').toLowerCase().trim();

    let horseName: string;
    let sire: string | undefined;
    let dam: string | undefined;
    let color: string | undefined;
    let gender: DBHorse['gender'];
    let birthYear: number | undefined;
    let rider: string | undefined;
    let owner: string | undefined;

    if (EQUIPE_GENDERS.has(p1)) {
      // Short format: "HorseName Color | Gender | Year | Rider"
      // Color is appended to the name in firstPart
      const words = firstPart.split(' ');
      let colorStart = words.length;
      // Walk backwards looking for a known color token (may be multi-word)
      for (let i = words.length - 1; i >= 1; i--) {
        const candidate = words.slice(i).join(' ').toLowerCase();
        if (EQUIPE_COLORS.has(candidate)) { colorStart = i; break; }
      }
      horseName = words.slice(0, colorStart).join(' ');
      color = words.slice(colorStart).join(' ') || undefined;
      gender = p1 as DBHorse['gender'];
      birthYear = parseInt(parts[2] ?? '') || undefined;
      rider = parts[3]?.trim() || undefined;
      owner = parts[4]?.trim() || undefined;
    } else if (EQUIPE_COLORS.has(p1)) {
      // Full format: "HorseName [Sire - Dam] | Color | Gender | Year | Rider [| Owner]"
      color = parts[1]?.trim();
      const gRaw = (parts[2] ?? '').toLowerCase().trim();
      gender = EQUIPE_GENDERS.has(gRaw) ? (gRaw as DBHorse['gender']) : undefined;
      birthYear = parseInt(parts[3] ?? '') || undefined;
      rider = parts[4]?.trim() || undefined;
      owner = parts[5]?.trim() || undefined;

      // Parse "HorseName Sire - Dam" from firstPart
      const dashIdx = firstPart.lastIndexOf(' - ');
      if (dashIdx > 0) {
        dam = firstPart.slice(dashIdx + 3).trim();
        const beforeDash = firstPart.slice(0, dashIdx).trim();
        // Find where horse name ends: scan for studbook suffix
        const words = beforeDash.split(' ');
        let nameEnd = Math.min(2, words.length);
        for (let i = 0; i < words.length; i++) {
          if (STUDBOOK.has(words[i].replace(/[^A-Z]/g, ''))) {
            nameEnd = i + 1;
            break;
          }
        }
        horseName = words.slice(0, nameEnd).join(' ');
        sire = words.length > nameEnd ? words.slice(nameEnd).join(' ') : undefined;
      } else {
        horseName = firstPart;
      }
    } else {
      // Fallback — store entire first part as name
      horseName = firstPart;
    }

    const name = normalizeHorseName(horseName);
    if (!name || name.length < 2) continue;

    horses.push({
      id: crypto.randomUUID(),
      name,
      nameLower: name.toLowerCase(),
      birthYear,
      gender,
      color: color?.trim() || undefined,
      sire: sire ? normalizeHorseName(sire) : undefined,
      dam: dam ? normalizeHorseName(dam) : undefined,
      currentRider: rider || undefined,
      owner: owner || undefined,
      countryCode,
      sources: ['EQUIPE'],
      firstSeen: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    });
  }

  const event: Partial<DBEvent> = {
    id: `equipe_${showId}`,
    name: showName,
    country: countryCode,
    startDate,
    discipline: 'SALTO',
    resultsUrl: `${EQUIPE_BASE}/shows/${showId}`,
    source: 'EQUIPE',
    hasResults: horses.length > 0,
    importedAt: new Date().toISOString(),
  };

  return { horses, event };
}

/**
 * Returns startlist entries as DBResult stubs for each horse in a show.
 * Full competition results require navigating individual competition pages.
 */
export async function equipeFetchShowResults(showId: string, countryCode = 'AR'): Promise<DBResult[]> {
  const { horses, event } = await equipeFetchShowHorses(showId, countryCode);
  const eventDate = event.startDate ?? new Date().toISOString().split('T')[0];
  const eventName = event.name ?? `Equipe Show ${showId}`;
  return horses.map(horse => ({
    id: crypto.randomUUID(),
    horseId: horse.id,
    horseName: horse.name,
    horseNameNorm: horse.nameLower.toUpperCase(),
    riderName: horse.currentRider,
    eventName,
    eventId: `equipe_${showId}`,
    eventDate,
    eventCountry: countryCode,
    level: '1.20m' as JumpingLevel,
    faults: 0,
    clear: false,
    phase: 'Startlist',
    source: 'EQUIPE' as DataSource,
    importedAt: new Date().toISOString(),
  }));
}

// ─── 3. FEDECUARG — Argentine National Federation ────────────────────────────
// 764+ competition documents. We scrape metadata + Drive links for background
// PDF processing. Client can't parse PDFs directly — links are stored for backend.

export interface FedecuargDoc {
  id: string;
  title: string;
  type: 'RESULTADOS' | 'ANTEPROGRAMA' | 'LISTADO' | 'REGLAMENTO' | 'OTHER';
  competition?: string;  // parsed from title
  club?: string;
  zone?: string;
  level?: string;        // CSI1*, CICO A, etc.
  dateStr?: string;
  year?: string;
  postUrl: string;
  driveUrl?: string;     // Google Drive PDF link (extracted after fetching postUrl)
  importedAt: string;
}

export async function fedecuargFetchPage(page = 1): Promise<FedecuargDoc[]> {
  const url = `https://fedecuarg.com.ar/filtro-salto-archivos/?paged=${page}`;
  const html = await fetchHTML(url, 18000);
  if (!html) return [];

  const docs: FedecuargDoc[] = [];
  const seen = new Set<string>();

  // Article links pattern
  const linkPattern = /<a[^>]+href="(https:\/\/fedecuarg\.com\.ar\/[^"#]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkPattern.exec(html)) !== null) {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ');
    if (!text || seen.has(href) || text.length < 8) continue;

    const slug = href.split('/').filter(Boolean).pop() ?? '';
    if (!slug.match(/resultado|anteprograma|listado|reglamento/i)) continue;
    seen.add(href);

    const titleUpper = text.toUpperCase();
    const type: FedecuargDoc['type'] =
      titleUpper.startsWith('RESULTADOS') ? 'RESULTADOS' :
      titleUpper.startsWith('ANTEPROGRAMA') ? 'ANTEPROGRAMA' :
      titleUpper.startsWith('LISTADO') ? 'LISTADO' :
      titleUpper.startsWith('REGLAMENTO') ? 'REGLAMENTO' : 'OTHER';

    // Extract structured fields from title
    const yearM = text.match(/20\d{2}/);
    const levelM = text.match(/CSI\s*[\d*]+\*?|CICO\s*[""]?[A-C][""]?|NACIONAL|FEDERAL/i);
    const clubM = text.match(/(?:CLUB|HÍPICO|HARAS|CENTRO)\s+[A-ZÁÉÍÓÚÑ\s]{3,40}/i);
    const zoneM = text.match(/ZONA\s+[A-Z\s]+/i);
    const dateM = text.match(/\d{1,2}\s+(?:al|y)\s+\d{1,2}\s+(?:de\s+)?[a-záéíóúñ]+\s+(?:de\s+)?20\d{2}/i)
      ?? text.match(/\d{1,2}\s+(?:de\s+)?[a-záéíóúñ]+\s+(?:de\s+)?20\d{2}/i);

    docs.push({
      id: crypto.randomUUID(),
      title: text,
      type,
      level: levelM?.[0].trim(),
      club: clubM?.[0].trim(),
      zone: zoneM?.[0].trim(),
      dateStr: dateM?.[0].trim(),
      year: yearM?.[0],
      postUrl: href,
      importedAt: new Date().toISOString(),
    });
  }

  return docs;
}

// Fetch a FEDECUARG post to extract the actual Google Drive PDF link
export async function fedecuargFetchDocLink(postUrl: string): Promise<string | null> {
  const html = await fetchHTML(postUrl);
  if (!html) return null;
  // Drive links format: https://drive.google.com/file/d/{ID}/view
  const driveM = html.match(/https:\/\/drive\.google\.com\/(?:file\/d\/|open\?id=)([\w\-_]+)(?:\/view|[^"]*)/);
  return driveM ? `https://drive.google.com/uc?export=download&id=${driveM[1]}` : null;
}

// Batch fetch all FEDECUARG pages
export async function fedecuargFetchAll(maxPages = 10): Promise<FedecuargDoc[]> {
  const all: FedecuargDoc[] = [];
  for (let p = 1; p <= maxPages; p++) {
    const docs = await fedecuargFetchPage(p);
    if (docs.length === 0) break;
    all.push(...docs);
    // Small delay to avoid rate-limiting
    await new Promise(r => setTimeout(r, 500));
  }
  return all;
}

// ─── 4. CBH — Confederação Brasileira de Hipismo ─────────────────────────────
// cbh.org.br — Brazilian national federation.
// Rankings, events, and athlete/horse registry.

export interface CBHRanking {
  position: number;
  horseName: string;
  riderName: string;
  club: string;
  state: string;
  points: number;
  source: DataSource;
}

export async function cbhFetchRanking(year = new Date().getFullYear()): Promise<CBHRanking[]> {
  const urls = [
    `https://cbh.org.br/ranking/${year}`,
    `https://www.cbh.org.br/ranking-salto-${year}`,
    `https://www.cbh.org.br/esportes/salto/ranking`,
  ];

  for (const url of urls) {
    const html = await fetchHTML(url);
    if (!html || html.length < 500) continue;

    const rankings: CBHRanking[] = [];
    // Table rows with: position, horse, rider, club, state, points
    const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let m: RegExpExecArray | null;
    while ((m = rowPattern.exec(html)) !== null) {
      const cells = m[1].replace(/<[^>]+>/g, '\t').split('\t').map(s => s.trim()).filter(Boolean);
      if (cells.length < 4) continue;
      const pos = parseInt(cells[0]);
      if (isNaN(pos) || pos > 500) continue;

      rankings.push({
        position: pos,
        horseName: cells[1] ?? '',
        riderName: cells[2] ?? '',
        club: cells[3] ?? '',
        state: cells[4] ?? '',
        points: parseFloat(cells[5] ?? '0') || 0,
        source: 'CBH',
      });
    }

    if (rankings.length > 0) return rankings;
  }
  return [];
}

export interface CBHEvent {
  name: string;
  date: string;
  location: string;
  state: string;
  level: string;
  url?: string;
}

export async function cbhFetchCalendar(): Promise<CBHEvent[]> {
  const html = await fetchHTML('https://www.cbh.org.br/calendario');
  if (!html) return [];

  const events: CBHEvent[] = [];
  // Try to parse event list
  const eventPattern = /<(?:div|li|tr)[^>]*class="[^"]*(?:event|evento|calendar)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|li|tr)>/gi;
  let m: RegExpExecArray | null;
  while ((m = eventPattern.exec(html)) !== null) {
    const text = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (text.length < 10) continue;
    const dateM = text.match(/\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{4}|\d{4}[\/\.\-]\d{1,2}[\/\.\-]\d{1,2}/);
    events.push({
      name: text.slice(0, 80),
      date: dateM ? isoDate(dateM[0]) : '',
      location: '',
      state: '',
      level: mapLevel(text),
      url: undefined,
    });
  }
  return events;
}

export async function cbhFetchResults(): Promise<DBResult[]> {
  const results: DBResult[] = [];
  const urlsToTry = [
    'https://www.cbh.org.br/resultados',
    'https://cbh.org.br/resultados-salto',
    'https://www.cbh.org.br/esportes/salto/resultados',
  ];

  for (const url of urlsToTry) {
    const html = await fetchHTML(url);
    if (!html || html.length < 500) continue;

    const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let m: RegExpExecArray | null;
    while ((m = rowPattern.exec(html)) !== null) {
      const cells = m[1].replace(/<[^>]+>/g, '\t').split('\t').map(s => s.trim()).filter(Boolean);
      if (cells.length < 4) continue;

      const [rank, horseName, riderName, , faultsStr, timeStr] = cells;
      if (!horseName || horseName.length < 2 || isNaN(parseInt(rank))) continue;

      results.push({
        id: crypto.randomUUID(),
        horseId: normalizeHorseName(horseName),
        horseName,
        horseNameNorm: normalizeHorseName(horseName),
        riderName,
        eventName: 'CBH Result',
        eventDate: new Date().toISOString().split('T')[0],
        eventCountry: 'BR',
        level: '1.20m',
        placement: parseInt(rank) || undefined,
        faults: parseFloat(faultsStr ?? '0') || 0,
        time: timeStr ? parseFloat(timeStr) : undefined,
        clear: (parseFloat(faultsStr ?? '0') || 0) === 0,
        source: 'CBH',
        importedAt: new Date().toISOString(),
      });
    }

    if (results.length > 0) break;
  }
  return results;
}

// ─── 5. Fin del Mundo Remates — Lot Details ──────────────────────────────────
// Each /Remate/{ID}/Name page lists individual lots (horses) with name, haras,
// genealogy. Sale price is hidden behind auth wall but other data is public.

export async function fdmFetchLots(remateId: string): Promise<DBSale[]> {
  const url = `https://findelmundoremates.com/Remate/${remateId}/`;
  const html = await fetchHTML(url, 18000);
  if (!html) return [];

  const sales: DBSale[] = [];
  const auctionNameM = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const auctionName = auctionNameM?.[1]?.replace(/<[^>]+>/g, '').trim() ?? 'FDM Remate';

  // Horse lots have names in headings/strong tags
  const lotPattern = /<(?:h[2-4]|strong)[^>]*>\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s''\-]{2,60})\s*<\/(?:h[2-4]|strong)>/gi;
  const harasPattern = /(?:haras|criadero|propiedad)[:\s]*([A-ZÁÉÍÓÚÑA-Z\s]{3,50})/gi;
  const sireDamPattern = /(?:padre|sire)[:\s]*([A-Z][A-Z\s''\-]{2,40})/gi;

  const harasMatches = [...html.matchAll(harasPattern)];
  const sireDamMatches = [...html.matchAll(sireDamPattern)];

  let lotIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = lotPattern.exec(html)) !== null) {
    const name = m[1].trim();
    if (name.length < 3) continue;

    sales.push({
      id: crypto.randomUUID(),
      horseName: name,
      auctionHouse: 'Fin del Mundo Remates',
      auctionName,
      saleDate: new Date().toISOString().split('T')[0],
      country: 'AR',
      haras: harasMatches[lotIdx]?.[1]?.trim(),
      url,
      source: 'FDM_REMATES',
      importedAt: new Date().toISOString(),
    });
    lotIdx++;
  }

  // Also try to match lot blocks
  if (sales.length === 0) {
    const lotBlocks = [...html.matchAll(/<div[^>]*class="[^"]*lot[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)];
    for (const block of lotBlocks) {
      const text = block[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const nameM = text.match(/[A-Z][A-Z\s''\-]{3,50}/);
      if (!nameM) continue;
      sales.push({
        id: crypto.randomUUID(),
        horseName: nameM[0].trim(),
        auctionHouse: 'Fin del Mundo Remates',
        auctionName,
        saleDate: new Date().toISOString().split('T')[0],
        country: 'AR',
        url,
        source: 'FDM_REMATES',
        importedAt: new Date().toISOString(),
      });
    }
  }

  return sales;
}

// Fetch multiple recent auctions
export async function fdmFetchAllRecentLots(maxRemates = 5): Promise<DBSale[]> {
  // First get the list of auctions
  const html = await fetchHTML('https://findelmundoremates.com/');
  if (!html) return [];

  const urlPattern = /href="(https:\/\/findelmundoremates\.com\/Remate\/(\d+)\/([^"]+))"/g;
  const remateIds: string[] = [];
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = urlPattern.exec(html)) !== null) {
    const id = m[2];
    if (!seen.has(id)) {
      seen.add(id);
      remateIds.push(id);
    }
  }

  const allSales: DBSale[] = [];
  for (const id of remateIds.slice(0, maxRemates)) {
    const lots = await fdmFetchLots(id);
    allSales.push(...lots);
    await new Promise(r => setTimeout(r, 400));
  }
  return allSales;
}

// ─── 6. Deduplication helpers ─────────────────────────────────────────────────
// Match horse records across sources by normalized name + year

export function deduplicateHorses(horses: DBHorse[]): DBHorse[] {
  const map = new Map<string, DBHorse>();

  for (const h of horses) {
    const key = `${h.nameLower}|${h.birthYear ?? ''}|${h.countryCode}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...h });
    } else {
      // Merge sources and richer data
      existing.sources = [...new Set([...existing.sources, ...h.sources])];
      if (!existing.feiId && h.feiId) existing.feiId = h.feiId;
      if (!existing.studbook && h.studbook) existing.studbook = h.studbook;
      if (!existing.gender && h.gender) existing.gender = h.gender;
      if (!existing.sire && h.sire) existing.sire = h.sire;
      if (!existing.dam && h.dam) existing.dam = h.dam;
      existing.lastUpdated = new Date().toISOString();
    }
  }

  return [...map.values()];
}

export function deduplicateResults(results: DBResult[]): DBResult[] {
  const seen = new Set<string>();
  return results.filter(r => {
    const key = `${r.horseNameNorm}|${r.eventDate}|${r.eventName}|${r.faults}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── 7. Compute horse stats ────────────────────────────────────────────────────
import type { DBHorseStats, JumpingLevel as JL } from '../types';

const LEVEL_ORDER: JL[] = [
  '1.00m','1.10m','1.20m','1.25m','1.30m','1.35m','1.40m','1.45m','1.50m','1.55m','1.60m','GP','GP*','GP**',
];

export function computeHorseStats(horseId: string, results: DBResult[]): DBHorseStats {
  const horseResults = results.filter(r => r.horseId === horseId || r.horseNameNorm === horseId);
  const clearRounds = horseResults.filter(r => r.clear).length;
  const placements = horseResults.filter(r => r.placement != null).map(r => r.placement!);
  const levels = horseResults.map(r => r.level);
  const topLevel = levels.reduce<JL>((best, cur) => {
    return LEVEL_ORDER.indexOf(cur) > LEVEL_ORDER.indexOf(best) ? cur : best;
  }, '1.00m');
  const countries = [...new Set(horseResults.map(r => r.eventCountry).filter(Boolean))];
  const dates = horseResults.map(r => r.eventDate).sort();

  return {
    horseId,
    totalResults: horseResults.length,
    clearRounds,
    clearRoundPct: horseResults.length > 0 ? Math.round((clearRounds / horseResults.length) * 100) : 0,
    avgPlacement: placements.length > 0 ? Math.round(placements.reduce((a, b) => a + b, 0) / placements.length) : undefined,
    bestPlacement: placements.length > 0 ? Math.min(...placements) : undefined,
    topLevelReached: topLevel,
    countriesCompeted: countries,
    lastCompetitionDate: dates[dates.length - 1],
    updatedAt: new Date().toISOString(),
  };
}
