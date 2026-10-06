import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const COHORT_SCHEMA =
  'historical-density-p2-remaining-semantic-review-cohort-v1';
const DECISION_SCHEMA =
  'historical-density-p2-remaining-semantic-decisions-v1';
const OUTPUT_SCHEMA =
  'historical-density-p2-remaining-semantic-review-v1';
const BATCH_ID = 'EQV1-HISTORICAL-DENSITY-P2-002';
const COHORT_RUN_ID = 37481875190;
const COHORT_ARTIFACT_ID = 11421014765;
const COHORT_ARTIFACT_DIGEST =
  'sha256:743b1cd844a591380709bb9c7faaa310af05d8e2a9532811fcf98a34e1d12708';
const COHORT_INTEGRITY =
  '7f585c50c3ff747a5128b76ce346c68c6a132d9e390903de4f11e1b541a68ff6';
const EXPECTED_DOCUMENTS = 40;
const EXPECTED_MEMBERSHIPS = 13;
const EXPECTED_DIRECTIONAL_DOCUMENTS = 28;
const EXPECTED_NON_DIRECTIONAL_DOCUMENTS = 12;
const EXPECTED_SEMANTIC_GROUPS = 20;
const EXPECTED_NOVEL_SEMANTIC_GROUPS = 17;

type CohortDocument = {
  row: number;
  priorityTier: string;
  sourceDocumentId: string;
  sourceDocumentIds: string[];
  sourceKind: string;
  sourceUrl: string;
  sourceContentSha256: string;
  normalizedTextSha256: string;
  recoveredAt: string;
  textChars: number;
  membershipId: string;
  memberName: string;
  availableAt: string;
  potential2021MemberEventRows: number;
  potential2021Events: number;
  candidateMemberNames: string[];
  candidateBillIdentifiers: string[];
  normalizedText: string;
};

type Cohort = {
  artifactVersion: string;
  batchId: string;
  issue: number;
  sourceRecoveryRunId: number;
  sourceRecoveryArtifactId: number;
  sourceRecoveryArtifactDigest: string;
  documentsExpected: number;
  membershipsExpected: number;
  selectedDocuments: number;
  integritySha256: string;
  documents: CohortDocument[];
  policy: {
    sourceTextStorage: string;
    productionDatabaseQueried: boolean;
    productionWrites: boolean;
    outcomeBlind: boolean;
    contextOnly: boolean;
    mechanicallyActionable: boolean;
    modelWeight: number;
    billInferenceAllowed: boolean;
    candidateBillIdentifiersRequiredEmpty: boolean;
    outcomesQueried: boolean;
    modelFitting: boolean;
    servingChanged: boolean;
    vercelUsed: boolean;
  };
};

type DirectionalDecision = {
  row: number;
  decision: 'directional';
  semanticKey: string;
  topics: string[];
  claimType: 'quoted_position' | 'explicit_position';
  stance: 'supports' | 'opposes';
  explicitness: 'direct_quote' | 'document_position';
  normalizedClaim: string;
  supportingExcerpt: string;
  crossBatchDuplicateOf: string[];
};

type NonDirectionalDecision = {
  row: number;
  decision: 'non_directional';
  reasonCode: string;
};

type Decision = DirectionalDecision | NonDirectionalDecision;

type DecisionFile = {
  schemaVersion: string;
  batchId: string;
  issue: number;
  frozenCohort: {
    runId: number;
    artifactId: number;
    digest: string;
    integritySha256: string;
  };
  decisions: Decision[];
  policy: {
    candidateBillIdentifiers: unknown[];
    targetBillApplicabilityInferred: boolean;
    outcomeUse: string;
    contextOnly: boolean;
    mechanicallyActionable: boolean;
    modelWeight: number;
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

function main() {
  const cohortPath = requiredEnv('VOTEPREDICT_P2_REMAINING_COHORT_PATH');
  const decisionPath = requiredEnv('VOTEPREDICT_P2_REMAINING_DECISION_PATH');
  const outputPath = resolve(
    requiredEnv('VOTEPREDICT_P2_REMAINING_SEMANTIC_REVIEW_OUTPUT'),
  );

  const cohort = JSON.parse(readFileSync(cohortPath, 'utf8')) as Cohort;
  const decisions = JSON.parse(readFileSync(decisionPath, 'utf8')) as DecisionFile;

  if (
    cohort.artifactVersion !== COHORT_SCHEMA
    || cohort.batchId !== BATCH_ID
    || cohort.issue !== 718
    || cohort.documentsExpected !== EXPECTED_DOCUMENTS
    || cohort.selectedDocuments !== EXPECTED_DOCUMENTS
    || cohort.documents.length !== EXPECTED_DOCUMENTS
    || cohort.membershipsExpected !== EXPECTED_MEMBERSHIPS
    || cohort.integritySha256 !== COHORT_INTEGRITY
    || cohort.policy.sourceTextStorage !== 'artifact_only'
    || cohort.policy.productionDatabaseQueried
    || cohort.policy.productionWrites
    || !cohort.policy.outcomeBlind
    || !cohort.policy.contextOnly
    || cohort.policy.mechanicallyActionable
    || cohort.policy.modelWeight !== 0
    || cohort.policy.billInferenceAllowed
    || !cohort.policy.candidateBillIdentifiersRequiredEmpty
    || cohort.policy.outcomesQueried
    || cohort.policy.modelFitting
    || cohort.policy.servingChanged
    || cohort.policy.vercelUsed
  ) {
    throw new Error('Frozen remaining P2 cohort identity/policy drifted');
  }

  if (
    decisions.schemaVersion !== DECISION_SCHEMA
    || decisions.batchId !== BATCH_ID
    || decisions.issue !== 718
    || decisions.frozenCohort.runId !== COHORT_RUN_ID
    || decisions.frozenCohort.artifactId !== COHORT_ARTIFACT_ID
    || decisions.frozenCohort.digest !== COHORT_ARTIFACT_DIGEST
    || decisions.frozenCohort.integritySha256 !== COHORT_INTEGRITY
    || decisions.decisions.length !== EXPECTED_DOCUMENTS
    || decisions.policy.candidateBillIdentifiers.length !== 0
    || decisions.policy.targetBillApplicabilityInferred
    || decisions.policy.outcomeUse !== 'none'
    || !decisions.policy.contextOnly
    || decisions.policy.mechanicallyActionable
    || decisions.policy.modelWeight !== 0
    || decisions.policy.productionDatabaseQueried
    || decisions.policy.productionWrites
    || decisions.policy.vercelUsed
    || decisions.policy.modelFitting !== 'none'
    || decisions.policy.servingChanged
  ) {
    throw new Error('Remaining P2 semantic-decision identity/policy drifted');
  }

  const rows = decisions.decisions.map((decision) => decision.row);
  const expectedRows = Array.from({ length: EXPECTED_DOCUMENTS }, (_, index) => index + 1);
  if (JSON.stringify(rows) !== JSON.stringify(expectedRows)) {
    throw new Error('Remaining P2 semantic decisions must cover rows 1..40 exactly once');
  }

  const directional = decisions.decisions.filter(
    (decision): decision is DirectionalDecision =>
      decision.decision === 'directional',
  );
  const nonDirectional = decisions.decisions.filter(
    (decision): decision is NonDirectionalDecision =>
      decision.decision === 'non_directional',
  );
  if (
    directional.length !== EXPECTED_DIRECTIONAL_DOCUMENTS
    || nonDirectional.length !== EXPECTED_NON_DIRECTIONAL_DOCUMENTS
  ) {
    throw new Error(
      `Semantic review counts drifted directional=${directional.length} nonDirectional=${nonDirectional.length}`,
    );
  }

  for (const document of cohort.documents) {
    if (
      document.row < 1
      || document.row > EXPECTED_DOCUMENTS
      || document.priorityTier !== 'P2_member_strong'
      || document.candidateMemberNames.length !== 1
      || document.candidateMemberNames[0] !== document.memberName
      || document.candidateBillIdentifiers.length !== 0
      || !document.normalizedText.trim()
      || !(document.availableAt.length === 10)
    ) {
      throw new Error(`Frozen cohort row invalid: ${document.row}`);
    }
  }

  const documentReviews = decisions.decisions.map((decision) => {
    const document = cohort.documents[decision.row - 1]!;
    if (document.row !== decision.row) {
      throw new Error(`Cohort/decision row order drifted at ${decision.row}`);
    }

    if (decision.decision === 'non_directional') {
      if (!decision.reasonCode.trim()) {
        throw new Error(`Non-directional row ${decision.row} lacks reason`);
      }
      return {
        row: decision.row,
        decision: decision.decision,
        reasonCode: decision.reasonCode,
        sourceDocumentId: document.sourceDocumentId,
        sourceKind: document.sourceKind,
        sourceUrl: document.sourceUrl,
        sourceContentSha256: document.sourceContentSha256,
        normalizedTextSha256: document.normalizedTextSha256,
        membershipId: document.membershipId,
        memberName: document.memberName,
        availableAt: document.availableAt,
        candidateBillIdentifiers: [] as string[],
      };
    }

    if (
      !decision.semanticKey.trim()
      || !decision.topics.length
      || !decision.normalizedClaim.trim()
      || !decision.supportingExcerpt.trim()
      || !document.normalizedText.includes(decision.supportingExcerpt)
    ) {
      throw new Error(
        `Directional row ${decision.row} lacks exact grounded semantic fields`,
      );
    }

    return {
      row: decision.row,
      decision: decision.decision,
      semanticKey: decision.semanticKey,
      sourceDocumentId: document.sourceDocumentId,
      sourceKind: document.sourceKind,
      sourceUrl: document.sourceUrl,
      sourceContentSha256: document.sourceContentSha256,
      normalizedTextSha256: document.normalizedTextSha256,
      membershipId: document.membershipId,
      memberName: document.memberName,
      availableAt: document.availableAt,
      potential2021MemberEventRows: document.potential2021MemberEventRows,
      candidateMemberNames: [document.memberName],
      candidateBillIdentifiers: [] as string[],
      linkage: 'member_issue' as const,
      topics: decision.topics,
      claimType: decision.claimType,
      stance: decision.stance,
      specificity: 'issue_family' as const,
      explicitness: decision.explicitness,
      attributionType: 'target_member' as const,
      attributedActor: document.memberName,
      normalizedClaim: decision.normalizedClaim,
      supportingExcerpt: decision.supportingExcerpt,
      extractionConfidence: 0.97,
      crossBatchDuplicateOf: decision.crossBatchDuplicateOf,
    };
  });

  const directionalReviews = documentReviews.filter(
    (row): row is Extract<(typeof documentReviews)[number], { decision: 'directional' }> =>
      row.decision === 'directional',
  );

  const bySemanticKey = new Map<string, typeof directionalReviews>();
  for (const review of directionalReviews) {
    const rowsForKey = bySemanticKey.get(review.semanticKey) ?? [];
    rowsForKey.push(review);
    bySemanticKey.set(review.semanticKey, rowsForKey);
  }
  if (bySemanticKey.size !== EXPECTED_SEMANTIC_GROUPS) {
    throw new Error(
      `Expected ${EXPECTED_SEMANTIC_GROUPS} semantic groups, found ${bySemanticKey.size}`,
    );
  }

  const semanticGroups = [...bySemanticKey.entries()]
    .map(([semanticKey, rowsForKey]) => {
      const memberNames = [...new Set(rowsForKey.map((row) => row.memberName))];
      const membershipIds = [...new Set(rowsForKey.map((row) => row.membershipId))];
      const normalizedClaims = [...new Set(rowsForKey.map((row) => row.normalizedClaim))];
      const excerpts = [...new Set(rowsForKey.map((row) => row.supportingExcerpt))];
      const stances = [...new Set(rowsForKey.map((row) => row.stance))];
      const claimTypes = [...new Set(rowsForKey.map((row) => row.claimType))];
      const explicitnesses = [...new Set(rowsForKey.map((row) => row.explicitness))];
      const topicSets = [
        ...new Set(rowsForKey.map((row) => JSON.stringify(row.topics))),
      ];
      const crossBatchSets = [
        ...new Set(rowsForKey.map((row) => JSON.stringify(row.crossBatchDuplicateOf))),
      ];
      if (
        memberNames.length !== 1
        || membershipIds.length !== 1
        || normalizedClaims.length !== 1
        || excerpts.length !== 1
        || stances.length !== 1
        || claimTypes.length !== 1
        || explicitnesses.length !== 1
        || topicSets.length !== 1
        || crossBatchSets.length !== 1
      ) {
        throw new Error(`Semantic group fields disagree for ${semanticKey}`);
      }

      const crossBatchDuplicateOf = JSON.parse(crossBatchSets[0]!) as string[];
      return {
        semanticKey,
        memberName: memberNames[0]!,
        membershipId: membershipIds[0]!,
        sourceRows: rowsForKey.map((row) => row.row).sort((a, b) => a - b),
        sourceDocumentIds: rowsForKey
          .map((row) => row.sourceDocumentId)
          .sort(),
        earliestAvailability: rowsForKey
          .map((row) => row.availableAt)
          .sort()[0]!,
        topics: JSON.parse(topicSets[0]!) as string[],
        claimType: claimTypes[0]!,
        stance: stances[0]!,
        explicitness: explicitnesses[0]!,
        normalizedClaim: normalizedClaims[0]!,
        supportingExcerpt: excerpts[0]!,
        extractionConfidence: 0.97,
        linkage: 'member_issue' as const,
        candidateBillIdentifiers: [] as string[],
        crossBatchDuplicateOf,
        novelForApplicabilityScreen: crossBatchDuplicateOf.length === 0,
      };
    })
    .sort((a, b) => a.semanticKey.localeCompare(b.semanticKey));

  // Keep duplicate-group output deterministic by source-row order rather than semantic-key order.
  const duplicateGroups = semanticGroups
    .filter((group) => group.sourceRows.length > 1)
    .map((group) => group.sourceRows)
    .sort((a, b) => a[0]! - b[0]!);
  const expectedDuplicateGroups = [
    [1, 6, 36],
    [3, 12],
    [4, 39],
    [13, 35],
    [31, 32, 34, 40],
  ];
  if (JSON.stringify(duplicateGroups) !== JSON.stringify(expectedDuplicateGroups)) {
    throw new Error(
      `Within-batch semantic duplicate groups drifted: ${JSON.stringify(duplicateGroups)}`,
    );
  }

  const crossBatchDuplicateGroups = semanticGroups.filter(
    (group) => group.crossBatchDuplicateOf.length > 0,
  );
  const crossBatchKeys = crossBatchDuplicateGroups
    .map((group) => group.semanticKey)
    .sort();
  const expectedCrossBatchKeys = [
    'coleman_gas_tax_opposition',
    'coleman_public_safety_first_responders',
    'koran_pro_life',
  ].sort();
  if (JSON.stringify(crossBatchKeys) !== JSON.stringify(expectedCrossBatchKeys)) {
    throw new Error(
      `Cross-batch duplicate identities drifted: ${crossBatchKeys.join(',')}`,
    );
  }

  const novelGroups = semanticGroups.filter(
    (group) => group.novelForApplicabilityScreen,
  );
  if (novelGroups.length !== EXPECTED_NOVEL_SEMANTIC_GROUPS) {
    throw new Error(
      `Expected ${EXPECTED_NOVEL_SEMANTIC_GROUPS} novel semantic groups, found ${novelGroups.length}`,
    );
  }

  const report = {
    schemaVersion: OUTPUT_SCHEMA,
    batchId: BATCH_ID,
    generatedAt: new Date().toISOString(),
    issue: 718,
    frozenCohort: {
      runId: COHORT_RUN_ID,
      artifactId: COHORT_ARTIFACT_ID,
      digest: COHORT_ARTIFACT_DIGEST,
      integritySha256: COHORT_INTEGRITY,
    },
    summary: {
      documents: EXPECTED_DOCUMENTS,
      memberships: EXPECTED_MEMBERSHIPS,
      directionalDocuments: directionalReviews.length,
      nonDirectionalDocuments: nonDirectional.length,
      uniqueSemanticGroups: semanticGroups.length,
      withinBatchDuplicateGroups: duplicateGroups,
      crossBatchDuplicateSemanticGroups: crossBatchDuplicateGroups.length,
      novelSemanticGroups: novelGroups.length,
      candidateBillIdentifiers: 0,
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
      crossBatchDuplicatesCanMultiplySignals: false,
      onlyNovelSemanticGroupsAdvanceToNewApplicabilityScreen: true,
      productionDatabaseQueried: false,
      productionWrites: false,
      contextOnly: true,
      mechanicallyActionable: false,
      modelWeight: 0,
      modelFitting: 'none',
      vercelUsed: false,
      servingChanged: false,
    },
    contentSha256WithoutSelfField: null as string | null,
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  const canonical = JSON.stringify(report, null, 2) + '\n';
  report.contentSha256WithoutSelfField = createHash('sha256')
    .update(canonical)
    .digest('hex');
  writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n', 'utf8');

  console.log(
    JSON.stringify(
      {
        historicalDensityP2RemainingSemanticReview: {
          documents: EXPECTED_DOCUMENTS,
          directionalDocuments: directionalReviews.length,
          nonDirectionalDocuments: nonDirectional.length,
          uniqueSemanticGroups: semanticGroups.length,
          crossBatchDuplicateSemanticGroups:
            crossBatchDuplicateGroups.length,
          novelSemanticGroups: novelGroups.length,
          withinBatchDuplicateGroups: duplicateGroups,
          outcomeUse: 'none',
          billInference: false,
          candidateBillIdentifiers: 0,
          productionDatabaseQueried: false,
          productionWrites: false,
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
