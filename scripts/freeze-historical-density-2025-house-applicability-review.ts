import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const AUDIT_SCHEMA =
  'historical-density-2025-house-applicability-candidate-audit-v1';
const DECISION_SCHEMA =
  'historical-density-2025-house-applicability-decisions-v1';
const OUTPUT_SCHEMA =
  'historical-density-2025-house-applicability-review-v1';
const EXPECTED_REVIEW_KEY_SHA =
  '9e4b9247306c6e7314fe0105cbb741ea0977e25c4d4b347bf228f4cca75ff535';
const EXPECTED_CANDIDATES = 47;
const EXPECTED_SEMANTIC_GROUPS = 19;
const EXPECTED_ELIGIBLE_PAIRS = 1045;
const EXPECTED_BASELINE_AMBIGUOUS = 81;
const EXPECTED_NOT_NOMINATED = 917;

type Json = Record<string, any>;

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}
function readJson(path: string): Json {
  return JSON.parse(readFileSync(path, 'utf8')) as Json;
}
function sha(values: readonly string[]): string {
  return createHash('sha256')
    .update(`${[...values].sort().join('\n')}\n`)
    .digest('hex');
}

function main(): void {
  const audit = readJson(env('VOTEPREDICT_2025_HOUSE_APPLICABILITY_AUDIT_PATH'));
  const decisions = readJson(env('VOTEPREDICT_2025_HOUSE_APPLICABILITY_DECISIONS_PATH'));
  const output = resolve(env('VOTEPREDICT_2025_HOUSE_APPLICABILITY_REVIEW_OUTPUT'));

  if (
    audit.schemaVersion !== AUDIT_SCHEMA
    || audit.issue !== 718
    || audit.session !== '2025-2026'
    || audit.cohort?.eligibleClaimEventPairs !== EXPECTED_ELIGIBLE_PAIRS
    || audit.candidateScreen?.candidateClaimPairs !== EXPECTED_CANDIDATES
    || audit.candidateScreen?.candidateReviewGroups !== EXPECTED_CANDIDATES
    || audit.candidateScreen?.candidateSemanticGroups !== EXPECTED_SEMANTIC_GROUPS
    || audit.candidateScreen?.automaticApplicableRows !== 0
    || audit.candidateScreen?.automaticAlignmentRows !== 0
    || audit.candidateScreen?.pairStatusCounts?.ambiguous_fail_closed !== EXPECTED_BASELINE_AMBIGUOUS
    || audit.candidateScreen?.pairStatusCounts?.not_nominated !== EXPECTED_NOT_NOMINATED
    || audit.candidateScreen?.pairStatusCounts?.candidate_for_semantic_review !== EXPECTED_CANDIDATES
    || audit.policy?.outcomeUse !== 'none'
    || audit.policy?.targetVoteOutcomesRead !== false
    || audit.policy?.productionDatabaseQueried !== false
    || audit.policy?.productionWrites !== false
    || audit.policy?.vercelUsed !== false
    || audit.policy?.deterministicScreenCanDeclareApplicability !== false
    || audit.policy?.semanticReviewRequiredForApplicability !== true
    || audit.policy?.internalMembershipIdentityResolved !== false
  ) {
    throw new Error('2025 House applicability audit identity/policy drifted');
  }

  if (
    decisions.schemaVersion !== DECISION_SCHEMA
    || decisions.issue !== 718
    || decisions.frozenCandidateArtifact?.runId !== 37546266981
    || decisions.frozenCandidateArtifact?.artifactId !== 11450382467
    || decisions.frozenCandidateArtifact?.digest
      !== 'sha256:90c6b0eb156412e74ef6181d55c1c91690660ded4fbc8b281195078b2427118d'
    || decisions.frozenCandidateArtifact?.reviewKeySha256 !== EXPECTED_REVIEW_KEY_SHA
    || decisions.frozenCandidateArtifact?.candidatePairs !== EXPECTED_CANDIDATES
    || decisions.frozenCandidateArtifact?.candidateSemanticGroups !== EXPECTED_SEMANTIC_GROUPS
    || decisions.defaultDecision !== 'not_applicable'
    || !Array.isArray(decisions.overrides)
    || decisions.overrides.length !== 0
    || decisions.policy?.everyCandidateReviewed !== true
    || decisions.policy?.applicableRequiresExplicitOverride !== true
    || decisions.policy?.ambiguousRequiresExplicitOverride !== true
    || decisions.policy?.unlistedCandidateDecision !== 'unavailable_fail_closed'
    || decisions.policy?.outcomeUse !== 'none'
    || decisions.policy?.targetVoteOutcomesRead !== false
    || decisions.policy?.productionDatabaseQueried !== false
    || decisions.policy?.productionWrites !== false
    || decisions.policy?.vercelUsed !== false
    || decisions.policy?.internalMembershipIdentityResolved !== false
    || decisions.policy?.featureRowsWritten !== false
    || decisions.policy?.modelFitting !== 'none'
    || decisions.policy?.servingChanged !== false
  ) {
    throw new Error('2025 House applicability decision manifest drifted');
  }

  const candidateClaims = audit.candidateClaims as Json[];
  const pairResults = audit.pairResults as Json[];
  const keys = candidateClaims.map((row) => String(row.reviewKey));
  if (candidateClaims.length !== EXPECTED_CANDIDATES || new Set(keys).size !== EXPECTED_CANDIDATES) {
    throw new Error('Candidate review-key cardinality drifted');
  }
  const reviewKeySha256 = sha(keys);
  if (reviewKeySha256 !== EXPECTED_REVIEW_KEY_SHA) {
    throw new Error(`Candidate review-key set drifted: ${reviewKeySha256}`);
  }

  const semanticKeys = [...new Set(candidateClaims.map((row) => String(row.semanticKey)))].sort();
  const rationaleKeys = Object.keys(decisions.semanticRationales ?? {}).sort();
  if (
    semanticKeys.length !== EXPECTED_SEMANTIC_GROUPS
    || JSON.stringify(semanticKeys) !== JSON.stringify(rationaleKeys)
  ) {
    throw new Error('Per-semantic manual-review rationale coverage drifted');
  }
  for (const key of semanticKeys) {
    if (!String(decisions.semanticRationales[key] ?? '').trim()) {
      throw new Error(`Missing manual-review rationale for ${key}`);
    }
  }

  const reviewedCandidates = candidateClaims
    .map((row) => ({
      reviewKey: row.reviewKey,
      semanticKey: row.semanticKey,
      publicMemberKey: row.publicMemberKey,
      lrlId: row.lrlId,
      memberName: row.memberName,
      claimAvailableAt: row.claimAvailableAt,
      memberStance: row.memberStance,
      normalizedClaim: row.normalizedClaim,
      billId: row.billId,
      identifier: row.identifier,
      voteEventId: row.voteEventId,
      occurredOn: row.occurredOn,
      versionProof: row.versionProof,
      decision: 'not_applicable',
      reason: decisions.semanticRationales[row.semanticKey],
      billPolicyDirection: null,
      alignmentDirection: null,
      internalMembershipIdentityResolved: false,
      contextOnly: true,
      mechanicallyActionable: false,
      modelWeight: 0,
    }))
    .sort((a, b) => String(a.reviewKey).localeCompare(String(b.reviewKey)));

  const reviewedByKey = new Set(reviewedCandidates.map((row) => String(row.reviewKey)));
  const finalPairStatusCounts = {
    applicable: 0,
    ambiguous_fail_closed: 0,
    not_applicable: 0,
    pending_review: 0,
  };

  for (const pair of pairResults) {
    if (pair.status === 'ambiguous_fail_closed') {
      finalPairStatusCounts.ambiguous_fail_closed += 1;
    } else if (pair.status === 'not_nominated') {
      finalPairStatusCounts.not_applicable += 1;
    } else if (pair.status === 'candidate_for_semantic_review') {
      if (!pair.reviewKey || !reviewedByKey.has(String(pair.reviewKey))) {
        finalPairStatusCounts.pending_review += 1;
      } else {
        finalPairStatusCounts.not_applicable += 1;
      }
    } else {
      throw new Error(`Unexpected pair status: ${String(pair.status)}`);
    }
  }

  if (
    finalPairStatusCounts.applicable !== 0
    || finalPairStatusCounts.ambiguous_fail_closed !== 81
    || finalPairStatusCounts.not_applicable !== 964
    || finalPairStatusCounts.pending_review !== 0
  ) {
    throw new Error(
      `Final pair counts drifted: ${JSON.stringify(finalPairStatusCounts)}`,
    );
  }

  const report = {
    schemaVersion: OUTPUT_SCHEMA,
    generatedAt: new Date().toISOString(),
    issue: 718,
    session: '2025-2026',
    frozenInput: {
      runId: 37546266981,
      artifactId: 11450382467,
      digest:
        'sha256:90c6b0eb156412e74ef6181d55c1c91690660ded4fbc8b281195078b2427118d',
      reviewKeySha256,
    },
    review: {
      candidatePairs: EXPECTED_CANDIDATES,
      candidateSemanticGroups: EXPECTED_SEMANTIC_GROUPS,
      decisions: {
        applicable: 0,
        ambiguous_fail_closed: 0,
        not_applicable: EXPECTED_CANDIDATES,
        pending_review: 0,
      },
      finalPairStatusCounts,
      applicableRows: 0,
      reviewedCandidates,
    },
    policy: {
      outcomeUse: 'none',
      targetVoteOutcomesRead: false,
      productionDatabaseQueried: false,
      productionWrites: false,
      vercelUsed: false,
      publicLrlIdentityOnly: true,
      internalMembershipIdentityResolved: false,
      internalIdentityRequiredBeforeFeatureIntegration: true,
      sameDayBillVersionsExcluded: true,
      contextOnly: true,
      mechanicallyActionable: false,
      modelWeight: 0,
      featureRowsWritten: false,
      modelFitting: 'none',
      servingChanged: false,
      nextStep:
        'No reviewed candidates are applicable in this first 25-event tranche. Expand the bounded 2025-26 target-event inventory rather than weakening applicability semantics.',
    },
    contentSha256WithoutSelfField: null as string | null,
  };

  const canonical = `${JSON.stringify(report, null, 2)}\n`;
  report.contentSha256WithoutSelfField = createHash('sha256')
    .update(canonical)
    .digest('hex');
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    historicalDensity2025HouseApplicabilityReview: {
      candidatePairs: EXPECTED_CANDIDATES,
      candidateSemanticGroups: EXPECTED_SEMANTIC_GROUPS,
      decisions: report.review.decisions,
      finalPairStatusCounts,
      applicableRows: 0,
      reviewKeySha256,
      outcomeUse: 'none',
      productionDatabaseQueried: false,
      vercelUsed: false,
    },
  }, null, 2));
}
main();
