import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  buildHistoricalQuickAnalogueSupport,
  scoreHistoricalQuickReplay,
  type QuickReplayEvent,
  type QuickReplayMembership,
  type QuickReplayVersion,
  type QuickReplayVote,
} from '../src/evaluation/historical-quick-replay.js';
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
const CANONICAL_ROW_KEY_SHA256 =
  '3aa47101f9e4a848e293fdaa89ef853919d49826b68ae90960370c5c19e9df72';
const PROBABILITY_TOLERANCE = 1e-12;
const REPLAY_SESSIONS = new Set(['2021-2022', '2023-2024', '2025-2026']);
const FROZEN_MEMBER_VOTE_ROW_SHA256 =
  '721d748bacb74cd110380e233d7df101d044b5ad00d59bdf368ad39ecab9998b';

const SUPPORT_RUN_ID = 37631304120;
const SUPPORT_ARTIFACT_ID = 11486621043;
const SUPPORT_ARTIFACT_DIGEST =
  'sha256:9c21df92e9ee8644570e90cd2586cc16c1e14bc0e0bae94a527a320516a21553';
const SUPPORT_CANONICAL_SHA256 =
  'bd4f8fedf2c79bb42d87b94a2864fc877c7b577d33f4e5da8157eef01b818c6f';
const SUPPORT_GZIP_SHA256 =
  'd9f7b54c3dbb7c4db9579a718a6c00283056a8b2e4de8dbf0a3ea3dc63bf776b';
const SUPPORT_EVENTS = 1380;
const SUPPORT_VERSIONS = 2206;
const SUPPORT_MEMBERSHIPS = 612;
const SUPPORT_HISTORICAL_VOTES = 137435;
const SUPPORT_CANONICAL_TARGETS = 1339;
const SUPPORT_TARGET_VERSIONS = 1377;
const SUPPORT_ANALOGUE_EVENTS = 1374;

const OUTCOME_RUN_ID = 37625127437;
const OUTCOME_ARTIFACT_ID = 11483367972;
const OUTCOME_ARTIFACT_DIGEST =
  'sha256:2415268dd0f3a0fb5cea4e03eb22e6e74ee1f1efdaa8ce4dd8b8ea743e8659ba';
const OUTCOME_SOURCE_SHA256 =
  'e1a0abcc2970e7888021946dbe915aebf27077dafc4dfc7249b023339aad92d0';
const OUTCOME_PROOF_SHA256 =
  'b7490e53daeff266d8c5d450ee428c018b1070dcf0e4ca8b91234b24bbb616db';

const EXPECTED_GAP_EVENTS = 16;
const EXPECTED_OVERLAY_TARGETS = 15;
const EXPECTED_UNRESOLVED = 'HF2354|2026-05-17';
const EXPECTED_REPLAYABLE_EVENTS = 15;
const EXPECTED_MEMBER_OBSERVATIONS = 1990;
const EXPECTED_MEMBER_PREDICTIONS = 1990;
const EXPECTED_RESULT_PROOF_SHA256 =
  'a89de23656cc3c2cfde31999703d54f60cbe86ab8bdee93962f8081d3331f2b4';
const EXPECTED_MEMBER_PREDICTION_PROOF_SHA256 =
  'caf50b9ae2f07c2cfd0361554bb5440f11dec7b0b495c9b92768189b7cf41848';
const EXPECTED_MEMBER_ACCURACY = 0.9698492462311558;
const EXPECTED_MEMBER_BRIER = 0.03725407295423199;
const EXPECTED_MEMBER_LOG_LOSS = 0.16242195623689934;
const EXPECTED_MEMBER_ECE = 0.080291699115617;
const EXPECTED_CHAMBER_MAE = 13.715526534958565;

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

type SupportEnvelope = {
  schemaVersion: string;
  generatedAt: string;
  issue: number;
  replayVersion: string;
  memberHistoryHalfLifeDays: number;
  data: {
    events: QuickReplayEvent[];
    versions: QuickReplayVersion[];
    memberships: QuickReplayMembership[];
    historicalVotes: QuickReplayVote[];
    targetVersions: Array<{
      voteEventId: string;
      billVersionId: string;
      billId: string;
      publishedAt: string;
    }>;
    analogueSupport: Array<{
      voteEventId: string;
      prefiltered: number;
      selected: number;
      selectedAnalogueIds: string[];
      directMemberSupport: number;
    }>;
  };
};

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

function readJson(path: string): Json {
  return JSON.parse(readFileSync(path, 'utf8')) as Json;
}

function rowKey(row: Pick<CanonicalRow, 'voteEventId' | 'membershipId'>): string {
  return `${row.voteEventId}|${row.membershipId}`;
}

function parseCanonicalMatrix(manifestPath: string, matrixPath: string): CanonicalRow[] {
  const manifest = readJson(manifestPath);
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

function flattenReplayRows(
  results: ReturnType<typeof runHistoricalQuickDecayShadowReplay>,
  targets: readonly QuickReplayEvent[],
): CurrentRow[] {
  const targetById = new Map(targets.map((event) => [event.voteEventId, event] as const));
  return results
    .filter((event) => REPLAY_SESSIONS.has(event.session))
    .flatMap((event) => {
      const target = targetById.get(event.voteEventId);
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

  return {
    canonicalRows: canonical.length,
    currentRows: current.length,
    canonicalRowKeySha256: setSha(canonicalKeys),
    currentRowKeySha256: setSha(currentKeys),
    missingRows: missingKeys.length,
    extraRows: extraKeys.length,
    fieldMismatches: mismatches.length,
    sampleMissing: missingKeys.slice(0, 10),
    sampleExtra: extraKeys.slice(0, 10),
    sampleMismatches: mismatches.slice(0, 10),
  };
}

function composite(identifier: string, occurredOn: string): string {
  return `${identifier.replace(/\s+/g, '').toUpperCase()}|${occurredOn}`;
}

function parseSupport(manifestPath: string, snapshotPath: string) {
  const manifest = readJson(manifestPath);
  const gzip = readFileSync(snapshotPath);

  if (
    manifest.schemaVersion
      !== 'historical-density-2025-house-replay-gap16-support-manifest-v1'
    || manifest.issue !== ISSUE
    || manifest.frozenInputs?.canonicalMatrix?.artifactId !== 11252079484
    || manifest.frozenInputs?.gapMemberVotes?.artifactId !== 11482176035
    || manifest.frozenInputs?.gapOutcomes?.artifactId !== OUTCOME_ARTIFACT_ID
    || manifest.productionSnapshot?.databaseReadOnly !== true
    || manifest.productionSnapshot?.productionWrites !== false
    || manifest.canonicalParity?.passed !== true
    || manifest.canonicalParity?.canonicalRows !== 135457
    || manifest.canonicalParity?.currentRows !== 135457
    || manifest.canonicalParity?.missingRows !== 0
    || manifest.canonicalParity?.extraRows !== 0
    || manifest.canonicalParity?.fieldMismatches !== 0
    || manifest.canonicalParity?.rowKeySha256 !== CANONICAL_ROW_KEY_SHA256
    || manifest.frozenInputs?.gapMemberVotes?.memberVoteRowSha256
      !== FROZEN_MEMBER_VOTE_ROW_SHA256
    || manifest.gapLoaderReconciliation?.passed !== true
    || manifest.gapLoaderReconciliation?.reconciledEvents !== EXPECTED_GAP_EVENTS
    || manifest.gapLoaderReconciliation?.reconciledDecisiveMemberVotes !== 2125
    || manifest.gapOverlayReadiness?.outcomeCompleteEvents !== EXPECTED_OVERLAY_TARGETS
    || manifest.gapOverlayReadiness?.readyForTargetVersionAugmentation !== true
    || manifest.gapOverlayReadiness?.readyForScoring !== false
  ) {
    throw new Error('Canonical Quick support manifest drifted');
  }

  if (
    manifest.productionSnapshot?.events !== SUPPORT_EVENTS
    || manifest.productionSnapshot?.versions !== SUPPORT_VERSIONS
    || manifest.productionSnapshot?.memberships !== SUPPORT_MEMBERSHIPS
    || manifest.productionSnapshot?.historicalVotes !== SUPPORT_HISTORICAL_VOTES
    || manifest.productionSnapshot?.targets !== SUPPORT_CANONICAL_TARGETS
    || manifest.productionSnapshot?.targetVersions !== SUPPORT_TARGET_VERSIONS
    || manifest.productionSnapshot?.analogueSupportEvents !== SUPPORT_ANALOGUE_EVENTS
    || manifest.productionSnapshot?.supportSnapshotCanonicalSha256
      !== SUPPORT_CANONICAL_SHA256
    || manifest.productionSnapshot?.supportSnapshotGzipSha256 !== SUPPORT_GZIP_SHA256
  ) {
    throw new Error('Canonical Quick support counts/digests drifted');
  }

  if (sha256(gzip) !== SUPPORT_GZIP_SHA256) {
    throw new Error('Quick support gzip digest mismatch');
  }
  const json = gunzipSync(gzip).toString('utf8');
  if (sha256(json) !== SUPPORT_CANONICAL_SHA256) {
    throw new Error('Quick support canonical JSON digest mismatch');
  }
  const envelope = JSON.parse(json) as SupportEnvelope;
  if (
    envelope.schemaVersion
      !== 'historical-density-2025-house-replay-gap16-support-snapshot-v1'
    || envelope.issue !== ISSUE
    || envelope.replayVersion !== 'historical-quick-replay-v2'
    || envelope.memberHistoryHalfLifeDays !== HALF_LIFE_DAYS
    || envelope.data.events.length !== SUPPORT_EVENTS
    || envelope.data.versions.length !== SUPPORT_VERSIONS
    || envelope.data.memberships.length !== SUPPORT_MEMBERSHIPS
    || envelope.data.historicalVotes.length !== SUPPORT_HISTORICAL_VOTES
    || envelope.data.targetVersions.length !== SUPPORT_TARGET_VERSIONS
    || envelope.data.analogueSupport.length !== SUPPORT_ANALOGUE_EVENTS
  ) {
    throw new Error('Quick support snapshot envelope drifted');
  }
  return { manifest, envelope };
}

function parseOutcomes(path: string) {
  const value = readJson(path);
  if (
    value.schemaVersion !== 'historical-density-2025-house-replay-gap16-outcomes-v1'
    || value.issue !== ISSUE
    || value.session !== '2025-2026'
    || value.chamber !== 'house'
    || value.journalSource?.sourceProofSha256 !== OUTCOME_SOURCE_SHA256
    || value.outcomeRecovery?.outcomeProofSha256 !== OUTCOME_PROOF_SHA256
    || value.outcomeRecovery?.events !== EXPECTED_GAP_EVENTS
    || value.outcomeRecovery?.recovered !== EXPECTED_OVERLAY_TARGETS
    || value.outcomeRecovery?.unresolved !== 1
  ) {
    throw new Error('Canonical gap outcome artifact drifted');
  }
  const rows = value.outcomeRecovery.eventsData as Json[];
  const recovered = rows.filter((row) => row.status === 'recovered');
  const unresolved = rows.filter((row) => row.status === 'unresolved');
  if (
    recovered.length !== EXPECTED_OVERLAY_TARGETS
    || unresolved.length !== 1
    || unresolved[0]?.compositeKey !== EXPECTED_UNRESOLVED
  ) {
    throw new Error('Gap outcome recovery set drifted');
  }
  return { value, recovered, unresolved: unresolved[0] };
}

function versionsByBill(versions: readonly QuickReplayVersion[]) {
  const result = new Map<string, QuickReplayVersion[]>();
  for (const version of versions) {
    const rows = result.get(version.billId) ?? [];
    rows.push(version);
    result.set(version.billId, rows);
  }
  return result;
}

function votesByEvent(votes: readonly QuickReplayVote[]) {
  const result = new Map<string, Map<string, 'yea' | 'nay'>>();
  for (const vote of votes) {
    const rows = result.get(vote.voteEventId) ?? new Map<string, 'yea' | 'nay'>();
    const prior = rows.get(vote.legislatorId);
    if (prior && prior !== vote.choice) {
      throw new Error(
        `Conflicting legislator vote in frozen support: ${vote.voteEventId}|${vote.legislatorId}`,
      );
    }
    rows.set(vote.legislatorId, vote.choice);
    result.set(vote.voteEventId, rows);
  }
  return result;
}

function decisiveCounts(votes: readonly QuickReplayVote[]) {
  const result = new Map<string, number>();
  for (const vote of votes) {
    result.set(vote.voteEventId, (result.get(vote.voteEventId) ?? 0) + 1);
  }
  return result;
}

function verifySupportRebuild(envelope: SupportEnvelope) {
  const byBill = versionsByBill(envelope.data.versions);
  const byEventVotes = votesByEvent(envelope.data.historicalVotes);
  const rebuilt = buildHistoricalQuickAnalogueSupport(
    envelope.data.events,
    byBill,
    byEventVotes,
  );

  if (
    rebuilt.targetVersionByEvent.size !== SUPPORT_TARGET_VERSIONS
    || rebuilt.supportByEvent.size !== SUPPORT_ANALOGUE_EVENTS
  ) {
    throw new Error(
      `Rebuilt Quick support cardinality drifted: `
      + JSON.stringify({
        targetVersions: rebuilt.targetVersionByEvent.size,
        analogueSupport: rebuilt.supportByEvent.size,
      }),
    );
  }

  const frozenTargetVersions = new Map(
    envelope.data.targetVersions.map((row) => [row.voteEventId, row] as const),
  );
  for (const [voteEventId, version] of rebuilt.targetVersionByEvent) {
    const frozen = frozenTargetVersions.get(voteEventId);
    if (
      !frozen
      || frozen.billVersionId !== version.id
      || frozen.billId !== version.billId
      || frozen.publishedAt !== version.publishedAt
    ) {
      throw new Error(`Target-version rebuild drifted for ${voteEventId}`);
    }
  }

  const frozenAnalogue = new Map(
    envelope.data.analogueSupport.map((row) => [row.voteEventId, row] as const),
  );
  for (const [voteEventId, support] of rebuilt.supportByEvent) {
    const frozen = frozenAnalogue.get(voteEventId);
    if (
      !frozen
      || frozen.prefiltered !== support.prefiltered
      || frozen.selected !== support.selected
      || JSON.stringify(frozen.selectedAnalogueIds)
        !== JSON.stringify(support.selectedAnalogueIds)
      || frozen.directMemberSupport !== support.member.size
    ) {
      throw new Error(`Analogue-support rebuild drifted for ${voteEventId}`);
    }
  }

  return rebuilt;
}

async function main(): Promise<void> {
  const canonical = parseCanonicalMatrix(
    env('VOTEPREDICT_HISTORICAL_AS_OF_MANIFEST_PATH'),
    env('VOTEPREDICT_HISTORICAL_AS_OF_MATRIX_PATH'),
  );
  const support = parseSupport(
    env('VOTEPREDICT_GAP16_SUPPORT_MANIFEST_PATH'),
    env('VOTEPREDICT_GAP16_SUPPORT_SNAPSHOT_PATH'),
  );
  const outcomes = parseOutcomes(env('VOTEPREDICT_GAP16_OUTCOMES_PATH'));
  const canonical = parseCanonicalMatrix(
    env('VOTEPREDICT_HISTORICAL_AS_OF_MANIFEST_PATH'),
    env('VOTEPREDICT_HISTORICAL_AS_OF_MATRIX_PATH'),
  );
  const output = resolve(env('VOTEPREDICT_GAP15_OVERLAY_OUTPUT'));

  const rebuilt = verifySupportRebuild(support.envelope);
  const counts = decisiveCounts(support.envelope.data.historicalVotes);
  const byBill = versionsByBill(support.envelope.data.versions);
  const byEventVotes = votesByEvent(support.envelope.data.historicalVotes);

  const canonicalTargets = support.envelope.data.events.filter(
    (event) =>
      event.passed !== null
      && rebuilt.targetVersionByEvent.has(event.voteEventId)
      && (counts.get(event.voteEventId) ?? 0) >= 20,
  );
  if (canonicalTargets.length !== SUPPORT_CANONICAL_TARGETS) {
    throw new Error(
      `Canonical target set drifted after offline rebuild: ${canonicalTargets.length}`,
    );
  }

  const reconciledByComposite = new Map<string, Json>(
    (support.manifest.gapLoaderReconciliation.events as Json[])
      .map((row) => [String(row.compositeKey), row]),
  );
  const eventById = new Map(
    support.envelope.data.events.map((event) => [event.voteEventId, event] as const),
  );

  const overlayTargets: QuickReplayEvent[] = outcomes.recovered.map((row) => {
    const compositeKey = String(row.compositeKey);
    const reconciliation = reconciledByComposite.get(compositeKey);
    if (!reconciliation) {
      throw new Error(`No frozen loader reconciliation for ${compositeKey}`);
    }
    const event = eventById.get(String(reconciliation.voteEventId));
    if (!event) throw new Error(`No frozen loader event for ${compositeKey}`);
    if (
      event.passed !== null
      || composite(event.identifier, event.occurredOn) !== compositeKey
      || event.yeaCount !== Number(row.yeaCount)
      || event.nayCount !== Number(row.nayCount)
      || !rebuilt.targetVersionByEvent.has(event.voteEventId)
      || !rebuilt.supportByEvent.has(event.voteEventId)
      || (counts.get(event.voteEventId) ?? 0) !== Number(row.decisiveVotes)
      || typeof row.passed !== 'boolean'
    ) {
      throw new Error(`Overlay target prerequisites drifted for ${compositeKey}`);
    }
    return {
      ...event,
      passed: row.passed as boolean,
    };
  });

  if (
    overlayTargets.length !== EXPECTED_OVERLAY_TARGETS
    || new Set(overlayTargets.map((event) => event.voteEventId)).size
      !== EXPECTED_OVERLAY_TARGETS
  ) {
    throw new Error('Overlay target identity/cardinality drifted');
  }
  if (
    overlayTargets.some(
      (event) => composite(event.identifier, event.occurredOn) === EXPECTED_UNRESOLVED,
    )
  ) {
    throw new Error('Fail-closed HF2354 event leaked into overlay targets');
  }

  const overlayPassedByEvent = new Map(
    overlayTargets.map((event) => [event.voteEventId, event.passed] as const),
  );
  const overlayEvents = support.envelope.data.events.map((event) =>
    overlayPassedByEvent.has(event.voteEventId)
      ? { ...event, passed: overlayPassedByEvent.get(event.voteEventId) as boolean }
      : event);
  const overlayRebuilt = buildHistoricalQuickAnalogueSupport(
    overlayEvents,
    versionsByBill(support.envelope.data.versions),
    votesByEvent(support.envelope.data.historicalVotes),
  );

  const canonicalOverlayResults = runHistoricalQuickDecayShadowReplay(
    canonicalTargets,
    overlayRebuilt.targetVersionByEvent,
    overlayRebuilt.supportByEvent,
    support.envelope.data.memberships,
    support.envelope.data.historicalVotes,
    HALF_LIFE_DAYS,
  );
  const canonicalRegression = compareRows(
    canonical,
    flattenReplayRows(canonicalOverlayResults, canonicalTargets),
  );
  if (
    canonicalRegression.canonicalRows !== CANONICAL_ROWS
    || canonicalRegression.currentRows !== CANONICAL_ROWS
    || canonicalRegression.canonicalRowKeySha256 !== CANONICAL_ROW_KEY_SHA256
    || canonicalRegression.currentRowKeySha256 !== CANONICAL_ROW_KEY_SHA256
    || canonicalRegression.missingRows !== 0
    || canonicalRegression.extraRows !== 0
    || canonicalRegression.fieldMismatches !== 0
  ) {
    throw new Error(
      'Canonical 135,457-row replay changed with overlay present: '
      + JSON.stringify(canonicalRegression),
    );
  }

  const results = runHistoricalQuickDecayShadowReplay(
    overlayTargets,
    overlayRebuilt.targetVersionByEvent,
    overlayRebuilt.supportByEvent,
    support.envelope.data.memberships,
    support.envelope.data.historicalVotes,
    HALF_LIFE_DAYS,
  );
  if (results.length !== EXPECTED_OVERLAY_TARGETS) {
    throw new Error(`Expected 15 overlay replay results, found ${results.length}`);
  }

  const scorecard = scoreHistoricalQuickReplay(results);
  const statusCounts: Record<string, number> = {};
  for (const result of results) {
    statusCounts[result.status] = (statusCounts[result.status] ?? 0) + 1;
  }

  const resultProofSha256 = setSha(
    results.map((result) =>
      [
        result.voteEventId,
        result.status,
        result.targetVersionId,
        result.activeMembers,
        result.directAnalogueMembers,
        result.selectedAnalogues,
        result.memberPredictions.length,
        result.memberPredictions.filter((row) => row.yesProbability !== undefined).length,
        result.actualYes,
        result.passed ? 'pass' : 'fail',
        result.passageProbability ?? 'null',
        result.expectedYes ?? 'null',
      ].join('|')
    ),
  );
  const memberPredictionProofSha256 = setSha(
    results.flatMap((result) =>
      result.memberPredictions.map((member) =>
        [
          result.voteEventId,
          member.membershipId,
          member.legislatorId,
          member.party,
          member.yesProbability ?? 'null',
          member.actualOutcome ?? 'null',
          member.analogueEffectiveWeight,
          member.cannotPredictReason ?? '',
        ].join('|')
      )
    ),
  );

  if (
    statusCounts.replayable !== EXPECTED_REPLAYABLE_EVENTS
    || Object.keys(statusCounts).length !== 1
    || scorecard.overall.memberObservations !== EXPECTED_MEMBER_OBSERVATIONS
    || scorecard.overall.memberPredictions !== EXPECTED_MEMBER_PREDICTIONS
    || scorecard.overall.memberCoverage !== 1
    || Math.abs(scorecard.overall.memberAccuracy - EXPECTED_MEMBER_ACCURACY) > 1e-15
    || Math.abs(scorecard.overall.memberBrier - EXPECTED_MEMBER_BRIER) > 1e-15
    || Math.abs(scorecard.overall.memberLogLoss - EXPECTED_MEMBER_LOG_LOSS) > 1e-15
    || Math.abs(scorecard.overall.memberExpectedCalibrationError - EXPECTED_MEMBER_ECE) > 1e-15
    || Math.abs(scorecard.overall.chamberMeanAbsoluteYesError - EXPECTED_CHAMBER_MAE) > 1e-15
    || resultProofSha256 !== EXPECTED_RESULT_PROOF_SHA256
    || memberPredictionProofSha256 !== EXPECTED_MEMBER_PREDICTION_PROOF_SHA256
  ) {
    throw new Error(
      'Frozen 15-event overlay result drifted: '
      + JSON.stringify({
        statusCounts,
        overall: scorecard.overall,
        resultProofSha256,
        memberPredictionProofSha256,
      }),
    );
  }

  const existing2025HouseResults = canonicalOverlayResults.filter(
    (result) => result.session === '2025-2026' && result.chamber === 'house',
  );
  const existing2025HouseScorecard = scoreHistoricalQuickReplay(existing2025HouseResults).overall;

  const detailedEvents = results.map((result) => {
    const target = overlayTargets.find((event) => event.voteEventId === result.voteEventId)!;
    const targetVersion = overlayRebuilt.targetVersionByEvent.get(result.voteEventId);
    const analogueSupport = overlayRebuilt.supportByEvent.get(result.voteEventId);
    if (!targetVersion || !analogueSupport) {
      throw new Error(`Detailed overlay support missing for ${result.voteEventId}`);
    }
    const analogueDetails = analogueSupport.selectedAnalogueDetails ?? [];
    if (
      analogueDetails.length !== analogueSupport.selected
      || JSON.stringify(analogueDetails.map((row) => row.voteEventId))
        !== JSON.stringify(analogueSupport.selectedAnalogueIds)
    ) {
      throw new Error(`Selected analogue detail drifted for ${result.voteEventId}`);
    }
    const decisiveVoteRows = support.envelope.data.historicalVotes
      .filter((row) => row.voteEventId === result.voteEventId)
      .sort((a, b) => a.membershipId.localeCompare(b.membershipId))
      .map((row) => ({
        membershipId: row.membershipId,
        legislatorId: row.legislatorId,
        party: row.party,
        choice: row.choice,
      }));

    return {
      voteEventId: result.voteEventId,
      billId: target.billId,
      compositeKey: composite(target.identifier, target.occurredOn),
      identifier: target.identifier,
      occurredOn: target.occurredOn,
      status: result.status,
      targetVersion: {
        id: targetVersion.id,
        billId: targetVersion.billId,
        publishedAt: targetVersion.publishedAt,
        rawTextSha256: sha256(targetVersion.rawText),
      },
      analogueSupport: {
        prefiltered: analogueSupport.prefiltered,
        selected: analogueSupport.selected,
        directMemberSupport: analogueSupport.member.size,
        selectedAnalogueIds: [...analogueSupport.selectedAnalogueIds],
        selectedAnalogues: analogueDetails.map((row) => ({ ...row })),
      },
      decisiveVoteRows,
      decisiveVoteRowSha256: setSha(
        decisiveVoteRows.map((row) =>
          `${row.membershipId}|${row.legislatorId}|${row.party}|${row.choice}`),
      ),
      activeMembers: result.activeMembers,
      directAnalogueMembers: result.directAnalogueMembers,
      memberObservations: result.memberPredictions.filter(
        (row) => row.actualOutcome !== undefined,
      ).length,
      memberPredictions: result.memberPredictions.map((row) => ({
        membershipId: row.membershipId,
        legislatorId: row.legislatorId,
        party: row.party,
        yesProbability: row.yesProbability ?? null,
        actualOutcome: row.actualOutcome ?? null,
        analogueEffectiveWeight: row.analogueEffectiveWeight,
        support: row.support,
        cannotPredictReason: row.cannotPredictReason ?? null,
      })),
      passageProbability: result.passageProbability ?? null,
      expectedYes: result.expectedYes ?? null,
      yesLow: result.yesLow ?? null,
      yesHigh: result.yesHigh ?? null,
      actualYes: result.actualYes,
      passed: result.passed,
    };
  });

  const overlayInputProofSha256 = setSha(
    detailedEvents.flatMap((event) => [
      [
        event.voteEventId,
        event.billId,
        event.compositeKey,
        event.targetVersion.id,
        event.targetVersion.rawTextSha256,
        event.analogueSupport.prefiltered,
        event.analogueSupport.selected,
        event.analogueSupport.directMemberSupport,
        event.analogueSupport.selectedAnalogueIds.join(','),
        event.decisiveVoteRowSha256,
      ].join('|'),
      ...event.analogueSupport.selectedAnalogues.map((row) =>
        [
          event.voteEventId,
          row.voteEventId,
          row.billVersionId,
          row.similarity,
          row.recencyWeight,
          row.score,
          row.relationship ?? '',
          row.reasons.join(','),
        ].join('|')),
    ]),
  );

  const report = {
    schemaVersion: 'historical-density-2025-house-replay-gap15-overlay-v2',
    generatedAt: new Date().toISOString(),
    issue: ISSUE,
    replay: {
      version: 'historical-quick-replay-v2',
      memberHistoryHalfLifeDays: HALF_LIFE_DAYS,
      cohort: '15 frozen outcome-complete 2025-26 House replay-gap events',
    },
    frozenInputs: {
      support: {
        runId: SUPPORT_RUN_ID,
        artifactId: SUPPORT_ARTIFACT_ID,
        artifactDigest: SUPPORT_ARTIFACT_DIGEST,
        canonicalSha256: SUPPORT_CANONICAL_SHA256,
        gzipSha256: SUPPORT_GZIP_SHA256,
      },
      outcomes: {
        runId: OUTCOME_RUN_ID,
        artifactId: OUTCOME_ARTIFACT_ID,
        artifactDigest: OUTCOME_ARTIFACT_DIGEST,
        sourceProofSha256: OUTCOME_SOURCE_SHA256,
        outcomeProofSha256: OUTCOME_PROOF_SHA256,
      },
    },
    reconstruction: {
      supportTargetVersions: rebuilt.targetVersionByEvent.size,
      supportAnalogueEvents: rebuilt.supportByEvent.size,
      frozenSupportSelectionsExact: true,
      canonicalTargetsRebuilt: canonicalTargets.length,
      canonicalTargetsChanged: false,
      canonicalRowsWithOverlayPresent: canonicalRegression,
    },
    overlay: {
      frozenGapEvents: EXPECTED_GAP_EVENTS,
      outcomeCompleteTargets: overlayTargets.length,
      excludedFailClosed: [EXPECTED_UNRESOLVED],
      underlyingLoaderPassedWasNullForAllTargets: true,
      targetVersionCoverage: overlayTargets.filter((event) =>
        rebuilt.targetVersionByEvent.has(event.voteEventId)).length,
      analogueSupportCoverage: overlayTargets.filter((event) =>
        rebuilt.supportByEvent.has(event.voteEventId)).length,
      results: results.length,
      statusCounts,
      resultProofSha256,
      memberPredictionProofSha256,
      overlayInputProofSha256,
      events: detailedEvents,
    },
    scorecard,
    comparison: {
      existing2025HouseReplayCohort: {
        events: existing2025HouseResults.length,
        scorecard: existing2025HouseScorecard,
      },
      overlayMinusExisting2025House: {
        memberAccuracy:
          scorecard.overall.memberAccuracy - existing2025HouseScorecard.memberAccuracy,
        memberBrier:
          scorecard.overall.memberBrier - existing2025HouseScorecard.memberBrier,
        memberLogLoss:
          scorecard.overall.memberLogLoss - existing2025HouseScorecard.memberLogLoss,
        memberExpectedCalibrationError:
          scorecard.overall.memberExpectedCalibrationError
          - existing2025HouseScorecard.memberExpectedCalibrationError,
        chamberMeanAbsoluteYesError:
          scorecard.overall.chamberMeanAbsoluteYesError
          - existing2025HouseScorecard.chamberMeanAbsoluteYesError,
        passageBrier:
          scorecard.overall.passageBrier - existing2025HouseScorecard.passageBrier,
      },
    },
    policy: {
      productionDatabaseQueried: false,
      productionWrites: false,
      vercelUsed: false,
      canonicalTargetSetMutated: false,
      canonicalRowsComparedToImmutableMatrix: true,
      canonicalRowsUnchangedWithOverlayPresent: true,
      frozenSupportOnly: true,
      frozenOutcomeLabelsOnly: true,
      unresolvedOutcomeExcluded: EXPECTED_UNRESOLVED,
      targetSelectionUsesOutcomesBeyondFrozenGapSet: false,
      modelFitting: 'none',
      featureRowsWritten: false,
      servingChanged: false,
      mechanicallyActionable: false,
      interpretationBoundary:
        'This is an offline evaluation of the 15 previously missing replay targets under frozen historical Quick v2 support. It does not modify the canonical benchmark or production serving.',
    },
  };

  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    historicalDensity2025HouseReplayGap15Overlay: {
      supportTargetVersions: report.reconstruction.supportTargetVersions,
      supportAnalogueEvents: report.reconstruction.supportAnalogueEvents,
      canonicalTargetsRebuilt: report.reconstruction.canonicalTargetsRebuilt,
      canonicalRowsWithOverlayPresent:
        report.reconstruction.canonicalRowsWithOverlayPresent,
      outcomeCompleteTargets: report.overlay.outcomeCompleteTargets,
      statusCounts,
      resultProofSha256,
      memberPredictionProofSha256,
      overall: scorecard.overall,
      productionDatabaseQueried: false,
      canonicalTargetSetMutated: false,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
