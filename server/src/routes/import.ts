/**
 * import.ts — Admin endpoints for importing horse data
 *
 * POST /api/import/fei   { feiId, country }
 *   → Scrapes FEI horse page with Puppeteer and saves to DB.
 *   → Only works when NODE_ENV !== 'production' (Railway has no Chromium).
 *     On Railway use: cd server && tsx src/scripts/scrape-fei.ts --fei=ID --country=CC
 */

import { Hono } from 'hono';
import { db } from '../db/index.js';
import { horses, results } from '../db/schema.js';

const app = new Hono();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoDate(raw: string): string {
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.split('T')[0];
  return new Date().toISOString().split('T')[0];
}

function slugify(name: string): string {
  return name.toLowerCase()
    .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e')
    .replace(/[íìï]/g, 'i').replace(/[óòö]/g, 'o')
    .replace(/[úùü]/g, 'u').replace(/[ñ]/g, 'n')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function scrapeAndSave(feiId: string, country: string) {
  // Lazy-import puppeteer so the module loads even without Chrome
  const { default: puppeteerBase } = await import('puppeteer-extra');
  const { default: StealthPlugin } = await import('puppeteer-extra-plugin-stealth');
  (puppeteerBase as any).use(StealthPlugin());
  const puppeteer = puppeteerBase as any;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1366, height: 768 });

  try {
    await page.goto(`https://www.fei.org/horse/${feiId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 40000,
    });
    await page.waitForSelector('h1', { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 2000));

    const raw = await page.evaluate((feiId: string) => {
      const bodyText = document.body.innerText;
      const after = (label: string) => {
        const re = new RegExp(label + '[\\s\\t\\n]+([^\\n\\t]+)', 'i');
        return bodyText.match(re)?.[1]?.trim();
      };

      const name     = (document.querySelector('h1') as HTMLElement)?.innerText?.trim() ?? '';
      const dob      = after('Date of Birth');
      const sex      = after('Sex');
      const colour   = after('Colour');
      const studbook = after('Studbook');
      const sire     = bodyText.match(/Sire:\s*([^\n\t]+)/)?.[1]?.trim();
      const dam      = bodyText.match(/Dam:\s*([^\n\t]+)/)?.[1]?.trim();
      const damSire  = bodyText.match(/Sire of Dam:\s*([^\n\t]+)/)?.[1]?.trim();
      const starts   = parseInt(bodyText.match(/Number of starts:\s*(\d+)/)?.[1] ?? '0', 10) || undefined;
      const wins     = parseInt(bodyText.match(/Number of wins:\s*(\d+)/)?.[1] ?? '0', 10) || undefined;

      const table = document.querySelector('table[data-fei-id]') as HTMLTableElement;
      const rows: any[] = [];
      if (table) {
        table.querySelectorAll('tbody tr').forEach(tr => {
          const cells = Array.from(tr.querySelectorAll('td')) as HTMLTableCellElement[];
          if (cells.length < 6) return;
          rows.push({
            date:        cells[0].innerText.trim(),
            show:        cells[1].innerText.trim(),
            showUrl:     (cells[1].querySelector('a') as HTMLAnchorElement)?.href,
            event:       cells[2].innerText.trim(),
            competition: cells[3].innerText.trim(),
            height:      cells[4].innerText.trim(),
            athlete:     cells[5].innerText.trim(),
            position:    cells[6]?.innerText.trim() ?? '',
          });
        });
      }

      return { feiId, name, dob, sex, colour, studbook, sire, dam, damSire, starts, wins, rows };
    }, feiId);

    await browser.close();
    return raw;
  } catch (err) {
    await browser.close();
    throw err;
  }
}

// ─── POST /api/import/fei ─────────────────────────────────────────────────────

app.post('/fei', async (c) => {
  if (process.env.NODE_ENV === 'production') {
    return c.json({
      error: 'Scraping no disponible en producción. Usa: cd server && tsx src/scripts/scrape-fei.ts --fei=ID --country=CC',
    }, 503);
  }

  let body: { feiId?: string; country?: string };
  try { body = await c.req.json(); } catch { body = {}; }

  const feiId   = (body.feiId ?? '').trim().toUpperCase();
  const country = (body.country ?? 'ARG').trim().toUpperCase();

  if (!feiId) return c.json({ error: 'feiId requerido' }, 400);

  try {
    const raw = await scrapeAndSave(feiId, country);

    if (!raw.name) return c.json({ error: 'No se pudo extraer datos del caballo' }, 422);

    const now = new Date().toISOString().split('T')[0];
    const birthYear = raw.dob
      ? parseInt(raw.dob.split('/')[2] ?? raw.dob.split('-')[0])
      : undefined;
    const id = `${slugify(raw.name)}-${country.toLowerCase()}`;

    // Upsert horse
    await db.insert(horses).values({
      id,
      name:         raw.name,
      nameLower:    raw.name.toLowerCase(),
      feiId:        raw.feiId,
      birthYear:    isNaN(birthYear!) ? undefined : birthYear,
      studbook:     raw.studbook || undefined,
      gender:       raw.sex?.toLowerCase() as any,
      color:        raw.colour || undefined,
      countryCode:  country,
      sire:         raw.sire || undefined,
      dam:          raw.dam || undefined,
      damSire:      raw.damSire || undefined,
      currentRider: raw.rows[0]?.athlete || undefined,
      sources:      ['FEI'],
      firstSeen:    now,
      lastUpdated:  now,
    }).onConflictDoUpdate({
      target: horses.id,
      set: {
        feiId:         raw.feiId,
        birthYear:     isNaN(birthYear!) ? undefined : birthYear,
        studbook:      raw.studbook || undefined,
        gender:        raw.sex?.toLowerCase() as any,
        color:         raw.colour || undefined,
        sire:          raw.sire || undefined,
        dam:           raw.dam || undefined,
        damSire:       raw.damSire || undefined,
        currentRider:  raw.rows[0]?.athlete || undefined,
        lastUpdated:   now,
      },
    });

    // Upsert results
    let resultsInserted = 0;
    for (const r of raw.rows) {
      if (!r.date) continue;
      const eventDate = isoDate(r.date);
      const eventIdMatch = r.showUrl?.match(/\/events\/([^/]+)/);
      await db.insert(results).values({
        id: `fei-${raw.feiId}-${eventDate}-${(r.competition || 'comp').replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '').substring(0, 30)}`,
        horseId:      id,
        horseName:    raw.name,
        horseNameNorm: raw.name.toLowerCase(),
        riderName:    r.athlete || undefined,
        eventName:    r.show,
        eventId:      eventIdMatch?.[1],
        eventDate,
        eventCountry: country,
        level:        r.event || '1.20m',
        category:     r.competition || undefined,
        placement:    r.position && !isNaN(parseInt(r.position)) ? parseInt(r.position) : undefined,
        faults:       0,
        clear:        r.position === '1',
        source:       'FEI',
        rawData:      JSON.stringify(r),
        importedAt:   now,
      }).onConflictDoNothing();
      resultsInserted++;
    }

    return c.json({
      ok: true,
      horse: { id, name: raw.name, feiId, country, starts: raw.starts, wins: raw.wins },
      resultsImported: resultsInserted,
      resultsOnPage: raw.rows.length,
      note: raw.rows.length < (raw.starts ?? 0)
        ? `Solo se importaron ${raw.rows.length} de ${raw.starts} resultados totales. Para el historial completo inicia sesión en FEI.`
        : null,
    });
  } catch (err: any) {
    console.error('FEI import error:', err.message);
    return c.json({ error: `Error al scrapear FEI: ${err.message}` }, 500);
  }
});

export default app;
