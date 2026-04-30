import { Hono } from 'hono';
import { db } from '../db/index.js';
import { results } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';

const app = new Hono();

// GET /api/results?horseId=xxx
app.get('/', async (c) => {
  const horseId = c.req.query('horseId');
  if (!horseId) return c.json([]);

  const rows = await db
    .select()
    .from(results)
    .where(eq(results.horseId, horseId));

  return c.json(rows);
});

// GET /api/results/stats
app.get('/stats', async (c) => {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(results);
  return c.json({ total: row?.count ?? 0 });
});

// POST /api/results/bulk — upsert array of result records
app.post('/bulk', async (c) => {
  const body = await c.req.json<Record<string, unknown>[]>();
  if (!Array.isArray(body) || body.length === 0) return c.json({ inserted: 0 });

  const CHUNK = 300;
  let total = 0;

  for (let i = 0; i < body.length; i += CHUNK) {
    const chunk = body.slice(i, i + CHUNK) as (typeof results.$inferInsert)[];
    await db
      .insert(results)
      .values(chunk)
      .onConflictDoNothing();
    total += chunk.length;
  }

  return c.json({ inserted: total });
});

export default app;
