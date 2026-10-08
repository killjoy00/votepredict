import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const MANIFEST_SCHEMA =
  'historical-density-2025-house-semantic-cohort-2-aggregate-manifest-v1';
const OUTPUT_SCHEMA =
  'historical-density-2025-house-semantic-review-cohort-2-aggregate-v1';
const SESSION = '2025-2026';
const SOURCE_COHORT_RUN_ID = 37718561841;
const SOURCE_COHORT_ARTIFACT_ID = 11525006690;
const SOURCE_COHORT_DIGEST =
  'sha256:384e0f7856b051f621af0f9f7f55ec517068d093100d47edb12746911410d17c';
const SOURCE_SELECTION_SHA =
  '6364b5c9f86ec6e4cbf4ddd9398ce962f376342c36d5e501bb65884018672a05';

type Json = Record<string, any>;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function readJson(path: string): Json {
  return JSON.parse(readFileSync(path, 'utf8')) as Json;
}

function main(): void {
  const manifest = readJson(
    requiredEnv('VOTEPREDICT_2025_HOUSE_SEMANTIC_COHORT_2_AGGREGATE_MANIFEST_PATH'),
  );
  const output = resolve(
    requiredEnv('VOTEPREDICT_2025_HOUSE_SEMANTIC_COHORT_2_AGGREGATE_OUTPUT'),
  );

  if (
    manifest.schemaVersion !== MANIFEST_SCHEMA
    || manifest.issue !== 718
    || manifest.session !== SESSION
    || manifest.frozenSourceCohort?.runId !== SOURCE_COHORT_RUN_ID
    || manifest.frozenSourceCohort?.artifactId !== SOURCE_COHORT_ARTIFACT_ID
    || manifest.frozenSourceCohort?.digest !== SOURCE_COHORT_DIGEST
    || manifest.frozenSourceCohort?.selectionKeySha256 !== SOURCE_SELECTION_SHA
    || manifest.tranches?.length !== 5
    || manifest.expectedAggregate?.documents !== 50
    || manifest.expectedAggregate?.directionalDocuments !== 42
    || manifest.expectedAggregate?.nonDirectionalDocuments !== 8
    || manifest.expectedAggregate?.uniqueSemanticGroups !== 42
    || manifest.expectedAggregate?.novelSemanticGroups !== 42
    || manifest.expectedAggregate?.crossBatchDuplicateSemanticGroups !== 0
    || manifest.expectedAggregate?.candidateBillIdentifiers !== 0
    || manifest.expectedAggregate?.internalMembershipIdentitiesResolved !== 0
    || manifest.policy?.outcomeUse !== 'none'
    || manifest.policy?.targetBillApplicabilityInferred
    || manifest.policy?.billInference
    || !manifest.policy?.contextOnly
    || manifest.policy?.mechanicallyActionable
    || manifest.policy?.modelWeight !== 0
    || manifest.policy?.productionDatabaseQueried
    || manifest.policy?.productionWrites
    || manifest.policy?.vercelUsed
    || manifest.policy?.featureRowsWritten
    || manifest.policy?.modelFitting !== 'none'
    || manifest.policy?.servingChanged
  ) {
    throw new Error('Cohort-2 aggregate manifest identity/policy drifted');
  }

  const documentReviews: Json[] = [];
  const semanticGroups: Json[] = [];
  const trancheSources: Json[] = [];

  for (const source of manifest.tranches as Json[]) {
    const envName =
      `VOTEPREDICT_2025_HOUSE_SEMANTIC_COHORT_2_T${source.tranche}_PATH`;
    const tranche = readJson(requiredEnv(envName));
    const expectedBatch =
      `EQV1-HISTORICAL-DENSITY-2025-HOUSE-002-T0${source.tranche}`;

    if (
      tranche.schemaVersion !== source.outputSchema
      || tranche.batchId !== expectedBatch
      || tranche.issue !== 718
      || tranche.session !== SESSION
      || tranche.reviewedRows?.[0] !== source.rowStart
      || tranche.reviewedRows?.[1] !== source.rowEnd
      || tranche.summary?.documents !== 10
      || tranche.summary?.directionalDocuments !== source.directionalDocuments
      || tranche.summary?.nonDirectionalDocuments !== source.nonDirectionalDocuments
      || tranche.summary?.uniqueSemanticGroups !== source.semanticGroups
      || tranche.summary?.novelSemanticGroups !== source.semanticGroups
      || tranche.summary?.crossBatchDuplicateSemanticGroups !== 0
      || tranche.summary?.candidateBillIdentifiers !== 0
      || tranche.summary?.internalMembershipIdentitiesResolved !== 0
      || tranche.documentReviews?.length !== 10
      || tranche.semanticGroups?.length !== source.semanticGroups
      || tranche.contentSha256WithoutSelfField !== source.outputContentSha256
      || tranche.frozenCohort?.runId !== SOURCE_COHORT_RUN_ID
      || tranche.frozenCohort?.artifactId !== SOURCE_COHORT_ARTIFACT_ID
      || tranche.frozenCohort?.digest !== SOURCE_COHORT_DIGEST
      || tranche.frozenCohort?.selectionKeySha256 !== SOURCE_SELECTION_SHA
      || tranche.policy?.outcomeUse !== 'none'
      || tranche.policy?.billInference
      || tranche.policy?.targetBillApplicabilityInferred
      || tranche.policy?.internalMembershipIdentityResolved
      || !tranche.policy?.contextOnly
      || tranche.policy?.mechanicallyActionable
      || tranche.policy?.modelWeight !== 0
      || tranche.policy?.productionDatabaseQueried
      || tranche.policy?.productionWrites
      || tranche.policy?.vercelUsed
      || tranche.policy?.featureRowsWritten
      || tranche.policy?.modelFitting !== 'none'
      || tranche.policy?.servingChanged
    ) {
      throw new Error(`Semantic tranche ${source.tranche} identity/policy drifted`);
    }

    documentReviews.push(...tranche.documentReviews);
    semanticGroups.push(...tranche.semanticGroups);
    trancheSources.push({
      tranche: source.tranche,
      rowStart: source.rowStart,
      rowEnd: source.rowEnd,
      mergeSha: source.mergeSha,
      runId: source.runId,
      artifactId: source.artifactId,
      artifactDigest: source.digest,
      outputSchema: source.outputSchema,
      outputContentSha256: source.outputContentSha256,
    });
  }

  documentReviews.sort((a, b) => Number(a.row) - Number(b.row));
  semanticGroups.sort((a, b) =>
    String(a.semanticKey).localeCompare(String(b.semanticKey)),
  );

  const expectedRows = Array.from({ length: 50 }, (_, index) => index + 1);
  const actualRows = documentReviews.map((row) => Number(row.row));
  const directional = documentReviews.filter(
    (row) => row.decision === 'directional',
  );
  const nonDirectional = documentReviews.filter(
    (row) => row.decision === 'non_directional',
  );
  const semanticKeys = semanticGroups.map((group) => String(group.semanticKey));

  if (
    JSON.stringify(actualRows) !== JSON.stringify(expectedRows)
    || directional.length !== 42
    || nonDirectional.length !== 8
    || semanticGroups.length !== 42
    || new Set(semanticKeys).size !== 42
    || semanticGroups.some(
      (group) =>
        group.linkage !== 'member_issue'
        || group.candidateBillIdentifiers?.length !== 0
        || group.crossBatchDuplicateOf?.length !== 0
        || group.novelForApplicabilityScreen !== true
        || group.internalMembershipIdentityResolved !== false,
    )
    || documentReviews.some(
      (row) =>
        row.candidateBillIdentifiers?.length !== 0
        || (row.decision === 'directional'
          && row.internalMembershipIdentityResolved !== false),
    )
  ) {
    throw new Error('Cohort-2 aggregate semantic accounting drifted');
  }

  const report = {
    schemaVersion: OUTPUT_SCHEMA,
    batchId: 'EQV1-HISTORICAL-DENSITY-2025-HOUSE-002',
    generatedAt: new Date().toISOString(),
    issue: 718,
    session: SESSION,
    frozenSourceCohort: {
      runId: SOURCE_COHORT_RUN_ID,
      artifactId: SOURCE_COHORT_ARTIFACT_ID,
      digest: SOURCE_COHORT_DIGEST,
      selectionKeySha256: SOURCE_SELECTION_SHA,
    },
    trancheSources,
    reviewedRows: [1, 50],
    cohortComplete: true,
    summary: {
      documents: 50,
      directionalDocuments: 42,
      nonDirectionalDocuments: 8,
      uniqueSemanticGroups: 42,
      novelSemanticGroups: 42,
      crossBatchDuplicateSemanticGroups: 0,
      candidateBillIdentifiers: 0,
      internalMembershipIdentitiesResolved: 0,
    },
    semanticGroups,
    documentReviews,
    policy: {
      outcomeBlind: true,
      outcomeUse: 'none',
      memberIssueOnly: true,
      billInference: false,
      candidateBillIdentifiersRequiredEmpty: true,
      targetBillApplicabilityInferred: false,
      onlyNovelSemanticGroupsAdvanceToApplicabilityScreen: true,
      publicLrlIdentityOnly: true,
      internalMembershipIdentityResolved: false,
      internalIdentityResolutionRequiredBeforeFeatureIntegration: true,
      productionDatabaseQueried: false,
      productionWrites: false,
      contextOnly: true,
      mechanicallyActionable: false,
      modelWeight: 0,
      featureRowsWritten: false,
      modelFitting: 'none',
      vercelUsed: false,
      servingChanged: false,
      nextStep:
        'Run strict-pre-vote bill applicability candidate screening over the 42 novel member-issue semantic groups; no deterministic screen may declare applicability.',
    },
    contentSha256WithoutSelfField: null as string | null,
  };

  mkdirSync(dirname(output), { recursive: true });
  const canonical = `${JSON.stringify(report, null, 2)}\n`;
  report.contentSha256WithoutSelfField = createHash('sha256')
    .update(canonical)
    .digest('hex');
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    historicalDensity2025HouseSemanticCohort2Aggregate: {
      documents: 50,
      directionalDocuments: 42,
      nonDirectionalDocuments: 8,
      uniqueSemanticGroups: 42,
      novelSemanticGroups: 42,
      candidateBillIdentifiers: 0,
      internalMembershipIdentitiesResolved: 0,
      cohortComplete: true,
      outcomeUse: 'none',
      productionDatabaseQueried: false,
      vercelUsed: false,
    },
  }, null, 2));
}

main();
