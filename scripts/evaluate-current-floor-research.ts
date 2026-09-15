import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Pool } from 'pg';
import {
  BILL_FEATURE_SCHEMA_VERSION,
  DETERMINISTIC_EXTRACTOR_VERSION,
  type DeterministicBillFeatures,
} from '../src/features/bills.js';
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
} from '../src/evaluation/current-floor-research.js';
import type {
  QuickReplayEvent,
  QuickReplayMembership,
  QuickReplayVersion,
  QuickReplayVote,
} from '../src/evaluation/historical-quick-replay.js';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import { requireEvaluationDatabaseConnection } from '../src/operations/evaluation-database.js';

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

function toNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function loadProductionEnvironmentIfPresent(): void {
  const path = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!path) return;
  const parsed = parseRuntimeEnvironment(readFileSync(path, 'utf8'));
  for (const key of ['DATABASE_URL', 'POSTGRES_URL', 'DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING'] as const) {
    const value = parsed[key];
    if (value && !process.env[key]) process.env[key] = value;
  }
}

async function loadDataset(pool: Pool): Promise<CurrentFloorResearchDataset> {
  const versionResult = await pool.query<{
    id: string;
    bill_id: string;
    version_key: string;
    published_at: string;
    created_at: string;
    raw_text: string;
    features: DeterministicBillFeatures | null;
  }>(`
    SELECT bv.id,
           bv.bill_id,
           bv.version_key,
           to_char(bv.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS published_at,
           to_char(bv.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
           bv.raw_text,
           bfs.features
      FROM bill_versions bv
      LEFT JOIN bill_feature_sets bfs
        ON bfs.bill_version_id = bv.id
       AND bfs.feature_schema_version = $1
       AND bfs.extractor_version = $2
     WHERE bv.published_at IS NOT NULL
       AND bv.raw_text IS NOT NULL
       AND length(bv.raw_text) >= 100`, [BILL_FEATURE_SCHEMA_VERSION, DETERMINISTIC_EXTRACTOR_VERSION]);

  const versionsByBill = new Map<string, QuickReplayVersion[]>();
  for (const row of versionResult.rows) {
    const rows = versionsByBill.get(row.bill_id) ?? [];
    rows.push({
      id: row.id,
      billId: row.bill_id,
      publishedAt: row.published_at,
      createdAt: row.created_at,
      rawText: row.raw_text,
      features: row.features ?? undefined,
    });
    versionsByBill.set(row.bill_id, rows);
  }

  const eventResult = await pool.query<{
    vote_event_id: string;
    bill_id: string;
    identifier: string;
    title: string;
    session_id: string;
    session_slug: string;
    chamber_id: string;
    chamber_slug: string;
    occurred_on: string;
    yea_count: number | null;
    nay_count: number | null;
    passed: boolean | null;
    companion_identifier: string | null;
  }>(`
    SELECT ve.id AS vote_event_id,
           b.id AS bill_id,
           b.identifier,
           b.title,
           s.id AS session_id,
           s.slug AS session_slug,
           c.id AS chamber_id,
           c.slug AS chamber_slug,
           ve.occurred_on::text,
           ve.yea_count,
           ve.nay_count,
           ve.passed,
           b.metadata #>> '{revisor,companionIdentifier}' AS companion_identifier
      FROM vote_events ve
      JOIN bills b ON b.id = ve.bill_id
      JOIN legislative_sessions s ON s.id = ve.session_id
      JOIN chambers c ON c.id = ve.chamber_id
      JOIN jurisdictions j ON j.id = s.jurisdiction_id AND j.slug = 'us-mn'
     WHERE ve.is_passage = true
       AND ve.bill_id IS NOT NULL
       AND ve.occurred_on < CURRENT_DATE
     ORDER BY ve.occurred_on, ve.id`);

  const events: QuickReplayEvent[] = eventResult.rows.map((row) => ({
    voteEventId: row.vote_event_id,
    billId: row.bill_id,
    identifier: row.identifier,
    title: row.title,
    sessionId: row.session_id,
    session: row.session_slug,
    chamberId: row.chamber_id,
    chamber: row.chamber_slug,
    occurredOn: row.occurred_on,
    yeaCount: toNumber(row.yea_count),
    nayCount: toNumber(row.nay_count),
    passed: row.passed,
    companionIdentifier: row.companion_identifier ?? undefined,
  }));

  const voteResult = await pool.query<{
    vote_event_id: string;
    occurred_on: string;
    chamber_id: string;
    membership_id: string;
    legislator_id: string;
    party: string;
    choice: 'yea' | 'nay';
  }>(`
    SELECT mv.vote_event_id,
           ve.occurred_on::text,
           ve.chamber_id,
           mv.membership_id,
           m.legislator_id,
           COALESCE(NULLIF(btrim(m.party), ''), 'UNKNOWN') AS party,
           mv.choice
      FROM member_votes mv
      JOIN vote_events ve ON ve.id = mv.vote_event_id AND ve.is_passage = true
      JOIN memberships m ON m.id = mv.membership_id
     WHERE mv.choice IN ('yea', 'nay')
     ORDER BY ve.occurred_on, ve.id, mv.id`);

  const historicalVotes: QuickReplayVote[] = voteResult.rows.map((row) => ({
    voteEventId: row.vote_event_id,
    occurredOn: row.occurred_on,
    chamberId: row.chamber_id,
    membershipId: row.membership_id,
    legislatorId: row.legislator_id,
    party: row.party,
    choice: row.choice,
  }));

  const membershipResult = await pool.query<{
    membership_id: string;
    legislator_id: string;
    session_id: string;
    chamber_id: string;
    party: string;
    starts_on: string | null;
    ends_on: string | null;
  }>(`
    SELECT m.id AS membership_id,
           m.legislator_id,
           m.session_id,
           m.chamber_id,
           COALESCE(NULLIF(btrim(m.party), ''), 'UNKNOWN') AS party,
           m.starts_on::text,
           m.ends_on::text
      FROM memberships m
      JOIN legislative_sessions s ON s.id = m.session_id
      JOIN jurisdictions j ON j.id = s.jurisdiction_id AND j.slug = 'us-mn'`);

  const memberships: QuickReplayMembership[] = membershipResult.rows.map((row) => ({
    membershipId: row.membership_id,
    legislatorId: row.legislator_id,
    sessionId: row.session_id,
    chamberId: row.chamber_id,
    party: row.party,
    startsOn: row.starts_on ?? undefined,
    endsOn: row.ends_on ?? undefined,
  }));

  return { events, versionsByBill, memberships, historicalVotes };
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

function compare(a: ReturnType<typeof compactScore>, b: ReturnType<typeof compactScore>) {
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

async function main(): Promise<void> {
  loadProductionEnvironmentIfPresent();
  const { connectionString, source: databaseSource } = requireEvaluationDatabaseConnection();
  const pool = new Pool({ connectionString, max: 1 });
  try {
    const dataset = await loadDataset(pool);
    const baselineAnalogueSupport = buildResearchAnalogueSupport(dataset, BASELINE_ANALOGUE);
    const prepared = prepareCurrentFloorResearch(dataset, baselineAnalogueSupport);
    const analogueSupports = new Map<string, ReturnType<typeof buildResearchAnalogueSupport>>();
    analogueSupports.set(BASELINE_ANALOGUE.id, baselineAnalogueSupport);
    for (const config of ANALOGUE_CANDIDATES) {
      if (config && !analogueSupports.has(config.id)) analogueSupports.set(config.id, buildResearchAnalogueSupport(dataset, config));
    }
    const emptyAnalogueSupport = new Map();
    const supportFor = (config: ResearchAnalogueConfig | null) => config ? analogueSupports.get(config.id) ?? emptyAnalogueSupport : emptyAnalogueSupport;

    const baselineConfig: CurrentFloorResearchModelConfig = { id: 'serving-decay180-control', analogue: BASELINE_ANALOGUE };
    const baselineRows = runCurrentFloorResearchReplay(dataset, prepared, baselineConfig, baselineAnalogueSupport);
    const baselineValidation = compactScore(baselineRows, VALIDATION_SESSION);
    const baselineTest = compactScore(baselineRows, TEST_SESSION);

    const issueRuns = [3, 6, 12].flatMap((priorStrength) => [4, 8, 12].map((maximumWeight) => {
      const config: CurrentFloorResearchModelConfig = {
        id: `issue-p${priorStrength}-w${maximumWeight}`,
        analogue: BASELINE_ANALOGUE,
        issue: { priorStrength, maximumWeight },
      };
      const rows = runCurrentFloorResearchReplay(dataset, prepared, config, baselineAnalogueSupport);
      return { config, rows, validation: compactScore(rows, VALIDATION_SESSION), test: compactScore(rows, TEST_SESSION) };
    }));
    const selectedIssue = choose(issueRuns, (row) => [row.validation.memberBrier, row.validation.memberLogLoss, row.validation.chamberYesMae]);

    const participationRuns = [5, 15, 30].map((memberPriorStrength) => {
      const config: CurrentFloorResearchModelConfig = {
        id: `participation-m${memberPriorStrength}`,
        analogue: BASELINE_ANALOGUE,
        participation: { fallback: 0.98, partyPriorStrength: 25, memberPriorStrength },
      };
      const rows = runCurrentFloorResearchReplay(dataset, prepared, config, baselineAnalogueSupport);
      return { config, rows, validation: compactScore(rows, VALIDATION_SESSION), test: compactScore(rows, TEST_SESSION) };
    });
    const selectedParticipation = choose(participationRuns, (row) => [row.validation.chamberYesMae, row.validation.passageBrier]);

    const processRuns = [1, 2, 4].map((maximumWeight) => {
      const config: CurrentFloorResearchModelConfig = {
        id: `process-w${maximumWeight}`,
        analogue: BASELINE_ANALOGUE,
        process: { priorStrength: 12, maximumWeight },
      };
      const rows = runCurrentFloorResearchReplay(dataset, prepared, config, baselineAnalogueSupport);
      return { config, rows, validation: compactScore(rows, VALIDATION_SESSION), test: compactScore(rows, TEST_SESSION) };
    });
    const selectedProcess = choose(processRuns, (row) => [row.validation.memberBrier, row.validation.chamberYesMae, row.validation.passageBrier]);

    const analogueRuns = ANALOGUE_CANDIDATES.map((analogue) => {
      const config: CurrentFloorResearchModelConfig = { id: analogue?.id ?? 'analogue-none', analogue };
      const rows = runCurrentFloorResearchReplay(dataset, prepared, config, supportFor(analogue));
      return { config, rows, validation: compactScore(rows, VALIDATION_SESSION), test: compactScore(rows, TEST_SESSION) };
    });
    const selectedAnalogue = choose(analogueRuns, (row) => [row.validation.memberBrier, row.validation.memberLogLoss, row.validation.chamberYesMae]);

    const combinedConfig: CurrentFloorResearchModelConfig = {
      id: 'combined-v3-candidate',
      analogue: selectedAnalogue.config.analogue,
      issue: selectedIssue.config.issue,
      participation: selectedParticipation.config.participation,
      process: selectedProcess.config.process,
    };
    const combinedRows = runCurrentFloorResearchReplay(dataset, prepared, combinedConfig, supportFor(combinedConfig.analogue));
    const combinedValidation = compactScore(combinedRows, VALIDATION_SESSION);
    const combinedTest = compactScore(combinedRows, TEST_SESSION);

    const uncertaintyRuns = [2, 3, 4].map((bandCount) => {
      const fit = fitRiskBandUncertainty(sliceResearchRows(combinedRows, TRAIN_SESSION), bandCount);
      const rows = applyRiskBandUncertainty(combinedRows, fit);
      return { bandCount, fit, rows, validation: compactScore(rows, VALIDATION_SESSION), test: compactScore(rows, TEST_SESSION) };
    });
    const selectedUncertainty = choose(uncertaintyRuns, (row) => [
      Math.abs(row.validation.intervalCoverage - 0.8),
      row.validation.passageBrier,
    ]);

    const finalRows = selectedUncertainty.rows;
    const finalValidation = selectedUncertainty.validation;
    const finalTest = selectedUncertainty.test;
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

    const artifact = {
      metadata: {
        version: CURRENT_FLOOR_RESEARCH_VERSION,
        generatedAt: new Date().toISOString(),
        codeSha: process.env.GITHUB_SHA ?? null,
        databaseSource,
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
        selected: { config: selectedIssue.config, validation: selectedIssue.validation, test: selectedIssue.test },
        grid: issueRuns.map((row) => ({ config: row.config, validation: row.validation, test: row.test })),
      },
      participation: {
        selected: { config: selectedParticipation.config, validation: selectedParticipation.validation, test: selectedParticipation.test },
        grid: participationRuns.map((row) => ({ config: row.config, validation: row.validation, test: row.test })),
      },
      processContext: {
        selected: { config: selectedProcess.config, validation: selectedProcess.validation, test: selectedProcess.test },
        grid: processRuns.map((row) => ({ config: row.config, validation: row.validation, test: row.test })),
      },
      analogues: {
        noAnalogueAblation: analogueRuns.find((row) => row.config.analogue === null),
        selected: { config: selectedAnalogue.config, validation: selectedAnalogue.validation, test: selectedAnalogue.test },
        grid: analogueRuns.map((row) => ({ config: row.config, validation: row.validation, test: row.test })),
      },
      combined: {
        config: combinedConfig,
        validation: combinedValidation,
        test: combinedTest,
        deltaVsBaseline: { validation: combinedVsBaselineValidation, test: combinedVsBaselineTest },
      },
      eventSpecificUncertainty: {
        selected: {
          bandCount: selectedUncertainty.bandCount,
          fit: selectedUncertainty.fit,
          validation: selectedUncertainty.validation,
          test: selectedUncertainty.test,
        },
        grid: uncertaintyRuns.map((row) => ({ bandCount: row.bandCount, fit: row.fit, validation: row.validation, test: row.test })),
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

    const outputPath = resolve(process.env.VOTEPREDICT_CURRENT_FLOOR_RESEARCH_OUTPUT ?? 'artifacts/current-floor-model-research.json');
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, { mode: 0o600 });
    console.log(JSON.stringify({
      outputPath,
      fixedResearchTargets: prepared.targets.length,
      selectedIssue: selectedIssue.config.id,
      selectedParticipation: selectedParticipation.config.id,
      selectedProcess: selectedProcess.config.id,
      selectedAnalogue: selectedAnalogue.config.id,
      selectedUncertaintyBands: selectedUncertainty.bandCount,
      combinedProspectiveShadow: qualifiesForProspectiveShadow,
      uncertaintyProspectiveShadow: uncertaintyQualifiesForProspectiveShadow,
      baselineValidation,
      combinedValidation,
      finalValidation,
      baselineTest,
      combinedTest,
      finalTest,
    }));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
