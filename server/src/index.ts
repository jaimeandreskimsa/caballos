import 'dotenv/config';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { db, client } from './db/index.js';
import { horses, results, events, sales } from './db/schema.js';
import { sql } from 'drizzle-orm';
import horsesRoute from './routes/horses.js';
import resultsRoute from './routes/results.js';
import eventsRoute from './routes/events.js';
import salesRoute from './routes/sales.js';
import metaRoute from './routes/meta.js';

const app = new Hono();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use('*', logger());
app.use('/api/*', cors({
  origin: process.env.CORS_ORIGIN ?? '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Health + DB stats ────────────────────────────────────────────────────────
app.get('/health', c => c.json({ ok: true, ts: new Date().toISOString() }));

app.get('/api/stats', async (c) => {
  const [[h], [r], [e], [s]] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(horses),
    db.select({ count: sql<number>`count(*)::int` }).from(results),
    db.select({ count: sql<number>`count(*)::int` }).from(events),
    db.select({ count: sql<number>`count(*)::int` }).from(sales),
  ]);
  return c.json({
    totalHorses: h?.count ?? 0,
    totalResults: r?.count ?? 0,
    totalEvents: e?.count ?? 0,
    totalSales: s?.count ?? 0,
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.route('/api/horses', horsesRoute);
app.route('/api/results', resultsRoute);
app.route('/api/events', eventsRoute);
app.route('/api/sales', salesRoute);
app.route('/api/meta', metaRoute);

// ─── Serve frontend static files in production ───────────────────────────────
if (process.env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: './public' }));
  app.get('/*', serveStatic({ path: './public/index.html' }));
}

// ─── Start ────────────────────────────────────────────────────────────────────
const port = parseInt(process.env.PORT ?? '3000');

console.log('🔌 Connecting to database…');

async function bootstrap() {
  // Verify DB connection
  await db.execute(sql`SELECT 1`);
  console.log('✅ Database connected');

  // Auto-create tables (idempotent)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS horses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_lower TEXT NOT NULL,
      fei_id TEXT,
      birth_year INTEGER,
      breed TEXT,
      studbook TEXT,
      gender TEXT,
      color TEXT,
      country_code TEXT,
      sire TEXT,
      dam TEXT,
      dam_sire TEXT,
      current_rider TEXT,
      owner TEXT,
      haras TEXT,
      sources TEXT[] DEFAULT '{}',
      first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_horses_name_lower ON horses(name_lower)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_horses_country ON horses(country_code)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_horses_fei_id ON horses(fei_id)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      country TEXT,
      club TEXT,
      start_date DATE,
      end_date DATE,
      level TEXT,
      discipline TEXT,
      results_url TEXT,
      pdf_url TEXT,
      source TEXT,
      has_results BOOLEAN DEFAULT FALSE,
      imported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_events_country ON events(country)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS results (
      id TEXT PRIMARY KEY,
      horse_id TEXT,
      horse_name TEXT NOT NULL,
      horse_name_norm TEXT NOT NULL,
      rider_name TEXT,
      event_name TEXT,
      event_id TEXT,
      event_date DATE,
      event_country TEXT,
      club TEXT,
      level TEXT,
      category TEXT,
      placement INTEGER,
      total_entries INTEGER,
      faults REAL,
      time_faults REAL,
      jump_faults INTEGER,
      time REAL,
      clear BOOLEAN,
      phase TEXT,
      points REAL,
      source TEXT NOT NULL,
      raw_data JSONB,
      imported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_results_horse_id ON results(horse_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_results_horse_name ON results(horse_name_norm)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_results_source ON results(source)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_results_event_date ON results(event_date)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      horse_name TEXT NOT NULL,
      horse_id TEXT,
      auction_house TEXT,
      auction_name TEXT,
      sale_date DATE,
      sale_price_ars NUMERIC,
      sale_price_usd NUMERIC,
      sale_price_eur NUMERIC,
      lots INTEGER,
      haras TEXT,
      country TEXT,
      url TEXT,
      source TEXT,
      imported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  console.log('✅ Tables ready');

  serve({ fetch: app.fetch, port }, () => {
    console.log(`🚀 EquiValue API running on http://localhost:${port}`);
  });
}

bootstrap().catch(err => {
  console.error('❌ Startup failed:', err.message);
  process.exit(1);
});
