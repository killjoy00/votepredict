import type { ProbabilityScore } from './deep-vs-quick';
import type { HistoricalDeepExpansionImpactReplayV2 } from './historical-deep-expansion-impact-replay-v2';
import type { HistoricalDeepProceduralMechanicsArtifact } from './historical-deep-procedural-mechanics';

export const HISTORICAL_DEEP_EXPANSION_ACTIONABILITY_AUDIT_SCHEMA = 'historical-deep-expansion-actionability-audit-v1' as const;

export const HISTORICAL_DEEP_EXPANSION_ACTIONABILITY_SCENARIOS = [
  'current-targets',
  'need-only-targets',
  'discovery-all',
] as const;

export type HistoricalDeepExpansionActionabilityScenarioName =
  typeof HISTORICAL_DEEP_EXPANSION_ACTIONABILITY_SCENARIOS[number];

export interface HistoricalDeepExpansionActionabilityLegacyScenario {
  candidateObservations: number;
  evidenceItems: number;
  appliedEvidenceItems: number;
  excludedEvidenceItems: number;
  changedMembers: number;
  correctedClassifications: number;
  harmedClassifications: number;
  classificationFlips: number;
  delta: {
    brier: number;
    logLoss: number;
    expectedCalibrationError: number;
    accuracy: number;
  };
}

export interface HistoricalDeepExpansionActionabilityGatedScenario {
  blockedCandidateObservations: number;
  actionableCandidateObservations: 0;
  evidenceItems: 0;
  appliedEvidenceItems: 0;
  changedMembers: 0;
  correctedClassifications: 0;
  harmedClassifications: 0;
  classificationFlips: 0;
  quick: ProbabilityScore;
  deep: ProbabilityScore;
  delta: {
    brier: 0;
    logLoss: 0;
    expectedCalibrationError: 0;
    accuracy: 0;
  };
  movement: {
    changed: 0;
    unchanged: number;
    improved: 0;
    worsened: 0;
    meanAbsoluteMovement: 0;
    meanSignedMovement: 0;
  };
}

export interface HistoricalDeepExpansionActionabilityAuditScenario {
  name: HistoricalDeepExpansionActionabilityScenarioName;
  requestedTargets: number;
  legacy: HistoricalDeepExpansionActionabilityLegacyScenario;
  gated: HistoricalDeepExpansionActionabilityGatedScenario;
}

export interface HistoricalDeepExpansionActionabilityAudit {
  schemaVersion: typeof HISTORICAL_DEEP_EXPANSION_ACTIONABILITY_AUDIT_SCHEMA;
  generatedAt: string;
  purpose: string;
  metadata: {
    gatePolicy: 'frozen-mechanics-actionability-v1';
    taxonomyPolicy: 'mn-house-procedural-mechanics-v1';
    candidateParser: 'deterministic-house-committee-roll-call-v2';
    impactVersion: string;
    taxonomyOutcomeUse: 'none';
    taxonomyProbabilityAction: 'none';
    downstreamOutcomeUse: string;
    interpretation: string;
  };
  input: {
    candidateObservations: number;
    taxonomyObservations: number;
    taxonomyMemberEventPairs: number;
    decisiveMemberOutcomes: number;
  };
  summary: {
    mechanicallyActionableObservations: 0;
    blockedObservations: number;
    legacyScenarioAppliedEvidenceItems: Record<HistoricalDeepExpansionActionabilityScenarioName, number>;
    gatedScenarioAppliedEvidenceItems: Record<HistoricalDeepExpansionActionabilityScenarioName, 0>;
    productionChange: false;
  };
  scenarios: Record<HistoricalDeepExpansionActionabilityScenarioName, HistoricalDeepExpansionActionabilityAuditScenario>;
}

function requireProbabilityScore(
  scenario: HistoricalDeepExpansionImpactReplayV2['scenarios'][HistoricalDeepExpansionActionabilityScenarioName],
): ProbabilityScore {
  if (scenario.allDecisive.status !== 'evaluable' || !scenario.allDecisive.quick) {
    throw new Error(`Legacy scenario ${scenario.name} is not evaluable`);
  }
  return scenario.allDecisive.quick;
}

function requireDelta(
  scenario: HistoricalDeepExpansionImpactReplayV2['scenarios'][HistoricalDeepExpansionActionabilityScenarioName],
): HistoricalDeepExpansionActionabilityLegacyScenario['delta'] {
  const { delta } = scenario.allDecisive;
  if (
    delta.brier === undefined
    || delta.logLoss === undefined
    || delta.expectedCalibrationError === undefined
    || delta.accuracy === undefined
  ) {
    throw new Error(`Legacy scenario ${scenario.name} is missing evaluable deltas`);
  }
  return {
    brier: delta.brier,
    logLoss: delta.logLoss,
    expectedCalibrationError: delta.expectedCalibrationError,
    accuracy: delta.accuracy,
  };
}

function sameProbabilityScore(left: ProbabilityScore, right: ProbabilityScore): boolean {
  return left.observations === right.observations
    && Math.abs(left.accuracy - right.accuracy) <= 1e-12
    && Math.abs(left.brier - right.brier) <= 1e-12
    && Math.abs(left.logLoss - right.logLoss) <= 1e-12
    && Math.abs(left.expectedCalibrationError - right.expectedCalibrationError) <= 1e-12;
}

function validateInputs(
  replay: HistoricalDeepExpansionImpactReplayV2,
  taxonomy: HistoricalDeepProceduralMechanicsArtifact,
): void {
  if (replay.schemaVersion !== 'historical-deep-expansion-impact-replay-v2') {
    throw new Error(`Unsupported replay schema: ${String(replay.schemaVersion)}`);
  }
  if (replay.metadata.candidateParser !== 'deterministic-house-committee-roll-call-v2') {
    throw new Error(`Unsupported replay candidate parser: ${String(replay.metadata.candidateParser)}`);
  }
  if (taxonomy.schemaVersion !== 'historical-deep-procedural-mechanics-v1') {
    throw new Error(`Unsupported taxonomy schema: ${String(taxonomy.schemaVersion)}`);
  }
  if (taxonomy.metadata.policy !== 'mn-house-procedural-mechanics-v1') {
    throw new Error(`Unsupported taxonomy policy: ${String(taxonomy.metadata.policy)}`);
  }
  if (taxonomy.metadata.candidateParser !== 'deterministic-house-committee-roll-call-v2') {
    throw new Error(`Taxonomy/replay parser mismatch: ${String(taxonomy.metadata.candidateParser)}`);
  }
  if (taxonomy.metadata.outcomeUse !== 'none' || taxonomy.metadata.probabilityAction !== 'none') {
    throw new Error('Actionability taxonomy must remain outcome-blind and probability-inert');
  }
  if (taxonomy.summary.observations !== replay.input.candidateObservations) {
    throw new Error('Taxonomy/replay candidate observation count mismatch');
  }
  if (taxonomy.input.candidateObservations !== replay.input.candidateObservations) {
    throw new Error('Taxonomy input does not match replay candidate lineage');
  }
  if (taxonomy.summary.currentTargetObservations !== replay.scenarios['current-targets'].candidateObservations) {
    throw new Error('Current-target candidate count does not match frozen taxonomy');
  }
  if (taxonomy.summary.candidateTargetObservations !== replay.scenarios['need-only-targets'].candidateObservations) {
    throw new Error('Need-only candidate count does not match frozen taxonomy');
  }
  if (replay.scenarios['discovery-all'].candidateObservations !== taxonomy.summary.observations) {
    throw new Error('Discovery-all candidate count does not match frozen taxonomy');
  }
  const invalidObservations = taxonomy.observations.filter(
    (observation) => observation.mechanicallyActionable !== false || observation.finalPassageInference !== 'none',
  );
  const invalidPairs = taxonomy.pairs.filter(
    (pair) => pair.mechanicallyActionable !== false || pair.finalPassageInference !== 'none',
  );
  if (invalidObservations.length > 0 || invalidPairs.length > 0) {
    throw new Error('Frozen taxonomy contains mechanically actionable final-passage evidence');
  }

  const quickScores = HISTORICAL_DEEP_EXPANSION_ACTIONABILITY_SCENARIOS.map((name) =>
    requireProbabilityScore(replay.scenarios[name]));
  if (!quickScores.every((score) => sameProbabilityScore(score, quickScores[0]))) {
    throw new Error('Quick baseline changed across legacy replay scenarios');
  }
}

function gatedScenario(
  name: HistoricalDeepExpansionActionabilityScenarioName,
  replay: HistoricalDeepExpansionImpactReplayV2,
): HistoricalDeepExpansionActionabilityAuditScenario {
  const scenario = replay.scenarios[name];
  const quick = requireProbabilityScore(scenario);
  return {
    name,
    requestedTargets: scenario.requestedTargets,
    legacy: {
      candidateObservations: scenario.candidateObservations,
      evidenceItems: scenario.evidenceItems,
      appliedEvidenceItems: scenario.appliedEvidenceItems,
      excludedEvidenceItems: scenario.excludedEvidenceItems,
      changedMembers: scenario.changedMembers,
      correctedClassifications: scenario.correctedClassifications,
      harmedClassifications: scenario.harmedClassifications,
      classificationFlips: scenario.classificationFlips,
      delta: requireDelta(scenario),
    },
    gated: {
      blockedCandidateObservations: scenario.candidateObservations,
      actionableCandidateObservations: 0,
      evidenceItems: 0,
      appliedEvidenceItems: 0,
      changedMembers: 0,
      correctedClassifications: 0,
      harmedClassifications: 0,
      classificationFlips: 0,
      quick: { ...quick },
      deep: { ...quick },
      delta: {
        brier: 0,
        logLoss: 0,
        expectedCalibrationError: 0,
        accuracy: 0,
      },
      movement: {
        changed: 0,
        unchanged: quick.observations,
        improved: 0,
        worsened: 0,
        meanAbsoluteMovement: 0,
        meanSignedMovement: 0,
      },
    },
  };
}

export function auditHistoricalDeepExpansionActionability(
  replay: HistoricalDeepExpansionImpactReplayV2,
  taxonomy: HistoricalDeepProceduralMechanicsArtifact,
  generatedAt = new Date().toISOString(),
): HistoricalDeepExpansionActionabilityAudit {
  validateInputs(replay, taxonomy);
  const scenarios = Object.fromEntries(
    HISTORICAL_DEEP_EXPANSION_ACTIONABILITY_SCENARIOS.map((name) => [name, gatedScenario(name, replay)]),
  ) as Record<HistoricalDeepExpansionActionabilityScenarioName, HistoricalDeepExpansionActionabilityAuditScenario>;

  return {
    schemaVersion: HISTORICAL_DEEP_EXPANSION_ACTIONABILITY_AUDIT_SCHEMA,
    generatedAt,
    purpose: 'evaluation-only safety audit that reapplies the later frozen, outcome-blind procedural-mechanics actionability boundary to the earlier parser-v2 development replay; because every frozen procedural observation is explicitly non-actionable for final-passage prediction, no candidate may become an evidence item and Deep must equal Quick in every gated scenario',
    metadata: {
      gatePolicy: 'frozen-mechanics-actionability-v1',
      taxonomyPolicy: 'mn-house-procedural-mechanics-v1',
      candidateParser: 'deterministic-house-committee-roll-call-v2',
      impactVersion: replay.metadata.impactVersion,
      taxonomyOutcomeUse: 'none',
      taxonomyProbabilityAction: 'none',
      downstreamOutcomeUse: replay.metadata.outcomeUse,
      interpretation: 'The legacy replay is retained unchanged for reproducibility. This audit does not reinterpret the post-outcome #167 descriptive score as an actionability decision. It applies only the outcome-blind #166 taxonomy: mechanicallyActionable=false blocks evidence conversion before evidenceImpactPolicy/applyEvidenceSignals, so all probability deltas are exactly zero until a separately frozen outcome-blind source/mechanic policy marks evidence actionable.',
    },
    input: {
      candidateObservations: replay.input.candidateObservations,
      taxonomyObservations: taxonomy.summary.observations,
      taxonomyMemberEventPairs: taxonomy.summary.memberEventPairs,
      decisiveMemberOutcomes: replay.input.decisiveMemberOutcomes,
    },
    summary: {
      mechanicallyActionableObservations: 0,
      blockedObservations: taxonomy.summary.observations,
      legacyScenarioAppliedEvidenceItems: Object.fromEntries(
        HISTORICAL_DEEP_EXPANSION_ACTIONABILITY_SCENARIOS.map((name) => [name, scenarios[name].legacy.appliedEvidenceItems]),
      ) as Record<HistoricalDeepExpansionActionabilityScenarioName, number>,
      gatedScenarioAppliedEvidenceItems: Object.fromEntries(
        HISTORICAL_DEEP_EXPANSION_ACTIONABILITY_SCENARIOS.map((name) => [name, 0]),
      ) as Record<HistoricalDeepExpansionActionabilityScenarioName, 0>,
      productionChange: false,
    },
    scenarios,
  };
}
