import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const AUDIT_SCHEMA =
  'historical-density-2025-house-applicability-candidate-audit-tranche-v1';
const DECISION_SCHEMA =
  'historical-density-2025-house-applicability-tranches-9-11-decisions-v1';
const OUTPUT_SCHEMA =
  'historical-density-2025-house-applicability-tranches-9-11-review-v1';

type Json = Record<string, any>;

const CONFIG: Record<number, {
  rankStart: number;
  rankEnd: number;
  events: number;
  eventSha: string;
  reviewKeySha: string;
  eligiblePairs: number;
  candidates: number;
  candidateBills: number;
  candidateMembers: number;
  candidateGroups: number;
  baselineAmbiguous: number;
  notNominated: number;
  reviewApplicable: number;
  reviewAmbiguous: number;
  reviewNotApplicable: number;
  finalApplicable: number;
  finalAmbiguous: number;
  finalNotApplicable: number;
  artifactId: number;
  artifactDigest: string;
}> = {
  9: {
    rankStart: 201,
    rankEnd: 225,
    events: 25,
    eventSha: 'ee804ad6c0d65f64848a96c716e000146ca09e74ac00e31ca4a2be9d08896c3e',
    reviewKeySha: '3974d68ee7e02f1acfffdf8d8a7b2af3ad3789a57778a59aea776aebf4aec0a3',
    eligiblePairs: 1150,
    candidates: 196,
    candidateBills: 17,
    candidateMembers: 36,
    candidateGroups: 36,
    baselineAmbiguous: 92,
    notNominated: 862,
    reviewApplicable: 4,
    reviewAmbiguous: 6,
    reviewNotApplicable: 186,
    finalApplicable: 4,
    finalAmbiguous: 98,
    finalNotApplicable: 1048,
    artifactId: 11456955534,
    artifactDigest: 'sha256:e39e55879877c57e9d393be137864a4c7df3d8b3384ee20fba6258b94b105b58',
  },
  10: {
    rankStart: 226,
    rankEnd: 250,
    events: 25,
    eventSha: '87cfaaec13743d7c7d97f2ea3b69f5f2cfb389320e356a4893991827ba023848',
    reviewKeySha: 'a0aaa42ff9ad13f23608925d32189b8bf930f629acda9f85fae01160e544532f',
    eligiblePairs: 929,
    candidates: 155,
    candidateBills: 13,
    candidateMembers: 37,
    candidateGroups: 37,
    baselineAmbiguous: 70,
    notNominated: 704,
    reviewApplicable: 6,
    reviewAmbiguous: 5,
    reviewNotApplicable: 144,
    finalApplicable: 6,
    finalAmbiguous: 75,
    finalNotApplicable: 848,
    artifactId: 11456880675,
    artifactDigest: 'sha256:45b83827707ccf31ec3e580cdc4254c8b282f13ff0de222a8c5934e9a69163b2',
  },
  11: {
    rankStart: 251,
    rankEnd: 264,
    events: 14,
    eventSha: '3d4d83276928f170726e2a499c2422eac2ede373f711bcdcfdca29c542e95242',
    reviewKeySha: '94a1c7f65eaa371c6719e7f22151820600b7b7a932291ce8a079f915d8f20e93',
    eligiblePairs: 510,
    candidates: 26,
    candidateBills: 5,
    candidateMembers: 18,
    candidateGroups: 18,
    baselineAmbiguous: 74,
    notNominated: 410,
    reviewApplicable: 3,
    reviewAmbiguous: 1,
    reviewNotApplicable: 22,
    finalApplicable: 3,
    finalAmbiguous: 75,
    finalNotApplicable: 432,
    artifactId: 11456386548,
    artifactDigest: 'sha256:6a8c6bf3d6f93beb8de19166e76643f005711ff724d8f0146d15d9a2c34f813f',
  },
};

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

function countBy<T>(values: readonly T[], predicate: (value: T) => boolean): number {
  return values.filter(predicate).length;
}

function validatePolicy(policy: Json): void {
  if (
    policy?.outcomeUse !== 'none'
    || policy?.targetVoteOutcomesRead !== false
    || policy?.productionDatabaseQueried !== false
    || policy?.productionWrites !== false
    || policy?.vercelUsed !== false
    || policy?.publicLrlIdentityOnly !== true
    || policy?.internalMembershipIdentityResolved !== false
    || policy?.internalIdentityRequiredBeforeFeatureIntegration !== true
    || policy?.featureRowsWritten !== false
    || policy?.modelFitting !== 'none'
    || policy?.servingChanged !== false
  ) {
    throw new Error('Final House review safety policy drifted');
  }
}

function main(): void {
  const decisions = readJson(
    env('VOTEPREDICT_2025_HOUSE_TRANCHE9_11_APPLICABILITY_DECISIONS_PATH'),
  );
  const output = resolve(
    env('VOTEPREDICT_2025_HOUSE_TRANCHE9_11_APPLICABILITY_REVIEW_OUTPUT'),
  );

  if (
    decisions.schemaVersion !== DECISION_SCHEMA
    || decisions.issue !== 718
    || decisions.session !== '2025-2026'
    || decisions.defaultDecision !== 'not_applicable'
    || !Array.isArray(decisions.tranches)
    || decisions.tranches.length !== 3
    || decisions.policy?.everyCandidateReviewed !== true
    || decisions.policy?.applicableRequiresExplicitOverride !== true
    || decisions.policy?.ambiguousRequiresExplicitOverride !== true
    || decisions.policy?.unlistedCandidateDecision !== 'unavailable_fail_closed'
    || decisions.policy?.contextOnly !== true
    || decisions.policy?.mechanicallyActionable !== false
    || decisions.policy?.modelWeight !== 0
  ) {
    throw new Error('Final House decision manifest identity/policy drifted');
  }
  validatePolicy(decisions.policy);

  const reports: Json[] = [];
  const aggregate = {
    candidatePairs: 0,
    reviewedApplicable: 0,
    reviewedAmbiguous: 0,
    reviewedNotApplicable: 0,
    eligiblePairs: 0,
    finalApplicable: 0,
    finalAmbiguous: 0,
    finalNotApplicable: 0,
    aligns: 0,
    conflicts: 0,
  };

  for (const trancheIndex of [9, 10, 11]) {
    const config = CONFIG[trancheIndex]!;
    const audit = readJson(
      env(`VOTEPREDICT_2025_HOUSE_TRANCHE${trancheIndex}_APPLICABILITY_AUDIT_PATH`),
    );
    const trancheDecision = decisions.tranches.find(
      (row: Json) => row.trancheIndex === trancheIndex,
    ) as Json | undefined;
    if (!trancheDecision) {
      throw new Error(`Missing tranche-${trancheIndex} decision section`);
    }

    if (
      audit.schemaVersion !== AUDIT_SCHEMA
      || audit.issue !== 718
      || audit.session !== '2025-2026'
      || audit.frozenInputs?.targetTrancheIndex !== trancheIndex
      || audit.frozenInputs?.targetRankStart !== config.rankStart
      || audit.frozenInputs?.targetRankEnd !== config.rankEnd
      || audit.frozenInputs?.targetEventKeySha256 !== config.eventSha
      || audit.cohort?.novelSemanticGroups !== 46
      || audit.cohort?.targetEvents !== config.events
      || audit.cohort?.eligibleClaimEventPairs !== config.eligiblePairs
      || audit.cohort?.internalMembershipIdentitiesResolved !== 0
      || audit.sourceVerification?.events !== config.events
      || audit.sourceVerification?.sameDayVersionEligible !== false
      || Object.keys(audit.sourceVerification?.statusCounts ?? {}).some(
        (status) => status !== 'verified' && status !== 'no_strict_prevote_version',
      )
      || audit.candidateScreen?.candidateClaimPairs !== config.candidates
      || audit.candidateScreen?.candidateReviewGroups !== config.candidates
      || audit.candidateScreen?.candidateBills !== config.candidateBills
      || audit.candidateScreen?.candidatePublicMembers !== config.candidateMembers
      || audit.candidateScreen?.candidateSemanticGroups !== config.candidateGroups
      || (audit.candidateScreen?.pairStatusCounts?.ambiguous_fail_closed ?? 0)
        !== config.baselineAmbiguous
      || audit.candidateScreen?.pairStatusCounts?.not_nominated !== config.notNominated
      || audit.candidateScreen?.pairStatusCounts?.candidate_for_semantic_review
        !== config.candidates
      || audit.candidateScreen?.automaticApplicableRows !== 0
      || audit.candidateScreen?.automaticAlignmentRows !== 0
      || audit.policy?.sameDayBillVersionsExcluded !== true
      || audit.policy?.deterministicScreenCanDeclareApplicability !== false
      || audit.policy?.semanticReviewRequiredForApplicability !== true
    ) {
      throw new Error(`Tranche-${trancheIndex} candidate audit identity/policy drifted`);
    }
    validatePolicy(audit.policy);

    const frozen = trancheDecision.frozenCandidateArtifact;
    if (
      frozen?.runId !== 37560399946
      || frozen?.artifactId !== config.artifactId
      || frozen?.digest !== config.artifactDigest
      || frozen?.targetRankStart !== config.rankStart
      || frozen?.targetRankEnd !== config.rankEnd
      || frozen?.targetEventKeySha256 !== config.eventSha
      || frozen?.reviewKeySha256 !== config.reviewKeySha
      || frozen?.eligibleClaimEventPairs !== config.eligiblePairs
      || frozen?.candidatePairs !== config.candidates
      || frozen?.candidateBills !== config.candidateBills
      || frozen?.candidatePublicMembers !== config.candidateMembers
      || frozen?.candidateSemanticGroups !== config.candidateGroups
      || trancheDecision.expectedReviewCounts?.applicable !== config.reviewApplicable
      || trancheDecision.expectedReviewCounts?.ambiguous_fail_closed !== config.reviewAmbiguous
      || trancheDecision.expectedReviewCounts?.not_applicable !== config.reviewNotApplicable
      || trancheDecision.expectedReviewCounts?.pending_review !== 0
      || trancheDecision.expectedFinalPairStatusCounts?.applicable !== config.finalApplicable
      || trancheDecision.expectedFinalPairStatusCounts?.ambiguous_fail_closed !== config.finalAmbiguous
      || trancheDecision.expectedFinalPairStatusCounts?.not_applicable !== config.finalNotApplicable
      || trancheDecision.expectedFinalPairStatusCounts?.pending_review !== 0
      || !Array.isArray(trancheDecision.overrides)
    ) {
      throw new Error(`Tranche-${trancheIndex} decision manifest drifted`);
    }

    const candidateClaims = audit.candidateClaims as Json[];
    const pairResults = audit.pairResults as Json[];
    const reviewKeys = candidateClaims.map((row) => String(row.reviewKey));
    if (
      candidateClaims.length !== config.candidates
      || new Set(reviewKeys).size !== config.candidates
      || setSha(reviewKeys) !== config.reviewKeySha
    ) {
      throw new Error(`Tranche-${trancheIndex} review-key set drifted`);
    }

    const candidateBills = [
      ...new Set(candidateClaims.map((row) => String(row.identifier))),
    ].sort();
    const rationaleBills = Object.keys(
      trancheDecision.defaultBillRationales ?? {},
    ).sort();
    if (
      candidateBills.length !== config.candidateBills
      || JSON.stringify(candidateBills) !== JSON.stringify(rationaleBills)
    ) {
      throw new Error(`Tranche-${trancheIndex} bill-rationale coverage drifted`);
    }
    for (const identifier of candidateBills) {
      if (!String(trancheDecision.defaultBillRationales[identifier] ?? '').trim()) {
        throw new Error(`Missing tranche-${trancheIndex} rationale for ${identifier}`);
      }
    }

    const candidateByKey = new Map(
      candidateClaims.map((row) => [String(row.reviewKey), row] as const),
    );
    const overrides = new Map<string, Json>();
    for (const override of trancheDecision.overrides as Json[]) {
      const key = String(override.reviewKey ?? '');
      if (!key || overrides.has(key) || !candidateByKey.has(key)) {
        throw new Error(`Invalid/duplicate tranche-${trancheIndex} override: ${key}`);
      }
      if (
        override.decision !== 'applicable'
        && override.decision !== 'ambiguous_fail_closed'
      ) {
        throw new Error(`Unsupported tranche-${trancheIndex} override: ${key}`);
      }
      if (!String(override.reason ?? '').trim()) {
        throw new Error(`Missing tranche-${trancheIndex} override reason: ${key}`);
      }
      if (
        override.decision === 'applicable'
        && (
          !String(override.billPolicyDirection ?? '').trim()
          || !['aligns', 'conflicts'].includes(String(override.alignmentDirection))
        )
      ) {
        throw new Error(`Applicable override lacks direction: ${key}`);
      }
      if (
        override.decision === 'ambiguous_fail_closed'
        && (
          override.billPolicyDirection !== null
          || override.alignmentDirection !== null
        )
      ) {
        throw new Error(`Ambiguous override inferred direction: ${key}`);
      }
      overrides.set(key, override);
    }

    const reviewedCandidates = candidateClaims
      .map((row) => {
        const key = String(row.reviewKey);
        const override = overrides.get(key);
        const decision = override?.decision ?? decisions.defaultDecision;
        const reason =
          override?.reason
          ?? trancheDecision.defaultBillRationales[String(row.identifier)];
        if (!reason) throw new Error(`Missing review reason for ${key}`);
        if (
          row.versionProof?.strictlyBeforeVoteDate !== true
          || row.internalMembershipIdentityResolved !== false
        ) {
          throw new Error(`Candidate provenance drifted for ${key}`);
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
      applicable: countBy(reviewedCandidates, (row) => row.decision === 'applicable'),
      ambiguous_fail_closed: countBy(
        reviewedCandidates,
        (row) => row.decision === 'ambiguous_fail_closed',
      ),
      not_applicable: countBy(
        reviewedCandidates,
        (row) => row.decision === 'not_applicable',
      ),
      pending_review: 0,
    };
    if (
      reviewDecisionCounts.applicable !== config.reviewApplicable
      || reviewDecisionCounts.ambiguous_fail_closed !== config.reviewAmbiguous
      || reviewDecisionCounts.not_applicable !== config.reviewNotApplicable
    ) {
      throw new Error(
        `Tranche-${trancheIndex} reviewed counts drifted: ${JSON.stringify(reviewDecisionCounts)}`,
      );
    }

    const alignmentCounts = {
      aligns: countBy(reviewedCandidates, (row) => row.alignmentDirection === 'aligns'),
      conflicts: countBy(reviewedCandidates, (row) => row.alignmentDirection === 'conflicts'),
    };
    if (
      alignmentCounts.aligns !== config.reviewApplicable
      || alignmentCounts.conflicts !== 0
    ) {
      throw new Error(
        `Tranche-${trancheIndex} alignment counts drifted: ${JSON.stringify(alignmentCounts)}`,
      );
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
      } else if (pair.status === 'not_nominated') {
        finalPairStatusCounts.not_applicable += 1;
      } else if (pair.status === 'candidate_for_semantic_review') {
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
      } else {
        throw new Error(
          `Unexpected tranche-${trancheIndex} pair status: ${String(pair.status)}`,
        );
      }
    }
    if (
      finalPairStatusCounts.applicable !== config.finalApplicable
      || finalPairStatusCounts.ambiguous_fail_closed !== config.finalAmbiguous
      || finalPairStatusCounts.not_applicable !== config.finalNotApplicable
      || finalPairStatusCounts.pending_review !== 0
    ) {
      throw new Error(
        `Tranche-${trancheIndex} final pair counts drifted: ${JSON.stringify(finalPairStatusCounts)}`,
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
      throw new Error(
        `Tranche-${trancheIndex} applicable rows must remain non-integration-ready`,
      );
    }

    reports.push({
      trancheIndex,
      frozenInput: {
        runId: 37560399946,
        artifactId: config.artifactId,
        digest: config.artifactDigest,
        targetRankStart: config.rankStart,
        targetRankEnd: config.rankEnd,
        targetEventKeySha256: config.eventSha,
        reviewKeySha256: config.reviewKeySha,
      },
      review: {
        candidatePairs: config.candidates,
        candidateBills: config.candidateBills,
        candidatePublicMembers: config.candidateMembers,
        candidateSemanticGroups: config.candidateGroups,
        decisions: reviewDecisionCounts,
        alignmentCounts,
        finalPairStatusCounts,
        applicableRows: applicableCandidates.length,
        integrationReadyRows: 0,
        applicableReviewKeys: applicableCandidates.map((row) => row.reviewKey).sort(),
        ambiguousReviewKeys: reviewedCandidates
          .filter((row) => row.decision === 'ambiguous_fail_closed')
          .map((row) => row.reviewKey)
          .sort(),
        reviewedCandidates,
      },
    });

    aggregate.candidatePairs += config.candidates;
    aggregate.reviewedApplicable += reviewDecisionCounts.applicable;
    aggregate.reviewedAmbiguous += reviewDecisionCounts.ambiguous_fail_closed;
    aggregate.reviewedNotApplicable += reviewDecisionCounts.not_applicable;
    aggregate.eligiblePairs += config.eligiblePairs;
    aggregate.finalApplicable += finalPairStatusCounts.applicable;
    aggregate.finalAmbiguous += finalPairStatusCounts.ambiguous_fail_closed;
    aggregate.finalNotApplicable += finalPairStatusCounts.not_applicable;
    aggregate.aligns += alignmentCounts.aligns;
    aggregate.conflicts += alignmentCounts.conflicts;
  }

  if (
    aggregate.candidatePairs !== 377
    || aggregate.reviewedApplicable !== 13
    || aggregate.reviewedAmbiguous !== 12
    || aggregate.reviewedNotApplicable !== 352
    || aggregate.eligiblePairs !== 2589
    || aggregate.finalApplicable !== 13
    || aggregate.finalAmbiguous !== 248
    || aggregate.finalNotApplicable !== 2328
    || aggregate.aligns !== 13
    || aggregate.conflicts !== 0
  ) {
    throw new Error(`Final House aggregate counts drifted: ${JSON.stringify(aggregate)}`);
  }

  const report = {
    schemaVersion: OUTPUT_SCHEMA,
    generatedAt: new Date().toISOString(),
    issue: 718,
    session: '2025-2026',
    trancheRange: [9, 10, 11],
    tranches: reports,
    aggregate: {
      ...aggregate,
      pendingReview: 0,
      integrationReadyRows: 0,
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
        'The 2025-26 House applicability candidate universe is fully reviewed through rank 264. Resolve internal historical membership identity independently before any feature integration; do not guess IDs.',
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
    historicalDensity2025HouseApplicabilityTranches9To11Review: {
      aggregate,
      trancheCount: reports.length,
      outcomeUse: 'none',
      productionDatabaseQueried: false,
      vercelUsed: false,
      integrationReadyRows: 0,
    },
  }, null, 2));
}

main();
