import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  P2_ACCEPTED_CLAIM_FEATURE_METADATA,
} from '../src/evidence/historical-density-p2-canonical.js';

const EXPECTED_ELIGIBLE_ROWS = 3923;
const EXPECTED_CANDIDATE_PAIRS = 105;
const EXPECTED_CANDIDATE_GROUPS = 74;
const EXPECTED_EXPLICIT_REVIEW_KEYS = 74;
const OUTPUT_FILE = 'historical-density-p2-applicability-canonical-v1.json';

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
  status:
    | 'candidate_for_semantic_review'
    | 'not_applicable'
    | 'ambiguous_fail_closed';
  reason: string;
  candidateClaimIds: string[];
  [key: string]: unknown;
};

type CandidateAudit = {
  schemaVersion: string;
  issue: number;
  cohort: {
    eligibleMemberEventRows: number;
  };
  candidateScreen: {
    candidateMemberEvents: number;
    candidateClaimPairs: number;
    automaticApplicableRows: number;
    automaticAlignmentRows: number;
  };
  candidateClaims: CandidateClaim[];
  memberEvents: MemberEvent[];
  policy: {
    outcomeUse: string;
    inputTargetRowsContainOutcomes: boolean;
    productionDatabaseQueried: boolean;
    productionWrites: boolean;
    vercelUsed: boolean;
    sameDayBillVersionsExcluded: boolean;
    deterministicScreenCanDeclareApplicability: boolean;
    semanticReviewRequiredForApplicability: boolean;
    modelFitting: string;
    servingChanged: boolean;
  };
  frozenInputs: Record<string, unknown>;
};

type DecisionName =
  | 'applicable'
  | 'ambiguous_fail_closed'
  | 'not_applicable'
  | 'pending_review';

type GateDecision = {
  reviewKey: string;
  decision: Exclude<DecisionName, 'pending_review'>;
  reasonCode: string;
  billPolicyDirection: string | null;
  alignmentDirection:
    | 'position_aligns_with_bill'
    | 'position_conflicts_with_bill'
    | null;
};

type DecisionGate = {
  schemaVersion: string;
  issue: number;
  decisions: GateDecision[];
  policy: {
    unlistedCandidateGroup: string;
    crossReviewDisagreement: string;
    onlyApplicableMayReachMatrix: boolean;
    outcomeUse: string;
    sameDayVersionEligible: boolean;
    productionDatabaseQueried: boolean;
    productionWrites: boolean;
    vercelUsed: boolean;
    modelFitting: string;
    servingChanged: boolean;
  };
};

type CanonicalGroup = {
  reviewKey: string;
  decision: DecisionName;
  reasonCode: string;
  billPolicyDirection: string | null;
  alignmentDirection:
    | 'position_aligns_with_bill'
    | 'position_conflicts_with_bill'
    | null;
  issueFamily: string;
  identifier: string;
  billId: string;
  occurredOn: string;
  versionTextSha256: string;
  versionUrl: string;
  versionPostedOn: string;
  candidatePairs: number;
  voteEventIds: string[];
  memberships: Array<{
    voteEventId: string;
    membershipId: string;
    memberName: string;
    claimId: string;
    sourceRows: number[];
    claimAvailableAt: string;
    memberStance: 'supports' | 'opposes';
    normalizedClaim: string;
    chamber: string;
  }>;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function makeReviewKey(issueFamily: string, identifier: string, occurredOn: string): string {
  return `${issueFamily}|${identifier}|${occurredOn}`;
}

function countGroups(
  groups: readonly CanonicalGroup[],
): Record<DecisionName, { groups: number; pairs: number }> {
  const result: Record<DecisionName, { groups: number; pairs: number }> = {
    applicable: { groups: 0, pairs: 0 },
    ambiguous_fail_closed: { groups: 0, pairs: 0 },
    not_applicable: { groups: 0, pairs: 0 },
    pending_review: { groups: 0, pairs: 0 },
  };
  for (const group of groups) {
    result[group.decision].groups += 1;
    result[group.decision].pairs += group.candidatePairs;
  }
  return result;
}

function main() {
  const candidatePath = requiredEnv('VOTEPREDICT_P2_APPLICABILITY_CANDIDATE_PATH');
  const decisionPath = requiredEnv('VOTEPREDICT_P2_APPLICABILITY_DECISION_PATH');
  const outputDir = requiredEnv('VOTEPREDICT_P2_CANONICAL_REVIEW_OUTPUT_DIR');
  const audit = JSON.parse(readFileSync(candidatePath, 'utf8')) as CandidateAudit;
  const gate = JSON.parse(readFileSync(decisionPath, 'utf8')) as DecisionGate;

  if (
    gate.schemaVersion !== 'historical-density-p2-applicability-decision-gate-v1'
    || gate.issue !== 718
    || gate.decisions.length !== EXPECTED_EXPLICIT_REVIEW_KEYS
    || gate.policy.unlistedCandidateGroup !== 'pending_review_fail_closed_unavailable'
    || gate.policy.crossReviewDisagreement !== 'ambiguous_fail_closed_unavailable'
    || !gate.policy.onlyApplicableMayReachMatrix
    || gate.policy.outcomeUse !== 'none'
    || gate.policy.sameDayVersionEligible
    || gate.policy.productionDatabaseQueried
    || gate.policy.productionWrites
    || gate.policy.vercelUsed
    || gate.policy.modelFitting !== 'none'
    || gate.policy.servingChanged
  ) {
    throw new Error('Canonical decision-gate identity/policy drifted');
  }

  const decisionMap = new Map<string, GateDecision>();
  for (const decision of gate.decisions) {
    if (decisionMap.has(decision.reviewKey)) {
      throw new Error(`Duplicate decision-gate key: ${decision.reviewKey}`);
    }
    if (decision.decision === 'applicable') {
      if (!decision.billPolicyDirection || !decision.alignmentDirection) {
        throw new Error(`Applicable gate row lacks direction/alignment: ${decision.reviewKey}`);
      }
    } else if (decision.billPolicyDirection !== null || decision.alignmentDirection !== null) {
      throw new Error(`Fail-closed gate row unexpectedly has direction/alignment: ${decision.reviewKey}`);
    }
    decisionMap.set(decision.reviewKey, decision);
  }

  if (
    audit.schemaVersion !== 'historical-density-p2-applicability-candidate-audit-v1'
    || audit.issue !== 718
    || audit.cohort.eligibleMemberEventRows !== EXPECTED_ELIGIBLE_ROWS
    || audit.candidateScreen.candidateMemberEvents !== EXPECTED_CANDIDATE_PAIRS
    || audit.candidateScreen.candidateClaimPairs !== EXPECTED_CANDIDATE_PAIRS
    || audit.candidateScreen.automaticApplicableRows !== 0
    || audit.candidateScreen.automaticAlignmentRows !== 0
    || audit.policy.outcomeUse !== 'none'
    || audit.policy.inputTargetRowsContainOutcomes
    || audit.policy.productionDatabaseQueried
    || audit.policy.productionWrites
    || audit.policy.vercelUsed
    || !audit.policy.sameDayBillVersionsExcluded
    || audit.policy.deterministicScreenCanDeclareApplicability
    || !audit.policy.semanticReviewRequiredForApplicability
    || audit.policy.modelFitting !== 'none'
    || audit.policy.servingChanged
  ) {
    throw new Error('Candidate audit identity/policy drifted');
  }

  const grouped = new Map<string, CandidateClaim[]>();
  for (const claim of audit.candidateClaims) {
    if (
      !claim.candidateOnly
      || claim.applicabilityDecision !== 'pending_semantic_review'
      || claim.billPolicyDirection !== 'not_inferred_by_candidate_screen'
      || claim.alignmentDirection !== 'not_inferred_by_candidate_screen'
      || !claim.versionProof.strictlyBeforeVoteDate
      || !claim.versionProof.textSha256
      || !claim.versionProof.versionUrl
      || !claim.versionProof.postedOn
      || !(claim.versionProof.postedOn < claim.occurredOn)
    ) {
      throw new Error(`Candidate safety/provenance drifted: ${claim.claimId} ${claim.identifier}`);
    }

    const key = makeReviewKey(
      claim.issueFamily,
      claim.identifier,
      claim.occurredOn,
    );
    const values = grouped.get(key) ?? [];
    values.push(claim);
    grouped.set(key, values);
  }

  if (grouped.size !== EXPECTED_CANDIDATE_GROUPS) {
    throw new Error(
      `Expected ${EXPECTED_CANDIDATE_GROUPS} candidate groups, found ${grouped.size}`,
    );
  }

  const groups: CanonicalGroup[] = [...grouped.entries()]
    .map(([reviewKey, claims]) => {
      const billIds = unique(claims.map((claim) => claim.billId));
      const identifiers = unique(claims.map((claim) => claim.identifier));
      const issueFamilies = unique(claims.map((claim) => claim.issueFamily));
      const dates = unique(claims.map((claim) => claim.occurredOn));
      const versionHashes = unique(
        claims.map((claim) => claim.versionProof.textSha256!),
      );
      const versionUrls = unique(
        claims.map((claim) => claim.versionProof.versionUrl!),
      );
      const versionDates = unique(
        claims.map((claim) => claim.versionProof.postedOn!),
      );
      if (
        billIds.length !== 1
        || identifiers.length !== 1
        || issueFamilies.length !== 1
        || dates.length !== 1
        || versionHashes.length !== 1
        || versionUrls.length !== 1
        || versionDates.length !== 1
      ) {
        throw new Error(`Candidate group lacks exact stable provenance: ${reviewKey}`);
      }

      const decision = decisionMap.get(reviewKey) ?? {
        reviewKey,
        decision: 'pending_review' as const,
        reasonCode: 'unreviewed_candidate_group',
        billPolicyDirection: null,
        alignmentDirection: null,
      };
      if (decision.decision === 'applicable') {
        if (!decision.billPolicyDirection || !decision.alignmentDirection) {
          throw new Error(`Applicable group lacks direction/alignment: ${reviewKey}`);
        }
      } else if (
        decision.billPolicyDirection !== null
        || decision.alignmentDirection !== null
      ) {
        throw new Error(`Fail-closed group has direction/alignment: ${reviewKey}`);
      }

      return {
        reviewKey,
        decision: decision.decision,
        reasonCode: decision.reasonCode,
        billPolicyDirection: decision.billPolicyDirection,
        alignmentDirection: decision.alignmentDirection,
        issueFamily: issueFamilies[0]!,
        identifier: identifiers[0]!,
        billId: billIds[0]!,
        occurredOn: dates[0]!,
        versionTextSha256: versionHashes[0]!,
        versionUrl: versionUrls[0]!,
        versionPostedOn: versionDates[0]!,
        candidatePairs: claims.length,
        voteEventIds: unique(claims.map((claim) => claim.voteEventId)).sort(),
        memberships: claims
          .map((claim) => ({
            voteEventId: claim.voteEventId,
            membershipId: claim.membershipId,
            memberName: claim.memberName,
            claimId: claim.claimId,
            sourceRows: claim.sourceRows,
            claimAvailableAt: claim.claimAvailableAt,
            memberStance: claim.memberStance,
            normalizedClaim: claim.normalizedClaim,
            chamber: claim.chamber,
          }))
          .sort(
            (a, b) =>
              a.voteEventId.localeCompare(b.voteEventId)
              || a.membershipId.localeCompare(b.membershipId)
              || a.claimId.localeCompare(b.claimId),
          ),
      };
    })
    .sort((a, b) => a.reviewKey.localeCompare(b.reviewKey));

  const decisionCounts = countGroups(groups);
  const expectedCounts = {
    applicable: { groups: 2, pairs: 2 },
    ambiguous_fail_closed: { groups: 9, pairs: 10 },
    not_applicable: { groups: 63, pairs: 93 },
    pending_review: { groups: 0, pairs: 0 },
  };
  if (JSON.stringify(decisionCounts) !== JSON.stringify(expectedCounts)) {
    throw new Error(
      `Canonical decision counts drifted: ${JSON.stringify(decisionCounts)}`,
    );
  }

  const applicableKeys = groups
    .filter((group) => group.decision === 'applicable')
    .map((group) => group.reviewKey)
    .sort();
  const expectedApplicableKeys = [
    'gas_tax|HF1684|2021-04-22',
    'school_choice_parental_control|SF2575|2022-03-03',
  ].sort();
  if (JSON.stringify(applicableKeys) !== JSON.stringify(expectedApplicableKeys)) {
    throw new Error(`Applicable allowlist drifted: ${applicableKeys.join(',')}`);
  }

  const candidateKeys = new Set(groups.map((group) => group.reviewKey));
  const extraDecisionKeys = [...decisionMap.keys()].filter((key) => !candidateKeys.has(key));
  if (extraDecisionKeys.length) {
    throw new Error(`Decision gate contains non-candidate keys: ${extraDecisionKeys.join(',')}`);
  }

  const explicitlyReviewedGroups =
    groups.length - decisionCounts.pending_review.groups;
  if (explicitlyReviewedGroups !== EXPECTED_EXPLICIT_REVIEW_KEYS) {
    throw new Error(
      `Explicit reviewed group count drifted: ${explicitlyReviewedGroups}`,
    );
  }

  const groupByKey = new Map(groups.map((group) => [group.reviewKey, group]));
  const candidateByEventMembership = new Map<string, CandidateClaim>();
  for (const claim of audit.candidateClaims) {
    const key = `${claim.voteEventId}|${claim.membershipId}`;
    if (candidateByEventMembership.has(key)) {
      throw new Error(`Multiple candidate claims for member-event ${key}`);
    }
    candidateByEventMembership.set(key, claim);
  }

  const finalMemberEvents = audit.memberEvents.map((event) => {
    if (event.status !== 'candidate_for_semantic_review') return { ...event };

    const eventKey = `${event.voteEventId}|${event.membershipId}`;
    const claim = candidateByEventMembership.get(eventKey);
    if (!claim) throw new Error(`Missing candidate claim for ${eventKey}`);

    const reviewKey = makeReviewKey(
      claim.issueFamily,
      claim.identifier,
      claim.occurredOn,
    );
    const group = groupByKey.get(reviewKey);
    if (!group) throw new Error(`Missing canonical group ${reviewKey}`);

    if (group.decision === 'applicable') {
      return {
        ...event,
        status: 'applicable',
        reason: 'canonical_reviewed_applicability',
        reviewKey,
        claimId: claim.claimId,
        alignmentDirection: group.alignmentDirection,
        billPolicyDirection: group.billPolicyDirection,
        versionTextSha256: group.versionTextSha256,
      };
    }
    if (group.decision === 'ambiguous_fail_closed') {
      return {
        ...event,
        status: 'ambiguous_fail_closed',
        reason: group.reasonCode,
        reviewKey,
        claimId: claim.claimId,
      };
    }
    if (group.decision === 'pending_review') {
      return {
        ...event,
        status: 'pending_review',
        reason: group.reasonCode,
        reviewKey,
        claimId: claim.claimId,
      };
    }
    return {
      ...event,
      status: 'not_applicable',
      reason: group.reasonCode,
      reviewKey,
      claimId: claim.claimId,
    };
  });

  const finalStatusCounts = Object.fromEntries(
    ['applicable', 'ambiguous_fail_closed', 'pending_review', 'not_applicable']
      .map((status) => [
        status,
        finalMemberEvents.filter((row) => row.status === status).length,
      ]),
  );
  const expectedFinal = {
    applicable: 2,
    ambiguous_fail_closed: 40,
    pending_review: 0,
    not_applicable: 3881,
  };
  if (JSON.stringify(finalStatusCounts) !== JSON.stringify(expectedFinal)) {
    throw new Error(
      `Final member-event counts drifted: ${JSON.stringify(finalStatusCounts)}`,
    );
  }

  const applicableRows = groups
    .filter((group) => group.decision === 'applicable')
    .flatMap((group) =>
      group.memberships.map((membership) => {
        const featureMetadata =
          P2_ACCEPTED_CLAIM_FEATURE_METADATA[
            membership.claimId as keyof typeof P2_ACCEPTED_CLAIM_FEATURE_METADATA
          ];
        if (!featureMetadata) {
          throw new Error(
            `Missing frozen feature metadata for accepted claim ${membership.claimId}`,
          );
        }
        return {
          reviewKey: group.reviewKey,
          voteEventId: membership.voteEventId,
          membershipId: membership.membershipId,
          memberName: membership.memberName,
          claimId: membership.claimId,
          sourceRows: membership.sourceRows,
          claimAvailableAt: membership.claimAvailableAt,
          memberStance: membership.memberStance,
          normalizedClaim: membership.normalizedClaim,
          chamber: membership.chamber,
          billId: group.billId,
          identifier: group.identifier,
          occurredOn: group.occurredOn,
          issueFamily: group.issueFamily,
          alignmentDirection: group.alignmentDirection!,
          billPolicyDirection: group.billPolicyDirection!,
          versionTextSha256: group.versionTextSha256,
          versionUrl: group.versionUrl,
          versionPostedOn: group.versionPostedOn,
          claimFeatureMetadata: featureMetadata,
          contextOnly: true,
          mechanicallyActionable: false,
          modelWeight: 0,
        };
      }),
    )
    .sort(
      (a, b) =>
        a.voteEventId.localeCompare(b.voteEventId)
        || a.membershipId.localeCompare(b.membershipId),
    );

  if (applicableRows.length !== 2) {
    throw new Error(`Expected 2 applicable rows, found ${applicableRows.length}`);
  }

  const report = {
    schemaVersion: 'historical-density-p2-applicability-canonical-v1',
    generatedAt: new Date().toISOString(),
    issue: 718,
    frozenCandidateInputs: audit.frozenInputs,
    summary: {
      eligibleMemberEventRows: EXPECTED_ELIGIBLE_ROWS,
      candidateGroups: groups.length,
      candidatePairs: EXPECTED_CANDIDATE_PAIRS,
      explicitlyReviewedGroups,
      pendingReviewGroups: decisionCounts.pending_review.groups,
      decisions: decisionCounts,
      finalStatusCounts,
      applicableRows: applicableRows.length,
      applicableReviewKeys: applicableKeys,
      disputedFailClosedKeys: [
        'long_term_care_protections|SF443|2021-04-21',
      ],
    },
    applicableRows,
    groups,
    finalMemberEvents,
    policy: {
      outcomeUse: 'none',
      inputContainsVoteOutcomes: false,
      strictPreVoteVersionRequired: true,
      sameDayVersionEligible: false,
      currentMutableBillTitleUsed: false,
      unresolvedGroupsTreatment: 'pending_review_fail_closed_unavailable',
      crossReviewDisagreementTreatment: 'ambiguous_fail_closed_unavailable',
      candidateScreenCanAutoAccept: false,
      onlyApplicableRowsMayReachMatrixOverlay: true,
      exactBillEvidenceSemanticsRemainSeparate: true,
      productionDatabaseQueried: false,
      productionWrites: false,
      vercelUsed: false,
      contextOnly: true,
      mechanicallyActionable: false,
      modelWeight: 0,
      modelFitting: 'none',
      servingChanged: false,
    },
    contentSha256WithoutSelfField: null as string | null,
  };

  mkdirSync(outputDir, { recursive: true });
  const canonicalWithoutSha = JSON.stringify(report, null, 2) + '\n';
  report.contentSha256WithoutSelfField = createHash('sha256')
    .update(canonicalWithoutSha)
    .digest('hex');
  writeFileSync(
    resolve(outputDir, OUTPUT_FILE),
    JSON.stringify(report, null, 2) + '\n',
    'utf8',
  );

  console.log(
    JSON.stringify(
      {
        historicalDensityP2CanonicalApplicability: {
          candidateGroups: groups.length,
          candidatePairs: EXPECTED_CANDIDATE_PAIRS,
          explicitlyReviewedGroups,
          decisionCounts,
          finalStatusCounts,
          applicableReviewKeys: applicableKeys,
          outcomeUse: 'none',
          vercelUsed: false,
          productionDatabaseQueried: false,
          servingChanged: false,
        },
      },
      null,
      2,
    ),
  );
}

main();
