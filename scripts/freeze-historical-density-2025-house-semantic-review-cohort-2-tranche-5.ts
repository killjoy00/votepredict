import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const COHORT_SCHEMA = 'historical-density-2025-house-semantic-review-cohort-2-v1';
const DECISION_SCHEMA = 'historical-density-2025-house-semantic-decisions-cohort-2-tranche-5-v1';
const OUTPUT_SCHEMA = 'historical-density-2025-house-semantic-review-cohort-2-tranche-5-v1';
const BATCH_ID = 'EQV1-HISTORICAL-DENSITY-2025-HOUSE-002-T05';
const SESSION = '2025-2026';
const COHORT_RUN_ID = 37718561841;
const COHORT_ARTIFACT_ID = 11525006690;
const COHORT_ARTIFACT_DIGEST =
  'sha256:384e0f7856b051f621af0f9f7f55ec517068d093100d47edb12746911410d17c';
const SELECTION_SHA =
  '6364b5c9f86ec6e4cbf4ddd9398ce962f376342c36d5e501bb65884018672a05';
const EXPECTED_ROWS = Array.from({ length: 10 }, (_, index) => index + 41);
const EXPECTED_NON_DIRECTIONAL = [44, 45, 49];

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
  const cohort = readJson(
    requiredEnv('VOTEPREDICT_2025_HOUSE_SEMANTIC_COHORT_2_PATH'),
  );
  const decisions = readJson(
    requiredEnv(
      'VOTEPREDICT_2025_HOUSE_SEMANTIC_COHORT_2_TRANCHE_5_DECISIONS_PATH',
    ),
  );
  const output = resolve(
    requiredEnv('VOTEPREDICT_2025_HOUSE_SEMANTIC_COHORT_2_TRANCHE_5_OUTPUT'),
  );

  if (
    cohort.schemaVersion !== COHORT_SCHEMA
    || cohort.issue !== 718
    || cohort.session !== SESSION
    || cohort.documents?.length !== 50
    || cohort.selection?.recoveredBodies !== 1340
    || cohort.selection?.parsedArticleOwnedBodies !== 1310
    || cohort.selection?.uniqueArticleOwnedBodies !== 1290
    || cohort.selection?.strongSignalDocuments !== 400
    || cohort.selection?.strongSignalMembers !== 123
    || cohort.selection?.excludedPreviouslyReviewedMembers !== 50
    || cohort.selection?.selectedDocuments !== 50
    || cohort.selection?.selectedMembers !== 50
    || cohort.selection?.maximumDocumentsPerMember !== 1
    || cohort.selection?.minimumSelectedSignalScore !== 6
    || cohort.selection?.maximumSelectedSignalScore !== 14
    || cohort.selection?.selectionKeySha256 !== SELECTION_SHA
    || cohort.selection?.targetBillTextUsed
    || cohort.selection?.targetBillIdentifiersUsedForSelection
    || cohort.selection?.targetVoteOutcomesUsed
    || cohort.selection?.targetEventIdentityUsedForSelection
    || !cohort.selection?.strictFutureEventCountUsedForTieBreakOnly
    || !cohort.policy?.outcomeBlind
    || cohort.policy?.outcomeUse !== 'none'
    || !cohort.policy?.sourceBodiesAreOfficialHouseMemberPrimary
    || !cohort.policy?.previousSemanticCohortPinned
    || !cohort.policy?.excludesPreviouslyReviewedMembers
    || !cohort.policy?.articleOwnedTextOnlyForSignalSelection
    || !cohort.policy?.memberIssueOnlyAtThisStage
    || cohort.policy?.billInference
    || !cohort.policy?.candidateBillIdentifiersRequiredEmpty
    || cohort.policy?.targetBillApplicabilityInferred
    || !cohort.policy?.publicLrlIdentityOnly
    || cohort.policy?.internalMembershipIdentityResolved
    || cohort.policy?.productionDatabaseQueried
    || cohort.policy?.productionWrites
    || cohort.policy?.vercelUsed
    || cohort.policy?.sameDayEligible
    || !cohort.policy?.contextOnly
    || cohort.policy?.mechanicallyActionable
    || cohort.policy?.modelWeight !== 0
    || cohort.policy?.featureRowsWritten
    || cohort.policy?.modelFitting !== 'none'
    || cohort.policy?.servingChanged
  ) {
    throw new Error('Frozen 2025 House semantic cohort 2 identity/policy drifted');
  }

  if (
    decisions.schemaVersion !== DECISION_SCHEMA
    || decisions.batchId !== BATCH_ID
    || decisions.issue !== 718
    || decisions.frozenCohort?.runId !== COHORT_RUN_ID
    || decisions.frozenCohort?.artifactId !== COHORT_ARTIFACT_ID
    || decisions.frozenCohort?.digest !== COHORT_ARTIFACT_DIGEST
    || decisions.frozenCohort?.selectionKeySha256 !== SELECTION_SHA
    || decisions.reviewedRows?.[0] !== 41
    || decisions.reviewedRows?.[1] !== 50
    || decisions.decisions?.length !== 10
    || decisions.policy?.candidateBillIdentifiers?.length !== 0
    || decisions.policy?.targetBillApplicabilityInferred
    || decisions.policy?.outcomeUse !== 'none'
    || !decisions.policy?.memberIssueOnly
    || decisions.policy?.billInference
    || decisions.policy?.internalMembershipIdentityResolved
    || !decisions.policy?.contextOnly
    || decisions.policy?.mechanicallyActionable
    || decisions.policy?.modelWeight !== 0
    || decisions.policy?.productionDatabaseQueried
    || decisions.policy?.productionWrites
    || decisions.policy?.vercelUsed
    || decisions.policy?.featureRowsWritten
    || decisions.policy?.modelFitting !== 'none'
    || decisions.policy?.servingChanged
  ) {
    throw new Error('Cohort-2 tranche-5 semantic decision identity/policy drifted');
  }

  const rows = decisions.decisions.map((decision: Json) => decision.row);
  if (JSON.stringify(rows) !== JSON.stringify(EXPECTED_ROWS)) {
    throw new Error(
      'Cohort-2 tranche-5 semantic decisions must cover rows 41..50 exactly once',
    );
  }

  const directional = decisions.decisions.filter(
    (decision: Json) => decision.decision === 'directional',
  );
  const nonDirectional = decisions.decisions.filter(
    (decision: Json) => decision.decision === 'non_directional',
  );

  if (
    directional.length !== 7
    || nonDirectional.length !== 3
    || JSON.stringify(nonDirectional.map((decision: Json) => decision.row))
      !== JSON.stringify(EXPECTED_NON_DIRECTIONAL)
    || new Set(directional.map((decision: Json) => decision.semanticKey)).size !== 7
    || directional.some(
      (decision: Json) => decision.crossBatchDuplicateOf?.length !== 0,
    )
  ) {
    throw new Error(
      `Semantic review counts drifted directional=${directional.length} nonDirectional=${nonDirectional.length}`,
    );
  }

  const documentReviews = decisions.decisions.map((decision: Json) => {
    const document = cohort.documents[decision.row - 1];

    if (
      !document
      || document.row !== decision.row
      || document.publicMemberKey
        !== `public-lrl:${SESSION}:${document.lrlId}`
      || !document.memberName?.trim()
      || !document.articleUrl?.startsWith('https://www.house.mn.gov/')
      || document.candidateBillIdentifiers?.length !== 0
      || document.strictFutureTargetEventCount < 1
      || !(document.publishedOn < document.earliestStrictFutureTargetDate)
      || !(document.publishedOn < document.latestStrictFutureTargetDate)
    ) {
      throw new Error(`Frozen cohort row invalid: ${decision.row}`);
    }

    const base = {
      row: decision.row,
      publicMemberKey: document.publicMemberKey,
      lrlId: document.lrlId,
      memberName: document.memberName,
      sourceUrl: document.articleUrl,
      sourceTitle: document.articleTitle,
      sourceContentSha256: document.contentSha256,
      articleOwnedTextSha256: document.articleOwnedTextSha256,
      publishedOn: document.publishedOn,
      candidateBillIdentifiers: [] as string[],
    };

    if (decision.decision === 'non_directional') {
      if (!decision.reasonCode?.trim()) {
        throw new Error(`Non-directional row ${decision.row} lacks reason`);
      }
      return {
        ...base,
        decision: 'non_directional' as const,
        reasonCode: decision.reasonCode,
      };
    }

    if (
      !decision.semanticKey?.trim()
      || !decision.topics?.length
      || !decision.normalizedClaim?.trim()
      || !decision.supportingExcerpt?.trim()
      || !document.articleOwnedText.includes(decision.supportingExcerpt)
      || !['quoted_position', 'explicit_position'].includes(decision.claimType)
      || !['supports', 'opposes'].includes(decision.stance)
      || !['direct_quote', 'document_position'].includes(decision.explicitness)
    ) {
      throw new Error(
        `Directional row ${decision.row} lacks exact grounded fields`,
      );
    }

    return {
      ...base,
      decision: 'directional' as const,
      semanticKey: decision.semanticKey,
      districts: document.districts,
      parties: document.parties,
      strictFutureTargetEventCount: document.strictFutureTargetEventCount,
      earliestStrictFutureTargetDate: document.earliestStrictFutureTargetDate,
      latestStrictFutureTargetDate: document.latestStrictFutureTargetDate,
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
      crossBatchDuplicateOf: [] as string[],
      internalMembershipIdentityResolved: false,
    };
  });

  const semanticGroups = documentReviews
    .filter((row: Json) => row.decision === 'directional')
    .map((row: Json) => ({
      semanticKey: row.semanticKey,
      publicMemberKey: row.publicMemberKey,
      lrlId: row.lrlId,
      memberName: row.memberName,
      sourceRows: [row.row],
      sourceUrls: [row.sourceUrl],
      earliestAvailability: row.publishedOn,
      topics: row.topics,
      claimType: row.claimType,
      stance: row.stance,
      explicitness: row.explicitness,
      normalizedClaim: row.normalizedClaim,
      supportingExcerpt: row.supportingExcerpt,
      extractionConfidence: 0.97,
      linkage: 'member_issue',
      candidateBillIdentifiers: [] as string[],
      crossBatchDuplicateOf: [] as string[],
      novelForApplicabilityScreen: true,
      internalMembershipIdentityResolved: false,
    }))
    .sort(
      (left: Json, right: Json) =>
        left.semanticKey.localeCompare(right.semanticKey),
    );

  const report = {
    schemaVersion: OUTPUT_SCHEMA,
    batchId: BATCH_ID,
    generatedAt: new Date().toISOString(),
    issue: 718,
    session: SESSION,
    frozenCohort: {
      runId: COHORT_RUN_ID,
      artifactId: COHORT_ARTIFACT_ID,
      digest: COHORT_ARTIFACT_DIGEST,
      selectionKeySha256: SELECTION_SHA,
    },
    reviewedRows: [41, 50],
    summary: {
      documents: 10,
      directionalDocuments: 7,
      nonDirectionalDocuments: 3,
      uniqueSemanticGroups: 7,
      novelSemanticGroups: 7,
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
    },
    contentSha256WithoutSelfField: null as string | null,
  };

  mkdirSync(dirname(output), { recursive: true });
  const canonical = `${JSON.stringify(report, null, 2)}\n`;
  report.contentSha256WithoutSelfField = createHash('sha256')
    .update(canonical)
    .digest('hex');
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(
    JSON.stringify(
      {
        historicalDensity2025HouseSemanticReviewCohort2Tranche5:
          report.summary,
        policy: {
          outcomeUse: 'none',
          productionDatabaseQueried: false,
          vercelUsed: false,
          modelFitting: 'none',
        },
      },
      null,
      2,
    ),
  );
}

main();
