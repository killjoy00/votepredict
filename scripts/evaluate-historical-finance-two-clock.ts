import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
  buildHistoricalFinanceTimelines,
  historicalFinanceAsOf,
  historicalFinanceFeatures,
  HISTORICAL_EVIDENCE_TWO_CLOCK_VERSION,
  type HistoricalFinanceRow,
} from '../src/evaluation/historical-evidence-two-clock.js';
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

interface FinanceDbRow extends HistoricalFinanceRow {
  session: string;
  chamber: string;
}

interface EnrichedMatrixRow extends MatrixRow {
  baseFeatures: number[];
  strictFinanceFeatures: number[];
  retrospectiveFinanceFeatures: number[];
  currentCombinedProbability: number | null;
  strictAsOfProbability: number | null;
  retrospectiveActivityProbability: number | null;
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
  if (rows.length === 0) throw new Error('Cannot fit two-clock diagnostic with zero rows');
  const width = rows[0].features.length;
  if (rows.some((row) => row.features.length !== width)) {
    throw new Error('Inconsistent two-clock diagnostic feature width');
  }

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

type ProbabilityKey =
  | 'baseProbability'
  | 'currentCombinedProbability'
  | 'strictAsOfProbability'
  | 'retrospectiveActivityProbability';

function memberForecasts(rows: readonly EnrichedMatrixRow[], key: ProbabilityKey): BinaryForecast[] {
  return rows.flatMap((row) => {
    if (row.eventStatus !== 'replayable' || row.outcome === null) return [];
    const probability = row[key];
    return typeof probability === 'number' ? [{ probability, outcome: row.outcome }] : [];
  });
}

function eventForecasts(rows: readonly EnrichedMatrixRow[], key: ProbabilityKey) {
  const groups = new Map<string, EnrichedMatrixRow[]>();
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

function score(rows: readonly EnrichedMatrixRow[], key: ProbabilityKey) {
  const members = memberForecasts(rows, key);
  const events = eventForecasts(rows, key);
  const passage = events.map((row) => ({
    probability: row.passageProbability,
    outcome: row.passed ? 1 as const : 0 as const,
  }));
  return {
    memberObservations: members.length,
    memberAccuracy: binaryAccuracy(members),
    memberBrier: brierScore(members),
    memberLogLoss: logLoss(members),
    memberExpectedCalibrationError: expectedCalibrationError(members),
    chamberForecasts: events.length,
    chamberMeanAbsoluteYesError:
      events.reduce((sum, row) => sum + Math.abs(row.expectedYes - row.actualYes), 0) / events.length,
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
    memberExpectedCalibrationError:
      candidate.memberExpectedCalibrationError - baseline.memberExpectedCalibrationError,
    chamberMeanAbsoluteYesError:
      candidate.chamberMeanAbsoluteYesError - baseline.chamberMeanAbsoluteYesError,
    passageBrier: candidate.passageBrier - baseline.passageBrier,
    passageAccuracy: candidate.passageAccuracy - baseline.passageAccuracy,
  };
}

function sourceCoverage(rows: readonly FinanceDbRow[]) {
  const grouped = new Map<string, {
    session: string;
    chamber: string;
    activityRows: number;
    strictRows: number;
    activityOnlyRows: number;
    memberships: Set<string>;
    strictMemberships: Set<string>;
  }>();

  for (const row of rows) {
    const key = row.session + ':' + row.chamber;
    const group = grouped.get(key) ?? {
      session: row.session,
      chamber: row.chamber,
      activityRows: 0,
      strictRows: 0,
      activityOnlyRows: 0,
      memberships: new Set<string>(),
      strictMemberships: new Set<string>(),
    };
    group.activityRows += 1;
    group.memberships.add(row.membershipId);
    if (row.availableOn) {
      group.strictRows += 1;
      group.strictMemberships.add(row.membershipId);
    } else {
      group.activityOnlyRows += 1;
    }
    grouped.set(key, group);
  }

  return [...grouped.values()]
    .sort((left, right) =>
      left.session.localeCompare(right.session) || left.chamber.localeCompare(right.chamber))
    .map((group) => ({
      session: group.session,
      chamber: group.chamber,
      activityRows: group.activityRows,
      strictPublicAvailabilityRows: group.strictRows,
      retrospectiveActivityOnlyRows: group.activityOnlyRows,
      membershipsWithActivityRows: group.memberships.size,
      membershipsWithStrictPublicRows: group.strictMemberships.size,
    }));
}

function matrixCoverage(rows: readonly EnrichedMatrixRow[]) {
  return Object.fromEntries(
    [TRAIN_SESSION, VALIDATION_SESSION, DESCRIPTIVE_SESSION].map((session) => {
      const sessionRows = rows.filter((row) => row.session === session);
      const strict = sessionRows.filter((row) => row.strictFinanceFeatures[0] > 0);
      const retrospective = sessionRows.filter((row) => row.retrospectiveFinanceFeatures[0] > 0);
      const activityOnly = sessionRows.filter((row) =>
        row.strictFinanceFeatures[0] === 0 && row.retrospectiveFinanceFeatures[0] > 0);
      return [session, {
        matrixRows: sessionRows.length,
        strictAsOfRows: strict.length,
        strictAsOfCoverage: sessionRows.length ? strict.length / sessionRows.length : 0,
        retrospectiveActivityRows: retrospective.length,
        retrospectiveActivityCoverage:
          sessionRows.length ? retrospective.length / sessionRows.length : 0,
        activityOnlyRows: activityOnly.length,
        distinctActivityOnlyMemberships: new Set(activityOnly.map((row) => row.membershipId)).size,
      }];
    }),
  );
}

function validationMoved(rows: readonly EnrichedMatrixRow[]) {
  const eligible = rows.filter((row) =>
    row.session === VALIDATION_SESSION
    && row.outcome !== null
    && row.strictAsOfProbability !== null
    && row.retrospectiveActivityProbability !== null
    && Math.abs(
      (row.retrospectiveActivityProbability as number) - (row.strictAsOfProbability as number),
    ) > 1e-12);

  const strict = memberForecasts(eligible, 'strictAsOfProbability');
  const retrospective = memberForecasts(eligible, 'retrospectiveActivityProbability');
  return {
    memberOutcomes: eligible.length,
    strictAsOf: eligible.length ? {
      accuracy: binaryAccuracy(strict),
      brier: brierScore(strict),
      logLoss: logLoss(strict),
      expectedCalibrationError: expectedCalibrationError(strict),
    } : null,
    retrospectiveActivity: eligible.length ? {
      accuracy: binaryAccuracy(retrospective),
      brier: brierScore(retrospective),
      logLoss: logLoss(retrospective),
      expectedCalibrationError: expectedCalibrationError(retrospective),
    } : null,
    retrospectiveMinusStrict: eligible.length ? {
      accuracy: binaryAccuracy(retrospective) - binaryAccuracy(strict),
      brier: brierScore(retrospective) - brierScore(strict),
      logLoss: logLoss(retrospective) - logLoss(strict),
      expectedCalibrationError:
        expectedCalibrationError(retrospective) - expectedCalibrationError(strict),
    } : null,
  };
}

async function main(): Promise<void> {
  const candidatePath = resolve(requiredArgument('--committee-candidates'));
  const lineagePath = resolve(requiredArgument('--committee-lineage'));
  const outputPath = resolve(
    argumentValue('--output')
      ?? 'artifacts/historical-finance-two-clock/historical-finance-two-clock-diagnostic-v1.json',
  );
  const envPath = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!envPath) throw new Error('Production environment file is required');

  const planPath = resolve('data/evaluation/historical-finance-two-clock-diagnostic-plan-v1.json');
  const plan = JSON.parse(readFileSync(planPath, 'utf8')) as {
    schemaVersion: string;
    protocol: { ridgeLambda: number; retuneAfterValidation: boolean };
    interpretation: Record<string, unknown>;
  };
  if (
    plan.schemaVersion !== 'historical-finance-two-clock-diagnostic-plan-v1'
    || plan.protocol.ridgeLambda !== 20
    || plan.protocol.retuneAfterValidation !== false
  ) {
    throw new Error('Two-clock diagnostic plan no longer matches the frozen protocol');
  }

  const committee =
    JSON.parse(readFileSync(candidatePath, 'utf8')) as QuickEvidenceCommitteeRollcallCandidateArtifact;
  const lineage = JSON.parse(readFileSync(lineagePath, 'utf8')) as CandidateLineage;
  if (
    lineage.schemaVersion !== 'quick-evidence-committee-rollcall-candidate-lineage-v1'
    || lineage.policy.outcomeUseBeforeThisStage !== 'none'
    || lineage.policy.productionAction !== 'none'
  ) {
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

    const financeResult = await pool.query<FinanceDbRow>(`
      SELECT DISTINCT ON (ei.metadata->>'rowKey', ei.membership_id)
             ei.membership_id::text AS "membershipId",
             ei.metadata->>'rowKey' AS "rowKey",
             s.slug AS session,
             c.slug AS chamber,
             ei.metadata->>'transactionDate' AS "activityOn",
             CASE
               WHEN ei.metadata->>'asOfEligible'='true'
                AND ei.published_at IS NOT NULL
                AND ei.metadata->>'transactionDateIsAvailability'='false'
               THEN ei.published_at::date::text
               ELSE NULL
             END AS "availableOn",
             ei.metadata->>'subtype' AS subtype,
             CASE
               WHEN ei.metadata->>'subtype'='candidate_expenditure_record'
                 THEN coalesce(
                   nullif(ei.metadata->>'totalAmount','')::numeric,
                   nullif(ei.metadata->>'amount','')::numeric,
                   0
                 )::float8
               ELSE coalesce(nullif(ei.metadata->>'amount','')::numeric, 0)::float8
             END AS amount
        FROM evidence_items ei
        JOIN source_documents sd ON sd.id=ei.source_document_id
        JOIN memberships m ON m.id=ei.membership_id
        JOIN legislative_sessions s ON s.id=m.session_id
        JOIN chambers c ON c.id=m.chamber_id
       WHERE sd.source_kind IN (
               'campaign_finance_candidate_contribution_bulk',
               'campaign_finance_candidate_expenditure_bulk'
             )
         AND ei.membership_id IS NOT NULL
         AND ei.metadata->>'rowKey' IS NOT NULL
         AND ei.metadata->>'subtype' IN (
               'candidate_contribution_record',
               'candidate_expenditure_record'
             )
         AND ei.metadata->>'transactionDate' ~ '^\\d{4}-\\d{2}-\\d{2}$'
         AND s.slug IN ('2021-2022','2023-2024','2025-2026')
         AND c.slug IN ('house','senate')
       ORDER BY ei.metadata->>'rowKey',
                ei.membership_id,
                CASE
                  WHEN ei.metadata->>'asOfEligible'='true'
                   AND ei.published_at IS NOT NULL
                   AND ei.metadata->>'transactionDateIsAvailability'='false'
                  THEN 0
                  ELSE 1
                END,
                ei.published_at ASC NULLS LAST,
                ei.id
    `);

    const financeRows = financeResult.rows;
    const strictTimelines =
      buildHistoricalFinanceTimelines(financeRows, 'public_availability');
    const retrospectiveTimelines =
      buildHistoricalFinanceTimelines(financeRows, 'underlying_activity');

    const enrichedBase = matrix.rows.map((row) => {
      const strictFinance =
        historicalFinanceAsOf(strictTimelines.get(row.membershipId), row.occurredOn);
      const retrospectiveFinance =
        historicalFinanceAsOf(retrospectiveTimelines.get(row.membershipId), row.occurredOn);
      return {
        ...row,
        baseFeatures: row.features,
        strictFinanceFeatures: historicalFinanceFeatures(strictFinance),
        retrospectiveFinanceFeatures: historicalFinanceFeatures(retrospectiveFinance),
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
            strictFeatures: [...row.baseFeatures, ...row.strictFinanceFeatures],
            retrospectiveFeatures: [...row.baseFeatures, ...row.retrospectiveFinanceFeatures],
          }]
        : []
    ));

    const lambda = plan.protocol.ridgeLambda;
    const currentBeta = fitOffsetCoordinateRidge(
      training.map((row) => ({
        baseProbability: row.baseProbability,
        outcome: row.outcome,
        features: row.currentFeatures,
      })),
      lambda,
    );
    const strictBeta = fitOffsetCoordinateRidge(
      training.map((row) => ({
        baseProbability: row.baseProbability,
        outcome: row.outcome,
        features: row.strictFeatures,
      })),
      lambda,
    );
    const retrospectiveBeta = fitOffsetCoordinateRidge(
      training.map((row) => ({
        baseProbability: row.baseProbability,
        outcome: row.outcome,
        features: row.retrospectiveFeatures,
      })),
      lambda,
    );

    const scored: EnrichedMatrixRow[] = enrichedBase.map((row) => ({
      ...row,
      currentCombinedProbability: row.baseProbability === null
        ? null
        : applyOffset(row.baseProbability, row.baseFeatures, currentBeta),
      strictAsOfProbability: row.baseProbability === null
        ? null
        : applyOffset(
            row.baseProbability,
            [...row.baseFeatures, ...row.strictFinanceFeatures],
            strictBeta,
          ),
      retrospectiveActivityProbability: row.baseProbability === null
        ? null
        : applyOffset(
            row.baseProbability,
            [...row.baseFeatures, ...row.retrospectiveFinanceFeatures],
            retrospectiveBeta,
          ),
    }));

    const sessions = [TRAIN_SESSION, VALIDATION_SESSION, DESCRIPTIVE_SESSION] as const;
    const scores = Object.fromEntries(sessions.map((session) => {
      const rows = scored.filter((row) => row.session === session);
      const serving = score(rows, 'baseProbability');
      const current = score(rows, 'currentCombinedProbability');
      const strict = score(rows, 'strictAsOfProbability');
      const retrospective = score(rows, 'retrospectiveActivityProbability');
      return [session, {
        serving,
        currentFixedLambdaCombined: current,
        strictAsOfFinance: strict,
        retrospectiveActivityFinance: retrospective,
        strictMinusCurrent: delta(strict, current),
        retrospectiveMinusCurrent: delta(retrospective, current),
        retrospectiveMinusStrict: delta(retrospective, strict),
      }];
    }));

    const validationRows = scored.filter((row) => row.session === VALIDATION_SESSION);
    const validationByChamber = Object.fromEntries(['house', 'senate'].map((chamber) => {
      const rows = validationRows.filter((row) => row.chamber === chamber);
      const current = score(rows, 'currentCombinedProbability');
      const strict = score(rows, 'strictAsOfProbability');
      const retrospective = score(rows, 'retrospectiveActivityProbability');
      return [chamber, {
        currentFixedLambdaCombined: current,
        strictAsOfFinance: strict,
        retrospectiveActivityFinance: retrospective,
        strictMinusCurrent: delta(strict, current),
        retrospectiveMinusCurrent: delta(retrospective, current),
        retrospectiveMinusStrict: delta(retrospective, strict),
      }];
    }));

    const featureNames = [...QUICK_EVIDENCE_COMBINED_FEATURES, ...FINANCE_FEATURE_NAMES];
    const diagnostic = {
      schemaVersion: 'historical-finance-two-clock-diagnostic-v1',
      generatedAt: new Date().toISOString(),
      issue: 514,
      codeSha: process.env.GITHUB_SHA ?? null,
      twoClockVersion: HISTORICAL_EVIDENCE_TWO_CLOCK_VERSION,
      purpose:
        'Separate strict historical observability from retrospective pre-vote activity signal without changing the canonical #459 replay.',
      independentValidationSet: false,
      productionAction: 'none',
      servingChanged: false,
      evidenceWrites: false,
      clocks: {
        strictAsOf: {
          sourceDate: 'evidence_items.published_at',
          eligibility:
            "asOfEligible=true AND published_at IS NOT NULL AND transactionDateIsAvailability=false",
          cutoff: 'public availability date < vote date',
          supportsHistoricalReplayClaims: true,
        },
        retrospectiveActivity: {
          sourceDate: 'metadata.transactionDate',
          cutoff: 'underlying activity date < vote date',
          supportsHistoricalReplayClaims: false,
          supportsRetrospectiveSignalLearning: true,
          note:
            'This lane may use information learned only after the historical vote; it must never be described as contemporaneously observable.',
        },
      },
      fixedProtocol: {
        lambda,
        lambdaRetunedAfterValidation: false,
        maximumAbsoluteLogitDelta: QUICK_EVIDENCE_MAX_ABS_LOGIT_DELTA,
        trainSession: TRAIN_SESSION,
        validationSession: VALIDATION_SESSION,
        descriptiveSession: DESCRIPTIVE_SESSION,
        sameDayExcluded: true,
        baseFeatureCount: QUICK_EVIDENCE_COMBINED_FEATURES.length,
        financeFeatureCount: FINANCE_FEATURE_NAMES.length,
        financeFeatureNames: [...FINANCE_FEATURE_NAMES],
      },
      sourceRows: {
        candidateFinanceRowsWithTransactionDate: financeRows.length,
        rowsWithProvenPublicAvailability: financeRows.filter((row) => Boolean(row.availableOn)).length,
        retrospectiveActivityOnlyRows: financeRows.filter((row) => !row.availableOn).length,
        bySessionChamber: sourceCoverage(financeRows),
        currentDurableRowCaveat:
          'Rows are exact durable CFB row identities. Corrected source values may create a new row identity; this exploratory lane does not claim contemporaneous version observability.',
      },
      matrixAvailability: matrixCoverage(scored),
      coefficients: {
        currentFixedLambdaCombined: Object.fromEntries(
          QUICK_EVIDENCE_COMBINED_FEATURES.map((name, index) => [name, currentBeta[index]]),
        ),
        strictAsOfFinance: Object.fromEntries(
          featureNames.map((name, index) => [name, strictBeta[index]]),
        ),
        retrospectiveActivityFinance: Object.fromEntries(
          featureNames.map((name, index) => [name, retrospectiveBeta[index]]),
        ),
      },
      scores,
      validationSlices: {
        byChamber: validationByChamber,
        retrospectiveClockChangedMembers: validationMoved(scored),
      },
      interpretation: {
        strictLane: 'historical_as_of_replay',
        retrospectiveActivityLane: 'signal_learning_only',
        moneyImpliesVoteStance: false,
        automaticPromotion: false,
        productionAction: 'none',
        canonical459ArtifactRemainsFrozen: true,
        nextEvaluation:
          'Use prospective #287 captures for any serving decision; the retrospective lane can motivate predeclared future features but cannot establish historical live accuracy.',
      },
    };

    mkdirSync(resolve(outputPath, '..'), { recursive: true });
    writeFileSync(outputPath, JSON.stringify(diagnostic, null, 2) + '\n', { mode: 0o600 });

    console.log(JSON.stringify({
      historicalFinanceTwoClock: {
        sourceRows: diagnostic.sourceRows,
        matrixAvailability: diagnostic.matrixAvailability,
        validation: diagnostic.scores[VALIDATION_SESSION],
        changedValidationMembers:
          diagnostic.validationSlices.retrospectiveClockChangedMembers.memberOutcomes,
        productionAction: diagnostic.productionAction,
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
