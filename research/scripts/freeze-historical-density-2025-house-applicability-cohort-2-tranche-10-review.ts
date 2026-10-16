import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const AUDIT_SCHEMA =
  'historical-density-2025-house-applicability-candidate-audit-cohort-2-tranche-10-v1';
const DECISION_SCHEMA =
  'historical-density-2025-house-applicability-cohort-2-tranche-10-decisions-v1';
const OUTPUT_SCHEMA =
  'historical-density-2025-house-applicability-review-cohort-2-tranche-10-v1';
const EXPECTED_REVIEW_KEY_SHA =
  '73700085a7053d976965283a38268929a219bd70512e2aa3b7c5cb3b8bdd5ee5';
const EXPECTED_AUDIT_CONTENT_SHA =
  '64b9217e6f9c01edc7e3742b992d47f77f7fc1a5939d778b828cef8a2f9af089';
const EXPECTED_TARGET_EVENT_SHA =
  '87cfaaec13743d7c7d97f2ea3b69f5f2cfb389320e356a4893991827ba023848';
const EXPECTED_CANDIDATES = 174;
const EXPECTED_CANDIDATE_BILLS = 19;
const EXPECTED_CANDIDATE_MEMBERS = 42;
const EXPECTED_SEMANTIC_GROUPS = 42;
const EXPECTED_ELIGIBLE_PAIRS = 858;
const EXPECTED_BASELINE_AMBIGUOUS = 64;
const EXPECTED_NOT_NOMINATED = 620;
const EXPECTED_APPLICABLE = 4;
const EXPECTED_REVIEW_AMBIGUOUS = 5;
const EXPECTED_REVIEW_NOT_APPLICABLE = 165;

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
    env('VOTEPREDICT_2025_HOUSE_COHORT_2_TRANCHE10_APPLICABILITY_AUDIT_PATH'),
  );
  const decisions = readJson(
    env('VOTEPREDICT_2025_HOUSE_COHORT_2_TRANCHE10_APPLICABILITY_DECISIONS_PATH'),
  );
  const output = resolve(
    env('VOTEPREDICT_2025_HOUSE_COHORT_2_TRANCHE10_APPLICABILITY_REVIEW_OUTPUT'),
  );
  const semantic = readJson(env('VOTEPREDICT_2025_HOUSE_COHORT_2_TRANCHE10_SEMANTIC_AGGREGATE_PATH'));
  if (semantic.schemaVersion !== 'historical-density-2025-house-semantic-review-cohort-2-aggregate-v1'
    || semantic.batchId !== 'EQV1-HISTORICAL-DENSITY-2025-HOUSE-002'
    || semantic.contentSha256WithoutSelfField !== 'fdbcb6061ad1f8fe79db1525345627f638a450227d68c5e72890d7e82dfc4cb1'
    || semantic.summary?.novelSemanticGroups !== 42
    || semantic.summary?.internalMembershipIdentitiesResolved !== 0
    || !Array.isArray(semantic.semanticGroups)
    || semantic.semanticGroups.length !== 42) {
    throw new Error('Canonical cohort-2 source provenance drifted');
  }
  const canonicalSourceGroups = semantic.semanticGroups as Json[];
  const sourceByKey = new Map(canonicalSourceGroups.map((row) => [String(row.semanticKey), row] as const));
  if (sourceByKey.size !== 42) throw new Error('Duplicate canonical source semantic key');


  if (
    audit.schemaVersion !== AUDIT_SCHEMA
    || audit.issue !== 718
    || audit.contentSha256WithoutSelfField !== EXPECTED_AUDIT_CONTENT_SHA
    || audit.session !== '2025-2026'
    || audit.frozenInputs?.targetTrancheIndex !== 10
    || audit.frozenInputs?.targetRankStart !== 226
    || audit.frozenInputs?.targetRankEnd !== 250
    || audit.frozenInputs?.targetEventKeySha256 !== EXPECTED_TARGET_EVENT_SHA
    || audit.cohort?.novelSemanticGroups !== 42
    || audit.cohort?.targetEvents !== 25
    || audit.cohort?.eligibleClaimEventPairs !== EXPECTED_ELIGIBLE_PAIRS
    || audit.cohort?.ineligibleSourceNotYetAvailablePairs !== 192
    || audit.cohort?.eligibleClaimEventPairsByTargetYear?.['2025'] !== 270
    || audit.cohort?.eligibleClaimEventPairsByTargetYear?.['2026'] !== 588
    || audit.cohort?.internalMembershipIdentitiesResolved !== 0
    || audit.sourceVerification?.events !== 25
    || audit.sourceVerification?.statusCounts?.verified !== 23
    || audit.sourceVerification?.statusCounts?.no_strict_prevote_version !== 2
    || Object.keys(audit.sourceVerification?.statusCounts ?? {}).length !== 2
    || audit.sourceVerification?.sameDayVersionEligible !== false
    || audit.candidateScreen?.candidateClaimPairs !== EXPECTED_CANDIDATES
    || audit.candidateScreen?.candidateReviewGroups !== EXPECTED_CANDIDATES
    || audit.candidateScreen?.candidateBills !== EXPECTED_CANDIDATE_BILLS
    || audit.candidateScreen?.candidatePublicMembers !== EXPECTED_CANDIDATE_MEMBERS
    || audit.candidateScreen?.candidateSemanticGroups !== EXPECTED_SEMANTIC_GROUPS
    || (audit.candidateScreen?.pairStatusCounts?.ambiguous_fail_closed ?? 0) !== EXPECTED_BASELINE_AMBIGUOUS
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
    throw new Error('2025 House tranche-10 candidate audit identity/policy drifted');
  }

  if (
    decisions.schemaVersion !== DECISION_SCHEMA
    || decisions.issue !== 718
    || decisions.session !== '2025-2026'
    || decisions.frozenCandidateArtifact?.runId !== 37836795789
    || decisions.frozenCandidateArtifact?.artifactId !== 11575244373
    || decisions.frozenCandidateArtifact?.digest !==
      'sha256:7f4e038d45793474c4e46196c7fb06cc916ac533e271280c1cb307e406a6fd3f'
    || decisions.frozenCandidateArtifact?.contentSha256WithoutSelfField !== EXPECTED_AUDIT_CONTENT_SHA
    || decisions.frozenCandidateArtifact?.targetTrancheIndex !== 10
    || decisions.frozenCandidateArtifact?.targetRankStart !== 226
    || decisions.frozenCandidateArtifact?.targetRankEnd !== 250
    || decisions.frozenCandidateArtifact?.targetEventKeySha256 !== EXPECTED_TARGET_EVENT_SHA
    || decisions.frozenCandidateArtifact?.reviewKeySha256 !== EXPECTED_REVIEW_KEY_SHA
    || decisions.frozenCandidateArtifact?.eligibleClaimEventPairs !== EXPECTED_ELIGIBLE_PAIRS
    || decisions.frozenCandidateArtifact?.ineligibleSourceNotYetAvailablePairs !== 192
    || decisions.frozenCandidateArtifact?.eligibleClaimEventPairsByTargetYear?.['2025'] !== 270
    || decisions.frozenCandidateArtifact?.eligibleClaimEventPairsByTargetYear?.['2026'] !== 588
    || decisions.frozenCandidateArtifact?.candidatePairs !== EXPECTED_CANDIDATES
    || decisions.frozenCandidateArtifact?.candidateBills !== EXPECTED_CANDIDATE_BILLS
    || decisions.frozenCandidateArtifact?.candidatePublicMembers !== EXPECTED_CANDIDATE_MEMBERS
    || decisions.frozenCandidateArtifact?.candidateSemanticGroups !== EXPECTED_SEMANTIC_GROUPS
    || decisions.defaultDecision !== 'not_applicable'
    || !Array.isArray(decisions.overrides)
    || decisions.overrides.length !== 9
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
    throw new Error('2025 House tranche-10 decision manifest drifted');
  }

  const candidateClaims = audit.candidateClaims as Json[];
  const pairResults = audit.pairResults as Json[];
  const reviewKeys = candidateClaims.map((row) => String(row.reviewKey));
  if (
    candidateClaims.length !== EXPECTED_CANDIDATES
    || new Set(reviewKeys).size !== EXPECTED_CANDIDATES
  ) {
    throw new Error('Tranche-10 candidate review-key cardinality drifted');
  }
  const reviewKeySha256 = setSha(reviewKeys);
  if (reviewKeySha256 !== EXPECTED_REVIEW_KEY_SHA) {
    throw new Error(`Tranche-10 review-key set drifted: ${reviewKeySha256}`);
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
      throw new Error(`Invalid or duplicate tranche-10 override: ${key}`);
    }
    if (
      override.decision !== 'applicable'
      && override.decision !== 'ambiguous_fail_closed'
    ) {
      throw new Error(`Unsupported tranche-10 override decision: ${key}`);
    }
    if (!String(override.reason ?? '').trim()) {
      throw new Error(`Missing tranche-10 override rationale: ${key}`);
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
      const frozenSource = sourceByKey.get(String(row.semanticKey));
      if (!frozenSource
        || frozenSource.publicMemberKey !== row.publicMemberKey
        || frozenSource.lrlId !== row.lrlId
        || frozenSource.memberName !== row.memberName
        || frozenSource.normalizedClaim !== row.normalizedClaim
        || frozenSource.earliestAvailability !== row.claimAvailableAt
        || frozenSource.stance !== row.memberStance
        || frozenSource.claimType !== row.claimType
        || JSON.stringify(frozenSource.sourceRows) !== JSON.stringify(row.sourceRows)
        || JSON.stringify(frozenSource.sourceUrls) !== JSON.stringify(row.sourceUrls)
        || JSON.stringify(frozenSource.topics) !== JSON.stringify(row.topics)
        || !String(frozenSource.supportingExcerpt ?? '').trim()) {
        throw new Error(`Immutable source-claim provenance drifted: ${key}`);
      }
      const override = overrides.get(key);
      const decision = override?.decision ?? decisions.defaultDecision;
      const reason =
        override?.reason ?? decisions.defaultBillRationales[String(row.identifier)];
      if (!reason) {
        throw new Error(`Missing review rationale for ${key}`);
      }
      if (
        row.claimAvailableAt >= row.occurredOn
        || row.versionProof?.postedOn >= row.occurredOn
        || row.versionProof?.strictlyBeforeVoteDate !== true
        || row.internalMembershipIdentityResolved !== false
      ) {
        throw new Error(`Candidate provenance/identity drifted for ${key}`);
      }
      return {
        reviewKey: key,
        semanticKey: row.semanticKey,
        publicMemberKey: row.publicMemberKey,
        sourceRows: row.sourceRows,
        sourceUrls: row.sourceUrls,
        claimType: row.claimType,
        topics: row.topics,
        nominationHits: row.nominationHits,
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
        immutableSemanticGroup: frozenSource,
        frozenCandidate: row,
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
      `Reviewed tranche-10 counts drifted: ${JSON.stringify(reviewDecisionCounts)}`,
    );
  }

  const alignmentCounts = {
    aligns: reviewedCandidates.filter((row) => row.alignmentDirection === 'aligns').length,
    conflicts: reviewedCandidates.filter((row) => row.alignmentDirection === 'conflicts').length,
  };
  if (alignmentCounts.aligns !== 4 || alignmentCounts.conflicts !== 0) {
    throw new Error(`Alignment counts drifted: ${JSON.stringify(alignmentCounts)}`);
  }

  const expectedApplicableReviewKeys = [
    "harder_conservation_programs|SF2077|2026-05-17|a2c37a4f9ebb4bcc58f32e4e3a40cd3d4473c4521eae4b89fef336342bd7eab7",
    "niska_attorney_general_data_transparency|HF20|2025-02-20|98e1e48b9758410a625b6dbf0b39515ef14096504adccc5670287b97b6b48ddd",
    "robbins_state_fraud_oversight_transparency|HF23|2025-03-10|5e1311515995e16ecae919f370906498e2717cbef63d08b975910019f6f4566d",
    "robbins_state_fraud_oversight_transparency|HF3629|2026-05-17|cd76ef81ad166a5167b9e6bea12386da8535303cc24043981f1d9bd7ada4a37d"
].sort();
  const expectedAmbiguousReviewKeys = [
    "rarick_state_agency_fraud_reporting|HF3629|2026-05-17|cd76ef81ad166a5167b9e6bea12386da8535303cc24043981f1d9bd7ada4a37d",
    "robbins_state_fraud_oversight_transparency|SF2077|2026-05-17|a2c37a4f9ebb4bcc58f32e4e3a40cd3d4473c4521eae4b89fef336342bd7eab7",
    "robbins_state_fraud_oversight_transparency|SF4476|2026-05-17|f34f7c2c6c1b3fd6b3310ff41fe054163f1d795bf727556f0ac8d56a71da4327",
    "robbins_state_fraud_oversight_transparency|SF4612|2026-05-17|f9050f3d2c553cc77d2ed09850236be7fceaeda6d468c6afd19d1c8f4edb284e",
    "scott_childcare_abuse_safeguards|SF4612|2026-05-17|f9050f3d2c553cc77d2ed09850236be7fceaeda6d468c6afd19d1c8f4edb284e"
].sort();
  const actualAmbiguousReviewKeys = reviewedCandidates
    .filter((row) => row.decision === 'ambiguous_fail_closed')
    .map((row) => row.reviewKey).sort();
  if (JSON.stringify(actualAmbiguousReviewKeys) !== JSON.stringify(expectedAmbiguousReviewKeys)) {
    throw new Error('Ambiguous tranche-10 exact review-key set drifted');
  }
  const actualApplicableReviewKeys = reviewedCandidates
    .filter((row) => row.decision === 'applicable')
    .map((row) => row.reviewKey)
    .sort();
  if (
    JSON.stringify(actualApplicableReviewKeys)
    !== JSON.stringify(expectedApplicableReviewKeys)
  ) {
    throw new Error('Applicable tranche-10 review-key set drifted');
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
      throw new Error(`Unexpected tranche-10 pair status: ${String(pair.status)}`);
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
    finalPairStatusCounts.applicable !== 4
    || finalPairStatusCounts.ambiguous_fail_closed !== 69
    || finalPairStatusCounts.not_applicable !== 785
    || finalPairStatusCounts.pending_review !== 0
  ) {
    throw new Error(
      `Final tranche-10 pair counts drifted: ${JSON.stringify(finalPairStatusCounts)}`,
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
      runId: 37836795789,
      artifactId: 11575244373,
      digest:
        'sha256:7f4e038d45793474c4e46196c7fb06cc916ac533e271280c1cb307e406a6fd3f',
      targetTrancheIndex: 10,
      targetEventKeySha256: EXPECTED_TARGET_EVENT_SHA,
      reviewKeySha256,
      semanticAggregateArtifactId: 11555527900,
      semanticAggregateArchiveDigest: 'sha256:fbd0cc191039eb478aa25fe8d34f289b8906d5f4ac728225e183c8da37956e2b',
      semanticAggregateContentProof: 'fdbcb6061ad1f8fe79db1525345627f638a450227d68c5e72890d7e82dfc4cb1',
    },
    review: {
      eligibleClaimEventPairs: EXPECTED_ELIGIBLE_PAIRS,
      excludedNotYetAvailableSourcePairs: 192,
      eligibleClaimEventPairsByTargetYear: { '2025': 270, '2026': 588 },
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
        'Resolve public LRL identity to the internal historical membership identity for the four applicable context records before any feature integration; do not guess IDs.',
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
    historicalDensity2025HouseCohort2ApplicabilityTranche10Review: {
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
