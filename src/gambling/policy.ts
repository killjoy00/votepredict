export type GamblingScope = 'direct' | 'embedded' | 'mention';

export type GamblingTopic =
  | 'sports_betting'
  | 'horse_racing'
  | 'lottery'
  | 'charitable_gambling'
  | 'sweepstakes'
  | 'prediction_markets'
  | 'election_betting'
  | 'casino_gaming'
  | 'fantasy_sports'
  | 'other_gambling';

export interface GamblingClassification {
  scope: GamblingScope;
  topic: GamblingTopic;
  termHits: number;
}

export interface TribalAlignmentSignal {
  benchmarkKey: string;
  label: string;
  kind: 'vote' | 'sponsorship' | 'statement';
  aligned: boolean;
  weight: number;
  occurredOn?: string;
  sourceUrl: string;
  sourceOrganization: string;
  detail: string;
}

export interface TribalGamingAlignment {
  score?: number;
  confidence: 'none' | 'low' | 'medium' | 'high';
  observedWeight: number;
  alignedWeight: number;
  opposedWeight: number;
  signals: TribalAlignmentSignal[];
}

const TERM_PATTERNS: RegExp[] = [
  /\bsports bet(?:ting)?\b/gi,
  /\bsports wager(?:ing|s)?\b/gi,
  /\blawful gambling\b/gi,
  /\bcharitable gambling\b/gi,
  /\bgambling\b/gi,
  /\bwager(?:ing|s|ed)?\b/gi,
  /\blottery\b/gi,
  /\bcasino(?:s)?\b/gi,
  /\bbingo\b/gi,
  /\braffle(?:s)?\b/gi,
  /\bpull[- ]tabs?\b/gi,
  /\bhorse racing\b/gi,
  /\bhistorical horse racing\b/gi,
  /\bpari[- ]mutuel\b/gi,
  /\bprediction markets?\b/gi,
  /\bsweepstakes\b/gi,
  /\bpoker\b/gi,
  /\bfantasy sports\b/gi,
  /\bbetting on elections?\b/gi,
];

const DIRECT_TITLE_PATTERNS: RegExp[] = [
  /\bsports bet(?:ting)?\b/i,
  /\bsports wager(?:ing|s)?\b/i,
  /\blawful gambling\b/i,
  /\bcharitable gambling\b/i,
  /\bgambling\b/i,
  /\bwager(?:ing|s)?\b/i,
  /\blottery\b/i,
  /\bcasino(?:s)?\b/i,
  /\bbingo\b/i,
  /\braffle(?:s)?\b/i,
  /\bpull[- ]tabs?\b/i,
  /\bhorse racing\b/i,
  /\bhistorical horse racing\b/i,
  /\bpari[- ]mutuel\b/i,
  /\bprediction markets?\b/i,
  /\bsweepstakes\b/i,
  /\bpoker\b/i,
  /\bfantasy sports\b/i,
];

export function countGamblingTerms(value: string): number {
  let count = 0;
  for (const pattern of TERM_PATTERNS) {
    pattern.lastIndex = 0;
    count += value.match(pattern)?.length ?? 0;
  }
  return count;
}

function classifyTopic(value: string): GamblingTopic {
  if (/\bprediction markets?\b/i.test(value)) return 'prediction_markets';
  if (/\bsweepstakes\b/i.test(value)) return 'sweepstakes';
  if (/\bbetting on elections?\b/i.test(value)) return 'election_betting';
  if (/\bsports bet(?:ting)?\b|\bsports wager(?:ing|s)?\b/i.test(value)) return 'sports_betting';
  if (/\bhistorical horse racing\b|\bhorse racing\b|\bpari[- ]mutuel\b/i.test(value)) return 'horse_racing';
  if (/\blottery\b/i.test(value)) return 'lottery';
  if (/\bcharitable gambling\b|\blawful gambling\b|\bbingo\b|\braffle(?:s)?\b|\bpull[- ]tabs?\b/i.test(value)) return 'charitable_gambling';
  if (/\bcasino(?:s)?\b/i.test(value)) return 'casino_gaming';
  if (/\bfantasy sports\b/i.test(value)) return 'fantasy_sports';
  return 'other_gambling';
}

export function classifyGamblingBill(title: string, rawText = ''): GamblingClassification | undefined {
  const combined = `${title}\n${rawText}`;
  const termHits = countGamblingTerms(combined);
  const direct = DIRECT_TITLE_PATTERNS.some((pattern) => pattern.test(title));
  const electionBettingTitle = /\bbetting on elections?\b/i.test(title);

  if (!direct && !electionBettingTitle && termHits === 0) return undefined;

  const scope: GamblingScope = direct
    ? 'direct'
    : electionBettingTitle || termHits >= 3
      ? 'embedded'
      : 'mention';

  return {
    scope,
    topic: classifyTopic(combined),
    termHits,
  };
}

export function scoreTribalGamingAlignment(inputSignals: readonly TribalAlignmentSignal[]): TribalGamingAlignment {
  const strongestByBenchmark = new Map<string, TribalAlignmentSignal>();
  const kindRank: Record<TribalAlignmentSignal['kind'], number> = { vote: 3, statement: 2, sponsorship: 1 };

  for (const signal of inputSignals) {
    const existing = strongestByBenchmark.get(signal.benchmarkKey);
    if (!existing
      || signal.weight > existing.weight
      || (signal.weight === existing.weight && kindRank[signal.kind] > kindRank[existing.kind])) {
      strongestByBenchmark.set(signal.benchmarkKey, signal);
    }
  }

  const signals = [...strongestByBenchmark.values()].sort((left, right) => {
    const dateOrder = (right.occurredOn ?? '').localeCompare(left.occurredOn ?? '');
    return dateOrder || right.weight - left.weight || left.label.localeCompare(right.label);
  });
  const observedWeight = signals.reduce((sum, signal) => sum + signal.weight, 0);
  const alignedWeight = signals.reduce((sum, signal) => sum + (signal.aligned ? signal.weight : 0), 0);
  const opposedWeight = observedWeight - alignedWeight;

  if (observedWeight === 0) {
    return { score: undefined, confidence: 'none', observedWeight: 0, alignedWeight: 0, opposedWeight: 0, signals };
  }

  // Two neutral prior-weight points keep one isolated vote from rendering as fake certainty.
  const signedWeight = alignedWeight - opposedWeight;
  const score = Math.round(50 + (50 * signedWeight) / (observedWeight + 2));
  const confidence = observedWeight >= 6 ? 'high' : observedWeight >= 3 ? 'medium' : 'low';

  return {
    score: Math.max(0, Math.min(100, score)),
    confidence,
    observedWeight,
    alignedWeight,
    opposedWeight,
    signals,
  };
}

export function gamblingTopicLabel(topic: GamblingTopic): string {
  const labels: Record<GamblingTopic, string> = {
    sports_betting: 'Sports betting',
    horse_racing: 'Horse racing / HHR',
    lottery: 'Lottery',
    charitable_gambling: 'Lawful / charitable gambling',
    sweepstakes: 'Online sweepstakes',
    prediction_markets: 'Prediction markets',
    election_betting: 'Election betting',
    casino_gaming: 'Casino gaming',
    fantasy_sports: 'Fantasy sports',
    other_gambling: 'Other gambling',
  };
  return labels[topic];
}
