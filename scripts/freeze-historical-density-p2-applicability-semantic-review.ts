import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  P2_APPLICABILITY_SEMANTIC_REVIEW_DECISIONS,
  p2ApplicabilityReviewKey,
  type P2ApplicabilitySemanticDecision,
} from '../src/evidence/historical-density-p2-applicability-semantic-review.js';

const EXPECTED_CANDIDATE_ARTIFACT_ID = 11390705696;
const EXPECTED_CANDIDATE_ARTIFACT_DIGEST = 'sha256:25fccbdac56f4f0598541e347a7af19e2c27ae3be7b89959f9e578087e370698';
const EXPECTED_CANDIDATE_RUN_ID = 37413584258;
const EXPECTED_CANDIDATE_HEAD_SHA = '04f68c19d92e4249cd36e76a6daf1ac3b94cfb53';
const EXPECTED_CANDIDATE_PAIRS = 105;
const EXPECTED_GROUPS = 65;
const EXPECTED_APPLICABLE_PAIRS = 2;
const EXPECTED_AMBIGUOUS_PAIRS = 9;
const EXPECTED_NOT_APPLICABLE_PAIRS = 94;
const EXPECTED_APPLICABLE_KEYS = [
  'gas_tax|HF1684|2021-04-22',
  'school_choice_parental_control|SF2575|2022-03-03',
] as const;
const OUTPUT_FILE = 'historical-density-p2-applicability-semantic-review-v1.json';

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
  applicabilityDecision: string;
  billPolicyDirection: string;
  alignmentDirection: string;
  versionProof: {
    statusUrl?: string;
    versionUrl?: string;
    postedOn?: string;
    ordinal?: number;
    versionKey?: string;
    textSha256?: string;
    identityTitle?: string;
    strictlyBeforeVoteDate?: boolean;
  };
  termHits: Array<{ label: string; match: string; snippet: string }>;
};

type CandidateAudit = {
  schemaVersion: string;
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
    candidateMemberEvents: number;
    candidateClaimPairs: number;
    candidateBills: number;
    candidateMemberships: number;
    automaticApplicableRows: number;
    automaticAlignmentRows: number;
  };
  candidateClaims: CandidateClaim[];
  policy: {
    outcomeUse: string;
    inputTargetRowsContainOutcomes: boolean;
    sourceDiscovery: string;
    sourceBodiesFetched: boolean;
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

function safeMessage(error: unknown): string {
  return (error instanceof Error ? (error.stack ?? error.message) : String(error))
    .replace(/https?:\/\/\S+/gi, '[source URL]')
    .slice(0, 1600);
}

function countsByDecision(
  groups: readonly { decision: P2ApplicabilitySemanticDecision; candidatePairCount: number }[],
): Record<P2ApplicabilitySemanticDecision, { groups: number; pairs: number }> {
  const result = {
    applicable: { groups: 0, pairs: 0 },
    not_applicable: { groups: 0, pairs: 0 },
    ambiguous_fail_closed: { groups: 0, pairs: 0 },
  } satisfies Record<P2ApplicabilitySemanticDecision, { groups: number; pairs: number }>;
  for (const group of groups) {
    result[group.decision].groups += 1;
    result[group.decision].pairs += group.candidatePairCount;
  }
  return result;
}

function main(): void {
  const inputPath = requiredEnv('VOTEPREDICT_P2_APPLICABILITY_CANDIDATE_AUDIT_PATH');
  const outputDir = requiredEnv('VOTEPREDICT_P2_APPLICABILITY_SEMANTIC_REVIEW_OUTPUT_DIR');
  const audit = JSON.parse(readFileSync(inputPath, 'utf8')) as CandidateAudit;

  if (
    audit.schemaVersion !== 'historical-density-p2-applicability-candidate-audit-v1'
    || audit.issue !== 718
    || audit.frozenInputs.targetUniverseArtifactId !== 11252079484
    || audit.frozenInputs.targetUniverseArtifactDigest !== 'sha256:22e8944cffc6fda553b05ea6ad5e92400d35fc01d83177efdd5d1204dd3c5a6f'
    || audit.frozenInputs.p2ReviewArtifactId !== 11383404277
    || audit.frozenInputs.p2ReviewArtifactDigest !== 'sha256:bc0c274ecc7705a47dda26f97d2f2c0a09643ac77b0a585ed63e0402ee4bd51c'
    || audit.cohort.eligibleMemberEventRows !== 3923
    || audit.cohort.memberships !== 18
    || audit.cohort.directionalSemanticGroups !== 14
    || audit.cohort.directionalDocuments !== 17
    || audit.candidateScreen.candidateClaimPairs !== EXPECTED_CANDIDATE_PAIRS
    || audit.candidateClaims.length !== EXPECTED_CANDIDATE_PAIRS
    || audit.candidateScreen.automaticApplicableRows !== 0
    || audit.candidateScreen.automaticAlignmentRows !== 0
  ) throw new Error('P2 applicability candidate audit identity/counts drifted');

  if (
    audit.policy.outcomeUse !== 'none'
    || audit.policy.inputTargetRowsContainOutcomes
    || audit.policy.productionDatabaseQueried
    || audit.policy.productionWrites
    || audit.policy.vercelUsed
    || audit.policy.billIdentifiersInferredFromMemberClaims
    || audit.policy.currentMutableBillTitleUsed
    || audit.policy.currentCompanionMetadataUsed
    || !audit.policy.sameDayBillVersionsExcluded
    || audit.policy.deterministicScreenCanDeclareApplicability
    || !audit.policy.semanticReviewRequiredForApplicability
    || !audit.policy.contextOnly
    || audit.policy.mechanicallyActionable
    || audit.policy.modelWeight !== 0
    || audit.policy.modelFitting !== 'none'
    || audit.policy.servingChanged
  ) throw new Error('P2 applicability candidate audit safety policy drifted');

  const grouped = new Map<string, CandidateClaim[]>();
  for (const claim of audit.candidateClaims) {
    if (
      !claim.candidateOnly
      || claim.applicabilityDecision !== 'pending_semantic_review'
      || claim.billPolicyDirection !== 'not_inferred_by_candidate_screen'
      || claim.alignmentDirection !== 'not_inferred_by_candidate_screen'
      || !claim.versionProof.strictlyBeforeVoteDate
      || !claim.versionProof.postedOn
      || claim.versionProof.postedOn >= claim.occurredOn
      || !claim.versionProof.textSha256
      || !claim.versionProof.versionUrl
      || claim.termHits.length === 0
    ) throw new Error(`Candidate claim safety/provenance drifted: ${claim.claimId} ${claim.identifier}`);

    const key = p2ApplicabilityReviewKey(claim.issueFamily, claim.identifier, claim.occurredOn);
    const values = grouped.get(key) ?? [];
    values.push(claim);
    grouped.set(key, values);
  }

  if (grouped.size !== EXPECTED_GROUPS) {
    throw new Error(`Expected ${EXPECTED_GROUPS} semantic review groups, found ${grouped.size}`);
  }

  const frozenKeys = Object.keys(P2_APPLICABILITY_SEMANTIC_REVIEW_DECISIONS).sort();
  const candidateKeys = [...grouped.keys()].sort();
  if (JSON.stringify(frozenKeys) !== JSON.stringify(candidateKeys)) {
    const missing = candidateKeys.filter((key) => !frozenKeys.includes(key));
    const extra = frozenKeys.filter((key) => !candidateKeys.includes(key));
    throw new Error(`Semantic review decision coverage mismatch: missing=${missing.join(',')} extra=${extra.join(',')}`);
  }

  const groups = candidateKeys.map((key) => {
    const claims = [...(grouped.get(key) ?? [])].sort((a, b) =>
      a.membershipId.localeCompare(b.membershipId) || a.claimId.localeCompare(b.claimId));
    const decision = P2_APPLICABILITY_SEMANTIC_REVIEW_DECISIONS[key]!;
    if (decision.decision === 'applicable') {
      if (!decision.billPolicyDirection || !decision.alignmentDirection) {
        throw new Error(`Applicable semantic review group lacks direction/alignment: ${key}`);
      }
    } else if (decision.billPolicyDirection !== null || decision.alignmentDirection !== null) {
      throw new Error(`Fail-closed/rejected semantic review group unexpectedly has direction/alignment: ${key}`);
    }

    const first = claims[0]!;
    const versionHashes = [...new Set(claims.map((claim) => claim.versionProof.textSha256))];
    const versionUrls = [...new Set(claims.map((claim) => claim.versionProof.versionUrl))];
    const versionDates = [...new Set(claims.map((claim) => claim.versionProof.postedOn))];
    const billIds = [...new Set(claims.map((claim) => claim.billId))];
    const voteEventIds = [...new Set(claims.map((claim) => claim.voteEventId))];
    if (
      versionHashes.length !== 1
      || versionUrls.length !== 1
      || versionDates.length !== 1
      || billIds.length !== 1
      || voteEventIds.length !== 1
    ) throw new Error(`Semantic review group provenance is not exact/stable: ${key}`);

    return {
      reviewKey: key,
      decision: decision.decision,
      reasonCode: decision.reasonCode,
      billPolicyDirection: decision.billPolicyDirection,
      alignmentDirection: decision.alignmentDirection,
      voteEventId: first.voteEventId,
      billId: first.billId,
      identifier: first.identifier,
      occurredOn: first.occurredOn,
      chamber: first.chamber,
      issueFamily: first.issueFamily,
      candidatePairCount: claims.length,
      memberships: claims.map((claim) => ({
        membershipId: claim.membershipId,
        memberName: claim.memberName,
        claimId: claim.claimId,
        sourceRows: claim.sourceRows,
        claimAvailableAt: claim.claimAvailableAt,
        memberStance: claim.memberStance,
        normalizedClaim: claim.normalizedClaim,
      })),
      versionProof: {
        statusUrl: first.versionProof.statusUrl ?? null,
        versionUrl: first.versionProof.versionUrl,
        postedOn: first.versionProof.postedOn,
        ordinal: first.versionProof.ordinal ?? null,
        versionKey: first.versionProof.versionKey ?? null,
        textSha256: first.versionProof.textSha256,
        identityTitle: first.versionProof.identityTitle ?? null,
        strictlyBeforeVoteDate: true,
      },
      termEvidence: claims.flatMap((claim) =>
        claim.termHits.map((hit) => ({
          membershipId: claim.membershipId,
          claimId: claim.claimId,
          label: hit.label,
          match: hit.match,
          snippet: hit.snippet,
        }))),
    };
  });

  const counts = countsByDecision(groups);
  if (
    counts.applicable.pairs !== EXPECTED_APPLICABLE_PAIRS
    || counts.ambiguous_fail_closed.pairs !== EXPECTED_AMBIGUOUS_PAIRS
    || counts.not_applicable.pairs !== EXPECTED_NOT_APPLICABLE_PAIRS
  ) {
    throw new Error(`Pair-level semantic decision counts drifted: ${JSON.stringify(counts)}`);
  }
  if (groups.reduce((count, group) => count + group.candidatePairCount, 0) !== EXPECTED_CANDIDATE_PAIRS) {
    throw new Error('Semantic review pair accounting does not sum to frozen candidate-pair total');
  }

  const applicableKeys = groups
    .filter((group) => group.decision === 'applicable')
    .map((group) => group.reviewKey)
    .sort();
  if (JSON.stringify(applicableKeys) !== JSON.stringify([...EXPECTED_APPLICABLE_KEYS].sort())) {
    throw new Error(`Applicable semantic review keys drifted: ${applicableKeys.join(',')}`);
  }

  const applicableRows = groups
    .filter((group) => group.decision === 'applicable')
    .flatMap((group) => group.memberships.map((membership) => ({
      voteEventId: group.voteEventId,
      billId: group.billId,
      identifier: group.identifier,
      occurredOn: group.occurredOn,
      chamber: group.chamber,
      membershipId: membership.membershipId,
      memberName: membership.memberName,
      claimId: membership.claimId,
      sourceRows: membership.sourceRows,
      claimAvailableAt: membership.claimAvailableAt,
      memberStance: membership.memberStance,
      issueFamily: group.issueFamily,
      billPolicyDirection: group.billPolicyDirection,
      alignmentDirection: group.alignmentDirection,
      versionTextSha256: group.versionProof.textSha256,
      versionUrl: group.versionProof.versionUrl,
      versionPostedOn: group.versionProof.postedOn,
      contextOnly: true,
      mechanicallyActionable: false,
      modelWeight: 0,
    })));

  const report = {
    schemaVersion: 'historical-density-p2-applicability-semantic-review-v1',
    generatedAt: new Date().toISOString(),
    issue: 718,
    lineage: {
      candidateAuditRunId: EXPECTED_CANDIDATE_RUN_ID,
      candidateAuditArtifactId: EXPECTED_CANDIDATE_ARTIFACT_ID,
      candidateAuditArtifactDigest: EXPECTED_CANDIDATE_ARTIFACT_DIGEST,
      candidateAuditHeadSha: EXPECTED_CANDIDATE_HEAD_SHA,
      candidateAuditSchemaVersion: audit.schemaVersion,
      targetUniverseArtifactId: audit.frozenInputs.targetUniverseArtifactId,
      targetUniverseArtifactDigest: audit.frozenInputs.targetUniverseArtifactDigest,
      p2ReviewArtifactId: audit.frozenInputs.p2ReviewArtifactId,
      p2ReviewArtifactDigest: audit.frozenInputs.p2ReviewArtifactDigest,
      p2ReviewIntegritySha256: audit.frozenInputs.p2ReviewIntegritySha256,
    },
    summary: {
      candidateGroups: groups.length,
      candidatePairs: EXPECTED_CANDIDATE_PAIRS,
      decisions: counts,
      applicableRows: applicableRows.length,
      applicableReviewKeys: applicableKeys,
    },
    applicableRows,
    groups,
    policy: {
      semanticReviewFrozen: true,
      outcomeUse: 'none',
      inputContainsVoteOutcomes: false,
      billTextSource: 'exact official Minnesota Revisor version already frozen by candidate audit',
      strictPreVoteVersionRequired: true,
      sameDayVersionEligible: false,
      currentMutableBillTitleUsed: false,
      productionDatabaseQueried: false,
      productionWrites: false,
      vercelUsed: false,
      ambiguousTreatment: 'fail_closed_unavailable_not_zero',
      rejectedTreatment: 'not_applicable',
      duplicateSemanticClaimsCollapsedBeforeApplicability: true,
      applicableRowsRemainContextOnly: true,
      mechanicallyActionable: false,
      modelWeight: 0,
      modelFitting: 'none',
      servingChanged: false,
      nextStep: 'coverage audit and new historical matrix/freeze may consume only applicableRows; ambiguous rows remain unavailable and cannot be treated as negative evidence',
    },
    contentSha256WithoutSelfField: null as string | null,
  };

  const withoutSha = JSON.stringify(report, null, 2) + '\n';
  report.contentSha256WithoutSelfField = createHash('sha256').update(withoutSha).digest('hex');

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(resolve(outputDir, OUTPUT_FILE), JSON.stringify(report, null, 2) + '\n', 'utf8');

  console.log(JSON.stringify({
    historicalDensityP2ApplicabilitySemanticReview: {
      candidateGroups: groups.length,
      candidatePairs: EXPECTED_CANDIDATE_PAIRS,
      applicableGroups: counts.applicable.groups,
      applicablePairs: counts.applicable.pairs,
      ambiguousGroups: counts.ambiguous_fail_closed.groups,
      ambiguousPairs: counts.ambiguous_fail_closed.pairs,
      notApplicableGroups: counts.not_applicable.groups,
      notApplicablePairs: counts.not_applicable.pairs,
      applicableReviewKeys: applicableKeys,
      outcomeUse: 'none',
      vercelUsed: false,
      productionDatabaseQueried: false,
      modelWeight: 0,
      servingChanged: false,
    },
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(safeMessage(error));
  process.exitCode = 1;
}
