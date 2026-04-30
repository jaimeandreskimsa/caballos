import { Hono } from 'hono';
import { db } from '../db/index.js';
import { sales } from '../db/schema.js';
import { sql } from 'drizzle-orm';

const app = new Hono();

// GET /api/sales/stats
app.get('/stats', async (c) => {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sales);
  return c.json({ total: row?.count ?? 0 });
});

// POST /api/sales/bulk
app.post('/bulk', async (c) => {
  const body = await c.req.json<Record<string, unknown>[]>();
  if (!Array.isArray(body) || body.length === 0) return c.json({ inserted: 0 });

  const CHUNK = 200;
  let total = 0;

  for (let i = 0; i < body.length; i += CHUNK) {
    const chunk = body.slice(i, i + CHUNK) as (typeof sales.$inferInsert)[];
    await db
      .insert(sales)
      .values(chunk)
      .onConflictDoNothing();
    total += chunk.length;
  }

  return c.json({ inserted: total });
});

export default app;
