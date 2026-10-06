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
  applicabilityPatternHits,
  applicabilitySnippet,
  type P2ApplicabilityClaimRule,
} from '../src/evidence/historical-density-p2-applicability.js';
import {
  P2_REMAINING_APPLICABILITY_RULES,
  P2_REMAINING_NOVEL_SEMANTIC_KEYS,
} from '../src/evidence/historical-density-p2-remaining-applicability.js';

const TARGET_SESSION = '2021-2022';
const EXPECTED_RAW_MEMBER_EVENT_ROWS = 1962;
const EXPECTED_ELIGIBLE_MEMBER_EVENT_ROWS = 1534;
const EXPECTED_ELIGIBLE_CLAIM_ROW_UPPER_BOUND = 2716;
const EXPECTED_EVENTS = 218;
const EXPECTED_BILLS = 176;
const EXPECTED_MEMBERSHIPS = 9;
const EXPECTED_SEMANTIC_GROUPS = 20;
const EXPECTED_NOVEL_GROUPS = 17;
const EXPECTED_DIRECTIONAL_DOCUMENTS = 28;
const EXPECTED_NON_DIRECTIONAL_DOCUMENTS = 12;
const EXPECTED_VERIFIED_EVENTS = 213;
const EXPECTED_NO_PREVOTE_VERSION_EVENTS = 5;
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

type SemanticGroup = {
  semanticKey: string;
  memberName: string;
  membershipId: string;
  sourceRows: number[];
  sourceDocumentIds: string[];
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
};

type SemanticReview = {
  schemaVersion: string;
  batchId: string;
  issue: number;
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

type ClaimInstance = P2ApplicabilityClaimRule & {
  membershipId: string;
  availableAt: string;
  sourceRows: readonly number[];
  extractionConfidence: number;
  explicitness: string;
  topics: readonly string[];
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
  return (error instanceof Error ? (error.stack ?? error.message) : String(error))
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

async function loadOutcomeBlindTargets(path: string): Promise<TargetRow[]> {
  const input = createInterface({
    input: createReadStream(path, 'utf8'),
    crlfDelay: Infinity,
  });
  const rows: TargetRow[] = [];
  for await (const line of input) {
    if (!line.trim()) continue;
    const parsed = JSON.parse(line) as Record<string, unknown>;
    const keys = Object.keys(parsed).sort();
    const expected = [...ALLOWED_TARGET_KEYS].sort();
    if (JSON.stringify(keys) !== JSON.stringify(expected)) {
      throw new Error(
        `Outcome-blind target row schema drifted; saw keys: ${keys.join(',')}`,
      );
    }
    rows.push(parsed as unknown as TargetRow);
  }
  return rows;
}

function buildClaimInstances(review: SemanticReview): ClaimInstance[] {
  const novelGroups = review.semanticGroups.filter(
    (group) => group.novelForApplicabilityScreen,
  );
  if (novelGroups.length !== EXPECTED_NOVEL_GROUPS) {
    throw new Error(`Novel semantic-group count drifted: ${novelGroups.length}`);
  }

  const groupByKey = new Map(
    novelGroups.map((group) => [group.semanticKey, group]),
  );
  const claims: ClaimInstance[] = [];

  for (const rule of P2_REMAINING_APPLICABILITY_RULES) {
    const group = groupByKey.get(rule.id);
    if (!group) throw new Error(`Missing frozen semantic group ${rule.id}`);

    if (
      group.memberName !== rule.memberName
      || group.stance !== rule.stance
      || group.normalizedClaim !== rule.normalizedClaim
      || JSON.stringify(group.sourceRows) !== JSON.stringify(rule.sourceRows)
      || group.linkage !== 'member_issue'
      || group.candidateBillIdentifiers.length !== 0
      || group.crossBatchDuplicateOf.length !== 0
      || !group.earliestAvailability
      || group.extractionConfidence !== 0.97
    ) {
      throw new Error(`Frozen semantic group drifted for ${rule.id}`);
    }

    claims.push({
      ...rule,
      membershipId: group.membershipId,
      availableAt: group.earliestAvailability,
      extractionConfidence: group.extractionConfidence,
      explicitness: group.explicitness,
      topics: group.topics,
    });
  }

  const ruleKeys = P2_REMAINING_APPLICABILITY_RULES.map((rule) => rule.id).sort();
  const frozenKeys = novelGroups.map((group) => group.semanticKey).sort();
  if (
    JSON.stringify(ruleKeys) !==
      JSON.stringify([...P2_REMAINING_NOVEL_SEMANTIC_KEYS])
    || JSON.stringify(ruleKeys) !== JSON.stringify(frozenKeys)
  ) {
    throw new Error('Novel applicability rule/frozen semantic-key set drifted');
  }

  return claims;
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
      const index = cursor;
      cursor += 1;
      if (index >= values.length) return;
      results[index] = await mapper(values[index]!);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, () => worker()),
  );
  return results;
}

async function materializeEventSources(
  events: TargetRow[],
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

  const rows = await mapLimit<TargetRow, readonly [string, EventSource]>(
    ordered,
    4,
    async (event) => {
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
          } satisfies EventSource,
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
          } satisfies EventSource,
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
          } satisfies EventSource,
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
          } satisfies EventSource,
        ] as const;
      }
    },
  );

  return new Map(rows);
}

function mainStatusCount(
  rows: readonly Record<string, unknown>[],
  status: string,
): number {
  return rows.filter((row) => row.status === status).length;
}

async function main() {
  const review = JSON.parse(
    readFileSync(
      requiredEnv('VOTEPREDICT_P2_REMAINING_SEMANTIC_REVIEW_PATH'),
      'utf8',
    ),
  ) as SemanticReview;

  if (
    review.schemaVersion !==
      'historical-density-p2-remaining-semantic-review-v1'
    || review.batchId !== 'EQV1-HISTORICAL-DENSITY-P2-002'
    || review.issue !== 718
    || review.summary.documents !== 40
    || review.summary.memberships !== 13
    || review.summary.directionalDocuments !== EXPECTED_DIRECTIONAL_DOCUMENTS
    || review.summary.nonDirectionalDocuments !== EXPECTED_NON_DIRECTIONAL_DOCUMENTS
    || review.summary.uniqueSemanticGroups !== EXPECTED_SEMANTIC_GROUPS
    || review.summary.crossBatchDuplicateSemanticGroups !== 3
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

  const claims = buildClaimInstances(review);
  if (claims.length !== EXPECTED_NOVEL_GROUPS) {
    throw new Error(`Claim instance count drifted: ${claims.length}`);
  }

  const claimMemberships = new Set(claims.map((claim) => claim.membershipId));
  if (claimMemberships.size !== EXPECTED_MEMBERSHIPS) {
    throw new Error(`Novel-claim membership count drifted: ${claimMemberships.size}`);
  }

  const targetRows = (
    await loadOutcomeBlindTargets(
      requiredEnv('VOTEPREDICT_P2_REMAINING_OUTCOME_BLIND_TARGET_PATH'),
    )
  ).filter(
    (row) =>
      row.session === TARGET_SESSION && claimMemberships.has(row.membershipId),
  );

  if (targetRows.length !== EXPECTED_RAW_MEMBER_EVENT_ROWS) {
    throw new Error(
      `Raw member-event row count mismatch: ${targetRows.length}`,
    );
  }
  if (new Set(targetRows.map((row) => row.membershipId)).size !== EXPECTED_MEMBERSHIPS) {
    throw new Error('Membership coverage drifted');
  }
  if (new Set(targetRows.map((row) => row.voteEventId)).size !== EXPECTED_EVENTS) {
    throw new Error('Event coverage drifted');
  }
  if (new Set(targetRows.map((row) => row.billId)).size !== EXPECTED_BILLS) {
    throw new Error('Bill coverage drifted');
  }

  const claimsByMembership = new Map<string, ClaimInstance[]>();
  for (const claim of claims) {
    const values = claimsByMembership.get(claim.membershipId) ?? [];
    values.push(claim);
    claimsByMembership.set(claim.membershipId, values);
  }

  const eligibleRows = targetRows.filter((row) =>
    (claimsByMembership.get(row.membershipId) ?? []).some(
      (claim) => claim.availableAt < row.occurredOn,
    ),
  );
  if (eligibleRows.length !== EXPECTED_ELIGIBLE_MEMBER_EVENT_ROWS) {
    throw new Error(
      `Eligible member-event row count mismatch: ${eligibleRows.length}`,
    );
  }

  const eligibleClaimRowUpperBound = targetRows.reduce(
    (count, row) =>
      count
      + (claimsByMembership.get(row.membershipId) ?? []).filter(
        (claim) => claim.availableAt < row.occurredOn,
      ).length,
    0,
  );
  if (eligibleClaimRowUpperBound !== EXPECTED_ELIGIBLE_CLAIM_ROW_UPPER_BOUND) {
    throw new Error(
      `Eligible claim-row upper bound drifted: ${eligibleClaimRowUpperBound}`,
    );
  }

  const events = [
    ...new Map(eligibleRows.map((row) => [row.voteEventId, row])).values(),
  ];
  if (events.length !== EXPECTED_EVENTS) {
    throw new Error(`Eligible event count drifted: ${events.length}`);
  }

  const eventSources = await materializeEventSources(events);
  const verifiedEvents = [...eventSources.values()].filter(
    (source) => source.status === 'verified',
  ).length;
  const noPreVoteEvents = [...eventSources.values()].filter(
    (source) => source.status === 'no_strict_prevote_version',
  ).length;
  const otherSourceFailures = [...eventSources.values()].filter(
    (source) =>
      source.status === 'status_fetch_failed'
      || source.status === 'version_fetch_failed',
  ).length;

  if (
    verifiedEvents !== EXPECTED_VERIFIED_EVENTS
    || noPreVoteEvents !== EXPECTED_NO_PREVOTE_VERSION_EVENTS
    || otherSourceFailures !== 0
  ) {
    throw new Error(
      `Official source verification drifted verified=${verifiedEvents} noPreVote=${noPreVoteEvents} failures=${otherSourceFailures}`,
    );
  }

  const memberEvents: Array<Record<string, unknown>> = [];
  const candidateClaims: Array<Record<string, unknown>> = [];

  for (const row of eligibleRows) {
    const directionalClaims = (claimsByMembership.get(row.membershipId) ?? [])
      .filter((claim) => claim.availableAt < row.occurredOn);

    if (!directionalClaims.length) {
      throw new Error(
        `Eligible row lacks an available novel claim: ${row.voteEventId}|${row.membershipId}`,
      );
    }

    const source = eventSources.get(row.voteEventId);
    if (!source) throw new Error(`Missing event source ${row.voteEventId}`);

    if (source.status !== 'verified' || !source.text) {
      memberEvents.push({
        ...row,
        status: 'ambiguous_fail_closed',
        reason: source.status,
        candidateSemanticKeys: [],
        versionProof: {
          statusUrl: source.statusUrl ?? null,
          versionUrl: source.versionUrl ?? null,
          versionPostedOn: source.versionPostedOn ?? null,
        },
      });
      continue;
    }

    const candidates: string[] = [];
    for (const claim of directionalClaims) {
      const hits = applicabilityPatternHits(source.text, claim);
      if (!hits.length) continue;

      candidates.push(claim.id);
      candidateClaims.push({
        voteEventId: row.voteEventId,
        membershipId: row.membershipId,
        memberName: claim.memberName,
        occurredOn: row.occurredOn,
        billId: row.billId,
        identifier: row.identifier,
        chamber: row.chamber,
        semanticKey: claim.id,
        sourceRows: claim.sourceRows,
        claimAvailableAt: claim.availableAt,
        memberStance: claim.stance,
        normalizedClaim: claim.normalizedClaim,
        issueFamily: claim.issueFamily,
        sourceTopics: claim.topics,
        sourceExplicitness: claim.explicitness,
        sourceExtractionConfidence: claim.extractionConfidence,
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
              && source.versionPostedOn < row.occurredOn,
          ),
        },
        termHits: hits.map((hit) => ({
          label: hit.label,
          match: hit.match,
          snippet: applicabilitySnippet(source.text!, hit),
        })),
      });
    }

    memberEvents.push({
      ...row,
      status: candidates.length
        ? 'candidate_for_semantic_review'
        : 'not_applicable',
      reason: candidates.length
        ? 'deterministic_issue_match_only'
        : 'bill_issue_not_nominated',
      candidateSemanticKeys: candidates,
    });
  }

  const statusCounts = Object.fromEntries(
    [
      'candidate_for_semantic_review',
      'ambiguous_fail_closed',
      'not_applicable',
    ].map((status) => [status, mainStatusCount(memberEvents, status)]),
  );
  const sourceStatusCounts = Object.fromEntries(
    [
      'verified',
      'no_strict_prevote_version',
      'status_fetch_failed',
      'version_fetch_failed',
    ].map((status) => [
      status,
      [...eventSources.values()].filter(
        (source) => source.status === status,
      ).length,
    ]),
  );

  const candidateMemberEvents = memberEvents.filter(
    (row) => row.status === 'candidate_for_semantic_review',
  );

  const output = {
    schemaVersion:
      'historical-density-p2-remaining-applicability-candidate-audit-v1',
    generatedAt: new Date().toISOString(),
    issue: 718,
    cohort: {
      rawMemberEventRows: targetRows.length,
      eligibleMemberEventRows: eligibleRows.length,
      eligibleClaimRowUpperBound,
      excludedBeforeAnyNovelClaimAvailability:
        targetRows.length - eligibleRows.length,
      uniqueEvents: events.length,
      uniqueBills: new Set(eligibleRows.map((row) => row.billId)).size,
      memberships: claimMemberships.size,
      novelSemanticGroups: claims.length,
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
      memberEventStatusCounts: statusCounts,
      candidateMemberEvents: candidateMemberEvents.length,
      candidateClaimPairs: candidateClaims.length,
      candidateBills: new Set(candidateClaims.map((row) => row.billId)).size,
      candidateMemberships: new Set(
        candidateClaims.map((row) => row.membershipId),
      ).size,
      candidateSemanticGroups: new Set(
        candidateClaims.map((row) => row.semanticKey),
      ).size,
      automaticApplicableRows: 0,
      automaticAlignmentRows: 0,
      nextStep:
        'semantic review of candidate claim pairs against exact pre-vote bill text; mixed, incidental, omnibus, and directionally unclear candidates fail closed',
    },
    claimRules: claims.map((claim) => ({
      semanticKey: claim.id,
      membershipId: claim.membershipId,
      memberName: claim.memberName,
      sourceRows: claim.sourceRows,
      availableAt: claim.availableAt,
      stance: claim.stance,
      normalizedClaim: claim.normalizedClaim,
      issueFamily: claim.issueFamily,
      candidatePatternLabels: claim.candidatePatterns.map(
        (pattern) => pattern.label,
      ),
    })),
    candidateClaims,
    memberEvents,
    policy: {
      outcomeUse: 'none',
      inputTargetRowsContainOutcomes: false,
      sourceDiscovery: 'official Minnesota Revisor only',
      sourceBodiesFetched: true,
      productionDatabaseQueried: false,
      productionWrites: false,
      vercelUsed: false,
      crossBatchDuplicateSemanticGroupsExcluded: true,
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
  const canonicalWithoutSha = JSON.stringify(output, null, 2) + '\n';
  output.contentSha256WithoutSelfField = createHash('sha256')
    .update(canonicalWithoutSha)
    .digest('hex');
  writeFileSync(
    resolve(outputDir, OUTPUT_FILE),
    JSON.stringify(output, null, 2) + '\n',
  );

  console.log(
    JSON.stringify(
      {
        historicalDensityP2RemainingApplicabilityCandidateAudit: {
          rawMemberEventRows: targetRows.length,
          eligibleMemberEventRows: eligibleRows.length,
          eligibleClaimRowUpperBound,
          events: events.length,
          candidateMemberEvents: candidateMemberEvents.length,
          candidateClaimPairs: candidateClaims.length,
          candidateBills: output.candidateScreen.candidateBills,
          candidateMemberships: output.candidateScreen.candidateMemberships,
          candidateSemanticGroups:
            output.candidateScreen.candidateSemanticGroups,
          sourceStatusCounts,
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
