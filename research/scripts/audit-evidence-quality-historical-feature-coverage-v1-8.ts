import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ISSUE = 718;
const EXPECTED_ROWS = 135457;
const EXPECTED_ROW_KEYS =
  '3aa47101f9e4a848e293fdaa89ef853919d49826b68ae90960370c5c19e9df72';
const EXPECTED_CANONICAL_SHA =
  '2d4ed4993fd7efce5a0c7de2a4331f1f3a0f163e323f437c6f9e7dacf266a30b';
const EXPECTED_GZIP_SHA =
  '42f9d79bd69df63b46a2f0f5c1636f4cc7f8fd0ec0a65ae905d85f28fd436700';
const EXPECTED_REVIEW_KEY_SHA =
  'a2caa40ea956cf479bbe8a84b4b415207efdffa4429732b2a5128096fadd6ebc';
const EXPECTED_ADDED_ROW_KEY_SHA =
  'c06872dba335ae09c771ce6fc3a8d77c02f0d1b4adc4ce57ae51d0ad9a523e56';
const EXPECTED_CLAIM_PROOF_SHA =
  '1044159f2cf6292cb61e606b2086e4cb9e9a117f3b3e58175c43221c961a9f14';
const OUTPUT = 'evidence-quality-historical-feature-coverage-v1.8.json';

type Json = Record<string, any>;
type MatrixRow = {
  schemaVersion: string;
  voteEventId: string;
  membershipId: string;
  legislatorId: string;
  session: string;
  chamber: string;
  occurredOn: string;
  billId: string;
  identifier: string;
  eventStatus: string;
  features: number[];
  reviewedApplicabilityFeatures: number[];
  reviewedApplicability: null | Record<string, unknown>;
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

function nonzero(values: readonly number[]): boolean {
  return values.some((value) => value !== 0);
}

function main(): void {
  const manifest = JSON.parse(
    readFileSync(env('VOTEPREDICT_EQ_V18_MANIFEST_PATH'), 'utf8'),
  ) as Json;
  const gzipBytes = readFileSync(env('VOTEPREDICT_EQ_V18_MATRIX_PATH'));
  const outDir = env('VOTEPREDICT_EQ_V18_COVERAGE_OUTPUT_DIR');

  if (
    manifest.schemaVersion
      !== 'evidence-quality-historical-feature-matrix-v1.8-manifest'
    || manifest.issue !== ISSUE
    || manifest.baseline?.artifactId !== 11436413885
    || manifest.overlaySource?.artifactId !== 11493988951
    || manifest.overlaySource?.sourceCommitSha
      !== '03f5ce08ee4bdf9edf54c0027f3c57b66afe2eb3'
    || manifest.targetUniverse?.rows !== EXPECTED_ROWS
    || manifest.targetUniverse?.events !== 1339
    || manifest.targetUniverse?.memberships !== 611
    || manifest.targetUniverse?.rowKeySha256 !== EXPECTED_ROW_KEYS
    || manifest.featureFamilies?.exactBill?.nonzeroRows !== 38
    || manifest.featureFamilies?.reviewedApplicability?.nonzeroRows !== 54
    || manifest.featureFamilies?.reviewedApplicability?.previousNonzeroRows !== 6
    || manifest.featureFamilies?.reviewedApplicability?.netAddedRows !== 48
    || manifest.featureFamilies?.reviewedApplicability?.addedReviewKeySha256
      !== EXPECTED_REVIEW_KEY_SHA
    || manifest.featureFamilies?.reviewedApplicability?.addedRowKeySha256
      !== EXPECTED_ADDED_ROW_KEY_SHA
    || manifest.featureFamilies?.reviewedApplicability?.addedClaimProofSha256
      !== EXPECTED_CLAIM_PROOF_SHA
    || manifest.coverage?.exactNonzeroRows !== 38
    || manifest.coverage?.reviewedApplicabilityNonzeroRows !== 54
    || manifest.coverage?.combinedNonzeroRows !== 92
    || manifest.coverage?.overlapRows !== 0
    || manifest.coverage?.membershipsWithCombinedDirectionalEvidence !== 44
    || manifest.coverage?.eventsWithCombinedDirectionalEvidence !== 73
    || manifest.coverage?.netAddedCombinedRowsVsV17 !== 48
    || manifest.coverage?.exactRowsChangedVsV17 !== 0
    || manifest.coverage?.reviewedApplicabilityRowsChangedOutsideAdditions !== 0
    || manifest.coverage?.newMembershipsWithCombinedDirectionalEvidenceVsV17 !== 14
    || manifest.coverage?.newEventsWithCombinedDirectionalEvidenceVsV17 !== 34
    || manifest.applicabilityGate?.acceptedClaimEventPairs !== 48
    || manifest.applicabilityGate?.integrationRows !== 48
    || manifest.applicabilityGate?.publicMembers !== 15
    || manifest.applicabilityGate?.targetEvents !== 34
    || manifest.applicabilityGate?.bills !== 24
    || manifest.applicabilityGate?.alignmentCounts?.aligns !== 47
    || manifest.applicabilityGate?.alignmentCounts?.conflicts !== 1
    || manifest.digests?.matrixCanonicalNdjsonSha256
      !== EXPECTED_CANONICAL_SHA
    || manifest.digests?.matrixGzipSha256 !== EXPECTED_GZIP_SHA
    || manifest.policy?.outcomeUseDuringFeatureConstruction !== 'none'
    || manifest.policy?.targetVoteOutcomesRead !== false
    || manifest.policy?.semanticDecisionsUseOutcomes !== false
    || manifest.policy?.upstreamIdentityBridgeOutcomeUse !== 'identity_resolution_only'
    || manifest.policy?.pendingOrAmbiguousApplicabilityIncluded !== false
    || manifest.policy?.existingDirectionalRowsOverwritten !== false
    || manifest.policy?.productionDatabaseQueried !== false
    || manifest.policy?.productionWrites !== false
    || manifest.policy?.vercelUsed !== false
    || manifest.policy?.modelFitting !== 'none'
    || manifest.policy?.servingChanged !== false
  ) {
    throw new Error('v1.8 manifest identity/policy drifted');
  }

  const addedReviewKeys =
    manifest.featureFamilies.reviewedApplicability.addedReviewKeys as string[];
  const addedRowKeys =
    manifest.featureFamilies.reviewedApplicability.addedRowKeys as string[];
  if (
    addedReviewKeys.length !== 48
    || new Set(addedReviewKeys).size !== 48
    || setSha(addedReviewKeys) !== EXPECTED_REVIEW_KEY_SHA
    || addedRowKeys.length !== 48
    || new Set(addedRowKeys).size !== 48
    || setSha(addedRowKeys) !== EXPECTED_ADDED_ROW_KEY_SHA
  ) {
    throw new Error('v1.8 added-row/review-key set drifted');
  }

  if (
    sha256(gzipBytes) !== EXPECTED_GZIP_SHA
    || sha256(gzipBytes) !== manifest.digests.matrixGzipSha256
  ) {
    throw new Error('v1.8 gzip digest mismatch');
  }
  const canonical = gunzipSync(gzipBytes).toString('utf8');
  if (
    sha256(canonical) !== EXPECTED_CANONICAL_SHA
    || sha256(canonical) !== manifest.digests.matrixCanonicalNdjsonSha256
  ) {
    throw new Error('v1.8 canonical digest mismatch');
  }

  const rows = canonical
    .trimEnd()
    .split('\n')
    .map((line) => JSON.parse(line) as MatrixRow);
  if (rows.length !== EXPECTED_ROWS) {
    throw new Error(`Expected ${EXPECTED_ROWS} rows, got ${rows.length}`);
  }
  const rowKeys = rows
    .map((row) => `${row.voteEventId}|${row.membershipId}`)
    .sort();
  if (sha256(`${rowKeys.join('\n')}\n`) !== EXPECTED_ROW_KEYS) {
    throw new Error('v1.8 row-key digest drifted');
  }

  const expectedKeys = [
    'billId',
    'chamber',
    'eventStatus',
    'features',
    'identifier',
    'legislatorId',
    'membershipId',
    'occurredOn',
    'reviewedApplicability',
    'reviewedApplicabilityFeatures',
    'schemaVersion',
    'session',
    'voteEventId',
  ].sort().join('|');

  let exact = 0;
  let reviewed = 0;
  let combined = 0;
  let overlap = 0;
  let addedRowsSeen = 0;
  let addedAligns = 0;
  let addedConflicts = 0;
  const memberships = new Set<string>();
  const events = new Set<string>();
  const addedKeySet = new Set(addedRowKeys);
  const addedReviewKeySet = new Set(addedReviewKeys);
  const sessions: Record<
    string,
    {
      rows: number;
      exactNonzeroRows: number;
      reviewedApplicabilityNonzeroRows: number;
      combinedNonzeroRows: number;
    }
  > = {};

  for (const row of rows) {
    const key = `${row.voteEventId}|${row.membershipId}`;
    if (Object.keys(row).sort().join('|') !== expectedKeys) {
      throw new Error(`row schema drifted ${key}`);
    }
    if (
      row.schemaVersion !== 'evidence-quality-historical-feature-matrix-v1.8'
      || row.features.length !== 12
      || row.reviewedApplicabilityFeatures.length !== 12
    ) {
      throw new Error(`row feature schema drifted ${key}`);
    }

    const hasExact = nonzero(row.features);
    const hasReviewed = nonzero(row.reviewedApplicabilityFeatures);
    if (hasExact) exact += 1;
    if (hasReviewed) reviewed += 1;
    if (hasExact || hasReviewed) {
      combined += 1;
      memberships.add(row.membershipId);
      events.add(row.voteEventId);
    }
    if (hasExact && hasReviewed) overlap += 1;

    if (addedKeySet.has(key)) {
      addedRowsSeen += 1;
      if (
        row.session !== '2025-2026'
        || row.chamber !== 'house'
        || hasExact
        || !hasReviewed
        || !row.reviewedApplicability
        || !addedReviewKeySet.has(
          String(row.reviewedApplicability.reviewKey),
        )
      ) {
        throw new Error(`Invalid v1.8 added row ${key}`);
      }
      if (
        row.reviewedApplicability.alignmentDirection
          === 'position_aligns_with_bill'
      ) {
        addedAligns += 1;
      } else if (
        row.reviewedApplicability.alignmentDirection
          === 'position_conflicts_with_bill'
      ) {
        addedConflicts += 1;
      } else {
        throw new Error(`Invalid v1.8 alignment direction ${key}`);
      }
    }

    const session = sessions[row.session] ?? {
      rows: 0,
      exactNonzeroRows: 0,
      reviewedApplicabilityNonzeroRows: 0,
      combinedNonzeroRows: 0,
    };
    session.rows += 1;
    if (hasExact) session.exactNonzeroRows += 1;
    if (hasReviewed) session.reviewedApplicabilityNonzeroRows += 1;
    if (hasExact || hasReviewed) session.combinedNonzeroRows += 1;
    sessions[row.session] = session;
  }

  const s21 = sessions['2021-2022'];
  const s23 = sessions['2023-2024'];
  const s25 = sessions['2025-2026'];
  if (
    exact !== 38
    || reviewed !== 54
    || combined !== 92
    || overlap !== 0
    || memberships.size !== 44
    || events.size !== 73
    || addedRowsSeen !== 48
    || addedAligns !== 47
    || addedConflicts !== 1
    || !s21
    || s21.rows !== 35510
    || s21.exactNonzeroRows !== 3
    || s21.reviewedApplicabilityNonzeroRows !== 6
    || s21.combinedNonzeroRows !== 9
    || !s23
    || s23.rows !== 49827
    || s23.exactNonzeroRows !== 32
    || s23.reviewedApplicabilityNonzeroRows !== 0
    || s23.combinedNonzeroRows !== 32
    || !s25
    || s25.rows !== 50120
    || s25.exactNonzeroRows !== 3
    || s25.reviewedApplicabilityNonzeroRows !== 48
    || s25.combinedNonzeroRows !== 51
  ) {
    throw new Error(
      `v1.8 coverage recomputation drifted: ${JSON.stringify({
        exact,
        reviewed,
        combined,
        overlap,
        memberships: memberships.size,
        events: events.size,
        addedRowsSeen,
        addedAligns,
        addedConflicts,
        sessions,
      })}`,
    );
  }

  const report = {
    schemaVersion: 'evidence-quality-historical-feature-coverage-v1.8',
    generatedAt: new Date().toISOString(),
    issue: ISSUE,
    summary: {
      targetRows: rows.length,
      exactNonzeroRows: exact,
      reviewedApplicabilityNonzeroRows: reviewed,
      combinedNonzeroRows: combined,
      netAddedRowsVsV17: 48,
      exactRowsChangedVsV17: 0,
      exactRowsRemovedVsV17: 0,
      overlapRows: overlap,
      membershipsWithCombinedDirectionalEvidence: memberships.size,
      eventsWithCombinedDirectionalEvidence: events.size,
      newMembershipsVsV17: 14,
      newEventsVsV17: 34,
    },
    bySession: sessions,
    training: {
      session: '2021-2022',
      targetRows: s21.rows,
      coveredRows: s21.combinedNonzeroRows,
      coverageRate: s21.combinedNonzeroRows / s21.rows,
    },
    evaluationContext: {
      session: '2025-2026',
      targetRows: s25.rows,
      coveredRows: s25.combinedNonzeroRows,
      coverageRate: s25.combinedNonzeroRows / s25.rows,
      netAddedRowsVsV17: 48,
    },
    review: {
      acceptedClaimEventPairs: 48,
      integrationRows: 48,
      publicMembers: 15,
      targetEvents: 34,
      bills: 24,
      aligns: addedAligns,
      conflicts: addedConflicts,
      ambiguousOrPendingRowsIncludedInMatrix: 0,
      addedReviewKeySha256: EXPECTED_REVIEW_KEY_SHA,
      addedRowKeySha256: EXPECTED_ADDED_ROW_KEY_SHA,
      claimProofSha256: EXPECTED_CLAIM_PROOF_SHA,
    },
    interpretation: {
      modelingReady: false,
      reason:
        'The v1.8 additions enrich the 2025-26 evaluation context, while the 2021-22 training session remains at nine strict directional rows; no model fitting is authorized.',
    },
    policy: {
      outcomeUse: 'none',
      targetVoteOutcomesRead: false,
      productionDatabaseQueried: false,
      productionWrites: false,
      vercelUsed: false,
      exactBillEvidenceChanged: false,
      previousReviewedApplicabilityChanged: false,
      pendingOrAmbiguousApplicabilityIncluded: false,
      modelFitting: 'none',
      servingChanged: false,
    },
  };

  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    resolve(outDir, OUTPUT),
    `${JSON.stringify(report, null, 2)}\n`,
  );

  console.log(JSON.stringify({
    historicalCoverageV18: report.summary,
    training: report.training,
    evaluationContext: report.evaluationContext,
    modelingReady: false,
  }, null, 2));
}

main();
