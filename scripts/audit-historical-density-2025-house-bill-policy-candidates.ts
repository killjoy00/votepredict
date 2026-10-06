import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  fetchRevisorBill,
  fetchRevisorBillVersion,
  type RevisorBillMetadata,
  type RevisorBillVersionMetadata,
} from '../src/sources/minnesota/revisor.js';
import {
  billPolicyNomination,
  billPolicySnippet,
} from '../src/evidence/historical-density-2025-house-bill-policy.js';

const ISSUE = 718;
const SESSION = '2025-2026';
const SEMANTIC_ARTIFACT_ID = 11445241994;
const SEMANTIC_ARTIFACT_DIGEST =
  'sha256:80429ab79b4ab973d76fdd2fbdec5e8c55091a5c7873c96dad066a004a22cfce';
const INVENTORY_ARTIFACT_ID = 11440840273;
const INVENTORY_ARTIFACT_DIGEST =
  'sha256:07ee41210122f42716269ab56f8775d78e10d00df39740315acc1ce055937c20';
const EXPECTED_SEMANTIC_GROUPS = 46;
const EXPECTED_SOURCE_ENTRIES = 1340;
const EXPECTED_TARGET_EVENTS = 25;
const EXPECTED_ELIGIBLE_PAIRS = 1045;
const EXPECTED_SELECTION_SHA =
  '984c1d1128968c0b22079421cbcdbf2580459622728efb01a030c461b99d3d62';
const EXPECTED_TARGET_EVENT_KEY_SHA =
  'c4189c9a5321be8062b53b0f94f36c5ab4b195050777ef8b7f1487e6bbb63811';
const EXPECTED_SOURCE_KEY_SHA =
  '191f9eb9e70a0a7601c5cab29470f22eec0e7340f4feab60bbe3f74a457db7e7';
const OUTPUT_FILE =
  'historical-density-2025-house-bill-policy-candidate-audit-v1.json';

type SemanticGroup = {
  semanticKey: string;
  publicMemberKey: string;
  lrlId: string;
  memberName: string;
  sourceRows: number[];
  sourceUrls: string[];
  earliestAvailability: string;
  topics: string[];
  claimType: string;
  stance: 'supports' | 'opposes';
  explicitness: string;
  normalizedClaim: string;
  supportingExcerpt: string;
  extractionConfidence: number;
  linkage: 'member_issue';
  candidateBillIdentifiers: string[];
  crossBatchDuplicateOf: string[];
  novelForApplicabilityScreen: boolean;
  internalMembershipIdentityResolved: boolean;
};

type SemanticReview = {
  schemaVersion: string;
  batchId: string;
  issue: number;
  session: string;
  frozenCohort: {
    runId: number;
    artifactId: number;
    digest: string;
    selectionKeySha256: string;
  };
  summary: {
    documents: number;
    directionalDocuments: number;
    nonDirectionalDocuments: number;
    uniqueSemanticGroups: number;
    novelSemanticGroups: number;
    crossBatchDuplicateSemanticGroups: number;
    candidateBillIdentifiers: number;
    internalMembershipIdentitiesResolved: number;
  };
  semanticGroups: SemanticGroup[];
  policy: {
    outcomeBlind: boolean;
    outcomeUse: string;
    memberIssueOnly: boolean;
    billInference: boolean;
    candidateBillIdentifiersRequiredEmpty: boolean;
    targetBillApplicabilityInferred: boolean;
    onlyNovelSemanticGroupsAdvanceToApplicabilityScreen: boolean;
    internalMembershipIdentityResolved: boolean;
    internalIdentityResolutionRequiredBeforeFeatureIntegration: boolean;
    productionDatabaseQueried: boolean;
    productionWrites: boolean;
    contextOnly: boolean;
    mechanicallyActionable: boolean;
    modelWeight: number;
    modelFitting: string;
    vercelUsed: boolean;
    servingChanged: boolean;
  };
};

type TargetEvent = {
  voteEventId: string;
  billId: string;
  identifier: string;
  occurredOn: string;
  chamber: string;
  uncoveredRows: number;
  uncoveredMemberships: number;
};

type SourceEntry = {
  lrlId: string;
  memberName: string;
  articleUrl: string;
  publishedOn: string;
  strictFutureTargetEvents: TargetEvent[];
};

type Inventory = {
  schemaVersion: string;
  issue: number;
  session: string;
  target: {
    events: TargetEvent[];
    targetEventKeySha256: string;
    sameDayEligible: boolean;
  };
  archiveInventory: {
    strictPreVoteSourceEntries: number;
    sourceKeySha256: string;
    sourceEntries: SourceEntry[];
  };
  policy: {
    productionDatabaseQueried: boolean;
    productionWrites: boolean;
    vercelUsed: boolean;
    targetVoteOutcomesRead: boolean;
    outcomeUse: string;
    exactBillLinkageInferredFromMemberIssueEvidence: boolean;
    applicabilityInferred: boolean;
    sameDayEligible: boolean;
    contextOnly: boolean;
    mechanicallyActionable: boolean;
    modelWeight: number;
    modelFitting: string;
    servingChanged: boolean;
  };
};

type EventSource = {
  voteEventId: string;
  billId: string;
  identifier: string;
  occurredOn: string;
  status:
    | 'verified'
    | 'no_strict_prevote_version'
    | 'status_fetch_failed'
    | 'version_fetch_failed';
  statusUrl?: string;
  versionUrl?: string;
  versionPostedOn?: string;
  versionOrdinal?: number;
  versionKey?: string;
  versionSha256?: string;
  text?: string;
  error?: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function safeMessage(error: unknown): string {
  return (error instanceof Error ? error.stack ?? error.message : String(error))
    .replace(/https?:\/\/\S+/gi, '[source URL]')
    .slice(0, 1200);
}

function selectStrictPreVoteVersion(
  metadata: RevisorBillMetadata,
  occurredOn: string,
): RevisorBillVersionMetadata | undefined {
  return [...metadata.versions]
    .filter((version) => version.postedOn < occurredOn)
    .sort(
      (a, b) =>
        b.postedOn.localeCompare(a.postedOn) || b.ordinal - a.ordinal,
    )[0];
}

async function retry<T>(
  fn: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  let last: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      if (attempt < attempts) {
        await new Promise((resolveDelay) =>
          setTimeout(resolveDelay, 700 * attempt),
        );
      }
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

async function mapLimit<T, R>(
  values: readonly T[],
  limit: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (true) {
      const index = cursor++;
      if (index >= values.length) return;
      results[index] = await mapper(values[index]!);
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(limit, values.length) },
      () => worker(),
    ),
  );
  return results;
}

async function materializeEventSources(
  events: readonly TargetEvent[],
): Promise<Map<string, EventSource>> {
  const statusCache = new Map<string, Promise<RevisorBillMetadata>>();
  const versionCache = new Map<
    string,
    Promise<Awaited<ReturnType<typeof fetchRevisorBillVersion>>>
  >();
  const ordered = [...events].sort(
    (a, b) =>
      a.occurredOn.localeCompare(b.occurredOn)
      || a.voteEventId.localeCompare(b.voteEventId),
  );

  const rows = await mapLimit<TargetEvent, readonly [string, EventSource]>(
    ordered,
    4,
    async (event) => {
      let metadata: RevisorBillMetadata;
      try {
        let pending = statusCache.get(event.identifier);
        if (!pending) {
          pending = retry(() =>
            fetchRevisorBill(SESSION, event.identifier, false),
          );
          statusCache.set(event.identifier, pending);
        }
        metadata = await pending;
      } catch (error) {
        return [
          event.voteEventId,
          {
            voteEventId: event.voteEventId,
            billId: event.billId,
            identifier: event.identifier,
            occurredOn: event.occurredOn,
            status: 'status_fetch_failed',
            error: safeMessage(error),
          },
        ] as const;
      }

      const selected = selectStrictPreVoteVersion(
        metadata,
        event.occurredOn,
      );
      if (!selected) {
        return [
          event.voteEventId,
          {
            voteEventId: event.voteEventId,
            billId: event.billId,
            identifier: event.identifier,
            occurredOn: event.occurredOn,
            status: 'no_strict_prevote_version',
            statusUrl: metadata.sourceUrl,
          },
        ] as const;
      }

      try {
        let pending = versionCache.get(selected.textUrl);
        if (!pending) {
          pending = retry(() => fetchRevisorBillVersion(selected));
          versionCache.set(selected.textUrl, pending);
        }
        const version = await pending;
        return [
          event.voteEventId,
          {
            voteEventId: event.voteEventId,
            billId: event.billId,
            identifier: event.identifier,
            occurredOn: event.occurredOn,
            status: 'verified',
            statusUrl: metadata.sourceUrl,
            versionUrl: version.textUrl,
            versionPostedOn: version.postedOn,
            versionOrdinal: version.ordinal,
            versionKey: version.versionKey,
            versionSha256: version.textSha256,
            text: version.text,
          },
        ] as const;
      } catch (error) {
        return [
          event.voteEventId,
          {
            voteEventId: event.voteEventId,
            billId: event.billId,
            identifier: event.identifier,
            occurredOn: event.occurredOn,
            status: 'version_fetch_failed',
            statusUrl: metadata.sourceUrl,
            versionUrl: selected.textUrl,
            versionPostedOn: selected.postedOn,
            versionOrdinal: selected.ordinal,
            versionKey: selected.versionKey,
            error: safeMessage(error),
          },
        ] as const;
      }
    },
  );

  return new Map(rows);
}

function verifySemanticReview(review: SemanticReview): void {
  if (
    review.schemaVersion !==
      'historical-density-2025-house-semantic-review-v1'
    || review.batchId !== 'EQV1-HISTORICAL-DENSITY-2025-HOUSE-001'
    || review.issue !== ISSUE
    || review.session !== SESSION
    || review.frozenCohort.selectionKeySha256 !== EXPECTED_SELECTION_SHA
    || review.summary.documents !== 50
    || review.summary.directionalDocuments !== 46
    || review.summary.nonDirectionalDocuments !== 4
    || review.summary.uniqueSemanticGroups !== EXPECTED_SEMANTIC_GROUPS
    || review.summary.novelSemanticGroups !== EXPECTED_SEMANTIC_GROUPS
    || review.summary.crossBatchDuplicateSemanticGroups !== 0
    || review.summary.candidateBillIdentifiers !== 0
    || review.summary.internalMembershipIdentitiesResolved !== 0
    || review.semanticGroups.length !== EXPECTED_SEMANTIC_GROUPS
    || !review.policy.outcomeBlind
    || review.policy.outcomeUse !== 'none'
    || !review.policy.memberIssueOnly
    || review.policy.billInference
    || !review.policy.candidateBillIdentifiersRequiredEmpty
    || review.policy.targetBillApplicabilityInferred
    || !review.policy.onlyNovelSemanticGroupsAdvanceToApplicabilityScreen
    || review.policy.internalMembershipIdentityResolved
    || !review.policy.internalIdentityResolutionRequiredBeforeFeatureIntegration
    || review.policy.productionDatabaseQueried
    || review.policy.productionWrites
    || !review.policy.contextOnly
    || review.policy.mechanicallyActionable
    || review.policy.modelWeight !== 0
    || review.policy.modelFitting !== 'none'
    || review.policy.vercelUsed
    || review.policy.servingChanged
  ) {
    throw new Error('2025 House semantic-review identity/policy drifted');
  }
  if (
    review.semanticGroups.some(
      (group) =>
        group.sourceUrls.length !== 1
        || group.candidateBillIdentifiers.length !== 0
        || group.crossBatchDuplicateOf.length !== 0
        || !group.novelForApplicabilityScreen
        || group.linkage !== 'member_issue'
        || group.internalMembershipIdentityResolved
        || group.publicMemberKey !==
          `public-lrl:${SESSION}:${group.lrlId}`,
    )
  ) {
    throw new Error('2025 House semantic-group boundary drifted');
  }
}

function verifyInventory(inventory: Inventory): void {
  if (
    inventory.schemaVersion !==
      'historical-density-2025-house-member-primary-inventory-v1'
    || inventory.issue !== ISSUE
    || inventory.session !== SESSION
    || inventory.target.events.length !== EXPECTED_TARGET_EVENTS
    || inventory.target.targetEventKeySha256 !==
      EXPECTED_TARGET_EVENT_KEY_SHA
    || inventory.target.sameDayEligible
    || inventory.archiveInventory.strictPreVoteSourceEntries !==
      EXPECTED_SOURCE_ENTRIES
    || inventory.archiveInventory.sourceKeySha256 !==
      EXPECTED_SOURCE_KEY_SHA
    || inventory.archiveInventory.sourceEntries.length !==
      EXPECTED_SOURCE_ENTRIES
    || inventory.policy.productionDatabaseQueried
    || inventory.policy.productionWrites
    || inventory.policy.vercelUsed
    || inventory.policy.targetVoteOutcomesRead
    || inventory.policy.outcomeUse !== 'none'
    || inventory.policy.exactBillLinkageInferredFromMemberIssueEvidence
    || inventory.policy.applicabilityInferred
    || inventory.policy.sameDayEligible
    || !inventory.policy.contextOnly
    || inventory.policy.mechanicallyActionable
    || inventory.policy.modelWeight !== 0
    || inventory.policy.modelFitting !== 'none'
    || inventory.policy.servingChanged
  ) {
    throw new Error('2025 House source-inventory identity/policy drifted');
  }
}

async function main(): Promise<void> {
  const semanticReview = JSON.parse(
    readFileSync(
      requiredEnv(
        'VOTEPREDICT_2025_HOUSE_SEMANTIC_REVIEW_PATH',
      ),
      'utf8',
    ),
  ) as SemanticReview;
  const inventory = JSON.parse(
    readFileSync(
      requiredEnv(
        'VOTEPREDICT_2025_HOUSE_MEMBER_PRIMARY_INVENTORY_PATH',
      ),
      'utf8',
    ),
  ) as Inventory;
  verifySemanticReview(semanticReview);
  verifyInventory(inventory);

  const sourceByKey = new Map(
    inventory.archiveInventory.sourceEntries.map((entry) => [
      `${entry.lrlId}|${entry.articleUrl}`,
      entry,
    ] as const),
  );

  const eligiblePairs = semanticReview.semanticGroups.flatMap((group) => {
    const sourceUrl = group.sourceUrls[0]!;
    const source = sourceByKey.get(
      `${group.lrlId}|${sourceUrl}`,
    );
    if (
      !source
      || source.memberName !== group.memberName
      || source.publishedOn !== group.earliestAvailability
      || source.strictFutureTargetEvents.length === 0
      || source.strictFutureTargetEvents.some(
        (event) => !(group.earliestAvailability < event.occurredOn),
      )
    ) {
      throw new Error(
        `Frozen public-member/source chronology drifted for ${group.semanticKey}`,
      );
    }
    return source.strictFutureTargetEvents.map((event) => ({
      group,
      event,
    }));
  });

  if (eligiblePairs.length !== EXPECTED_ELIGIBLE_PAIRS) {
    throw new Error(
      `Expected ${EXPECTED_ELIGIBLE_PAIRS} strict semantic-event pairs, got ${eligiblePairs.length}`,
    );
  }

  const events = [
    ...new Map(
      eligiblePairs.map(({ event }) => [event.voteEventId, event]),
    ).values(),
  ];
  if (events.length !== EXPECTED_TARGET_EVENTS) {
    throw new Error(
      `Expected ${EXPECTED_TARGET_EVENTS} target events, got ${events.length}`,
    );
  }

  const eventSources = await materializeEventSources(events);
  const pairResults: Array<Record<string, unknown>> = [];
  const candidateClaims: Array<Record<string, unknown>> = [];

  for (const { group, event } of eligiblePairs) {
    const source = eventSources.get(event.voteEventId);
    if (!source) {
      throw new Error(`Missing event source ${event.voteEventId}`);
    }

    if (source.status !== 'verified' || !source.text) {
      pairResults.push({
        semanticKey: group.semanticKey,
        publicMemberKey: group.publicMemberKey,
        identifier: event.identifier,
        voteEventId: event.voteEventId,
        occurredOn: event.occurredOn,
        status: 'ambiguous_fail_closed',
        reason: source.status,
      });
      continue;
    }

    const nomination = billPolicyNomination(
      source.text,
      group.topics,
    );
    if (!nomination.nominated) {
      pairResults.push({
        semanticKey: group.semanticKey,
        publicMemberKey: group.publicMemberKey,
        identifier: event.identifier,
        voteEventId: event.voteEventId,
        occurredOn: event.occurredOn,
        status: 'not_nominated',
        matchedTopics: nomination.matchedTopics,
      });
      continue;
    }

    const reviewKey =
      `${group.semanticKey}|${group.publicMemberKey}|${event.identifier}|${event.occurredOn}|${source.versionSha256}`;
    pairResults.push({
      semanticKey: group.semanticKey,
      publicMemberKey: group.publicMemberKey,
      identifier: event.identifier,
      voteEventId: event.voteEventId,
      occurredOn: event.occurredOn,
      status: 'candidate_for_semantic_review',
      reviewKey,
    });
    candidateClaims.push({
      reviewKey,
      semanticKey: group.semanticKey,
      publicMemberKey: group.publicMemberKey,
      lrlId: group.lrlId,
      memberName: group.memberName,
      sourceRows: group.sourceRows,
      sourceUrls: group.sourceUrls,
      claimAvailableAt: group.earliestAvailability,
      memberStance: group.stance,
      normalizedClaim: group.normalizedClaim,
      topics: group.topics,
      claimType: group.claimType,
      explicitness: group.explicitness,
      extractionConfidence: group.extractionConfidence,
      voteEventId: event.voteEventId,
      billId: event.billId,
      identifier: event.identifier,
      chamber: event.chamber,
      occurredOn: event.occurredOn,
      candidateOnly: true,
      applicabilityDecision: 'pending_semantic_review',
      billPolicyDirection:
        'not_inferred_by_candidate_screen',
      alignmentDirection:
        'not_inferred_by_candidate_screen',
      internalMembershipIdentityResolved: false,
      versionProof: {
        statusUrl: source.statusUrl,
        versionUrl: source.versionUrl,
        postedOn: source.versionPostedOn,
        ordinal: source.versionOrdinal,
        versionKey: source.versionKey,
        textSha256: source.versionSha256,
        strictlyBeforeVoteDate: Boolean(
          source.versionPostedOn
          && source.versionPostedOn < event.occurredOn,
        ),
      },
      matchedTopics: nomination.matchedTopics,
      distinctiveTopicMatched:
        nomination.distinctiveTopicMatched,
      termHits: nomination.hits.map((hit) => ({
        topic: hit.topic,
        phrase: hit.phrase,
        snippet: billPolicySnippet(
          source.text!,
          hit.phrase,
        ),
      })),
    });
  }

  const sourceStatusCounts = Object.fromEntries(
    [
      ...new Set(
        [...eventSources.values()].map((row) => row.status),
      ),
    ]
      .sort()
      .map((status) => [
        status,
        [...eventSources.values()].filter(
          (row) => row.status === status,
        ).length,
      ]),
  );
  const pairStatusCounts = Object.fromEntries(
    [
      ...new Set(
        pairResults.map((row) => String(row.status)),
      ),
    ]
      .sort()
      .map((status) => [
        status,
        pairResults.filter(
          (row) => row.status === status,
        ).length,
      ]),
  );

  const report = {
    schemaVersion:
      'historical-density-2025-house-bill-policy-candidate-audit-v1',
    generatedAt: new Date().toISOString(),
    issue: ISSUE,
    session: SESSION,
    frozenInputs: {
      semanticReviewArtifactId: SEMANTIC_ARTIFACT_ID,
      semanticReviewArtifactDigest:
        SEMANTIC_ARTIFACT_DIGEST,
      semanticReviewSelectionKeySha256:
        EXPECTED_SELECTION_SHA,
      memberPrimaryInventoryArtifactId:
        INVENTORY_ARTIFACT_ID,
      memberPrimaryInventoryArtifactDigest:
        INVENTORY_ARTIFACT_DIGEST,
      targetEventKeySha256:
        EXPECTED_TARGET_EVENT_KEY_SHA,
      sourceKeySha256: EXPECTED_SOURCE_KEY_SHA,
    },
    cohort: {
      semanticGroups:
        semanticReview.semanticGroups.length,
      publicMembers: new Set(
        semanticReview.semanticGroups.map(
          (group) => group.publicMemberKey,
        ),
      ).size,
      strictEligibleClaimEventPairs:
        eligiblePairs.length,
      uniqueTargetEvents: events.length,
      internalMembershipIdentitiesResolved: 0,
    },
    sourceVerification: {
      events: eventSources.size,
      statusCounts: sourceStatusCounts,
      strictRule:
        'latest exact official Minnesota Revisor bill version with postedOn < target event date',
      sameDayVersionEligible: false,
      currentMutableBillTitleUsed: false,
    },
    candidateScreen: {
      pairStatusCounts,
      candidateClaimEventPairs:
        candidateClaims.length,
      candidateReviewGroups: new Set(
        candidateClaims.map(
          (row) => row.reviewKey,
        ),
      ).size,
      candidateBills: new Set(
        candidateClaims.map((row) => row.billId),
      ).size,
      candidatePublicMembers: new Set(
        candidateClaims.map(
          (row) => row.publicMemberKey,
        ),
      ).size,
      candidateSemanticGroups: new Set(
        candidateClaims.map(
          (row) => row.semanticKey,
        ),
      ).size,
      automaticApplicableRows: 0,
      automaticAlignmentRows: 0,
      internalMembershipRowsCreated: 0,
      nextStep:
        'manual semantic review against the exact strict-pre-vote Revisor text; mixed, incidental, omnibus, or unclear policy direction fails closed. Internal historical membership identity remains required before any row integration.',
    },
    candidateClaims,
    pairResults,
    policy: {
      outcomeUse: 'none',
      sourceDiscovery:
        'official Minnesota Revisor only',
      productionDatabaseQueried: false,
      productionWrites: false,
      vercelUsed: false,
      billIdentifiersInferredFromMemberClaims: false,
      publicLrlIdentityUsed: true,
      internalMembershipIdentityResolved: false,
      internalIdentityResolutionRequiredBeforeFeatureIntegration:
        true,
      sameDayBillVersionsExcluded: true,
      deterministicScreenCanDeclareApplicability: false,
      deterministicScreenCanDeclareAlignment: false,
      semanticReviewRequiredForApplicability: true,
      targetBillApplicabilityInferred: false,
      contextOnly: true,
      mechanicallyActionable: false,
      modelWeight: 0,
      featureRowsWritten: false,
      modelFitting: 'none',
      servingChanged: false,
    },
    contentSha256WithoutSelfField:
      null as string | null,
  };

  const outputDir = requiredEnv(
    'VOTEPREDICT_2025_HOUSE_BILL_POLICY_OUTPUT_DIR',
  );
  mkdirSync(outputDir, { recursive: true });
  const canonicalWithoutSha =
    JSON.stringify(report, null, 2) + '\n';
  report.contentSha256WithoutSelfField = createHash('sha256')
    .update(canonicalWithoutSha)
    .digest('hex');
  writeFileSync(
    resolve(outputDir, OUTPUT_FILE),
    JSON.stringify(report, null, 2) + '\n',
  );

  console.log(JSON.stringify({
    historicalDensity2025HouseBillPolicyCandidateAudit: {
      semanticGroups: report.cohort.semanticGroups,
      strictEligibleClaimEventPairs:
        report.cohort.strictEligibleClaimEventPairs,
      uniqueTargetEvents:
        report.cohort.uniqueTargetEvents,
      sourceStatusCounts,
      pairStatusCounts,
      candidateClaimEventPairs:
        report.candidateScreen.candidateClaimEventPairs,
      candidateBills:
        report.candidateScreen.candidateBills,
      candidatePublicMembers:
        report.candidateScreen.candidatePublicMembers,
      candidateSemanticGroups:
        report.candidateScreen.candidateSemanticGroups,
      automaticApplicableRows: 0,
      internalMembershipRowsCreated: 0,
      outcomeUse: 'none',
      productionDatabaseQueried: false,
      vercelUsed: false,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(safeMessage(error));
  process.exitCode = 1;
});
