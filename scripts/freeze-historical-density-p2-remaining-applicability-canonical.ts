import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const EXPECTED_ELIGIBLE_PAIRS = 2716;
const EXPECTED_CANDIDATE_PAIRS = 138;
const EXPECTED_CANDIDATE_GROUPS = 124;
const EXPECTED_KEY_SHA = '4fd8d5aa6821a4e548482f27749d5ff2f4e11c511a72d06e5426be78dd7a5900';
const EXPECTED_ARTIFACT = {
  runId: 37490027592,
  artifactId: 11424703301,
  digest: 'sha256:2d8e9b48f654febbd4e027d626fde3696eb6f8c055eeba40ad2007332f69abf1',
} as const;
const OUTPUT_FILE = 'historical-density-p2-remaining-applicability-canonical-v1.json';

type DecisionName = 'applicable' | 'ambiguous_fail_closed' | 'not_applicable' | 'pending_review';
type AlignmentDirection = 'position_aligns_with_bill' | 'position_conflicts_with_bill';
type GateDecision = {
  decision: Exclude<DecisionName, 'pending_review'>;
  reasonCode: string;
  billPolicyDirection: string | null;
  alignmentDirection: AlignmentDirection | null;
};
type GateOverride = GateDecision & { reviewKey: string };
type DecisionGate = {
  schemaVersion: string;
  issue: number;
  frozenCandidateArtifact: typeof EXPECTED_ARTIFACT;
  candidateReviewKeySha256: string;
  candidateReviewGroups: number;
  defaultDecisionBySemanticKey: Record<string, GateDecision>;
  overrides: GateOverride[];
  policy: {
    unlistedCandidateGroup: string;
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
type VersionProof = {
  versionUrl?: string;
  postedOn?: string;
  textSha256?: string;
  strictlyBeforeVoteDate: boolean;
};
type CandidateClaim = {
  reviewKey: string;
  voteEventId: string;
  membershipId: string;
  memberName: string;
  occurredOn: string;
  billId: string;
  identifier: string;
  chamber: string;
  semanticKey: string;
  sourceRows: number[];
  claimAvailableAt: string;
  memberStance: 'supports' | 'opposes';
  normalizedClaim: string;
  claimType: string;
  explicitness: 'direct_quote' | 'document_position' | 'attributed_paraphrase';
  extractionConfidence: number;
  candidateOnly: boolean;
  applicabilityDecision: 'pending_semantic_review';
  billPolicyDirection: 'not_inferred_by_candidate_screen';
  alignmentDirection: 'not_inferred_by_candidate_screen';
  versionProof: VersionProof;
};
type PairResult = {
  voteEventId: string;
  membershipId: string;
  semanticKey: string;
  identifier: string;
  occurredOn: string;
  status: 'ambiguous_fail_closed' | 'candidate_for_semantic_review' | 'not_nominated';
  reviewKey?: string;
  reason?: string;
};
type CandidateAudit = {
  schemaVersion: string;
  issue: number;
  frozenInputs: Record<string, unknown>;
  cohort: { eligibleClaimEventPairs: number };
  sourceVerification: { events: number; statusCounts: Record<string, number> };
  candidateScreen: {
    candidateClaimPairs: number;
    candidateReviewGroups: number;
    automaticApplicableRows: number;
    automaticAlignmentRows: number;
  };
  candidateClaims: CandidateClaim[];
  pairResults: PairResult[];
  policy: {
    outcomeUse: string;
    inputTargetRowsContainOutcomes: boolean;
    productionDatabaseQueried: boolean;
    productionWrites: boolean;
    vercelUsed: boolean;
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
type CanonicalGroup = {
  reviewKey: string;
  semanticKey: string;
  identifier: string;
  occurredOn: string;
  billId: string;
  versionTextSha256: string;
  versionUrl: string;
  versionPostedOn: string;
  decision: DecisionName;
  reasonCode: string;
  billPolicyDirection: string | null;
  alignmentDirection: AlignmentDirection | null;
  candidatePairs: number;
  claims: CandidateClaim[];
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}
function stableSha(values: readonly string[]): string {
  return createHash('sha256').update(`${[...values].sort().join('\n')}\n`).digest('hex');
}
function unique(values: readonly string[]): string[] { return [...new Set(values)]; }
function countDecisions(groups: readonly CanonicalGroup[]): Record<DecisionName, { groups: number; pairs: number }> {
  const counts: Record<DecisionName, { groups: number; pairs: number }> = {
    applicable: { groups: 0, pairs: 0 }, ambiguous_fail_closed: { groups: 0, pairs: 0 },
    not_applicable: { groups: 0, pairs: 0 }, pending_review: { groups: 0, pairs: 0 },
  };
  for (const group of groups) { counts[group.decision].groups += 1; counts[group.decision].pairs += group.candidatePairs; }
  return counts;
}

function main(): void {
  const audit = JSON.parse(readFileSync(requiredEnv('VOTEPREDICT_P2_REMAINING_APPLICABILITY_CANDIDATE_PATH'), 'utf8')) as CandidateAudit;
  const gate = JSON.parse(readFileSync(requiredEnv('VOTEPREDICT_P2_REMAINING_APPLICABILITY_DECISION_PATH'), 'utf8')) as DecisionGate;
  const outputDir = requiredEnv('VOTEPREDICT_P2_REMAINING_CANONICAL_OUTPUT_DIR');

  if (gate.schemaVersion !== 'historical-density-p2-remaining-applicability-decision-gate-v1' || gate.issue !== 718
      || JSON.stringify(gate.frozenCandidateArtifact) !== JSON.stringify(EXPECTED_ARTIFACT)
      || gate.candidateReviewKeySha256 !== EXPECTED_KEY_SHA || gate.candidateReviewGroups !== EXPECTED_CANDIDATE_GROUPS
      || Object.keys(gate.defaultDecisionBySemanticKey).length !== 14 || gate.overrides.length !== 21
      || gate.policy.unlistedCandidateGroup !== 'pending_review_fail_closed_unavailable' || !gate.policy.onlyApplicableMayReachMatrix
      || gate.policy.outcomeUse !== 'none' || gate.policy.sameDayVersionEligible || gate.policy.productionDatabaseQueried
      || gate.policy.productionWrites || gate.policy.vercelUsed || gate.policy.modelFitting !== 'none' || gate.policy.servingChanged) {
    throw new Error('Decision-gate identity or safety policy drifted');
  }
  for (const [semanticKey, decision] of Object.entries(gate.defaultDecisionBySemanticKey)) {
    if (decision.decision !== 'not_applicable' || !decision.reasonCode || decision.billPolicyDirection !== null || decision.alignmentDirection !== null) {
      throw new Error(`Unsafe default decision for ${semanticKey}`);
    }
  }
  const overrideMap = new Map<string, GateOverride>();
  for (const decision of gate.overrides) {
    if (overrideMap.has(decision.reviewKey)) throw new Error(`Duplicate override: ${decision.reviewKey}`);
    if (decision.decision === 'applicable') {
      if (!decision.billPolicyDirection || !decision.alignmentDirection) throw new Error(`Applicable override lacks direction: ${decision.reviewKey}`);
    } else if (decision.decision !== 'ambiguous_fail_closed' || decision.billPolicyDirection !== null || decision.alignmentDirection !== null) {
      throw new Error(`Override must be applicable or fail-closed ambiguous: ${decision.reviewKey}`);
    }
    overrideMap.set(decision.reviewKey, decision);
  }
  if (audit.schemaVersion !== 'historical-density-p2-remaining-applicability-candidate-audit-v1' || audit.issue !== 718
      || audit.cohort.eligibleClaimEventPairs !== EXPECTED_ELIGIBLE_PAIRS
      || audit.candidateScreen.candidateClaimPairs !== EXPECTED_CANDIDATE_PAIRS || audit.candidateScreen.candidateReviewGroups !== EXPECTED_CANDIDATE_GROUPS      || audit.candidateScreen.automaticApplicableRows !== 0 || audit.candidateScreen.automaticAlignmentRows !== 0
      || audit.sourceVerification.events !== 218 || audit.sourceVerification.statusCounts.verified !== 213
      || audit.sourceVerification.statusCounts.no_strict_prevote_version !== 5
      || audit.policy.outcomeUse !== 'none' || audit.policy.inputTargetRowsContainOutcomes || audit.policy.productionDatabaseQueried
      || audit.policy.productionWrites || audit.policy.vercelUsed || !audit.policy.sameDayBillVersionsExcluded
      || audit.policy.deterministicScreenCanDeclareApplicability || !audit.policy.semanticReviewRequiredForApplicability
      || !audit.policy.contextOnly || audit.policy.mechanicallyActionable || audit.policy.modelWeight !== 0
      || audit.policy.modelFitting !== 'none' || audit.policy.servingChanged) {
    throw new Error('Candidate audit identity or safety policy drifted');
  }

  const grouped = new Map<string, CandidateClaim[]>();
  for (const claim of audit.candidateClaims) {
    if (!claim.candidateOnly || claim.applicabilityDecision !== 'pending_semantic_review'
        || claim.billPolicyDirection !== 'not_inferred_by_candidate_screen' || claim.alignmentDirection !== 'not_inferred_by_candidate_screen'
        || !claim.versionProof.strictlyBeforeVoteDate || !claim.versionProof.textSha256 || !claim.versionProof.versionUrl || !claim.versionProof.postedOn
        || !(claim.claimAvailableAt < claim.occurredOn) || !(claim.versionProof.postedOn < claim.occurredOn)
        || !claim.reviewKey.endsWith(`|${claim.versionProof.textSha256}`)) {
      throw new Error(`Candidate safety/provenance drifted: ${claim.reviewKey}`);
    }
    const values = grouped.get(claim.reviewKey) ?? []; values.push(claim); grouped.set(claim.reviewKey, values);
  }
  if (grouped.size !== EXPECTED_CANDIDATE_GROUPS || stableSha([...grouped.keys()]) !== EXPECTED_KEY_SHA) {
    throw new Error('Frozen candidate review-key set drifted');
  }

  const groups: CanonicalGroup[] = [...grouped.entries()].map(([reviewKey, claims]) => {
    const semanticKeys = unique(claims.map((x) => x.semanticKey));
    const identifiers = unique(claims.map((x) => x.identifier));
    const dates = unique(claims.map((x) => x.occurredOn));
    const bills = unique(claims.map((x) => x.billId));
    const hashes = unique(claims.map((x) => x.versionProof.textSha256!));
    const urls = unique(claims.map((x) => x.versionProof.versionUrl!));
    const posted = unique(claims.map((x) => x.versionProof.postedOn!));
    if ([semanticKeys, identifiers, dates, bills, hashes, urls, posted].some((x) => x.length !== 1)) throw new Error(`Group provenance drifted: ${reviewKey}`);
    const decision = overrideMap.get(reviewKey) ?? gate.defaultDecisionBySemanticKey[semanticKeys[0]!];
    if (!decision) return { reviewKey, semanticKey: semanticKeys[0]!, identifier: identifiers[0]!, occurredOn: dates[0]!, billId: bills[0]!, versionTextSha256: hashes[0]!, versionUrl: urls[0]!, versionPostedOn: posted[0]!, decision: 'pending_review' as const, reasonCode: 'unlisted_semantic_key', billPolicyDirection: null, alignmentDirection: null, candidatePairs: claims.length, claims };
    return { reviewKey, semanticKey: semanticKeys[0]!, identifier: identifiers[0]!, occurredOn: dates[0]!, billId: bills[0]!, versionTextSha256: hashes[0]!, versionUrl: urls[0]!, versionPostedOn: posted[0]!, decision: decision.decision, reasonCode: decision.reasonCode, billPolicyDirection: decision.billPolicyDirection, alignmentDirection: decision.alignmentDirection, candidatePairs: claims.length, claims };
  }).sort((a, b) => a.reviewKey.localeCompare(b.reviewKey));
  const extraOverrides = [...overrideMap.keys()].filter((key) => !grouped.has(key));
  if (extraOverrides.length) throw new Error(`Sverride contains non-candidate keys: ${extraOverrides.join(',')}`);
  const counts = countDecisions(groups);
  const expected = { applicable: { groups: 4, pairs: 4 }, ambiguous_fail_closed: { groups: 17, pairs: 17 }, not_applicable: { groups: 103, pairs: 117 }, pending_review: { groups: 0, pairs: 0 } };
  if (JSON.stringify(counts) !== JSON.stringify(expected)) throw new Error(`Decision counts drifted: ${JSON.stringify(counts)}`);

  const groupMap = new Map(groups.map((x) => [x.reviewKey, x]));
  const finalPairStatusCounts: Record<DecisionName, number> = { applicable: 4, ambiguous_fail_closed: 91, not_applicable: 2621, pending_review: 0 };
  for (const pair of audit.pairResults) {
    if (pair.status === 'not_nominated') finalPairStatusCounts.not_applicable += 1;
    else if (pair.status === 'ambiguous_fail_closed') finalPairStatusCounts.ambiguous_fail_closed += 1;
    else {
      const group = pair.reviewKey ? groupMap.get(pair.reviewKey) : undefined;
      if (!group) throw new Error(`Missing reviewed group for candidate pair ${pair.voteEventId}|${pair.membershipId}|${pair.semanticKey}`);
      finalPairStatusCounts[group.decision] += 1;
    }
  }
  const expectedFinal = { applicable: 4, ambiguous_fail_closed: 91, not_applicable: 2621, pending_review: 0 };
  if (JSON.stringify(finalPairStatusCounts) !== JSON.stringify(expectedFinal)) throw new Error(`Final pair counts drifted: ${JSON.stringify(finalPairStatusCounts)}`);

  const applicableRows = groups.filter((x) => x.decision === 'applicable').flatMap((group) => group.claims.map((claim) => ({
    reviewKey: group.reviewKey,
    voteEventId: claim.voteEventId,
    membershipId: claim.membershipId,
    memberName: claim.memberName,
    semanticKey: claim.semanticKey,
    sourceRows: claim.sourceRows,
    claimAvailableAt: claim.claimAvailableAt,
    memberStance: claim.memberStance,
    normalizedClaim: claim.normalizedClaim,
    claimFeatureMetadata: { claimType: claim.claimType, explicitness: claim.explicitness, extractionConfidence: claim.extractionConfidence },
    chamber: claim.chamber,
    billId: group.billId,
    identifier: group.identifier,
    occurredOn: group.occurredOn,
    alignmentDirection: group.alignmentDirection!,
    billPolicyDirection: group.billPolicyDirection!,
    versionTextSha256: group.versionTextSha256,
    versionUrl: group.versionUrl,
    versionPostedOn: group.versionPostedOn,
    contextOnly: true,
    mechanicallyActionable: false,
    modelWeight: 0,
  })));
  if (applicableRows.length !== 4) throw new Error(`Expected 4 applicable rows, got ${applicableRows.length}`);

  const report = {
    schemaVersion: 'historical-density-p2-remaining-applicability-canonical-v1', generatedAt: new Date().toISOString(), issue: 718,
    frozenInputs: { candidateArtifact: EXPECTED_ARTIFACT, ...audit.frozenInputs, candidateReviewKeySha256: EXPECTED_KEY_SHA },
    review: { candidateReviewGroups: groups.length, candidateClaimPairs: EXPECTED_CANDIDATE_PAIRS, decisionCounts: counts, finalPairStatusCounts, groups: groups.map(({ claims, ...group }) => group) },
    applicableRows,
    policy: { outcomeUse: 'none', sameDayVersionEligible: false, onlyApplicableMayReachMatrix: true, contextOnly: true, mechanicallyActionable: false, modelWeight: 0, productionDatabaseQueried: false, productionWrites: false, vercelUsed: false, modelFitting: 'none', servingChanged: false },
    contentSha256WithoutSelfField: null as string | null,
  };
  mkdirSync(outputDir, { recursive: true });
  const canonical = `${JSON.stringify(report, null, 2)}\n`;
  report.contentSha256WithoutSelfField = createHash('sha256').update(canonical).digest('hex');
  writeFileSync(resolve(outputDir, OUTPUT_FILE), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ remainingP2Canonical: { groups: groups.length, counts, finalPairStatusCounts, applicableRows: applicableRows.length, reviewKeySha256: EXPECTED_KEY_SHA, outcomeUse: 'none', vercelUsed: false } }, null, 2));
}
main();
