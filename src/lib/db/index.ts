import { attachDatabasePool } from '@vercel/functions';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as baseSchema from './schema';
import * as featureEvidenceSchema from './feature-evidence-schema';

const schema = { ...baseSchema, ...featureEvidenceSchema };
const globalForDatabase = globalThis as unknown as { votePredictPool?: Pool };

const connectionCandidates = [
  ['DATABASE_URL', process.env.DATABASE_URL],
  ['POSTGRES_URL', process.env.POSTGRES_URL],
  ['DATABASE_URL_UNPOOLED', process.env.DATABASE_URL_UNPOOLED],
  ['POSTGRES_URL_NON_POOLING', process.env.POSTGRES_URL_NON_POOLING],
] as const;

const selectedConnection = connectionCandidates.find(([, value]) => value?.trim());
export const databaseConnectionSource = selectedConnection?.[0] ?? 'missing';
const connectionString = selectedConnection?.[1]?.trim();

export const pool = globalForDatabase.votePredictPool ?? new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 20_000,
  connectionTimeoutMillis: 10_000,
});

if (process.env.NODE_ENV !== 'production') globalForDatabase.votePredictPool = pool;
if (process.env.VERCEL) attachDatabasePool(pool);

export const db = drizzle(pool, { schema });
