import type { HistoricalDeepExpansionCohort } from './historical-deep-expansion-cohort';
import type { HistoricalDeepExpansionDiscoveryManifest } from './historical-deep-expansion-discovery';
import type { HistoricalDeepHouseJournalHoldoutCohort } from './historical-deep-house-journal-holdout-cohort';
import type { HistoricalDeepHouseJournalHoldoutMechanicsArtifact } from './historical-deep-house-journal-holdout-mechanics';
import type { HistoricalDeepHouseJournalMechanic } from './historical-deep-house-journal-mechanics';

export const HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_OUTCOME_SCHEMA = 'historical-deep-house-journal-holdout-outcome-snapshot-v1' as const;
export const HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_SCORE_SCHEMA = 'historical-deep-house-journal-holdout-score-v1' as const;
export const HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_SCORE_POLICY = 'predeclared-house-journal-holdout-replication-v1' as const;

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

export interface HistoricalDeepHouseJournalHoldoutArtifactRef {
  workflowRunId: number;
  artifactId: number;
  artifactName: string;
  artifactSha256: string;
  headSha: string;
  fileName: string;
}

export interface HistoricalDeepHouseJournalHoldoutScoreLineage {
  schemaVersion: 'historical-deep-house-journal-holdout-score-lineage-v1';
  cohortArtifact: HistoricalDeepHouseJournalHoldoutArtifactRef;
  mechanicsArtifact: HistoricalDeepHouseJournalHoldoutArtifactRef;
  holdoutPlan: {
    sourceFile: string;
    sourceFileBlobSha: string;
    frozenAtHeadSha: string;
  };
  policy: {
    evaluation: typeof HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_SCORE_POLICY;
    outcomeUse: 'single-post-freeze-holdout-reveal';
    probabilityAction: 'none';
    actionabilityDecision: 'none';
  };
}

export interface HistoricalDeepHouseJournalHoldoutPlanHypothesis {
  id: string;
  mechanic: HistoricalDeepHouseJournalMechanic;
  developmentCases: number;
  developmentMemberWeightedSignedResidual: number;
  developmentCaseMeanSignedResidual: number;
  expectedDirection: 'positive' | 'negative';
  interpretation: string;
  replicationMinimumCases: number;
  replicationMinimumDecisiveMemberOutcomes: number;
  minimumAbsoluteMemberWeightedResidual: number;
}

export interface HistoricalDeepHouseJournalHoldoutPlan {
  schemaVersion: 'historical-deep-house-journal-holdout-plan-v1';
  primaryHypotheses: HistoricalDeepHouseJournalHoldoutPlanHypothesis[];
  negativeControls: Array<{
    id: string;
    mechanic: HistoricalDeepHouseJournalMechanic;
    developmentCases: number;
    developmentMemberWeightedSignedResidual: number;
    role: string;
  }>;
  exploratoryOnly: Array<{
    mechanic: HistoricalDeepHouseJournalMechanic;
    developmentCases: number;
    developmentMemberWeightedSignedResidual: number;
    reason: string;
  }>;
  replicationRule: {
    eligible: string;
    replicates: string;
    doesNotReplicate: string;
    inconclusive: string;
  };
  secondaryBillOutcomeAnalysis: {
    policy: string;
    actionability: 'none';
  };
  overlapGuard: { policy: string };
  decisionBoundary: {
    probabilityAction: 'none';
    mechanicActionability: 'none';
    evidenceWeightChanges: 'none';
    targetPolicyChanges: 'none';
    productionChanges: 'none';
    nextStepIfReplicationSucceeds: string;
  };
}

export interface HistoricalDeepHouseJournalHoldoutOutcomeMember {
  membershipId: string;
  legislatorId: string;
  actualOutcome: 0 | 1;
}

export interface HistoricalDeepHouseJournalHoldoutOutcomeCase {
  stableKey: string;
  caseKey: string;
  externalKey: string;
  tranche: 'deterministic-uniform' | 'selector-disagreement';
  session: string;
  chamber: string;
  identifier: string;
  occurredOn: string;
  voteEventId: string;
  passed: boolean;
  members: HistoricalDeepHouseJournalHoldoutOutcomeMember[];
}

export interface HistoricalDeepHouseJournalHoldoutOutcomeSnapshot {
  schemaVersion: typeof HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_OUTCOME_SCHEMA;
  generatedAt: string;
  codeSha: string | null;
  purpose: string;
  cases: HistoricalDeepHouseJournalHoldoutOutcomeCase[];
}

export interface HistoricalDeepHouseJournalHoldoutQuickOutcomeSlice {
  cases: number;
  decisiveMemberOutcomes: number;
  actualYesVotes: number;
  actualNoVotes: number;
  actualYesRate: number;
  quickMeanYesProbability: number;
  memberWeightedSignedResidual: number;
  caseMeanActualYesRate: number;
  caseMeanQuickYesProbability: number;
  caseMeanSignedResidual: number;
  caseMeanAbsoluteResidual: number;
  quickBrier: number;
  quickLogLoss: number;
  quickAccuracy: number;
}

export type HistoricalDeepHouseJournalHoldoutReplicationStatus = 'replicates' | 'does_not_replicate' | 'inconclusive';

export interface HistoricalDeepHouseJournalHoldoutPrimaryResult {
  id: string;
  mechanic: HistoricalDeepHouseJournalMechanic;
  expectedDirection: 'positive' | 'negative';
  developmentCases: number;
  developmentMemberWeightedSignedResidual: number;
  developmentCaseMeanSignedResidual: number;
  thresholds: {
    minimumCases: number;
    minimumDecisiveMemberOutcomes: number;
    minimumAbsoluteMemberWeightedResidual: number;
  };
  holdout: HistoricalDeepHouseJournalHoldoutQuickOutcomeSlice | null;
  status: HistoricalDeepHouseJournalHoldoutReplicationStatus;
  reason: string;
}

export interface HistoricalDeepHouseJournalHoldoutDiagnosticResult {
  mechanic: HistoricalDeepHouseJournalMechanic;
  developmentCases: number;
  developmentMemberWeightedSignedResidual: number;
  holdout: HistoricalDeepHouseJournalHoldoutQuickOutcomeSlice | null;
  note: string;
}

export interface HistoricalDeepHouseJournalHoldoutCooccurrence {
  left: HistoricalDeepHouseJournalMechanic;
  right: HistoricalDeepHouseJournalMechanic;
  leftCases: number;
  rightCases: number;
  sharedCases: number;
  unionCases: number;
  jaccard: number;
}

export interface HistoricalDeepHouseJournalHoldoutBillOutcomeSlice {
  cases: number;
  passedCases: number;
  failedCases: number;
  passageRate: number | null;
}

export interface HistoricalDeepHouseJournalHoldoutBillMechanicContrast {
  mechanic: HistoricalDeepHouseJournalMechanic;
  withMechanic: HistoricalDeepHouseJournalHoldoutBillOutcomeSlice;
  withoutMechanic: HistoricalDeepHouseJournalHoldoutBillOutcomeSlice;
  passageRateRiskDifference: number | null;
}

export interface HistoricalDeepHouseJournalHoldoutScoreMember {
  membershipId: string;
  legislatorId: string;
  yesProbability: number;
  actualOutcome: 0 | 1;
}

export interface HistoricalDeepHouseJournalHoldoutScoreCase {
  stableKey: string;
  caseKey: string;
  voteEventId: string;
  externalKey: string;
  identifier: string;
  session: string;
  chamber: string;
  occurredOn: string;
  tranche: 'deterministic-uniform' | 'selector-disagreement';
  quickModelVersion: string;
  passed: boolean;
  mechanics: HistoricalDeepHouseJournalMechanic[];
  decisiveMemberOutcomes: number;
  actualYesVotes: number;
  actualNoVotes: number;
  actualYesRate: number;
  quickMeanYesProbability: number;
  signedResidual: number;
  quickBrier: number;
  quickLogLoss: number;
  quickAccuracy: number;
  members: HistoricalDeepHouseJournalHoldoutScoreMember[];
}

export interface HistoricalDeepHouseJournalHoldoutScoreArtifact {
  schemaVersion: typeof HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_SCORE_SCHEMA;
  generatedAt: string;
  purpose: string;
  metadata: {
    evaluationPolicy: typeof HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_SCORE_POLICY;
    runtimeCodeSha: string | null;
    outcomeUse: 'single-post-freeze-holdout-reveal';
    probabilityAction: 'none';
    actionabilityDecision: 'none';
    interpretationGuard: string;
    lineage: HistoricalDeepHouseJournalHoldoutScoreLineage;
  };
  input: {
    frozenCases: number;
    quickMemberCasePairs: number;
    decisiveMemberOutcomes: number;
    mechanicsObservations: number;
  };
  summary: {
    overall: HistoricalDeepHouseJournalHoldoutQuickOutcomeSlice;
    primaryHypotheses: HistoricalDeepHouseJournalHoldoutPrimaryResult[];
    negativeControls: HistoricalDeepHouseJournalHoldoutDiagnosticResult[];
    exploratoryOnly: HistoricalDeepHouseJournalHoldoutDiagnosticResult[];
    cooccurrence: HistoricalDeepHouseJournalHoldoutCooccurrence[];
    highOverlapPairs: HistoricalDeepHouseJournalHoldoutCooccurrence[];
    billOutcomeAnalysis: {
      identifiable: boolean;
      overall: HistoricalDeepHouseJournalHoldoutBillOutcomeSlice;
      byMechanic: HistoricalDeepHouseJournalHoldoutBillMechanicContrast[];
      interpretation: string;
    };
  };
  cases: HistoricalDeepHouseJournalHoldoutScoreCase[];
}

interface CaseComputation {
  row: HistoricalDeepHouseJournalHoldoutScoreCase;
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function logLoss(probability: number, outcome: 0 | 1): number {
  const clipped = Math.min(1 - 1e-15, Math.max(1e-15, probability));
  return -(outcome * Math.log(clipped) + (1 - outcome) * Math.log(1 - clipped));
}

function validateArtifactRef(label: string, artifact: HistoricalDeepHouseJournalHoldoutArtifactRef): void {
  if (!Number.isInteger(artifact.workflowRunId) || artifact.workflowRunId <= 0) throw new Error(`${label} workflow run id is invalid`);
  if (!Number.isInteger(artifact.artifactId) || artifact.artifactId <= 0) throw new Error(`${label} artifact id is invalid`);
  if (!/^[a-f0-9]{64}$/.test(artifact.artifactSha256)) throw new Error(`${label} artifact SHA-256 is invalid`);
  if (!/^[a-f0-9]{40}$/.test(artifact.headSha)) throw new Error(`${label} head SHA is invalid`);
  if (!artifact.artifactName || !artifact.fileName) throw new Error(`${label} artifact name/file is missing`);
}

function stableKeys(values: readonly { stableKey: string }[]): Set<string> {
  return new Set(values.map((item) => item.stableKey));
}

function sameKeys(left: Set<string>, right: Set<string>): boolean {
  return left.size === right.size && [...left].every((key) => right.has(key));
}

function validatePlan(plan: HistoricalDeepHouseJournalHoldoutPlan): void {
  if (plan.schemaVersion !== 'historical-deep-house-journal-holdout-plan-v1') {
    throw new Error(`Unsupported House Journal holdout plan ${String(plan.schemaVersion)}`);
  }
  const expected = [
    ['H1-final-passage-stage-positive-residual', 'reaches_final_passage_stage', 'positive'],
    ['H2-calendar-designation-negative-residual', 'calendar_designation', 'negative'],
    ['H3-companion-substitution-positive-residual', 'companion_substitution', 'positive'],
  ] as const;
  if (plan.primaryHypotheses.length !== expected.length) throw new Error('Holdout plan primary hypothesis count drifted');
  for (let index = 0; index < expected.length; index += 1) {
    const [id, mechanic, direction] = expected[index];
    const item = plan.primaryHypotheses[index];
    if (item.id !== id || item.mechanic !== mechanic || item.expectedDirection !== direction) {
      throw new Error(`Holdout plan primary hypothesis ${index + 1} drifted`);
    }
    if (item.replicationMinimumCases !== 5 || item.replicationMinimumDecisiveMemberOutcomes !== 400 || item.minimumAbsoluteMemberWeightedResidual !== 0.02) {
      throw new Error(`Holdout plan thresholds drifted for ${item.id}`);
    }
  }
  if (plan.negativeControls.length !== 1 || plan.negativeControls[0].mechanic !== 'author_added') {
    throw new Error('Holdout plan negative control drifted');
  }
  if (plan.decisionBoundary.probabilityAction !== 'none'
    || plan.decisionBoundary.mechanicActionability !== 'none'
    || plan.decisionBoundary.evidenceWeightChanges !== 'none'
    || plan.decisionBoundary.targetPolicyChanges !== 'none'
    || plan.decisionBoundary.productionChanges !== 'none') {
    throw new Error('Holdout plan production boundary drifted');
  }
}

function validateLineage(lineage: HistoricalDeepHouseJournalHoldoutScoreLineage): void {
  if (lineage.schemaVersion !== 'historical-deep-house-journal-holdout-score-lineage-v1') {
    throw new Error(`Unsupported holdout score lineage ${String(lineage.schemaVersion)}`);
  }
  validateArtifactRef('cohort', lineage.cohortArtifact);
  validateArtifactRef('mechanics', lineage.mechanicsArtifact);
  if (!lineage.holdoutPlan.sourceFile || !/^[a-f0-9]{40}$/.test(lineage.holdoutPlan.sourceFileBlobSha)
    || !/^[a-f0-9]{40}$/.test(lineage.holdoutPlan.frozenAtHeadSha)) {
    throw new Error('Holdout plan lineage is invalid');
  }
  if (lineage.policy.evaluation !== HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_SCORE_POLICY
    || lineage.policy.outcomeUse !== 'single-post-freeze-holdout-reveal'
    || lineage.policy.probabilityAction !== 'none'
    || lineage.policy.actionabilityDecision !== 'none') {
    throw new Error('Holdout score lineage policy drifted');
  }
}

export function historicalDeepHouseJournalHoldoutAsExpansionCohort(
  cohort: HistoricalDeepHouseJournalHoldoutCohort,
): HistoricalDeepExpansionCohort {
  if (cohort.schemaVersion !== 'historical-deep-house-journal-holdout-cohort-v1' || cohort.cases.length !== 24) {
    throw new Error('Frozen 24-case House Journal holdout cohort is required');
  }
  if (cohort.cases.some((item) => item.session !== '2025-2026' || item.chamber !== 'house')) {
    throw new Error('House Journal holdout compatibility cohort must be 2025-2026 House only');
  }
  return {
    schemaVersion: 'historical-deep-expansion-cohort-v1',
    generatedAt: cohort.generatedAt,
    metadata: {
      codeSha: cohort.metadata.codeSha,
      databaseSource: cohort.metadata.databaseSource,
      purpose: 'ephemeral compatibility view for replaying frozen pre-vote Quick probabilities on the already-selected House Journal holdout cohort',
      selectionGuard: cohort.metadata.selectionGuard,
      holdoutPolicy: 'The 2025-2026 House cases were frozen by historical-deep-house-journal-holdout-cohort-v1 before Journal source lookup and outcome reveal.',
      sessions: cohort.metadata.sessions,
      chamber: 'house',
      targetLimit: 12,
      perSessionPerTranche: cohort.metadata.perSessionPerTranche,
      totalSelected: cohort.metadata.totalSelected,
      pilotCasesExcluded: 0,
      poolBySession: cohort.metadata.poolBySession,
    },
    cases: cohort.cases,
  };
}

function validateInputs(input: {
  cohort: HistoricalDeepHouseJournalHoldoutCohort;
  mechanics: HistoricalDeepHouseJournalHoldoutMechanicsArtifact;
  discovery: HistoricalDeepExpansionDiscoveryManifest;
  outcomes: HistoricalDeepHouseJournalHoldoutOutcomeSnapshot;
  plan: HistoricalDeepHouseJournalHoldoutPlan;
  lineage: HistoricalDeepHouseJournalHoldoutScoreLineage;
}): void {
  const { cohort, mechanics, discovery, outcomes, plan, lineage } = input;
  validatePlan(plan);
  validateLineage(lineage);
  if (cohort.schemaVersion !== 'historical-deep-house-journal-holdout-cohort-v1' || cohort.cases.length !== 24) {
    throw new Error('Frozen 24-case holdout cohort is required');
  }
  if (cohort.metadata.codeSha !== lineage.cohortArtifact.headSha) {
    throw new Error(`Holdout cohort head mismatch: expected ${lineage.cohortArtifact.headSha}, got ${cohort.metadata.codeSha ?? 'null'}`);
  }
  if (mechanics.schemaVersion !== 'historical-deep-house-journal-holdout-mechanics-v1' || mechanics.cases.length !== 24) {
    throw new Error('Frozen 24-case holdout mechanics artifact is required');
  }
  if (mechanics.metadata.parser !== 'deterministic-house-journal-mechanics-v1'
    || mechanics.metadata.outcomeUse !== 'none'
    || mechanics.metadata.probabilityAction !== 'none') {
    throw new Error('Holdout mechanics artifact is not the frozen outcome-blind parser output');
  }
  if (mechanics.observations.some((item) => item.mechanicallyActionable !== false || item.finalPassageInference !== 'none')) {
    throw new Error('Holdout mechanics artifact contains actionable or final-passage inference evidence');
  }
  if (discovery.schemaVersion !== 'historical-deep-expansion-discovery-manifest-v1' || discovery.cases.length !== 24) {
    throw new Error('Frozen-cohort Quick discovery manifest is required');
  }
  if (discovery.metadata.candidateStrategy !== 'need-only') throw new Error('Unexpected Quick discovery candidate strategy');
  if (outcomes.schemaVersion !== HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_OUTCOME_SCHEMA || outcomes.cases.length !== 24) {
    throw new Error('Exactly 24 holdout outcome cases are required');
  }
  if (discovery.metadata.codeSha !== outcomes.codeSha) {
    throw new Error(`Quick/outcome runtime SHA mismatch: ${discovery.metadata.codeSha ?? 'null'} vs ${outcomes.codeSha ?? 'null'}`);
  }

  const cohortKeys = stableKeys(cohort.cases);
  const mechanicsKeys = stableKeys(mechanics.cases);
  const discoveryKeys = stableKeys(discovery.cases);
  const outcomeKeys = stableKeys(outcomes.cases);
  if (cohortKeys.size !== 24 || mechanicsKeys.size !== 24 || discoveryKeys.size !== 24 || outcomeKeys.size !== 24) {
    throw new Error('Holdout inputs contain duplicate stable keys');
  }
  if (!sameKeys(cohortKeys, mechanicsKeys) || !sameKeys(cohortKeys, discoveryKeys) || !sameKeys(cohortKeys, outcomeKeys)) {
    throw new Error('Holdout stable-key lineage differs across frozen inputs');
  }
}

function buildCaseComputations(input: {
  cohort: HistoricalDeepHouseJournalHoldoutCohort;
  mechanics: HistoricalDeepHouseJournalHoldoutMechanicsArtifact;
  discovery: HistoricalDeepExpansionDiscoveryManifest;
  outcomes: HistoricalDeepHouseJournalHoldoutOutcomeSnapshot;
}): CaseComputation[] {
  const cohortByKey = new Map(input.cohort.cases.map((item) => [item.stableKey, item]));
  const mechanicsByKey = new Map(input.mechanics.cases.map((item) => [item.stableKey, item]));
  const discoveryByKey = new Map(input.discovery.cases.map((item) => [item.stableKey, item]));

  return input.outcomes.cases.map((outcomeCase) => {
    const cohortCase = cohortByKey.get(outcomeCase.stableKey);
    const mechanicsCase = mechanicsByKey.get(outcomeCase.stableKey);
    const discoveryCase = discoveryByKey.get(outcomeCase.stableKey);
    if (!cohortCase || !mechanicsCase || !discoveryCase) throw new Error(`Missing frozen lineage for ${outcomeCase.stableKey}`);
    for (const item of [mechanicsCase, discoveryCase, outcomeCase]) {
      if (item.caseKey !== cohortCase.caseKey || item.voteEventId !== cohortCase.voteEventId
        || item.externalKey !== cohortCase.externalKey || item.identifier !== cohortCase.identifier
        || item.occurredOn !== cohortCase.occurredOn) {
        throw new Error(`Holdout case lineage mismatch for ${cohortCase.stableKey}`);
      }
    }
    if (outcomeCase.session !== cohortCase.session || outcomeCase.chamber !== cohortCase.chamber || outcomeCase.tranche !== cohortCase.tranche) {
      throw new Error(`Holdout outcome natural-key mismatch for ${cohortCase.stableKey}`);
    }
    if (discoveryCase.quickModelVersion !== cohortCase.quickModelVersion) {
      throw new Error(`Holdout Quick model drift for ${cohortCase.stableKey}`);
    }

    const quickByLegislator = new Map(discoveryCase.members.map((member) => [member.legislatorId, member]));
    if (quickByLegislator.size !== discoveryCase.members.length) throw new Error(`Duplicate Quick legislator for ${cohortCase.stableKey}`);
    const seenOutcomeLegislators = new Set<string>();
    const members: HistoricalDeepHouseJournalHoldoutScoreMember[] = outcomeCase.members.map((member) => {
      if (seenOutcomeLegislators.has(member.legislatorId)) throw new Error(`Duplicate outcome legislator for ${cohortCase.stableKey}|${member.legislatorId}`);
      seenOutcomeLegislators.add(member.legislatorId);
      const quick = quickByLegislator.get(member.legislatorId);
      if (!quick) throw new Error(`Outcome legislator missing from frozen Quick for ${cohortCase.stableKey}|${member.legislatorId}`);
      if (quick.membershipId !== member.membershipId) throw new Error(`Membership lineage drift for ${cohortCase.stableKey}|${member.legislatorId}`);
      const probability = quick.yesProbability;
      if (probability === undefined || !Number.isFinite(probability) || probability < 0 || probability > 1) {
        throw new Error(`Decisive outcome lacks valid frozen Quick probability for ${cohortCase.stableKey}|${member.legislatorId}`);
      }
      if (member.actualOutcome !== 0 && member.actualOutcome !== 1) throw new Error(`Invalid decisive outcome for ${cohortCase.stableKey}|${member.legislatorId}`);
      return {
        membershipId: member.membershipId,
        legislatorId: member.legislatorId,
        yesProbability: probability,
        actualOutcome: member.actualOutcome,
      };
    });
    if (members.length === 0) throw new Error(`No decisive member outcomes for ${cohortCase.stableKey}`);

    const actualYesVotes = members.filter((member) => member.actualOutcome === 1).length;
    const actualYesRate = ratio(actualYesVotes, members.length);
    const quickMean = mean(members.map((member) => member.yesProbability));
    return {
      row: {
        stableKey: cohortCase.stableKey,
        caseKey: cohortCase.caseKey,
        voteEventId: cohortCase.voteEventId,
        externalKey: cohortCase.externalKey,
        identifier: cohortCase.identifier,
        session: cohortCase.session,
        chamber: cohortCase.chamber,
        occurredOn: cohortCase.occurredOn,
        tranche: cohortCase.tranche,
        quickModelVersion: discoveryCase.quickModelVersion,
        passed: outcomeCase.passed,
        mechanics: mechanicsCase.mechanics,
        decisiveMemberOutcomes: members.length,
        actualYesVotes,
        actualNoVotes: members.length - actualYesVotes,
        actualYesRate,
        quickMeanYesProbability: quickMean,
        signedResidual: actualYesRate - quickMean,
        quickBrier: mean(members.map((member) => (member.yesProbability - member.actualOutcome) ** 2)),
        quickLogLoss: mean(members.map((member) => logLoss(member.yesProbability, member.actualOutcome))),
        quickAccuracy: ratio(members.filter((member) => (member.yesProbability >= 0.5 ? 1 : 0) === member.actualOutcome).length, members.length),
        members,
      },
    };
  }).sort((left, right) => left.row.occurredOn.localeCompare(right.row.occurredOn)
    || left.row.identifier.localeCompare(right.row.identifier));
}

function quickOutcomeSlice(cases: readonly CaseComputation[]): HistoricalDeepHouseJournalHoldoutQuickOutcomeSlice | null {
  if (cases.length === 0) return null;
  const members = cases.flatMap((item) => item.row.members);
  if (members.length === 0) return null;
  const yesVotes = members.filter((item) => item.actualOutcome === 1).length;
  const actualYesRate = ratio(yesVotes, members.length);
  const quickMean = mean(members.map((item) => item.yesProbability));
  return {
    cases: cases.length,
    decisiveMemberOutcomes: members.length,
    actualYesVotes: yesVotes,
    actualNoVotes: members.length - yesVotes,
    actualYesRate,
    quickMeanYesProbability: quickMean,
    memberWeightedSignedResidual: actualYesRate - quickMean,
    caseMeanActualYesRate: mean(cases.map((item) => item.row.actualYesRate)),
    caseMeanQuickYesProbability: mean(cases.map((item) => item.row.quickMeanYesProbability)),
    caseMeanSignedResidual: mean(cases.map((item) => item.row.signedResidual)),
    caseMeanAbsoluteResidual: mean(cases.map((item) => Math.abs(item.row.signedResidual))),
    quickBrier: mean(members.map((item) => (item.yesProbability - item.actualOutcome) ** 2)),
    quickLogLoss: mean(members.map((item) => logLoss(item.yesProbability, item.actualOutcome))),
    quickAccuracy: ratio(members.filter((item) => (item.yesProbability >= 0.5 ? 1 : 0) === item.actualOutcome).length, members.length),
  };
}

function directionMatches(value: number, direction: 'positive' | 'negative'): boolean {
  return direction === 'positive' ? value > 0 : value < 0;
}

export function classifyHistoricalDeepHouseJournalHoldoutHypothesis(
  hypothesis: HistoricalDeepHouseJournalHoldoutPlanHypothesis,
  holdout: HistoricalDeepHouseJournalHoldoutQuickOutcomeSlice | null,
): Pick<HistoricalDeepHouseJournalHoldoutPrimaryResult, 'status' | 'reason'> {
  if (!holdout || holdout.cases < hypothesis.replicationMinimumCases) {
    return {
      status: 'inconclusive',
      reason: `Holdout has ${holdout?.cases ?? 0} distinct mechanic-present cases; predeclared minimum is ${hypothesis.replicationMinimumCases}.`,
    };
  }
  if (holdout.decisiveMemberOutcomes < hypothesis.replicationMinimumDecisiveMemberOutcomes) {
    return {
      status: 'inconclusive',
      reason: `Holdout has ${holdout.decisiveMemberOutcomes} decisive mechanic-present member outcomes; predeclared minimum is ${hypothesis.replicationMinimumDecisiveMemberOutcomes}.`,
    };
  }
  const memberSign = directionMatches(holdout.memberWeightedSignedResidual, hypothesis.expectedDirection);
  const caseSign = directionMatches(holdout.caseMeanSignedResidual, hypothesis.expectedDirection);
  const magnitude = Math.abs(holdout.memberWeightedSignedResidual) >= hypothesis.minimumAbsoluteMemberWeightedResidual;
  if (memberSign && caseSign && magnitude) {
    return {
      status: 'replicates',
      reason: `Eligible holdout matches the predeclared ${hypothesis.expectedDirection} sign for both member-weighted and equal-case residuals, with absolute member-weighted residual meeting the ${hypothesis.minimumAbsoluteMemberWeightedResidual} threshold.`,
    };
  }
  return {
    status: 'does_not_replicate',
    reason: `Eligible holdout does not satisfy all predeclared conditions: member sign match=${memberSign}, equal-case sign match=${caseSign}, minimum absolute member-weighted residual met=${magnitude}.`,
  };
}

function primaryResults(
  computations: readonly CaseComputation[],
  plan: HistoricalDeepHouseJournalHoldoutPlan,
): HistoricalDeepHouseJournalHoldoutPrimaryResult[] {
  return plan.primaryHypotheses.map((hypothesis) => {
    const slice = quickOutcomeSlice(computations.filter((item) => item.row.mechanics.includes(hypothesis.mechanic)));
    const classification = classifyHistoricalDeepHouseJournalHoldoutHypothesis(hypothesis, slice);
    return {
      id: hypothesis.id,
      mechanic: hypothesis.mechanic,
      expectedDirection: hypothesis.expectedDirection,
      developmentCases: hypothesis.developmentCases,
      developmentMemberWeightedSignedResidual: hypothesis.developmentMemberWeightedSignedResidual,
      developmentCaseMeanSignedResidual: hypothesis.developmentCaseMeanSignedResidual,
      thresholds: {
        minimumCases: hypothesis.replicationMinimumCases,
        minimumDecisiveMemberOutcomes: hypothesis.replicationMinimumDecisiveMemberOutcomes,
        minimumAbsoluteMemberWeightedResidual: hypothesis.minimumAbsoluteMemberWeightedResidual,
      },
      holdout: slice,
      ...classification,
    };
  });
}

function diagnosticResults(
  computations: readonly CaseComputation[],
  values: readonly { mechanic: HistoricalDeepHouseJournalMechanic; developmentCases: number; developmentMemberWeightedSignedResidual: number; role?: string; reason?: string }[],
): HistoricalDeepHouseJournalHoldoutDiagnosticResult[] {
  return values.map((value) => ({
    mechanic: value.mechanic,
    developmentCases: value.developmentCases,
    developmentMemberWeightedSignedResidual: value.developmentMemberWeightedSignedResidual,
    holdout: quickOutcomeSlice(computations.filter((item) => item.row.mechanics.includes(value.mechanic))),
    note: value.role ?? value.reason ?? '',
  }));
}

function cooccurrence(computations: readonly CaseComputation[]): HistoricalDeepHouseJournalHoldoutCooccurrence[] {
  const rows: HistoricalDeepHouseJournalHoldoutCooccurrence[] = [];
  for (let leftIndex = 0; leftIndex < MECHANICS.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < MECHANICS.length; rightIndex += 1) {
      const left = MECHANICS[leftIndex];
      const right = MECHANICS[rightIndex];
      const leftCases = computations.filter((item) => item.row.mechanics.includes(left)).length;
      const rightCases = computations.filter((item) => item.row.mechanics.includes(right)).length;
      const sharedCases = computations.filter((item) => item.row.mechanics.includes(left) && item.row.mechanics.includes(right)).length;
      const unionCases = leftCases + rightCases - sharedCases;
      rows.push({ left, right, leftCases, rightCases, sharedCases, unionCases, jaccard: ratio(sharedCases, unionCases) });
    }
  }
  return rows.sort((left, right) => right.jaccard - left.jaccard
    || right.sharedCases - left.sharedCases
    || left.left.localeCompare(right.left)
    || left.right.localeCompare(right.right));
}

function billOutcomeSlice(cases: readonly CaseComputation[]): HistoricalDeepHouseJournalHoldoutBillOutcomeSlice {
  const passedCases = cases.filter((item) => item.row.passed).length;
  return {
    cases: cases.length,
    passedCases,
    failedCases: cases.length - passedCases,
    passageRate: cases.length === 0 ? null : passedCases / cases.length,
  };
}

function billOutcomeAnalysis(computations: readonly CaseComputation[], plan: HistoricalDeepHouseJournalHoldoutPlan) {
  const overall = billOutcomeSlice(computations);
  const identifiable = overall.passedCases > 0 && overall.failedCases > 0;
  const byMechanic = MECHANICS.map((mechanic): HistoricalDeepHouseJournalHoldoutBillMechanicContrast => {
    const withMechanic = billOutcomeSlice(computations.filter((item) => item.row.mechanics.includes(mechanic)));
    const withoutMechanic = billOutcomeSlice(computations.filter((item) => !item.row.mechanics.includes(mechanic)));
    return {
      mechanic,
      withMechanic,
      withoutMechanic,
      passageRateRiskDifference: identifiable && withMechanic.passageRate !== null && withoutMechanic.passageRate !== null
        ? withMechanic.passageRate - withoutMechanic.passageRate
        : null,
    };
  });
  return {
    identifiable,
    overall,
    byMechanic,
    interpretation: identifiable
      ? `${plan.secondaryBillOutcomeAnalysis.policy} Rates and risk differences are descriptive only; actionability remains none.`
      : `${plan.secondaryBillOutcomeAnalysis.policy} The frozen holdout contains only one bill-outcome class, so bill-level discrimination is unidentifiable.`,
  };
}

export function scoreHistoricalDeepHouseJournalHoldout(input: {
  cohort: HistoricalDeepHouseJournalHoldoutCohort;
  mechanics: HistoricalDeepHouseJournalHoldoutMechanicsArtifact;
  discovery: HistoricalDeepExpansionDiscoveryManifest;
  outcomes: HistoricalDeepHouseJournalHoldoutOutcomeSnapshot;
  plan: HistoricalDeepHouseJournalHoldoutPlan;
  lineage: HistoricalDeepHouseJournalHoldoutScoreLineage;
  generatedAt?: string;
}): HistoricalDeepHouseJournalHoldoutScoreArtifact {
  validateInputs(input);
  const computations = buildCaseComputations(input);
  const overall = quickOutcomeSlice(computations);
  if (!overall) throw new Error('Holdout scorer produced no decisive Quick/outcome pairs');
  const pairs = cooccurrence(computations);

  return {
    schemaVersion: HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_SCORE_SCHEMA,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    purpose: 'single post-freeze 2025-2026 House Journal holdout reveal that joins frozen pre-vote Quick probabilities to decisive member outcomes and evaluates only the #173 predeclared mechanic hypotheses, controls, exploratory slices, overlap guard, and bill-outcome secondary analysis; it assigns no evidence weight, actionability, target change, serving change, or production probability movement',
    metadata: {
      evaluationPolicy: HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_SCORE_POLICY,
      runtimeCodeSha: input.discovery.metadata.codeSha,
      outcomeUse: 'single-post-freeze-holdout-reveal',
      probabilityAction: 'none',
      actionabilityDecision: 'none',
      interpretationGuard: 'Replication status is mechanical application of the thresholds frozen before Journal source lookup or outcome reveal. Inconclusive slices stay inconclusive; thresholds cannot be relaxed after reveal. Mechanic overlap remains descriptive rather than causal. Even a replicated primary only nominates a separate future experiment and cannot create a production weight from this artifact.',
      lineage: input.lineage,
    },
    input: {
      frozenCases: input.cohort.cases.length,
      quickMemberCasePairs: input.discovery.cases.reduce((sum, item) => sum + item.members.length, 0),
      decisiveMemberOutcomes: computations.reduce((sum, item) => sum + item.row.members.length, 0),
      mechanicsObservations: input.mechanics.observations.length,
    },
    summary: {
      overall,
      primaryHypotheses: primaryResults(computations, input.plan),
      negativeControls: diagnosticResults(computations, input.plan.negativeControls),
      exploratoryOnly: diagnosticResults(computations, input.plan.exploratoryOnly),
      cooccurrence: pairs,
      highOverlapPairs: pairs.filter((item) => item.jaccard >= 0.8 && item.unionCases > 0),
      billOutcomeAnalysis: billOutcomeAnalysis(computations, input.plan),
    },
    cases: computations.map((item) => item.row),
  };
}
