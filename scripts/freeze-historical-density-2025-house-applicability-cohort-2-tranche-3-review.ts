import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const AUDIT_SCHEMA =
  'historical-density-2025-house-applicability-candidate-audit-cohort-2-tranche-3-v1';
const DECISION_SCHEMA =
  'historical-density-2025-house-applicability-cohort-2-tranche-3-decisions-v1';
const OUTPUT_SCHEMA =
  'historical-density-2025-house-applicability-review-cohort-2-tranche-3-v1';
const EXPECTED_REVIEW_KEY_SHA =
  '9587335f4c550c12d1b1dd97361e4a3312ea2ea9d92b7c59295f146d98cf9359';
const EXPECTED_AUDIT_CONTENT_SHA =
  'e982309cc7586ae262dfa73a6565fe39565f606c5dfd261b173b7f81f1bd66c7';
const EXPECTED_TARGET_EVENT_SHA =
  'e5df92e5d1074edae44bc376ba85a041c3107dde1c84cddc3c8a471c132822f0';
const EXPECTED_CANDIDATES = 384;
const EXPECTED_CANDIDATE_BILLS = 17;
const EXPECTED_CANDIDATE_MEMBERS = 42;
const EXPECTED_SEMANTIC_GROUPS = 42;
const EXPECTED_ELIGIBLE_PAIRS = 1050;
const EXPECTED_BASELINE_AMBIGUOUS = 126;
const EXPECTED_NOT_NOMINATED = 540;
const EXPECTED_APPLICABLE = 8;
const EXPECTED_REVIEW_AMBIGUOUS = 0;
const EXPECTED_REVIEW_NOT_APPLICABLE = 376;

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
    env('VOTEPREDICT_2025_HOUSE_COHORT_2_TRANCHE3_APPLICABILITY_AUDIT_PATH'),
  );
  const decisions = readJson(
    env('VOTEPREDICT_2025_HOUSE_COHORT_2_TRANCHE3_APPLICABILITY_DECISIONS_PATH'),
  );
  const output = resolve(
    env('VOTEPREDICT_2025_HOUSE_COHORT_2_TRANCHE3_APPLICABILITY_REVIEW_OUTPUT'),
  );

  if (
    audit.schemaVersion !== AUDIT_SCHEMA
    || audit.issue !== 718
    || audit.contentSha256WithoutSelfField !== EXPECTED_AUDIT_CONTENT_SHA
    || audit.session !== '2025-2026'
    || audit.frozenInputs?.targetTrancheIndex !== 3
    || audit.frozenInputs?.targetRankStart !== 51
    || audit.frozenInputs?.targetRankEnd !== 75
    || audit.frozenInputs?.targetEventKeySha256 !== EXPECTED_TARGET_EVENT_SHA
    || audit.cohort?.novelSemanticGroups !== 42
    || audit.cohort?.targetEvents !== 25
    || audit.cohort?.eligibleClaimEventPairs !== EXPECTED_ELIGIBLE_PAIRS
    || audit.cohort?.internalMembershipIdentitiesResolved !== 0
    || audit.sourceVerification?.events !== 25
    || audit.sourceVerification?.statusCounts?.verified !== 22
    || audit.sourceVerification?.statusCounts?.no_strict_prevote_version !== 3
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
    || audit.policy?.contextOnly !== true
    || audit.policy?.mechanicallyActionable !== false
    || audit.policy?.modelWeight !== 0
    || audit.policy?.featureRowsWritten !== false
    || audit.policy?.modelFitting !== 'none'
    || audit.policy?.servingChanged !== false
  ) {
    throw new Error('2025 House tranche-3 candidate audit identity/policy drifted');
  }

  if (
    decisions.schemaVersion !== DECISION_SCHEMA
    || decisions.issue !== 718
    || decisions.session !== '2025-2026'
    || decisions.frozenCandidateArtifact?.runId !== 37798615199
    || decisions.frozenCandidateArtifact?.artifactId !== 11560096786
    || decisions.frozenCandidateArtifact?.digest !==
      'sha256:f3fbb4cdfaa8e7799c47473833e86266eb3ebd0de24b32a91a6c2cb6741fb469'
    || decisions.frozenCandidateArtifact?.contentSha256WithoutSelfField !== EXPECTED_AUDIT_CONTENT_SHA
    || decisions.frozenCandidateArtifact?.targetTrancheIndex !== 3
    || decisions.frozenCandidateArtifact?.targetEventKeySha256 !== EXPECTED_TARGET_EVENT_SHA
    || decisions.frozenCandidateArtifact?.reviewKeySha256 !== EXPECTED_REVIEW_KEY_SHA
    || decisions.frozenCandidateArtifact?.eligibleClaimEventPairs !== EXPECTED_ELIGIBLE_PAIRS
    || decisions.frozenCandidateArtifact?.candidatePairs !== EXPECTED_CANDIDATES
    || decisions.frozenCandidateArtifact?.candidateBills !== EXPECTED_CANDIDATE_BILLS
    || decisions.frozenCandidateArtifact?.candidatePublicMembers !== EXPECTED_CANDIDATE_MEMBERS
    || decisions.frozenCandidateArtifact?.candidateSemanticGroups !== EXPECTED_SEMANTIC_GROUPS
    || decisions.defaultDecision !== 'not_applicable'
    || !Array.isArray(decisions.overrides)
    || decisions.overrides.length !== 8
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
    throw new Error('2025 House tranche-3 decision manifest drifted');
  }

  const candidateClaims = audit.candidateClaims as Json[];
  const pairResults = audit.pairResults as Json[];
  const reviewKeys = candidateClaims.map((row) => String(row.reviewKey));
  if (
    candidateClaims.length !== EXPECTED_CANDIDATES
    || new Set(reviewKeys).size !== EXPECTED_CANDIDATES
  ) {
    throw new Error('Tranche-3 candidate review-key cardinality drifted');
  }
  const reviewKeySha256 = setSha(reviewKeys);
  if (reviewKeySha256 !== EXPECTED_REVIEW_KEY_SHA) {
    throw new Error(`Tranche-3 review-key set drifted: ${reviewKeySha256}`);
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
      throw new Error(`Invalid or duplicate tranche-3 override: ${key}`);
    }
    if (
      override.decision !== 'applicable'
      && override.decision !== 'ambiguous_fail_closed'
    ) {
      throw new Error(`Unsupported tranche-3 override decision: ${key}`);
    }
    if (!String(override.reason ?? '').trim()) {
      throw new Error(`Missing tranche-3 override rationale: ${key}`);
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
      `Reviewed tranche-3 counts drifted: ${JSON.stringify(reviewDecisionCounts)}`,
    );
  }

  const alignmentCounts = {
    aligns: reviewedCandidates.filter((row) => row.alignmentDirection === 'aligns').length,
    conflicts: reviewedCandidates.filter((row) => row.alignmentDirection === 'conflicts').length,
  };
  if (alignmentCounts.aligns !== 8 || alignmentCounts.conflicts !== 0) {
    throw new Error(`Alignment counts drifted: ${JSON.stringify(alignmentCounts)}`);
  }

  const expectedApplicableReviewKeys = [
    'harder_conservation_programs|SF2077|2025-05-05|a2c37a4f9ebb4bcc58f32e4e3a40cd3d4473c4521eae4b89fef336342bd7eab7',
    'kresha_career_pathway_education_reform|HF2433|2025-05-16|5da5bf18e17dfe3be6fabfe0de003a064ae1e2cc74e8a5c6eb1f3a78b2c2a7c4',
    'olson_national_guard_building_resources|SF1959|2025-05-17|a72690fa8e74efb032e110bfba05f19952b9c8866e2f512e1ea254028ab357c9',
    'rarick_state_agency_fraud_reporting|SF3045|2025-05-01|4fa4c52937972605fa8c6fd3320179f69c429d08e087127a84260be7ce2db89d',
    'robbins_state_fraud_oversight_transparency|HF2115|2025-05-05|dcda1c61b865cdc5c9bb286fd85dd444ab4006d59ac47f82f16d16247202b3fd',
    'robbins_state_fraud_oversight_transparency|HF2434|2025-05-05|11c6ab8238eb5937d830399cdeea52c7ec893e148138bed8f624838b731dc87c',
    'robbins_state_fraud_oversight_transparency|SF3045|2025-05-01|4fa4c52937972605fa8c6fd3320179f69c429d08e087127a84260be7ce2db89d',
    'west_infant_abuse_parent_education|HF2435|2025-05-12|a74f41c80e7b80117a7e82773c8c10f3878ce0d298d021ad148c896174e1de1e',
  ].sort();
  const actualApplicableReviewKeys = reviewedCandidates
    .filter((row) => row.decision === 'applicable')
    .map((row) => row.reviewKey)
    .sort();
  if (
    JSON.stringify(actualApplicableReviewKeys)
    !== JSON.stringify(expectedApplicableReviewKeys)
  ) {
    throw new Error('Applicable tranche-3 review-key set drifted');
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
      throw new Error(`Unexpected tranche-3 pair status: ${String(pair.status)}`);
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
    finalPairStatusCounts.applicable !== 8
    || finalPairStatusCounts.ambiguous_fail_closed !== 126
    || finalPairStatusCounts.not_applicable !== 916
    || finalPairStatusCounts.pending_review !== 0
  ) {
    throw new Error(
      `Final tranche-3 pair counts drifted: ${JSON.stringify(finalPairStatusCounts)}`,
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
      runId: 37798615199,
      artifactId: 11560096786,
      digest:
        'sha256:f3fbb4cdfaa8e7799c47473833e86266eb3ebd0de24b32a91a6c2cb6741fb469',
      targetTrancheIndex: 3,
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
        'Resolve public LRL identity to the internal historical membership identity for the eight applicable context records before any feature integration; do not guess IDs.',
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
    historicalDensity2025HouseCohort2ApplicabilityTranche3Review: {
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
