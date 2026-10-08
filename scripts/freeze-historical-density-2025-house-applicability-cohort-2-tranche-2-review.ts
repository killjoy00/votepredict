import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const AUDIT_SCHEMA =
  'historical-density-2025-house-applicability-candidate-audit-cohort-2-tranche-2-v1';
const DECISION_SCHEMA =
  'historical-density-2025-house-applicability-cohort-2-tranche-2-decisions-v1';
const OUTPUT_SCHEMA =
  'historical-density-2025-house-applicability-review-cohort-2-tranche-2-v1';
const EXPECTED_REVIEW_KEY_SHA =
  'bd3b49eb5b3c406d1b65741b049c97b229653b42105d0c0b8483b8af085bd6c4';
const EXPECTED_AUDIT_CONTENT_SHA =
  'a57d6df55f42a20f5a16392504581395fdc2774a61f0563bb80d0ae63fdcd5dc';
const EXPECTED_TARGET_EVENT_SHA =
  '9304a46f37889fa3ae166803e3675669c55fb99d475f1484ea3efd11f7e01299';
const EXPECTED_CANDIDATES = 333;
const EXPECTED_CANDIDATE_BILLS = 19;
const EXPECTED_CANDIDATE_MEMBERS = 39;
const EXPECTED_SEMANTIC_GROUPS = 39;
const EXPECTED_ELIGIBLE_PAIRS = 1050;
const EXPECTED_BASELINE_AMBIGUOUS = 126;
const EXPECTED_NOT_NOMINATED = 591;
const EXPECTED_APPLICABLE = 6;
const EXPECTED_REVIEW_AMBIGUOUS = 0;
const EXPECTED_REVIEW_NOT_APPLICABLE = 327;

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
    env('VOTEPREDICT_2025_HOUSE_TRANCHE2_APPLICABILITY_AUDIT_PATH'),
  );
  const decisions = readJson(
    env('VOTEPREDICT_2025_HOUSE_TRANCHE2_APPLICABILITY_DECISIONS_PATH'),
  );
  const output = resolve(
    env('VOTEPREDICT_2025_HOUSE_TRANCHE2_APPLICABILITY_REVIEW_OUTPUT'),
  );

  if (
    audit.schemaVersion !== AUDIT_SCHEMA
    || audit.issue !== 718
    || audit.contentSha256WithoutSelfField !== EXPECTED_AUDIT_CONTENT_SHA
    || audit.session !== '2025-2026'
    || audit.frozenInputs?.targetTrancheIndex !== 2
    || audit.frozenInputs?.targetRankStart !== 26
    || audit.frozenInputs?.targetRankEnd !== 50
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
    || audit.policy?.featureRowsWritten !== false
    || audit.policy?.modelFitting !== 'none'
    || audit.policy?.servingChanged !== false
  ) {
    throw new Error('2025 House tranche-2 candidate audit identity/policy drifted');
  }

  if (
    decisions.schemaVersion !== DECISION_SCHEMA
    || decisions.issue !== 718
    || decisions.session !== '2025-2026'
    || decisions.frozenCandidateArtifact?.runId !== 37792513184
    || decisions.frozenCandidateArtifact?.artifactId !== 11557221099
    || decisions.frozenCandidateArtifact?.digest !==
      'sha256:bfcd0748f2a7052e6847630eb1a6710be33b6053ae9ed51f5b7e74973aebb8f8'
    || decisions.frozenCandidateArtifact?.contentSha256WithoutSelfField !== EXPECTED_AUDIT_CONTENT_SHA
    || decisions.frozenCandidateArtifact?.targetTrancheIndex !== 2
    || decisions.frozenCandidateArtifact?.targetEventKeySha256 !== EXPECTED_TARGET_EVENT_SHA
    || decisions.frozenCandidateArtifact?.reviewKeySha256 !== EXPECTED_REVIEW_KEY_SHA
    || decisions.frozenCandidateArtifact?.eligibleClaimEventPairs !== EXPECTED_ELIGIBLE_PAIRS
    || decisions.frozenCandidateArtifact?.candidatePairs !== EXPECTED_CANDIDATES
    || decisions.frozenCandidateArtifact?.candidateBills !== EXPECTED_CANDIDATE_BILLS
    || decisions.frozenCandidateArtifact?.candidatePublicMembers !== EXPECTED_CANDIDATE_MEMBERS
    || decisions.frozenCandidateArtifact?.candidateSemanticGroups !== EXPECTED_SEMANTIC_GROUPS
    || decisions.defaultDecision !== 'not_applicable'
    || !Array.isArray(decisions.overrides)
    || decisions.overrides.length !== 6
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
    throw new Error('2025 House tranche-2 decision manifest drifted');
  }

  const candidateClaims = audit.candidateClaims as Json[];
  const pairResults = audit.pairResults as Json[];
  const reviewKeys = candidateClaims.map((row) => String(row.reviewKey));
  if (
    candidateClaims.length !== EXPECTED_CANDIDATES
    || new Set(reviewKeys).size !== EXPECTED_CANDIDATES
  ) {
    throw new Error('Tranche-2 candidate review-key cardinality drifted');
  }
  const reviewKeySha256 = setSha(reviewKeys);
  if (reviewKeySha256 !== EXPECTED_REVIEW_KEY_SHA) {
    throw new Error(`Tranche-2 review-key set drifted: ${reviewKeySha256}`);
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
      throw new Error(`Invalid or duplicate tranche-2 override: ${key}`);
    }
    if (
      override.decision !== 'applicable'
      && override.decision !== 'ambiguous_fail_closed'
    ) {
      throw new Error(`Unsupported tranche-2 override decision: ${key}`);
    }
    if (!String(override.reason ?? '').trim()) {
      throw new Error(`Missing tranche-2 override rationale: ${key}`);
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
      `Reviewed tranche-2 counts drifted: ${JSON.stringify(reviewDecisionCounts)}`,
    );
  }

  const alignmentCounts = {
    aligns: reviewedCandidates.filter((row) => row.alignmentDirection === 'aligns').length,
    conflicts: reviewedCandidates.filter((row) => row.alignmentDirection === 'conflicts').length,
  };
  if (alignmentCounts.aligns !== 6 || alignmentCounts.conflicts !== 0) {
    throw new Error(`Alignment counts drifted: ${JSON.stringify(alignmentCounts)}`);
  }

  const expectedApplicableReviewKeys = [
    'bahner_hoa_cic_consumer_protection_reform|SF2216|2025-04-29|85e7d06d2ff842eb997b16692c730d9d0180063ec68c2b3f072443ac4d7fea4f',
    'harder_conservation_programs|HF2563|2025-04-25|8c0cb67231f61973542f9a4565b4720bf34adf9c70ea379be007bf57bb155ee1',
    'koegel_empowering_small_communities_program|HF2438|2025-04-28|46388d1841e58d9befc08450243def66157e678619b30511889a69aa96fd50d0',
    'olson_national_guard_building_resources|SF1959|2025-04-29|a72690fa8e74efb032e110bfba05f19952b9c8866e2f512e1ea254028ab357c9',
    'rarick_state_agency_fraud_reporting|HF2432|2025-04-25|f82944db2f58b5a0da53d7f76101c6eb7a7c2c6211419f14ad14ea4e05c0bf08',
    'robbins_state_fraud_oversight_transparency|HF2432|2025-04-25|f82944db2f58b5a0da53d7f76101c6eb7a7c2c6211419f14ad14ea4e05c0bf08',
  ].sort();
  const actualApplicableReviewKeys = reviewedCandidates
    .filter((row) => row.decision === 'applicable')
    .map((row) => row.reviewKey)
    .sort();
  if (
    JSON.stringify(actualApplicableReviewKeys)
    !== JSON.stringify(expectedApplicableReviewKeys)
  ) {
    throw new Error('Applicable tranche-2 review-key set drifted');
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
      throw new Error(`Unexpected tranche-2 pair status: ${String(pair.status)}`);
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
    finalPairStatusCounts.applicable !== 6
    || finalPairStatusCounts.ambiguous_fail_closed !== 126
    || finalPairStatusCounts.not_applicable !== 918
    || finalPairStatusCounts.pending_review !== 0
  ) {
    throw new Error(
      `Final tranche-2 pair counts drifted: ${JSON.stringify(finalPairStatusCounts)}`,
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
      runId: 37792513184,
      artifactId: 11557221099,
      digest:
        'sha256:bfcd0748f2a7052e6847630eb1a6710be33b6053ae9ed51f5b7e74973aebb8f8',
      targetTrancheIndex: 2,
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
        'Resolve public LRL identity to the internal historical membership identity for the six applicable context records before any feature integration; do not guess IDs.',
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
    historicalDensity2025HouseCohort2ApplicabilityTranche2Review: {
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
