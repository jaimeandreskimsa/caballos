import { Hono } from 'hono';
import { db } from '../db/index.js';
import { horses } from '../db/schema.js';
import { eq, ilike, sql, asc } from 'drizzle-orm';

const app = new Hono();

// GET /api/horses?page=1&limit=50&q=NAME&country=ARG
app.get('/', async (c) => {
  const page    = Math.max(1, parseInt(c.req.query('page')  ?? '1'));
  const limit   = Math.min(200, parseInt(c.req.query('limit') ?? '50'));
  const q       = (c.req.query('q') ?? '').toLowerCase().trim();
  const country = (c.req.query('country') ?? '').toUpperCase().trim();
  const offset  = (page - 1) * limit;

  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(horses);

  let query = db.select().from(horses).$dynamic();
  if (q)       query = query.where(ilike(horses.nameLower, `%${q}%`));
  if (country) query = query.where(eq(horses.countryCode, country));
  const rows = await query.orderBy(asc(horses.nameLower)).limit(limit).offset(offset);

  return c.json({ total, page, limit, data: rows });
});

// GET /api/horses/search?q=NAME&limit=20
app.get('/search', async (c) => {
  const q = (c.req.query('q') ?? '').toLowerCase().trim();
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20'), 200);
  if (!q) return c.json([]);

  const rows = await db
    .select()
    .from(horses)
    .where(ilike(horses.nameLower, `${q}%`))
    .limit(limit);

  return c.json(rows);
});

// GET /api/horses/stats
app.get('/stats', async (c) => {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(horses);
  return c.json({ total: row?.count ?? 0 });
});

// GET /api/horses/:id
app.get('/:id', async (c) => {
  const [row] = await db
    .select()
    .from(horses)
    .where(eq(horses.id, c.req.param('id')));
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});

// POST /api/horses/bulk — upsert array of horse records
app.post('/bulk', async (c) => {
  const body = await c.req.json<Record<string, unknown>[]>();
  if (!Array.isArray(body) || body.length === 0) return c.json({ inserted: 0 });

  const CHUNK = 200;
  let total = 0;

  for (let i = 0; i < body.length; i += CHUNK) {
    const chunk = body.slice(i, i + CHUNK) as (typeof horses.$inferInsert)[];
    await db
      .insert(horses)
      .values(chunk)
      .onConflictDoUpdate({
        target: horses.id,
        set: {
          name:         sql`excluded.name`,
          nameLower:    sql`excluded.name_lower`,
          feiId:        sql`COALESCE(excluded.fei_id, ${horses.feiId})`,
          studbook:     sql`COALESCE(excluded.studbook, ${horses.studbook})`,
          gender:       sql`COALESCE(excluded.gender, ${horses.gender})`,
          color:        sql`COALESCE(excluded.color, ${horses.color})`,
          sire:         sql`COALESCE(excluded.sire, ${horses.sire})`,
          dam:          sql`COALESCE(excluded.dam, ${horses.dam})`,
          damSire:      sql`COALESCE(excluded.dam_sire, ${horses.damSire})`,
          currentRider: sql`excluded.current_rider`,
          owner:        sql`COALESCE(excluded.owner, ${horses.owner})`,
          haras:        sql`COALESCE(excluded.haras, ${horses.haras})`,
          sources: sql`(
            SELECT array_agg(DISTINCT s)
            FROM unnest(excluded.sources || ${horses.sources}) AS s
          )`,
          lastUpdated:  sql`excluded.last_updated`,
        },
      });
    total += chunk.length;
  }

  return c.json({ inserted: total });
});

export default app;
