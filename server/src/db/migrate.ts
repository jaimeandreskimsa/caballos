import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function runMigrations() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');

  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  await migrate(db, {
    migrationsFolder: join(__dirname, '../../../drizzle'),
  });

  await client.end();
}
