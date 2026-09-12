export const EVALUATION_DATABASE_CANDIDATES = [
  'DATABASE_URL',
  'POSTGRES_URL',
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL_NON_POOLING',
] as const;

export type EvaluationDatabaseSource = typeof EVALUATION_DATABASE_CANDIDATES[number];

export interface EvaluationDatabaseConnection {
  source: EvaluationDatabaseSource;
  connectionString: string;
}

/**
 * Evaluation jobs should connect the same way the production runtime does. In
 * particular, a stale or provider-specific non-pooling alias must not override a
 * working DATABASE_URL that the application itself is already using.
 */
export function resolveEvaluationDatabaseConnection(
  env: Readonly<Record<string, string | undefined>> = process.env,
): EvaluationDatabaseConnection | undefined {
  for (const source of EVALUATION_DATABASE_CANDIDATES) {
    const value = env[source]?.trim();
    if (value) return { source, connectionString: value };
  }
  return undefined;
}

export function requireEvaluationDatabaseConnection(
  env: Readonly<Record<string, string | undefined>> = process.env,
): EvaluationDatabaseConnection {
  const connection = resolveEvaluationDatabaseConnection(env);
  if (!connection) {
    throw new Error(`Evaluation database connection is required (${EVALUATION_DATABASE_CANDIDATES.join(', ')})`);
  }
  return connection;
}
