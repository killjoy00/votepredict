import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';

const ISSUE = 718;
const SOURCE_ARTIFACT_ID = 11436413885;
const SOURCE_ARTIFACT_DIGEST = 'sha256:fc1d77ccc51bc33f3e3f1c0dd6622c0f2a9797d62a8d54bcb65906de30228e44';
const MATRIX_GZIP_SHA256 = 'cc99480e9437fff9a09d7947b4e8728f872822cc86cf00d8edb8ecb925650664';
const MATRIX_CANONICAL_SHA256 = 'd681f257cdcded0d2cbebd68a93ea7edcab524863a68061a8059eca84963923a';
const ROW_KEY_SHA256 = '3aa47101f9e4a848e293fdaa89ef853919d49826b68ae90960370c5c19e9df72';
const TARGET_ROWS = 135457;
const OUTPUT_FILE = 'historical-density-cross-session-gap-inventory-v1.json';
const EXPECTED = {
  '2021-2022': { rows: 35510, coveredRows: 9 },
  '2023-2024': { rows: 49827, coveredRows: 32 },
  '2025-2026': { rows: 50120, coveredRows: 3 },
};
const RANK_LIMIT = 25;

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function nonzero(values) { return values.some((value) => value !== 0); }
function accumulator() {
  return { rows: 0, coveredRows: 0, uncoveredRows: 0, memberships: new Map(), events: new Map(), bills: new Map() };
}
function addUncovered(acc, row) {
  const membership = acc.memberships.get(row.membershipId) ?? {
    membershipId: row.membershipId, legislatorId: row.legislatorId, chamber: row.chamber,
    uncoveredRows: 0, events: new Set(), bills: new Set(),
  };
  if (membership.legislatorId !== row.legislatorId || membership.chamber !== row.chamber) throw new Error(`Membership identity drifted for ${row.membershipId}`);
  membership.uncoveredRows += 1; membership.events.add(row.voteEventId); membership.bills.add(row.billId);
  acc.memberships.set(row.membershipId, membership);

  const event = acc.events.get(row.voteEventId) ?? {
    voteEventId: row.voteEventId, billId: row.billId, identifier: row.identifier,
    occurredOn: row.occurredOn, chamber: row.chamber, uncoveredRows: 0, memberships: new Set(),
  };
  if (event.billId !== row.billId || event.identifier !== row.identifier || event.occurredOn !== row.occurredOn || event.chamber !== row.chamber) throw new Error(`Vote-event identity drifted for ${row.voteEventId}`);
  event.uncoveredRows += 1; event.memberships.add(row.membershipId); acc.events.set(row.voteEventId, event);

  const bill = acc.bills.get(row.billId) ?? {
    billId: row.billId, identifiers: new Set(), chambers: new Set(), uncoveredRows: 0, events: new Set(), memberships: new Set(),
  };
  bill.identifiers.add(row.identifier); bill.chambers.add(row.chamber); bill.uncoveredRows += 1;
  bill.events.add(row.voteEventId); bill.memberships.add(row.membershipId); acc.bills.set(row.billId, bill);
}
function summarize(acc) {
  const memberships = [...acc.memberships.values()].map((row) => ({
    membershipId: row.membershipId, legislatorId: row.legislatorId, chamber: row.chamber,
    uncoveredRows: row.uncoveredRows, uncoveredEvents: row.events.size, uncoveredBills: row.bills.size,
  })).sort((a, b) => b.uncoveredRows - a.uncoveredRows || b.uncoveredEvents - a.uncoveredEvents || a.membershipId.localeCompare(b.membershipId));

  const events = [...acc.events.values()].map((row) => ({
    voteEventId: row.voteEventId, billId: row.billId, identifier: row.identifier, occurredOn: row.occurredOn, chamber: row.chamber,
    uncoveredRows: row.uncoveredRows, uncoveredMemberships: row.memberships.size,
  })).sort((a, b) => b.uncoveredRows - a.uncoveredRows || a.occurredOn.localeCompare(b.occurredOn) || a.identifier.localeCompare(b.identifier) || a.voteEventId.localeCompare(b.voteEventId));

  const bills = [...acc.bills.values()].map((row) => ({
    billId: row.billId, identifiers: [...row.identifiers].sort(), chambers: [...row.chambers].sort(),
    uncoveredRows: row.uncoveredRows, uncoveredEvents: row.events.size, uncoveredMemberships: row.memberships.size,
  })).sort((a, b) => b.uncoveredRows - a.uncoveredRows || b.uncoveredEvents - a.uncoveredEvents || (a.identifiers[0] ?? '').localeCompare(b.identifiers[0] ?? '') || a.billId.localeCompare(b.billId));

  return {
    rows: acc.rows, coveredRows: acc.coveredRows, uncoveredRows: acc.uncoveredRows,
    coverageRate: acc.rows ? acc.coveredRows / acc.rows : 0,
    uncoveredMemberships: memberships.length, uncoveredEvents: events.length, uncoveredBills: bills.length,
    topUncoveredMemberships: memberships.slice(0, RANK_LIMIT),
    topUncoveredEvents: events.slice(0, RANK_LIMIT),
    topUncoveredBills: bills.slice(0, RANK_LIMIT),
  };
}

const manifestPath = requiredEnv('VOTEPREDICT_EQ_V17_MANIFEST_PATH');
const matrixPath = requiredEnv('VOTEPREDICT_EQ_V17_MATRIX_PATH');
const outputDir = requiredEnv('VOTEPREDICT_HISTORICAL_DENSITY_CROSS_SESSION_OUTPUT_DIR');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const gzipBytes = readFileSync(matrixPath);
const canonical = gunzipSync(gzipBytes).toString('utf8');

if (
  manifest.schemaVersion !== 'evidence-quality-historical-feature-matrix-v1.7-manifest' || manifest.issue !== ISSUE ||
  manifest.targetUniverse.rows !== TARGET_ROWS || manifest.targetUniverse.rowKeySha256 !== ROW_KEY_SHA256 ||
  manifest.coverage.matrixRows !== TARGET_ROWS || manifest.coverage.combinedNonzeroRows !== 44 ||
  manifest.digests.matrixGzipSha256 !== MATRIX_GZIP_SHA256 || manifest.digests.matrixCanonicalNdjsonSha256 !== MATRIX_CANONICAL_SHA256 ||
  manifest.policy.outcomeUseDuringFeatureConstruction !== 'none' || manifest.policy.productionDatabaseQueried || manifest.policy.productionWrites ||
  manifest.policy.vercelUsed || manifest.policy.modelFitting !== 'none' || manifest.policy.servingChanged
) throw new Error('v1.7 manifest identity or safety policy drifted');
if (sha256(gzipBytes) !== MATRIX_GZIP_SHA256) throw new Error('v1.7 gzip digest mismatch');
if (sha256(canonical) !== MATRIX_CANONICAL_SHA256) throw new Error('v1.7 canonical NDJSON digest mismatch');

const sessions = new Map(Object.keys(EXPECTED).map((session) => [session, accumulator()]));
const lines = canonical.trimEnd().split('\n');
if (lines.length !== TARGET_ROWS) throw new Error(`Expected ${TARGET_ROWS} matrix rows, got ${lines.length}`);
const rowKeys = [];
for (const line of lines) {
  const row = JSON.parse(line);
  if (
    row.schemaVersion !== 'evidence-quality-historical-feature-matrix-v1.7' || !sessions.has(row.session) ||
    row.features?.length !== 12 || row.reviewedApplicabilityFeatures?.length !== 12 ||
    !row.voteEventId || !row.membershipId || !row.legislatorId || !row.billId || !row.identifier || !row.occurredOn || !row.chamber
  ) throw new Error(`Matrix row schema drifted: ${row.voteEventId ?? 'unknown'}|${row.membershipId ?? 'unknown'}`);
  rowKeys.push(`${row.voteEventId}|${row.membershipId}`);
  const acc = sessions.get(row.session);
  acc.rows += 1;
  if (nonzero(row.features) || nonzero(row.reviewedApplicabilityFeatures)) acc.coveredRows += 1;
  else { acc.uncoveredRows += 1; addUncovered(acc, row); }
}
if (sha256(`${rowKeys.sort().join('\n')}\n`) !== ROW_KEY_SHA256) throw new Error('Target row-key identity drifted');

const bySession = Object.fromEntries([...sessions].map(([session, acc]) => [session, summarize(acc)]));
for (const [session, expected] of Object.entries(EXPECTED)) {
  const actual = bySession[session];
  const manifestSession = manifest.coverage.bySession[session];
  if (actual.rows !== expected.rows || actual.coveredRows !== expected.coveredRows || manifestSession.rows !== expected.rows || manifestSession.combinedNonzeroRows !== expected.coveredRows) {
    throw new Error(`Session coverage drifted for ${session}`);
  }
}
const newerSessionGapOrder = ['2023-2024', '2025-2026'].sort((a, b) =>
  bySession[a].coverageRate - bySession[b].coverageRate || bySession[b].uncoveredRows - bySession[a].uncoveredRows || b.localeCompare(a));

const report = {
  schemaVersion: 'historical-density-cross-session-gap-inventory-v1', generatedAt: new Date().toISOString(), issue: ISSUE,
  source: {
    artifactId: SOURCE_ARTIFACT_ID, artifactDigest: SOURCE_ARTIFACT_DIGEST, manifestSchemaVersion: manifest.schemaVersion,
    matrixGzipSha256: MATRIX_GZIP_SHA256, matrixCanonicalNdjsonSha256: MATRIX_CANONICAL_SHA256,
    targetRows: TARGET_ROWS, targetRowKeySha256: ROW_KEY_SHA256,
  },
  summary: {
    combinedCoveredRows: Object.values(bySession).reduce((sum, row) => sum + row.coveredRows, 0),
    combinedUncoveredRows: Object.values(bySession).reduce((sum, row) => sum + row.uncoveredRows, 0), bySession,
  },
  priority: {
    primaryHistoricalProgramSession: '2021-2022', newerSessionGapOrder, recommendedNextNewerSession: newerSessionGapOrder[0],
    rationale: 'Keep 2021-22 as the primary historical program while prioritizing newer-session recovery by lowest current strict directional coverage rate, then uncovered-row volume.',
  },
  policy: {
    readOnly: true, productionDatabaseQueried: false, productionWrites: false, vercelUsed: false,
    sourceDiscoveryPerformed: false, sourceBodiesFetched: false, targetVoteOutcomesRead: false, outcomeUse: 'none',
    rankingUsesOnlyFrozenTargetIdentityAndCurrentCoverage: true, applicabilityInferred: false, modelFitting: 'none', servingChanged: false,
    nextStepBoundary: 'This is a target-gap map only. It may prioritize bounded source-recovery inventories, but it does not establish source recoverability, semantic applicability, member stance, or bill linkage.',
  },
};
if (report.summary.combinedCoveredRows !== 44 || report.summary.combinedUncoveredRows !== TARGET_ROWS - 44) throw new Error('Combined coverage accounting drifted');
if (report.priority.recommendedNextNewerSession !== '2025-2026') throw new Error('Expected 2025-26 to be the lowest-covered newer session');

mkdirSync(outputDir, { recursive: true });
writeFileSync(resolve(outputDir, OUTPUT_FILE), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ historicalDensityCrossSessionGapInventory: {
  combinedCoveredRows: report.summary.combinedCoveredRows, combinedUncoveredRows: report.summary.combinedUncoveredRows,
  bySession: Object.fromEntries(Object.entries(bySession).map(([session, row]) => [session, {
    rows: row.rows, coveredRows: row.coveredRows, uncoveredRows: row.uncoveredRows,
    uncoveredMemberships: row.uncoveredMemberships, uncoveredEvents: row.uncoveredEvents, uncoveredBills: row.uncoveredBills,
  }])),
  recommendedNextNewerSession: report.priority.recommendedNextNewerSession,
  outcomeUse: 'none', productionDatabaseQueried: false, vercelUsed: false,
} }, null, 2));
