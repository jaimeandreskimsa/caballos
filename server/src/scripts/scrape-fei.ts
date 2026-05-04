/**
 * scrape-fei.ts — FEI horse page scraper using Puppeteer stealth
 *
 * Scrapes horse info, pedigree, stats and last 3 results from FEI.org.
 * Works without FEI login. Full results history (>3) requires FEI account.
 *
 * Usage:
 *   cd server
 *   tsx src/scripts/scrape-fei.ts --fei=108MV97,109JG09 --country=ARG,BRA
 *   tsx src/scripts/scrape-fei.ts --fei=108MV97 --country=ARG --rider="Pablo Arias"
 *
 * Options:
 *   --fei=ID1,ID2,...    FEI IDs to import (required)
 *   --country=CC1,CC2   Country code for each horse (same order as --fei)
 *   --rider=NAME        Override rider name (optional)
 *   --dry               Dry run — print data without saving to DB
 */

import 'dotenv/config';
import puppeteerExtraDefault from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { db } from '../db/index.js';
import { horses, results } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const puppeteer = puppeteerExtraDefault as any;
puppeteer.use(StealthPlugin());

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => {
      const [k, ...v] = a.slice(2).split('=');
      return [k, v.join('=')];
    })
);

const feiIds     = (args.fei     ?? '').split(',').map(s => s.trim()).filter(Boolean);
const countries  = (args.country ?? '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
const dryRun     = 'dry' in args;
const riderOverride = args.rider ?? null;

if (feiIds.length === 0) {
  console.error('Usage: tsx src/scripts/scrape-fei.ts --fei=108MV97,109JG09 --country=ARG,BRA');
  process.exit(1);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeiHorseData {
  feiId: string;
  name: string;
  dob?: string;        // DD/MM/YYYY
  sex?: string;
  colour?: string;
  studbook?: string;
  sire?: string;
  dam?: string;
  damSire?: string;
  starts?: number;
  wins?: number;
  results: FeiResult[];
}

interface FeiResult {
  date: string;         // DD/MM/YYYY
  show: string;
  showUrl?: string;
  event: string;        // CSI1*, CSI4*-W, etc.
  competition: string;
  height: string;       // 140, 145, etc.
  athlete: string;
  athleteUrl?: string;
  position: string;
  score: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isoDate(raw: string): string {
  // DD/MM/YYYY → YYYY-MM-DD
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  // already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.split('T')[0];
  return new Date().toISOString().split('T')[0];
}

function mapLevel(eventCode: string): string {
  // CSI1* → 1.30m–1.40m range; CSI5* → 1.55m+
  // We store the FEI event code as-is in 'level' field
  return eventCode.trim() || '1.20m';
}

function mapHeight(raw: string): string {
  const n = parseInt(raw, 10);
  if (!n) return '1.20m';
  return `${(n / 100).toFixed(2)}m`;
}

function slugify(name: string): string {
  return name.toLowerCase()
    .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e')
    .replace(/[íìï]/g, 'i').replace(/[óòö]/g, 'o')
    .replace(/[úùü]/g, 'u').replace(/[ñ]/g, 'n')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

// ─── Scraper ─────────────────────────────────────────────────────────────────

async function waitForPage(page: any, maxWait = 30000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      const title = await page.title();
      if (!title.includes('Just a moment') && !title.includes('Cloudflare') && title.length > 0) {
        return true;
      }
    } catch (_) { /* navigating */ }
    await new Promise(r => setTimeout(r, 1500));
  }
  return false;
}

async function scrapeFeiHorse(page: any, feiId: string): Promise<FeiHorseData | null> {
  const url = `https://www.fei.org/horse/${feiId}`;
  console.log(`  → Fetching ${url}`);

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 });
  } catch (e) {
    console.error(`  ✗ Navigation error: ${(e as Error).message}`);
    return null;
  }

  const passed = await waitForPage(page, 35000);
  if (!passed) {
    console.error(`  ✗ Cloudflare or timeout on ${url}`);
    return null;
  }

  const pageTitle = await page.title();
  console.log(`  ℹ Page title: "${pageTitle}"`);

  // Wait a bit for Drupal JS to render the info sections
  await new Promise(r => setTimeout(r, 2500));

  const extractScript = `(function(feiId) {
    var bodyText = document.body ? document.body.innerText : '';
    var name = '';
    var h1 = document.querySelector('h1');
    if (h1) name = h1.innerText ? h1.innerText.trim() : '';

    function after(label) {
      var re = new RegExp(label + '[\\\\s\\\\t\\\\n]+([^\\\\n\\\\t]+)', 'i');
      var m = bodyText.match(re);
      return m ? m[1].trim() : undefined;
    }

    var dob      = after('Date of Birth');
    var sex      = after('Sex');
    var colour   = after('Colour');
    var studbook = after('Studbook');

    var sireM    = bodyText.match(/Sire:\\s*([^\\n\\t]+)/);
    var damM     = bodyText.match(/Dam:\\s*([^\\n\\t]+)/);
    var damSireM = bodyText.match(/Sire of Dam:\\s*([^\\n\\t]+)/);
    var sire     = sireM    ? sireM[1].trim()    : undefined;
    var dam      = damM     ? damM[1].trim()     : undefined;
    var damSire  = damSireM ? damSireM[1].trim() : undefined;

    var startsM = bodyText.match(/Number of starts:\\s*(\\d+)/);
    var winsM   = bodyText.match(/Number of wins:\\s*(\\d+)/);
    var starts  = startsM ? parseInt(startsM[1], 10) : undefined;
    var wins    = winsM   ? parseInt(winsM[1], 10)   : undefined;

    var table = document.querySelector('table[data-fei-id]');
    var rows = [];
    if (table) {
      var trs = table.querySelectorAll('tbody tr');
      for (var i = 0; i < trs.length; i++) {
        var cells = trs[i].querySelectorAll('td');
        if (cells.length < 6) continue;
        var showLink = cells[1].querySelector('a');
        var athLink  = cells[5].querySelector('a');
        rows.push({
          date:        cells[0].innerText ? cells[0].innerText.trim() : '',
          show:        cells[1].innerText ? cells[1].innerText.trim() : '',
          showUrl:     showLink ? showLink.href : undefined,
          event:       cells[2].innerText ? cells[2].innerText.trim() : '',
          competition: cells[3].innerText ? cells[3].innerText.trim() : '',
          height:      cells[4].innerText ? cells[4].innerText.trim() : '',
          athlete:     cells[5].innerText ? cells[5].innerText.trim() : '',
          athleteUrl:  athLink ? athLink.href : undefined,
          position:    cells[6] && cells[6].innerText ? cells[6].innerText.trim() : '',
          score:       cells[7] && cells[7].innerText ? cells[7].innerText.trim() : ''
        });
      }
    }

    return { feiId: feiId, name: name, dob: dob, sex: sex, colour: colour,
             studbook: studbook, sire: sire, dam: dam, damSire: damSire,
             starts: starts, wins: wins, results: rows };
  })('${feiId.replace(/'/g, "\\'")}')`;

  const data: FeiHorseData = await page.evaluate(extractScript);

  return data;
}

// ─── DB Upsert ────────────────────────────────────────────────────────────────

async function upsertHorse(data: FeiHorseData, countryCode: string, riderName?: string | null) {
  const now = today();
  const birthYear = data.dob
    ? parseInt(data.dob.split('/')[2] ?? data.dob.split('-')[0])
    : undefined;

  const id = `${slugify(data.name)}-${countryCode.toLowerCase()}`;

  const horseRow = {
    id,
    name: data.name,
    nameLower: data.name.toLowerCase(),
    feiId: data.feiId,
    birthYear: isNaN(birthYear!) ? undefined : birthYear,
    studbook: data.studbook || undefined,
    gender: data.sex?.toLowerCase() as any,
    color: data.colour || undefined,
    countryCode,
    sire: data.sire || undefined,
    dam: data.dam || undefined,
    damSire: data.damSire || undefined,
    currentRider: riderName || (data.results[0]?.athlete) || undefined,
    sources: ['FEI'],
    firstSeen: now,
    lastUpdated: now,
  };

  await db.insert(horses).values(horseRow)
    .onConflictDoUpdate({
      target: horses.id,
      set: {
        feiId:         horseRow.feiId,
        birthYear:     horseRow.birthYear,
        studbook:      horseRow.studbook,
        gender:        horseRow.gender,
        color:         horseRow.color,
        sire:          horseRow.sire,
        dam:           horseRow.dam,
        damSire:       horseRow.damSire,
        currentRider:  horseRow.currentRider,
        lastUpdated:   now,
      },
    });

  console.log(`  ✓ Horse upserted: ${data.name} (id: ${id})`);
  return id;
}

async function upsertResults(horseId: string, horseName: string, data: FeiHorseData, countryCode: string) {
  const now = today();
  let inserted = 0;

  for (const r of data.results) {
    if (!r.date || !r.show) continue;

    const eventDate  = isoDate(r.date);
    const level      = mapLevel(r.event);
    const height     = mapHeight(r.height);
    const placement  = r.position && !isNaN(parseInt(r.position)) ? parseInt(r.position) : undefined;

    // Derive country from show location (simple heuristic)
    const eventCountry = countryCode; // default to horse's country

    // Extract event ID from URL: /events/2025_CI_1215/... → 2025_CI_1215
    const eventIdMatch = r.showUrl?.match(/\/events\/([^/]+)/);
    const eventId = eventIdMatch?.[1];

    const resultRow = {
      id: `fei-${data.feiId}-${eventDate}-${r.competition.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '').substring(0, 30)}`,
      horseId,
      horseName,
      horseNameNorm: horseName.toLowerCase(),
      riderName: r.athlete || undefined,
      eventName: r.show,
      eventId,
      eventDate,
      eventCountry,
      level,
      category: r.competition || undefined,
      placement,
      faults: 0,
      clear: placement === 1 || false,
      source: 'FEI',
      rawData: JSON.stringify(r),
      importedAt: now,
    };

    await db.insert(results).values(resultRow)
      .onConflictDoNothing();
    inserted++;
  }

  console.log(`  ✓ Results: ${inserted} inserted (from ${data.results.length} on page)`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🏇 FEI Scraper — importing ${feiIds.length} horse(s)`);
  if (dryRun) console.log('⚠  DRY RUN — no DB writes\n');

  const browser = await puppeteer.launch({
    headless: false,   // Visible browser bypasses Cloudflare better
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1366,768',
    ],
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1366, height: 768 });

  // Accept FEI cookies on first page load
  try {
    await page.goto('https://www.fei.org/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));
    const acceptBtn = await page.$('a[href="#"].accept-cookies, button[class*="accept"], a[class*="agree"]');
    if (acceptBtn) await acceptBtn.click();
  } catch (_) { /* ignore */ }

  for (let i = 0; i < feiIds.length; i++) {
    const feiId  = feiIds[i];
    const country = countries[i] ?? countries[0] ?? 'ARG';

    console.log(`\n[${i + 1}/${feiIds.length}] ${feiId} (${country})`);

    const data = await scrapeFeiHorse(page, feiId);

    if (!data || !data.name) {
      const snippet = await page.evaluate('document.body.innerText.substring(0, 300)').catch(() => '');
      console.error(`  ✗ Could not extract data for ${feiId}`);
      console.error(`  ℹ Page snippet: ${snippet}`);
      continue;
    }

    console.log(`  📋 ${data.name}`);
    if (data.dob)      console.log(`     DOB: ${data.dob} | Sex: ${data.sex} | Colour: ${data.colour}`);
    if (data.sire)     console.log(`     Sire: ${data.sire} | Dam: ${data.dam}`);
    if (data.starts !== undefined) console.log(`     Stats: ${data.starts} starts, ${data.wins ?? 0} wins`);
    console.log(`     Results on page: ${data.results.length}`);
    data.results.forEach(r =>
      console.log(`       ${r.date}  ${r.event.padEnd(10)}  ${r.show.substring(0, 30).padEnd(30)}  pos: ${r.position || '—'}`)
    );

    if (!dryRun) {
      const horseId = await upsertHorse(data, country, riderOverride);
      await upsertResults(horseId, data.name, data, country);
    }

    // Polite delay between requests
    if (i < feiIds.length - 1) await new Promise(r => setTimeout(r, 2000));
  }

  await browser.close();
  console.log('\n✅ Done\n');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
