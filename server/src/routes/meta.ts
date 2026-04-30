import { Hono } from 'hono';
import { db } from '../db/index.js';
import { meta } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const app = new Hono();

// GET /api/meta/:key
app.get('/:key', async (c) => {
  const [row] = await db
    .select()
    .from(meta)
    .where(eq(meta.key, c.req.param('key')));
  if (!row) return c.json({ value: null });
  return c.json({ value: row.value });
});

// PUT /api/meta/:key
app.put('/:key', async (c) => {
  const { value } = await c.req.json<{ value: string }>();
  await db
    .insert(meta)
    .values({ key: c.req.param('key'), value })
    .onConflictDoUpdate({ target: meta.key, set: { value } });
  return c.json({ ok: true });
});

// GET /api/meta (all keys)
app.get('/', async (c) => {
  const rows = await db.select().from(meta);
  return c.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
});

export default app;
