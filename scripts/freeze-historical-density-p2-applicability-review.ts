import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  P2_APPLICABILITY_ACCEPTED_REVIEWS,
  reviewP2ApplicabilityCandidate,
} from '../src/evidence/historical-density-p2-applicability-review.js';

const INPUT_ARTIFACT_ID = 11390705696;
const INPUT_ARTIFACT_DIGEST = 'sha256:25fccbdac56f4f0598541e347a7af19e2c27ae3be7b89959f9e578087e370698';
const EXPECTED_ELIGIBLE_ROWS = 3923;
const EXPECTED_CANDIDATE_PAIRS = 105;
const EXPECTED_CANDIDATE_BILLS = 40;
const EXPECTED_CANDIDATE_MEMBERSHIPS = 6;
const EXPECTED_REVIEW_GROUPS = 77;
const EXPECTED_ACCEPTED = 3;
const EXPECTED_REJECTED_PAIRS = 102;
const EXPECTED_FINAL_NOT_APPLICABLE = 3890;
const EXPECTED_FINAL_AMBIGUOUS = 30;
const OUTPUT_FILE = 'historical-density-p2-applicability-review-v1.json';

type CandidateClaim = {
  voteEventId: string;
  membershipId: string;
  memberName: string;
  occurredOn: string;
  billId: string;
  identifier: string;
  chamber: string;
  claimId: string;
  sourceRows: number[];
  claimAvailableAt: string;
  memberStance: 'supports' | 'opposes';
  normalizedClaim: string;
  issueFamily: string;
  candidateOnly: boolean;
  applicabilityDecision: 'pending_semantic_review';
  billPolicyDirection: 'not_inferred_by_candidate_screen';
  alignmentDirection: 'not_inferred_by_candidate_screen';
  versionProof: {
    statusUrl?: string;
    versionUrl?: string;
    postedOn?: string;
    ordinal?: number;
    versionKey?: string;
    textSha256?: string;
    identityTitle?: string;
    strictlyBeforeVoteDate: boolean;
  };
  termHits: Array<{ label: string; match: string; snippet: string }>;
};

type MemberEvent = {
  voteEventId: string;
  membershipId: string;
  legislatorId: string;
  session: string;
  chamber: string;
  occurredOn: string;
  billId: string;
  identifier: string;
  status: 'candidate_for_semantic_review' | 'not_applicable' | 'ambiguous_fail_closed';
  reason: string;
  candidateClaimIds: string[];
  [key: string]: unknown;
};

type CandidateAudit = {
  schemaVersion: string;
  generatedAt: string;
  issue: number;
  frozenInputs: {
    targetUniverseArtifactId: number;
    targetUniverseArtifactDigest: string;
    p2ReviewArtifactId: number;
    p2ReviewArtifactDigest: string;
    p2ReviewIntegritySha256: string;
  };
  cohort: {
    rawMemberEventRows: number;
    eligibleMemberEventRows: number;
    excludedBeforeAnyFrozenSourceAvailability: number;
    uniqueEvents: number;
    uniqueBills: number;
    memberships: number;
    directionalSemanticGroups: number;
    directionalDocuments: number;
    screenableSemanticGroups: number;
    genericRejectedSemanticGroups: number;
  };
  sourceVerification: {
    events: number;
    statusCounts: Record<string, number>;
    strictRule: string;
    currentBillTitleUsed: boolean;
    sameDayVersionEligible: boolean;
  };
  candidateScreen: {
    memberEventStatusCounts: Record<string, number>;
    candidateMemberEvents: number;
    candidateClaimPairs: number;
    candidateBills: number;
    candidateMemberships: number;
    automaticApplicableRows: number;
    automaticAlignmentRows: number;
    nextStep: string;
  };
  candidateClaims: CandidateClaim[];
  memberEvents: MemberEvent[];
  policy: {
    outcomeUse: string;
    inputTargetRowsContainOutcomes: boolean;
    productionDatabaseQueried: boolean;
    productionWrites: boolean;
    vercelUsed: boolean;
    billIdentifiersInferredFromMemberClaims: boolean;
    currentMutableBillTitleUsed: boolean;
    currentCompanionMetadataUsed: boolean;
    sameDayBillVersionsExcluded: boolean;
    deterministicScreenCanDeclareApplicability: boolean;
    semanticReviewRequiredForApplicability: boolean;
    contextOnly: boolean;
    mechanicallyActionable: boolean;
    modelWeight: number;
    modelFitting: string;
    servingChanged: boolean;
  };
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function keyFor(claim: CandidateClaim): string {
  const hash = claim.versionProof.textSha256;
  if (!hash) throw new Error(`Candidate ${claim.voteEventId}/${claim.claimId} is missing strict version hash`);
  return `${claim.claimId}|${claim.identifier}|${hash}`;
}

function countBy<T>(rows: readonly T[], key: (row: T) => string): Record<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function main() {
  const input = JSON.parse(readFileSync(requiredEnv('VOTEPREDICT_P2_APPLICABILITY_CANDIDATE_PATH'), 'utf8')) as CandidateAudit;
  if (
    input.schemaVersion !== 'historical-density-p2-applicability-candidate-audit-v1'
    || input.issue !== 718
    || input.cohort.eligibleMemberEventRows !== EXPECTED_ELIGIBLE_ROWS
    || input.candidateScreen.candidateMemberEvents !== EXPECTED_CANDIDATE_PAIRS
    || input.candidateScreen.candidateClaimPairs !== EXPECTED_CANDIDATE_PAIRS
    || input.candidateScreen.candidateBills !== EXPECTED_CANDIDATE_BILLS
    || input.candidateScreen.candidateMemberships !== EXPECTED_CANDIDATE_MEMBERSHIPS
    || input.candidateScreen.automaticApplicableRows !== 0
    || input.candidateScreen.automaticAlignmentRows !== 0
    || input.policy.outcomeUse !== 'none'
    || input.policy.inputTargetRowsContainOutcomes
    || input.policy.productionDatabaseQueried
    || input.policy.productionWrites
    || input.policy.vercelUsed
    || input.policy.billIdentifiersInferredFromMemberClaims
    || input.policy.currentMutableBillTitleUsed
    || input.policy.currentCompanionMetadataUsed
    || !input.policy.sameDayBillVersionsExcluded
    || input.policy.deterministicScreenCanDeclareApplicability
    || !input.policy.semanticReviewRequiredForApplicability
    || !input.policy.contextOnly
    || input.policy.mechanicallyActionable
    || input.policy.modelWeight !== 0
    || input.policy.modelFitting !== 'none'
    || input.policy.servingChanged
  ) throw new Error('P2 applicability candidate audit policy/count drifted');

  const groupMap = new Map<string, CandidateClaim[]>();
  for (const claim of input.candidateClaims) {
    if (!claim.candidateOnly || claim.applicabilityDecision !== 'pending_semantic_review') {
      throw new Error(`Unexpected pre-decided candidate ${claim.voteEventId}/${claim.claimId}`);
    }
    if (!claim.versionProof.strictlyBeforeVoteDate || !claim.versionProof.postedOn || !(claim.versionProof.postedOn < claim.occurredOn)) {
      throw new Error(`Candidate ${claim.voteEventId}/${claim.claimId} lacks strict pre-vote version proof`);
    }
    const key = keyFor(claim);
    const rows = groupMap.get(key) ?? [];
    rows.push(claim);
    groupMap.set(key, rows);
  }
  if (groupMap.size !== EXPECTED_REVIEW_GROUPS) throw new Error(`Review-group count drifted: ${groupMap.size}`);

  const expectedGroupCounts: Record<string, number> = {
    'p2-coleman-gas-tax': 3,
    'p2-jasinski-long-term-care-protections': 30,
    'p2-koran-pro-life': 11,
    'p2-murphy-minnesotacare-for-all': 12,
    'p2-port-minnesotacare-for-all': 12,
    'p2-school-choice-parental-control': 9,
  };
  const actualGroupCounts = countBy([...groupMap.values()].map((rows) => rows[0]!), (row) => row.claimId);
  if (JSON.stringify(actualGroupCounts) !== JSON.stringify(expectedGroupCounts)) {
    throw new Error(`Candidate review-group distribution drifted: ${JSON.stringify(actualGroupCounts)}`);
  }

  const groupReviews = [...groupMap.entries()]
    .map(([groupKey, rows]) => {
      const first = rows[0]!;
      const review = reviewP2ApplicabilityCandidate({
        claimId: first.claimId,
        identifier: first.identifier,
        versionSha256: first.versionProof.textSha256!,
      });
      return {
        groupKey,
        claimId: first.claimId,
        memberName: first.memberName,
        membershipId: first.membershipId,
        identifier: first.identifier,
        billId: first.billId,
        versionSha256: first.versionProof.textSha256!,
        versionPostedOn: first.versionProof.postedOn!,
        versionUrl: first.versionProof.versionUrl ?? null,
        identityTitle: first.versionProof.identityTitle ?? null,
        sourceRows: first.sourceRows,
        memberStance: first.memberStance,
        normalizedClaim: first.normalizedClaim,
        issueFamily: first.issueFamily,
        voteEventIds: rows.map((row) => row.voteEventId).sort(),
        voteDates: [...new Set(rows.map((row) => row.occurredOn))].sort(),
        candidatePairs: rows.length,
        termHitLabels: [...new Set(rows.flatMap((row) => row.termHits.map((hit) => hit.label)))].sort(),
        decision: review.decision,
        alignment: review.alignment,
        billPolicyDirection: review.billPolicyDirection,
        rationale: review.rationale,
        reviewConfidence: review.reviewConfidence,
      };
    })
    .sort((a, b) => a.claimId.localeCompare(b.claimId)
      || a.identifier.localeCompare(b.identifier)
      || a.versionSha256.localeCompare(b.versionSha256));

  const acceptedGroups = groupReviews.filter((row) => row.decision === 'applicable');
  const rejectedGroups = groupReviews.filter((row) => row.decision === 'not_applicable');
  if (acceptedGroups.length !== EXPECTED_ACCEPTED || rejectedGroups.length !== EXPECTED_REVIEW_GROUPS - EXPECTED_ACCEPTED) {
    throw new Error('Reviewed applicability group counts drifted');
  }
  const acceptedPairKeys = new Set<string>();
  for (const group of acceptedGroups) {
    const candidates = groupMap.get(group.groupKey)!;
    for (const row of candidates) acceptedPairKeys.add(`${row.voteEventId}|${row.membershipId}|${row.claimId}`);
  }
  if (acceptedPairKeys.size !== EXPECTED_ACCEPTED) throw new Error(`Accepted candidate-pair count drifted: ${acceptedPairKeys.size}`);
  if (input.candidateClaims.length - acceptedPairKeys.size !== EXPECTED_REJECTED_PAIRS) {
    throw new Error('Rejected candidate-pair count drifted');
  }

  const candidateByEventMembership = new Map<string, CandidateClaim[]>();
  for (const claim of input.candidateClaims) {
    const eventKey = `${claim.voteEventId}|${claim.membershipId}`;
    const rows = candidateByEventMembership.get(eventKey) ?? [];
    rows.push(claim);
    candidateByEventMembership.set(eventKey, rows);
  }
  for (const [eventKey, rows] of candidateByEventMembership) {
    if (rows.length !== 1) throw new Error(`Expected exactly one candidate claim for ${eventKey}, found ${rows.length}`);
  }

  const finalMemberEvents = input.memberEvents.map((event) => {
    if (event.status !== 'candidate_for_semantic_review') return { ...event };
    const eventKey = `${event.voteEventId}|${event.membershipId}`;
    const candidate = candidateByEventMembership.get(eventKey)?.[0];
    if (!candidate) throw new Error(`Missing candidate claim for ${eventKey}`);
    const review = reviewP2ApplicabilityCandidate({
      claimId: candidate.claimId,
      identifier: candidate.identifier,
      versionSha256: candidate.versionProof.textSha256!,
    });
    if (review.decision === 'applicable') {
      return {
        ...event,
        status: 'applicable',
        reason: 'frozen_semantic_applicability_review',
        claimId: candidate.claimId,
        memberStance: candidate.memberStance,
        alignment: review.alignment,
        billPolicyDirection: review.billPolicyDirection,
        reviewConfidence: review.reviewConfidence,
        versionSha256: candidate.versionProof.textSha256,
        versionPostedOn: candidate.versionProof.postedOn,
      };
    }
    return {
      ...event,
      status: 'not_applicable',
      reason: 'frozen_semantic_review_rejected_candidate',
      rejectedClaimId: candidate.claimId,
    };
  });

  const finalStatusCounts = countBy(finalMemberEvents, (event) => String(event.status));
  if (
    finalStatusCounts.applicable !== EXPECTED_ACCEPTED
    || finalStatusCounts.ambiguous_fail_closed !== EXPECTED_FINAL_AMBIGUOUS
    || finalStatusCounts.not_applicable !== EXPECTED_FINAL_NOT_APPLICABLE
  ) throw new Error(`Final applicability counts drifted: ${JSON.stringify(finalStatusCounts)}`);

  const acceptedReviewKeys = P2_APPLICABILITY_ACCEPTED_REVIEWS
    .map((row) => `${row.claimId}|${row.identifier}|${row.versionSha256}`)
    .sort();
  const realizedAcceptedKeys = acceptedGroups.map((row) => row.groupKey).sort();
  if (JSON.stringify(acceptedReviewKeys) !== JSON.stringify(realizedAcceptedKeys)) {
    throw new Error('Accepted applicability identities do not match the frozen review allowlist');
  }

  const report = {
    schemaVersion: 'historical-density-p2-applicability-review-v1',
    generatedAt: new Date().toISOString(),
    issue: 718,
    frozenInput: {
      candidateAuditArtifactId: INPUT_ARTIFACT_ID,
      candidateAuditArtifactDigest: INPUT_ARTIFACT_DIGEST,
      candidateAuditSchemaVersion: input.schemaVersion,
      targetUniverseArtifactId: input.frozenInputs.targetUniverseArtifactId,
      targetUniverseArtifactDigest: input.frozenInputs.targetUniverseArtifactDigest,
      p2ReviewArtifactId: input.frozenInputs.p2ReviewArtifactId,
      p2ReviewArtifactDigest: input.frozenInputs.p2ReviewArtifactDigest,
      p2ReviewIntegritySha256: input.frozenInputs.p2ReviewIntegritySha256,
    },
    reviewSummary: {
      eligibleMemberEventRows: input.cohort.eligibleMemberEventRows,
      candidatePairsReviewed: input.candidateClaims.length,
      candidateReviewGroups: groupReviews.length,
      acceptedReviewGroups: acceptedGroups.length,
      rejectedReviewGroups: rejectedGroups.length,
      acceptedMemberEventRows: acceptedPairKeys.size,
      rejectedCandidatePairs: input.candidateClaims.length - acceptedPairKeys.size,
      finalStatusCounts,
      acceptedBills: [...new Set(acceptedGroups.map((row) => row.identifier))].sort(),
      acceptedMemberships: [...new Set(acceptedGroups.map((row) => row.membershipId))].sort(),
    },
    acceptedGroups,
    rejectedGroups,
    finalMemberEvents,
    policy: {
      outcomeUse: 'none',
      reviewBasis: 'frozen member/issue claims + exact strict-pre-vote official Revisor bill text from candidate audit only',
      currentBillTitleUsed: false,
      sameDayBillVersionsExcluded: true,
      currentCompanionMetadataUsed: false,
      broadIdeologyAppliedToBills: false,
      mixedOrIncidentalCandidatesFailClosed: true,
      exactVersionHashRequiredForAcceptance: true,
      candidateScreenCouldAutoAccept: false,
      productionDatabaseQueried: false,
      productionWrites: false,
      vercelUsed: false,
      contextOnly: true,
      mechanicallyActionable: false,
      modelWeight: 0,
      modelFitting: 'none',
      servingChanged: false,
      nextStep: 'build a new historical feature matrix/freeze using only the three exact accepted member-event applicability rows, then measure coverage before any outcome-aware modeling',
    },
    contentSha256WithoutSelfField: null as string | null,
  };

  const outputDir = requiredEnv('VOTEPREDICT_P2_APPLICABILITY_REVIEW_OUTPUT_DIR');
  mkdirSync(outputDir, { recursive: true });
  const canonical = JSON.stringify(report, null, 2) + '\n';
  report.contentSha256WithoutSelfField = createHash('sha256').update(canonical).digest('hex');
  writeFileSync(resolve(outputDir, OUTPUT_FILE), JSON.stringify(report, null, 2) + '\n');

  console.log(JSON.stringify({
    historicalDensityP2ApplicabilityReview: {
      eligibleMemberEventRows: input.cohort.eligibleMemberEventRows,
      candidatePairsReviewed: input.candidateClaims.length,
      reviewGroups: groupReviews.length,
      acceptedReviewGroups: acceptedGroups.length,
      rejectedReviewGroups: rejectedGroups.length,
      finalStatusCounts,
      acceptedBills: report.reviewSummary.acceptedBills,
      outcomeUse: 'none',
      productionWrites: false,
      vercelUsed: false,
      servingChanged: false,
    },
  }, null, 2));
}

main();
