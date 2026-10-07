import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const AUDIT_SCHEMA =
  'historical-density-2025-house-applicability-candidate-audit-tranche-v1';
const DECISION_SCHEMA =
  'historical-density-2025-house-applicability-tranche-4-decisions-v1';
const OUTPUT_SCHEMA =
  'historical-density-2025-house-applicability-tranche-4-review-v1';
const EXPECTED_REVIEW_KEY_SHA =
  'aff014070d7b0764014d3876bc57cf67f9a390b617542ff452307706f25a95dc';
const EXPECTED_TARGET_EVENT_SHA =
  'b30043dfcb57fd7d5cb10b489b9d42ca1ea4476e5c4ee1bec512277fe7aa4339';
const EXPECTED_CANDIDATES = 212;
const EXPECTED_CANDIDATE_BILLS = 18;
const EXPECTED_CANDIDATE_MEMBERS = 38;
const EXPECTED_SEMANTIC_GROUPS = 38;
const EXPECTED_ELIGIBLE_PAIRS = 1150;
const EXPECTED_BASELINE_AMBIGUOUS = 0;
const EXPECTED_NOT_NOMINATED = 938;
const EXPECTED_APPLICABLE = 7;
const EXPECTED_REVIEW_AMBIGUOUS = 0;
const EXPECTED_REVIEW_NOT_APPLICABLE = 205;

type Json = Record<string, any>;

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function readJson(path: string): Json {
  return JSON.parse(readFileSync(path, 'utf8')) as Json;
}

function setSha(values: readonly string[]): string {
  return createHash('sha256')
    .update(`${[...values].sort().join('\n')}\n`)
    .digest('hex');
}

function main(): void {
  const audit = readJson(
    env('VOTEPREDICT_2025_HOUSE_TRANCHE4_APPLICABILITY_AUDIT_PATH'),
  );
  const decisions = readJson(
    env('VOTEPREDICT_2025_HOUSE_TRANCHE4_APPLICABILITY_DECISIONS_PATH'),
  );
  const output = resolve(
    env('VOTEPREDICT_2025_HOUSE_TRANCHE4_APPLICABILITY_REVIEW_OUTPUT'),
  );

  if (
    audit.schemaVersion !== AUDIT_SCHEMA
    || audit.issue !== 718
    || audit.session !== '2025-2026'
    || audit.frozenInputs?.targetTrancheIndex !== 4
    || audit.frozenInputs?.targetRankStart !== 76
    || audit.frozenInputs?.targetRankEnd !== 100
    || audit.frozenInputs?.targetEventKeySha256 !== EXPECTED_TARGET_EVENT_SHA
    || audit.cohort?.novelSemanticGroups !== 46
    || audit.cohort?.targetEvents !== 25
    || audit.cohort?.eligibleClaimEventPairs !== EXPECTED_ELIGIBLE_PAIRS
    || audit.cohort?.internalMembershipIdentitiesResolved !== 0
    || audit.sourceVerification?.events !== 25
    || audit.sourceVerification?.statusCounts?.verified !== 25
    || Object.keys(audit.sourceVerification?.statusCounts ?? {}).length !== 1
    || audit.sourceVerification?.sameDayVersionEligible !== false
    || audit.candidateScreen?.candidateClaimPairs !== EXPECTED_CANDIDATES
    || audit.candidateScreen?.candidateReviewGroups !== EXPECTED_CANDIDATES
    || audit.candidateScreen?.candidateBills !== EXPECTED_CANDIDATE_BILLS
    || audit.candidateScreen?.candidatePublicMembers !== EXPECTED_CANDIDATE_MEMBERS
    || audit.candidateScreen?.candidateSemanticGroups !== EXPECTED_SEMANTIC_GROUPS
    || audit.candidateScreen?.pairStatusCounts?.ambiguous_fail_closed !== EXPECTED_BASELINE_AMBIGUOUS
    || audit.candidateScreen?.pairStatusCounts?.not_nominated !== EXPECTED_NOT_NOMINATED
    || audit.candidateScreen?.pairStatusCounts?.candidate_for_semantic_review !== EXPECTED_CANDIDATES
    || audit.candidateScreen?.automaticApplicableRows !== 0
    || audit.candidateScreen?.automaticAlignmentRows !== 0
    || audit.policy?.outcomeUse !== 'none'
    || audit.policy?.targetVoteOutcomesRead !== false
    || audit.policy?.productionDatabaseQueried !== false
    || audit.policy?.productionWrites !== false
    || audit.policy?.vercelUsed !== false
    || audit.policy?.publicLrlIdentityOnly !== true
    || audit.policy?.internalMembershipIdentityResolved !== false
    || audit.policy?.internalIdentityRequiredBeforeFeatureIntegration !== true
    || audit.policy?.billIdentifiersInferredFromMemberClaims !== false
    || audit.policy?.sameDayBillVersionsExcluded !== true
    || audit.policy?.deterministicScreenCanDeclareApplicability !== false
    || audit.policy?.semanticReviewRequiredForApplicability !== true
    || audit.policy?.featureRowsWritten !== false
    || audit.policy?.modelFitting !== 'none'
    || audit.policy?.servingChanged !== false
  ) {
    throw new Error('2025 House tranche-4 candidate audit identity/policy drifted');
  }

  if (
    decisions.schemaVersion !== DECISION_SCHEMA
    || decisions.issue !== 718
    || decisions.session !== '2025-2026'
    || decisions.frozenCandidateArtifact?.runId !== 37551658789
    || decisions.frozenCandidateArtifact?.artifactId !== 11453146518
    || decisions.frozenCandidateArtifact?.digest !==
      'sha256:7e549f2f723235ef8e436c9048217dc1a4aa06e62513d316b25f016800b50a0f'
    || decisions.frozenCandidateArtifact?.targetTrancheIndex !== 4
    || decisions.frozenCandidateArtifact?.targetEventKeySha256 !== EXPECTED_TARGET_EVENT_SHA
    || decisions.frozenCandidateArtifact?.reviewKeySha256 !== EXPECTED_REVIEW_KEY_SHA
    || decisions.frozenCandidateArtifact?.eligibleClaimEventPairs !== EXPECTED_ELIGIBLE_PAIRS
    || decisions.frozenCandidateArtifact?.candidatePairs !== EXPECTED_CANDIDATES
    || decisions.frozenCandidateArtifact?.candidateBills !== EXPECTED_CANDIDATE_BILLS
    || decisions.frozenCandidateArtifact?.candidatePublicMembers !== EXPECTED_CANDIDATE_MEMBERS
    || decisions.frozenCandidateArtifact?.candidateSemanticGroups !== EXPECTED_SEMANTIC_GROUPS
    || decisions.defaultDecision !== 'not_applicable'
    || !Array.isArray(decisions.overrides)
    || decisions.overrides.length !== 7
    || decisions.policy?.everyCandidateReviewed !== true
    || decisions.policy?.applicableRequiresExplicitOverride !== true
    || decisions.policy?.ambiguousRequiresExplicitOverride !== true
    || decisions.policy?.unlistedCandidateDecision !== 'unavailable_fail_closed'
    || decisions.policy?.outcomeUse !== 'none'
    || decisions.policy?.targetVoteOutcomesRead !== false
    || decisions.policy?.productionDatabaseQueried !== false
    || decisions.policy?.productionWrites !== false
    || decisions.policy?.vercelUsed !== false
    || decisions.policy?.publicLrlIdentityOnly !== true
    || decisions.policy?.internalMembershipIdentityResolved !== false
    || decisions.policy?.internalIdentityRequiredBeforeFeatureIntegration !== true
    || decisions.policy?.contextOnly !== true
    || decisions.policy?.mechanicallyActionable !== false
    || decisions.policy?.modelWeight !== 0
    || decisions.policy?.featureRowsWritten !== false
    || decisions.policy?.modelFitting !== 'none'
    || decisions.policy?.servingChanged !== false
  ) {
    throw new Error('2025 House tranche-4 decision manifest drifted');
  }

  const candidateClaims = audit.candidateClaims as Json[];
  const pairResults = audit.pairResults as Json[];
  const reviewKeys = candidateClaims.map((row) => String(row.reviewKey));
  if (
    candidateClaims.length !== EXPECTED_CANDIDATES
    || new Set(reviewKeys).size !== EXPECTED_CANDIDATES
  ) {
    throw new Error('Tranche-4 candidate review-key cardinality drifted');
  }
  const reviewKeySha256 = setSha(reviewKeys);
  if (reviewKeySha256 !== EXPECTED_REVIEW_KEY_SHA) {
    throw new Error(`Tranche-4 review-key set drifted: ${reviewKeySha256}`);
  }

  const candidateBills = [
    ...new Set(candidateClaims.map((row) => String(row.identifier))),
  ].sort();
  const rationaleBills = Object.keys(decisions.defaultBillRationales ?? {}).sort();
  if (
    candidateBills.length !== EXPECTED_CANDIDATE_BILLS
    || JSON.stringify(candidateBills) !== JSON.stringify(rationaleBills)
  ) {
    throw new Error('Candidate-bill rationale coverage drifted');
  }
  for (const identifier of candidateBills) {
    if (!String(decisions.defaultBillRationales[identifier] ?? '').trim()) {
      throw new Error(`Missing bill-level review rationale for ${identifier}`);
    }
  }

  const candidateByKey = new Map(
    candidateClaims.map((row) => [String(row.reviewKey), row] as const),
  );
  const overrides = new Map<string, Json>();
  for (const override of decisions.overrides as Json[]) {
    const key = String(override.reviewKey ?? '');
    if (!key || overrides.has(key) || !candidateByKey.has(key)) {
      throw new Error(`Invalid or duplicate tranche-4 override: ${key}`);
    }
    if (
      override.decision !== 'applicable'
      && override.decision !== 'ambiguous_fail_closed'
    ) {
      throw new Error(`Unsupported tranche-4 override decision: ${key}`);
    }
    if (!String(override.reason ?? '').trim()) {
      throw new Error(`Missing tranche-4 override rationale: ${key}`);
    }
    if (
      override.decision === 'applicable'
      && (
        !String(override.billPolicyDirection ?? '').trim()
        || !['aligns', 'conflicts'].includes(String(override.alignmentDirection))
      )
    ) {
      throw new Error(`Applicable override lacks policy/alignment direction: ${key}`);
    }
    if (
      override.decision === 'ambiguous_fail_closed'
      && (
        override.billPolicyDirection !== null
        || override.alignmentDirection !== null
      )
    ) {
      throw new Error(`Ambiguous override must not infer direction: ${key}`);
    }
    overrides.set(key, override);
  }

  const reviewedCandidates = candidateClaims
    .map((row) => {
      const key = String(row.reviewKey);
      const override = overrides.get(key);
      const decision = override?.decision ?? decisions.defaultDecision;
      const reason =
        override?.reason ?? decisions.defaultBillRationales[String(row.identifier)];
      if (!reason) {
        throw new Error(`Missing review rationale for ${key}`);
      }
      if (
        row.versionProof?.strictlyBeforeVoteDate !== true
        || row.internalMembershipIdentityResolved !== false
      ) {
        throw new Error(`Candidate provenance/identity drifted for ${key}`);
      }
      return {
        reviewKey: key,
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
        decision,
        reason,
        billPolicyDirection:
          decision === 'applicable' ? override?.billPolicyDirection : null,
        alignmentDirection:
          decision === 'applicable' ? override?.alignmentDirection : null,
        internalMembershipIdentityResolved: false,
        integrationReady: false,
        contextOnly: true,
        mechanicallyActionable: false,
        modelWeight: 0,
      };
    })
    .sort((a, b) => a.reviewKey.localeCompare(b.reviewKey));

  const reviewDecisionCounts = {
    applicable: reviewedCandidates.filter((row) => row.decision === 'applicable').length,
    ambiguous_fail_closed: reviewedCandidates.filter(
      (row) => row.decision === 'ambiguous_fail_closed',
    ).length,
    not_applicable: reviewedCandidates.filter(
      (row) => row.decision === 'not_applicable',
    ).length,
    pending_review: 0,
  };
  if (
    reviewDecisionCounts.applicable !== EXPECTED_APPLICABLE
    || reviewDecisionCounts.ambiguous_fail_closed !== EXPECTED_REVIEW_AMBIGUOUS
    || reviewDecisionCounts.not_applicable !== EXPECTED_REVIEW_NOT_APPLICABLE
  ) {
    throw new Error(
      `Reviewed tranche-4 counts drifted: ${JSON.stringify(reviewDecisionCounts)}`,
    );
  }

  const alignmentCounts = {
    aligns: reviewedCandidates.filter((row) => row.alignmentDirection === 'aligns').length,
    conflicts: reviewedCandidates.filter((row) => row.alignmentDirection === 'conflicts').length,
  };
  if (alignmentCounts.aligns !== 7 || alignmentCounts.conflicts !== 0) {
    throw new Error(`Alignment counts drifted: ${JSON.stringify(alignmentCounts)}`);
  }

  const expectedApplicableReviewKeys = [
    'allen_fraud_oversight_accountability|HF2115|2025-05-19|6ff092f3112bfe489bcfe686d8921dc878cd82c599e9327ddd3634f17b2efa75',
    'allen_fraud_oversight_accountability|HF2432|2025-05-18|5b01e687cf81513fbf9630b403e823d10c0ef173d9927b5623d281219a78be45',
    'allen_fraud_oversight_accountability|SF3045|2025-05-19|4fa4c52937972605fa8c6fd3320179f69c429d08e087127a84260be7ce2db89d',
    'joy_make_minnesota_safe|HF2432|2025-05-18|5b01e687cf81513fbf9630b403e823d10c0ef173d9927b5623d281219a78be45',
    'schwartz_make_minnesota_safe|HF2432|2025-05-18|5b01e687cf81513fbf9630b403e823d10c0ef173d9927b5623d281219a78be45',
    'van_binsbergen_state_agency_fraud_reporting|HF2432|2025-05-18|5b01e687cf81513fbf9630b403e823d10c0ef173d9927b5623d281219a78be45',
    'van_binsbergen_state_agency_fraud_reporting|SF3045|2025-05-19|4fa4c52937972605fa8c6fd3320179f69c429d08e087127a84260be7ce2db89d',
  ].sort();
  const actualApplicableReviewKeys = reviewedCandidates
    .filter((row) => row.decision === 'applicable')
    .map((row) => row.reviewKey)
    .sort();
  if (
    JSON.stringify(actualApplicableReviewKeys)
    !== JSON.stringify(expectedApplicableReviewKeys)
  ) {
    throw new Error('Applicable tranche-4 review-key set drifted');
  }

  const reviewedByKey = new Map(
    reviewedCandidates.map((row) => [row.reviewKey, row] as const),
  );
  const finalPairStatusCounts = {
    applicable: 0,
    ambiguous_fail_closed: 0,
    not_applicable: 0,
    pending_review: 0,
  };

  for (const pair of pairResults) {
    if (pair.status === 'ambiguous_fail_closed') {
      finalPairStatusCounts.ambiguous_fail_closed += 1;
      continue;
    }
    if (pair.status === 'not_nominated') {
      finalPairStatusCounts.not_applicable += 1;
      continue;
    }
    if (pair.status !== 'candidate_for_semantic_review') {
      throw new Error(`Unexpected tranche-4 pair status: ${String(pair.status)}`);
    }
    const reviewed = reviewedByKey.get(String(pair.reviewKey ?? ''));
    if (!reviewed) {
      finalPairStatusCounts.pending_review += 1;
    } else if (reviewed.decision === 'applicable') {
      finalPairStatusCounts.applicable += 1;
    } else if (reviewed.decision === 'ambiguous_fail_closed') {
      finalPairStatusCounts.ambiguous_fail_closed += 1;
    } else if (reviewed.decision === 'not_applicable') {
      finalPairStatusCounts.not_applicable += 1;
    } else {
      finalPairStatusCounts.pending_review += 1;
    }
  }

  if (
    finalPairStatusCounts.applicable !== 7
    || finalPairStatusCounts.ambiguous_fail_closed !== 0
    || finalPairStatusCounts.not_applicable !== 1143
    || finalPairStatusCounts.pending_review !== 0
  ) {
    throw new Error(
      `Final tranche-4 pair counts drifted: ${JSON.stringify(finalPairStatusCounts)}`,
    );
  }

  const applicableCandidates = reviewedCandidates.filter(
    (row) => row.decision === 'applicable',
  );
  if (
    applicableCandidates.some(
      (row) => row.internalMembershipIdentityResolved || row.integrationReady,
    )
  ) {
    throw new Error('Applicable public-LRL decisions must not be integration-ready');
  }

  const report = {
    schemaVersion: OUTPUT_SCHEMA,
    generatedAt: new Date().toISOString(),
    issue: 718,
    session: '2025-2026',
    frozenInput: {
      runId: 37551658789,
      artifactId: 11453146518,
      digest:
        'sha256:7e549f2f723235ef8e436c9048217dc1a4aa06e62513d316b25f016800b50a0f',
      targetTrancheIndex: 4,
      targetEventKeySha256: EXPECTED_TARGET_EVENT_SHA,
      reviewKeySha256,
    },
    review: {
      candidatePairs: EXPECTED_CANDIDATES,
      candidateBills: EXPECTED_CANDIDATE_BILLS,
      candidatePublicMembers: EXPECTED_CANDIDATE_MEMBERS,
      candidateSemanticGroups: EXPECTED_SEMANTIC_GROUPS,
      decisions: reviewDecisionCounts,
      alignmentCounts,
      finalPairStatusCounts,
      applicableRows: applicableCandidates.length,
      integrationReadyRows: 0,
      applicableReviewKeys: applicableCandidates.map((row) => row.reviewKey).sort(),
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
        'Resolve public LRL identity to the internal historical membership identity for the seven applicable context records before any feature integration; do not guess IDs.',
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
    historicalDensity2025HouseApplicabilityTranche4Review: {
      candidatePairs: EXPECTED_CANDIDATES,
      decisions: reviewDecisionCounts,
      alignmentCounts,
      finalPairStatusCounts,
      applicableRows: applicableCandidates.length,
      integrationReadyRows: 0,
      reviewKeySha256,
      outcomeUse: 'none',
      productionDatabaseQueried: false,
      vercelUsed: false,
    },
  }, null, 2));
}

main();
