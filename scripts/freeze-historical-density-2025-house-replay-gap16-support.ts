import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Pool } from 'pg';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import { loadHistoricalQuickReplayDataset } from '../src/evaluation/historical-quick-replay-dataset.js';
import { runHistoricalQuickDecayShadowReplay } from '../src/evaluation/historical-quick-decay-shadow-replay.js';

const ISSUE = 718;
const HALF_LIFE_DAYS = 180;
const CANONICAL_ROWS = 135457;
const CANONICAL_EVENTS = 1339;
const CANONICAL_MEMBERSHIPS = 611;
const CANONICAL_MATRIX_CANONICAL_SHA256 =
  'c97ac50c8c89ae0548cc48bed65a42c22f332e2977b33173619c9e258c09a4d0';
const CANONICAL_MATRIX_GZIP_SHA256 =
  'd8a9735a514f427508a7a37303ba312dcac3f929a51aa05a1aba32a76b384637';
const OUTCOME_ARTIFACT_ID = 11483367972;
const OUTCOME_ARTIFACT_DIGEST =
  'sha256:2415268dd0f3a0fb5cea4e03eb22e6e74ee1f1efdaa8ce4dd8b8ea743e8659ba';
const EXPECTED_GAP_EVENTS = 16;
const EXPECTED_OUTCOME_COMPLETE = 15;
const EXPECTED_UNRESOLVED = 'HF2354|2026-05-17';
const PROBABILITY_TOLERANCE = 1e-12;
const REPLAY_SESSIONS = new Set(['2021-2022', '2023-2024', '2025-2026']);
const DATABASE_CANDIDATES = [
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL_NON_POOLING',
  'DATABASE_URL',
  'POSTGRES_URL',
] as const;
const DATABASE_BRIDGE_URL =
  'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';

type Json = Record<string, any>;

type CanonicalRow = {
  voteEventId: string;
  membershipId: string;
  legislatorId: string;
  session: string;
  chamber: string;
  occurredOn: string;
  billId: string;
  identifier: string;
  eventStatus: string;
  baseProbability: number | null;
  outcome: 0 | 1 | null;
  actualYes: number;
  passed: boolean;
};

type CurrentRow = CanonicalRow;

let secrets: string[] = [];

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function setSha(values: readonly string[]): string {
  return sha256(`${[...values].sort().join('\n')}\n`);
}

function rowKey(row: Pick<CanonicalRow, 'voteEventId' | 'membershipId'>): string {
  return `${row.voteEventId}|${row.membershipId}`;
}

function eventComposite(identifier: string, occurredOn: string): string {
  return `${identifier.replace(/\s+/g, '').toUpperCase()}|${occurredOn}`;
}

function mask(value: string): void {
  if (value.length <= 3) return;
  console.log(
    '::add-mask::'
      + value
        .replaceAll('%', '%25')
        .replaceAll('\r', '%0D')
        .replaceAll('\n', '%0A'),
  );
}

function safe(error: unknown): string {
  let message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  for (const value of secrets
    .filter((item) => item.length > 3)
    .sort((a, b) => b.length - a.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]')
    .slice(0, 5000);
}

async function chooseDb(runtimeEnv: Record<string, string | undefined>): Promise<string> {
  const { Pool } = await import('pg');
  async function works(value: string): Promise<boolean> {
    const candidate = new Pool({
      connectionString: value,
      max: 1,
      connectionTimeoutMillis: 8000,
    });
    try {
      await candidate.query('select 1');
      return true;
    } catch {
      return false;
    } finally {
      await candidate.end().catch(() => undefined);
    }
  }

  for (const key of DATABASE_CANDIDATES) {
    const value = runtimeEnv[key]?.trim();
    if (value && await works(value)) return value;
  }

  const secret = runtimeEnv.CRON_SECRET?.trim();
  if (!secret) throw new Error('CRON_SECRET unavailable');
  mask(secret);
  const response = await fetch(DATABASE_BRIDGE_URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Database bridge HTTP ${response.status}`);
  const value = (await response.text()).trim();
  secrets.push(value);
  mask(value);
  if (!await works(value)) {
    throw new Error('Database bridge returned non-portable URL');
  }
  return value;
}

function parseCanonicalMatrix(manifestPath: string, matrixPath: string): CanonicalRow[] {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Json;
  const gzip = readFileSync(matrixPath);
  if (
    manifest.schemaVersion !== 'historical-as-of-matrix-v1-manifest'
    || manifest.issue !== 459
    || manifest.replay?.version !== 'historical-quick-replay-v2'
    || manifest.rows !== CANONICAL_ROWS
    || manifest.events !== CANONICAL_EVENTS
    || manifest.memberships !== CANONICAL_MEMBERSHIPS
    || manifest.matrixCanonicalNdjsonSha256 !== CANONICAL_MATRIX_CANONICAL_SHA256
    || manifest.matrixGzipSha256 !== CANONICAL_MATRIX_GZIP_SHA256
  ) {
    throw new Error('Canonical historical matrix manifest drifted');
  }
  if (sha256(gzip) !== CANONICAL_MATRIX_GZIP_SHA256) {
    throw new Error('Canonical historical matrix gzip digest mismatch');
  }
  const ndjson = gunzipSync(gzip).toString('utf8');
  if (sha256(ndjson) !== CANONICAL_MATRIX_CANONICAL_SHA256) {
    throw new Error('Canonical historical matrix NDJSON digest mismatch');
  }
  const rows = ndjson.trimEnd().split('\n').map((line) => JSON.parse(line) as CanonicalRow);
  if (rows.length !== CANONICAL_ROWS) {
    throw new Error(`Canonical matrix row count drifted: ${rows.length}`);
  }
  return rows;
}

function parseOutcomeInput(path: string) {
  const value = JSON.parse(readFileSync(path, 'utf8')) as Json;
  if (
    value.schemaVersion !== 'historical-density-2025-house-replay-gap16-outcomes-v1'
    || value.issue !== ISSUE
    || value.session !== '2025-2026'
    || value.chamber !== 'house'
    || value.outcomeRecovery?.events !== EXPECTED_GAP_EVENTS
    || value.outcomeRecovery?.recovered !== EXPECTED_OUTCOME_COMPLETE
    || value.outcomeRecovery?.unresolved !== 1
  ) {
    throw new Error('Canonical gap16 outcome artifact drifted');
  }
  const events = value.outcomeRecovery.eventsData as Json[];
  const unresolved = events.filter((row) => row.status === 'unresolved');
  if (unresolved.length !== 1 || unresolved[0]?.compositeKey !== EXPECTED_UNRESOLVED) {
    throw new Error('Gap16 unresolved outcome identity drifted');
  }
  const composites = events.map((row) => String(row.compositeKey)).sort();
  if (new Set(composites).size !== EXPECTED_GAP_EVENTS) {
    throw new Error('Gap16 outcome composite keys are not unique');
  }
  return { value, composites };
}

function flattenCurrentRows(
  dataset: Awaited<ReturnType<typeof loadHistoricalQuickReplayDataset>>,
): CurrentRow[] {
  const baseline = runHistoricalQuickDecayShadowReplay(
    dataset.targets,
    dataset.targetVersionByEvent,
    dataset.analogueSupportByEvent,
    dataset.memberships,
    dataset.historicalVotes,
    HALF_LIFE_DAYS,
  ).filter((event) => REPLAY_SESSIONS.has(event.session));

  const targets = new Map(dataset.targets.map((event) => [event.voteEventId, event]));
  return baseline.flatMap((event) => {
    const target = targets.get(event.voteEventId);
    if (!target) throw new Error(`Replay result missing target event ${event.voteEventId}`);
    return event.memberPredictions.map((member): CurrentRow => ({
      voteEventId: event.voteEventId,
      membershipId: member.membershipId,
      legislatorId: member.legislatorId,
      session: event.session,
      chamber: event.chamber,
      occurredOn: event.occurredOn,
      billId: target.billId,
      identifier: target.identifier,
      eventStatus: event.status,
      baseProbability: member.yesProbability ?? null,
      outcome: member.actualOutcome ?? null,
      actualYes: event.actualYes,
      passed: event.passed,
    }));
  });
}

function compareRows(canonical: readonly CanonicalRow[], current: readonly CurrentRow[]) {
  const canonicalByKey = new Map(canonical.map((row) => [rowKey(row), row]));
  const currentByKey = new Map(current.map((row) => [rowKey(row), row]));
  if (canonicalByKey.size !== canonical.length || currentByKey.size !== current.length) {
    throw new Error('Duplicate canonical/current row keys detected');
  }

  const canonicalKeys = [...canonicalByKey.keys()].sort();
  const currentKeys = [...currentByKey.keys()].sort();
  const missingKeys = canonicalKeys.filter((key) => !currentByKey.has(key));
  const extraKeys = currentKeys.filter((key) => !canonicalByKey.has(key));

  const mismatches: Json[] = [];
  for (const key of canonicalKeys) {
    const expected = canonicalByKey.get(key)!;
    const actual = currentByKey.get(key);
    if (!actual) continue;
    for (const field of [
      'legislatorId',
      'session',
      'chamber',
      'occurredOn',
      'billId',
      'identifier',
      'eventStatus',
      'outcome',
      'actualYes',
      'passed',
    ] as const) {
      if (actual[field] !== expected[field]) {
        mismatches.push({ key, field, expected: expected[field], actual: actual[field] });
        break;
      }
    }
    if (mismatches.at(-1)?.key === key) continue;

    if (expected.baseProbability === null || actual.baseProbability === null) {
      if (expected.baseProbability !== actual.baseProbability) {
        mismatches.push({
          key,
          field: 'baseProbability',
          expected: expected.baseProbability,
          actual: actual.baseProbability,
        });
      }
    } else if (Math.abs(expected.baseProbability - actual.baseProbability) > PROBABILITY_TOLERANCE) {
      mismatches.push({
        key,
        field: 'baseProbability',
        expected: expected.baseProbability,
        actual: actual.baseProbability,
        delta: actual.baseProbability - expected.baseProbability,
      });
    }
  }

  const canonicalRowKeySha256 = setSha(canonicalKeys);
  const currentRowKeySha256 = setSha(currentKeys);
  return {
    canonicalRows: canonical.length,
    currentRows: current.length,
    canonicalRowKeySha256,
    currentRowKeySha256,
    missingKeys,
    extraKeys,
    mismatches,
  };
}

function serializableSupport(
  dataset: Awaited<ReturnType<typeof loadHistoricalQuickReplayDataset>>,
) {
  const events = [...dataset.events].sort(
    (a, b) => a.occurredOn.localeCompare(b.occurredOn)
      || a.voteEventId.localeCompare(b.voteEventId),
  );
  const versions = [...dataset.versionsByBill.entries()]
    .flatMap(([billId, rows]) => rows.map((row) => ({ billId, ...row })))
    .sort(
      (a, b) => a.billId.localeCompare(b.billId)
        || a.publishedAt.localeCompare(b.publishedAt)
        || a.createdAt.localeCompare(b.createdAt)
        || a.id.localeCompare(b.id),
    );
  const memberships = [...dataset.memberships].sort(
    (a, b) => a.sessionId.localeCompare(b.sessionId)
      || a.chamberId.localeCompare(b.chamberId)
      || a.membershipId.localeCompare(b.membershipId),
  );
  const historicalVotes = [...dataset.historicalVotes].sort(
    (a, b) => a.occurredOn.localeCompare(b.occurredOn)
      || a.voteEventId.localeCompare(b.voteEventId)
      || a.membershipId.localeCompare(b.membershipId),
  );
  const targetVersions = [...dataset.targetVersionByEvent.entries()]
    .map(([voteEventId, version]) => ({
      voteEventId,
      billVersionId: version.id,
      billId: version.billId,
      publishedAt: version.publishedAt,
    }))
    .sort((a, b) => a.voteEventId.localeCompare(b.voteEventId));
  const analogueSupport = [...dataset.analogueSupportByEvent.entries()]
    .map(([voteEventId, support]) => ({
      voteEventId,
      prefiltered: support.prefiltered,
      selected: support.selected,
      selectedAnalogueIds: [...support.selectedAnalogueIds],
      directMemberSupport: support.member.size,
    }))
    .sort((a, b) => a.voteEventId.localeCompare(b.voteEventId));
  return { events, versions, memberships, historicalVotes, targetVersions, analogueSupport };
}

async function main(): Promise<void> {
  const plan = JSON.parse(readFileSync(env('VOTEPREDICT_GAP16_SUPPORT_PLAN_PATH'), 'utf8')) as Json;
  if (
    plan.schemaVersion !== 'historical-density-2025-house-replay-gap16-support-plan-v1'
    || plan.issue !== ISSUE
    || plan.snapshotProtocol?.canonicalParityGate?.required !== true
    || plan.snapshotProtocol?.canonicalParityGate?.exactCanonicalRowKeySetRequired !== true
    || plan.snapshotProtocol?.extensionRule?.eligibleOutcomeCompleteEvents !== EXPECTED_OUTCOME_COMPLETE
    || plan.snapshotProtocol?.extensionRule?.targetSelectionMayChangeAfterSnapshot !== false
    || plan.snapshotProtocol?.gapEventPresenceGate?.expectedExactBillDateMatchesInCurrentLoader !== 0
  ) {
    throw new Error('Frozen replay support plan drifted');
  }

  const canonical = parseCanonicalMatrix(
    env('VOTEPREDICT_HISTORICAL_AS_OF_MANIFEST_PATH'),
    env('VOTEPREDICT_HISTORICAL_AS_OF_MATRIX_PATH'),
  );
  const outcomes = parseOutcomeInput(env('VOTEPREDICT_GAP16_OUTCOMES_PATH'));

  const envPath = env('VOTEPREDICT_PRODUCTION_ENV_FILE');
  const runtimeEnv = parseRuntimeEnvironment(readFileSync(envPath, 'utf8'));
  secrets = Object.entries(runtimeEnv)
    .filter(([key]) => /SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(key))
    .map(([, value]) => value)
    .filter((value): value is string => typeof value === 'string');
  secrets.forEach(mask);
  const databaseUrl = await chooseDb(runtimeEnv);

  const { Pool } = await import('pg');
  const pool: Pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
  });

  try {
    await pool.query('SET default_transaction_read_only = on');
    const readOnly = await pool.query<{ value: string }>(
      "SELECT current_setting('default_transaction_read_only') AS value",
    );
    if (readOnly.rows[0]?.value !== 'on') {
      throw new Error('Could not force production snapshot connection read-only');
    }

    const dataset = await loadHistoricalQuickReplayDataset(pool);
    const current = flattenCurrentRows(dataset);
    const parity = compareRows(canonical, current);

    if (
      parity.missingKeys.length > 0
      || parity.extraKeys.length > 0
      || parity.mismatches.length > 0
      || parity.canonicalRows !== CANONICAL_ROWS
      || parity.currentRows !== CANONICAL_ROWS
      || parity.canonicalRowKeySha256 !== parity.currentRowKeySha256
    ) {
      throw new Error(
        'Canonical historical replay parity failed: '
          + JSON.stringify({
            canonicalRows: parity.canonicalRows,
            currentRows: parity.currentRows,
            missing: parity.missingKeys.slice(0, 10),
            extra: parity.extraKeys.slice(0, 10),
            mismatches: parity.mismatches.slice(0, 10),
          }),
      );
    }

    const currentCompositeCounts = new Map<string, number>();
    for (const event of dataset.events) {
      const key = eventComposite(event.identifier, event.occurredOn);
      currentCompositeCounts.set(key, (currentCompositeCounts.get(key) ?? 0) + 1);
    }
    const gapMatches = outcomes.composites.flatMap((compositeKey) => {
      const count = currentCompositeCounts.get(compositeKey) ?? 0;
      return count > 0 ? [{ compositeKey, currentLoaderEventCount: count }] : [];
    });
    if (gapMatches.length > 0) {
      throw new Error(
        `Frozen gap events unexpectedly exist in current loader state: ${JSON.stringify(gapMatches)}`,
      );
    }

    const support = serializableSupport(dataset);
    const supportEnvelope = {
      schemaVersion: 'historical-density-2025-house-replay-gap16-support-snapshot-v1',
      generatedAt: new Date().toISOString(),
      issue: ISSUE,
      replayVersion: 'historical-quick-replay-v2',
      memberHistoryHalfLifeDays: HALF_LIFE_DAYS,
      data: support,
    };
    const supportJson = `${JSON.stringify(supportEnvelope)}\n`;
    const supportGzip = gzipSync(Buffer.from(supportJson), { level: 9 });

    const outputDir = resolve(env('VOTEPREDICT_GAP16_SUPPORT_OUTPUT_DIR'));
    mkdirSync(outputDir, { recursive: true });
    const snapshotPath = resolve(
      outputDir,
      'historical-density-2025-house-replay-gap16-support-snapshot-v1.json.gz',
    );
    const manifestPath = resolve(
      outputDir,
      'historical-density-2025-house-replay-gap16-support-manifest-v1.json',
    );
    writeFileSync(snapshotPath, supportGzip, { mode: 0o600 });

    const manifest = {
      schemaVersion: 'historical-density-2025-house-replay-gap16-support-manifest-v1',
      generatedAt: new Date().toISOString(),
      issue: ISSUE,
      frozenInputs: {
        canonicalMatrix: {
          artifactId: 11252079484,
          artifactDigest:
            'sha256:22e8944cffc6fda553b05ea6ad5e92400d35fc01d83177efdd5d1204dd3c5a6f',
          matrixCanonicalNdjsonSha256: CANONICAL_MATRIX_CANONICAL_SHA256,
          matrixGzipSha256: CANONICAL_MATRIX_GZIP_SHA256,
        },
        gapOutcomes: {
          artifactId: OUTCOME_ARTIFACT_ID,
          artifactDigest: OUTCOME_ARTIFACT_DIGEST,
          events: EXPECTED_GAP_EVENTS,
          outcomeCompleteEvents: EXPECTED_OUTCOME_COMPLETE,
          unresolvedCompositeKey: EXPECTED_UNRESOLVED,
        },
      },
      productionSnapshot: {
        databaseReadOnly: true,
        productionWrites: false,
        vercelDeployment: false,
        events: support.events.length,
        versions: support.versions.length,
        memberships: support.memberships.length,
        historicalVotes: support.historicalVotes.length,
        targets: dataset.targets.length,
        targetVersions: support.targetVersions.length,
        analogueSupportEvents: support.analogueSupport.length,
        supportSnapshotCanonicalSha256: sha256(supportJson),
        supportSnapshotGzipSha256: sha256(supportGzip),
      },
      canonicalParity: {
        passed: true,
        probabilityTolerance: PROBABILITY_TOLERANCE,
        canonicalRows: parity.canonicalRows,
        currentRows: parity.currentRows,
        rowKeySha256: parity.currentRowKeySha256,
        missingRows: 0,
        extraRows: 0,
        fieldMismatches: 0,
      },
      gapOverlayReadiness: {
        exactGapEventsPresentInCurrentLoader: 0,
        frozenGapEvents: EXPECTED_GAP_EVENTS,
        outcomeCompleteEvents: EXPECTED_OUTCOME_COMPLETE,
        excludedUntilExplicitOutcome: [EXPECTED_UNRESOLVED],
        readyForInMemoryOverlayConstruction: true,
        readyForScoring: false,
        reason:
          'The support state is frozen and canonical baseline parity is proven, but the 15-event in-memory overlay and its target-specific companion/bill identity wiring have not yet been constructed and regression-tested.',
      },
      policy: {
        productionDatabaseQueried: true,
        productionDatabaseReadOnly: true,
        productionWrites: false,
        vercelEnvironmentRead: true,
        vercelDeployment: false,
        targetSelectionUsesCurrentProductionState: false,
        gapEventPresenceGatePassed: true,
        canonicalBaselineReinterpreted: false,
        modelFitting: 'none',
        servingChanged: false,
        mechanicallyActionable: false,
      },
    };
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
      mode: 0o600,
    });

    console.log(JSON.stringify({
      historicalDensity2025HouseReplayGap16Support: {
        canonicalParity: manifest.canonicalParity,
        productionSnapshot: manifest.productionSnapshot,
        gapOverlayReadiness: manifest.gapOverlayReadiness,
      },
    }, null, 2));
  } finally {
    await pool.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(safe(error));
  process.exitCode = 1;
});
