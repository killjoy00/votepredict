import {
  HISTORICAL_DEEP_DISCOVERY_CANDIDATE_SCHEMA,
  type HistoricalDeepDiscoveryCandidate,
  type HistoricalDeepDiscoveryCandidateBundle,
} from './historical-deep-discovery-extractor';
import {
  HISTORICAL_DEEP_PILOT_CASES,
  type HistoricalDeepPilotSpec,
} from './historical-deep-pilot';
import { selectHistoricalDeepTargets } from './historical-deep-targets';
import type {
  HistoricalQuickReplayEventResult,
  HistoricalQuickReplayMemberPrediction,
} from './historical-quick-replay';

export const HISTORICAL_DEEP_DISCOVERY_SCORE_SCHEMA = 'historical-deep-discovery-score-v1' as const;

export type ProceduralMotionDirection = 'advance' | 'block' | 'ambiguous';
export type InferredAdvancementOutcome = 0 | 1;

export interface HistoricalDeepDiscoveryScoringCase {
  spec: HistoricalDeepPilotSpec;
  replay: HistoricalQuickReplayEventResult;
}

export interface HistoricalDeepDiscoveryScoreMetrics {
  memberObservations: number;
  quickErrors: number;
  highConfidenceQuickErrors: number;
  currentDeepSelected: number;
  currentDeepSelectedErrors: number;
  currentDeepErrorRecall: number;
  currentDeepSelectedHighConfidenceErrors: number;
  currentDeepHighConfidenceErrorRecall: number;
  candidatePairs: number;
  candidatePairCoverage: number;
  candidatePairsOnQuickErrors: number;
  candidateErrorCoverage: number;
  candidatePairsOnHighConfidenceErrors: number;
  candidateHighConfidenceErrorCoverage: number;
  directionalPairs: number;
  mixedDirectionalPairs: number;
  directionalPairsOnQuickErrors: number;
  directionalErrorCoverage: number;
  directionalPairsOnHighConfidenceErrors: number;
  directionalHighConfidenceErrorCoverage: number;
  directionAgreementWithFloor: number;
  challengePairs: number;
  correctChallenges: number;
  wrongChallenges: number;
  challengePrecision: number;
  quickErrorCorrectionRecall: number;
  highConfidenceCorrectChallenges: number;
  highConfidenceErrorCorrectionRecall: number;
  quickErrorsOutsideCurrentDeep: number;
  correctChallengesOutsideCurrentDeep: number;
  outsideCurrentDeepErrorCorrectionRecall: number;
  highConfidenceErrorsOutsideCurrentDeep: number;
  highConfidenceCorrectChallengesOutsideCurrentDeep: number;
  outsideCurrentDeepHighConfidenceErrorCorrectionRecall: number;
}

export interface HistoricalDeepDiscoveryChallengeExample {
  identifier: string;
  occurredOn: string;
  memberName: string;
  party: string;
  quickYesProbability: number;
  quickPredictedOutcome: 0 | 1;
  actualOutcome: 0 | 1;
  inferredOutcome: 0 | 1;
  correct: boolean;
  highConfidenceQuickError: boolean;
  selectedForCurrentDeep: boolean;
  observations: Array<{
    sourceId: string;
    publishedAt: string;
    voteSide: 'aye' | 'nay';
    motionDirection: ProceduralMotionDirection;
    motionText: string;
  }>;
}

export interface HistoricalDeepDiscoveryCaseScore {
  identifier: string;
  occurredOn: string;
  metrics: HistoricalDeepDiscoveryScoreMetrics;
}

export interface HistoricalDeepDiscoveryScore {
  schemaVersion: typeof HISTORICAL_DEEP_DISCOVERY_SCORE_SCHEMA;
  generatedAt: string;
  metadata: {
    highConfidenceThreshold: number;
    candidateSchemaVersion: string;
    purpose: string;
    outcomeJoinBoundary: string;
  };
  overall: HistoricalDeepDiscoveryScoreMetrics;
  cases: HistoricalDeepDiscoveryCaseScore[];
  challengeExamples: HistoricalDeepDiscoveryChallengeExample[];
}

type ScorablePrediction = HistoricalQuickReplayMemberPrediction & {
  yesProbability: number;
  actualOutcome: 0 | 1;
};

interface Observation {
  caseKey: string;
  identifier: string;
  occurredOn: string;
  prediction: ScorablePrediction;
  quickOutcome: 0 | 1;
  quickError: boolean;
  highConfidenceQuickError: boolean;
  selectedForCurrentDeep: boolean;
  candidatePair: boolean;
  inferredOutcome?: 0 | 1;
  mixedDirectional: boolean;
  challenge: boolean;
  correctChallenge: boolean;
  challengeExample?: HistoricalDeepDiscoveryChallengeExample;
}

const FORBIDDEN_CANDIDATE_KEYS = new Set([
  'actualOutcome',
  'actualYes',
  'actualNay',
  'passed',
  'floorOutcome',
  'resolvedOutcome',
]);

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function finiteProbability(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value >= 0 && value <= 1;
}

function scorable(prediction: HistoricalQuickReplayMemberPrediction): prediction is ScorablePrediction {
  return finiteProbability(prediction.yesProbability) && prediction.actualOutcome !== undefined;
}

function caseKey(value: Pick<HistoricalDeepPilotSpec, 'session' | 'chamber' | 'identifier' | 'occurredOn'>): string {
  return `${value.session}|${value.chamber}|${value.identifier}|${value.occurredOn}`;
}

function candidateCaseKey(candidate: HistoricalDeepDiscoveryCandidate): string {
  return `${candidate.case.session}|${candidate.case.chamber}|${candidate.case.identifier}|${candidate.case.occurredOn}`;
}

function assertNoForbiddenKeys(value: unknown, path = '$'): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenKeys(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_CANDIDATE_KEYS.has(key)) {
      throw new Error(`Candidate artifact contains forbidden outcome field ${path}.${key}`);
    }
    assertNoForbiddenKeys(nested, `${path}.${key}`);
  }
}

export function validateHistoricalDeepDiscoveryCandidateBundle(
  bundle: HistoricalDeepDiscoveryCandidateBundle,
): void {
  if (bundle.schemaVersion !== HISTORICAL_DEEP_DISCOVERY_CANDIDATE_SCHEMA) {
    throw new Error(`Unsupported historical discovery candidate schema: ${String(bundle.schemaVersion)}`);
  }
  if (!Array.isArray(bundle.candidates)) throw new Error('Historical discovery candidates must be an array');
  assertNoForbiddenKeys(bundle);
  const allowedCases = new Set(HISTORICAL_DEEP_PILOT_CASES.map(caseKey));
  for (const candidate of bundle.candidates) {
    const key = candidateCaseKey(candidate);
    if (!allowedCases.has(key)) throw new Error(`Candidate references unknown pilot case: ${key}`);
    const published = new Date(candidate.source.publishedAt).getTime();
    const voteDay = new Date(`${candidate.case.occurredOn}T00:00:00.000Z`).getTime();
    if (!Number.isFinite(published) || !Number.isFinite(voteDay) || published >= voteDay) {
      throw new Error(`Candidate ${candidate.source.sourceId}/${candidate.legislatorId} is not strictly pre-vote`);
    }
  }
}

export function classifyHistoricalProceduralMotion(motionText: string): ProceduralMotionDirection {
  if (/\btable\b/i.test(motionText)) return 'block';
  if (/\bre-?refer(?:red)?\b/i.test(motionText)) return 'advance';
  if (/\brecommend(?:ed)?\b[^.]{0,80}\bpass\b/i.test(motionText)) return 'advance';
  if (/\brefer(?:red)?\b/i.test(motionText) && !/\bamendment\b/i.test(motionText)) return 'advance';
  return 'ambiguous';
}

export function inferredAdvancementOutcome(
  motionText: string,
  voteSide: 'aye' | 'nay',
): InferredAdvancementOutcome | undefined {
  const direction = classifyHistoricalProceduralMotion(motionText);
  if (direction === 'ambiguous') return undefined;
  if (direction === 'advance') return voteSide === 'aye' ? 1 : 0;
  return voteSide === 'aye' ? 0 : 1;
}

function scoreMetrics(observations: readonly Observation[]): HistoricalDeepDiscoveryScoreMetrics {
  const quickErrors = observations.filter((item) => item.quickError);
  const highConfidenceErrors = observations.filter((item) => item.highConfidenceQuickError);
  const currentDeep = observations.filter((item) => item.selectedForCurrentDeep);
  const candidatePairs = observations.filter((item) => item.candidatePair);
  const directional = observations.filter((item) => item.inferredOutcome !== undefined);
  const directionalErrors = directional.filter((item) => item.quickError);
  const directionalHighConfidenceErrors = directional.filter((item) => item.highConfidenceQuickError);
  const directionalCorrect = directional.filter((item) => item.inferredOutcome === item.prediction.actualOutcome);
  const challenges = observations.filter((item) => item.challenge);
  const correctChallenges = challenges.filter((item) => item.correctChallenge);
  const wrongChallenges = challenges.filter((item) => !item.correctChallenge);
  const highConfidenceCorrectChallenges = correctChallenges.filter((item) => item.highConfidenceQuickError);
  const errorsOutsideCurrentDeep = quickErrors.filter((item) => !item.selectedForCurrentDeep);
  const correctChallengesOutsideCurrentDeep = correctChallenges.filter((item) => !item.selectedForCurrentDeep);
  const highConfidenceErrorsOutsideCurrentDeep = highConfidenceErrors.filter((item) => !item.selectedForCurrentDeep);
  const highConfidenceCorrectChallengesOutsideCurrentDeep = highConfidenceCorrectChallenges.filter(
    (item) => !item.selectedForCurrentDeep,
  );

  return {
    memberObservations: observations.length,
    quickErrors: quickErrors.length,
    highConfidenceQuickErrors: highConfidenceErrors.length,
    currentDeepSelected: currentDeep.length,
    currentDeepSelectedErrors: currentDeep.filter((item) => item.quickError).length,
    currentDeepErrorRecall: ratio(currentDeep.filter((item) => item.quickError).length, quickErrors.length),
    currentDeepSelectedHighConfidenceErrors: currentDeep.filter((item) => item.highConfidenceQuickError).length,
    currentDeepHighConfidenceErrorRecall: ratio(
      currentDeep.filter((item) => item.highConfidenceQuickError).length,
      highConfidenceErrors.length,
    ),
    candidatePairs: candidatePairs.length,
    candidatePairCoverage: ratio(candidatePairs.length, observations.length),
    candidatePairsOnQuickErrors: candidatePairs.filter((item) => item.quickError).length,
    candidateErrorCoverage: ratio(candidatePairs.filter((item) => item.quickError).length, quickErrors.length),
    candidatePairsOnHighConfidenceErrors: candidatePairs.filter((item) => item.highConfidenceQuickError).length,
    candidateHighConfidenceErrorCoverage: ratio(
      candidatePairs.filter((item) => item.highConfidenceQuickError).length,
      highConfidenceErrors.length,
    ),
    directionalPairs: directional.length,
    mixedDirectionalPairs: observations.filter((item) => item.mixedDirectional).length,
    directionalPairsOnQuickErrors: directionalErrors.length,
    directionalErrorCoverage: ratio(directionalErrors.length, quickErrors.length),
    directionalPairsOnHighConfidenceErrors: directionalHighConfidenceErrors.length,
    directionalHighConfidenceErrorCoverage: ratio(directionalHighConfidenceErrors.length, highConfidenceErrors.length),
    directionAgreementWithFloor: ratio(directionalCorrect.length, directional.length),
    challengePairs: challenges.length,
    correctChallenges: correctChallenges.length,
    wrongChallenges: wrongChallenges.length,
    challengePrecision: ratio(correctChallenges.length, challenges.length),
    quickErrorCorrectionRecall: ratio(correctChallenges.length, quickErrors.length),
    highConfidenceCorrectChallenges: highConfidenceCorrectChallenges.length,
    highConfidenceErrorCorrectionRecall: ratio(highConfidenceCorrectChallenges.length, highConfidenceErrors.length),
    quickErrorsOutsideCurrentDeep: errorsOutsideCurrentDeep.length,
    correctChallengesOutsideCurrentDeep: correctChallengesOutsideCurrentDeep.length,
    outsideCurrentDeepErrorCorrectionRecall: ratio(
      correctChallengesOutsideCurrentDeep.length,
      errorsOutsideCurrentDeep.length,
    ),
    highConfidenceErrorsOutsideCurrentDeep: highConfidenceErrorsOutsideCurrentDeep.length,
    highConfidenceCorrectChallengesOutsideCurrentDeep: highConfidenceCorrectChallengesOutsideCurrentDeep.length,
    outsideCurrentDeepHighConfidenceErrorCorrectionRecall: ratio(
      highConfidenceCorrectChallengesOutsideCurrentDeep.length,
      highConfidenceErrorsOutsideCurrentDeep.length,
    ),
  };
}

export function scoreHistoricalDeepDiscoveryCandidates(
  bundle: HistoricalDeepDiscoveryCandidateBundle,
  scoringCases: readonly HistoricalDeepDiscoveryScoringCase[],
  options: { highConfidenceThreshold?: number; generatedAt?: string } = {},
): HistoricalDeepDiscoveryScore {
  validateHistoricalDeepDiscoveryCandidateBundle(bundle);
  const highConfidenceThreshold = options.highConfidenceThreshold ?? 0.9;
  if (!Number.isFinite(highConfidenceThreshold) || highConfidenceThreshold <= 0.5 || highConfidenceThreshold >= 1) {
    throw new Error('highConfidenceThreshold must be between 0.5 and 1');
  }

  const scoringByCase = new Map(scoringCases.map((item) => [caseKey(item.spec), item]));
  const candidatesByPair = new Map<string, HistoricalDeepDiscoveryCandidate[]>();
  for (const candidate of bundle.candidates) {
    const key = candidateCaseKey(candidate);
    if (!scoringByCase.has(key)) throw new Error(`No scoring case available for candidate case ${key}`);
    const pairKey = `${key}|${candidate.legislatorId}`;
    const current = candidatesByPair.get(pairKey) ?? [];
    current.push(candidate);
    candidatesByPair.set(pairKey, current);
  }

  const observations: Observation[] = [];
  for (const item of scoringCases) {
    const key = caseKey(item.spec);
    if (item.replay.status !== 'replayable') throw new Error(`Pilot case ${key} is not replayable: ${item.replay.status}`);
    const selectedMembershipIds = new Set(
      selectHistoricalDeepTargets(item.replay).map((target) => target.membershipId),
    );
    for (const prediction of item.replay.memberPredictions) {
      if (!scorable(prediction)) continue;
      const pairCandidates = candidatesByPair.get(`${key}|${prediction.legislatorId}`) ?? [];
      const inferredSet = new Set<0 | 1>();
      const directionalObservations: HistoricalDeepDiscoveryChallengeExample['observations'] = [];
      for (const candidate of pairCandidates) {
        const direction = classifyHistoricalProceduralMotion(candidate.motionText);
        const inferred = inferredAdvancementOutcome(candidate.motionText, candidate.voteSide);
        if (inferred !== undefined) inferredSet.add(inferred);
        directionalObservations.push({
          sourceId: candidate.source.sourceId,
          publishedAt: candidate.source.publishedAt,
          voteSide: candidate.voteSide,
          motionDirection: direction,
          motionText: candidate.motionText,
        });
      }
      const inferredOutcome = inferredSet.size === 1 ? [...inferredSet][0] : undefined;
      const mixedDirectional = inferredSet.size > 1;
      const quickOutcome: 0 | 1 = prediction.yesProbability >= 0.5 ? 1 : 0;
      const quickError = quickOutcome !== prediction.actualOutcome;
      const highConfidenceQuickError = quickError && (
        prediction.actualOutcome === 1
          ? prediction.yesProbability <= 1 - highConfidenceThreshold
          : prediction.yesProbability >= highConfidenceThreshold
      );
      const challenge = inferredOutcome !== undefined && inferredOutcome !== quickOutcome;
      const correctChallenge = challenge && inferredOutcome === prediction.actualOutcome;
      const selectedForCurrentDeep = selectedMembershipIds.has(prediction.membershipId);
      const candidate = pairCandidates[0];
      observations.push({
        caseKey: key,
        identifier: item.spec.identifier,
        occurredOn: item.spec.occurredOn,
        prediction,
        quickOutcome,
        quickError,
        highConfidenceQuickError,
        selectedForCurrentDeep,
        candidatePair: pairCandidates.length > 0,
        inferredOutcome,
        mixedDirectional,
        challenge,
        correctChallenge,
        challengeExample: challenge && candidate && inferredOutcome !== undefined
          ? {
            identifier: item.spec.identifier,
            occurredOn: item.spec.occurredOn,
            memberName: candidate.memberName,
            party: candidate.party,
            quickYesProbability: prediction.yesProbability,
            quickPredictedOutcome: quickOutcome,
            actualOutcome: prediction.actualOutcome,
            inferredOutcome,
            correct: correctChallenge,
            highConfidenceQuickError,
            selectedForCurrentDeep,
            observations: directionalObservations,
          }
          : undefined,
      });
    }
  }

  const challengeExamples = observations
    .flatMap((item) => item.challengeExample ? [item.challengeExample] : [])
    .sort((left, right) =>
      Number(right.correct) - Number(left.correct)
      || Number(right.highConfidenceQuickError) - Number(left.highConfidenceQuickError)
      || left.occurredOn.localeCompare(right.occurredOn)
      || left.identifier.localeCompare(right.identifier)
      || left.memberName.localeCompare(right.memberName));

  return {
    schemaVersion: HISTORICAL_DEEP_DISCOVERY_SCORE_SCHEMA,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    metadata: {
      highConfidenceThreshold,
      candidateSchemaVersion: bundle.schemaVersion,
      purpose: 'evaluation-only scoring of an already-frozen pre-vote discovery candidate artifact against historical floor outcomes',
      outcomeJoinBoundary: 'floor outcomes enter only in this scoring stage after candidate artifact lineage is frozen',
    },
    overall: scoreMetrics(observations),
    cases: scoringCases.map((item) => ({
      identifier: item.spec.identifier,
      occurredOn: item.spec.occurredOn,
      metrics: scoreMetrics(observations.filter((observation) => observation.caseKey === caseKey(item.spec))),
    })),
    challengeExamples,
  };
}
