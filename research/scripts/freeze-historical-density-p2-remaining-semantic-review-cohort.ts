import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const RECOVERY_SCHEMA = 'historical-density-p2-remaining-text-recovery-v1';
const COHORT_SCHEMA = 'historical-density-p2-remaining-semantic-review-cohort-v1';
const BATCH_ID = 'EQV1-HISTORICAL-DENSITY-P2-002';
const RECOVERY_RUN_ID = 37480601133;
const RECOVERY_ARTIFACT_ID = 11420533673;
const RECOVERY_ARTIFACT_DIGEST =
  'sha256:53b6d1631b021e58dc521ffcb62ae016b95731b99a6ca2c1dae5d89dab09d7c4';
const EXPECTED_DOCUMENTS = 40;
const EXPECTED_MEMBERSHIPS = 13;

type RecoveryRow = {
  sourceDocumentId: string;
  sourceDocumentIds: string[];
  sourceKind: string;
  sourceUrl: string;
  contentSha256: string;
  membershipId: string;
  availabilityDate: string;
  duplicateDocuments: number;
  hasTextSnapshot: boolean;
  hasAnnotation: boolean;
  priorSnapshotAttempt: boolean;
  potentialRows: number;
  potentialEvents: number;
  memberName: string;
  status: 'recovered';
  fetchedAt: string;
  normalizedText: string;
  normalizedTextSha256: string;
  textChars: number;
};

type Recovery = {
  schemaVersion: string;
  generatedAt: string;
  issue: number;
  frozenInputs: {
    inventoryArtifactId: number;
    inventoryArtifactDigest: string;
    candidateInputSha256: string;
    firstCohortArtifactId: number;
    firstCohortArtifactDigest: string;
    firstCohortIntegritySha256: string;
    freshRecoverableGroups: number;
    priorPilotSources: number;
    untouchedSources: number;
    untouchedMemberships: number;
  };
  result: {
    recoveredSources: number;
    recoveredMemberships: number;
    fetchFailures: number;
    hashMismatches: number;
    shortTexts: number;
    unresolvedSources: number;
    recovered: RecoveryRow[];
    failures: unknown[];
  };
  policy: {
    exactFrozenSourceUrlOnly: boolean;
    exactFrozenContentShaRequired: boolean;
    archiveDiscovery: boolean;
    currentMutableSubstitution: boolean;
    productionDatabaseQueried: boolean;
    productionWrites: boolean;
    sourceTextWrites: boolean;
    annotationWrites: boolean;
    candidateBillIdentifiers: unknown[];
    billInference: boolean;
    stanceInference: boolean;
    semanticInference: boolean;
    outcomeUse: string;
    modelFitting: string;
    servingChanged: boolean;
    vercelUsed: boolean;
  };
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function main() {
  const inputPath = requiredEnv('VOTEPREDICT_P2_REMAINING_RECOVERY_PATH');
  const outputPath = resolve(
    requiredEnv('VOTEPREDICT_P2_REMAINING_COHORT_OUTPUT_PATH'),
  );
  const recovery = JSON.parse(readFileSync(inputPath, 'utf8')) as Recovery;

  if (
    recovery.schemaVersion !== RECOVERY_SCHEMA
    || recovery.issue !== 718
    || recovery.frozenInputs.untouchedSources !== EXPECTED_DOCUMENTS
    || recovery.frozenInputs.untouchedMemberships !== EXPECTED_MEMBERSHIPS
    || recovery.result.recoveredSources !== EXPECTED_DOCUMENTS
    || recovery.result.recoveredMemberships !== EXPECTED_MEMBERSHIPS
    || recovery.result.fetchFailures !== 0
    || recovery.result.hashMismatches !== 0
    || recovery.result.shortTexts !== 0
    || recovery.result.unresolvedSources !== 0
    || recovery.result.recovered.length !== EXPECTED_DOCUMENTS
    || recovery.result.failures.length !== 0
    || !recovery.policy.exactFrozenSourceUrlOnly
    || !recovery.policy.exactFrozenContentShaRequired
    || recovery.policy.archiveDiscovery
    || recovery.policy.currentMutableSubstitution
    || recovery.policy.productionDatabaseQueried
    || recovery.policy.productionWrites
    || recovery.policy.sourceTextWrites
    || recovery.policy.annotationWrites
    || recovery.policy.billInference
    || recovery.policy.stanceInference
    || recovery.policy.semanticInference
    || recovery.policy.outcomeUse !== 'none'
    || recovery.policy.modelFitting !== 'none'
    || recovery.policy.servingChanged
    || recovery.policy.vercelUsed
  ) {
    throw new Error('Remaining P2 recovery identity/policy drifted');
  }

  const documents = recovery.result.recovered.map((row, index) => {
    if (
      row.status !== 'recovered'
      || !['wayback_member_primary', 'wayback_campaign_site'].includes(row.sourceKind)
      || !row.sourceUrl.startsWith('https://web.archive.org/web/')
      || !/^[a-f0-9]{64}$/i.test(row.contentSha256)
      || !/^[a-f0-9]{64}$/i.test(row.normalizedTextSha256)
      || !row.normalizedText.trim()
      || row.textChars < 40
      || !row.memberName.trim()
      || !row.membershipId
      || !row.availabilityDate
    ) {
      throw new Error(`Recovered row ${index + 1} is not safe for semantic review`);
    }
    const recalculatedTextSha = createHash('sha256')
      .update(row.normalizedText)
      .digest('hex');
    if (recalculatedTextSha !== row.normalizedTextSha256) {
      throw new Error(`Recovered row ${index + 1} normalized-text hash drifted`);
    }

    return {
      row: index + 1,
      priorityTier: 'P2_member_strong',
      sourceDocumentId: row.sourceDocumentId,
      sourceDocumentIds: row.sourceDocumentIds,
      sourceKind: row.sourceKind,
      sourceUrl: row.sourceUrl,
      sourceContentSha256: row.contentSha256,
      normalizedTextSha256: row.normalizedTextSha256,
      recoveredAt: row.fetchedAt,
      textChars: row.textChars,
      membershipId: row.membershipId,
      memberName: row.memberName,
      availableAt: row.availabilityDate,
      potential2021MemberEventRows: row.potentialRows,
      potential2021Events: row.potentialEvents,
      candidateMemberNames: [row.memberName],
      candidateBillIdentifiers: [] as string[],
      normalizedText: row.normalizedText,
    };
  });

  if (
    new Set(documents.map((row) => row.sourceDocumentId)).size
      !== EXPECTED_DOCUMENTS
    || new Set(documents.map((row) => row.membershipId)).size
      !== EXPECTED_MEMBERSHIPS
  ) {
    throw new Error('Remaining P2 cohort cardinality drifted');
  }
  if (documents.some((row) => row.candidateBillIdentifiers.length !== 0)) {
    throw new Error('Remaining P2 cohort illegally contains candidate bill ids');
  }

  const integritySha256 = createHash('sha256')
    .update(JSON.stringify(documents))
    .digest('hex');

  const cohort = {
    artifactVersion: COHORT_SCHEMA,
    batchId: BATCH_ID,
    issue: 718,
    sourceRecoveryRunId: RECOVERY_RUN_ID,
    sourceRecoveryArtifactId: RECOVERY_ARTIFACT_ID,
    sourceRecoveryArtifactDigest: RECOVERY_ARTIFACT_DIGEST,
    upstreamFrozenInputs: recovery.frozenInputs,
    documentsExpected: EXPECTED_DOCUMENTS,
    membershipsExpected: EXPECTED_MEMBERSHIPS,
    selectedDocuments: documents.length,
    integritySha256,
    documents,
    policy: {
      sourceTextStorage: 'artifact_only',
      productionDatabaseQueried: false,
      productionWrites: false,
      outcomeBlind: true,
      contextOnly: true,
      mechanicallyActionable: false,
      modelWeight: 0,
      billInferenceAllowed: false,
      candidateBillIdentifiersRequiredEmpty: true,
      targetMemberIdentityFrozen: true,
      semanticReviewScope:
        'member/issue positions only; no target-bill applicability may be inferred from this cohort',
      outcomesQueried: false,
      modelFitting: false,
      servingChanged: false,
      vercelUsed: false,
    },
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(cohort, null, 2) + '\n', 'utf8');

  console.log(
    JSON.stringify(
      {
        historicalDensityP2RemainingSemanticReviewCohort: {
          batchId: BATCH_ID,
          selectedDocuments: documents.length,
          memberships: new Set(documents.map((row) => row.membershipId)).size,
          candidateBillIdentifiers: 0,
          integritySha256,
          sourceTextStorage: 'artifact_only',
          productionDatabaseQueried: false,
          productionWrites: false,
          outcomeUse: 'none',
          vercelUsed: false,
          modelFitting: false,
          servingChanged: false,
        },
      },
      null,
      2,
    ),
  );
}

main();
