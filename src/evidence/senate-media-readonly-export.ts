/**
 * Issue #864 / Track D: PURE preflight and parsing helpers for a private,
 * operator-approved export. Never connect to a database from this module.
 */
export const SENATE_MEDIA_EXPORT_VERSION = 'senate-media-private-readonly-export-v1' as const;
export const REQUIRED_MEDIA_EXPORT_TABLES = [
  'source_documents',
  'evidence_items',
  'memberships',
  'legislators',
  'chambers',
  'legislative_sessions',
] as const;
export const CONTEXT_MARKER = '___VOTEPREDICT_MEDIA_CONTEXT_JSONL_V1___';
export const ROSTER_MARKER = '___VOTEPREDICT_MEDIA_ROSTER_JSONL_V1___';

export interface MediaExportPreflight {
  database: string;
  role: string;
  transactionReadOnly: boolean;
  elevatedRole: boolean;
  canCreatePublic: boolean;
  canCreateDatabase: boolean;
  publicWritableRelations: number;
  tables: Array<{ name: string; present: boolean; canSelect: boolean; canWrite: boolean }>;
}

export const SENATE_MEDIA_READONLY_PREFLIGHT_SQL = [
  "WITH required(name) AS (",
  "  VALUES ('source_documents'), ('evidence_items'), ('memberships'),",
  "         ('legislators'), ('chambers'), ('legislative_sessions')",
  "), permissions AS (",
  "  SELECT name,",
  "    to_regclass('public.' || name) IS NOT NULL AS present,",
  "    COALESCE(has_table_privilege(current_user, to_regclass('public.' || name), 'SELECT'), false) AS can_select,",
  "    COALESCE(has_table_privilege(current_user, to_regclass('public.' || name),",
  "      'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'), false) AS can_write",
  "  FROM required",
  ")",
  "SELECT jsonb_build_object(",
  "  'database', current_database(),",
  "  'role', current_user,",
  "  'transactionReadOnly', current_setting('transaction_read_only') = 'on',",
  "  'elevatedRole', (SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls",
  "                   FROM pg_roles WHERE rolname = current_user),",
  "  'canCreatePublic', COALESCE(has_schema_privilege(current_user, 'public', 'CREATE'), false),",
  "  'canCreateDatabase', has_database_privilege(current_user, current_database(), 'CREATE'),",
  "  'publicWritableRelations', (",
  "    SELECT count(*)::int FROM pg_class c",
  "    JOIN pg_namespace n ON n.oid = c.relnamespace",
  "    WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','f')",
  "      AND has_table_privilege(current_user, c.oid,",
  "        'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')",
  "  ),",
  "  'tables', (SELECT jsonb_agg(jsonb_build_object(",
  "    'name', name, 'present', present, 'canSelect', can_select, 'canWrite', can_write",
  "  ) ORDER BY name) FROM permissions)",
  ")::text;",
].join('\n');

export function assertSenateMediaReadOnlyPreflight(value: unknown): MediaExportPreflight {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('Media export preflight did not return a role inspection');
  const row = value as Partial<MediaExportPreflight>;
  if (!row.database || !row.role || row.transactionReadOnly !== true
    || row.elevatedRole !== false || row.canCreatePublic !== false
    || row.canCreateDatabase !== false || row.publicWritableRelations !== 0) {
    throw Error('Refusing export: database role is not a strictly read-only public-schema role');
  }
  if (!Array.isArray(row.tables)
    || row.tables.length !== REQUIRED_MEDIA_EXPORT_TABLES.length
    || REQUIRED_MEDIA_EXPORT_TABLES.some(name => !row.tables!.some(t =>
      t.name === name && t.present === true && t.canSelect === true && t.canWrite === false))) {
    throw Error('Refusing export: VotePredict evidence tables absent or unsafe/inaccessible');
  }
  if (new Set(row.tables.map(t => t.name)).size !== row.tables.length)
    throw Error('Refusing export: repeated table privilege proof');
  return row as MediaExportPreflight;
}

function oneSelect(statement: string): string {
  const withoutComments = statement.replace(/^\s*--[^\n]*\n/gm, '\n').trim();
  if (!/^SELECT\s/i.test(withoutComments) || !withoutComments.endsWith(';')
    || (withoutComments.match(/;/g) ?? []).length !== 1
    || /^\s*\\/m.test(withoutComments)) {
    throw Error('Refusing export: source file is not a single standalone SELECT');
  }
  return withoutComments;
}

/** Both SELECTs see one repeatable-read, read-only database snapshot. */
export function buildSenateMediaReadOnlySnapshotSql(contextSql: string, rosterSql: string): string {
  return [
    'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;',
    "SELECT '" + CONTEXT_MARKER + "';",
    oneSelect(contextSql),
    "SELECT '" + ROSTER_MARKER + "';",
    oneSelect(rosterSql),
    'COMMIT;',
  ].join('\n');
}

export interface SenateMediaParsedExport {
  contexts: string[];
  roster: string[];
  captureYearCounts: Record<string, number>;
  studyYearContexts: number;
  excludedYearContexts: number;
  distinctSourceDocuments: number;
}

/** psql -X -q -A -t yields one JSON object per row, never article bodies. */
export function splitSenateMediaReadOnlyExport(stdout: string): SenateMediaParsedExport {
  if (Buffer.byteLength(stdout, 'utf8') > 32_000_000)
    throw Error('Media export exceeded conservative private buffer size');
  const lines = stdout.trimEnd().split(/\r?\n/);
  let phase: 'before' | 'contexts' | 'roster' = 'before';
  const contexts: string[] = [];
  const roster: string[] = [];
  const years: Record<string, number> = {};
  const evidenceIds = new Set<string>();
  const sourceIds = new Set<string>();
  const rosterKeys = new Set<string>();
  for (const line of lines) {
    if (line === CONTEXT_MARKER) {
      if (phase !== 'before') throw Error('Duplicate or misplaced context delimiter');
      phase = 'contexts'; continue;
    }
    if (line === ROSTER_MARKER) {
      if (phase !== 'contexts' || !contexts.length)
        throw Error('Missing/duplicate context records before roster delimiter');
      phase = 'roster'; continue;
    }
    if (phase === 'before' || !line.trim())
      throw Error('Media export contained unexpected output outside a JSONL record');
    let value: Record<string, unknown>;
    try { value = JSON.parse(line); }
    catch { throw Error('Media export contained malformed JSONL'); }
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw Error('Media export row must be a JSON object');
    if (phase === 'contexts') {
      if (value.sourceKind !== 'wayback_local_trade_news'
        || typeof value.evidenceId !== 'string' || !value.evidenceId
        || typeof value.sourceDocumentId !== 'string' || !value.sourceDocumentId
        || evidenceIds.has(value.evidenceId)) {
        throw Error('Media context export contains unexpected or duplicate evidence identity');
      }
      evidenceIds.add(value.evidenceId);
      sourceIds.add(value.sourceDocumentId);
      const year = typeof value.archiveCapturedAt === 'string'
        ? value.archiveCapturedAt.slice(0, 4) : 'unknown';
      years[year] = (years[year] ?? 0) + 1;
      contexts.push(line);
      if (contexts.length > 20000) throw Error('Media context export exceeds row limit');
    } else {
      const year = value.year;
      const membershipId = value.membershipId;
      const key = String(year) + ':' + String(membershipId);
      if (!Number.isInteger(year) || Number(year) < 2021 || Number(year) > 2025
        || typeof membershipId !== 'string' || !membershipId
        || typeof value.senatorId !== 'string' || !value.senatorId
        || typeof value.senatorName !== 'string' || !value.senatorName.trim()
        || rosterKeys.has(key)) {
        throw Error('Invalid or duplicate 2021–2025 Senate membership-year export');
      }
      rosterKeys.add(key);
      roster.push(line);
      if (roster.length > 5000) throw Error('Senate roster export exceeds row limit');
    }
  }
  if (phase !== 'roster' || !contexts.length || !roster.length)
    throw Error('Media export lacks context or roster records');
  const studyYearContexts = Object.entries(years)
    .filter(([year]) => ['2021', '2022', '2023', '2024', '2025'].includes(year))
    .reduce((sum, [,count]) => sum + count, 0);
  return {
    contexts, roster, captureYearCounts: years,
    studyYearContexts, excludedYearContexts: contexts.length - studyYearContexts,
    distinctSourceDocuments: sourceIds.size,
  };
}
