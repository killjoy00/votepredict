import { createHash } from 'node:crypto';
import { createReadStream, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import {
  fetchRevisorBill,
  fetchRevisorBillVersion,
  type RevisorBillMetadata,
  type RevisorBillVersionMetadata,
} from '../src/sources/minnesota/revisor.js';
import { historicalBillIdentityTitle } from '../src/evaluation/historical-quick-replay.js';
import {
  P2_REMAINING_APPLICABILITY_RULES,
  remainingApplicabilityPatternHits,
  remainingApplicabilitySnippet,
} from '../src/evidence/historical-density-p2-remaining-applicability.js';

const TARGET_SESSION = '2021-2022';
const TARGET_UNIVERSE_ARTIFACT_ID = 11252079484;
const TARGET_UNIVERSE_DIGEST =
  'sha256:22e8944cffc6fda553b05ea6ad5e92400d35fc01d83177efdd5d1204dd3c5a6f';
const SEMANTIC_REVIEW_RUN_ID = 37484330777;
const SEMANTIC_REVIEW_ARTIFACT_ID = 11423055543;
const SEMANTIC_REVIEW_DIGEST =
  'sha256:5d4e92963f3095dbc4d20f950ad6bc4f80150c83cb18586bcdf3c0a9373c97e0';
const SEMANTIC_REVIEW_COHORT_INTEGRITY =
  '7f585c50c3ff747a5128b76ce346c68c6a132d9e390903de4f11e1b541a68ff6';
const EXPECTED_TARGET_2021_ROWS = 35510;
const EXPECTED_SEMANTIC_GROUPS = 20;
const EXPECTED_NOVEL_GROUPS = 17;
const EXPECTED_CROSS_BATCH_DUPLICATE_GROUPS = 3;
const OUTPUT_FILE =
  'historical-density-p2-remaining-applicability-candidate-audit-v1.json';
const ALLOWED_TARGET_KEYS = [
  'voteEventId',
  'membershipId',
  'legislatorId',
  'session',
  'chamber',
  'occurredOn',
  'billId',
  'identifier',
] as const;

type TargetRow = {
  voteEventId: string;
  membershipId: string;
  legislatorId: string;
  session: string;
  chamber: string;
  occurredOn: string;
  billId: string;
  identifier: string;
};

type SemanticGroup = {
  semanticKey: string;
  memberName: string;
  membershipId: string;
  sourceRows: number[];
  sourceDocumentIds: string[];
  earliestAvailability: string;
  topics: string[];
  claimType: 'quoted_position' | 'explicit_position';
  stance: 'supports' | 'opposes';
  explicitness: 'direct_quote' | 'document_position';
  normalizedClaim: string;
  supportingExcerpt: string;
  extractionConfidence: number;
  linkage: 'member_issue';
  candidateBillIdentifiers: string[];
  crossBatchDuplicateOf: string[];
  novelForApplicabilityScreen: boolean;
};

type SemanticReview = {
  schemaVersion: string;
  batchId: string;
  issue: number;
  frozenCohort: {
    runId: number;
    artifactId: number;
    digest: string;
    integritySha256: string;
  };
  summary: {
    documents: number;
    memberships: number;
    directionalDocuments: number;
    nonDirectionalDocuments: number;
    uniqueSemanticGroups: number;
    crossBatchDuplicateSemanticGroups: number;
    novelSemanticGroups: number;
    candidateBillIdentifiers: number;
  };
  semanticGroups: SemanticGroup[];
  policy: {
    outcomeBlind: boolean;
    outcomeUse: string;
    memberIssueOnly: boolean;
    billInference: boolean;
    candidateBillIdentifiersRequiredEmpty: boolean;
    targetBillApplicabilityInferred: boolean;
    crossBatchDuplicatesCanMultiplySignals: boolean;
    onlyNovelSemanticGroupsAdvanceToNewApplicabilityScreen: boolean;
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
  identityTitle?: string;
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

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
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

async function retry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
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
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= values.length) return;
      results[index] = await mapper(values[index]!);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, () => worker()),
  );
  return results;
}

async function loadOutcomeBlindTargets(path: string): Promise<TargetRow[]> {
  const input = createInterface({
    input: createReadStream(path, 'utf8'),
    crlfDelay: Infinity,
  });
  const rows: TargetRow[] = [];
  const expected = [...ALLOWED_TARGET_KEYS].sort();
  for await (const line of input) {
    if (!line.trim()) continue;
    const parsed = JSON.parse(line) as Record<string, unknown>;
    const keys = Object.keys(parsed).sort();
    if (JSON.stringify(keys) !== JSON.stringify(expected)) {
      throw new Error(
        `Outcome-blind target row schema drifted; saw keys: ${keys.join(',')}`,
      );
    }
    rows.push(parsed as unknown as TargetRow);
  }
  return rows;
}

async function materializeEventSources(
  events: readonly TargetRow[],
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

  const rows = await mapLimit<
    TargetRow,
    readonly [string, EventSource]
  >(ordered, 4, async (event) => {
    let metadata: RevisorBillMetadata;
    try {
      let pending = statusCache.get(event.identifier);
      if (!pending) {
        pending = retry(() =>
          fetchRevisorBill(TARGET_SESSION, event.identifier, false),
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

    const selected = selectStrictPreVoteVersion(metadata, event.occurredOn);
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
          identityTitle: historicalBillIdentityTitle(
            version.text,
            event.identifier,
          ),
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
  });

  return new Map(rows);
}

function mainIdentity(review: SemanticReview) {
  if (
    review.schemaVersion !==
      'historical-density-p2-remaining-semantic-review-v1'
    || review.batchId !== 'EQV1-HISTORICAL-DENSITY-P2-002'
    || review.issue !== 718
    || review.frozenCohort.runId !== 37481875190
    || review.frozenCohort.artifactId !== 11421014765
    || review.frozenCohort.digest
      !== 'sha256:743b1cd844a591380709bb9c7faaa310af05d8e2a9532811fcf98a34e1d12708'
    || review.frozenCohort.integritySha256
      !== SEMANTIC_REVIEW_COHORT_INTEGRITY
    || review.summary.uniqueSemanticGroups !== EXPECTED_SEMANTIC_GROUPS
    || review.summary.crossBatchDuplicateSemanticGroups
      !== EXPECTED_CROSS_BATCH_DUPLICATE_GROUPS
    || review.summary.novelSemanticGroups !== EXPECTED_NOVEL_GROUPS
    || review.summary.candidateBillIdentifiers !== 0
    || !review.policy.outcomeBlind
    || review.policy.outcomeUse !== 'none'
    || !review.policy.memberIssueOnly
    || review.policy.billInference
    || !review.policy.candidateBillIdentifiersRequiredEmpty
    || review.policy.targetBillApplicabilityInferred
    || review.policy.crossBatchDuplicatesCanMultiplySignals
    || !review.policy.onlyNovelSemanticGroupsAdvanceToNewApplicabilityScreen
    || review.policy.productionDatabaseQueried
    || review.policy.productionWrites
    || !review.policy.contextOnly
    || review.policy.mechanicallyActionable
    || review.policy.modelWeight !== 0
    || review.policy.modelFitting !== 'none'
    || review.policy.vercelUsed
    || review.policy.servingChanged
  ) {
    throw new Error('Remaining P2 semantic-review identity/policy drifted');
  }
}

async function main() {
  const review = JSON.parse(
    readFileSync(requiredEnv('VOTEPREDICT_P2_REMAINING_SEMANTIC_REVIEW_PATH'), 'utf8'),
  ) as SemanticReview;
  mainIdentity(review);

  const novelGroups = review.semanticGroups
    .filter((group) => group.novelForApplicabilityScreen)
    .sort((a, b) => a.semanticKey.localeCompare(b.semanticKey));
  if (novelGroups.length !== EXPECTED_NOVEL_GROUPS) {
    throw new Error(`Novel semantic group count drifted: ${novelGroups.length}`);
  }
  if (
    novelGroups.some(
      (group) =>
        group.crossBatchDuplicateOf.length !== 0
        || group.candidateBillIdentifiers.length !== 0
        || group.linkage !== 'member_issue'
        || !(group.earliestAvailability.length === 10),
    )
  ) {
    throw new Error('Novel semantic group provenance/bill-linkage boundary drifted');
  }

  const ruleMap = new Map(
    P2_REMAINING_APPLICABILITY_RULES.map((rule) => [
      rule.semanticKey,
      rule,
    ]),
  );
  if (
    ruleMap.size !== EXPECTED_NOVEL_GROUPS
    || novelGroups.some((group) => !ruleMap.has(group.semanticKey))
    || [...ruleMap.keys()].some(
      (key) => !novelGroups.some((group) => group.semanticKey === key),
    )
  ) {
    throw new Error('Remaining P2 applicability rule coverage drifted');
  }

  const targetRows = await loadOutcomeBlindTargets(
    requiredEnv('VOTEPREDICT_P2_OUTCOME_BLIND_TARGET_PATH'),
  );
  if (
    targetRows.length !== EXPECTED_TARGET_2021_ROWS
    || targetRows.some((row) => row.session !== TARGET_SESSION)
  ) {
    throw new Error(
      `Expected ${EXPECTED_TARGET_2021_ROWS} outcome-blind 2021-22 target rows, found ${targetRows.length}`,
    );
  }

  const groupsByMembership = new Map<string, SemanticGroup[]>();
  for (const group of novelGroups) {
    const values = groupsByMembership.get(group.membershipId) ?? [];
    values.push(group);
    groupsByMembership.set(group.membershipId, values);
  }

  const relevantRows = targetRows.filter((row) =>
    groupsByMembership.has(row.membershipId),
  );
  const eligiblePairs = relevantRows.flatMap((row) =>
    (groupsByMembership.get(row.membershipId) ?? [])
      .filter((group) => group.earliestAvailability < row.occurredOn)
      .map((group) => ({ row, group })),
  );
  const eligibleMemberEventKeys = new Set(
    eligiblePairs.map(
      ({ row }) => `${row.voteEventId}|${row.membershipId}`,
    ),
  );
  const eligibleEventRows = relevantRows.filter((row) =>
    eligibleMemberEventKeys.has(`${row.voteEventId}|${row.membershipId}`),
  );
  const events = [
    ...new Map(
      eligibleEventRows.map((row) => [row.voteEventId, row]),
    ).values(),
  ];

  const eventSources = await materializeEventSources(events);
  const pairResults: Array<Record<string, unknown>> = [];
  const candidateClaims: Array<Record<string, unknown>> = [];

  for (const { row, group } of eligiblePairs) {
    const source = eventSources.get(row.voteEventId);
    if (!source) throw new Error(`Missing event source ${row.voteEventId}`);

    if (source.status !== 'verified' || !source.text) {
      pairResults.push({
        voteEventId: row.voteEventId,
        membershipId: row.membershipId,
        semanticKey: group.semanticKey,
        identifier: row.identifier,
        occurredOn: row.occurredOn,
        status: 'ambiguous_fail_closed',
        reason: source.status,
      });
      continue;
    }

    const rule = ruleMap.get(group.semanticKey)!;
    const hits = remainingApplicabilityPatternHits(source.text, rule);
    if (!hits.length) {
      pairResults.push({
        voteEventId: row.voteEventId,
        membershipId: row.membershipId,
        semanticKey: group.semanticKey,
        identifier: row.identifier,
        occurredOn: row.occurredOn,
        status: 'not_nominated',
        reason: 'bill_issue_not_nominated',
      });
      continue;
    }

    const reviewKey =
      `${group.semanticKey}|${row.identifier}|${row.occurredOn}|${source.versionSha256}`;
    pairResults.push({
      voteEventId: row.voteEventId,
      membershipId: row.membershipId,
      semanticKey: group.semanticKey,
      identifier: row.identifier,
      occurredOn: row.occurredOn,
      status: 'candidate_for_semantic_review',
      reviewKey,
    });
    candidateClaims.push({
      reviewKey,
      voteEventId: row.voteEventId,
      membershipId: row.membershipId,
      memberName: group.memberName,
      occurredOn: row.occurredOn,
      billId: row.billId,
      identifier: row.identifier,
      chamber: row.chamber,
      semanticKey: group.semanticKey,
      sourceRows: group.sourceRows,
      sourceDocumentIds: group.sourceDocumentIds,
      claimAvailableAt: group.earliestAvailability,
      memberStance: group.stance,
      normalizedClaim: group.normalizedClaim,
      topics: group.topics,
      claimType: group.claimType,
      explicitness: group.explicitness,
      extractionConfidence: group.extractionConfidence,
      candidateOnly: true,
      applicabilityDecision: 'pending_semantic_review',
      billPolicyDirection: 'not_inferred_by_candidate_screen',
      alignmentDirection: 'not_inferred_by_candidate_screen',
      versionProof: {
        statusUrl: source.statusUrl,
        versionUrl: source.versionUrl,
        postedOn: source.versionPostedOn,
        ordinal: source.versionOrdinal,
        versionKey: source.versionKey,
        textSha256: source.versionSha256,
        identityTitle: source.identityTitle,
        strictlyBeforeVoteDate: Boolean(
          source.versionPostedOn
          && source.versionPostedOn < row.occurredOn
        ),
      },
      termHits: hits.map((hit) => ({
        label: hit.label,
        match: hit.match,
        snippet: remainingApplicabilitySnippet(source.text!, hit),
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
      ...new Set(pairResults.map((row) => String(row.status))),
    ]
      .sort()
      .map((status) => [
        status,
        pairResults.filter((row) => row.status === status).length,
      ]),
  );
  const candidateReviewGroups = new Set(
    candidateClaims.map((row) => String(row.reviewKey)),
  );

  const report = {
    schemaVersion:
      'historical-density-p2-remaining-applicability-candidate-audit-v1',
    generatedAt: new Date().toISOString(),
    issue: 718,
    frozenInputs: {
      targetUniverseArtifactId: TARGET_UNIVERSE_ARTIFACT_ID,
      targetUniverseArtifactDigest: TARGET_UNIVERSE_DIGEST,
      semanticReviewRunId: SEMANTIC_REVIEW_RUN_ID,
      semanticReviewArtifactId: SEMANTIC_REVIEW_ARTIFACT_ID,
      semanticReviewArtifactDigest: SEMANTIC_REVIEW_DIGEST,
      semanticReviewCohortIntegritySha256:
        SEMANTIC_REVIEW_COHORT_INTEGRITY,
    },
    cohort: {
      target2021Rows: targetRows.length,
      novelSemanticGroups: novelGroups.length,
      membershipsWithNovelSemanticGroups:
        groupsByMembership.size,
      relevantMemberEventRows: relevantRows.length,
      eligibleMemberEventRows: eligibleMemberEventKeys.size,
      eligibleClaimEventPairs: eligiblePairs.length,
      uniqueTargetEventsFetched: events.length,
    },
    sourceVerification: {
      events: eventSources.size,
      statusCounts: sourceStatusCounts,
      strictRule:
        'latest exact official Revisor bill version with postedOn < target vote date',
      currentBillTitleUsed: false,
      sameDayVersionEligible: false,
    },
    candidateScreen: {
      pairStatusCounts,
      candidateClaimPairs: candidateClaims.length,
      candidateReviewGroups: candidateReviewGroups.size,
      candidateBills: new Set(
        candidateClaims.map((row) => row.billId),
      ).size,
      candidateMemberships: new Set(
        candidateClaims.map((row) => row.membershipId),
      ).size,
      candidateSemanticGroups: new Set(
        candidateClaims.map((row) => row.semanticKey),
      ).size,
      automaticApplicableRows: 0,
      automaticAlignmentRows: 0,
      nextStep:
        'semantic review of candidate groups against exact strict-pre-vote bill text; incidental, mixed, omnibus, or unclear bill policy fails closed',
    },
    novelSemanticGroups: novelGroups.map((group) => ({
      semanticKey: group.semanticKey,
      membershipId: group.membershipId,
      memberName: group.memberName,
      sourceRows: group.sourceRows,
      earliestAvailability: group.earliestAvailability,
      stance: group.stance,
      normalizedClaim: group.normalizedClaim,
      topics: group.topics,
      claimType: group.claimType,
      explicitness: group.explicitness,
      extractionConfidence: group.extractionConfidence,
      candidatePatternLabels:
        ruleMap
          .get(group.semanticKey)!
          .candidatePatterns.map((pattern) => pattern.label),
    })),
    candidateClaims,
    pairResults,
    policy: {
      outcomeUse: 'none',
      inputTargetRowsContainOutcomes: false,
      onlyNovelSemanticGroupsScreened: true,
      crossBatchDuplicatesScreened: false,
      sourceDiscovery: 'official Minnesota Revisor only',
      sourceBodiesFetched: true,
      productionDatabaseQueried: false,
      productionWrites: false,
      vercelUsed: false,
      billIdentifiersInferredFromMemberClaims: false,
      currentMutableBillTitleUsed: false,
      currentCompanionMetadataUsed: false,
      sameDayBillVersionsExcluded: true,
      deterministicScreenCanDeclareApplicability: false,
      semanticReviewRequiredForApplicability: true,
      contextOnly: true,
      mechanicallyActionable: false,
      modelWeight: 0,
      modelFitting: 'none',
      servingChanged: false,
    },
    contentSha256WithoutSelfField: null as string | null,
  };

  const outputDir = requiredEnv(
    'VOTEPREDICT_P2_REMAINING_APPLICABILITY_OUTPUT_DIR',
  );
  mkdirSync(outputDir, { recursive: true });
  const canonicalWithoutSha = JSON.stringify(report, null, 2) + '\n';
  report.contentSha256WithoutSelfField = createHash('sha256')
    .update(canonicalWithoutSha)
    .digest('hex');
  writeFileSync(
    resolve(outputDir, OUTPUT_FILE),
    JSON.stringify(report, null, 2) + '\n',
  );

  console.log(
    JSON.stringify(
      {
        historicalDensityP2RemainingApplicabilityCandidateAudit: {
          novelSemanticGroups: novelGroups.length,
          membershipsWithNovelSemanticGroups:
            groupsByMembership.size,
          relevantMemberEventRows: relevantRows.length,
          eligibleMemberEventRows: eligibleMemberEventKeys.size,
          eligibleClaimEventPairs: eligiblePairs.length,
          sourceStatusCounts,
          pairStatusCounts,
          candidateClaimPairs: candidateClaims.length,
          candidateReviewGroups: candidateReviewGroups.size,
          candidateBills: report.candidateScreen.candidateBills,
          candidateMemberships:
            report.candidateScreen.candidateMemberships,
          candidateSemanticGroups:
            report.candidateScreen.candidateSemanticGroups,
          automaticApplicableRows: 0,
          outcomeUse: 'none',
          productionDatabaseQueried: false,
          vercelUsed: false,
          servingChanged: false,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(safeMessage(error));
  process.exitCode = 1;
});
