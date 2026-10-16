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
const TOTAL_UNCOVERED_HOUSE_EVENTS = 264;

const EVENT_SHAS = {
  1: 'c4189c9a5321be8062b53b0f94f36c5ab4b195050777ef8b7f1487e6bbb63811',
  2: '9304a46f37889fa3ae166803e3675669c55fb99d475f1484ea3efd11f7e01299',
  3: 'e5df92e5d1074edae44bc376ba85a041c3107dde1c84cddc3c8a471c132822f0',
  4: 'b30043dfcb57fd7d5cb10b489b9d42ca1ea4476e5c4ee1bec512277fe7aa4339',
  5: '75b0435e0b61b4a356e82c3017caa400cf67a21778a41158f032679151067862',
  6: 'eafb3980bdbe20a94da1150e673e8d9218753bcea7f696863fc598f9b4abc072',
  7: '3d994198b510f648867bb0804b25ff201328c6dd0628d901ff33579b43f1378f',
  8: '107c41146c0359bc186012674f663db64b4f791bb4fc4b7ac96e5d9dc90e3916',
  9: 'ee804ad6c0d65f64848a96c716e000146ca09e74ac00e31ca4a2be9d08896c3e',
  10: '87cfaaec13743d7c7d97f2ea3b69f5f2cfb389320e356a4893991827ba023848',
  11: '3d4d83276928f170726e2a499c2422eac2ede373f711bcdcfdca29c542e95242',
};

const CONFIG = {
  9: {
    rankStart: 201,
    rankEnd: 225,
    eventCount: 25,
    minTargetDate: '2026-05-12',
    maxTargetDate: '2026-05-16',
    finalPartialTranche: false,
  },
  10: {
    rankStart: 226,
    rankEnd: 250,
    eventCount: 25,
    minTargetDate: '2025-02-20',
    maxTargetDate: '2026-05-17',
    finalPartialTranche: false,
  },
  11: {
    rankStart: 251,
    rankEnd: 264,
    eventCount: 14,
    minTargetDate: '2025-03-03',
    maxTargetDate: '2026-04-20',
    finalPartialTranche: true,
  },
};

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

const trancheIndex = Number.parseInt(
  env('VOTEPREDICT_2025_HOUSE_TARGET_TRANCHE_INDEX'),
  10,
);
const config = CONFIG[trancheIndex];
if (!config) {
  throw new Error(
    `Unsupported final House tranche index: ${String(trancheIndex)}; expected 9, 10, or 11`,
  );
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
) {
  throw new Error('v1.7 manifest identity or safety policy drifted');
}
if (sha(gzipBytes) !== MATRIX_GZIP_SHA256) {
  throw new Error('v1.7 gzip digest mismatch');
}
if (sha(canonical) !== MATRIX_CANONICAL_SHA256) {
  throw new Error('v1.7 canonical digest mismatch');
}

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
  ) {
    throw new Error(`Event identity drifted: ${row.voteEventId}`);
  }
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

if (ranked.length !== TOTAL_UNCOVERED_HOUSE_EVENTS) {
  throw new Error(
    `Uncovered 2025 House event count drifted: ${ranked.length}`,
  );
}

for (let index = 1; index < trancheIndex; index += 1) {
  const start = (index - 1) * 25;
  const end = Math.min(index * 25, ranked.length);
  const prior = ranked.slice(start, end);
  if (
    prior.length === 0
    || eventSetSha(prior) !== EVENT_SHAS[index]
  ) {
    throw new Error(`Prior tranche ${index} identity drifted`);
  }
}

const selected = ranked.slice(config.rankStart - 1, config.rankEnd);
const selectedSha = eventSetSha(selected);
const minTargetDate = [...selected]
  .map((event) => event.occurredOn)
  .sort()[0];
const maxTargetDate = [...selected]
  .map((event) => event.occurredOn)
  .sort()
  .at(-1);

if (
  selected.length !== config.eventCount
  || selectedSha !== EVENT_SHAS[trancheIndex]
  || minTargetDate !== config.minTargetDate
  || maxTargetDate !== config.maxTargetDate
) {
  throw new Error('Final 2025 House tranche ranking or identity drifted');
}

if (
  config.finalPartialTranche
  && config.rankEnd !== TOTAL_UNCOVERED_HOUSE_EVENTS
) {
  throw new Error('Final partial tranche must terminate at the uncovered universe boundary');
}

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
    priorTrancheEventKeySha256: EVENT_SHAS[trancheIndex - 1],
    trancheIndex,
    rankStart: config.rankStart,
    rankEnd: config.rankEnd,
    eventCount: selected.length,
    eventKeySha256: selectedSha,
    finalPartialTranche: config.finalPartialTranche,
  },
  events: selected,
  identifiers: [...new Set(selected.map((event) => event.identifier))].sort(),
  minTargetDate,
  maxTargetDate,
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
const outputFile =
  `historical-density-2025-house-target-tranche-${trancheIndex}-v1.json`;
writeFileSync(
  resolve(outputDir, outputFile),
  `${JSON.stringify(report, null, 2)}\n`,
);

console.log(JSON.stringify({
  historicalDensity2025HouseTargetTranche: {
    trancheIndex,
    rankStart: config.rankStart,
    rankEnd: config.rankEnd,
    eventCount: selected.length,
    eventKeySha256: selectedSha,
    minTargetDate,
    maxTargetDate,
    finalPartialTranche: config.finalPartialTranche,
    identifiers: report.identifiers,
    outcomeUse: 'none',
    productionDatabaseQueried: false,
    vercelUsed: false,
  },
}, null, 2));
