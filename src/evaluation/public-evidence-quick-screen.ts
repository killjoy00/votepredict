import type { Pool } from 'pg';
import { simulateChamber } from '@/forecasting/chamber';
import { ordinaryMinnesotaPassageRule } from '@/forecasting/minnesota-rules';
import { loadHistoricalQuickReplayDataset } from './historical-quick-replay-dataset';
import { runHistoricalQuickDecayShadowReplay } from './historical-quick-decay-shadow-replay';
import { scoreHistoricalQuickReplay, type HistoricalQuickReplayEventResult } from './historical-quick-replay';
import { loadPublicFinanceDataset, type PublicFinanceTransaction } from './public-finance-data';

export const PUBLIC_EVIDENCE_QUICK_SCREEN_SCHEMA = 'public-evidence-quick-screen-v1' as const;
const HALF_LIFE_DAYS = 180;
const FEATURE_NAMES = ['logReceipts', 'logCampaignSpending', 'logIndependentSpending', 'logTransactions'] as const;
const LAMBDAS = [0.1, 1, 5, 20, 100] as const;

type Vector = [number, number, number, number];
type SessionSlug = '2021-2022' | '2023-2024' | '2025-2026';

type MemberIdentity = { name: string; chamber: 'house' | 'senate' };
type ScreenObservation = {
  eventId: string;
  membershipId: string;
  session: SessionSlug;
  baseProbability: number;
  outcome: 0 | 1;
  features: Vector;
};

type Standardization = { mean: Vector; scale: Vector };

function clampProbability(value: number): number {
  return Math.min(0.995, Math.max(0.005, value));
}

function logistic(value: number): number {
  if (value >= 0) return 1 / (1 + Math.exp(-value));
  const exp = Math.exp(value);
  return exp / (1 + exp);
}

function logit(probability: number): number {
  const p = clampProbability(probability);
  return Math.log(p / (1 - p));
}

function normalizeToken(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function publicFinanceMemberMatchKey(name: string): string | undefined {
  const ignored = new Set(['jr', 'sr', 'ii', 'iii', 'iv']);
  const tokens = name.split(/\s+/).map(normalizeToken).filter((token) => token && !ignored.has(token));
  if (tokens.length === 0) return undefined;
  const first = tokens.find((token) => token.length > 1) ?? tokens[0];
  const last = tokens[tokens.length - 1];
  return `${first}|${last}`;
}

function sessionStart(session: string): string | undefined {
  const year = Number(session.slice(0, 4));
  return Number.isInteger(year) && year >= 2000 ? `${year}-01-01` : undefined;
}

export function publicFinanceFeatures(
  transactions: readonly PublicFinanceTransaction[],
  session: string,
  occurredOn: string,
): Vector | undefined {
  const start = sessionStart(session);
  if (!start) return undefined;
  let receipts = 0;
  let spending = 0;
  let independent = 0;
  let count = 0;
  for (const row of transactions) {
    if (row.occurredOn < start || row.occurredOn >= occurredOn) continue;
    count += 1;
    if (row.kind === 'receipts') receipts += row.amount;
    else if (row.kind === 'spending') spending += row.amount;
    else independent += Math.abs(row.amount);
  }
  if (count === 0) return undefined;
  return [
    Math.log1p(Math.max(0, receipts)),
    Math.log1p(Math.max(0, spending)),
    Math.log1p(Math.max(0, independent)),
    Math.log1p(count),
  ];
}

export function fitStandardization(vectors: readonly Vector[]): Standardization {
  if (vectors.length === 0) throw new Error('Cannot standardize an empty public-finance training set');
  const mean = FEATURE_NAMES.map((_, index) => vectors.reduce((sum, row) => sum + row[index], 0) / vectors.length) as Vector;
  const scale = FEATURE_NAMES.map((_, index) => {
    const variance = vectors.reduce((sum, row) => sum + (row[index] - mean[index]) ** 2, 0) / Math.max(1, vectors.length - 1);
    const sd = Math.sqrt(variance);
    return sd > 1e-9 ? sd : 1;
  }) as Vector;
  return { mean, scale };
}

export function standardizeVector(vector: Vector, standardization: Standardization): Vector {
  return vector.map((value, index) => (value - standardization.mean[index]) / standardization.scale[index]) as Vector;
}

function solveLinearSystem(matrix: number[][], vector: number[]): number[] {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
    }
    if (Math.abs(augmented[pivot][column]) < 1e-12) return Array.from({ length: size }, () => 0);
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const divisor = augmented[column][column];
    for (let entry = column; entry <= size; entry += 1) augmented[column][entry] /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = augmented[row][column];
      for (let entry = column; entry <= size; entry += 1) augmented[row][entry] -= factor * augmented[column][entry];
    }
  }
  return augmented.map((row) => row[size]);
}

/** Ridge logistic regression with the serving Quick logit as a fixed offset. */
export function fitOffsetRidge(
  observations: readonly { baseProbability: number; outcome: 0 | 1; features: Vector }[],
  lambda: number,
): Vector {
  if (observations.length < 100) throw new Error(`Public-finance training coverage is too small: ${observations.length}`);
  let beta: Vector = [0, 0, 0, 0];
  for (let iteration = 0; iteration < 30; iteration += 1) {
    const gradient = [0, 0, 0, 0];
    const information = Array.from({ length: 4 }, (_, row) => Array.from({ length: 4 }, (_, column) => row === column ? lambda : 0));
    for (const observation of observations) {
      const eta = logit(observation.baseProbability)
        + observation.features.reduce((sum, value, index) => sum + value * beta[index], 0);
      const probability = logistic(eta);
      const weight = Math.max(1e-8, probability * (1 - probability));
      const residual = observation.outcome - probability;
      for (let row = 0; row < 4; row += 1) {
        gradient[row] += observation.features[row] * residual - lambda * beta[row] / observations.length;
        for (let column = 0; column < 4; column += 1) {
          information[row][column] += observation.features[row] * observation.features[column] * weight;
        }
      }
    }
    const delta = solveLinearSystem(information, gradient);
    beta = beta.map((value, index) => value + delta[index]) as Vector;
    if (Math.max(...delta.map(Math.abs)) < 1e-7) break;
  }
  return beta;
}

export function applyFinanceOffset(baseProbability: number, standardizedFeatures: Vector, beta: Vector): number {
  const delta = standardizedFeatures.reduce((sum, value, index) => sum + value * beta[index], 0);
  return clampProbability(logistic(logit(baseProbability) + delta));
}

function groupedTransactions(rows: readonly PublicFinanceTransaction[]): Map<string, PublicFinanceTransaction[]> {
  const grouped = new Map<string, PublicFinanceTransaction[]>();
  for (const row of rows) {
    const key = `${row.chamber}|${row.matchKey}`;
    const bucket = grouped.get(key) ?? [];
    bucket.push(row);
    grouped.set(key, bucket);
  }
  for (const bucket of grouped.values()) bucket.sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));
  return grouped;
}

function scoreBySession(events: readonly HistoricalQuickReplayEventResult[], session: SessionSlug) {
  return scoreHistoricalQuickReplay(events.filter((event) => event.session === session));
}

function adjustReplay(
  baseline: readonly HistoricalQuickReplayEventResult[],
  featureByMemberEvent: ReadonlyMap<string, Vector>,
  standardization: Standardization,
  beta: Vector,
): HistoricalQuickReplayEventResult[] {
  return baseline.map((event) => {
    const memberPredictions = event.memberPredictions.map((member) => {
      const features = featureByMemberEvent.get(`${event.voteEventId}|${member.membershipId}`);
      if (!features || member.yesProbability === undefined) return member;
      return {
        ...member,
        yesProbability: applyFinanceOffset(member.yesProbability, standardizeVector(features, standardization), beta),
      };
    });
    if (event.status !== 'replayable' || memberPredictions.some((member) => member.yesProbability === undefined)) {
      return { ...event, memberPredictions };
    }
    const chamber = simulateChamber(
      memberPredictions.map((member) => member.yesProbability as number),
      ordinaryMinnesotaPassageRule(event.chamber),
    );
    return {
      ...event,
      memberPredictions,
      passageProbability: chamber.passageProbability,
      expectedYes: chamber.expectedYes,
      yesLow: chamber.yesLow,
      yesHigh: chamber.yesHigh,
    };
  });
}

function delta(candidate: ReturnType<typeof scoreHistoricalQuickReplay>, baseline: ReturnType<typeof scoreHistoricalQuickReplay>) {
  return {
    memberBrier: candidate.memberBrier - baseline.memberBrier,
    memberLogLoss: candidate.memberLogLoss - baseline.memberLogLoss,
    memberExpectedCalibrationError: candidate.memberExpectedCalibrationError - baseline.memberExpectedCalibrationError,
    chamberMeanAbsoluteYesError: candidate.chamberMeanAbsoluteYesError - baseline.chamberMeanAbsoluteYesError,
    passageBrier: candidate.passageBrier - baseline.passageBrier,
    passageAccuracy: candidate.passageAccuracy - baseline.passageAccuracy,
  };
}

export async function evaluatePublicEvidenceQuickScreen(pool: Pool, options: { codeSha?: string | null } = {}) {
  const [dataset, finance, identitiesResult] = await Promise.all([
    loadHistoricalQuickReplayDataset(pool),
    loadPublicFinanceDataset(),
    pool.query<{ membership_id: string; name: string; chamber_slug: 'house' | 'senate' }>(`
      SELECT m.id::text AS membership_id,l.name,c.slug AS chamber_slug
        FROM memberships m
        JOIN legislators l ON l.id=m.legislator_id
        JOIN chambers c ON c.id=m.chamber_id
        JOIN legislative_sessions s ON s.id=m.session_id
        JOIN jurisdictions j ON j.id=s.jurisdiction_id AND j.slug='us-mn'`),
  ]);

  const identityByMembership = new Map<string, MemberIdentity>(identitiesResult.rows.map((row) => [row.membership_id, {
    name: row.name,
    chamber: row.chamber_slug,
  }]));
  const financeByCandidate = groupedTransactions(finance.transactions);
  const baseline = runHistoricalQuickDecayShadowReplay(
    dataset.targets,
    dataset.targetVersionByEvent,
    dataset.analogueSupportByEvent,
    dataset.memberships,
    dataset.historicalVotes,
    HALF_LIFE_DAYS,
  );

  const featureByMemberEvent = new Map<string, Vector>();
  const observations: ScreenObservation[] = [];
  for (const event of baseline) {
    if (!['2021-2022', '2023-2024', '2025-2026'].includes(event.session)) continue;
    for (const member of event.memberPredictions) {
      const identity = identityByMembership.get(member.membershipId);
      if (!identity) continue;
      const matchKey = publicFinanceMemberMatchKey(identity.name);
      if (!matchKey) continue;
      const series = financeByCandidate.get(`${identity.chamber}|${matchKey}`);
      if (!series) continue;
      const features = publicFinanceFeatures(series, event.session, event.occurredOn);
      if (!features) continue;
      featureByMemberEvent.set(`${event.voteEventId}|${member.membershipId}`, features);
      if (member.yesProbability === undefined || member.actualOutcome === undefined) continue;
      observations.push({
        eventId: event.voteEventId,
        membershipId: member.membershipId,
        session: event.session as SessionSlug,
        baseProbability: member.yesProbability,
        outcome: member.actualOutcome,
        features,
      });
    }
  }

  const training = observations.filter((row) => row.session === '2021-2022');
  const validation = observations.filter((row) => row.session === '2023-2024');
  const descriptiveTest = observations.filter((row) => row.session === '2025-2026');
  if (training.length < 500 || validation.length < 500) {
    throw new Error(`Insufficient leakage-safe campaign-finance coverage: train=${training.length}, validation=${validation.length}`);
  }
  const standardization = fitStandardization(training.map((row) => row.features));
  const standardizedTraining = training.map((row) => ({
    baseProbability: row.baseProbability,
    outcome: row.outcome,
    features: standardizeVector(row.features, standardization),
  }));

  const baselineScores = {
    training: scoreBySession(baseline, '2021-2022'),
    validation: scoreBySession(baseline, '2023-2024'),
    descriptiveTest: scoreBySession(baseline, '2025-2026'),
  };

  const candidates = LAMBDAS.map((lambda) => {
    const beta = fitOffsetRidge(standardizedTraining, lambda);
    const replay = adjustReplay(baseline, featureByMemberEvent, standardization, beta);
    const validationScore = scoreBySession(replay, '2023-2024');
    return {
      lambda,
      beta,
      validationScore,
      validationDelta: delta(validationScore, baselineScores.validation),
      replay,
    };
  }).sort((left, right) => left.validationScore.memberBrier - right.validationScore.memberBrier
    || left.validationScore.memberLogLoss - right.validationScore.memberLogLoss
    || left.validationScore.chamberMeanAbsoluteYesError - right.validationScore.chamberMeanAbsoluteYesError
    || left.lambda - right.lambda);

  const selected = candidates[0];
  const candidateScores = {
    training: scoreBySession(selected.replay, '2021-2022'),
    validation: selected.validationScore,
    descriptiveTest: scoreBySession(selected.replay, '2025-2026'),
  };
  const validationDelta = delta(candidateScores.validation, baselineScores.validation);
  const descriptiveTestDelta = delta(candidateScores.descriptiveTest, baselineScores.descriptiveTest);
  const prospectiveShadowNomination = validationDelta.memberBrier <= -0.0005
    && validationDelta.memberLogLoss <= 0
    && validationDelta.chamberMeanAbsoluteYesError <= 0.25
    && validationDelta.passageBrier <= 0.002;

  const coverage = (session: SessionSlug) => {
    const sessionObservations = observations.filter((row) => row.session === session);
    const totalOutcomes = baseline
      .filter((event) => event.session === session)
      .flatMap((event) => event.memberPredictions)
      .filter((member) => member.yesProbability !== undefined && member.actualOutcome !== undefined).length;
    return {
      financeMemberOutcomes: sessionObservations.length,
      totalQuickMemberOutcomes: totalOutcomes,
      financeCoverage: totalOutcomes > 0 ? sessionObservations.length / totalOutcomes : 0,
      eventsWithFinance: new Set(sessionObservations.map((row) => row.eventId)).size,
    };
  };

  return {
    schemaVersion: PUBLIC_EVIDENCE_QUICK_SCREEN_SCHEMA,
    generatedAt: new Date().toISOString(),
    purpose: 'retrospective leakage-safe screen of non-directional dated campaign-finance activity as an incremental offset to serving Quick member probabilities; news and campaign-site content remain prospective-only because comparable historical web capture is unavailable',
    metadata: {
      codeSha: options.codeSha ?? null,
      servingBaseline: 'member-eb-v1.2-decay180',
      memberHistoryHalfLifeDays: HALF_LIFE_DAYS,
      trainSession: '2021-2022',
      validationSession: '2023-2024',
      descriptiveTestSession: '2025-2026',
      featureNames: FEATURE_NAMES,
      candidateLambdas: LAMBDAS,
      sourceBoundary: 'official Minnesota CFB transaction rows dated strictly before each target floor-vote date; only aggregate activity amounts/counts are used; donor identities, employers, donor categories, and inferred issue positions are excluded',
      probabilityWrite: false,
      servingChange: false,
      selectionGuard: 'lambda selected on 2023-2024 only; 2025-2026 is reported descriptively and cannot select configuration',
    },
    financeDiagnostics: finance.diagnostics,
    coverage: {
      training: coverage('2021-2022'),
      validation: coverage('2023-2024'),
      descriptiveTest: coverage('2025-2026'),
    },
    standardization,
    candidates: candidates.map((candidate) => ({
      lambda: candidate.lambda,
      beta: candidate.beta,
      validation: candidate.validationScore,
      deltaVsServing: candidate.validationDelta,
    })),
    selected: {
      lambda: selected.lambda,
      beta: selected.beta,
      baseline: baselineScores,
      candidate: candidateScores,
      deltaCandidateMinusBaseline: {
        training: delta(candidateScores.training, baselineScores.training),
        validation: validationDelta,
        descriptiveTest: descriptiveTestDelta,
      },
    },
    conclusion: {
      productionAction: 'none',
      servingQuickChanged: false,
      prospectiveShadowNomination,
      newsCampaignSiteAction: 'capture prospectively as durable non-mechanical evidence; evaluate after future outcomes exist',
      note: prospectiveShadowNomination
        ? 'The frozen validation guardrails nominate this finance-only candidate for a future prospective shadow. Retrospective results do not authorize a serving Quick change.'
        : 'The finance-only candidate did not clear the frozen validation guardrails. Keep finance as context and continue prospective news/campaign-site capture without changing Quick probabilities.',
    },
  };
}
