import axios from 'axios';
import type { CompetitionResult } from '../types';

// ─── FEI Data API ────────────────────────────────────────────────────────────
// FEI provides a public data portal at data.fei.org
// Docs: https://data.fei.org/

const FEI_BASE = 'https://data.fei.org';

export interface FeiSearchResult {
  feiId: string;
  name: string;
  birthYear?: number;
  countryCode?: string;
}

export async function searchFeiHorse(query: string): Promise<FeiSearchResult[]> {
  try {
    const { data } = await axios.get(`${FEI_BASE}/Horse/Search`, {
      params: { q: query, maxResults: 20 },
      timeout: 8000,
    });
    // FEI returns array of horse objects
    return (data?.horses ?? data ?? []).map((h: Record<string, unknown>) => ({
      feiId: String(h.feiId ?? h.FEIId ?? h.id ?? ''),
      name: String(h.name ?? h.Name ?? ''),
      birthYear: h.birthYear ?? h.BirthYear,
      countryCode: h.countryCode ?? h.CountryCode,
    }));
  } catch {
    return [];
  }
}

export async function getFeiHorseResults(feiId: string): Promise<CompetitionResult[]> {
  try {
    const { data } = await axios.get(`${FEI_BASE}/Horse/${feiId}/Results`, {
      timeout: 10000,
    });
    const raw = data?.results ?? data ?? [];
    return raw.map((r: Record<string, unknown>) => ({
      id: crypto.randomUUID(),
      horseId: feiId,
      horseName: String(r.horseName ?? ''),
      eventName: String(r.eventName ?? r.competitionName ?? ''),
      eventDate: String(r.eventDate ?? r.date ?? ''),
      level: mapFeiLevel(String(r.height ?? r.level ?? '')),
      placement: r.place ?? r.rank,
      totalEntries: r.starters ?? r.entries,
      faults: Number(r.faults ?? r.penalties ?? 0),
      time: r.time ? Number(r.time) : undefined,
      clear: Number(r.faults ?? 0) === 0,
      country: String(r.countryCode ?? ''),
      source: 'FEI',
    }));
  } catch {
    return [];
  }
}

function mapFeiLevel(raw: string): import('../types').JumpingLevel {
  const n = raw.toLowerCase().replace(/[^0-9.]/g, '');
  const levels = ['1.00', '1.10', '1.20', '1.25', '1.30', '1.35', '1.40', '1.45', '1.50', '1.55', '1.60'];
  for (const l of levels) {
    if (n.includes(l)) return `${l}m` as import('../types').JumpingLevel;
  }
  if (raw.toLowerCase().includes('grand')) return 'GP';
  return '1.20m';
}

// ─── FPH Brazil scraper ──────────────────────────────────────────────────────
// fph.com.br is HTML — we fetch via CORS proxy and parse

export async function fetchFphResults(url: string): Promise<{ raw: string }> {
  try {
    // Use a public CORS proxy for client-side fetch of HTML pages
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const { data } = await axios.get(proxy, { timeout: 12000 });
    return { raw: data?.contents ?? '' };
  } catch {
    return { raw: '' };
  }
}

// ─── Jumpr API discovery helper ─────────────────────────────────────────────
// jum.pr is a Next.js app. Known public endpoints (from network analysis):

const JUMPR_API = 'https://jum.pr/api';

export async function searchJumprHorse(name: string): Promise<FeiSearchResult[]> {
  try {
    const { data } = await axios.get(`${JUMPR_API}/horses/search`, {
      params: { q: name },
      timeout: 8000,
    });
    return (data?.data ?? data ?? []).map((h: Record<string, unknown>) => ({
      feiId: String(h.fei_id ?? h.id ?? ''),
      name: String(h.name ?? ''),
      countryCode: String(h.country ?? ''),
    }));
  } catch {
    return [];
  }
}


// ─── DATAFECH — Federación Ecuestre de Chile ─────────────────────────────────
// datafech.cl is the official FEDECH inscription & competition management system.
// Public endpoints (no auth required):
//   /search/all?q=<name>   → riders + horses search
//   /inscription/horse     → horse registry (HTML, paginated)

const DATAFECH_BASE = 'https://datafech.cl';

export interface DatafechHorseResult {
  id: string;
  name: string;
  owner?: string;
  club?: string;
  countryCode: string; // 'CL'
}

export async function searchDatafechHorse(query: string): Promise<DatafechHorseResult[]> {
  try {
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(`${DATAFECH_BASE}/search/all?q=${encodeURIComponent(query)}`)}`;
    const { data } = await axios.get(proxy, { timeout: 12000 });
    const html: string = data?.contents ?? '';
    const results: DatafechHorseResult[] = [];
    const seen = new Set<string>();
    // Parse h3/strong/td elements — datafech renders horse names prominently
    const nameMatches = [...html.matchAll(/<(?:h[1-6]|strong|b|td)[^>]*>\s*([A-Z][A-Z\s''\-]{2,50})\s*<\/(?:h[1-6]|strong|b|td)>/g)];
    for (const m of nameMatches.slice(0, 20)) {
      const name = m[1]?.trim();
      if (name && !seen.has(name) && name.length > 2) {
        seen.add(name);
        results.push({ id: crypto.randomUUID(), name, countryCode: 'CL' });
      }
    }
    return results.slice(0, 15);
  } catch {
    return [];
  }
}

export interface DatafechEvent {
  name: string;
  club: string;
  date: string;
  place: string;
  discipline: string; // SALTO, ADIESTRAMIENTO, etc.
  inscriptionUrl?: string;
}

export async function fetchDatafechEvents(): Promise<DatafechEvent[]> {
  try {
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(DATAFECH_BASE)}`;
    const { data } = await axios.get(proxy, { timeout: 12000 });
    const html: string = data?.contents ?? '';
    const events: DatafechEvent[] = [];
    const h3matches = [...html.matchAll(/<h3[^>]*>\s*([\s\S]*?)\s*<\/h3>/gi)];
    const dateMatches = [...html.matchAll(/calendar_today([\d\s\w]+?)<\//g)];
    const placeMatches = [...html.matchAll(/place([\s\S]*?)<\//g)];
    const clubMatches = [...html.matchAll(/groups([\s\S]*?)<\//g)];
    const inscMatches = [...html.matchAll(/href="(https:\/\/datafech\.cl\/inscription\/race\/[^"]+)"/g)];
    const disciplineMatches = [...html.matchAll(/\b(SALTO|ADIESTRAMIENTO|ENDURO|CCE)\b/g)];
    for (let i = 0; i < h3matches.length && i < 20; i++) {
      const name = h3matches[i][1].replace(/<[^>]+>/g, '').trim();
      if (name.length < 5) continue;
      events.push({
        name,
        club: clubMatches[i]?.[1]?.replace(/<[^>]+>/g, '').trim() ?? '',
        date: dateMatches[i]?.[1]?.trim() ?? '',
        place: placeMatches[i]?.[1]?.replace(/<[^>]+>/g, '').trim() ?? '',
        discipline: disciplineMatches[i]?.[1] ?? 'SALTO',
        inscriptionUrl: inscMatches[i]?.[1],
      });
    }
    return events;
  } catch {
    return [];
  }
}

// ─── Fin del Mundo Remates ────────────────────────────────────────────────────
// findelmundoremates.com — Argentine online horse auction house.
// Public pages show upcoming auctions with lot counts, dates, and haras names.
// Final sale prices require authentication — not accessible client-side.

export interface FdmRemate {
  id: string;
  name: string;     // Auction name e.g. "Haras Henry Jota"
  date: string;     // e.g. "LUNES, 4/5 19:00 hs."
  lots: number;     // Number of horses/lots
  location: string; // e.g. "Argentina/Buenos Aires"
  url: string;
}

export async function fetchFdmRemates(): Promise<FdmRemate[]> {
  try {
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent('https://findelmundoremates.com/')}`;
    const { data } = await axios.get(proxy, { timeout: 12000 });
    const html: string = data?.contents ?? '';
    const remates: FdmRemate[] = [];
    const seen = new Set<string>();
    const urlMatches = [...html.matchAll(/href="(https:\/\/findelmundoremates\.com\/Remate\/(\d+)\/([^"]+))"/g)];
    const lotMatches = [...html.matchAll(/(\d+)\s*Lotes?/gi)];
    const dateMatches = [...html.matchAll(/(LUNES|MARTES|MI[ÉE]RCOLES|JUEVES|VIERNES|S[ÁA]BADO|DOMINGO),\s*[\d\/]+\s*\d+:\d+\s*hs\./gi)];
    const locMatches = [...html.matchAll(/Argentina\/[\w\s]+|Mexico\/[\w\s]+/gi)];
    for (let i = 0; i < urlMatches.length && i < 15; i++) {
      const url = urlMatches[i][1];
      const rawName = decodeURIComponent(urlMatches[i][3]).replace(/-/g, ' ');
      if (seen.has(url)) continue;
      seen.add(url);
      remates.push({
        id: urlMatches[i][2],
        name: rawName,
        lots: parseInt(lotMatches[i]?.[1] ?? '0', 10),
        date: dateMatches[i]?.[0] ?? '',
        location: locMatches[i]?.[0] ?? 'Argentina',
        url,
      });
    }
    return remates;
  } catch {
    return [];
  }
}

// ─── FEDECUARG — Resultados Argentina ────────────────────────────────────────
// fedecuarg.com.ar lists competition results as links to Google Drive PDFs.
// We can enumerate competitions metadata but cannot parse PDFs client-side.

export interface FedecuargCompetition {
  title: string;
  postUrl: string;
  type: 'RESULTADOS' | 'ANTEPROGRAMA' | 'LISTADO' | 'OTHER';
  year?: string;
}

export async function fetchFedecuargResults(page = 1): Promise<FedecuargCompetition[]> {
  try {
    const url = `https://fedecuarg.com.ar/filtro-salto-archivos/?paged=${page}`;
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const { data } = await axios.get(proxy, { timeout: 14000 });
    const html: string = data?.contents ?? '';
    const items: FedecuargCompetition[] = [];
    const seen = new Set<string>();
    const linkMatches = [...html.matchAll(/<a[^>]+href="(https:\/\/fedecuarg\.com\.ar\/[^"#]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
    for (const m of linkMatches) {
      const href = m[1];
      const text = m[2].replace(/<[^>]+>/g, '').trim();
      if (!text || seen.has(href) || text.length < 10) continue;
      const slug = href.split('/').filter(Boolean).pop() ?? '';
      if (!slug.match(/resultado|anteprograma|listado|reglamento/)) continue;
      seen.add(href);
      const type: FedecuargCompetition['type'] =
        text.toUpperCase().startsWith('RESULTADOS') ? 'RESULTADOS' :
        text.toUpperCase().startsWith('ANTEPROGRAMA') ? 'ANTEPROGRAMA' :
        text.toUpperCase().startsWith('LISTADO') ? 'LISTADO' : 'OTHER';
      const yearMatch = text.match(/20\d{2}/);
      items.push({ title: text, postUrl: href, type, year: yearMatch?.[0] });
    }
    return items.slice(0, 30);
  } catch {
    return [];
  }
}
