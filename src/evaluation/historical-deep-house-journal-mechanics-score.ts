import type {
  HistoricalDeepExpansionDiscoveryManifest,
} from './historical-deep-expansion-discovery';
import type {
  HistoricalDeepExpansionOutcomeSnapshot,
} from './historical-deep-expansion-outcome-scorer';
import type {
  HistoricalDeepHouseJournalMechanic,
  HistoricalDeepHouseJournalMechanicDirection,
  HistoricalDeepHouseJournalMechanicsArtifact,
} from './historical-deep-house-journal-mechanics';

export const HISTORICAL_DEEP_HOUSE_JOURNAL_MECHANICS_SCORE_SCHEMA = 'historical-deep-house-journal-mechanics-score-v1' as const;
export const HISTORICAL_DEEP_HOUSE_JOURNAL_MECHANICS_SCORE_POLICY = 'mechanic-conditioned-quick-residual-diagnostic-v1' as const;

export interface HistoricalDeepHouseJournalMechanicsScoreLineageArtifact {
  workflowRunId: string | number;
  artifactId: number;
  artifactName: string;
  artifactSha256: string;
  headSha: string;
  fileName: string;
}

export interface HistoricalDeepHouseJournalMechanicsScoreLineage {
  schemaVersion: 'historical-deep-house-journal-mechanics-score-lineage-v1';
  discoveryManifest: HistoricalDeepHouseJournalMechanicsScoreLineageArtifact;
  mechanicsArtifact: HistoricalDeepHouseJournalMechanicsScoreLineageArtifact;
  outcomeArtifact: HistoricalDeepHouseJournalMechanicsScoreLineageArtifact & {
    originCandidateArtifactId: number;
    originCandidateArtifactSha256: string;
  };
  policy: {
    evaluation: typeof HISTORICAL_DEEP_HOUSE_JOURNAL_MECHANICS_SCORE_POLICY;
    outcomeUse: 'post-mechanics-freeze-development-scoring-only';
    probabilityAction: 'none';
    actionabilityDecision: 'none';
    notes: string;
  };
}

export interface HistoricalDeepHouseJournalQuickOutcomeSlice {
  cases: number;
  decisiveMemberOutcomes: number;
  actualYesVotes: number;
  actualNoVotes: number;
  actualYesRate: number;
  quickMeanYesProbability: number;
  memberWeightedSignedResidual: number;
  quickBrier: number;
  quickLogLoss: number;
  quickAccuracy: number;
  caseMeanActualYesRate: number;
  caseMeanQuickYesProbability: number;
  caseMeanSignedResidual: number;
  caseMeanAbsoluteResidual: number;
  positiveResidualCases: number;
  negativeResidualCases: number;
  zeroResidualCases: number;
}

export interface HistoricalDeepHouseJournalRecencySummary {
  cases: number;
  minimumDaysBeforeVote: number;
  medianDaysBeforeVote: number;
  meanDaysBeforeVote: number;
  maximumDaysBeforeVote: number;
}

export interface HistoricalDeepHouseJournalMechanicScoreSlice {
  observations: number;
  withMechanic: HistoricalDeepHouseJournalQuickOutcomeSlice;
  withoutMechanic: HistoricalDeepHouseJournalQuickOutcomeSlice | null;
  contrast: {
    actualYesRateDelta: number;
    quickMeanYesProbabilityDelta: number;
    memberWeightedSignedResidualDelta: number;
    quickBrierDelta: number;
    quickLogLossDelta: number;
    caseMeanSignedResidualDelta: number;
  } | null;
  lastObservationRecency: HistoricalDeepHouseJournalRecencySummary;
}

export interface HistoricalDeepHouseJournalDirectionScoreSlice {
  observations: number;
  withDirection: HistoricalDeepHouseJournalQuickOutcomeSlice;
  withoutDirection: HistoricalDeepHouseJournalQuickOutcomeSlice | null;
  contrast: {
    actualYesRateDelta: number;
    quickMeanYesProbabilityDelta: number;
    memberWeightedSignedResidualDelta: number;
    quickBrierDelta: number;
    quickLogLossDelta: number;
    caseMeanSignedResidualDelta: number;
  } | null;
}

export interface HistoricalDeepHouseJournalMechanicCooccurrence {
  left: HistoricalDeepHouseJournalMechanic;
  right: HistoricalDeepHouseJournalMechanic;
  leftCases: number;
  rightCases: number;
  sharedCases: number;
  unionCases: number;
  jaccard: number;
}

export interface HistoricalDeepHouseJournalMechanicsScoreCase {
  stableKey: string;
  caseKey: string;
  voteEventId: string;
  externalKey: string;
  identifier: string;
  occurredOn: string;
  quickModelVersion: string;
  decisiveMemberOutcomes: number;
  actualYesVotes: number;
  actualNoVotes: number;
  actualYesRate: number;
  quickMeanYesProbability: number;
  signedResidual: number;
  quickBrier: number;
  quickLogLoss: number;
  quickAccuracy: number;
  mechanics: HistoricalDeepHouseJournalMechanic[];
  directions: HistoricalDeepHouseJournalMechanicDirection[];
  lastObservationByMechanic: Partial<Record<HistoricalDeepHouseJournalMechanic, {
    journalDate: string;
    daysBeforeVote: number;
  }>>;
}

export interface HistoricalDeepHouseJournalMechanicsScoreArtifact {
  schemaVersion: typeof HISTORICAL_DEEP_HOUSE_JOURNAL_MECHANICS_SCORE_SCHEMA;
  generatedAt: string;
  purpose: string;
  metadata: {
    evaluationPolicy: typeof HISTORICAL_DEEP_HOUSE_JOURNAL_MECHANICS_SCORE_POLICY;
    outcomeUse: 'post-mechanics-freeze-development-scoring-only';
    probabilityAction: 'none';
    actionabilityDecision: 'none';
    interpretationGuard: string;
    lineage: {
      discoveryManifestArtifactId: number;
      discoveryManifestArtifactSha256: string;
      discoveryManifestHeadSha: string;
      mechanicsArtifactId: number;
      mechanicsArtifactSha256: string;
      mechanicsArtifactHeadSha: string;
      outcomeArtifactId: number;
      outcomeArtifactSha256: string;
      outcomeArtifactHeadSha: string;
    };
  };
  input: {
    discoveryCases: number;
    discoveryMemberCasePairs: number;
    mechanicsCases: number;
    mechanicsObservations: number;
    outcomeCases: number;
    decisiveMemberOutcomes: number;
  };
  summary: {
    overall: HistoricalDeepHouseJournalQuickOutcomeSlice;
    mechanicallyActionableObservations: 0;
    finalPassageInferenceObservations: 0;
    mechanics: Record<HistoricalDeepHouseJournalMechanic, HistoricalDeepHouseJournalMechanicScoreSlice>;
    directions: Record<HistoricalDeepHouseJournalMechanicDirection, HistoricalDeepHouseJournalDirectionScoreSlice>;
    cooccurrence: HistoricalDeepHouseJournalMechanicCooccurrence[];
  };
  cases: HistoricalDeepHouseJournalMechanicsScoreCase[];
}

const MECHANICS: HistoricalDeepHouseJournalMechanic[] = [
  'introduced_and_referred',
  'committee_advances_to_general_register',
  'committee_routes_for_additional_review',
  'second_reading',
  'calendar_designation',
  'companion_substitution',
  'conference_committee_appointment',
  'conference_report_received',
  'interchamber_amendment_message',
  'reported_to_house',
  'laid_on_table',
  'reaches_final_passage_stage',
  'author_added',
];

const DIRECTIONS: HistoricalDeepHouseJournalMechanicDirection[] = [
  'advances_process',
  'continues_process',
  'defers_or_impedes',
  'administrative_only',
];

interface MemberPoint {
  probability: number;
  outcome: 0 | 1;
}

interface CaseComputation {
  row: HistoricalDeepHouseJournalMechanicsScoreCase;
  members: MemberPoint[];
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function logLoss(probability: number, outcome: 0 | 1): number {
  const clipped = Math.min(1 - 1e-15, Math.max(1e-15, probability));
  return -(outcome * Math.log(clipped) + (1 - outcome) * Math.log(1 - clipped));
}

function isoDay(value: string): number {
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ISO day ${value}`);
  return parsed;
}

function daysBeforeVote(journalDate: string, occurredOn: string): number {
  const days = (isoDay(occurredOn) - isoDay(journalDate)) / 86_400_000;
  if (!Number.isInteger(days) || days <= 0) {
    throw new Error(`House Journal observation ${journalDate} is not strictly before vote ${occurredOn}`);
  }
  return days;
}

function validateArtifactRef(
  label: string,
  artifact: HistoricalDeepHouseJournalMechanicsScoreLineageArtifact,
): void {
  if (!Number.isInteger(artifact.artifactId) || artifact.artifactId <= 0) throw new Error(`${label} artifact id is invalid`);
  if (!/^[a-f0-9]{64}$/.test(artifact.artifactSha256)) throw new Error(`${label} artifact SHA-256 is invalid`);
  if (!/^[a-f0-9]{40}$/.test(artifact.headSha)) throw new Error(`${label} head SHA is invalid`);
  if (!artifact.artifactName || !artifact.fileName) throw new Error(`${label} artifact name/file is missing`);
}

function validateInputs(
  discovery: HistoricalDeepExpansionDiscoveryManifest,
  mechanics: HistoricalDeepHouseJournalMechanicsArtifact,
  outcomes: HistoricalDeepExpansionOutcomeSnapshot,
  lineage: HistoricalDeepHouseJournalMechanicsScoreLineage,
): void {
  if (lineage.schemaVersion !== 'historical-deep-house-journal-mechanics-score-lineage-v1') {
    throw new Error(`Unsupported Journal mechanics score lineage ${String(lineage.schemaVersion)}`);
  }
  if (
    lineage.policy.evaluation !== HISTORICAL_DEEP_HOUSE_JOURNAL_MECHANICS_SCORE_POLICY
    || lineage.policy.outcomeUse !== 'post-mechanics-freeze-development-scoring-only'
    || lineage.policy.probabilityAction !== 'none'
    || lineage.policy.actionabilityDecision !== 'none'
  ) throw new Error('Journal mechanics score lineage policy is not descriptive-only');
  validateArtifactRef('discovery', lineage.discoveryManifest);
  validateArtifactRef('mechanics', lineage.mechanicsArtifact);
  validateArtifactRef('outcome', lineage.outcomeArtifact);

  if (discovery.schemaVersion !== 'historical-deep-expansion-discovery-manifest-v1') {
    throw new Error(`Unsupported expansion discovery schema ${String(discovery.schemaVersion)}`);
  }
  if (discovery.metadata.cases !== 24 || discovery.cases.length !== 24) {
    throw new Error(`Expected 24 frozen discovery cases, got ${discovery.cases.length}`);
  }
  if (discovery.metadata.memberCasePairs !== 3_216) {
    throw new Error(`Expected 3216 frozen Quick member-case pairs, got ${discovery.metadata.memberCasePairs}`);
  }
  if (discovery.metadata.candidateStrategy !== 'need-only') {
    throw new Error(`Unexpected discovery candidate strategy ${String(discovery.metadata.candidateStrategy)}`);
  }
  if (!/outcome-blind/i.test(discovery.metadata.purpose) || !/outcome/i.test(discovery.metadata.selectionGuard)) {
    throw new Error('Frozen Quick discovery manifest does not declare its outcome-blind boundary');
  }
  if (discovery.metadata.codeSha !== lineage.discoveryManifest.headSha) {
    throw new Error(`Discovery head mismatch: expected ${lineage.discoveryManifest.headSha}, got ${discovery.metadata.codeSha ?? 'null'}`);
  }

  if (mechanics.schemaVersion !== 'historical-deep-house-journal-mechanics-v1') {
    throw new Error(`Unsupported House Journal mechanics schema ${String(mechanics.schemaVersion)}`);
  }
  if (
    mechanics.metadata.parser !== 'deterministic-house-journal-mechanics-v1'
    || mechanics.metadata.outcomeUse !== 'none'
    || mechanics.metadata.holdoutUse !== 'none'
    || mechanics.metadata.probabilityAction !== 'none'
  ) throw new Error('House Journal mechanics input is not the frozen outcome-blind taxonomy');
  if (mechanics.input.selectedCases !== 24 || mechanics.cases.length !== 24 || mechanics.summary.observations !== 107) {
    throw new Error('House Journal mechanics frozen counts do not match the pinned v1 artifact');
  }
  if (mechanics.observations.some((item) => item.mechanicallyActionable !== false || item.finalPassageInference !== 'none')) {
    throw new Error('House Journal mechanics input contains actionable/final-passage inference evidence');
  }

  if (outcomes.schemaVersion !== 'historical-deep-expansion-outcome-snapshot-v1') {
    throw new Error(`Unsupported outcome snapshot schema ${String(outcomes.schemaVersion)}`);
  }
  if (outcomes.cases.length !== 24) throw new Error(`Expected 24 frozen outcome cases, got ${outcomes.cases.length}`);
  if (outcomes.candidateArtifact.artifactId !== lineage.outcomeArtifact.originCandidateArtifactId) {
    throw new Error('Outcome snapshot candidate artifact id drifted from pinned lineage');
  }
  if (outcomes.candidateArtifact.artifactSha256 !== lineage.outcomeArtifact.originCandidateArtifactSha256) {
    throw new Error('Outcome snapshot candidate artifact digest drifted from pinned lineage');
  }

  const discoveryKeys = new Set(discovery.cases.map((item) => item.stableKey));
  const mechanicsKeys = new Set(mechanics.cases.map((item) => item.stableKey));
  const outcomeKeys = new Set(outcomes.cases.map((item) => item.stableKey));
  if (discoveryKeys.size !== 24 || mechanicsKeys.size !== 24 || outcomeKeys.size !== 24) {
    throw new Error('Frozen development inputs contain duplicate stable keys');
  }
  for (const key of discoveryKeys) {
    if (!mechanicsKeys.has(key) || !outcomeKeys.has(key)) throw new Error(`Frozen development lineage is missing stable key ${key}`);
  }
}

function quickOutcomeSlice(cases: readonly CaseComputation[]): HistoricalDeepHouseJournalQuickOutcomeSlice | null {
  if (cases.length === 0) return null;
  const members = cases.flatMap((item) => item.members);
  if (members.length === 0) throw new Error('Quick/outcome slice has no decisive member outcomes');
  const yesVotes = members.filter((item) => item.outcome === 1).length;
  const actualYesRate = ratio(yesVotes, members.length);
  const quickMean = mean(members.map((item) => item.probability));
  const brier = mean(members.map((item) => (item.probability - item.outcome) ** 2));
  const ll = mean(members.map((item) => logLoss(item.probability, item.outcome)));
  const accuracy = ratio(
    members.filter((item) => (item.probability >= 0.5 ? 1 : 0) === item.outcome).length,
    members.length,
  );
  const residuals = cases.map((item) => item.row.signedResidual);
  const epsilon = 1e-15;
  return {
    cases: cases.length,
    decisiveMemberOutcomes: members.length,
    actualYesVotes: yesVotes,
    actualNoVotes: members.length - yesVotes,
    actualYesRate,
    quickMeanYesProbability: quickMean,
    memberWeightedSignedResidual: actualYesRate - quickMean,
    quickBrier: brier,
    quickLogLoss: ll,
    quickAccuracy: accuracy,
    caseMeanActualYesRate: mean(cases.map((item) => item.row.actualYesRate)),
    caseMeanQuickYesProbability: mean(cases.map((item) => item.row.quickMeanYesProbability)),
    caseMeanSignedResidual: mean(residuals),
    caseMeanAbsoluteResidual: mean(residuals.map((value) => Math.abs(value))),
    positiveResidualCases: residuals.filter((value) => value > epsilon).length,
    negativeResidualCases: residuals.filter((value) => value < -epsilon).length,
    zeroResidualCases: residuals.filter((value) => Math.abs(value) <= epsilon).length,
  };
}

function contrast(
  withSlice: HistoricalDeepHouseJournalQuickOutcomeSlice,
  withoutSlice: HistoricalDeepHouseJournalQuickOutcomeSlice | null,
): HistoricalDeepHouseJournalMechanicScoreSlice['contrast'] {
  if (!withoutSlice) return null;
  return {
    actualYesRateDelta: withSlice.actualYesRate - withoutSlice.actualYesRate,
    quickMeanYesProbabilityDelta: withSlice.quickMeanYesProbability - withoutSlice.quickMeanYesProbability,
    memberWeightedSignedResidualDelta: withSlice.memberWeightedSignedResidual - withoutSlice.memberWeightedSignedResidual,
    quickBrierDelta: withSlice.quickBrier - withoutSlice.quickBrier,
    quickLogLossDelta: withSlice.quickLogLoss - withoutSlice.quickLogLoss,
    caseMeanSignedResidualDelta: withSlice.caseMeanSignedResidual - withoutSlice.caseMeanSignedResidual,
  };
}

function recencySummary(days: readonly number[]): HistoricalDeepHouseJournalRecencySummary {
  if (days.length === 0) throw new Error('Cannot summarize empty Journal mechanic recency');
  return {
    cases: days.length,
    minimumDaysBeforeVote: Math.min(...days),
    medianDaysBeforeVote: median(days),
    meanDaysBeforeVote: mean(days),
    maximumDaysBeforeVote: Math.max(...days),
  };
}

function buildCaseComputations(
  discovery: HistoricalDeepExpansionDiscoveryManifest,
  mechanics: HistoricalDeepHouseJournalMechanicsArtifact,
  outcomes: HistoricalDeepExpansionOutcomeSnapshot,
): CaseComputation[] {
  const discoveryByKey = new Map(discovery.cases.map((item) => [item.stableKey, item]));
  const outcomeByKey = new Map(outcomes.cases.map((item) => [item.stableKey, item]));
  const observationsByKey = new Map<string, HistoricalDeepHouseJournalMechanicsArtifact['observations']>();
  for (const observation of mechanics.observations) {
    const values = observationsByKey.get(observation.stableKey) ?? [];
    values.push(observation);
    observationsByKey.set(observation.stableKey, values);
  }

  return mechanics.cases.map((mechanicsCase): CaseComputation => {
    const discoveryCase = discoveryByKey.get(mechanicsCase.stableKey);
    const outcomeCase = outcomeByKey.get(mechanicsCase.stableKey);
    if (!discoveryCase || !outcomeCase) throw new Error(`Missing frozen lineage for ${mechanicsCase.stableKey}`);
    for (const item of [discoveryCase, outcomeCase]) {
      if (
        item.caseKey !== mechanicsCase.caseKey
        || item.voteEventId !== mechanicsCase.voteEventId
        || item.identifier !== mechanicsCase.identifier
        || item.occurredOn !== mechanicsCase.occurredOn
      ) throw new Error(`Case lineage mismatch for ${mechanicsCase.stableKey}`);
    }
    if (discoveryCase.externalKey !== mechanicsCase.externalKey || outcomeCase.externalKey !== mechanicsCase.externalKey) {
      throw new Error(`External-key lineage mismatch for ${mechanicsCase.stableKey}`);
    }

    const quickByLegislator = new Map(discoveryCase.members.map((member) => [member.legislatorId, member]));
    if (quickByLegislator.size !== discoveryCase.members.length) {
      throw new Error(`Duplicate Quick legislator in ${mechanicsCase.stableKey}`);
    }
    const members: MemberPoint[] = outcomeCase.members.map((member) => {
      const quick = quickByLegislator.get(member.legislatorId);
      if (!quick) throw new Error(`Outcome member ${member.legislatorId} missing from frozen Quick ${mechanicsCase.stableKey}`);
      const probability = quick.yesProbability;
      if (probability === undefined || !Number.isFinite(probability) || probability < 0 || probability > 1) {
        throw new Error(`Invalid frozen Quick probability for ${mechanicsCase.stableKey}|${member.legislatorId}`);
      }
      if (member.actualOutcome !== 0 && member.actualOutcome !== 1) {
        throw new Error(`Invalid frozen decisive outcome for ${mechanicsCase.stableKey}|${member.legislatorId}`);
      }
      return { probability, outcome: member.actualOutcome };
    });
    if (members.length === 0) throw new Error(`No decisive member outcomes for ${mechanicsCase.stableKey}`);

    const actualYesVotes = members.filter((item) => item.outcome === 1).length;
    const actualYesRate = ratio(actualYesVotes, members.length);
    const quickMeanYesProbability = mean(members.map((item) => item.probability));
    const caseObservations = observationsByKey.get(mechanicsCase.stableKey) ?? [];
    const directions = DIRECTIONS.filter((direction) => caseObservations.some((item) => item.direction === direction));
    const lastObservationByMechanic: HistoricalDeepHouseJournalMechanicsScoreCase['lastObservationByMechanic'] = {};
    for (const mechanic of mechanicsCase.mechanics) {
      const dates = caseObservations
        .filter((item) => item.mechanic === mechanic)
        .map((item) => item.journalDate)
        .sort();
      const journalDate = dates.at(-1);
      if (!journalDate) throw new Error(`Case ${mechanicsCase.stableKey} lists mechanic ${mechanic} without an observation`);
      lastObservationByMechanic[mechanic] = {
        journalDate,
        daysBeforeVote: daysBeforeVote(journalDate, mechanicsCase.occurredOn),
      };
    }

    return {
      row: {
        stableKey: mechanicsCase.stableKey,
        caseKey: mechanicsCase.caseKey,
        voteEventId: mechanicsCase.voteEventId,
        externalKey: mechanicsCase.externalKey,
        identifier: mechanicsCase.identifier,
        occurredOn: mechanicsCase.occurredOn,
        quickModelVersion: discoveryCase.quickModelVersion,
        decisiveMemberOutcomes: members.length,
        actualYesVotes,
        actualNoVotes: members.length - actualYesVotes,
        actualYesRate,
        quickMeanYesProbability,
        signedResidual: actualYesRate - quickMeanYesProbability,
        quickBrier: mean(members.map((item) => (item.probability - item.outcome) ** 2)),
        quickLogLoss: mean(members.map((item) => logLoss(item.probability, item.outcome))),
        quickAccuracy: ratio(
          members.filter((item) => (item.probability >= 0.5 ? 1 : 0) === item.outcome).length,
          members.length,
        ),
        mechanics: mechanicsCase.mechanics,
        directions,
        lastObservationByMechanic,
      },
      members,
    };
  }).sort((left, right) => left.row.occurredOn.localeCompare(right.row.occurredOn)
    || left.row.identifier.localeCompare(right.row.identifier));
}

function mechanicScores(
  computations: readonly CaseComputation[],
  mechanics: HistoricalDeepHouseJournalMechanicsArtifact,
): Record<HistoricalDeepHouseJournalMechanic, HistoricalDeepHouseJournalMechanicScoreSlice> {
  return Object.fromEntries(MECHANICS.map((mechanic) => {
    const withCases = computations.filter((item) => item.row.mechanics.includes(mechanic));
    const withoutCases = computations.filter((item) => !item.row.mechanics.includes(mechanic));
    const withSlice = quickOutcomeSlice(withCases);
    if (!withSlice) throw new Error(`Frozen Journal mechanics artifact has no cases for ${mechanic}`);
    const withoutSlice = quickOutcomeSlice(withoutCases);
    const recency = withCases.map((item) => item.row.lastObservationByMechanic[mechanic]?.daysBeforeVote);
    if (recency.some((value) => value === undefined)) throw new Error(`Missing recency for mechanic ${mechanic}`);
    return [mechanic, {
      observations: mechanics.observations.filter((item) => item.mechanic === mechanic).length,
      withMechanic: withSlice,
      withoutMechanic: withoutSlice,
      contrast: contrast(withSlice, withoutSlice),
      lastObservationRecency: recencySummary(recency as number[]),
    }];
  })) as Record<HistoricalDeepHouseJournalMechanic, HistoricalDeepHouseJournalMechanicScoreSlice>;
}

function directionScores(
  computations: readonly CaseComputation[],
  mechanics: HistoricalDeepHouseJournalMechanicsArtifact,
): Record<HistoricalDeepHouseJournalMechanicDirection, HistoricalDeepHouseJournalDirectionScoreSlice> {
  return Object.fromEntries(DIRECTIONS.map((direction) => {
    const withCases = computations.filter((item) => item.row.directions.includes(direction));
    const withoutCases = computations.filter((item) => !item.row.directions.includes(direction));
    const withSlice = quickOutcomeSlice(withCases);
    if (!withSlice) throw new Error(`Frozen Journal mechanics artifact has no cases for direction ${direction}`);
    const withoutSlice = quickOutcomeSlice(withoutCases);
    return [direction, {
      observations: mechanics.observations.filter((item) => item.direction === direction).length,
      withDirection: withSlice,
      withoutDirection: withoutSlice,
      contrast: contrast(withSlice, withoutSlice),
    }];
  })) as Record<HistoricalDeepHouseJournalMechanicDirection, HistoricalDeepHouseJournalDirectionScoreSlice>;
}

function cooccurrence(computations: readonly CaseComputation[]): HistoricalDeepHouseJournalMechanicCooccurrence[] {
  const rows: HistoricalDeepHouseJournalMechanicCooccurrence[] = [];
  for (let leftIndex = 0; leftIndex < MECHANICS.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < MECHANICS.length; rightIndex += 1) {
      const left = MECHANICS[leftIndex];
      const right = MECHANICS[rightIndex];
      const leftCases = computations.filter((item) => item.row.mechanics.includes(left)).length;
      const rightCases = computations.filter((item) => item.row.mechanics.includes(right)).length;
      const sharedCases = computations.filter((item) => item.row.mechanics.includes(left) && item.row.mechanics.includes(right)).length;
      const unionCases = leftCases + rightCases - sharedCases;
      rows.push({
        left,
        right,
        leftCases,
        rightCases,
        sharedCases,
        unionCases,
        jaccard: ratio(sharedCases, unionCases),
      });
    }
  }
  return rows.sort((left, right) => right.jaccard - left.jaccard
    || right.sharedCases - left.sharedCases
    || left.left.localeCompare(right.left)
    || left.right.localeCompare(right.right));
}

export function scoreHistoricalDeepHouseJournalMechanics(input: {
  discovery: HistoricalDeepExpansionDiscoveryManifest;
  mechanics: HistoricalDeepHouseJournalMechanicsArtifact;
  outcomes: HistoricalDeepExpansionOutcomeSnapshot;
  lineage: HistoricalDeepHouseJournalMechanicsScoreLineage;
  generatedAt?: string;
}): HistoricalDeepHouseJournalMechanicsScoreArtifact {
  validateInputs(input.discovery, input.mechanics, input.outcomes, input.lineage);
  const computations = buildCaseComputations(input.discovery, input.mechanics, input.outcomes);
  const overall = quickOutcomeSlice(computations);
  if (!overall) throw new Error('No frozen Journal mechanics cases were available for scoring');
  const decisiveMemberOutcomes = computations.reduce((sum, item) => sum + item.members.length, 0);

  return {
    schemaVersion: HISTORICAL_DEEP_HOUSE_JOURNAL_MECHANICS_SCORE_SCHEMA,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    purpose: 'post-freeze development-only diagnostic that stratifies the immutable 24-case Quick member forecast and frozen decisive outcomes by previously frozen House Journal mechanics; estimates conditional Quick residuals and score slices without assigning causal meaning, evidence weights, actionability, or production probability changes',
    metadata: {
      evaluationPolicy: HISTORICAL_DEEP_HOUSE_JOURNAL_MECHANICS_SCORE_POLICY,
      outcomeUse: 'post-mechanics-freeze-development-scoring-only',
      probabilityAction: 'none',
      actionabilityDecision: 'none',
      interpretationGuard: 'House Journal mechanics are bill-level, overlap heavily, and are not member vote signals. With/without contrasts are descriptive stratification only, not independent effects or causal estimates. The 24-case development cohort contains only bills that ultimately passed the selected House floor event, so this artifact evaluates member-level vote share and Quick calibration/residual behavior rather than bill-level passage discrimination. Small mechanic case counts must not be converted directly into evidence weights.',
      lineage: {
        discoveryManifestArtifactId: input.lineage.discoveryManifest.artifactId,
        discoveryManifestArtifactSha256: input.lineage.discoveryManifest.artifactSha256,
        discoveryManifestHeadSha: input.lineage.discoveryManifest.headSha,
        mechanicsArtifactId: input.lineage.mechanicsArtifact.artifactId,
        mechanicsArtifactSha256: input.lineage.mechanicsArtifact.artifactSha256,
        mechanicsArtifactHeadSha: input.lineage.mechanicsArtifact.headSha,
        outcomeArtifactId: input.lineage.outcomeArtifact.artifactId,
        outcomeArtifactSha256: input.lineage.outcomeArtifact.artifactSha256,
        outcomeArtifactHeadSha: input.lineage.outcomeArtifact.headSha,
      },
    },
    input: {
      discoveryCases: input.discovery.cases.length,
      discoveryMemberCasePairs: input.discovery.metadata.memberCasePairs,
      mechanicsCases: input.mechanics.cases.length,
      mechanicsObservations: input.mechanics.observations.length,
      outcomeCases: input.outcomes.cases.length,
      decisiveMemberOutcomes,
    },
    summary: {
      overall,
      mechanicallyActionableObservations: 0,
      finalPassageInferenceObservations: 0,
      mechanics: mechanicScores(computations, input.mechanics),
      directions: directionScores(computations, input.mechanics),
      cooccurrence: cooccurrence(computations),
    },
    cases: computations.map((item) => item.row),
  };
}
