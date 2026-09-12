import type { HistoricalDeepDiscoveryCandidateBundle } from './historical-deep-discovery-extractor';
import { historicalDeepSourceCaseKey } from './historical-deep-source-catalog';

export const HISTORICAL_DEEP_OUTCOME_SNAPSHOT_SCHEMA = 'historical-deep-outcome-snapshot-v1' as const;
export const HISTORICAL_DEEP_DISCOVERY_SCORE_SCHEMA = 'historical-deep-discovery-score-v1' as const;

export interface HistoricalDeepOutcomeMember {
  membershipId: string;
  legislatorId: string;
  memberName: string;
  actualOutcome: 0 | 1;
}

export interface HistoricalDeepOutcomeCase {
  session: string;
  chamber: string;
  identifier: string;
  occurredOn: string;
  voteEventId: string;
  members: HistoricalDeepOutcomeMember[];
}

export interface HistoricalDeepOutcomeSnapshot {
  schemaVersion: typeof HISTORICAL_DEEP_OUTCOME_SNAPSHOT_SCHEMA;
  generatedAt: string;
  codeSha: string | null;
  purpose: string;
  cases: HistoricalDeepOutcomeCase[];
}

export type ProceduralSignal = 'supports_advancement' | 'opposes_advancement' | 'ambiguous';

type MotionDirection = 'advances' | 'impedes' | 'ambiguous';

export function classifyHistoricalDeepMotion(motionText: string): MotionDirection {
  const value = motionText.toLowerCase();
  if (/\btable(?:d|s|ing)?\b/.test(value)) return 'impedes';
  if (/\b(re-?refer|refer(?:red)?|recommend(?:ed)?\s+to\s+pass|recommended\s+to\s+pass)\b/.test(value)) {
    return 'advances';
  }
  // "Lay over" can preserve, delay, or procedurally advance a bill depending on context.
  // It is intentionally not converted into directional evidence here.
  return 'ambiguous';
}

export function proceduralSignal(motionText: string, voteSide: 'aye' | 'nay'): ProceduralSignal {
  const direction = classifyHistoricalDeepMotion(motionText);
  if (direction === 'ambiguous') return 'ambiguous';
  if (direction === 'advances') return voteSide === 'aye' ? 'supports_advancement' : 'opposes_advancement';
  return voteSide === 'aye' ? 'opposes_advancement' : 'supports_advancement';
}

export interface HistoricalDeepDiscoveryScoredPair {
  caseKey: string;
  identifier: string;
  occurredOn: string;
  membershipId: string;
  legislatorId: string;
  memberName: string;
  party: string;
  selectedForCurrentDeep: boolean;
  quickYesProbability?: number;
  outcomeStatus: 'decisive' | 'no_decisive_floor_outcome';
  actualOutcome?: 0 | 1;
  candidateCount: number;
  directionalCandidateCount: number;
  signal: 'supports_advancement' | 'opposes_advancement' | 'conflicting' | 'ambiguous_only';
  signalMatchesFloorOutcome?: boolean;
  quickPredictedOutcome?: 0 | 1;
  quickError?: boolean;
  highConfidenceQuickError?: boolean;
  rescuedQuickError?: boolean;
}

export interface HistoricalDeepDiscoveryScore {
  schemaVersion: typeof HISTORICAL_DEEP_DISCOVERY_SCORE_SCHEMA;
  generatedAt: string;
  purpose: string;
  summary: {
    candidateObservations: number;
    memberCasePairs: number;
    decisiveOutcomePairs: number;
    noDecisiveOutcomePairs: number;
    directionalPairs: number;
    scorableDirectionalPairs: number;
    conflictingPairs: number;
    ambiguousOnlyPairs: number;
    floorAgreementPairs: number;
    floorAgreementRate: number;
    currentDeepPairs: number;
    outsideCurrentDeepPairs: number;
    quickErrorsOnDirectionalPairs: number;
    rescuedQuickErrors: number;
    quickErrorRescueRate: number;
    highConfidenceQuickErrorsOnDirectionalPairs: number;
    rescuedHighConfidenceQuickErrors: number;
  };
  pairs: HistoricalDeepDiscoveryScoredPair[];
}

/**
 * Membership UUIDs are ingestion records and may be regenerated. Legislator IDs are
 * the stable person identity shared by the frozen discovery artifact and a later
 * official-outcome snapshot, so the scorer joins on case + legislator instead.
 */
function stablePairKey(caseKey: string, legislatorId: string): string {
  return `${caseKey}|${legislatorId}`;
}

function predictedOutcome(probability: number): 0 | 1 {
  return probability >= 0.5 ? 1 : 0;
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

export function scoreHistoricalDeepDiscoveryCandidates(
  candidates: HistoricalDeepDiscoveryCandidateBundle,
  outcomes: HistoricalDeepOutcomeSnapshot,
): HistoricalDeepDiscoveryScore {
  if (candidates.schemaVersion !== 'historical-deep-discovery-candidates-v1') {
    throw new Error(`Unsupported candidate schema: ${String(candidates.schemaVersion)}`);
  }
  if (outcomes.schemaVersion !== HISTORICAL_DEEP_OUTCOME_SNAPSHOT_SCHEMA) {
    throw new Error(`Unsupported outcome schema: ${String(outcomes.schemaVersion)}`);
  }

  const outcomeByPair = new Map<string, HistoricalDeepOutcomeMember>();
  const outcomeCaseKeys = new Set<string>();
  for (const outcomeCase of outcomes.cases) {
    const caseKey = historicalDeepSourceCaseKey(outcomeCase);
    if (outcomeCaseKeys.has(caseKey)) throw new Error(`Duplicate frozen outcome case: ${caseKey}`);
    outcomeCaseKeys.add(caseKey);
    for (const member of outcomeCase.members) {
      const key = stablePairKey(caseKey, member.legislatorId);
      if (outcomeByPair.has(key)) {
        throw new Error(`Ambiguous frozen outcomes for ${key}`);
      }
      outcomeByPair.set(key, member);
    }
  }

  const grouped = new Map<string, typeof candidates.candidates>();
  for (const candidate of candidates.candidates) {
    const caseKey = historicalDeepSourceCaseKey(candidate.case);
    const key = stablePairKey(caseKey, candidate.legislatorId);
    const current = grouped.get(key) ?? [];
    current.push(candidate);
    grouped.set(key, current);
  }

  const pairs: HistoricalDeepDiscoveryScoredPair[] = [];
  for (const [key, observations] of grouped) {
    const first = observations[0];
    const caseKey = historicalDeepSourceCaseKey(first.case);
    if (!outcomeCaseKeys.has(caseKey)) throw new Error(`Missing frozen outcome case for ${caseKey}`);
    const outcome = outcomeByPair.get(key);

    const directional = observations
      .map((candidate) => proceduralSignal(candidate.motionText, candidate.voteSide))
      .filter((signal): signal is Exclude<ProceduralSignal, 'ambiguous'> => signal !== 'ambiguous');
    const uniqueSignals = new Set(directional);
    const signal = directional.length === 0
      ? 'ambiguous_only'
      : uniqueSignals.size > 1
        ? 'conflicting'
        : directional[0];
    const quickProbability = first.quickYesProbability;
    const quickPrediction = quickProbability === undefined ? undefined : predictedOutcome(quickProbability);
    const quickError = quickPrediction === undefined || !outcome
      ? undefined
      : quickPrediction !== outcome.actualOutcome;
    const highConfidenceQuickError = quickError === true && quickProbability !== undefined && outcome
      ? (outcome.actualOutcome === 1 ? quickProbability <= 0.1 : quickProbability >= 0.9)
      : false;
    const signalOutcome = signal === 'supports_advancement' ? 1 : signal === 'opposes_advancement' ? 0 : undefined;
    const signalMatchesFloorOutcome = signalOutcome === undefined || !outcome
      ? undefined
      : signalOutcome === outcome.actualOutcome;

    pairs.push({
      caseKey,
      identifier: first.case.identifier,
      occurredOn: first.case.occurredOn,
      // Preserve the frozen discovery membership UUID for provenance; it is not a join key.
      membershipId: first.membershipId,
      legislatorId: first.legislatorId,
      memberName: first.memberName,
      party: first.party,
      selectedForCurrentDeep: observations.some((candidate) => candidate.selectedForCurrentDeep),
      quickYesProbability: quickProbability,
      outcomeStatus: outcome ? 'decisive' : 'no_decisive_floor_outcome',
      actualOutcome: outcome?.actualOutcome,
      candidateCount: observations.length,
      directionalCandidateCount: directional.length,
      signal,
      signalMatchesFloorOutcome,
      quickPredictedOutcome: quickPrediction,
      quickError,
      highConfidenceQuickError,
      rescuedQuickError: quickError === true && signalMatchesFloorOutcome === true,
    });
  }

  pairs.sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.identifier.localeCompare(b.identifier) || a.memberName.localeCompare(b.memberName));
  const directionalPairs = pairs.filter((pair) => pair.signal === 'supports_advancement' || pair.signal === 'opposes_advancement');
  const scorableDirectionalPairs = directionalPairs.filter((pair) => pair.outcomeStatus === 'decisive');
  const floorAgreementPairs = scorableDirectionalPairs.filter((pair) => pair.signalMatchesFloorOutcome).length;
  const quickErrors = scorableDirectionalPairs.filter((pair) => pair.quickError).length;
  const rescued = scorableDirectionalPairs.filter((pair) => pair.rescuedQuickError).length;
  const highConfidenceErrors = scorableDirectionalPairs.filter((pair) => pair.highConfidenceQuickError).length;
  const rescuedHighConfidenceErrors = scorableDirectionalPairs.filter((pair) => pair.highConfidenceQuickError && pair.rescuedQuickError).length;

  return {
    schemaVersion: HISTORICAL_DEEP_DISCOVERY_SCORE_SCHEMA,
    generatedAt: new Date().toISOString(),
    purpose: 'evaluation-only scoring of already-frozen pre-vote procedural discovery signals against later decisive floor outcomes; candidates without a decisive YEA/NAY remain visible but unscored; no targeting, evidence-weight, probability, database, or serving changes',
    summary: {
      candidateObservations: candidates.candidates.length,
      memberCasePairs: pairs.length,
      decisiveOutcomePairs: pairs.filter((pair) => pair.outcomeStatus === 'decisive').length,
      noDecisiveOutcomePairs: pairs.filter((pair) => pair.outcomeStatus === 'no_decisive_floor_outcome').length,
      directionalPairs: directionalPairs.length,
      scorableDirectionalPairs: scorableDirectionalPairs.length,
      conflictingPairs: pairs.filter((pair) => pair.signal === 'conflicting').length,
      ambiguousOnlyPairs: pairs.filter((pair) => pair.signal === 'ambiguous_only').length,
      floorAgreementPairs,
      floorAgreementRate: ratio(floorAgreementPairs, scorableDirectionalPairs.length),
      currentDeepPairs: pairs.filter((pair) => pair.selectedForCurrentDeep).length,
      outsideCurrentDeepPairs: pairs.filter((pair) => !pair.selectedForCurrentDeep).length,
      quickErrorsOnDirectionalPairs: quickErrors,
      rescuedQuickErrors: rescued,
      quickErrorRescueRate: ratio(rescued, quickErrors),
      highConfidenceQuickErrorsOnDirectionalPairs: highConfidenceErrors,
      rescuedHighConfidenceQuickErrors: rescuedHighConfidenceErrors,
    },
    pairs,
  };
}
