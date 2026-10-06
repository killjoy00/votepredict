import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';

const EXPECTED_ROWS = 135457;
const EXPECTED_ROW_KEY_SHA256 =
  '3aa47101f9e4a848e293fdaa89ef853919d49826b68ae90960370c5c19e9df72';

type V16Row = {
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
  reviewedApplicability: null | {
    reviewKey: string;
    claimId: string;
    issueFamily: string;
    alignmentDirection: string;
    billPolicyDirection: string;
    versionTextSha256: string;
    versionPostedOn: string;
  };
};

type V16Manifest = {
  schemaVersion: string;
  issue: number;
  targetUniverse: {
    rows: number;
    events: number;
    memberships: number;
    rowKeySha256: string;
  };
  featureFamilies: {
    exactBill: {
      nonzeroRows: number;
      semanticsChangedFromV15: boolean;
      featureDigestBefore: string;
      featureDigestAfter: string;
    };
    reviewedApplicability: {
      nonzeroRows: number;
      applicableReviewKeys: string[];
    };
  };
  coverage: {
    matrixRows: number;
    exactNonzeroRows: number;
    reviewedApplicabilityNonzeroRows: number;
    combinedNonzeroRows: number;
    addedCombinedRowsVsV15: number;
    removedExactRowsVsV15: number;
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
  };
  applicabilityGate: {
    eligibleMemberEventRows: number;
    finalStatusCounts: Record<string, number>;
    applicableRows: number;
  };
  digests: {
    matrixCanonicalNdjsonSha256: string;
    matrixGzipSha256: string;
  };
  policy: {
    outcomeUseDuringFeatureConstruction: string;
    exactBillEvidenceSemanticsRemainSeparate: boolean;
    pendingOrAmbiguousApplicabilityIncluded: boolean;
    productionDatabaseQueried: boolean;
    productionWrites: boolean;
    vercelUsed: boolean;
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

function nonzero(values: readonly number[]): boolean {
  return values.some((value) => Number(value) !== 0);
}

function pct(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function main() {
  const matrixPath = requiredEnv('VOTEPREDICT_EQ_V16_MATRIX_PATH');
  const manifestPath = requiredEnv('VOTEPREDICT_EQ_V16_MANIFEST_PATH');
  const outputDir = requiredEnv('VOTEPREDICT_EQ_V16_COVERAGE_OUTPUT_DIR');

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as V16Manifest;
  if (
    manifest.schemaVersion !== 'evidence-quality-historical-feature-matrix-v1.6-manifest'
    || manifest.issue !== 718
    || manifest.targetUniverse.rows !== EXPECTED_ROWS
    || manifest.targetUniverse.rowKeySha256 !== EXPECTED_ROW_KEY_SHA256
    || manifest.featureFamilies.exactBill.nonzeroRows !== 38
    || manifest.featureFamilies.exactBill.semanticsChangedFromV15
    || manifest.featureFamilies.exactBill.featureDigestBefore
      !== manifest.featureFamilies.exactBill.featureDigestAfter
    || manifest.featureFamilies.reviewedApplicability.nonzeroRows !== 2
    || manifest.coverage.exactNonzeroRows !== 38
    || manifest.coverage.reviewedApplicabilityNonzeroRows !== 2
    || manifest.coverage.combinedNonzeroRows !== 40
    || manifest.coverage.addedCombinedRowsVsV15 !== 2
    || manifest.coverage.removedExactRowsVsV15 !== 0
    || manifest.applicabilityGate.applicableRows !== 2
    || manifest.applicabilityGate.finalStatusCounts.applicable !== 2
    || manifest.applicabilityGate.finalStatusCounts.ambiguous_fail_closed !== 40
    || manifest.applicabilityGate.finalStatusCounts.pending_review !== 0
    || manifest.applicabilityGate.finalStatusCounts.not_applicable !== 3881
    || manifest.policy.outcomeUseDuringFeatureConstruction !== 'none'
    || !manifest.policy.exactBillEvidenceSemanticsRemainSeparate
    || manifest.policy.pendingOrAmbiguousApplicabilityIncluded
    || manifest.policy.productionDatabaseQueried
    || manifest.policy.productionWrites
    || manifest.policy.vercelUsed
    || manifest.policy.modelFitting !== 'none'
    || manifest.policy.servingChanged
  ) {
    throw new Error('v1.6 manifest coverage/policy drifted');
  }

  const gzip = readFileSync(matrixPath);
  if (sha256(gzip) !== manifest.digests.matrixGzipSha256) {
    throw new Error('v1.6 matrix gzip digest mismatch');
  }
  const text = gunzipSync(gzip).toString('utf8');
  if (sha256(text) !== manifest.digests.matrixCanonicalNdjsonSha256) {
    throw new Error('v1.6 matrix canonical digest mismatch');
  }

  const rows = text
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as V16Row);
  if (rows.length !== EXPECTED_ROWS) throw new Error('v1.6 matrix row count drifted');

  const rowKeys = rows
    .map((row) => `${row.voteEventId}|${row.membershipId}`)
    .sort();
  if (sha256(rowKeys.join('\n') + '\n') !== EXPECTED_ROW_KEY_SHA256) {
    throw new Error('v1.6 row-key digest drifted');
  }

  for (const row of rows) {
    const keys = Object.keys(row).sort();
    const expected = [
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
    ].sort();
    if (JSON.stringify(keys) !== JSON.stringify(expected)) {
      throw new Error(`v1.6 matrix row schema drifted: ${keys.join(',')}`);
    }
    if (
      row.schemaVersion !== 'evidence-quality-historical-feature-matrix-v1.6'
      || row.features.length !== 12
      || row.reviewedApplicabilityFeatures.length !== 12
    ) {
      throw new Error('v1.6 matrix vector/schema drifted');
    }
    if (nonzero(row.reviewedApplicabilityFeatures) !== Boolean(row.reviewedApplicability)) {
      throw new Error(`Reviewed applicability provenance/vector mismatch for ${row.voteEventId}|${row.membershipId}`);
    }
  }

  const exactRows = rows.filter((row) => nonzero(row.features));
  const applicabilityRows = rows.filter((row) =>
    nonzero(row.reviewedApplicabilityFeatures),
  );
  const combinedRows = rows.filter(
    (row) => nonzero(row.features) || nonzero(row.reviewedApplicabilityFeatures),
  );
  const overlappingRows = rows.filter(
    (row) => nonzero(row.features) && nonzero(row.reviewedApplicabilityFeatures),
  );

  if (
    exactRows.length !== 38
    || applicabilityRows.length !== 2
    || combinedRows.length !== 40
    || overlappingRows.length !== 0
  ) {
    throw new Error('v1.6 realized matrix coverage drifted');
  }

  const trainingRows = rows.filter((row) => row.session === '2021-2022');
  const trainingExact = trainingRows.filter((row) => nonzero(row.features));
  const trainingApplicability = trainingRows.filter((row) =>
    nonzero(row.reviewedApplicabilityFeatures),
  );
  const trainingCombined = trainingRows.filter(
    (row) => nonzero(row.features) || nonzero(row.reviewedApplicabilityFeatures),
  );
  if (
    trainingRows.length !== 35510
    || trainingExact.length !== 3
    || trainingApplicability.length !== 2
    || trainingCombined.length !== 5
  ) {
    throw new Error('2021-22 realized training coverage drifted');
  }

  const accepted = applicabilityRows
    .map((row) => ({
      voteEventId: row.voteEventId,
      membershipId: row.membershipId,
      occurredOn: row.occurredOn,
      billId: row.billId,
      identifier: row.identifier,
      reviewKey: row.reviewedApplicability!.reviewKey,
      claimId: row.reviewedApplicability!.claimId,
      alignmentDirection: row.reviewedApplicability!.alignmentDirection,
      billPolicyDirection: row.reviewedApplicability!.billPolicyDirection,
      versionTextSha256: row.reviewedApplicability!.versionTextSha256,
      reviewedApplicabilityFeatures: row.reviewedApplicabilityFeatures,
    }))
    .sort((a, b) => a.reviewKey.localeCompare(b.reviewKey));

  const report = {
    schemaVersion: 'evidence-quality-historical-feature-coverage-v1.6',
    generatedAt: new Date().toISOString(),
    issue: 718,
    summary: {
      targetRows: rows.length,
      exactNonzeroRows: exactRows.length,
      reviewedApplicabilityNonzeroRows: applicabilityRows.length,
      combinedNonzeroRows: combinedRows.length,
      netAddedCombinedRowsVsV15: combinedRows.length - exactRows.length,
      exactRowsChangedFromV15: 0,
      exactRowsRemovedFromV15: 0,
      applicabilityOverlapWithExactRows: overlappingRows.length,
    },
    training2021_2022: {
      rows: trainingRows.length,
      exactNonzeroRowsV15: trainingExact.length,
      reviewedApplicabilityRowsAdded: trainingApplicability.length,
      combinedNonzeroRowsV16: trainingCombined.length,
      exactCoverageRateV15: pct(trainingExact.length, trainingRows.length),
      combinedCoverageRateV16: pct(trainingCombined.length, trainingRows.length),
      relativeRowIncrease: trainingCombined.length / trainingExact.length - 1,
    },
    acceptedReviewedApplicabilityRows: accepted,
    unresolvedApplicability: {
      ambiguousFailClosedRows:
        manifest.applicabilityGate.finalStatusCounts.ambiguous_fail_closed,
      pendingReviewRows: manifest.applicabilityGate.finalStatusCounts.pending_review,
      includedInMatrix: 0,
    },
    interpretation: {
      result: 'strictly_additive_small_training_coverage_gain',
      modelingReady: false,
      recommendation:
        'Preserve the v1.6 freeze and continue evidence/review work; do not fit or tune model weights from only two added training rows.',
    },
    policy: {
      outcomeUse: 'none',
      productionDatabaseQueried: false,
      productionWrites: false,
      vercelUsed: false,
      exactBillSemanticsChanged: false,
      pendingOrAmbiguousApplicabilityIncluded: false,
      modelFitting: 'none',
      servingChanged: false,
    },
  };

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(
    resolve(outputDir, 'evidence-quality-historical-feature-coverage-v1.6.json'),
    JSON.stringify(report, null, 2) + '\n',
    'utf8',
  );

  console.log(
    JSON.stringify(
      {
        evidenceQualityHistoricalFeatureCoverageV16: {
          exactNonzeroRows: exactRows.length,
          reviewedApplicabilityNonzeroRows: applicabilityRows.length,
          combinedNonzeroRows: combinedRows.length,
          training2021_2022: report.training2021_2022,
          acceptedReviewKeys: accepted.map((row) => row.reviewKey),
          outcomeUse: 'none',
          vercelUsed: false,
          modelFitting: 'none',
          servingChanged: false,
        },
      },
      null,
      2,
    ),
  );
}

main();
