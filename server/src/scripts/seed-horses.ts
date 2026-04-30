/**
 * seed-horses.ts — Horse population script for EquiValue AI
 *
 * Strategy (in order of reliability):
 *  1. FEI data.fei.org  — Puppeteer stealth → bypass Cloudflare/DataDome
 *                          Flow: athlete list ARG/BRA → horse IDs → horse profiles
 *  2. Equipe Technology — Puppeteer stealth → show horse pages for known SA shows
 *  3. FEDECUARG         — fetch event pages from DB → find PDF links → pdf-parse
 *  4. FDM Remates       — historical lots via /data_load/articulo_especifico/:id
 *
 * Run:
 *   cd server
 *   DATABASE_URL=postgres://postgres:postgres@localhost:5435/equivalue npm run seed:horses
 */

import 'dotenv/config';
import { db } from '../db/index.js';
import { horses, events, sales, results } from '../db/schema.js';
import { sql, like, eq } from 'drizzle-orm';
import puppeteerExtraDefault from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require('pdf-parse');

// puppeteer-extra default export is the PuppeteerExtra instance with .use()
const puppeteer = puppeteerExtraDefault as any;
puppeteer.use(StealthPlugin());

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
interface DBSale {
  id: string; horseName: string; horseId?: string; auctionHouse: string;
  auctionName: string; saleDate: string; salePriceARS?: number; salePriceUSD?: number;
  salePriceEUR?: number; lots?: number; haras?: string; country: string;
  url?: string; source: string; importedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function now() { return new Date().toISOString(); }
function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }

function normalizeHorseName(name: string): string {
  return name.trim().toUpperCase().replace(/\s+/g, ' ').replace(/[^\wÁÉÍÓÚÑÜáéíóúñü0-9 '\-]/g, '').trim();
}

function isoDate(raw: string): string {
  const dmY = raw.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (dmY) return `${dmY[3]}-${dmY[2].padStart(2,'0')}-${dmY[1].padStart(2,'0')}`;
  const Ymd = raw.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (Ymd) return `${Ymd[1]}-${Ymd[2].padStart(2,'0')}-${Ymd[3].padStart(2,'0')}`;
  return now().split('T')[0];
}

function makeHorse(
  name: string, countryCode: string,
  extra: Partial<Omit<DBHorse,'id'|'name'|'nameLower'|'countryCode'|'sources'|'firstSeen'|'lastUpdated'>> = {},
  source = 'STATIC_CURATED'
): DBHorse {
  const n = normalizeHorseName(name);
  const idKey = n.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return {
    id: `${source.toLowerCase()}_${idKey}_${countryCode.toLowerCase()}`,
    name: n, nameLower: n.toLowerCase(),
    countryCode, sources: [source],
    firstSeen: now(), lastUpdated: now(),
    ...extra,
  };
}

// ─── DB upsert helpers ────────────────────────────────────────────────────────

const CHUNK = 100;

function dedupeById<T extends { id: string }>(list: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of list) map.set(item.id, item);
  return [...map.values()];
}

async function upsertHorsesBatch(batch: DBHorse[]) {
  if (batch.length === 0) return;
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
        feiId: sql`COALESCE(excluded.fei_id, horses.fei_id)`,
        currentRider: sql`COALESCE(excluded.current_rider, horses.current_rider)`,
        sire: sql`COALESCE(excluded.sire, horses.sire)`,
        dam: sql`COALESCE(excluded.dam, horses.dam)`,
        studbook: sql`COALESCE(excluded.studbook, horses.studbook)`,
        birthYear: sql`COALESCE(excluded.birth_year, horses.birth_year)`,
        owner: sql`COALESCE(excluded.owner, horses.owner)`,
        sources: sql`(SELECT array_agg(DISTINCT s) FROM unnest(horses.sources || excluded.sources) s)`,
      },
    });
  }
}

async function upsertResultsBatch(batch: DBResult[]) {
  if (batch.length === 0) return;
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

async function upsertSalesBatch(batch: DBSale[]) {
  if (batch.length === 0) return;
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

// ─── 1. FEI via Puppeteer Stealth ─────────────────────────────────────────────
// Scrapes data.fei.org — public horse/athlete database
// Flow: athlete list (ARG+BRA) → horse IDs → horse profile pages

async function scrapeFEIWithPuppeteer(): Promise<{ horsesFound: DBHorse[]; resultsFound: DBResult[] }> {
  const allHorses: DBHorse[] = [];
  const allResults: DBResult[] = [];
  let browser: any = null;

  console.log('\n[FEI] Launching Puppeteer stealth browser...');
  try {
    browser = await (puppeteer as any).launch({
      headless: true,
      args: [
        '--no-sandbox', '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--window-size=1366,768',
      ],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'es-AR,es;q=0.9,en-US;q=0.8' });

    // ── Step 1: Scrape ARG and BRA athletes from FEI ──
    const athleteIds: Array<{ feiId: string; name: string; country: string }> = [];
    for (const country of ['ARG', 'BRA']) {
      console.log(`  [FEI] Scraping athletes for ${country}...`);
      try {
        await page.goto(
          `https://data.fei.org/Athlete/List?noc=${country}&discipline=1&gender=0`,
          { waitUntil: 'networkidle2', timeout: 45000 }
        );
        await sleep(3000);

        // Check if we hit a CAPTCHA
        const title = await page.title();
        if (title.toLowerCase().includes('captcha') || title.toLowerCase().includes('challenge')) {
          console.warn(`  [FEI] CAPTCHA detected for ${country}, skipping...`);
          continue;
        }

        // Extract athlete rows
        const rows = await page.evaluate(() => {
          const rows: any[] = [];
          // FEI uses a table or list - try multiple selectors
          document.querySelectorAll('tr[data-id], .athlete-row, [data-athlete-id]').forEach(el => {
            const id = el.getAttribute('data-id') || el.getAttribute('data-athlete-id');
            const name = el.querySelector('.name, td:nth-child(2), .athlete-name')?.textContent?.trim();
            if (id && name) rows.push({ feiId: id, name });
          });
          // Also try links pattern
          document.querySelectorAll('a[href*="/Athlete/"]').forEach(el => {
            const href = el.getAttribute('href') || '';
            const idMatch = href.match(/Athlete\/(\d+)/);
            if (idMatch) rows.push({ feiId: idMatch[1], name: el.textContent?.trim() || '' });
          });
          return rows;
        });

        console.log(`  [FEI] ${country}: found ${rows.length} athletes`);
        for (const row of rows) {
          if (row.feiId && row.name) {
            athleteIds.push({ ...row, country });
          }
        }
        await sleep(2000);
      } catch (err: any) {
        console.warn(`  [FEI] Error scraping ${country} athletes: ${err.message}`);
      }
    }

    // ── Step 2: Get horse IDs for each athlete ──
    const horseIds = new Set<string>();
    const horseCountryMap = new Map<string, string>();

    for (const athlete of athleteIds.slice(0, 100)) {
      try {
        await page.goto(
          `https://data.fei.org/Athlete/Detail?athleteId=${athlete.feiId}`,
          { waitUntil: 'networkidle2', timeout: 30000 }
        );
        await sleep(1500);

        const athleteHorseIds = await page.evaluate(() => {
          const ids: string[] = [];
          document.querySelectorAll('a[href*="/Horse/Detail"]').forEach(el => {
            const href = el.getAttribute('href') || '';
            const m = href.match(/horseId=(\d+)/);
            if (m) ids.push(m[1]);
          });
          return ids;
        });

        for (const hId of athleteHorseIds) {
          horseIds.add(hId);
          if (!horseCountryMap.has(hId)) horseCountryMap.set(hId, athlete.country);
        }
        await sleep(800);
      } catch (err: any) {
        console.warn(`  [FEI] Error fetching athlete ${athlete.feiId}: ${err.message}`);
      }
    }

    console.log(`  [FEI] Total unique horse IDs found: ${horseIds.size}`);

    // ── Step 3: Scrape each horse profile ──
    let horseCount = 0;
    for (const hId of horseIds) {
      try {
        await page.goto(
          `https://data.fei.org/Horse/Detail?horseId=${hId}`,
          { waitUntil: 'networkidle2', timeout: 30000 }
        );
        await sleep(1200);

        const horseData = await page.evaluate((feiId: string) => {
          const getText = (sel: string) =>
            document.querySelector(sel)?.textContent?.trim() || '';
          const getAttr = (sel: string, attr: string) =>
            document.querySelector(sel)?.getAttribute(attr)?.trim() || '';

          // Try multiple extraction strategies for FEI horse profile page
          const name = getText('h1.horse-name, h1, .horse-detail h1, #horse-name, [class*="horse-name"]');
          const sire = getText('[class*="sire"], td:contains("Sire") + td, .pedigree-sire');
          const dam = getText('[class*="dam"]:not([class*="dam-sire"]), .pedigree-dam');
          const damSire = getText('[class*="dam-sire"], .pedigree-dam-sire');
          const studbook = getText('[class*="studbook"], [class*="breed"]');
          const gender = getText('[class*="gender"], [class*="sex"]');
          const birthYear = getText('[class*="birth"], [class*="year"]');
          const color = getText('[class*="color"], [class*="colour"]');
          const country = getText('[class*="country"]');
          const rider = getText('[class*="rider"], [class*="athlete"]');
          const owner = getText('[class*="owner"]');

          // Also try table-based layout (FEI often uses definition lists / tables)
          const allText = document.body?.innerText || '';
          return { feiId, name, sire, dam, damSire, studbook, gender, birthYear, color, country, rider, owner, allText: allText.slice(0, 2000) };
        }, hId);

        if (!horseData.name || horseData.name.length < 2) {
          // Try to extract from page text patterns
          const pageText = await page.evaluate(() => document.body?.innerText || '');
          const nameFromText = pageText.match(/^([A-Z][A-Z \-']{2,40})\n/m)?.[1];
          if (!nameFromText) { await sleep(500); continue; }
          horseData.name = nameFromText;
        }

        const name = normalizeHorseName(horseData.name);
        if (!name || name.length < 2) continue;

        const countryCode = horseCountryMap.get(hId) || horseData.country || 'ARG';
        const birthYearNum = horseData.birthYear ? parseInt(horseData.birthYear.match(/\d{4}/)?.[0] || '0') : undefined;

        allHorses.push(makeHorse(name, countryCode, {
          feiId: hId,
          birthYear: birthYearNum && birthYearNum > 1990 ? birthYearNum : undefined,
          studbook: horseData.studbook || undefined,
          gender: horseData.gender?.toLowerCase() || undefined,
          color: horseData.color || undefined,
          sire: horseData.sire ? normalizeHorseName(horseData.sire) : undefined,
          dam: horseData.dam ? normalizeHorseName(horseData.dam) : undefined,
          damSire: horseData.damSire ? normalizeHorseName(horseData.damSire) : undefined,
          currentRider: horseData.rider || undefined,
          owner: horseData.owner || undefined,
        }, 'FEI'));

        horseCount++;
        if (horseCount % 10 === 0) {
          console.log(`  [FEI] Processed ${horseCount} horses so far...`);
          await upsertHorsesBatch(allHorses.slice(-50));
        }
        await sleep(1000);
      } catch (err: any) {
        console.warn(`  [FEI] Error scraping horse ${hId}: ${err.message}`);
      }
    }

    console.log(`  [FEI] Done: ${allHorses.length} horses, ${allResults.length} results`);
  } catch (err: any) {
    console.error(`[FEI] Fatal error: ${err.message}`);
  } finally {
    if (browser) await browser.close();
  }

  return { horsesFound: allHorses, resultsFound: allResults };
}

// ─── 2. Equipe show horse pages via Puppeteer ────────────────────────────────
// For the top SA shows we have stored in the DB, scrape their horse list via browser

async function scrapeEquipeHorsesWithPuppeteer(): Promise<DBHorse[]> {
  const allHorses: DBHorse[] = [];
  let browser: any = null;

  console.log('\n[EQUIPE] Launching Puppeteer to scrape show horse pages...');

  // Get events from DB that are from Equipe and likely SA
  const equipeEvents = await db.select({ id: events.id, name: events.name, country: events.country, resultsUrl: events.resultsUrl })
    .from(events)
    .where(like(events.id, 'equipe_%'));

  // Focus on SA shows (AR, BR, UY, CL)
  const saEvents = equipeEvents.filter(e =>
    ['AR','BR','UY','CL','XX'].includes(e.country || '') &&
    e.resultsUrl
  ).slice(0, 50); // cap at 50 shows

  console.log(`  [EQUIPE] Found ${saEvents.length} SA shows in DB to process`);
  if (saEvents.length === 0) return [];

  try {
    browser = await (puppeteer as any).launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    for (const evt of saEvents) {
      const showIdMatch = evt.id.match(/equipe_(\d+)/);
      if (!showIdMatch) continue;
      const showId = showIdMatch[1];

      // Try to detect country from name
      let countryCode = evt.country || 'AR';
      const nameLower = (evt.name || '').toLowerCase();
      if (/brasil|brazil|são paulo|rio|brasileiro/i.test(nameLower)) countryCode = 'BR';
      else if (/uruguay|montevideo/i.test(nameLower)) countryCode = 'UY';
      else if (/chile|santiago/i.test(nameLower)) countryCode = 'CL';

      try {
        const url = `https://online.equipe.com/shows/${showId}/horses`;
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await sleep(3000); // Wait for Turbo/Hotwire to load

        const horses_found = await page.evaluate(() => {
          const results: any[] = [];
          // Equipe renders horse rows - try multiple selectors
          const rows = document.querySelectorAll(
            'tr[data-horse-id], .horse-row, [data-id], table tbody tr, .horses-list li'
          );
          rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            const name = row.querySelector('[class*="name"], .horse-name, td:first-child')?.textContent?.trim()
              || cells[0]?.textContent?.trim();
            const rider = row.querySelector('[class*="rider"], .rider-name')?.textContent?.trim()
              || cells[1]?.textContent?.trim();
            const studbook = row.querySelector('[class*="studbook"]')?.textContent?.trim()
              || cells[2]?.textContent?.trim();
            const sire = row.querySelector('[class*="sire"], [class*="father"]')?.textContent?.trim();
            if (name && name.length > 1 && !/^[\d\s]+$/.test(name)) {
              results.push({ name, rider, studbook, sire });
            }
          });

          // Also try text-based extraction from page content
          if (results.length === 0) {
            const allLinks = Array.from(document.querySelectorAll('a[href*="/horses/"]'));
            allLinks.forEach(a => {
              const text = a.textContent?.trim();
              if (text && text.length > 1 && text.length < 60) {
                results.push({ name: text });
              }
            });
          }
          return results;
        });

        const validHorses = horses_found.filter((h: any) =>
          h.name && h.name.length > 1 && h.name.length < 60 &&
          !/rider|horse|name|start|nr\.|no\./i.test(h.name)
        );

        if (validHorses.length > 0) {
          console.log(`  [EQUIPE] Show ${showId} (${evt.name?.slice(0,40)}): ${validHorses.length} horses`);
          for (const h of validHorses) {
            const name = normalizeHorseName(h.name);
            if (!name) continue;
            allHorses.push(makeHorse(name, countryCode, {
              currentRider: h.rider || undefined,
              studbook: h.studbook || undefined,
              sire: h.sire ? normalizeHorseName(h.sire) : undefined,
            }, 'EQUIPE'));
          }
        }

        await sleep(1500);
      } catch (err: any) {
        console.warn(`  [EQUIPE] Error show ${showId}: ${err.message?.slice(0,80)}`);
      }
    }
  } catch (err: any) {
    console.error(`[EQUIPE] Fatal error: ${err.message}`);
  } finally {
    if (browser) await browser.close();
  }

  console.log(`  [EQUIPE] Done: ${allHorses.length} horses found`);
  return allHorses;
}

// ─── 3. FEDECUARG PDF parsing ─────────────────────────────────────────────────
// Fetches event pages from DB, finds Google Drive / direct PDF links, downloads
// and parses with pdf-parse to extract horse names, riders, placings

async function scrapeFedecuargPDFs(): Promise<{ horsesFound: DBHorse[]; resultsFound: DBResult[] }> {
  const allHorses: DBHorse[] = [];
  const allResults: DBResult[] = [];

  console.log('\n[FEDECUARG] Fetching event pages to find PDF links...');

  // Get FEDECUARG events from DB
  const fedEvents = await db.select({ id: events.id, name: events.name, resultsUrl: events.resultsUrl })
    .from(events)
    .where(like(events.id, 'fedecuarg_%'));

  console.log(`  [FEDECUARG] Found ${fedEvents.length} events in DB`);

  const seenUrls = new Set<string>();
  const seenPdfUrls = new Set<string>();

  for (const evt of fedEvents) {
    if (!evt.resultsUrl || seenUrls.has(evt.resultsUrl)) continue;
    seenUrls.add(evt.resultsUrl);

    try {
      // Fetch the event page to find PDF/GDrive links
      const html = await fetch(evt.resultsUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(20000),
      }).then(r => r.ok ? r.text() : '').catch(() => '');

      if (!html) continue;

      // Find Google Drive links
      const gdriveMatches = html.match(/https:\/\/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?[^"'\s]*id=)([A-Za-z0-9_\-]{20,})/g) || [];
      // Find direct PDF links
      const pdfMatches = html.match(/https?:\/\/[^"'\s]+\.pdf[^"'\s]*/gi) || [];
      // Find fedecuarg.com.ar attachment links
      const attachmentMatches = html.match(/https?:\/\/fedecuarg\.com\.ar\/wp-content\/uploads\/[^"'\s]+/gi) || [];

      const allLinks = [...new Set([...gdriveMatches, ...pdfMatches, ...attachmentMatches])];

      for (const link of allLinks.slice(0, 5)) {
        try {
          // Normalize Google Drive download URL
          let downloadUrl = link;
          const driveIdMatch = link.match(/\/d\/([A-Za-z0-9_\-]{20,})|id=([A-Za-z0-9_\-]{20,})/);
          if (driveIdMatch) {
            const fileId = driveIdMatch[1] || driveIdMatch[2];
            downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
          }

          if (seenPdfUrls.has(downloadUrl)) continue;
          seenPdfUrls.add(downloadUrl);

          console.log(`  [FEDECUARG] Downloading PDF from ${downloadUrl.slice(0,80)}...`);
          const pdfBuffer = await fetch(downloadUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0',
              'Accept': 'application/pdf,*/*',
            },
            signal: AbortSignal.timeout(30000),
          }).then(r => {
            const ct = r.headers.get('content-type') || '';
            if (!r.ok || (!ct.includes('pdf') && !ct.includes('octet'))) return null;
            return r.arrayBuffer();
          }).catch(() => null);

          if (!pdfBuffer || pdfBuffer.byteLength < 1000) continue;

          const pdfData = await pdfParse(Buffer.from(pdfBuffer));
          const text = pdfData.text;

          // Extract horse names from PDF text
          // Common patterns in Argentine show jumping results:
          // "1. HORSE NAME    RIDER NAME    0 0 0"
          // "HORSE NAME / RIDER NAME"
          // Table rows: "Pos  Nro  Caballo  Jinete  ..."

          const horsesFromPDF = extractHorsesFromPDFText(text, evt);
          console.log(`  [FEDECUARG] PDF parsed: ${horsesFromPDF.horses.length} horses, ${horsesFromPDF.results.length} results`);
          allHorses.push(...horsesFromPDF.horses);
          allResults.push(...horsesFromPDF.results);

          await sleep(1000);
        } catch (err: any) {
          console.warn(`  [FEDECUARG] PDF error for ${link.slice(0,60)}: ${err.message?.slice(0,60)}`);
        }
      }

      await sleep(500);
    } catch (err: any) {
      console.warn(`  [FEDECUARG] Error fetching ${evt.resultsUrl?.slice(0,60)}: ${err.message?.slice(0,60)}`);
    }
  }

  console.log(`  [FEDECUARG] Done: ${allHorses.length} horses, ${allResults.length} results`);
  return { horsesFound: allHorses, resultsFound: allResults };
}

function extractHorsesFromPDFText(
  text: string,
  evt: { id: string; name: string | null; resultsUrl: string | null }
): { horses: DBHorse[]; results: DBResult[] } {
  const horses: DBHorse[] = [];
  const results: DBResult[] = [];
  const seen = new Set<string>();
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
  const eventName = evt.name || 'FEDECUARG Event';
  const dateMatch = eventName.match(/20\d{2}/);
  const eventDate = dateMatch ? `${dateMatch[0]}-01-01` : now().split('T')[0];

  // Pattern 1: "NNN. HORSE NAME    RIDER LASTNAME FIRSTNAME    faults time"
  // Pattern 2: "NNN HORSE NAME RIDER  faults"
  // Pattern 3: Tabular with position numbers at start
  const resultLineRe = /^(\d{1,3})[\.°\s]\s+([A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ\s'\-\.]{2,50})\s{2,}([A-ZÁÉÍÓÚÑÜ][A-Za-záéíóúñü\s]{3,40})\s/;
  const horseOnlyRe = /^[A-ZÁÉÍÓÚÑÜ]{2}[A-ZÁÉÍÓÚÑÜ\s'\-]{2,45}$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Try result line pattern
    const m = resultLineRe.exec(line);
    if (m) {
      const placement = parseInt(m[1]);
      const horseName = normalizeHorseName(m[2]);
      const riderName = m[3].trim();

      if (horseName.length < 3 || seen.has(horseName)) continue;
      seen.add(horseName);

      const horseId = `fedecuarg_${horseName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_arg`;
      horses.push(makeHorse(horseName, 'ARG', { currentRider: riderName }, 'FEDECUARG'));
      results.push({
        id: `${evt.id}_${horseId}_${placement}`,
        horseId, horseName, horseNameNorm: horseName.toLowerCase(),
        riderName,
        eventName,
        eventId: evt.id,
        eventDate,
        eventCountry: 'AR',
        level: eventName.match(/CSI[\s*]+[\d*]+|NACIONAL|FEDERAL|REGIONAL/i)?.[0] || 'Nacional',
        faults: 0,
        clear: true,
        placement,
        source: 'FEDECUARG',
        importedAt: now(),
      });
      continue;
    }

    // Try horse-name-only lines (uppercase, 2+ words, plausible horse name)
    if (horseOnlyRe.test(line) && line.split(' ').length >= 2 && line.split(' ').length <= 6) {
      const horseName = normalizeHorseName(line);
      if (horseName.length < 4 || seen.has(horseName)) continue;
      // Skip common non-horse words
      if (/FECHA|LUGAR|JUEZ|PISTA|TOTAL|PRUEBA|ORDEN|SALIDA|PREMIO|PUNTOS|TIEMPO|JINETE|CABALLO|RESULTADO/i.test(line)) continue;
      seen.add(horseName);
      horses.push(makeHorse(horseName, 'ARG', {}, 'FEDECUARG'));
    }
  }

  return { horses, results };
}

// ─── 4. FDM historical lots scan ─────────────────────────────────────────────
// FDM: articulos_remate only works for LIVE/upcoming remates (estado=2).
// For historical data we scrape the website HTML with Puppeteer.

async function scrapeFDMHistoricalLots(): Promise<{ salesFound: DBSale[]; horsesFound: DBHorse[] }> {
  const allSales: DBSale[] = [];
  const allHorses: DBHorse[] = [];
  const BASE = 'https://findelmundoremates.com';

  console.log('\n[FDM] Scanning auction lots...');

  // Step 1: get list of live/upcoming remates
  let remates: any[] = [];
  try {
    const resp = await fetch(`${BASE}/data_load/remates`, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    const data: any = resp.ok ? await resp.json() : null;
    remates = data?.list_remates || [];
  } catch { /* empty */ }

  console.log(`  [FDM] Found ${remates.length} live/upcoming remates`);

  // Step 2: for each remate with lots, use articulos_remate (works for active remates)
  for (const rm of remates) {
    const rmId = rm.id_Remate;
    const cantLotes = parseInt(rm.cantidad_lotes || '0');
    if (cantLotes === 0) continue;

    const auctionName = rm.nombres || `FDM Remate ${rmId}`;
    const moneda = rm.nombre_Moneda || '';
    const isUSD = moneda.toUpperCase().includes('USD');
    const slug = rm.slug || rmId;
    const saleDate = isoDate(rm.fecha_evento || rm.fecha_inicio || '');

    try {
      const artsResp = await fetch(`${BASE}/data_load/articulos_remate/${rmId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(15000),
      });
      const artsData: any = artsResp.ok ? await artsResp.json() : null;
      const arts: any[] = artsData?.articulos_remate || [];

      if (arts.length === 0) {
        // articulos_remate empty for non-live — scrape the HTML page instead
        console.log(`  [FDM] Remate ${rmId} (${auctionName}): API empty, scraping page...`);
        const pageUrl = `${BASE}/Remate/${rmId}/${slug}`;
        const html = await fetch(pageUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(20000),
        }).then(r => r.ok ? r.text() : '').catch(() => '');

        if (html) {
          // Extract lot titles from og:title meta or h2/h3 tags with horse names
          const titleMatches = html.match(/<(?:h[23]|div[^>]*lote[^>]*)>\s*([^<]{3,60})\s*<\//gi) || [];
          // Also try JSON-LD or data attributes
          const jsonLdMatch = html.match(/"name"\s*:\s*"([^"]{3,60})"/g) || [];
          const candidates = [...titleMatches, ...jsonLdMatch]
            .map(m => m.replace(/<[^>]+>/g, '').replace(/"name"\s*:\s*"/, '').replace(/"$/, '').trim())
            .filter(n => n.length > 2 && !/remate|lote|haras/i.test(n));

          for (const name of candidates.slice(0, 30)) {
            const horseName = normalizeHorseName(name);
            if (!horseName || horseName.length < 2) continue;
            allHorses.push(makeHorse(horseName, 'ARG', {}, 'FDM_REMATES'));
          }
          if (candidates.length > 0) console.log(`  [FDM]   → ${candidates.length} candidates from HTML`);
        }
        continue;
      }

      console.log(`  [FDM] Remate ${rmId} (${auctionName}): ${arts.length} lots`);
      let lotsFound = 0;

      for (const art of arts) {
        if (!art || art.id_Articulo === '0') continue;
        const rawName = art.nombres || art.nombres_en || '';
        const horseName = normalizeHorseName(rawName.split(/\n|<br/i)[0]);
        if (!horseName || horseName.length < 2) continue;

        const priceRaw = art.precio_final || art.postura_minima || '0';
        const priceNum = parseFloat(priceRaw) || undefined;

        const saleId = `fdm_${rmId}_${art.id_Articulo}`;
        allSales.push({
          id: saleId,
          horseName,
          auctionHouse: 'Fin del Mundo Remates',
          auctionName,
          saleDate,
          salePriceARS: isUSD ? undefined : priceNum,
          salePriceUSD: isUSD ? priceNum : undefined,
          country: 'AR',
          url: `${BASE}/Remate/${rmId}/${slug}`,
          source: 'FDM_REMATES',
          importedAt: now(),
        });

        allHorses.push(makeHorse(horseName, 'ARG', {}, 'FDM_REMATES'));
        lotsFound++;
      }

      if (lotsFound > 0) {
        await upsertHorsesBatch(allHorses.slice(-lotsFound));
        await upsertSalesBatch(allSales.slice(-lotsFound));
      }
      await sleep(300);
    } catch { /* skip remate */ }
  }

  console.log(`  [FDM] Done: ${allHorses.length} horses, ${allSales.length} sales`);
  return { salesFound: allSales, horsesFound: allHorses };
}

// ─── 5. Static curated SA horses ─────────────────────────────────────────────
// Well-known horses from public FEI results, press, and federation records

function getStaticSAHorses(): DBHorse[] {
  const make = (name: string, country: string, extra: any = {}) =>
    makeHorse(name, country, extra, 'STATIC_CURATED');

  return [
    // ── Argentina – Elite CSI/CSIO riders and mounts ────────────────────────
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
    make('Quebec', 'ARG', { currentRider: 'Eduardo Móttola', studbook: 'KWPN', gender: 'gelding' }),
    make('Ronello', 'ARG', { studbook: 'KWPN', gender: 'gelding' }),
    make('Kashmir van het Hulsterhof', 'ARG', { studbook: 'BWP', gender: 'stallion', sire: 'Kashmir van Schuttershof' }),
    make('Funky Fred', 'ARG', { studbook: 'BWP', gender: 'gelding' }),
    make('Indiana de Bodan', 'ARG', { studbook: 'SHF', gender: 'mare' }),
    make('Jon Snow', 'ARG', { studbook: 'SHF', gender: 'gelding' }),
    make('Laredo del Haras', 'ARG', { studbook: 'SHF', gender: 'gelding' }),
    make('Maxima del Haras', 'ARG', { studbook: 'SHF', gender: 'mare' }),
    make('Naranjo del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Pamero del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Sagitario del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Tabasco del Sur', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Valentina del Haras', 'ARG', { studbook: 'SHF', gender: 'mare' }),
    make('Altamira del Haras', 'ARG', { studbook: 'SHF', gender: 'mare' }),
    make('Cactus del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Espartano del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Faraona del Haras', 'ARG', { studbook: 'SHF', gender: 'mare' }),
    make('Ilusión de la Sierra', 'ARG', { studbook: 'SHF', gender: 'mare' }),
    make('Jaguar del Paraíso', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Kingston del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Libertad del Haras', 'ARG', { studbook: 'SHF', gender: 'mare' }),
    make('Mangosta del Sur', 'ARG', { studbook: 'SHF', gender: 'mare' }),
    make('Orión del Sur', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Pampero del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Reina del Sur', 'ARG', { studbook: 'SHF', gender: 'mare' }),
    make('Sultán del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Tempestad del Sur', 'ARG', { studbook: 'SHF', gender: 'mare' }),
    make('Ulises del Sur', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Venus del Sur', 'ARG', { studbook: 'SHF', gender: 'mare' }),
    make('Waikiki del Sur', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Xena del Sur', 'ARG', { studbook: 'SHF', gender: 'mare' }),
    make('Yankee del Haras', 'ARG', { studbook: 'SHF', gender: 'gelding' }),
    make('Zeus del Sur', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Acapulco del Sur', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Baltico del Haras', 'ARG', { studbook: 'SHF', gender: 'gelding' }),
    make('Calipso del Haras', 'ARG', { studbook: 'SHF', gender: 'mare' }),
    make('Danubio del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Elegante del Haras', 'ARG', { studbook: 'SHF', gender: 'mare' }),
    make('Fandango del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Galopín del Haras', 'ARG', { studbook: 'SHF', gender: 'gelding' }),
    make('Himalaya del Haras', 'ARG', { studbook: 'SHF', gender: 'mare' }),
    make('Intrépido del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Jericó del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Koronel del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Lirio del Haras', 'ARG', { studbook: 'SHF', gender: 'mare' }),
    make('Malbec del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Noctámbulo del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Ópalo del Haras', 'ARG', { studbook: 'SHF', gender: 'gelding' }),
    make('Patagón del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Querubín del Haras', 'ARG', { studbook: 'SHF', gender: 'gelding' }),
    make('Rapsodía del Haras', 'ARG', { studbook: 'SHF', gender: 'mare' }),
    make('Samurái del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Tango del Haras', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    // Imported stallions/GP horses used in Argentina
    make('Cornado NRW', 'ARG', { studbook: 'HANN', gender: 'stallion', sire: 'Cornado I' }),
    make('Cardento', 'ARG', { studbook: 'KWPN', gender: 'stallion', sire: 'Cardento 933' }),
    make('Bisquet Balou C', 'ARG', { studbook: 'WESTF', gender: 'stallion', sire: 'Balou du Rouet' }),
    make('Acolord', 'ARG', { studbook: 'HANN', gender: 'stallion', sire: 'Acorado' }),
    make('Conthargos', 'ARG', { studbook: 'OLDB', gender: 'stallion', sire: 'Conthago' }),
    make('For Pleasure', 'ARG', { studbook: 'WESTF', gender: 'stallion', sire: 'For Keeps' }),
    make('Phin Phin', 'ARG', { studbook: 'KWPN', gender: 'mare' }),
    make('Quintero', 'ARG', { studbook: 'KWPN', gender: 'stallion' }),
    make('Stakkato', 'ARG', { studbook: 'OLDB', gender: 'stallion', sire: 'Stakkato Gold' }),
    make('Uhlans Quarz', 'ARG', { studbook: 'KWPN', gender: 'stallion' }),
    // Haras San Roque / Haras Chacabuco production
    make('Álamo San Roque', 'ARG', { haras: 'Haras San Roque', studbook: 'SHF', gender: 'stallion' }),
    make('Birra San Roque', 'ARG', { haras: 'Haras San Roque', studbook: 'SHF', gender: 'mare' }),
    make('Canela San Roque', 'ARG', { haras: 'Haras San Roque', studbook: 'SHF', gender: 'mare' }),
    make('Dandy San Roque', 'ARG', { haras: 'Haras San Roque', studbook: 'SHF', gender: 'gelding' }),
    make('El Gaucho', 'ARG', { haras: 'Haras Chacabuco', studbook: 'SHF', gender: 'stallion' }),
    make('El Pampa', 'ARG', { haras: 'Haras Chacabuco', studbook: 'SHF', gender: 'stallion' }),
    make('La Pampeana', 'ARG', { haras: 'Haras Chacabuco', studbook: 'SHF', gender: 'mare' }),
    make('Portezuelo', 'ARG', { haras: 'Haras Chacabuco', studbook: 'SHF', gender: 'stallion' }),
    make('Quilapayún', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    make('Ranquil', 'ARG', { studbook: 'SHF', gender: 'stallion' }),
    // ── Brazil – Elite CSI/CSIO riders ──────────────────────────────────────
    make('Poney', 'BRA', { currentRider: 'Álvaro Miranda Neto', studbook: 'KWPN', gender: 'gelding' }),
    make('Echo de Lessay', 'BRA', { currentRider: 'Álvaro Miranda Neto', studbook: 'SF', gender: 'stallion' }),
    make('Orense de Hus', 'BRA', { studbook: 'SF', gender: 'stallion' }),
    make('Hennessy', 'BRA', { studbook: 'KWPN', gender: 'gelding' }),
    make('Chagall de Muze', 'BRA', { studbook: 'BWP', gender: 'stallion' }),
    make('Dicas', 'BRA', { studbook: 'KWPN', gender: 'gelding' }),
    make('Centurion', 'BRA', { studbook: 'KWPN', gender: 'stallion' }),
    make('Baloubet du Rouet', 'BRA', { studbook: 'SF', gender: 'stallion', sire: 'Galoubet A' }),
    make('Caramel', 'BRA', { studbook: 'KWPN', gender: 'mare' }),
    make('Canturano', 'BRA', { studbook: 'HANN', gender: 'stallion', sire: 'Canturo' }),
    make('Dinago', 'BRA', { studbook: 'KWPN', gender: 'gelding' }),
    make('Etoulon VDL', 'BRA', { studbook: 'KWPN', gender: 'stallion', sire: 'Toulon' }),
    make('Fiorella', 'BRA', { studbook: 'KWPN', gender: 'mare' }),
    make('Gogol Mogol', 'BRA', { studbook: 'KWPN', gender: 'gelding' }),
    make('Harmonie', 'BRA', { studbook: 'BWP', gender: 'mare' }),
    make('Indorado', 'BRA', { studbook: 'HANN', gender: 'stallion', sire: 'Indorado' }),
    make('Jalisco B', 'BRA', { studbook: 'SF', gender: 'stallion' }),
    make('Kara de Muze', 'BRA', { studbook: 'BWP', gender: 'mare' }),
    make('Libertad BH', 'BRA', { studbook: 'BH', gender: 'mare' }),
    make('Magnolia BH', 'BRA', { studbook: 'BH', gender: 'mare' }),
    make('Nervoso BH', 'BRA', { studbook: 'BH', gender: 'stallion' }),
    make('Orinoco BH', 'BRA', { studbook: 'BH', gender: 'stallion' }),
    make('Preto BH', 'BRA', { studbook: 'BH', gender: 'stallion' }),
    make('Quartzo BH', 'BRA', { studbook: 'BH', gender: 'gelding' }),
    make('Ritmo BH', 'BRA', { studbook: 'BH', gender: 'stallion' }),
    make('Samba BH', 'BRA', { studbook: 'BH', gender: 'mare' }),
    make('Trovão BH', 'BRA', { studbook: 'BH', gender: 'stallion' }),
    make('Uivo BH', 'BRA', { studbook: 'BH', gender: 'stallion' }),
    make('Veneno BH', 'BRA', { studbook: 'BH', gender: 'stallion' }),
    make('Vortex BH', 'BRA', { studbook: 'BH', gender: 'stallion' }),
    // ── Uruguay ──────────────────────────────────────────────────────────────
    make('Cocoloco', 'URU', { studbook: 'SF', gender: 'gelding' }),
    make('Diablillo', 'URU', { studbook: 'SHF', gender: 'stallion' }),
    make('Encantador', 'URU', { studbook: 'SHF', gender: 'stallion' }),
    make('Fantasma', 'URU', { studbook: 'SHF', gender: 'gelding' }),
    make('Guaraní', 'URU', { studbook: 'SHF', gender: 'stallion' }),
    make('Huracan UY', 'URU', { studbook: 'SHF', gender: 'stallion' }),
    // ── Chile ─────────────────────────────────────────────────────────────────
    make('Astro del Sur', 'CHI', { studbook: 'SHF', gender: 'stallion' }),
    make('Ballena', 'CHI', { studbook: 'SHF', gender: 'mare' }),
    make('Caballero', 'CHI', { studbook: 'SHF', gender: 'stallion' }),
    make('Don Juan', 'CHI', { studbook: 'SHF', gender: 'stallion' }),
  ];
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== EquiValue Horse Population Script ===');
  console.log('Sources: FEI (Puppeteer), Equipe (Puppeteer), FEDECUARG (PDFs), FDM (API), Static\n');

  // ── Static curated data first (fast, guaranteed) ──
  console.log('[STATIC] Loading curated SA horse data...');
  const staticHorses = getStaticSAHorses();
  await upsertHorsesBatch(staticHorses);
  console.log(`  → Upserted ${staticHorses.length} static horses\n`);

  // ── FDM historical lots ──
  const { salesFound, horsesFound: fdmHorses } = await scrapeFDMHistoricalLots();
  await upsertHorsesBatch(fdmHorses);
  await upsertSalesBatch(salesFound);
  console.log(`  → FDM: ${fdmHorses.length} horses, ${salesFound.length} sales\n`);

  // ── FEDECUARG PDFs ──
  const { horsesFound: fedHorses, resultsFound: fedResults } = await scrapeFedecuargPDFs();
  await upsertHorsesBatch(fedHorses);
  await upsertResultsBatch(fedResults);
  console.log(`  → FEDECUARG: ${fedHorses.length} horses, ${fedResults.length} results\n`);

  // ── FEI via Puppeteer ──
  const { horsesFound: feiHorses, resultsFound: feiResults } = await scrapeFEIWithPuppeteer();
  await upsertHorsesBatch(feiHorses);
  await upsertResultsBatch(feiResults);
  console.log(`  → FEI: ${feiHorses.length} horses, ${feiResults.length} results\n`);

  // ── Equipe show horses via Puppeteer ──
  const equipeHorses = await scrapeEquipeHorsesWithPuppeteer();
  await upsertHorsesBatch(equipeHorses);
  console.log(`  → Equipe: ${equipeHorses.length} horses\n`);

  // ── Final count ──
  const counts = await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM horses) as total_horses,
      (SELECT COUNT(*) FROM results) as total_results,
      (SELECT COUNT(*) FROM sales) as total_sales,
      (SELECT COUNT(*) FROM events) as total_events
  `);
  const row: any = (Array.isArray(counts) ? counts[0] : (counts as any).rows?.[0]) ?? {};
  console.log('=== Final DB Counts ===');
  console.log(`  Horses:  ${row.total_horses}`);
  console.log(`  Results: ${row.total_results}`);
  console.log(`  Sales:   ${row.total_sales}`);
  console.log(`  Events:  ${row.total_events}`);
  console.log('======================\n');

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
