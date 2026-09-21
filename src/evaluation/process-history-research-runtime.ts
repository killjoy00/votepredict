import type { Pool } from 'pg';
import { simulateChamber } from '../forecasting/chamber';
import { ordinaryMinnesotaPassageRule } from '../forecasting/minnesota-rules';
import { REVISOR_PROCESS_PARSER_VERSION, type RevisorProcessStageKind } from '../sources/minnesota/revisor-process';
import {
  buildResearchAnalogueSupport,
  prepareCurrentFloorResearch,
  runCurrentFloorResearchReplay,
  scoreResearchReplay,
  sliceResearchRows,
  type CurrentFloorResearchDataset,
  type CurrentFloorResearchModelConfig,
  type ResearchAnalogueConfig,
  type ResearchReplayRow,
} from './current-floor-research';
import type { QuickReplayEvent } from './historical-quick-replay';
import { loadHistoricalQuickReplayDataset } from './historical-quick-replay-dataset';

export const PROCESS_HISTORY_RESEARCH_VERSION = 'process-history-chamber-v2' as const;
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

const PROCESS_STAGE_KINDS: RevisorProcessStageKind[] = [
  'committee_referral',
  'committee_report',
  'second_reading',
  'floor_scheduled',
  'amendment_activity',
  'author_added',
  'rules_referral',
  'cross_chamber_received',
  'companion_reference',
];

interface ProcessStageEvent {
  billId: string;
  chamberId: string;
  stageKind: RevisorProcessStageKind;
  occurredOn: string;
}

interface ProcessContextConfig {
  id: string;
  priorEvents: number;
  blendWeight: number;
  minimumFeatureEvents: number;
}

interface RunningRate {
  sum: number;
  count: number;
}

interface ChamberProcessState {
  global: RunningRate;
  features: Map<string, RunningRate>;
}

interface LoadedProcessDataset {
  dataset: CurrentFloorResearchDataset;
  eventById: Map<string, QuickReplayEvent>;
  processByBillChamber: Map<string, ProcessStageEvent[]>;
  targetBills: number;
  parsedBills: number;
  processStageEvents: number;
}

export interface ProcessHistoryResearchRuntimeOptions {
  codeSha?: string | null;
  databaseSource?: string | null;
}

async function loadDataset(pool: Pool): Promise<LoadedProcessDataset> {
  const historical = await loadHistoricalQuickReplayDataset(pool);
  const events = historical.events;
  const versionsByBill = historical.versionsByBill;
  const historicalVotes = historical.historicalVotes;
  const memberships = historical.memberships;
  const eventById = new Map(events.map((event) => [event.voteEventId, event]));

  const processResult = await pool.query<{
    bill_id: string;
    chamber_id: string;
    stage_kind: RevisorProcessStageKind;
    occurred_on: string;
  }>(`
    SELECT se.bill_id::text,
           se.chamber_id::text,
           se.stage_kind,
           se.occurred_at::date::text AS occurred_on
      FROM legislative_stage_events se
     WHERE se.metadata ->> 'parserVersion' = $1
       AND se.stage_kind = ANY($2::text[])
       AND se.chamber_id IS NOT NULL
     ORDER BY se.occurred_at, se.id`, [REVISOR_PROCESS_PARSER_VERSION, PROCESS_STAGE_KINDS]);
  const processByBillChamber = new Map<string, ProcessStageEvent[]>();
  for (const row of processResult.rows) {
    const key = `${row.bill_id}:${row.chamber_id}`;
    const rows = processByBillChamber.get(key) ?? [];
    rows.push({ billId: row.bill_id, chamberId: row.chamber_id, stageKind: row.stage_kind, occurredOn: row.occurred_on });
    processByBillChamber.set(key, rows);
  }

  const coverageResult = await pool.query<{ target_bills: string; parsed_bills: string }>(`
    WITH target AS (
      SELECT DISTINCT b.id
        FROM bills b
        JOIN vote_events ve ON ve.bill_id = b.id AND ve.is_passage = true
        JOIN legislative_sessions s ON s.id = b.session_id
        JOIN jurisdictions j ON j.id = s.jurisdiction_id AND j.slug = 'us-mn'
       WHERE s.slug IN ($2, $3, $4)
    )
    SELECT (SELECT count(*) FROM target)::text AS target_bills,
           (SELECT count(*) FROM bills b JOIN target t ON t.id = b.id
             WHERE b.metadata #>> '{revisorProcessHistory,parserVersion}' = $1)::text AS parsed_bills`, [
    REVISOR_PROCESS_PARSER_VERSION, TRAIN_SESSION, VALIDATION_SESSION, TEST_SESSION,
  ]);

  return {
    dataset: { events, versionsByBill, memberships, historicalVotes },
    eventById,
    processByBillChamber,
    targetBills: Number(coverageResult.rows[0]?.target_bills ?? 0),
    parsedBills: Number(coverageResult.rows[0]?.parsed_bills ?? 0),
    processStageEvents: processResult.rowCount ?? 0,
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
  };
}

type CompactScore = ReturnType<typeof compactScore>;

function delta(candidate: CompactScore, baseline: CompactScore) {
  return {
    memberBrier: candidate.memberBrier - baseline.memberBrier,
    memberLogLoss: candidate.memberLogLoss - baseline.memberLogLoss,
    memberEce: candidate.memberEce - baseline.memberEce,
    memberAccuracy: candidate.memberAccuracy - baseline.memberAccuracy,
    chamberYesMae: candidate.chamberYesMae - baseline.chamberYesMae,
    passageBrier: candidate.passageBrier - baseline.passageBrier,
    intervalCoverage: candidate.intervalCoverage - baseline.intervalCoverage,
  };
}

function countBand(value: number): string {
  return value === 0 ? '0' : value === 1 ? '1' : '2+';
}

function processFeatureKeys(event: QuickReplayEvent, rows: readonly ProcessStageEvent[]): string[] {
  const available = rows.filter((row) => row.occurredOn < event.occurredOn);
  const counts = new Map<RevisorProcessStageKind, number>();
  for (const row of available) counts.set(row.stageKind, (counts.get(row.stageKind) ?? 0) + 1);
  const get = (kind: RevisorProcessStageKind) => counts.get(kind) ?? 0;
  return [
    `referrals:${countBand(get('committee_referral'))}`,
    `committee-report:${get('committee_report') > 0 ? 'yes' : 'no'}`,
    `second-reading:${get('second_reading') > 0 ? 'yes' : 'no'}`,
    `floor-scheduled:${get('floor_scheduled') > 0 ? 'yes' : 'no'}`,
    `amendment:${get('amendment_activity') > 0 ? 'yes' : 'no'}`,
    `author-added:${get('author_added') > 0 ? 'yes' : 'no'}`,
    `rules-referral:${get('rules_referral') > 0 ? 'yes' : 'no'}`,
    `cross-chamber:${get('cross_chamber_received') > 0 ? 'yes' : 'no'}`,
    `companion-reference:${get('companion_reference') > 0 ? 'yes' : 'no'}`,
    `process-events:${available.length === 0 ? '0' : available.length <= 3 ? '1-3' : available.length <= 7 ? '4-7' : '8+'}`,
  ];
}

function rate(state: RunningRate): number | null {
  return state.count > 0 ? state.sum / state.count : null;
}

function contextualRate(
  state: ChamberProcessState,
  keys: readonly string[],
  config: ProcessContextConfig,
): number | null {
  const globalRate = rate(state.global);
  if (globalRate === null) return null;
  let weighted = 0;
  let weight = 0;
  for (const key of keys) {
    const feature = state.features.get(key);
    if (!feature || feature.count < config.minimumFeatureEvents) continue;
    const shrunk = (feature.sum + config.priorEvents * globalRate) / (feature.count + config.priorEvents);
    const featureWeight = Math.log1p(feature.count);
    weighted += shrunk * featureWeight;
    weight += featureWeight;
  }
  return weight > 0 ? weighted / weight : null;
}

function applyProcessContext(
  baselineRows: readonly ResearchReplayRow[],
  eventById: ReadonlyMap<string, QuickReplayEvent>,
  processByBillChamber: ReadonlyMap<string, readonly ProcessStageEvent[]>,
  config: ProcessContextConfig,
) {
  const rows = baselineRows.map((row) => ({ ...row, result: { ...row.result } }));
  const states = new Map<string, ChamberProcessState>();
  let contextualPredictions = 0;
  let rowsWithProcessHistory = 0;
  const dates = [...new Set(rows.map((row) => row.result.occurredOn))].sort();

  for (const occurredOn of dates) {
    const sameDay = rows.filter((row) => row.result.occurredOn === occurredOn);
    for (const row of sameDay) {
      const event = eventById.get(row.result.voteEventId);
      if (!event || row.result.status !== 'replayable' || row.chamberProbabilities.length === 0) continue;
      const processRows = processByBillChamber.get(`${event.billId}:${event.chamberId}`) ?? [];
      if (processRows.some((stage) => stage.occurredOn < event.occurredOn)) rowsWithProcessHistory += 1;
      const keys = processFeatureKeys(event, processRows);
      const state = states.get(event.chamberId) ?? { global: { sum: 0, count: 0 }, features: new Map<string, RunningRate>() };
      states.set(event.chamberId, state);
      const globalRate = rate(state.global);
      const contextRate = contextualRate(state, keys, config);
      if (globalRate === null || contextRate === null) continue;
      const shift = config.blendWeight * (contextRate - globalRate);
      const probabilities = row.chamberProbabilities.map((probability) => Math.min(0.995, Math.max(0.005, probability + shift)));
      const chamber = simulateChamber(probabilities, ordinaryMinnesotaPassageRule(event.chamber));
      row.chamberProbabilities = probabilities;
      row.independentVariance = probabilities.reduce((sum, probability) => sum + probability * (1 - probability), 0);
      row.result.passageProbability = chamber.passageProbability;
      row.result.expectedYes = chamber.expectedYes;
      row.result.yesLow = chamber.yesLow;
      row.result.yesHigh = chamber.yesHigh;
      contextualPredictions += 1;
    }

    // Date precision is only day-level. Learn from an outcome only after every target
    // on that date has been predicted so same-day outcomes cannot leak into one another.
    for (const row of sameDay) {
      const event = eventById.get(row.result.voteEventId);
      if (!event || row.result.status !== 'replayable' || row.result.activeMembers <= 0) continue;
      const actualShare = row.result.actualYes / row.result.activeMembers;
      const processRows = processByBillChamber.get(`${event.billId}:${event.chamberId}`) ?? [];
      const keys = processFeatureKeys(event, processRows);
      const state = states.get(event.chamberId) ?? { global: { sum: 0, count: 0 }, features: new Map<string, RunningRate>() };
      states.set(event.chamberId, state);
      state.global.sum += actualShare;
      state.global.count += 1;
      for (const key of keys) {
        const feature = state.features.get(key) ?? { sum: 0, count: 0 };
        feature.sum += actualShare;
        feature.count += 1;
        state.features.set(key, feature);
      }
    }
  }
  return { rows, contextualPredictions, rowsWithProcessHistory };
}

function choose<T>(candidates: readonly T[], score: (candidate: T) => readonly number[]): T {
  if (candidates.length === 0) throw new Error('No process candidates');
  return [...candidates].sort((left, right) => {
    const a = score(left);
    const b = score(right);
    for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
      const difference = (a[index] ?? 0) - (b[index] ?? 0);
      if (Math.abs(difference) > 1e-12) return difference;
    }
    return 0;
  })[0];
}

export async function evaluateProcessHistoryResearchRuntime(
  pool: Pool,
  options: ProcessHistoryResearchRuntimeOptions = {},
) {
  const loaded = await loadDataset(pool);
  const support = buildResearchAnalogueSupport(loaded.dataset, BASELINE_ANALOGUE);
  const prepared = prepareCurrentFloorResearch(loaded.dataset, support);
  const baselineConfig: CurrentFloorResearchModelConfig = {
    id: 'serving-decay180-control',
    analogue: BASELINE_ANALOGUE,
  };
  const baselineRows = runCurrentFloorResearchReplay(loaded.dataset, prepared, baselineConfig, support);
  const baselineValidation = compactScore(baselineRows, VALIDATION_SESSION);
  const baselineTest = compactScore(baselineRows, TEST_SESSION);

  const configs: ProcessContextConfig[] = [6, 12, 24].flatMap((priorEvents) =>
    [0.15, 0.3, 0.45].map((blendWeight) => ({
      id: `process-history-p${priorEvents}-b${Math.round(blendWeight * 100)}`,
      priorEvents,
      blendWeight,
      minimumFeatureEvents: 5,
    })),
  );
  const runs = configs.map((config) => {
    const applied = applyProcessContext(baselineRows, loaded.eventById, loaded.processByBillChamber, config);
    return {
      config,
      validation: compactScore(applied.rows, VALIDATION_SESSION),
      test: compactScore(applied.rows, TEST_SESSION),
      contextualPredictions: applied.contextualPredictions,
      rowsWithProcessHistory: applied.rowsWithProcessHistory,
    };
  });
  const selected = choose(runs, (run) => [run.validation.chamberYesMae, run.validation.passageBrier]);
  const validationDelta = delta(selected.validation, baselineValidation);
  const testDelta = delta(selected.test, baselineTest);
  const processCoverage = loaded.targetBills > 0 ? loaded.parsedBills / loaded.targetBills : 0;

  const qualifiesForProspectiveShadow = processCoverage >= 0.95
    && validationDelta.chamberYesMae <= -0.25
    && validationDelta.passageBrier <= -0.0001
    && testDelta.chamberYesMae <= 1
    && testDelta.passageBrier <= 0.005;

  return {
    metadata: {
      version: PROCESS_HISTORY_RESEARCH_VERSION,
      generatedAt: new Date().toISOString(),
      codeSha: options.codeSha ?? null,
      databaseSource: options.databaseSource ?? null,
      train: TRAIN_SESSION,
      validation: VALIDATION_SESSION,
      test: TEST_SESSION,
      parserVersion: REVISOR_PROCESS_PARSER_VERSION,
      productionAction: 'none',
      interpretation: 'Frozen chamber-level process-context experiment. Dated official process events strictly before the target vote date may adjust chamber simulation; individual member probabilities remain unchanged.',
    },
    data: {
      events: loaded.dataset.events.length,
      targetBills: loaded.targetBills,
      parsedBills: loaded.parsedBills,
      processCoverage,
      processStageEvents: loaded.processStageEvents,
      fixedResearchTargets: prepared.targets.length,
    },
    baseline: { config: baselineConfig, validation: baselineValidation, test: baselineTest },
    processContext: {
      selected,
      grid: runs,
      deltaVsBaseline: { validation: validationDelta, test: testDelta },
    },
    decision: {
      productionAction: 'none',
      prospectiveShadow: qualifiesForProspectiveShadow,
      frozenGate: {
        minimumProcessCoverage: 0.95,
        validationChamberYesMaeDeltaMax: -0.25,
        validationPassageBrierDeltaMax: -0.0001,
        testChamberYesMaeDeltaMax: 1,
        testPassageBrierDeltaMax: 0.005,
      },
      reason: qualifiesForProspectiveShadow
        ? 'The richer dated process model cleared the frozen retrospective shadow gate. Capture it prospectively before any serving promotion.'
        : 'The richer dated process model did not clear the frozen retrospective shadow gate. Keep the serving model unchanged.',
    },
  };
}
