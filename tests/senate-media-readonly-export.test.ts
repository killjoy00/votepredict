import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  CONTEXT_MARKER,
  ROSTER_MARKER,
  REQUIRED_MEDIA_EXPORT_TABLES,
  SENATE_MEDIA_READONLY_PREFLIGHT_SQL,
  assertSenateMediaReadOnlyPreflight,
  buildSenateMediaReadOnlySnapshotSql,
  splitSenateMediaReadOnlyExport,
  type MediaExportPreflight,
} from '../src/evidence/senate-media-readonly-export.js';

function safeRole(): MediaExportPreflight {
  return {
    database: 'synthetic_votepredict', role: 'test_select_only',
    transactionReadOnly: true, elevatedRole: false,
    canCreatePublic: false, canCreateDatabase: false,
    publicWritableRelations: 0,
    tables: REQUIRED_MEDIA_EXPORT_TABLES.map(name =>
      ({ name, present: true, canSelect: true, canWrite: false })),
  };
}
function context(id: string, captureDate: string) {
  return JSON.stringify({
    evidenceId: id, sourceDocumentId: 'source-' + id,
    sourceKind: 'wayback_local_trade_news',
    archiveCapturedAt: captureDate,
  });
}
function roster(id: string, year: number) {
  return JSON.stringify({
    membershipId: id, year, senatorId: 'legislator-' + id,
    senatorName: 'Synthetic Senator',
  });
}
function feed(contexts: string[], members: string[]): string {
  return [CONTEXT_MARKER, ...contexts, ROSTER_MARKER, ...members].join('\n') + '\n';
}

test('valid SELECT-only role and exact VotePredict target-table proof are accepted', () => {
  assert.equal(assertSenateMediaReadOnlyPreflight(safeRole()).role, 'test_select_only');
  assert.match(SENATE_MEDIA_READONLY_PREFLIGHT_SQL, /has_table_privilege/);
  assert.match(SENATE_MEDIA_READONLY_PREFLIGHT_SQL, /publicWritableRelations/);
  assert.match(SENATE_MEDIA_READONLY_PREFLIGHT_SQL, /pg_roles/);
  assert.ok(SENATE_MEDIA_READONLY_PREFLIGHT_SQL.trim().startsWith('WITH'));
  assert.ok(!/\b(?:DELETE\s+FROM|INSERT\s+INTO|UPDATE\s+public|ALTER\s+TABLE)\b/i
    .test(SENATE_MEDIA_READONLY_PREFLIGHT_SQL));
});

test('privileged Neon owner is forbidden even if PGOPTIONS sets transactions read-only', () => {
  const v = safeRole();
  v.canCreatePublic = true;
  assert.throws(() => assertSenateMediaReadOnlyPreflight(v), /strictly read-only/);
  const v2 = safeRole(); v2.canCreateDatabase = true;
  assert.throws(() => assertSenateMediaReadOnlyPreflight(v2), /strictly read-only/);
  const v3 = safeRole(); v3.elevatedRole = true;
  assert.throws(() => assertSenateMediaReadOnlyPreflight(v3), /strictly read-only/);
  const v4 = safeRole(); v4.transactionReadOnly = false;
  assert.throws(() => assertSenateMediaReadOnlyPreflight(v4), /strictly read-only/);
});

test('any public writable relation or writable evidence target fails closed', () => {
  const v = safeRole(); v.publicWritableRelations = 1;
  assert.throws(() => assertSenateMediaReadOnlyPreflight(v), /strictly read-only/);
  const v2 = safeRole(); v2.tables[0]!.canWrite = true;
  assert.throws(() => assertSenateMediaReadOnlyPreflight(v2), /tables absent or unsafe/);
});

test('wrong Neon project, insufficient SELECT, duplicate or fabricated table proof fail', () => {
  const v = safeRole(); v.tables.pop();
  assert.throws(() => assertSenateMediaReadOnlyPreflight(v), /tables absent/);
  const v2 = safeRole(); v2.tables[2]!.present = false;
  assert.throws(() => assertSenateMediaReadOnlyPreflight(v2), /tables absent/);
  const v3 = safeRole(); v3.tables[2]!.canSelect = false;
  assert.throws(() => assertSenateMediaReadOnlyPreflight(v3), /tables absent/);
  const v4 = safeRole(); v4.tables[2] = v4.tables[0]!;
  assert.throws(() => assertSenateMediaReadOnlyPreflight(v4), /tables absent/);
  assert.throws(() => assertSenateMediaReadOnlyPreflight(null), /role inspection/);
});

test('production checked-in export SQL remains SELECT-only, in one repeatable-read transaction', () => {
  const source = readFileSync('scripts/export-senate-media-context-readonly.sql', 'utf8');
  const roster = readFileSync('scripts/export-senate-media-roster-readonly.sql', 'utf8');
  const joined = buildSenateMediaReadOnlySnapshotSql(source, roster);
  assert.match(joined, /^BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;/);
  assert.match(joined, /source_documents sd/);
  assert.match(joined, /JOIN legislators l/);
  assert.match(joined, /SELECT '___VOTEPREDICT_MEDIA_CONTEXT_JSONL_V1___';/);
  assert.match(joined, /SELECT '___VOTEPREDICT_MEDIA_ROSTER_JSONL_V1___';/);
  assert.ok(joined.trimEnd().endsWith('COMMIT;'));
  assert.equal((joined.match(/;\s*(?=\n|$)/g) ?? []).length, 5);
});

test('export SQL with a write, second statement, or psql meta-command is refused', () => {
  assert.throws(() => buildSenateMediaReadOnlySnapshotSql('DELETE FROM source_documents;', 'SELECT 1;'),
    /single standalone SELECT/);
  assert.throws(() => buildSenateMediaReadOnlySnapshotSql('SELECT 1; DROP TABLE members;', 'SELECT 1;'),
    /single standalone SELECT/);
  assert.throws(() => buildSenateMediaReadOnlySnapshotSql('SELECT 1;\n\\! shell-command', 'SELECT 1;'),
    /single standalone SELECT/);
});

test('one-snapshot rows split exactly and preserve 2021-2025 separate from 2026', () => {
  const input = feed([
    context('context-1', '2021-03-04T04:05:06Z'),
    context('context-2', '2025-01-02T05:06:07Z'),
    context('context-3', '2026-07-08T09:10:11Z'),
  ], [roster('member-1', 2021), roster('member-2', 2025)]);
  const result = splitSenateMediaReadOnlyExport(input);
  assert.equal(result.contexts.length, 3);
  assert.equal(result.roster.length, 2);
  assert.equal(result.studyYearContexts, 2);
  assert.equal(result.excludedYearContexts, 1);
  assert.deepEqual(result.captureYearCounts, { 2021: 1, 2025: 1, 2026: 1 });
  assert.equal(result.distinctSourceDocuments, 3);
});

test('blank, malformed, out-of-order and truncated JSONL are refused, not treated as zero evidence', () => {
  assert.throws(() => splitSenateMediaReadOnlyExport(''), /unexpected output/);
  assert.throws(() => splitSenateMediaReadOnlyExport(feed([], [roster('m',2025)])), /Missing\/duplicate context/);
  assert.throws(() => splitSenateMediaReadOnlyExport([CONTEXT_MARKER, '{oops}', ROSTER_MARKER, roster('m',2025)].join('\n')), /malformed JSONL/);
  assert.throws(() => splitSenateMediaReadOnlyExport(feed([context('one','2021-01-01T00:00:00Z')], [])), /lacks context or roster/);
  assert.throws(() => splitSenateMediaReadOnlyExport(
    [ROSTER_MARKER, roster('m', 2025), CONTEXT_MARKER].join('\n')), /Missing\/duplicate context/);
});

test('duplicate archived evidence identities and duplicate membership-year exports fail closed', () => {
  const entry = context('one','2024-01-01T00:00:00Z');
  assert.throws(() => splitSenateMediaReadOnlyExport(feed([entry,entry], [roster('m',2025)])),
    /duplicate evidence identity/);
  assert.throws(() => splitSenateMediaReadOnlyExport(feed([entry], [roster('m',2025), roster('m',2025)])),
    /duplicate.*membership-year/);
});

test('roster must be actual 2021-2025 membership-years with identity', () => {
  const entry = context('one','2024-01-01T00:00:00Z');
  assert.throws(() => splitSenateMediaReadOnlyExport(feed([entry], [roster('m',2026)])),
    /Invalid.*membership-year/);
  assert.throws(() => splitSenateMediaReadOnlyExport(feed([entry], [JSON.stringify({
    year: 2024, membershipId:'m', senatorName:'', senatorId:'s',
  })])), /Invalid.*membership-year/);
});
