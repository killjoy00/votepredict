/**
 * Immutable reviewed aggregate SELECT catalog. Neither the query name nor the
 * scope becomes SQL source. Runtime reads the checked-in allow-list verbatim.
 * No original text, person names, source URLs or private identifiers leave.
 */
import definitions from '../../data/evidence-workflows/readonly-queries.json';

export type EvidenceReadonlyQueryName = 'connection-health' | 'session-membership-counts' | 'evidence-item-count';
export type EvidenceReadonlyScope = 'all' | '2021-2022' | '2023-2024' | '2025-2026';
type QueryRecord = {name:string; sql:string; columns:string[]; scope:'all'|'session'; maxRows:number};
type QueryResult = {rows: Record<string, unknown>[]};
export interface QueryClient {
  query(sql: string, params?: readonly unknown[]): Promise<QueryResult>;
}
export interface DatabaseIdentity {
  database: string;
  role: string;
}
const NAMES = ['connection-health', 'session-membership-counts', 'evidence-item-count'] as const;
const SESSIONS = ['all','2021-2022','2023-2024','2025-2026'] as const;
const KEYS = ['check_count', 'session_slug', 'membership_count', 'evidence_item_count'] as const;

export function getReadonlyQuery(name: string, scope: string): QueryRecord {
  if (!NAMES.some(x=>x===name)) throw new Error('Unknown named read-only query');
  if (!SESSIONS.some(x=>x===scope)) throw new Error('Scope not allow-listed');
  if (definitions.schemaVersion !== 'evidence-readonly-query-allowlist-v1' ||
      definitions.queries.length !== NAMES.length ||
      new Set(definitions.queries.map(x=>x.name)).size !== NAMES.length)
    throw new Error('Read-only query catalog schema mismatch');
  const row=definitions.queries.find(x=>x.name===name);
  if (!row || !['all','session'].includes(row.scope) || !Number.isInteger(row.maxRows) ||
      row.maxRows<1 || row.maxRows>3 || !row.sql.trim().toUpperCase().startsWith('SELECT ') ||
      /;|--|\/\*|\*\/|\b(?:UPDATE|DELETE|INSERT|CREATE|ALTER|DROP|TRUNCATE|COPY|GRANT|REVOKE|EXECUTE|CALL|SET|pg_sleep|dblink)\b/i.test(row.sql) ||
      !row.columns.length || !row.columns.every(c=>KEYS.includes(c as typeof KEYS[number])))
    throw new Error('Read-only query catalog contains unsafe or unrecognized SQL');
  if (row.scope==='all' && scope!=='all') throw new Error('Named query requires scope=all');
  if (row.scope==='session' && !row.sql.includes('$1::text')) throw new Error('Scope parameter missing');
  if (row.scope==='all' && row.sql.includes('$1')) throw new Error('Unexpected parameter');
  return row as QueryRecord;
}

function safeOutput(result: QueryResult, definition: QueryRecord): Record<string, string | number>[] {
  if (!Array.isArray(result.rows) || result.rows.length>definition.maxRows)
    throw new Error('Read-only query produced too many rows');
  return result.rows.map(row=>{
    if (!row || typeof row!=='object' || Array.isArray(row) ||
        JSON.stringify(Object.keys(row).sort())!==JSON.stringify([...definition.columns].sort()))
      throw new Error('Read-only query produced unapproved fields');
    const output: Record<string,string|number>={};
    for (const field of definition.columns) {
      const value=row[field];
      if (field==='session_slug') {
        if (!['2021-2022','2023-2024','2025-2026'].includes(String(value))) throw new Error('Unexpected session label');
        output[field]=String(value);
      } else {
        if (typeof value!=='number' || !Number.isSafeInteger(value) || value<0 || value>100000000)
          throw new Error('Invalid aggregate count from read-only query');
        output[field]=value;
      }
    }
    return output;
  });
}

export async function executeNamedReadOnlyEvidenceQuery(
  client: QueryClient, name: string, scope: string, identity: DatabaseIdentity,
): Promise<{query:string;scope:string;rowCount:number;rows:Record<string,string|number>[]}> {
  const definition=getReadonlyQuery(name,scope);
  let started=false;
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    started=true;
    const check=await client.query(
      "SELECT current_database() AS db, current_user AS role, current_setting('transaction_read_only') AS ro",
    );
    if (check.rows.length!==1 || check.rows[0].ro!=='on' ||
        check.rows[0].db!==identity.database || check.rows[0].role!==identity.role)
      throw new Error('Read-only transaction identity mismatch');
    const rows=safeOutput(await client.query(definition.sql,definition.scope==='session'?[scope]:[]),definition);
    return {query:name,scope,rowCount:rows.length,rows};
  } finally {
    if (started) await client.query('ROLLBACK');
  }
}
