import { Hono } from 'hono';
import { db } from '../db/index.js';
import { events } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';

const app = new Hono();

// GET /api/events?country=AR
app.get('/', async (c) => {
  const country = c.req.query('country');
  const rows = country
    ? await db.select().from(events).where(eq(events.country, country))
    : await db.select().from(events).limit(200);
  return c.json(rows);
});

// GET /api/events/stats
app.get('/stats', async (c) => {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(events);
  return c.json({ total: row?.count ?? 0 });
});

// POST /api/events/bulk
app.post('/bulk', async (c) => {
  const body = await c.req.json<Record<string, unknown>[]>();
  if (!Array.isArray(body) || body.length === 0) return c.json({ inserted: 0 });

  const CHUNK = 200;
  let total = 0;

  for (let i = 0; i < body.length; i += CHUNK) {
    const chunk = body.slice(i, i + CHUNK) as (typeof events.$inferInsert)[];
    await db
      .insert(events)
      .values(chunk)
      .onConflictDoUpdate({
        target: events.id,
        set: {
          name:        sql`excluded.name`,
          hasResults:  sql`excluded.has_results OR ${events.hasResults}`,
          endDate:     sql`COALESCE(excluded.end_date, ${events.endDate})`,
          resultsUrl:  sql`COALESCE(excluded.results_url, ${events.resultsUrl})`,
          pdfUrl:      sql`COALESCE(excluded.pdf_url, ${events.pdfUrl})`,
          importedAt:  sql`excluded.imported_at`,
        },
      });
    total += chunk.length;
  }

  return c.json({ inserted: total });
});

export default app;
