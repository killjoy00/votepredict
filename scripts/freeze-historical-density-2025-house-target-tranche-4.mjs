import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';

const ISSUE = 718;
const SESSION = '2025-2026';
const CHAMBER = 'house';
const SOURCE_ARTIFACT_ID = 11436413885;
const SOURCE_ARTIFACT_DIGEST =
  'sha256:fc1d77ccc51bc33f3e3f1c0dd6622c0f2a9797d62a8d54bcb65906de30228e44';
const MATRIX_GZIP_SHA256 =
  'cc99480e9437fff9a09d7947b4e8728f872822cc86cf00d8edb8ecb925650664';
const MATRIX_CANONICAL_SHA256 =
  'd681f257cdcded0d2cbebd68a93ea7edcab524863a68061a8059eca84963923a';
const ROW_KEY_SHA256 =
  '3aa47101f9e4a848e293fdaa89ef853919d49826b68ae90960370c5c19e9df72';
const TARGET_ROWS = 135457;
const TRANCHE_INDEX = 4;
const RANK_START = 76;
const RANK_END = 100;
const EXPECTED_EVENT_COUNT = 25;
const EXPECTED_TRANCHE1_SHA =
  'c4189c9a5321be8062b53b0f94f36c5ab4b195050777ef8b7f1487e6bbb63811';
const EXPECTED_TRANCHE2_SHA =
  '9304a46f37889fa3ae166803e3675669c55fb99d475f1484ea3efd11f7e01299';
const EXPECTED_TRANCHE3_SHA =
  'e5df92e5d1074edae44bc376ba85a041c3107dde1c84cddc3c8a471c132822f0';
const EXPECTED_TRANCHE4_SHA =
  'b30043dfcb57fd7d5cb10b489b9d42ca1ea4476e5c4ee1bec512277fe7aa4339';
const OUTPUT_FILE = 'historical-density-2025-house-target-tranche-4-v1.json';

function env(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}
function sha(value) {
  return createHash('sha256').update(value).digest('hex');
}
function eventKey(event) {
  return `${event.voteEventId}|${event.billId}|${event.identifier}|${event.occurredOn}`;
}
function eventSetSha(events) {
  return sha(`${events.map(eventKey).sort().join('\n')}\n`);
}
function nonzero(values) {
  return values.some((value) => value !== 0);
}

const manifest = JSON.parse(
  readFileSync(env('VOTEPREDICT_EQ_V17_MANIFEST_PATH'), 'utf8'),
);
const gzipBytes = readFileSync(env('VOTEPREDICT_EQ_V17_MATRIX_PATH'));
const canonical = gunzipSync(gzipBytes).toString('utf8');

if (
  manifest.schemaVersion !== 'evidence-quality-historical-feature-matrix-v1.7-manifest'
  || manifest.issue !== ISSUE
  || manifest.targetUniverse.rows !== TARGET_ROWS
  || manifest.targetUniverse.rowKeySha256 !== ROW_KEY_SHA256
  || manifest.coverage.matrixRows !== TARGET_ROWS
  || manifest.coverage.combinedNonzeroRows !== 44
  || manifest.digests.matrixGzipSha256 !== MATRIX_GZIP_SHA256
  || manifest.digests.matrixCanonicalNdjsonSha256 !== MATRIX_CANONICAL_SHA256
  || manifest.policy.outcomeUseDuringFeatureConstruction !== 'none'
  || manifest.policy.productionDatabaseQueried
  || manifest.policy.productionWrites
  || manifest.policy.vercelUsed
  || manifest.policy.modelFitting !== 'none'
  || manifest.policy.servingChanged
) throw new Error('v1.7 manifest identity or safety policy drifted');
if (sha(gzipBytes) !== MATRIX_GZIP_SHA256) throw new Error('v1.7 gzip digest mismatch');
if (sha(canonical) !== MATRIX_CANONICAL_SHA256) throw new Error('v1.7 canonical digest mismatch');

const events = new Map();
const rowKeys = [];
for (const line of canonical.trimEnd().split('\n')) {
  const row = JSON.parse(line);
  rowKeys.push(`${row.voteEventId}|${row.membershipId}`);
  if (row.session !== SESSION || row.chamber !== CHAMBER) continue;
  if (nonzero(row.features) || nonzero(row.reviewedApplicabilityFeatures)) continue;
  let event = events.get(row.voteEventId);
  if (!event) {
    event = {
      voteEventId: row.voteEventId,
      billId: row.billId,
      identifier: row.identifier,
      occurredOn: row.occurredOn,
      chamber: row.chamber,
      uncoveredRows: 0,
      memberships: new Set(),
    };
    events.set(row.voteEventId, event);
  }
  if (
    event.billId !== row.billId
    || event.identifier !== row.identifier
    || event.occurredOn !== row.occurredOn
    || event.chamber !== row.chamber
  ) throw new Error(`Event identity drifted: ${row.voteEventId}`);
  event.uncoveredRows += 1;
  event.memberships.add(row.membershipId);
}
if (sha(`${rowKeys.sort().join('\n')}\n`) !== ROW_KEY_SHA256) {
  throw new Error('Target row-key identity drifted');
}

const ranked = [...events.values()]
  .map((event) => ({
    voteEventId: event.voteEventId,
    billId: event.billId,
    identifier: event.identifier,
    occurredOn: event.occurredOn,
    chamber: event.chamber,
    uncoveredRows: event.uncoveredRows,
    uncoveredMemberships: event.memberships.size,
  }))
  .sort((a, b) =>
    b.uncoveredRows - a.uncoveredRows
    || a.occurredOn.localeCompare(b.occurredOn)
    || a.identifier.localeCompare(b.identifier)
    || a.voteEventId.localeCompare(b.voteEventId)
  );

const tranche1 = ranked.slice(0, 25);
const tranche2 = ranked.slice(25, 50);
const tranche3 = ranked.slice(50, 75);
const selected = ranked.slice(RANK_START - 1, RANK_END);
if (
  tranche1.length !== 25
  || eventSetSha(tranche1) !== EXPECTED_TRANCHE1_SHA
  || tranche2.length !== 25
  || eventSetSha(tranche2) !== EXPECTED_TRANCHE2_SHA
  || tranche3.length !== 25
  || eventSetSha(tranche3) !== EXPECTED_TRANCHE3_SHA
  || selected.length !== EXPECTED_EVENT_COUNT
  || eventSetSha(selected) !== EXPECTED_TRANCHE4_SHA
  || selected.some((event) =>
    event.uncoveredRows !== 134 || event.uncoveredMemberships !== 134
  )
) throw new Error('2025 House tranche ranking or identity drifted');

const report = {
  schemaVersion: 'historical-density-2025-house-target-tranche-v1',
  generatedAt: new Date().toISOString(),
  issue: ISSUE,
  session: SESSION,
  chamber: CHAMBER,
  source: {
    artifactId: SOURCE_ARTIFACT_ID,
    artifactDigest: SOURCE_ARTIFACT_DIGEST,
    manifestSchemaVersion: manifest.schemaVersion,
    matrixGzipSha256: MATRIX_GZIP_SHA256,
    matrixCanonicalNdjsonSha256: MATRIX_CANONICAL_SHA256,
    targetRowKeySha256: ROW_KEY_SHA256,
  },
  ranking: {
    rule:
      'uncoveredRows desc, occurredOn asc, identifier asc, voteEventId asc',
    totalUncoveredHouseEvents: ranked.length,
    priorTrancheEventKeySha256: EXPECTED_TRANCHE3_SHA,
    trancheIndex: TRANCHE_INDEX,
    rankStart: RANK_START,
    rankEnd: RANK_END,
    eventCount: selected.length,
    eventKeySha256: EXPECTED_TRANCHE4_SHA,
  },
  events: selected,
  identifiers: [...new Set(selected.map((event) => event.identifier))].sort(),
  minTargetDate: selected[0].occurredOn,
  maxTargetDate: selected.at(-1).occurredOn,
  policy: {
    readOnly: true,
    targetVoteOutcomesRead: false,
    outcomeUse: 'none',
    productionDatabaseQueried: false,
    productionWrites: false,
    vercelUsed: false,
    sourceDiscoveryPerformed: false,
    applicabilityInferred: false,
    sameDayEligible: false,
    contextOnly: true,
    mechanicallyActionable: false,
    modelWeight: 0,
    featureRowsWritten: false,
    modelFitting: 'none',
    servingChanged: false,
  },
};

const outputDir = env('VOTEPREDICT_2025_HOUSE_TARGET_TRANCHE_OUTPUT_DIR');
mkdirSync(outputDir, { recursive: true });
writeFileSync(resolve(outputDir, OUTPUT_FILE), `${JSON.stringify(report, null, 2)}\n`);

console.log(JSON.stringify({
  historicalDensity2025HouseTargetTranche: {
    trancheIndex: TRANCHE_INDEX,
    rankStart: RANK_START,
    rankEnd: RANK_END,
    eventCount: selected.length,
    eventKeySha256: EXPECTED_TRANCHE4_SHA,
    minTargetDate: report.minTargetDate,
    maxTargetDate: report.maxTargetDate,
    identifiers: report.identifiers,
    outcomeUse: 'none',
    productionDatabaseQueried: false,
    vercelUsed: false,
  },
}, null, 2));
