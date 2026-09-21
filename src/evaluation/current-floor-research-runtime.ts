import type { Pool } from 'pg';
import {
  applyRiskBandUncertainty,
  buildResearchAnalogueSupport,
  fitRiskBandUncertainty,
  prepareCurrentFloorResearch,
  runCurrentFloorResearchReplay,
  scoreResearchReplay,
  sliceResearchRows,
  CURRENT_FLOOR_RESEARCH_VERSION,
  type CurrentFloorResearchDataset,
  type CurrentFloorResearchModelConfig,
  type ResearchAnalogueConfig,
  type ResearchReplayRow,
} from './current-floor-research';
import type { QuickReplayAnalogueSupport } from './historical-quick-replay';
import { loadHistoricalQuickReplayDataset } from './historical-quick-replay-dataset';

const TRAIN_SESSION = '2021-2022';
const VALIDATION_SESSION = '2023-2024';
const TEST_SESSION = '2025-2026';

const BASELINE_ANALOGUE: ResearchAnalogueConfig = {
  id: 'analogue-current',
  limit: 10,
  prefilterLimit: 30,
  halfLifeDays: 730,
  minimumSimilarity: 0.18,
};

const ANALOGUE_CANDIDATES: Array<ResearchAnalogueConfig | null> = [
  null,
  BASELINE_ANALOGUE,
  { id: 'analogue-strict-365', limit: 6, prefilterLimit: 24, halfLifeDays: 365, minimumSimilarity: 0.28 },
  { id: 'analogue-focused-365', limit: 4, prefilterLimit: 18, halfLifeDays: 365, minimumSimilarity: 0.35 },
  { id: 'analogue-strict-730', limit: 6, prefilterLimit: 24, halfLifeDays: 730, minimumSimilarity: 0.28 },
];

export interface CurrentFloorResearchRuntimeOptions {
  codeSha?: string | null;
  databaseSource?: string | null;
}

async function loadDataset(pool: Pool): Promise<CurrentFloorResearchDataset> {
  const dataset = await loadHistoricalQuickReplayDataset(pool);
  return {
    events: dataset.events,
    versionsByBill: dataset.versionsByBill,
    memberships: dataset.memberships,
    historicalVotes: dataset.historicalVotes,
  };
}

function compactScore(rows: readonly ResearchReplayRow[], session: string) {
  const scored = scoreResearchReplay(sliceResearchRows(rows, session));
  return {
    memberBrier: scored.score.overall.memberBrier,
    memberLogLoss: scored.score.overall.memberLogLoss,
    memberEce: scored.score.overall.memberExpectedCalibrationError,
    memberAccuracy: scored.score.overall.memberAccuracy,
    chamberYesMae: scored.score.overall.chamberMeanAbsoluteYesError,
    passageBrier: scored.score.overall.passageBrier,
    passageAccuracy: scored.score.overall.passageAccuracy,
    intervalCoverage: scored.intervalCoverage,
    replayableEvents: scored.score.overall.replayableEvents,
    memberObservations: scored.score.overall.memberObservations,
    meanParticipationProbability: scored.meanParticipationProbability,
    meanRiskScore: scored.meanRiskScore,
  };
}

type CompactScore = ReturnType<typeof compactScore>;

function compare(a: CompactScore, b: CompactScore) {
  return {
    memberBrier: a.memberBrier - b.memberBrier,
    memberLogLoss: a.memberLogLoss - b.memberLogLoss,
    memberEce: a.memberEce - b.memberEce,
    memberAccuracy: a.memberAccuracy - b.memberAccuracy,
    chamberYesMae: a.chamberYesMae - b.chamberYesMae,
    passageBrier: a.passageBrier - b.passageBrier,
    intervalCoverageDistance: Math.abs(a.intervalCoverage - 0.8) - Math.abs(b.intervalCoverage - 0.8),
  };
}

function choose<T>(candidates: readonly T[], score: (candidate: T) => readonly number[]): T {
  if (candidates.length === 0) throw new Error('No candidates to choose from');
  return [...candidates].sort((left, right) => {
    const a = score(left);
    const b = score(right);
    for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
      const delta = (a[index] ?? 0) - (b[index] ?? 0);
      if (Math.abs(delta) > 1e-12) return delta;
    }
    return 0;
  })[0];
}

function scoresFor(
  dataset: CurrentFloorResearchDataset,
  prepared: ReturnType<typeof prepareCurrentFloorResearch>,
  config: CurrentFloorResearchModelConfig,
  support: ReadonlyMap<string, QuickReplayAnalogueSupport>,
) {
  const rows = runCurrentFloorResearchReplay(dataset, prepared, config, support);
  return {
    config,
    validation: compactScore(rows, VALIDATION_SESSION),
    test: compactScore(rows, TEST_SESSION),
  };
}

export async function evaluateCurrentFloorResearchRuntime(
  pool: Pool,
  options: CurrentFloorResearchRuntimeOptions = {},
) {
  const dataset = await loadDataset(pool);
  const baselineAnalogueSupport = buildResearchAnalogueSupport(dataset, BASELINE_ANALOGUE);
  const prepared = prepareCurrentFloorResearch(dataset, baselineAnalogueSupport);
  const emptyAnalogueSupport = new Map<string, QuickReplayAnalogueSupport>();

  const baselineConfig: CurrentFloorResearchModelConfig = {
    id: 'serving-decay180-control',
    analogue: BASELINE_ANALOGUE,
  };
  const baselineRows = runCurrentFloorResearchReplay(dataset, prepared, baselineConfig, baselineAnalogueSupport);
  const baselineValidation = compactScore(baselineRows, VALIDATION_SESSION);
  const baselineTest = compactScore(baselineRows, TEST_SESSION);

  const issueRuns = [3, 6, 12].flatMap((priorStrength) => [4, 8, 12].map((maximumWeight) => {
    const config: CurrentFloorResearchModelConfig = {
      id: `issue-p${priorStrength}-w${maximumWeight}`,
      analogue: BASELINE_ANALOGUE,
      issue: { priorStrength, maximumWeight },
    };
    return scoresFor(dataset, prepared, config, baselineAnalogueSupport);
  }));
  const selectedIssue = choose(issueRuns, (row) => [
    row.validation.memberBrier,
    row.validation.memberLogLoss,
    row.validation.chamberYesMae,
  ]);

  const participationRuns = [5, 15, 30].map((memberPriorStrength) => {
    const config: CurrentFloorResearchModelConfig = {
      id: `participation-m${memberPriorStrength}`,
      analogue: BASELINE_ANALOGUE,
      participation: { fallback: 0.98, partyPriorStrength: 25, memberPriorStrength },
    };
    return scoresFor(dataset, prepared, config, baselineAnalogueSupport);
  });
  const selectedParticipation = choose(participationRuns, (row) => [
    row.validation.chamberYesMae,
    row.validation.passageBrier,
  ]);

  const processRuns = [1, 2, 4].map((maximumWeight) => {
    const config: CurrentFloorResearchModelConfig = {
      id: `process-w${maximumWeight}`,
      analogue: BASELINE_ANALOGUE,
      process: { priorStrength: 12, maximumWeight },
    };
    return scoresFor(dataset, prepared, config, baselineAnalogueSupport);
  });
  const selectedProcess = choose(processRuns, (row) => [
    row.validation.memberBrier,
    row.validation.chamberYesMae,
    row.validation.passageBrier,
  ]);

  const analogueRuns = ANALOGUE_CANDIDATES.map((analogue) => {
    const config: CurrentFloorResearchModelConfig = { id: analogue?.id ?? 'analogue-none', analogue };
    if (!analogue) return scoresFor(dataset, prepared, config, emptyAnalogueSupport);
    const support = analogue.id === BASELINE_ANALOGUE.id
      ? baselineAnalogueSupport
      : buildResearchAnalogueSupport(dataset, analogue);
    return scoresFor(dataset, prepared, config, support);
  });
  const selectedAnalogue = choose(analogueRuns, (row) => [
    row.validation.memberBrier,
    row.validation.memberLogLoss,
    row.validation.chamberYesMae,
  ]);
  const noAnalogueRun = analogueRuns.find((row) => row.config.analogue === null) ?? null;
  const selectedAnalogueSupport = !selectedAnalogue.config.analogue
    ? emptyAnalogueSupport
    : selectedAnalogue.config.analogue.id === BASELINE_ANALOGUE.id
      ? baselineAnalogueSupport
      : buildResearchAnalogueSupport(dataset, selectedAnalogue.config.analogue);

  const combinedConfig: CurrentFloorResearchModelConfig = {
    id: 'combined-v3-candidate',
    analogue: selectedAnalogue.config.analogue,
    issue: selectedIssue.config.issue,
    participation: selectedParticipation.config.participation,
    process: selectedProcess.config.process,
  };
  const combinedRows = runCurrentFloorResearchReplay(dataset, prepared, combinedConfig, selectedAnalogueSupport);
  const combinedValidation = compactScore(combinedRows, VALIDATION_SESSION);
  const combinedTest = compactScore(combinedRows, TEST_SESSION);

  const uncertaintyRuns = [2, 3, 4].map((bandCount) => {
    const fit = fitRiskBandUncertainty(sliceResearchRows(combinedRows, TRAIN_SESSION), bandCount);
    const rows = applyRiskBandUncertainty(combinedRows, fit);
    return {
      bandCount,
      fit,
      validation: compactScore(rows, VALIDATION_SESSION),
      test: compactScore(rows, TEST_SESSION),
    };
  });
  const selectedUncertainty = choose(uncertaintyRuns, (row) => [
    Math.abs(row.validation.intervalCoverage - 0.8),
    row.validation.passageBrier,
  ]);

  const finalRows = applyRiskBandUncertainty(combinedRows, selectedUncertainty.fit);
  const finalValidation = compactScore(finalRows, VALIDATION_SESSION);
  const finalTest = compactScore(finalRows, TEST_SESSION);
  const combinedVsBaselineValidation = compare(combinedValidation, baselineValidation);
  const combinedVsBaselineTest = compare(combinedTest, baselineTest);
  const finalVsBaselineValidation = compare(finalValidation, baselineValidation);
  const finalVsBaselineTest = compare(finalTest, baselineTest);

  const qualifiesForProspectiveShadow = combinedVsBaselineValidation.memberBrier <= -0.0001
    && combinedVsBaselineValidation.chamberYesMae <= 0.5
    && combinedVsBaselineValidation.passageBrier <= 0.005
    && combinedVsBaselineTest.memberBrier <= 0.002
    && combinedVsBaselineTest.chamberYesMae <= 1.5
    && combinedVsBaselineTest.passageBrier <= 0.01;
  const uncertaintyQualifiesForProspectiveShadow = finalVsBaselineValidation.intervalCoverageDistance < 0
    && finalVsBaselineValidation.passageBrier <= 0.005
    && finalVsBaselineTest.passageBrier <= 0.01;

  return {
    metadata: {
      version: CURRENT_FLOOR_RESEARCH_VERSION,
      generatedAt: new Date().toISOString(),
      codeSha: options.codeSha ?? null,
      databaseSource: options.databaseSource ?? null,
      train: TRAIN_SESSION,
      validation: VALIDATION_SESSION,
      test: TEST_SESSION,
      productionAction: 'none',
      interpretation: 'Retrospective, leakage-safe candidate screen over sessions already exposed to prior model work. It can nominate a prospective shadow but cannot by itself promote a serving model.',
    },
    data: {
      events: dataset.events.length,
      versions: [...dataset.versionsByBill.values()].reduce((sum, rows) => sum + rows.length, 0),
      memberships: dataset.memberships.length,
      decisiveVotes: dataset.historicalVotes.length,
      fixedResearchTargets: prepared.targets.length,
    },
    baseline: {
      config: baselineConfig,
      validation: baselineValidation,
      test: baselineTest,
    },
    issueConditioning: {
      selected: selectedIssue,
      grid: issueRuns,
    },
    participation: {
      selected: selectedParticipation,
      grid: participationRuns,
    },
    processContext: {
      selected: selectedProcess,
      grid: processRuns,
    },
    analogues: {
      noAnalogueAblation: noAnalogueRun,
      selected: selectedAnalogue,
      grid: analogueRuns,
    },
    combined: {
      config: combinedConfig,
      validation: combinedValidation,
      test: combinedTest,
      deltaVsBaseline: { validation: combinedVsBaselineValidation, test: combinedVsBaselineTest },
    },
    eventSpecificUncertainty: {
      selected: selectedUncertainty,
      grid: uncertaintyRuns,
      deltaVsBaseline: { validation: finalVsBaselineValidation, test: finalVsBaselineTest },
    },
    decision: {
      productionAction: 'none',
      combinedProspectiveShadow: qualifiesForProspectiveShadow,
      uncertaintyProspectiveShadow: uncertaintyQualifiesForProspectiveShadow,
      reason: qualifiesForProspectiveShadow || uncertaintyQualifiesForProspectiveShadow
        ? 'At least one candidate cleared the frozen retrospective shadow guardrails. Capture it prospectively before any serving promotion.'
        : 'No candidate cleared the frozen retrospective shadow guardrails. Keep the serving model unchanged.',
    },
    final: {
      validation: finalValidation,
      test: finalTest,
    },
  };
}
