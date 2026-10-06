import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import {
  REVIEWED_APPLICABILITY_FEATURE_NAMES,
  reviewedApplicabilityFeatureVector,
} from '../src/evidence/historical-density-p2-canonical.js';
import { EVIDENCE_QUALITY_HISTORICAL_FEATURES } from '../src/evaluation/evidence-quality-historical-features.js';

const EXPECTED_ROWS = 135457;
const EXPECTED_EVENTS = 1339;
const EXPECTED_MEMBERSHIPS = 611;
const EXPECTED_ROW_KEY_SHA256 =
  '3aa47101f9e4a848e293fdaa89ef853919d49826b68ae90960370c5c19e9df72';
const EXPECTED_V15_CANONICAL_SHA256 =
  '75ce4f5c602bc7d8ed170a799e9e8c69f94b3e6aaaaea7ed2203bb8e6b1b6f64';
const EXPECTED_V15_GZIP_SHA256 =
  '24f39d9f97db10ae7f2308b844436902f7362dca5153cbc4081c0810ade534ac';
const ZERO_REVIEWED = Array(REVIEWED_APPLICABILITY_FEATURE_NAMES.length).fill(0);

type MatrixRowV15 = {
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
};

type ApplicableRow = {
  reviewKey: string;
  voteEventId: string;
  membershipId: string;
  memberName: string;
  claimId: string;
  sourceRows: number[];
  claimAvailableAt: string;
  memberStance: 'supports' | 'opposes';
  normalizedClaim: string;
  chamber: string;
  billId: string;
  identifier: string;
  occurredOn: string;
  issueFamily: string;
  alignmentDirection:
    | 'position_aligns_with_bill'
    | 'position_conflicts_with_bill';
  billPolicyDirection: string;
  versionTextSha256: string;
  versionUrl: string;
  versionPostedOn: string;
  claimFeatureMetadata: {
    claimType: string;
    explicitness: 'direct_quote' | 'document_position' | 'attributed_paraphrase';
    extractionConfidence: number;
  };
  contextOnly: boolean;
  mechanicallyActionable: boolean;
  modelWeight: number;
};

type CanonicalReview = {
  schemaVersion: string;
  issue: number;
  summary: {
    eligibleMemberEventRows: number;
    applicableRows: number;
    applicableReviewKeys: string[];
    finalStatusCounts: {
      applicable: number;
      ambiguous_fail_closed: number;
      pending_review: number;
      not_applicable: number;
    };
  };
  applicableRows: ApplicableRow[];
  policy: {
    outcomeUse: string;
    inputContainsVoteOutcomes: boolean;
    exactBillEvidenceSemanticsRemainSeparate: boolean;
    productionDatabaseQueried: boolean;
    productionWrites: boolean;
    vercelUsed: boolean;
    modelFitting: string;
    servingChanged: boolean;
  };
};

type V15Manifest = {
  schemaVersion: string;
  issue: number;
  annotationCorpus: Record<string, unknown>;
  targetUniverse: {
    rows: number;
    events: number;
    memberships: number;
    rowKeySha256: string;
    sourceArtifactId: number;
    sourceArtifactDigest: string;
    sourceMatrixCanonicalNdjsonSha256: string;
  };
  features: {
    names: string[];
    count: number;
    matrixRows: number;
    nonzeroRows: number;
    membershipsWithExactDirectionalEvidence: number;
    eventsWithExactDirectionalEvidence: number;
    bySession: Record<string, { rows: number; nonzeroRows: number }>;
  };
  signals: Record<string, unknown>;
  digests: {
    matrixCanonicalNdjsonSha256: string;
    matrixGzipSha256: string;
  };
  policy: {
    outcomeUseDuringFeatureConstruction: string;
    modelFitting: string;
    servingChanged: boolean;
  };
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function nonzero(vector: readonly number[]): boolean {
  return vector.some((value) => Number(value) !== 0);
}

function uniqueCount(values: readonly string[]): number {
  return new Set(values).size;
}

function featureDigest(
  rows: readonly { voteEventId: string; membershipId: string; features: number[] }[],
): string {
  return sha256(
    rows
      .map(
        (row) =>
          `${row.voteEventId}|${row.membershipId}|${JSON.stringify(row.features)}`,
      )
      .sort()
      .join('\n') + '\n',
  );
}

function main() {
  const reviewPath = requiredEnv('VOTEPREDICT_P2_CANONICAL_REVIEW_PATH');
  const matrixPath = requiredEnv('VOTEPREDICT_EQ_V15_MATRIX_PATH');
  const manifestPath = requiredEnv('VOTEPREDICT_EQ_V15_MANIFEST_PATH');
  const outputDir = requiredEnv('VOTEPREDICT_EQ_V16_OUTPUT_DIR');

  const review = JSON.parse(readFileSync(reviewPath, 'utf8')) as CanonicalReview;
  if (
    review.schemaVersion !== 'historical-density-p2-applicability-canonical-v1'
    || review.issue !== 718
    || review.summary.eligibleMemberEventRows !== 3923
    || review.summary.applicableRows !== 2
    || review.summary.finalStatusCounts.applicable !== 2
    || review.summary.finalStatusCounts.ambiguous_fail_closed !== 38
    || review.summary.finalStatusCounts.pending_review !== 21
    || review.summary.finalStatusCounts.not_applicable !== 3862
    || review.applicableRows.length !== 2
    || review.policy.outcomeUse !== 'none'
    || review.policy.inputContainsVoteOutcomes
    || !review.policy.exactBillEvidenceSemanticsRemainSeparate
    || review.policy.productionDatabaseQueried
    || review.policy.productionWrites
    || review.policy.vercelUsed
    || review.policy.modelFitting !== 'none'
    || review.policy.servingChanged
  ) {
    throw new Error('Canonical applicability review identity/policy drifted');
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as V15Manifest;
  if (
    manifest.schemaVersion !== 'evidence-quality-historical-feature-matrix-v1.5-manifest'
    || manifest.issue !== 718
    || manifest.targetUniverse.rows !== EXPECTED_ROWS
    || manifest.targetUniverse.events !== EXPECTED_EVENTS
    || manifest.targetUniverse.memberships !== EXPECTED_MEMBERSHIPS
    || manifest.targetUniverse.rowKeySha256 !== EXPECTED_ROW_KEY_SHA256
    || JSON.stringify(manifest.features.names)
      !== JSON.stringify([...EVIDENCE_QUALITY_HISTORICAL_FEATURES])
    || manifest.features.count !== EVIDENCE_QUALITY_HISTORICAL_FEATURES.length
    || manifest.features.matrixRows !== EXPECTED_ROWS
    || manifest.features.nonzeroRows !== 38
    || manifest.features.bySession['2021-2022']?.nonzeroRows !== 3
    || manifest.features.bySession['2023-2024']?.nonzeroRows !== 32
    || manifest.features.bySession['2025-2026']?.nonzeroRows !== 3
    || manifest.digests.matrixCanonicalNdjsonSha256 !== EXPECTED_V15_CANONICAL_SHA256
    || manifest.digests.matrixGzipSha256 !== EXPECTED_V15_GZIP_SHA256
    || manifest.policy.outcomeUseDuringFeatureConstruction !== 'none'
    || manifest.policy.modelFitting !== 'none'
    || manifest.policy.servingChanged
  ) {
    throw new Error('v1.5 baseline manifest drifted');
  }

  const sourceGzip = readFileSync(matrixPath);
  if (sha256(sourceGzip) !== EXPECTED_V15_GZIP_SHA256) {
    throw new Error('v1.5 matrix gzip digest mismatch');
  }
  const sourceText = gunzipSync(sourceGzip).toString('utf8');
  if (sha256(sourceText) !== EXPECTED_V15_CANONICAL_SHA256) {
    throw new Error('v1.5 matrix canonical digest mismatch');
  }

  const sourceRows = sourceText
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as MatrixRowV15);
  if (sourceRows.length !== EXPECTED_ROWS) throw new Error('v1.5 matrix row count drifted');

  const rowKeys = sourceRows
    .map((row) => `${row.voteEventId}|${row.membershipId}`)
    .sort();
  if (sha256(rowKeys.join('\n') + '\n') !== EXPECTED_ROW_KEY_SHA256) {
    throw new Error('v1.5 row-key digest drifted');
  }

  const exactFeatureDigestBefore = featureDigest(sourceRows);
  const applicableByKey = new Map<string, ApplicableRow>();
  for (const row of review.applicableRows) {
    const key = `${row.voteEventId}|${row.membershipId}`;
    if (applicableByKey.has(key)) throw new Error(`Duplicate applicable row ${key}`);
    if (
      row.contextOnly !== true
      || row.mechanicallyActionable !== false
      || row.modelWeight !== 0
      || !(row.claimAvailableAt < row.occurredOn)
      || !(row.versionPostedOn < row.occurredOn)
    ) {
      throw new Error(`Applicable row safety/chronology drifted: ${key}`);
    }
    applicableByKey.set(key, row);
  }

  const appliedKeys = new Set<string>();
  const outputRows = sourceRows.map((row) => {
    if (
      row.schemaVersion !== 'evidence-quality-historical-feature-matrix-v1.5'
      || row.features.length !== EVIDENCE_QUALITY_HISTORICAL_FEATURES.length
    ) {
      throw new Error('v1.5 matrix row schema drifted');
    }

    const key = `${row.voteEventId}|${row.membershipId}`;
    const applicable = applicableByKey.get(key);
    let reviewedApplicabilityFeatures = [...ZERO_REVIEWED];
    let reviewedApplicability = null as null | {
      reviewKey: string;
      claimId: string;
      issueFamily: string;
      alignmentDirection: string;
      billPolicyDirection: string;
      versionTextSha256: string;
      versionPostedOn: string;
    };

    if (applicable) {
      if (
        row.session !== '2021-2022'
        || row.billId !== applicable.billId
        || row.identifier !== applicable.identifier
        || row.occurredOn !== applicable.occurredOn
        || row.chamber !== applicable.chamber
      ) {
        throw new Error(`Applicable row identity does not match v1.5 target: ${key}`);
      }
      if (nonzero(row.features)) {
        throw new Error(`Reviewed applicability unexpectedly overlaps existing exact evidence: ${key}`);
      }

      reviewedApplicabilityFeatures = reviewedApplicabilityFeatureVector({
        alignmentDirection: applicable.alignmentDirection,
        explicitness: applicable.claimFeatureMetadata.explicitness,
        extractionConfidence: applicable.claimFeatureMetadata.extractionConfidence,
      });
      reviewedApplicability = {
        reviewKey: applicable.reviewKey,
        claimId: applicable.claimId,
        issueFamily: applicable.issueFamily,
        alignmentDirection: applicable.alignmentDirection,
        billPolicyDirection: applicable.billPolicyDirection,
        versionTextSha256: applicable.versionTextSha256,
        versionPostedOn: applicable.versionPostedOn,
      };
      appliedKeys.add(key);
    }

    return {
      ...row,
      schemaVersion: 'evidence-quality-historical-feature-matrix-v1.6',
      features: [...row.features],
      reviewedApplicabilityFeatures,
      reviewedApplicability,
    };
  });

  if (appliedKeys.size !== 2 || appliedKeys.size !== applicableByKey.size) {
    throw new Error(`Reviewed applicability application count drifted: ${appliedKeys.size}`);
  }

  const exactFeatureDigestAfter = featureDigest(outputRows);
  if (exactFeatureDigestAfter !== exactFeatureDigestBefore) {
    throw new Error('Exact-bill feature vectors changed while adding reviewed applicability');
  }

  const exactNonzeroRows = outputRows.filter((row) => nonzero(row.features));
  const applicabilityNonzeroRows = outputRows.filter((row) =>
    nonzero(row.reviewedApplicabilityFeatures),
  );
  const combinedNonzeroRows = outputRows.filter(
    (row) => nonzero(row.features) || nonzero(row.reviewedApplicabilityFeatures),
  );

  if (
    exactNonzeroRows.length !== 38
    || applicabilityNonzeroRows.length !== 2
    || combinedNonzeroRows.length !== 40
  ) {
    throw new Error(
      `Coverage count drifted exact=${exactNonzeroRows.length} applicability=${applicabilityNonzeroRows.length} combined=${combinedNonzeroRows.length}`,
    );
  }

  const sessions = ['2021-2022', '2023-2024', '2025-2026'];
  const bySession = Object.fromEntries(
    sessions.map((session) => {
      const rows = outputRows.filter((row) => row.session === session);
      return [
        session,
        {
          rows: rows.length,
          exactNonzeroRows: rows.filter((row) => nonzero(row.features)).length,
          reviewedApplicabilityNonzeroRows: rows.filter((row) =>
            nonzero(row.reviewedApplicabilityFeatures),
          ).length,
          combinedNonzeroRows: rows.filter(
            (row) =>
              nonzero(row.features) || nonzero(row.reviewedApplicabilityFeatures),
          ).length,
        },
      ];
    }),
  );

  if (
    bySession['2021-2022'].rows !== 35510
    || bySession['2021-2022'].exactNonzeroRows !== 3
    || bySession['2021-2022'].reviewedApplicabilityNonzeroRows !== 2
    || bySession['2021-2022'].combinedNonzeroRows !== 5
    || bySession['2023-2024'].combinedNonzeroRows !== 32
    || bySession['2025-2026'].combinedNonzeroRows !== 3
  ) {
    throw new Error(`Session coverage drifted: ${JSON.stringify(bySession)}`);
  }

  const outputText =
    outputRows.map((row) => JSON.stringify(row)).join('\n') + '\n';
  const outputGzip = gzipSync(Buffer.from(outputText), { level: 9 });

  const manifestV16 = {
    schemaVersion: 'evidence-quality-historical-feature-matrix-v1.6-manifest',
    generatedAt: new Date().toISOString(),
    issue: 718,
    baseline: {
      artifactId: 11380755983,
      artifactDigest:
        'sha256:fe2254fc9d2ed0ea00712feab384958e4942cf387e442c29515b3a75183692d7',
      matrixSchemaVersion: 'evidence-quality-historical-feature-matrix-v1.5',
      matrixCanonicalNdjsonSha256: EXPECTED_V15_CANONICAL_SHA256,
      matrixGzipSha256: EXPECTED_V15_GZIP_SHA256,
    },
    targetUniverse: manifest.targetUniverse,
    featureFamilies: {
      exactBill: {
        names: [...EVIDENCE_QUALITY_HISTORICAL_FEATURES],
        count: EVIDENCE_QUALITY_HISTORICAL_FEATURES.length,
        semanticsChangedFromV15: false,
        nonzeroRows: exactNonzeroRows.length,
        featureDigestBefore: exactFeatureDigestBefore,
        featureDigestAfter: exactFeatureDigestAfter,
      },
      reviewedApplicability: {
        names: [...REVIEWED_APPLICABILITY_FEATURE_NAMES],
        count: REVIEWED_APPLICABILITY_FEATURE_NAMES.length,
        nonzeroRows: applicabilityNonzeroRows.length,
        applicableReviewKeys: [...review.summary.applicableReviewKeys].sort(),
      },
    },
    coverage: {
      matrixRows: outputRows.length,
      exactNonzeroRows: exactNonzeroRows.length,
      reviewedApplicabilityNonzeroRows: applicabilityNonzeroRows.length,
      combinedNonzeroRows: combinedNonzeroRows.length,
      addedCombinedRowsVsV15: combinedNonzeroRows.length - exactNonzeroRows.length,
      removedExactRowsVsV15: 0,
      membershipsWithCombinedDirectionalEvidence: uniqueCount(
        combinedNonzeroRows.map((row) => row.membershipId),
      ),
      eventsWithCombinedDirectionalEvidence: uniqueCount(
        combinedNonzeroRows.map((row) => row.voteEventId),
      ),
      bySession,
    },
    applicabilityGate: {
      eligibleMemberEventRows: review.summary.eligibleMemberEventRows,
      finalStatusCounts: review.summary.finalStatusCounts,
      applicableRows: review.summary.applicableRows,
    },
    digests: {
      matrixCanonicalNdjsonSha256: sha256(outputText),
      matrixGzipSha256: sha256(outputGzip),
    },
    policy: {
      readOnly: true,
      outcomeUseDuringFeatureConstruction: 'none',
      strictPreEventAvailability: true,
      sameDayEvidenceExcluded: true,
      exactBillEvidenceSemanticsRemainSeparate: true,
      pendingOrAmbiguousApplicabilityIncluded: false,
      productionDatabaseQueried: false,
      productionWrites: false,
      vercelUsed: false,
      modelFitting: 'none',
      servingChanged: false,
      modelWeightChanged: false,
    },
  };

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(
    resolve(outputDir, 'evidence-quality-historical-feature-matrix-v1.6.ndjson.gz'),
    outputGzip,
  );
  writeFileSync(
    resolve(outputDir, 'evidence-quality-historical-feature-matrix-v1.6-manifest.json'),
    JSON.stringify(manifestV16, null, 2) + '\n',
    'utf8',
  );

  console.log(
    JSON.stringify(
      {
        evidenceQualityHistoricalFeatureMatrixV16: {
          rows: outputRows.length,
          exactNonzeroRows: exactNonzeroRows.length,
          reviewedApplicabilityNonzeroRows: applicabilityNonzeroRows.length,
          combinedNonzeroRows: combinedNonzeroRows.length,
          bySession,
          exactFeaturesChanged: false,
          outcomeUse: 'none',
          vercelUsed: false,
          servingChanged: false,
        },
      },
      null,
      2,
    ),
  );
}

main();
