import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';
import {
  QUICK_EVIDENCE_COMMITTEE_ROLLCALL_FEATURES,
  type QuickEvidenceCommitteeRollcallCandidateArtifact,
} from '../src/evaluation/quick-evidence-committee-rollcall-extractor.js';
import {
  QUICK_EVIDENCE_COMBINED_FEATURES,
  QUICK_EVIDENCE_COMBINED_SCREEN_INPUT_SCHEMA,
  evaluateQuickEvidenceCombinedHistoricalScreen,
  type QuickEvidenceCombinedScreenInput,
} from '../src/evaluation/quick-evidence-combined-historical-screen.js';
import {
  binaryAccuracy,
  brierScore,
  expectedCalibrationError,
  logLoss,
  type BinaryForecast,
} from '../src/evaluation/metrics.js';
import { simulateChamber } from '../src/forecasting/chamber.js';
import { ordinaryMinnesotaPassageRule } from '../src/forecasting/minnesota-rules.js';
import { QUICK_EVIDENCE_MAX_ABS_LOGIT_DELTA } from '../src/forecasting/quick-evidence-shadow.js';

const DATABASE_CANDIDATES = [
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL_NON_POOLING',
  'DATABASE_URL',
  'POSTGRES_URL',
] as const;
const DATABASE_BRIDGE_URL =
  'https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const TRAIN_SESSION = '2021-2022';
const VALIDATION_SESSION = '2023-2024';
const DESCRIPTIVE_SESSION = '2025-2026';
const FINANCE_FEATURE_NAMES = [
  'candidateFinanceAvailable',
  'candidateContributionCount',
  'candidateContributionAmount',
  'candidateExpenditureCount',
  'candidateExpenditureAmount',
] as const;
let secrets: string[] = [];

interface CandidateLineage {
  schemaVersion: 'quick-evidence-committee-rollcall-candidate-lineage-v1';
  extractionRunId: number;
  extractionHeadSha: string;
  candidateArtifact: { name: string; id: number; digest: string };
  policy: {
    plan: string;
    parser: string;
    mechanicsPolicy: string;
    outcomeUseBeforeThisStage: string;
    productionAction: string;
  };
}

interface MatrixRow {
  voteEventId: string;
  membershipId: string;
  legislatorId: string;
  session: string;
  chamber: string;
  occurredOn: string;
  billId: string;
  identifier: string;
  eventStatus: string;
  baseProbability: number | null;
  outcome: 0 | 1 | null;
  actualYes: number;
  passed: boolean;
  features: number[];
}

interface MatrixEnvelope {
  schemaVersion: 'quick-evidence-combined-historical-matrix-v1';
  featureNames: string[];
  rows: MatrixRow[];
}

interface FinanceRow {
  membershipId: string;
  rowKey: string;
  publishedOn: string;
  subtype: 'candidate_contribution_record' | 'candidate_expenditure_record';
  amount: number;
}

interface FinancePoint {
  publishedOn: string;
  contributionCount: number;
  contributionAmount: number;
  expenditureCount: number;
  expenditureAmount: number;
}

interface FinanceTimeline {
  dates: string[];
  contributionCounts: number[];
  contributionAmounts: number[];
  expenditureCounts: number[];
  expenditureAmounts: number[];
}

interface ScoredMatrixRow extends MatrixRow {
  baseFeatures: number[];
  financeFeatures: number[];
  currentCombinedProbability: number | null;
  financeEnrichedProbability: number | null;
}

function argumentValue(name: string): string | undefined {
  const args = process.argv.slice(2);
  const inline = args.find((arg) => arg.startsWith(name + '='));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function requiredArgument(name: string): string {
  const value = argumentValue(name);
  if (!value) throw new Error(name + ' is required');
  return value;
}

function mask(value: string): void {
  if (value.length <= 3) return;
  console.log('::add-mask::' + value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'));
}

function safe(error: unknown): string {
  let message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  for (const value of secrets.filter((item) => item.length > 3).sort((a, b) => b.length - a.length)) {
    message = message.split(value).join('[redacted]');
  }
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]').slice(0, 3000);
}

async function chooseDb(env: Record<string, string | undefined>): Promise<string> {
  const { Pool } = await import('pg');
  async function works(value: string): Promise<boolean> {
    const candidate = new Pool({ connectionString: value, max: 1, connectionTimeoutMillis: 8000 });
    try {
      await candidate.query('select 1');
      return true;
    } catch {
      return false;
    } finally {
      await candidate.end().catch(() => undefined);
    }
  }
  for (const key of DATABASE_CANDIDATES) {
    const value = env[key]?.trim();
    if (value && await works(value)) return value;
  }
  const secret = env.CRON_SECRET?.trim();
  if (!secret) throw new Error('CRON_SECRET unavailable');
  mask(secret);
  const response = await fetch(DATABASE_BRIDGE_URL, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + secret },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error('Database bridge HTTP ' + response.status);
  const value = (await response.text()).trim();
  secrets.push(value);
  mask(value);
  if (!await works(value)) throw new Error('Database bridge returned non-portable URL');
  return value;
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function clampProbability(value: number): number {
  return Math.min(0.995, Math.max(0.005, value));
}

function logit(probability: number): number {
  const p = clampProbability(probability);
  return Math.log(p / (1 - p));
}

function logistic(value: number): number {
  if (value >= 0) return clampProbability(1 / (1 + Math.exp(-value)));
  const exp = Math.exp(value);
  return clampProbability(exp / (1 + exp));
}

function fitOffsetCoordinateRidge(
  rows: readonly { baseProbability: number; outcome: 0 | 1; features: number[] }[],
  lambda: number,
): number[] {
  if (rows.length === 0) throw new Error('Cannot fit finance closeout diagnostic with zero rows');
  const width = rows[0].features.length;
  if (rows.some((row) => row.features.length !== width)) throw new Error('Inconsistent finance diagnostic feature width');
  const beta = Array.from({ length: width }, () => 0);
  const eta = rows.map((row) => logit(row.baseProbability));
  for (let pass = 0; pass < 30; pass += 1) {
    let maxStep = 0;
    for (let column = 0; column < width; column += 1) {
      let gradient = -lambda * beta[column];
      let information = lambda;
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
        const x = rows[rowIndex].features[column];
        if (Math.abs(x) < 1e-15) continue;
        const probability = logistic(eta[rowIndex]);
        gradient += x * (rows[rowIndex].outcome - probability);
        information += x * x * Math.max(1e-8, probability * (1 - probability));
      }
      if (information <= 1e-12) continue;
      const step = gradient / information;
      beta[column] += step;
      maxStep = Math.max(maxStep, Math.abs(step));
      if (Math.abs(step) > 0) {
        for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
          const x = rows[rowIndex].features[column];
          if (Math.abs(x) > 1e-15) eta[rowIndex] += x * step;
        }
      }
    }
    if (maxStep < 1e-7) break;
  }
  return beta;
}

function applyOffset(baseProbability: number, features: readonly number[], beta: readonly number[]): number {
  const uncapped = features.reduce((sum, value, index) => sum + value * (beta[index] ?? 0), 0);
  const delta = Math.max(
    -QUICK_EVIDENCE_MAX_ABS_LOGIT_DELTA,
    Math.min(QUICK_EVIDENCE_MAX_ABS_LOGIT_DELTA, uncapped),
  );
  return logistic(logit(baseProbability) + delta);
}

function buildFinanceTimelines(rows: readonly FinanceRow[]): Map<string, FinanceTimeline> {
  const grouped = new Map<string, FinanceRow[]>();
  for (const row of rows) {
    const values = grouped.get(row.membershipId) ?? [];
    values.push(row);
    grouped.set(row.membershipId, values);
  }
  const result = new Map<string, FinanceTimeline>();
  for (const [membershipId, values] of grouped) {
    values.sort((a, b) => a.publishedOn.localeCompare(b.publishedOn) || a.rowKey.localeCompare(b.rowKey));
    const points = new Map<string, FinancePoint>();
    for (const row of values) {
      const point = points.get(row.publishedOn) ?? {
        publishedOn: row.publishedOn,
        contributionCount: 0,
        contributionAmount: 0,
        expenditureCount: 0,
        expenditureAmount: 0,
      };
      if (row.subtype === 'candidate_contribution_record') {
        point.contributionCount += 1;
        point.contributionAmount += Math.max(0, row.amount);
      } else {
        point.expenditureCount += 1;
        point.expenditureAmount += Math.max(0, row.amount);
      }
      points.set(row.publishedOn, point);
    }
    const ordered = [...points.values()].sort((a, b) => a.publishedOn.localeCompare(b.publishedOn));
    const timeline: FinanceTimeline = {
      dates: [],
      contributionCounts: [],
      contributionAmounts: [],
      expenditureCounts: [],
      expenditureAmounts: [],
    };
    let cc = 0;
    let ca = 0;
    let ec = 0;
    let ea = 0;
    for (const point of ordered) {
      cc += point.contributionCount;
      ca += point.contributionAmount;
      ec += point.expenditureCount;
      ea += point.expenditureAmount;
      timeline.dates.push(point.publishedOn);
      timeline.contributionCounts.push(cc);
      timeline.contributionAmounts.push(ca);
      timeline.expenditureCounts.push(ec);
      timeline.expenditureAmounts.push(ea);
    }
    result.set(membershipId, timeline);
  }
  return result;
}

function financeAsOf(timeline: FinanceTimeline | undefined, occurredOn: string): {
  available: number;
  contributionCount: number;
  contributionAmount: number;
  expenditureCount: number;
  expenditureAmount: number;
} {
  if (!timeline || timeline.dates.length === 0) {
    return { available: 0, contributionCount: 0, contributionAmount: 0, expenditureCount: 0, expenditureAmount: 0 };
  }
  let low = 0;
  let high = timeline.dates.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (timeline.dates[mid] < occurredOn) low = mid + 1;
    else high = mid;
  }
  const index = low - 1;
  if (index < 0) {
    return { available: 0, contributionCount: 0, contributionAmount: 0, expenditureCount: 0, expenditureAmount: 0 };
  }
  return {
    available: 1,
    contributionCount: timeline.contributionCounts[index],
    contributionAmount: timeline.contributionAmounts[index],
    expenditureCount: timeline.expenditureCounts[index],
    expenditureAmount: timeline.expenditureAmounts[index],
  };
}

function financeFeatures(value: ReturnType<typeof financeAsOf>): number[] {
  return [
    value.available,
    Math.log1p(value.contributionCount),
    Math.log1p(value.contributionAmount),
    Math.log1p(value.expenditureCount),
    Math.log1p(value.expenditureAmount),
  ];
}

function memberForecasts(
  rows: readonly ScoredMatrixRow[],
  key: 'baseProbability' | 'currentCombinedProbability' | 'financeEnrichedProbability',
): BinaryForecast[] {
  return rows.flatMap((row) => {
    if (row.eventStatus !== 'replayable' || row.outcome === null) return [];
    const probability = row[key];
    return typeof probability === 'number' ? [{ probability, outcome: row.outcome }] : [];
  });
}

function eventForecasts(
  rows: readonly ScoredMatrixRow[],
  key: 'baseProbability' | 'currentCombinedProbability' | 'financeEnrichedProbability',
) {
  const groups = new Map<string, ScoredMatrixRow[]>();
  for (const row of rows) {
    if (row.eventStatus !== 'replayable') continue;
    const group = groups.get(row.voteEventId) ?? [];
    group.push(row);
    groups.set(row.voteEventId, group);
  }
  return [...groups.values()].flatMap((group) => {
    if (group.length === 0 || group.some((row) => typeof row[key] !== 'number')) return [];
    const simulation = simulateChamber(
      group.map((row) => row[key] as number),
      ordinaryMinnesotaPassageRule(group[0].chamber),
    );
    return [{
      voteEventId: group[0].voteEventId,
      chamber: group[0].chamber,
      expectedYes: simulation.expectedYes,
      passageProbability: simulation.passageProbability,
      actualYes: group[0].actualYes,
      passed: group[0].passed,
    }];
  });
}

function score(
  rows: readonly ScoredMatrixRow[],
  key: 'baseProbability' | 'currentCombinedProbability' | 'financeEnrichedProbability',
) {
  const members = memberForecasts(rows, key);
  const events = eventForecasts(rows, key);
  const passage = events.map((row) => ({ probability: row.passageProbability, outcome: row.passed ? 1 as const : 0 as const }));
  return {
    memberObservations: members.length,
    memberAccuracy: binaryAccuracy(members),
    memberBrier: brierScore(members),
    memberLogLoss: logLoss(members),
    memberExpectedCalibrationError: expectedCalibrationError(members),
    chamberForecasts: events.length,
    chamberMeanAbsoluteYesError: events.reduce((sum, row) => sum + Math.abs(row.expectedYes - row.actualYes), 0) / events.length,
    passageForecasts: passage.length,
    passageBrier: brierScore(passage),
    passageAccuracy: binaryAccuracy(passage),
  };
}

function delta(candidate: ReturnType<typeof score>, baseline: ReturnType<typeof score>) {
  return {
    memberAccuracy: candidate.memberAccuracy - baseline.memberAccuracy,
    memberBrier: candidate.memberBrier - baseline.memberBrier,
    memberLogLoss: candidate.memberLogLoss - baseline.memberLogLoss,
    memberExpectedCalibrationError: candidate.memberExpectedCalibrationError - baseline.memberExpectedCalibrationError,
    chamberMeanAbsoluteYesError: candidate.chamberMeanAbsoluteYesError - baseline.chamberMeanAbsoluteYesError,
    passageBrier: candidate.passageBrier - baseline.passageBrier,
    passageAccuracy: candidate.passageAccuracy - baseline.passageAccuracy,
  };
}

function average(values: readonly number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function balancedSensitivity(rows: readonly ScoredMatrixRow[]) {
  const eligible = rows.filter((row) => row.eventStatus === 'replayable'
    && row.outcome !== null
    && row.currentCombinedProbability !== null
    && row.financeEnrichedProbability !== null);
  const byEvent = new Map<string, ScoredMatrixRow[]>();
  const byChamber = new Map<string, ScoredMatrixRow[]>();
  for (const row of eligible) {
    const eventRows = byEvent.get(row.voteEventId) ?? [];
    eventRows.push(row);
    byEvent.set(row.voteEventId, eventRows);
    const chamberRows = byChamber.get(row.chamber) ?? [];
    chamberRows.push(row);
    byChamber.set(row.chamber, chamberRows);
  }
  const groupMetric = (group: readonly ScoredMatrixRow[]) => {
    const current = group.map((row) => ({ probability: row.currentCombinedProbability as number, outcome: row.outcome as 0 | 1 }));
    const finance = group.map((row) => ({ probability: row.financeEnrichedProbability as number, outcome: row.outcome as 0 | 1 }));
    return {
      brierDelta: brierScore(finance) - brierScore(current),
      logLossDelta: logLoss(finance) - logLoss(current),
    };
  };
  const eventMetrics = [...byEvent.values()].map(groupMetric);
  const chamberMetrics = [...byChamber.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([chamber, group]) => ({ chamber, ...groupMetric(group) }));
  return {
    eventBalanced: {
      events: eventMetrics.length,
      memberBrierDeltaFinanceMinusCurrent: average(eventMetrics.map((row) => row.brierDelta)),
      memberLogLossDeltaFinanceMinusCurrent: average(eventMetrics.map((row) => row.logLossDelta)),
    },
    chamberBalanced: {
      chambers: chamberMetrics.length,
      memberBrierDeltaFinanceMinusCurrent: average(chamberMetrics.map((row) => row.brierDelta)),
      memberLogLossDeltaFinanceMinusCurrent: average(chamberMetrics.map((row) => row.logLossDelta)),
      byChamber: chamberMetrics,
    },
  };
}

async function main(): Promise<void> {
  const candidatePath = resolve(requiredArgument('--committee-candidates'));
  const lineagePath = resolve(requiredArgument('--committee-lineage'));
  const outputDir = resolve(argumentValue('--output-dir') ?? 'artifacts/historical-evidence-closeout');
  const envPath = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envPath) throw new Error('Production environment file is required');

  const planPath = resolve('data/evaluation/quick-evidence-finance-enriched-historical-plan-v1.json');
  const freezePath = resolve('data/evaluation/historical-evidence-source-family-freeze-v1.json');
  const plan = JSON.parse(readFileSync(planPath, 'utf8')) as { schemaVersion: string; fit: { lambda: number; retuningAfterValidation: boolean } };
  if (plan.schemaVersion !== 'quick-evidence-finance-enriched-historical-plan-v1'
    || plan.fit.lambda !== 20
    || plan.fit.retuningAfterValidation !== false) {
    throw new Error('Finance-enriched historical plan no longer matches the frozen #459 protocol');
  }

  const committee = JSON.parse(readFileSync(candidatePath, 'utf8')) as QuickEvidenceCommitteeRollcallCandidateArtifact;
  const lineage = JSON.parse(readFileSync(lineagePath, 'utf8')) as CandidateLineage;
  if (committee.schemaVersion !== 'quick-evidence-committee-rollcall-candidates-v1') {
    throw new Error('Unsupported committee candidate schema');
  }
  if (committee.metadata.outcomeUse !== 'none' || committee.metadata.probabilityAction !== 'none') {
    throw new Error('Committee artifact is not outcome-blind');
  }
  if (lineage.schemaVersion !== 'quick-evidence-committee-rollcall-candidate-lineage-v1'
    || lineage.policy.outcomeUseBeforeThisStage !== 'none'
    || lineage.policy.productionAction !== 'none') {
    throw new Error('Committee lineage violates frozen historical boundary');
  }

  const input: QuickEvidenceCombinedScreenInput = {
    schemaVersion: QUICK_EVIDENCE_COMBINED_SCREEN_INPUT_SCHEMA,
    committeeArtifact: {
      workflowRunId: lineage.extractionRunId,
      headSha: lineage.extractionHeadSha,
      artifactId: lineage.candidateArtifact.id,
      digest: lineage.candidateArtifact.digest,
    },
    committeeFeatureNames: [...QUICK_EVIDENCE_COMMITTEE_ROLLCALL_FEATURES],
    committeeRows: committee.featureRows.map((row) => ({
      voteEventId: row.voteEventId,
      membershipId: row.membershipId,
      features: QUICK_EVIDENCE_COMMITTEE_ROLLCALL_FEATURES.map((name) => row.features[name]),
    })),
  };

  const env = parseRuntimeEnvironment(readFileSync(envPath, 'utf8'));
  secrets = Object.entries(env)
    .filter(([key]) => /SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(key))
    .map(([, value]) => value)
    .filter((value): value is string => typeof value === 'string');
  secrets.forEach(mask);
  const databaseUrl = await chooseDb(env);
  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 4,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
  });
  try {
    const combined = await evaluateQuickEvidenceCombinedHistoricalScreen(pool, input, {
      codeSha: process.env.GITHUB_SHA ?? null,
      includeMatrix: true,
    }) as unknown as { matrix?: MatrixEnvelope };
    const matrix = combined.matrix;
    if (!matrix || matrix.schemaVersion !== 'quick-evidence-combined-historical-matrix-v1') {
      throw new Error('Combined historical evaluator did not return the requested matrix');
    }
    if (matrix.featureNames.length !== QUICK_EVIDENCE_COMBINED_FEATURES.length) {
      throw new Error('Historical matrix base feature width drifted');
    }

    const financeResult = await pool.query<FinanceRow>(`
      SELECT DISTINCT ON (ei.metadata->>'rowKey', ei.membership_id)
             ei.membership_id::text AS "membershipId",
             ei.metadata->>'rowKey' AS "rowKey",
             ei.published_at::date::text AS "publishedOn",
             ei.metadata->>'subtype' AS subtype,
             CASE
               WHEN ei.metadata->>'subtype'='candidate_expenditure_record'
                 THEN coalesce(nullif(ei.metadata->>'totalAmount','')::numeric, nullif(ei.metadata->>'amount','')::numeric, 0)::float8
               ELSE coalesce(nullif(ei.metadata->>'amount','')::numeric, 0)::float8
             END AS amount
        FROM evidence_items ei
        JOIN source_documents sd ON sd.id=ei.source_document_id
       WHERE sd.source_kind IN (
               'campaign_finance_candidate_contribution_bulk',
               'campaign_finance_candidate_expenditure_bulk'
             )
         AND ei.membership_id IS NOT NULL
         AND ei.metadata->>'rowKey' IS NOT NULL
         AND ei.metadata->>'subtype' IN ('candidate_contribution_record','candidate_expenditure_record')
         AND ei.metadata->>'asOfEligible'='true'
         AND ei.published_at IS NOT NULL
         AND ei.metadata->>'transactionDateIsAvailability'='false'
       ORDER BY ei.metadata->>'rowKey', ei.membership_id, ei.published_at, ei.id
    `);
    const financeCoverage = await pool.query(`
      SELECT s.slug AS session,
             c.slug AS chamber,
             count(DISTINCT ei.metadata->>'rowKey')::int AS "eligibleRowKeys",
             count(DISTINCT ei.membership_id)::int AS memberships
        FROM evidence_items ei
        JOIN source_documents sd ON sd.id=ei.source_document_id
        JOIN memberships m ON m.id=ei.membership_id
        JOIN legislative_sessions s ON s.id=m.session_id
        JOIN chambers c ON c.id=m.chamber_id
       WHERE sd.source_kind IN (
               'campaign_finance_candidate_contribution_bulk',
               'campaign_finance_candidate_expenditure_bulk'
             )
         AND ei.metadata->>'rowKey' IS NOT NULL
         AND ei.metadata->>'subtype' IN ('candidate_contribution_record','candidate_expenditure_record')
         AND ei.metadata->>'asOfEligible'='true'
         AND ei.published_at IS NOT NULL
         AND ei.metadata->>'transactionDateIsAvailability'='false'
         AND s.slug IN ('2021-2022','2023-2024','2025-2026')
       GROUP BY s.slug,c.slug
       ORDER BY s.slug,c.slug
    `);

    const timelines = buildFinanceTimelines(financeResult.rows);
    const enrichedBase = matrix.rows.map((row) => {
      const rawFinance = financeAsOf(timelines.get(row.membershipId), row.occurredOn);
      return {
        ...row,
        baseFeatures: row.features,
        financeFeatures: financeFeatures(rawFinance),
      };
    });

    const training = enrichedBase.flatMap((row) => (
      row.session === TRAIN_SESSION
      && row.eventStatus === 'replayable'
      && row.baseProbability !== null
      && row.outcome !== null
        ? [{
            baseProbability: row.baseProbability,
            outcome: row.outcome,
            currentFeatures: row.baseFeatures,
            enrichedFeatures: [...row.baseFeatures, ...row.financeFeatures],
          }]
        : []
    ));
    const lambda = plan.fit.lambda;
    const currentBeta = fitOffsetCoordinateRidge(
      training.map((row) => ({ baseProbability: row.baseProbability, outcome: row.outcome, features: row.currentFeatures })),
      lambda,
    );
    const enrichedBeta = fitOffsetCoordinateRidge(
      training.map((row) => ({ baseProbability: row.baseProbability, outcome: row.outcome, features: row.enrichedFeatures })),
      lambda,
    );

    const scored: ScoredMatrixRow[] = enrichedBase.map((row) => ({
      ...row,
      currentCombinedProbability: row.baseProbability === null
        ? null
        : applyOffset(row.baseProbability, row.baseFeatures, currentBeta),
      financeEnrichedProbability: row.baseProbability === null
        ? null
        : applyOffset(row.baseProbability, [...row.baseFeatures, ...row.financeFeatures], enrichedBeta),
    }));

    const sessions = [TRAIN_SESSION, VALIDATION_SESSION, DESCRIPTIVE_SESSION] as const;
    const scoreBySession = Object.fromEntries(sessions.map((session) => {
      const rows = scored.filter((row) => row.session === session);
      const serving = score(rows, 'baseProbability');
      const current = score(rows, 'currentCombinedProbability');
      const finance = score(rows, 'financeEnrichedProbability');
      return [session, {
        serving,
        currentFixedLambdaCombined: current,
        financeEnriched: finance,
        currentMinusServing: delta(current, serving),
        financeMinusServing: delta(finance, serving),
        financeMinusCurrent: delta(finance, current),
      }];
    }));

    const validationRows = scored.filter((row) => row.session === VALIDATION_SESSION);
    const validationByChamber = Object.fromEntries(['house','senate'].map((chamber) => {
      const rows = validationRows.filter((row) => row.chamber === chamber);
      const serving = score(rows, 'baseProbability');
      const current = score(rows, 'currentCombinedProbability');
      const finance = score(rows, 'financeEnrichedProbability');
      return [chamber, {
        serving,
        currentFixedLambdaCombined: current,
        financeEnriched: finance,
        financeMinusCurrent: delta(finance, current),
        financeMinusServing: delta(finance, serving),
      }];
    }));
    const moved = validationRows.filter((row) =>
      row.outcome !== null
      && row.currentCombinedProbability !== null
      && row.financeEnrichedProbability !== null
      && Math.abs(row.financeEnrichedProbability - row.currentCombinedProbability) > 1e-12
    );
    const movedCurrent = memberForecasts(moved, 'currentCombinedProbability');
    const movedFinance = memberForecasts(moved, 'financeEnrichedProbability');
    const financeAvailability = Object.fromEntries(sessions.map((session) => {
      const rows = scored.filter((row) => row.session === session);
      const available = rows.filter((row) => row.financeFeatures[0] > 0);
      return [session, {
        matrixRows: rows.length,
        rowsWithFinanceAvailable: available.length,
        coverage: rows.length ? available.length / rows.length : 0,
        distinctMembershipsWithFinance: new Set(available.map((row) => row.membershipId)).size,
      }];
    }));

    mkdirSync(outputDir, { recursive: true });
    const featureNames = [...QUICK_EVIDENCE_COMBINED_FEATURES, ...FINANCE_FEATURE_NAMES];
    const ndjson = scored.map((row) => JSON.stringify({
      voteEventId: row.voteEventId,
      membershipId: row.membershipId,
      legislatorId: row.legislatorId,
      session: row.session,
      chamber: row.chamber,
      occurredOn: row.occurredOn,
      billId: row.billId,
      identifier: row.identifier,
      eventStatus: row.eventStatus,
      baseProbability: row.baseProbability,
      outcome: row.outcome,
      actualYes: row.actualYes,
      passed: row.passed,
      features: [...row.baseFeatures, ...row.financeFeatures],
    })).join('\n') + '\n';
    const gzipped = gzipSync(Buffer.from(ndjson), { level: 9 });
    const matrixPath = resolve(outputDir, 'historical-as-of-matrix-v1.ndjson.gz');
    const manifestPath = resolve(outputDir, 'historical-as-of-matrix-v1-manifest.json');
    const diagnosticPath = resolve(outputDir, 'quick-evidence-finance-enriched-historical-diagnostic-v1.json');
    writeFileSync(matrixPath, gzipped, { mode: 0o600 });

    const manifest = {
      schemaVersion: 'historical-as-of-matrix-v1-manifest',
      generatedAt: new Date().toISOString(),
      issue: 459,
      codeSha: process.env.GITHUB_SHA ?? null,
      sourceFamilyFreeze: {
        path: 'data/evaluation/historical-evidence-source-family-freeze-v1.json',
        sha256: sha256(readFileSync(freezePath)),
      },
      financeDiagnosticPlan: {
        path: 'data/evaluation/quick-evidence-finance-enriched-historical-plan-v1.json',
        sha256: sha256(readFileSync(planPath)),
      },
      replay: {
        version: 'historical-quick-replay-v2',
        servingBaseline: 'member-eb-v1.2-decay180',
        trainSession: TRAIN_SESSION,
        validationSession: VALIDATION_SESSION,
        descriptiveSession: DESCRIPTIVE_SESSION,
      },
      rows: scored.length,
      events: new Set(scored.map((row) => row.voteEventId)).size,
      memberships: new Set(scored.map((row) => row.membershipId)).size,
      featureNames,
      featureCount: featureNames.length,
      baseFeatureCount: QUICK_EVIDENCE_COMBINED_FEATURES.length,
      financeFeatureCount: FINANCE_FEATURE_NAMES.length,
      matrixCanonicalNdjsonSha256: sha256(ndjson),
      matrixGzipSha256: sha256(gzipped),
      strictPreCutoffEvidenceOnly: true,
      sameDayFinanceExcluded: true,
      transactionDateIsAvailability: false,
      productionAction: 'none',
    };
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });

    const diagnostic = {
      schemaVersion: 'quick-evidence-finance-enriched-historical-diagnostic-v1',
      generatedAt: new Date().toISOString(),
      issue: 459,
      codeSha: process.env.GITHUB_SHA ?? null,
      purpose: 'single fixed finance-enriched historical diagnostic before prospective handoff',
      independentValidationSet: false,
      productionAction: 'none',
      servingQuickChanged: false,
      automaticPromotion: false,
      fixedProtocol: {
        lambda,
        lambdaRetunedAfterValidation: false,
        maximumAbsoluteLogitDelta: QUICK_EVIDENCE_MAX_ABS_LOGIT_DELTA,
        trainSession: TRAIN_SESSION,
        validationSession: VALIDATION_SESSION,
        descriptiveSession: DESCRIPTIVE_SESSION,
      },
      features: {
        base: [...QUICK_EVIDENCE_COMBINED_FEATURES],
        finance: [...FINANCE_FEATURE_NAMES],
      },
      coefficients: {
        currentFixedLambdaCombined: Object.fromEntries(QUICK_EVIDENCE_COMBINED_FEATURES.map((name, index) => [name, currentBeta[index]])),
        financeEnriched: Object.fromEntries(featureNames.map((name, index) => [name, enrichedBeta[index]])),
      },
      financeSourceCoverage: {
        exactEligibleRowsLoaded: financeResult.rows.length,
        bySessionChamber: financeCoverage.rows,
        matrixAvailability: financeAvailability,
        transactionDateUsedAsAvailability: false,
        strictPreVoteOnly: true,
      },
      scores: scoreBySession,
      validationSlices: {
        byChamber: validationByChamber,
        financeMovedMembers: {
          memberOutcomes: movedCurrent.length,
          currentFixedLambdaCombined: movedCurrent.length ? {
            accuracy: binaryAccuracy(movedCurrent),
            brier: brierScore(movedCurrent),
            logLoss: logLoss(movedCurrent),
            expectedCalibrationError: expectedCalibrationError(movedCurrent),
          } : null,
          financeEnriched: movedFinance.length ? {
            accuracy: binaryAccuracy(movedFinance),
            brier: brierScore(movedFinance),
            logLoss: logLoss(movedFinance),
            expectedCalibrationError: expectedCalibrationError(movedFinance),
          } : null,
          deltaFinanceMinusCurrent: movedCurrent.length ? {
            brier: brierScore(movedFinance) - brierScore(movedCurrent),
            logLoss: logLoss(movedFinance) - logLoss(movedCurrent),
            expectedCalibrationError: expectedCalibrationError(movedFinance) - expectedCalibrationError(movedCurrent),
            accuracy: binaryAccuracy(movedFinance) - binaryAccuracy(movedCurrent),
          } : null,
        },
        balancedMemberSensitivity: balancedSensitivity(validationRows),
      },
      matrixManifest: manifest,
      interpretation: {
        retrospectiveDevelopmentEvidenceOnly: true,
        noRetuningLoop: true,
        noServingActionRegardlessOfResult: true,
        definitiveNextEvaluation: 'quick-evidence-prospective-v1 under issue #287',
      },
    };
    writeFileSync(diagnosticPath, JSON.stringify(diagnostic, null, 2) + '\n', { mode: 0o600 });

    console.log(JSON.stringify({
      historicalEvidenceCloseout: {
        matrixRows: manifest.rows,
        matrixEvents: manifest.events,
        matrixSha256: manifest.matrixCanonicalNdjsonSha256,
        financeEligibleRowsLoaded: financeResult.rows.length,
        financeAvailability,
        validationFinanceMinusCurrent: (scoreBySession[VALIDATION_SESSION] as { financeMinusCurrent: unknown }).financeMinusCurrent,
        descriptiveFinanceMinusCurrent: (scoreBySession[DESCRIPTIVE_SESSION] as { financeMinusCurrent: unknown }).financeMinusCurrent,
        financeMovedValidationMembers: movedCurrent.length,
        productionAction: 'none',
      },
    }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(safe(error));
  process.exitCode = 1;
});
