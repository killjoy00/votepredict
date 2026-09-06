import { attachDatabasePool } from '@vercel/functions';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const globalForDatabase = globalThis as unknown as { votePredictPool?: Pool };

export const pool = globalForDatabase.votePredictPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 20_000,
  connectionTimeoutMillis: 10_000,
});

if (process.env.NODE_ENV !== 'production') globalForDatabase.votePredictPool = pool;
if (process.env.VERCEL) attachDatabasePool(pool);

export const db = drizzle(pool, { schema });
