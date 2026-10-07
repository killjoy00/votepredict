import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  REVIEWED_APPLICABILITY_FEATURE_NAMES,
  reviewedApplicabilityFeatureVector,
} from '../src/evidence/historical-density-p2-canonical.js';

const ISSUE = 718;
const SESSION = '2025-2026';
const CHAMBER = 'house';

const EXPECTED_ROWS = 135457;
const EXPECTED_EVENTS = 1339;
const EXPECTED_MEMBERSHIPS = 611;
const EXPECTED_ROW_KEY_SHA =
  '3aa47101f9e4a848e293fdaa89ef853919d49826b68ae90960370c5c19e9df72';

const V17_ARTIFACT = {
  artifactId: 11436413885,
  artifactDigest:
    'sha256:fc1d77ccc51bc33f3e3f1c0dd6622c0f2a9797d62a8d54bcb65906de30228e44',
} as const;
const EXPECTED_V17_CANONICAL_SHA =
  'd681f257cdcded0d2cbebd68a93ea7edcab524863a68061a8059eca84963923a';
const EXPECTED_V17_GZIP_SHA =
  'cc99480e9437fff9a09d7947b4e8728f872822cc86cf00d8edb8ecb925650664';
const EXPECTED_EXACT_FEATURE_DIGEST =
  'd829a4991ba99a3f92fc4f6e1359f2a9429859382c6584a4232d6b38670188bc';
const EXPECTED_V17_REVIEWED_FEATURE_DIGEST =
  'f14418395d3e0ead718ea6862ae85adfc2779d5a3e4a02cb39a299f4313acd9c';

const READINESS_RUN_ID = 37646390780;
const READINESS_ARTIFACT = {
  artifactId: 11493988951,
  artifactDigest:
    'sha256:7bc236c9ac1a92ff3567a2673f96fd25c8658f17389e389489970e456234aaa2',
  sourceCommitSha: '03f5ce08ee4bdf9edf54c0027f3c57b66afe2eb3',
} as const;
const EXPECTED_APPLICABLE_PAIRS = 48;
const EXPECTED_PUBLIC_MEMBERS = 15;
const EXPECTED_TARGET_EVENTS = 34;
const EXPECTED_BILLS = 24;
const EXPECTED_ADDED_ROWS = 48;
const EXPECTED_REVIEW_KEY_SHA =
  'a2caa40ea956cf479bbe8a84b4b415207efdffa4429732b2a5128096fadd6ebc';
const EXPECTED_ADDED_ROW_KEY_SHA =
  'c06872dba335ae09c771ce6fc3a8d77c02f0d1b4adc4ce57ae51d0ad9a523e56';
const EXPECTED_CLAIM_PROOF_SHA =
  '1044159f2cf6292cb61e606b2086e4cb9e9a117f3b3e58175c43221c961a9f14';

const EXPECTED_V18_REVIEWED_FEATURE_DIGEST =
  '36bc247aba5bb0d888ffa32d9fc2173aa2552171d08e175e417c0b633f7a92a7';
const EXPECTED_V18_CANONICAL_SHA =
  '2d4ed4993fd7efce5a0c7de2a4331f1f3a0f163e323f437c6f9e7dacf266a30b';
const EXPECTED_V18_GZIP_SHA =
  '42f9d79bd69df63b46a2f0f5c1636f4cc7f8fd0ec0a65ae905d85f28fd436700';

const OUTPUT_MATRIX = 'evidence-quality-historical-feature-matrix-v1.8.ndjson.gz';
const OUTPUT_MANIFEST = 'evidence-quality-historical-feature-matrix-v1.8-manifest.json';

type Json = Record<string, any>;
type AlignmentDirection =
  | 'position_aligns_with_bill'
  | 'position_conflicts_with_bill';

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

type V17Manifest = {
  schemaVersion: string;
  issue: number;
  targetUniverse: {
    rows: number;
    events: number;
    memberships: number;
    rowKeySha256: string;
    [key: string]: unknown;
  };
  featureFamilies: {
    exactBill: {
      names: string[];
      nonzeroRows: number;
      featureDigestBefore: string;
      featureDigestAfter: string;
      [key: string]: unknown;
    };
    reviewedApplicability: {
      names: string[];
      nonzeroRows: number;
      [key: string]: unknown;
    };
  };
  coverage: {
    matrixRows: number;
    exactNonzeroRows: number;
    reviewedApplicabilityNonzeroRows: number;
    combinedNonzeroRows: number;
    overlapRows: number;
    membershipsWithCombinedDirectionalEvidence: number;
    eventsWithCombinedDirectionalEvidence: number;
    bySession: Record<
      string,
      {
        rows: number;
        exactNonzeroRows: number;
        reviewedApplicabilityNonzeroRows: number;
        combinedNonzeroRows: number;
      }
    >;
    [key: string]: unknown;
  };
  digests: {
    matrixCanonicalNdjsonSha256: string;
    matrixGzipSha256: string;
  };
  policy: Record<string, unknown>;
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

function rowKey(row: Pick<MatrixRow, 'voteEventId' | 'membershipId'>): string {
  return `${row.voteEventId}|${row.membershipId}`;
}

function vectorNonzero(values: readonly number[]): boolean {
  return values.some((value) => value !== 0);
}

function digestVectors(
  rows: readonly MatrixRow[],
  field: 'features' | 'reviewedApplicabilityFeatures',
): string {
  return sha256(
    `${rows
      .map((row) => `${rowKey(row)}|${JSON.stringify(row[field])}`)
      .sort()
      .join('\n')}\n`,
  );
}

function digestReviewedMetadata(rows: readonly MatrixRow[]): string {
  return sha256(
    `${rows
      .map((row) => `${rowKey(row)}|${JSON.stringify(row.reviewedApplicability)}`)
      .sort()
      .join('\n')}\n`,
  );
}

function coverage(rows: readonly MatrixRow[]) {
  const bySession: Record<
    string,
    {
      rows: number;
      exactNonzeroRows: number;
      reviewedApplicabilityNonzeroRows: number;
      combinedNonzeroRows: number;
    }
  > = {};
  const memberships = new Set<string>();
  const events = new Set<string>();
  let exact = 0;
  let reviewed = 0;
  let combined = 0;
  let overlap = 0;

  for (const row of rows) {
    const hasExact = vectorNonzero(row.features);
    const hasReviewed = vectorNonzero(row.reviewedApplicabilityFeatures);
    if (hasExact) exact += 1;
    if (hasReviewed) reviewed += 1;
    if (hasExact || hasReviewed) {
      combined += 1;
      memberships.add(row.membershipId);
      events.add(row.voteEventId);
    }
    if (hasExact && hasReviewed) overlap += 1;

    const session = bySession[row.session] ?? {
      rows: 0,
      exactNonzeroRows: 0,
      reviewedApplicabilityNonzeroRows: 0,
      combinedNonzeroRows: 0,
    };
    session.rows += 1;
    if (hasExact) session.exactNonzeroRows += 1;
    if (hasReviewed) session.reviewedApplicabilityNonzeroRows += 1;
    if (hasExact || hasReviewed) session.combinedNonzeroRows += 1;
    bySession[row.session] = session;
  }

  return {
    matrixRows: rows.length,
    exactNonzeroRows: exact,
    reviewedApplicabilityNonzeroRows: reviewed,
    combinedNonzeroRows: combined,
    overlapRows: overlap,
    membershipsWithCombinedDirectionalEvidence: memberships.size,
    eventsWithCombinedDirectionalEvidence: events.size,
    bySession,
  };
}

function main(): void {
  const v17Manifest = JSON.parse(
    readFileSync(env('VOTEPREDICT_EQ_V17_MANIFEST_PATH'), 'utf8'),
  ) as V17Manifest;
  const v17Gzip = readFileSync(env('VOTEPREDICT_EQ_V17_MATRIX_PATH'));
  const readiness = JSON.parse(
    readFileSync(env('VOTEPREDICT_2025_HOUSE_INTEGRATION_READINESS_PATH'), 'utf8'),
  ) as Json;
  const outDir = env('VOTEPREDICT_EQ_V18_OUTPUT_DIR');

  if (
    v17Manifest.schemaVersion
      !== 'evidence-quality-historical-feature-matrix-v1.7-manifest'
    || v17Manifest.issue !== ISSUE
    || v17Manifest.targetUniverse.rows !== EXPECTED_ROWS
    || v17Manifest.targetUniverse.events !== EXPECTED_EVENTS
    || v17Manifest.targetUniverse.memberships !== EXPECTED_MEMBERSHIPS
    || v17Manifest.targetUniverse.rowKeySha256 !== EXPECTED_ROW_KEY_SHA
    || v17Manifest.featureFamilies.exactBill.nonzeroRows !== 38
    || v17Manifest.featureFamilies.reviewedApplicability.nonzeroRows !== 6
    || v17Manifest.coverage.exactNonzeroRows !== 38
    || v17Manifest.coverage.reviewedApplicabilityNonzeroRows !== 6
    || v17Manifest.coverage.combinedNonzeroRows !== 44
    || v17Manifest.coverage.overlapRows !== 0
    || v17Manifest.coverage.membershipsWithCombinedDirectionalEvidence !== 30
    || v17Manifest.coverage.eventsWithCombinedDirectionalEvidence !== 39
    || v17Manifest.digests.matrixCanonicalNdjsonSha256
      !== EXPECTED_V17_CANONICAL_SHA
    || v17Manifest.digests.matrixGzipSha256 !== EXPECTED_V17_GZIP_SHA
    || sha256(v17Gzip) !== EXPECTED_V17_GZIP_SHA
    || v17Manifest.policy.outcomeUseDuringFeatureConstruction !== 'none'
    || v17Manifest.policy.previousReviewedApplicabilityPreserved !== true
    || v17Manifest.policy.pendingOrAmbiguousApplicabilityIncluded !== false
    || v17Manifest.policy.productionDatabaseQueried !== false
    || v17Manifest.policy.productionWrites !== false
    || v17Manifest.policy.vercelUsed !== false
    || v17Manifest.policy.modelFitting !== 'none'
    || v17Manifest.policy.servingChanged !== false
  ) {
    throw new Error('v1.7 baseline identity/policy drifted');
  }

  const canonical17 = gunzipSync(v17Gzip).toString('utf8');
  if (sha256(canonical17) !== EXPECTED_V17_CANONICAL_SHA) {
    throw new Error('v1.7 canonical digest drifted');
  }
  const rows = canonical17
    .trimEnd()
    .split('\n')
    .map((line) => JSON.parse(line) as MatrixRow);
  if (rows.length !== EXPECTED_ROWS) {
    throw new Error(`Expected ${EXPECTED_ROWS} v1.7 rows, got ${rows.length}`);
  }
  if (setSha(rows.map(rowKey)) !== EXPECTED_ROW_KEY_SHA) {
    throw new Error('v1.7 row-key digest drifted');
  }
  if (digestVectors(rows, 'features') !== EXPECTED_EXACT_FEATURE_DIGEST) {
    throw new Error('v1.7 exact feature digest drifted');
  }
  if (
    digestVectors(rows, 'reviewedApplicabilityFeatures')
      !== EXPECTED_V17_REVIEWED_FEATURE_DIGEST
  ) {
    throw new Error('v1.7 reviewed feature digest drifted');
  }

  if (
    readiness.schemaVersion
      !== 'historical-density-2025-house-applicability-integration-readiness-v1'
    || readiness.issue !== ISSUE
    || readiness.session !== SESSION
    || readiness.chamber !== CHAMBER
    || readiness.frozenInputs?.historicalFeatureMatrixV17?.artifactId
      !== V17_ARTIFACT.artifactId
    || readiness.frozenInputs?.historicalFeatureMatrixV17?.artifactDigest
      !== V17_ARTIFACT.artifactDigest
    || readiness.review?.applicableClaimEventPairs !== EXPECTED_APPLICABLE_PAIRS
    || readiness.review?.applicableReviewKeySha256 !== EXPECTED_REVIEW_KEY_SHA
    || readiness.review?.publicMembers !== EXPECTED_PUBLIC_MEMBERS
    || readiness.review?.targetEvents !== EXPECTED_TARGET_EVENTS
    || readiness.review?.bills !== EXPECTED_BILLS
    || readiness.identityResolution?.applicablePairsResolved
      !== EXPECTED_APPLICABLE_PAIRS
    || readiness.identityResolution?.applicablePairsUnresolved !== 0
    || readiness.identityResolution?.identityMapCoverageComplete !== true
    || readiness.matrixBoundary?.rows !== EXPECTED_ROWS
    || readiness.matrixBoundary?.existingExactDirectionalRows !== 38
    || readiness.matrixBoundary?.existingReviewedApplicabilityRows !== 6
    || readiness.matrixBoundary?.existingCombinedDirectionalRows !== 44
    || readiness.matrixBoundary?.existing2025CombinedDirectionalRows !== 3
    || readiness.matrixBoundary?.applicableRowsMissingFromMatrix !== 0
    || readiness.matrixBoundary?.applicableRowsWithIdentityMismatch !== 0
    || readiness.matrixBoundary?.overlapWithExistingExactDirectionalRows !== 0
    || readiness.matrixBoundary?.overlapWithExistingReviewedApplicabilityRows !== 0
    || readiness.integration?.applicableClaimEventPairs !== EXPECTED_APPLICABLE_PAIRS
    || readiness.integration?.uniqueMemberEventRows !== EXPECTED_ADDED_ROWS
    || readiness.integration?.duplicateClaimEventPairs !== 0
    || readiness.integration?.rowKeySha256 !== EXPECTED_ADDED_ROW_KEY_SHA
    || readiness.integration?.claimProofSha256 !== EXPECTED_CLAIM_PROOF_SHA
    || !Array.isArray(readiness.integration?.rows)
    || readiness.integration.rows.length !== EXPECTED_ADDED_ROWS
    || readiness.policy?.productionDatabaseQueried !== false
    || readiness.policy?.productionWrites !== false
    || readiness.policy?.vercelUsed !== false
    || readiness.policy?.targetVoteOutcomesRead !== false
    || readiness.policy?.semanticDecisionsUseOutcomes !== false
    || readiness.policy?.upstreamIdentityBridgeOutcomeUse !== 'identity_resolution_only'
    || readiness.policy?.strictPreEventAvailabilityRequired !== true
    || readiness.policy?.sameDayEvidenceExcluded !== true
    || readiness.policy?.internalIdentityRequiredAndResolved !== true
    || readiness.policy?.existingDirectionalRowsMayBeOverwritten !== false
    || readiness.policy?.modelFitting !== 'none'
    || readiness.policy?.servingChanged !== false
    || readiness.policy?.nextAuthorizedStep
      !== 'strict-additive-v1.8-overlay-only-after-this-readiness-artifact-is-pinned'
  ) {
    throw new Error('2025 House integration-readiness artifact drifted');
  }

  const addedRows = readiness.integration.rows as Json[];
  const addedRowKeys = addedRows.map((row) => String(row.rowKey));
  if (
    new Set(addedRowKeys).size !== EXPECTED_ADDED_ROWS
    || setSha(addedRowKeys) !== EXPECTED_ADDED_ROW_KEY_SHA
  ) {
    throw new Error('Readiness row-key proof drifted');
  }

  const allClaims = addedRows.flatMap((row) =>
    (row.claims as Json[]).map((claim) => ({ row, claim })));
  if (
    allClaims.length !== EXPECTED_APPLICABLE_PAIRS
    || setSha(allClaims.map(({ claim }) => String(claim.reviewKey)))
      !== EXPECTED_REVIEW_KEY_SHA
    || setSha(
      allClaims.map(({ row, claim }) =>
        [
          row.rowKey,
          row.legislatorId,
          claim.reviewKey,
          claim.lrlId,
          claim.claimAvailableAt,
          claim.memberStance,
          claim.billPolicyDirection,
          claim.alignmentDirection,
          claim.versionProof?.textSha256,
        ].join('|')),
    ) !== EXPECTED_CLAIM_PROOF_SHA
  ) {
    throw new Error('Readiness claim proof drifted');
  }

  const matrixByKey = new Map(rows.map((row) => [rowKey(row), row] as const));
  const newByKey = new Map<string, { row: Json; claim: Json }>();
  const publicMembers = new Set<string>();
  const targetEvents = new Set<string>();
  const bills = new Set<string>();

  for (const added of addedRows) {
    if (
      added.session !== SESSION
      || added.chamber !== CHAMBER
      || added.integrationReady !== true
      || added.contextOnly !== true
      || added.mechanicallyActionable !== false
      || added.modelWeight !== 0
      || !Array.isArray(added.claims)
      || added.claims.length !== 1
      || String(added.rowKey)
        !== `${String(added.voteEventId)}|${String(added.membershipId)}`
    ) {
      throw new Error(`Unsafe readiness row ${String(added.rowKey)}`);
    }

    const claim = added.claims[0] as Json;
    if (
      String(claim.lrlId) !== String(added.lrlId)
      || String(claim.publicMemberKey)
        !== `public-lrl:${SESSION}:${String(added.lrlId)}`
      || !['aligns', 'conflicts'].includes(String(claim.alignmentDirection))
      || !['direct_quote', 'document_position', 'attributed_paraphrase'].includes(
        String(claim.explicitness),
      )
      || !Number.isFinite(Number(claim.extractionConfidence))
      || Number(claim.extractionConfidence) < 0
      || Number(claim.extractionConfidence) > 1
      || !(String(claim.claimAvailableAt) < String(added.occurredOn))
      || !(String(claim.versionProof?.postedOn) < String(added.occurredOn))
      || String(claim.reviewKey).split('|').at(-1)
        !== String(claim.versionProof?.textSha256)
    ) {
      throw new Error(`Unsafe readiness claim ${String(claim.reviewKey)}`);
    }

    const key = String(added.rowKey);
    const baseline = matrixByKey.get(key);
    if (!baseline) throw new Error(`Readiness row missing from v1.7: ${key}`);
    if (
      baseline.voteEventId !== String(added.voteEventId)
      || baseline.membershipId !== String(added.membershipId)
      || baseline.legislatorId !== String(added.legislatorId)
      || baseline.billId !== String(added.billId)
      || baseline.identifier !== String(added.identifier)
      || baseline.occurredOn !== String(added.occurredOn)
      || baseline.session !== SESSION
      || baseline.chamber !== CHAMBER
    ) {
      throw new Error(`Readiness/v1.7 identity mismatch: ${key}`);
    }
    if (
      vectorNonzero(baseline.features)
      || vectorNonzero(baseline.reviewedApplicabilityFeatures)
      || baseline.reviewedApplicability !== null
    ) {
      throw new Error(`v1.8 addition overlaps prior evidence: ${key}`);
    }
    if (newByKey.has(key)) throw new Error(`Duplicate readiness row: ${key}`);
    newByKey.set(key, { row: added, claim });
    publicMembers.add(String(added.lrlId));
    targetEvents.add(String(added.voteEventId));
    bills.add(String(added.billId));
  }

  if (
    newByKey.size !== EXPECTED_ADDED_ROWS
    || publicMembers.size !== EXPECTED_PUBLIC_MEMBERS
    || targetEvents.size !== EXPECTED_TARGET_EVENTS
    || bills.size !== EXPECTED_BILLS
  ) {
    throw new Error('v1.8 readiness cardinality drifted');
  }

  const exactBefore = digestVectors(rows, 'features');
  const reviewedBefore = digestVectors(rows, 'reviewedApplicabilityFeatures');
  const untouchedReviewedMetadataBefore = digestReviewedMetadata(
    rows.filter((row) => !newByKey.has(rowKey(row))),
  );

  const touched = new Set<string>();
  const outRows = rows.map((row): MatrixRow => {
    const added = newByKey.get(rowKey(row));
    if (!added) {
      return {
        ...row,
        schemaVersion: 'evidence-quality-historical-feature-matrix-v1.8',
      };
    }

    const { claim } = added;
    const alignmentDirection: AlignmentDirection =
      claim.alignmentDirection === 'aligns'
        ? 'position_aligns_with_bill'
        : 'position_conflicts_with_bill';
    touched.add(rowKey(row));

    return {
      ...row,
      schemaVersion: 'evidence-quality-historical-feature-matrix-v1.8',
      reviewedApplicabilityFeatures: reviewedApplicabilityFeatureVector({
        alignmentDirection,
        explicitness: claim.explicitness,
        extractionConfidence: Number(claim.extractionConfidence),
      }),
      reviewedApplicability: {
        reviewKey: String(claim.reviewKey),
        claimId: String(claim.semanticKey),
        issueFamily: String(claim.semanticKey),
        semanticKey: String(claim.semanticKey),
        alignmentDirection,
        billPolicyDirection: String(claim.billPolicyDirection),
        versionTextSha256: String(claim.versionProof.textSha256),
        versionPostedOn: String(claim.versionProof.postedOn),
      },
    };
  });

  if (touched.size !== EXPECTED_ADDED_ROWS) {
    throw new Error(`Expected ${EXPECTED_ADDED_ROWS} overlaid rows, got ${touched.size}`);
  }
  if (
    digestVectors(outRows, 'features') !== exactBefore
    || exactBefore !== EXPECTED_EXACT_FEATURE_DIGEST
  ) {
    throw new Error('Exact-bill feature vectors changed');
  }
  if (
    digestReviewedMetadata(
      outRows.filter((row) => !newByKey.has(rowKey(row))),
    ) !== untouchedReviewedMetadataBefore
  ) {
    throw new Error('Prior reviewed-applicability metadata changed');
  }
  const reviewedAfter = digestVectors(
    outRows,
    'reviewedApplicabilityFeatures',
  );
  if (
    reviewedBefore !== EXPECTED_V17_REVIEWED_FEATURE_DIGEST
    || reviewedAfter !== EXPECTED_V18_REVIEWED_FEATURE_DIGEST
  ) {
    throw new Error('Reviewed-applicability feature digest drifted');
  }

  const cov = coverage(outRows);
  const s21 = cov.bySession['2021-2022'];
  const s23 = cov.bySession['2023-2024'];
  const s25 = cov.bySession[SESSION];
  if (
    cov.matrixRows !== EXPECTED_ROWS
    || cov.exactNonzeroRows !== 38
    || cov.reviewedApplicabilityNonzeroRows !== 54
    || cov.combinedNonzeroRows !== 92
    || cov.overlapRows !== 0
    || cov.membershipsWithCombinedDirectionalEvidence !== 44
    || cov.eventsWithCombinedDirectionalEvidence !== 73
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
    throw new Error(`v1.8 coverage drifted: ${JSON.stringify(cov)}`);
  }

  const canonical18 = `${outRows.map((row) => JSON.stringify(row)).join('\n')}\n`;
  const gzip18 = gzipSync(Buffer.from(canonical18));
  if (
    sha256(canonical18) !== EXPECTED_V18_CANONICAL_SHA
    || sha256(gzip18) !== EXPECTED_V18_GZIP_SHA
  ) {
    throw new Error('Pinned v1.8 matrix digest drifted');
  }

  const addedReviewKeys = allClaims
    .map(({ claim }) => String(claim.reviewKey))
    .sort();
  const sortedAddedRowKeys = [...newByKey.keys()].sort();

  const manifest = {
    schemaVersion: 'evidence-quality-historical-feature-matrix-v1.8-manifest',
    generatedAt: new Date().toISOString(),
    issue: ISSUE,
    baseline: {
      artifactId: V17_ARTIFACT.artifactId,
      artifactDigest: V17_ARTIFACT.artifactDigest,
      matrixSchemaVersion: 'evidence-quality-historical-feature-matrix-v1.7',
      matrixCanonicalNdjsonSha256: EXPECTED_V17_CANONICAL_SHA,
      matrixGzipSha256: EXPECTED_V17_GZIP_SHA,
    },
    overlaySource: {
      runId: READINESS_RUN_ID,
      artifactId: READINESS_ARTIFACT.artifactId,
      artifactDigest: READINESS_ARTIFACT.artifactDigest,
      sourceCommitSha: READINESS_ARTIFACT.sourceCommitSha,
      schemaVersion:
        'historical-density-2025-house-applicability-integration-readiness-v1',
      applicableClaimEventPairs: EXPECTED_APPLICABLE_PAIRS,
      uniqueMemberEventRows: EXPECTED_ADDED_ROWS,
      publicMembers: EXPECTED_PUBLIC_MEMBERS,
      targetEvents: EXPECTED_TARGET_EVENTS,
      bills: EXPECTED_BILLS,
      applicableReviewKeySha256: EXPECTED_REVIEW_KEY_SHA,
      rowKeySha256: EXPECTED_ADDED_ROW_KEY_SHA,
      claimProofSha256: EXPECTED_CLAIM_PROOF_SHA,
    },
    targetUniverse: v17Manifest.targetUniverse,
    featureFamilies: {
      exactBill: {
        ...v17Manifest.featureFamilies.exactBill,
        semanticsChangedFromV17: false,
        nonzeroRows: 38,
        featureDigestBefore: exactBefore,
        featureDigestAfter: digestVectors(outRows, 'features'),
      },
      reviewedApplicability: {
        names: [...REVIEWED_APPLICABILITY_FEATURE_NAMES],
        count: REVIEWED_APPLICABILITY_FEATURE_NAMES.length,
        nonzeroRows: 54,
        previousNonzeroRows: 6,
        netAddedRows: EXPECTED_ADDED_ROWS,
        previousFeatureDigest: reviewedBefore,
        featureDigestAfter: reviewedAfter,
        addedReviewKeys,
        addedRowKeys: sortedAddedRowKeys,
        addedReviewKeySha256: EXPECTED_REVIEW_KEY_SHA,
        addedRowKeySha256: EXPECTED_ADDED_ROW_KEY_SHA,
        addedClaimProofSha256: EXPECTED_CLAIM_PROOF_SHA,
      },
    },
    coverage: {
      ...cov,
      netAddedCombinedRowsVsV17: EXPECTED_ADDED_ROWS,
      exactRowsChangedVsV17: 0,
      reviewedApplicabilityRowsChangedOutsideAdditions: 0,
      newMembershipsWithCombinedDirectionalEvidenceVsV17: 14,
      newEventsWithCombinedDirectionalEvidenceVsV17: 34,
    },
    applicabilityGate: {
      acceptedClaimEventPairs: EXPECTED_APPLICABLE_PAIRS,
      integrationRows: EXPECTED_ADDED_ROWS,
      publicMembers: EXPECTED_PUBLIC_MEMBERS,
      targetEvents: EXPECTED_TARGET_EVENTS,
      bills: EXPECTED_BILLS,
      alignmentCounts: {
        aligns: 47,
        conflicts: 1,
      },
      addedReviewKeySha256: EXPECTED_REVIEW_KEY_SHA,
      addedRowKeySha256: EXPECTED_ADDED_ROW_KEY_SHA,
      claimProofSha256: EXPECTED_CLAIM_PROOF_SHA,
    },
    digests: {
      matrixCanonicalNdjsonSha256: sha256(canonical18),
      matrixGzipSha256: sha256(gzip18),
    },
    policy: {
      readOnly: true,
      outcomeUseDuringFeatureConstruction: 'none',
      targetVoteOutcomesRead: false,
      semanticDecisionsUseOutcomes: false,
      upstreamIdentityBridgeOutcomeUse: 'identity_resolution_only',
      strictPreEventAvailability: true,
      sameDayEvidenceExcluded: true,
      exactBillEvidenceSemanticsRemainSeparate: true,
      previousReviewedApplicabilityPreserved: true,
      pendingOrAmbiguousApplicabilityIncluded: false,
      existingDirectionalRowsOverwritten: false,
      productionDatabaseQueried: false,
      productionWrites: false,
      vercelUsed: false,
      modelFitting: 'none',
      servingChanged: false,
      modelWeightChanged: false,
    },
  };

  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, OUTPUT_MATRIX), gzip18);
  writeFileSync(
    resolve(outDir, OUTPUT_MANIFEST),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  console.log(JSON.stringify({
    historicalFeatureMatrixV18: {
      coverage: cov,
      netAddedRows: EXPECTED_ADDED_ROWS,
      newMemberships: 14,
      newEvents: 34,
      exactRowsChanged: 0,
      addedReviewKeySha256: EXPECTED_REVIEW_KEY_SHA,
      addedRowKeySha256: EXPECTED_ADDED_ROW_KEY_SHA,
      claimProofSha256: EXPECTED_CLAIM_PROOF_SHA,
      reviewedFeatureDigest: reviewedAfter,
      matrixCanonicalNdjsonSha256: sha256(canonical18),
      matrixGzipSha256: sha256(gzip18),
      outcomeUse: 'none',
      vercelUsed: false,
      modelFitting: 'none',
    },
  }, null, 2));
}

main();
