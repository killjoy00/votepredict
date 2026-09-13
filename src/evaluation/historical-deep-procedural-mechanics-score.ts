import type { HistoricalDeepExpansionDiscoveryCandidateBundleV2 } from './historical-deep-expansion-extractor-v2';
import type { HistoricalDeepExpansionOutcomeSnapshot } from './historical-deep-expansion-outcome-scorer';
import type {
  HistoricalDeepProceduralMechanic,
  HistoricalDeepProceduralMechanicsArtifact,
  HistoricalDeepProceduralMechanicsObservation,
} from './historical-deep-procedural-mechanics';

export const HISTORICAL_DEEP_PROCEDURAL_MECHANICS_SCORE_SCHEMA = 'historical-deep-procedural-mechanics-score-v1' as const;

export type HistoricalDeepMechanicsVotePattern = 'supports_motion' | 'opposes_motion' | 'conflicting_motion_votes';

export interface HistoricalDeepProceduralMechanicsScoreRow {
  stableKey: string;
  caseKey: string;
  voteEventId: string;
  identifier: string;
  occurredOn: string;
  legislatorId: string;
  membershipId: string;
  memberName: string;
  party: string | null;
  mechanic: HistoricalDeepProceduralMechanic;
  observationCount: number;
  votePattern: HistoricalDeepMechanicsVotePattern;
  selectedForCurrentDeep: boolean;
  selectedForCandidateDeep: boolean;
  quickYesProbability: number;
  quickPredictedOutcome: 0 | 1;
  outcomeStatus: 'decisive' | 'no_decisive_floor_outcome';
  actualOutcome?: 0 | 1;
  quickError?: boolean;
  naiveSameSideFloorOutcome?: 0 | 1;
  naiveSameSideMatchesFloor?: boolean;
  naiveSameSideWouldCorrectQuickError?: boolean;
  naiveSameSideWouldHarmCorrectQuick?: boolean;
  mechanicallyActionable: false;
  finalPassageInference: 'none';
}

export interface HistoricalDeepProceduralMechanicsMetricSlice {
  observations: number;
  memberEventMechanicRows: number;
  decisiveRows: number;
  noDecisiveRows: number;
  singleSidedRows: number;
  conflictingRows: number;
  scorableSingleSidedRows: number;
  floorAgreementRows: number;
  floorAgreementRate: number;
  quickErrorsOnScorableRows: number;
  sameSideWouldCorrectQuickErrors: number;
  sameSideQuickErrorCorrectionRate: number;
  sameSideWouldHarmCorrectQuick: number;
  currentTargetScorableRows: number;
  currentTargetFloorAgreementRows: number;
  currentTargetFloorAgreementRate: number;
  candidateTargetScorableRows: number;
  candidateTargetFloorAgreementRows: number;
  candidateTargetFloorAgreementRate: number;
}

export interface HistoricalDeepProceduralMechanicsCaseBreakdown {
  stableKey: string;
  caseKey: string;
  identifier: string;
  occurredOn: string;
  mechanics: Partial<Record<HistoricalDeepProceduralMechanic, HistoricalDeepProceduralMechanicsMetricSlice>>;
}

export interface HistoricalDeepProceduralMechanicsScoreArtifact {
  schemaVersion: typeof HISTORICAL_DEEP_PROCEDURAL_MECHANICS_SCORE_SCHEMA;
  generatedAt: string;
  purpose: string;
  metadata: {
    taxonomyPolicy: 'mn-house-procedural-mechanics-v1';
    evaluationPolicy: 'naive-same-side-diagnostic-v1';
    outcomeUse: 'post-taxonomy-freeze-development-scoring-only';
    probabilityAction: 'none';
    designGuard: string;
  };
  input: {
    taxonomyObservations: number;
    taxonomyMemberEventPairs: number;
    candidateObservations: number;
    outcomeCases: number;
  };
  summary: {
    memberEventMechanicRows: number;
    mechanicallyActionableRows: 0;
    mechanics: Record<HistoricalDeepProceduralMechanic, HistoricalDeepProceduralMechanicsMetricSlice>;
  };
  rows: HistoricalDeepProceduralMechanicsScoreRow[];
  cases: HistoricalDeepProceduralMechanicsCaseBreakdown[];
}

const MECHANICS: HistoricalDeepProceduralMechanic[] = [
  'committee_recommends_passage',
  'advances_toward_floor_eligibility',
  'continues_committee_review',
  'impedes_current_bill_progress',
  'defers_current_bill_action',
];

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function predictedOutcome(probability: number): 0 | 1 {
  return probability >= 0.5 ? 1 : 0;
}

function pairKey(caseKey: string, legislatorId: string): string {
  return `${caseKey}|${legislatorId}`;
}

function mechanicRowKey(
  observation: Pick<HistoricalDeepProceduralMechanicsObservation, 'caseKey' | 'legislatorId'>,
  mechanic: HistoricalDeepProceduralMechanic,
): string {
  return `${observation.caseKey}|${observation.legislatorId}|${mechanic}`;
}

function validateInputs(
  candidates: HistoricalDeepExpansionDiscoveryCandidateBundleV2,
  taxonomy: HistoricalDeepProceduralMechanicsArtifact,
  outcomes: HistoricalDeepExpansionOutcomeSnapshot,
): void {
  if (candidates.schemaVersion !== 'historical-deep-expansion-discovery-candidates-v2') {
    throw new Error(`Unsupported candidate schema: ${String(candidates.schemaVersion)}`);
  }
  if (candidates.metadata.outcomeUse !== 'none') {
    throw new Error(`Candidate artifact is not outcome-blind: ${String(candidates.metadata.outcomeUse)}`);
  }
  if (taxonomy.schemaVersion !== 'historical-deep-procedural-mechanics-v1') {
    throw new Error(`Unsupported mechanics schema: ${String(taxonomy.schemaVersion)}`);
  }
  if (taxonomy.metadata.policy !== 'mn-house-procedural-mechanics-v1') {
    throw new Error(`Unsupported mechanics policy: ${String(taxonomy.metadata.policy)}`);
  }
  if (taxonomy.metadata.outcomeUse !== 'none' || taxonomy.metadata.probabilityAction !== 'none') {
    throw new Error('Mechanics taxonomy is not outcome-blind/non-actionable');
  }
  if (outcomes.schemaVersion !== 'historical-deep-expansion-outcome-snapshot-v1') {
    throw new Error(`Unsupported outcome schema: ${String(outcomes.schemaVersion)}`);
  }
  if (taxonomy.input.candidateObservations !== candidates.summary.candidateCount) {
    throw new Error('Taxonomy/candidate observation count mismatch');
  }
  if (taxonomy.summary.memberEventPairs !== candidates.summary.memberCasePairsWithCandidates) {
    throw new Error('Taxonomy/candidate member-event count mismatch');
  }
  if (taxonomy.observations.some((observation) => observation.mechanicallyActionable || observation.finalPassageInference !== 'none')) {
    throw new Error('Mechanics taxonomy contains actionable final-passage evidence');
  }
}

function outcomeMaps(outcomes: HistoricalDeepExpansionOutcomeSnapshot): {
  cases: Map<string, HistoricalDeepExpansionOutcomeSnapshot['cases'][number]>;
  members: Map<string, HistoricalDeepExpansionOutcomeSnapshot['cases'][number]['members'][number]>;
} {
  const cases = new Map<string, HistoricalDeepExpansionOutcomeSnapshot['cases'][number]>();
  const members = new Map<string, HistoricalDeepExpansionOutcomeSnapshot['cases'][number]['members'][number]>();
  for (const outcomeCase of outcomes.cases) {
    if (cases.has(outcomeCase.caseKey)) throw new Error(`Duplicate outcome case ${outcomeCase.caseKey}`);
    cases.set(outcomeCase.caseKey, outcomeCase);
    for (const member of outcomeCase.members) {
      const key = pairKey(outcomeCase.caseKey, member.legislatorId);
      if (members.has(key)) throw new Error(`Duplicate outcome member ${key}`);
      members.set(key, member);
    }
  }
  return { cases, members };
}

function quickProbabilityMap(
  candidates: HistoricalDeepExpansionDiscoveryCandidateBundleV2,
): Map<string, number> {
  const result = new Map<string, number>();
  for (const candidate of candidates.candidates) {
    const key = pairKey(candidate.case.caseKey, candidate.legislatorId);
    const previous = result.get(key);
    if (previous !== undefined && Math.abs(previous - candidate.quickYesProbability) > 1e-12) {
      throw new Error(`Inconsistent frozen Quick probability for ${key}`);
    }
    result.set(key, candidate.quickYesProbability);
  }
  return result;
}

function validateTaxonomyLineage(
  observation: HistoricalDeepProceduralMechanicsObservation,
  outcomeCase: HistoricalDeepExpansionOutcomeSnapshot['cases'][number],
): void {
  if (
    observation.stableKey !== outcomeCase.stableKey
    || observation.caseKey !== outcomeCase.caseKey
    || observation.voteEventId !== outcomeCase.voteEventId
    || observation.identifier !== outcomeCase.identifier
    || observation.occurredOn !== outcomeCase.occurredOn
  ) {
    throw new Error(`Mechanics/outcome event lineage mismatch for ${observation.stableKey}`);
  }
}

function metricSlice(
  rows: readonly HistoricalDeepProceduralMechanicsScoreRow[],
  observations: number,
): HistoricalDeepProceduralMechanicsMetricSlice {
  const decisive = rows.filter((row) => row.outcomeStatus === 'decisive');
  const singleSided = rows.filter((row) => row.votePattern !== 'conflicting_motion_votes');
  const scorable = singleSided.filter((row) => row.outcomeStatus === 'decisive');
  const agreements = scorable.filter((row) => row.naiveSameSideMatchesFloor === true);
  const quickErrors = scorable.filter((row) => row.quickError === true);
  const corrected = scorable.filter((row) => row.naiveSameSideWouldCorrectQuickError === true);
  const harmed = scorable.filter((row) => row.naiveSameSideWouldHarmCorrectQuick === true);
  const current = scorable.filter((row) => row.selectedForCurrentDeep);
  const candidate = scorable.filter((row) => row.selectedForCandidateDeep);
  const currentAgreements = current.filter((row) => row.naiveSameSideMatchesFloor === true);
  const candidateAgreements = candidate.filter((row) => row.naiveSameSideMatchesFloor === true);

  return {
    observations,
    memberEventMechanicRows: rows.length,
    decisiveRows: decisive.length,
    noDecisiveRows: rows.length - decisive.length,
    singleSidedRows: singleSided.length,
    conflictingRows: rows.length - singleSided.length,
    scorableSingleSidedRows: scorable.length,
    floorAgreementRows: agreements.length,
    floorAgreementRate: ratio(agreements.length, scorable.length),
    quickErrorsOnScorableRows: quickErrors.length,
    sameSideWouldCorrectQuickErrors: corrected.length,
    sameSideQuickErrorCorrectionRate: ratio(corrected.length, quickErrors.length),
    sameSideWouldHarmCorrectQuick: harmed.length,
    currentTargetScorableRows: current.length,
    currentTargetFloorAgreementRows: currentAgreements.length,
    currentTargetFloorAgreementRate: ratio(currentAgreements.length, current.length),
    candidateTargetScorableRows: candidate.length,
    candidateTargetFloorAgreementRows: candidateAgreements.length,
    candidateTargetFloorAgreementRate: ratio(candidateAgreements.length, candidate.length),
  };
}

export function scoreHistoricalDeepProceduralMechanics(
  candidates: HistoricalDeepExpansionDiscoveryCandidateBundleV2,
  taxonomy: HistoricalDeepProceduralMechanicsArtifact,
  outcomes: HistoricalDeepExpansionOutcomeSnapshot,
  generatedAt = new Date().toISOString(),
): HistoricalDeepProceduralMechanicsScoreArtifact {
  validateInputs(candidates, taxonomy, outcomes);
  const quick = quickProbabilityMap(candidates);
  const { cases: outcomeCases, members: outcomeMembers } = outcomeMaps(outcomes);
  const grouped = new Map<string, { mechanic: HistoricalDeepProceduralMechanic; observations: HistoricalDeepProceduralMechanicsObservation[] }>();

  for (const observation of taxonomy.observations) {
    const outcomeCase = outcomeCases.get(observation.caseKey);
    if (!outcomeCase) throw new Error(`Missing outcome case for ${observation.caseKey}`);
    validateTaxonomyLineage(observation, outcomeCase);
    for (const mechanic of observation.mechanics) {
      const key = mechanicRowKey(observation, mechanic);
      const current = grouped.get(key) ?? { mechanic, observations: [] };
      current.observations.push(observation);
      grouped.set(key, current);
    }
  }

  const rows: HistoricalDeepProceduralMechanicsScoreRow[] = [...grouped.values()].map(({ mechanic, observations }) => {
    const first = observations[0];
    const sides = new Set(observations.map((observation) => observation.voteRelationToMotion));
    const votePattern: HistoricalDeepMechanicsVotePattern = sides.size > 1
      ? 'conflicting_motion_votes'
      : observations[0].voteRelationToMotion;
    const quickYesProbability = quick.get(pairKey(first.caseKey, first.legislatorId));
    if (quickYesProbability === undefined) throw new Error(`Missing frozen Quick probability for ${first.caseKey}|${first.legislatorId}`);
    const outcome = outcomeMembers.get(pairKey(first.caseKey, first.legislatorId));
    const quickPredictedOutcome = predictedOutcome(quickYesProbability);
    const naiveSameSideFloorOutcome: 0 | 1 | undefined = votePattern === 'supports_motion'
      ? 1
      : votePattern === 'opposes_motion'
        ? 0
        : undefined;
    const naiveSameSideMatchesFloor = outcome && naiveSameSideFloorOutcome !== undefined
      ? outcome.actualOutcome === naiveSameSideFloorOutcome
      : undefined;
    const quickError = outcome ? quickPredictedOutcome !== outcome.actualOutcome : undefined;

    return {
      stableKey: first.stableKey,
      caseKey: first.caseKey,
      voteEventId: first.voteEventId,
      identifier: first.identifier,
      occurredOn: first.occurredOn,
      legislatorId: first.legislatorId,
      membershipId: first.membershipId,
      memberName: first.memberName,
      party: first.party,
      mechanic,
      observationCount: observations.length,
      votePattern,
      selectedForCurrentDeep: observations.some((observation) => observation.selectedForCurrentDeep),
      selectedForCandidateDeep: observations.some((observation) => observation.selectedForCandidateDeep),
      quickYesProbability,
      quickPredictedOutcome,
      outcomeStatus: outcome ? 'decisive' : 'no_decisive_floor_outcome',
      actualOutcome: outcome?.actualOutcome,
      quickError,
      naiveSameSideFloorOutcome,
      naiveSameSideMatchesFloor,
      naiveSameSideWouldCorrectQuickError: quickError === true && naiveSameSideMatchesFloor === true,
      naiveSameSideWouldHarmCorrectQuick: quickError === false && naiveSameSideMatchesFloor === false,
      mechanicallyActionable: false,
      finalPassageInference: 'none',
    };
  }).sort((left, right) => left.occurredOn.localeCompare(right.occurredOn)
    || left.identifier.localeCompare(right.identifier)
    || left.memberName.localeCompare(right.memberName)
    || left.mechanic.localeCompare(right.mechanic));

  const observationsByMechanic = Object.fromEntries(
    MECHANICS.map((mechanic) => [
      mechanic,
      taxonomy.observations.filter((observation) => observation.mechanics.includes(mechanic)).length,
    ]),
  ) as Record<HistoricalDeepProceduralMechanic, number>;
  const mechanics = Object.fromEntries(
    MECHANICS.map((mechanic) => [
      mechanic,
      metricSlice(rows.filter((row) => row.mechanic === mechanic), observationsByMechanic[mechanic]),
    ]),
  ) as Record<HistoricalDeepProceduralMechanic, HistoricalDeepProceduralMechanicsMetricSlice>;

  const caseKeys = [...new Set(rows.map((row) => row.caseKey))].sort();
  const cases: HistoricalDeepProceduralMechanicsCaseBreakdown[] = caseKeys.map((caseKey) => {
    const caseRows = rows.filter((row) => row.caseKey === caseKey);
    const first = caseRows[0];
    const caseObservations = taxonomy.observations.filter((observation) => observation.caseKey === caseKey);
    const caseMechanics: Partial<Record<HistoricalDeepProceduralMechanic, HistoricalDeepProceduralMechanicsMetricSlice>> = {};
    for (const mechanic of MECHANICS) {
      const mechanicRows = caseRows.filter((row) => row.mechanic === mechanic);
      if (mechanicRows.length === 0) continue;
      const observationCount = caseObservations.filter((observation) => observation.mechanics.includes(mechanic)).length;
      caseMechanics[mechanic] = metricSlice(mechanicRows, observationCount);
    }
    return {
      stableKey: first.stableKey,
      caseKey: first.caseKey,
      identifier: first.identifier,
      occurredOn: first.occurredOn,
      mechanics: caseMechanics,
    };
  });

  return {
    schemaVersion: HISTORICAL_DEEP_PROCEDURAL_MECHANICS_SCORE_SCHEMA,
    generatedAt,
    purpose: 'development-only descriptive comparison of already-frozen outcome-blind committee-motion mechanics with later decisive floor outcomes; the naive same-side diagnostic asks whether AYE/NAY on each mechanic happened to match later YEA/NAY without declaring that mechanic a final-passage signal or allowing any probability action',
    metadata: {
      taxonomyPolicy: 'mn-house-procedural-mechanics-v1',
      evaluationPolicy: 'naive-same-side-diagnostic-v1',
      outcomeUse: 'post-taxonomy-freeze-development-scoring-only',
      probabilityAction: 'none',
      designGuard: 'The taxonomy was frozen before outcomes were joined. For each mechanic independently, a single-sided committee vote is compared descriptively with the later floor vote using the deliberately naive AYE->YEA / NAY->NAY proxy. Conflicting committee votes are not scored. No result in this artifact changes mechanicallyActionable=false, creates evidence, tunes a weight, changes a target set, or updates a probability.',
    },
    input: {
      taxonomyObservations: taxonomy.summary.observations,
      taxonomyMemberEventPairs: taxonomy.summary.memberEventPairs,
      candidateObservations: candidates.summary.candidateCount,
      outcomeCases: outcomes.cases.length,
    },
    summary: {
      memberEventMechanicRows: rows.length,
      mechanicallyActionableRows: 0,
      mechanics,
    },
    rows,
    cases,
  };
}
