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

export const GAMBLING_FEATURE_SCHEMA_VERSION = 'gambling-policy-v1';
export type GamblingLicenseModel = 'tribal_exclusive' | 'commercial' | 'hybrid' | 'unknown';

export interface GamblingBillFeatures {
  schemaVersion: typeof GAMBLING_FEATURE_SCHEMA_VERSION;
  topic: GamblingTopic;
  scope: GamblingScope;
  licenseModel: GamblingLicenseModel;
  mobileAllowed: boolean | null;
  retailAllowed: boolean | null;
  racetrackRole: 'licensee' | 'revenue_share' | 'none' | 'unknown';
  taxRatesPercent: number[];
  minimumAge?: number;
  operatorCount?: number;
  collegeBettingPolicy: 'prohibited' | 'restricted' | 'allowed' | 'unknown';
  revenueRecipients: string[];
  policyFlags: string[];
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

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

export function extractGamblingBillFeatures(title: string, rawText = ''): GamblingBillFeatures | undefined {
  const classification = classifyGamblingBill(title, rawText);
  if (!classification) return undefined;
  const text = `${title}\n${rawText}`;
  const tribal = /\btrib(?:e|al|es|es'|al nation|al nations)\b/i.test(text);
  const commercial = /\b(?:sports wagering|betting) operator|commercial operator|licensed operator\b/i.test(text);
  const racetrack = /\bracetrack|running aces|canterbury park\b/i.test(text);
  const racetrackLicense = racetrack && /racetrack.{0,120}(?:license|operator)|(?:license|operator).{0,120}racetrack/is.test(text);
  const racetrackRevenue = racetrack && /racetrack.{0,160}(?:revenue|payment|distribution|allocation)|(?:revenue|payment|distribution|allocation).{0,160}racetrack/is.test(text);
  const mobileAllowed = /\bmobile (?:sports )?(?:betting|wagering)|online (?:sports )?(?:betting|wagering)\b/i.test(text) ? true
    : /\b(?:mobile|online) (?:betting|wagering).{0,80}(?:prohibited|not permitted)\b/i.test(text) ? false : null;
  const retailAllowed = /\bretail (?:sports )?(?:betting|wagering)|in-person (?:sports )?(?:betting|wagering)\b/i.test(text) ? true
    : /\bretail (?:betting|wagering).{0,80}(?:prohibited|not permitted)\b/i.test(text) ? false : null;
  const taxRatesPercent = unique([
    ...[...text.matchAll(/(?:tax|rate)[^\d%]{0,40}(\d+(?:\.\d+)?)\s*percent/gi)].map((match) => Number(match[1])),
    ...[...text.matchAll(/(\d+(?:\.\d+)?)\s*percent[^.\n]{0,40}\btax\b/gi)].map((match) => Number(match[1])),
  ].filter((value) => value >= 0 && value <= 100)).sort((a, b) => a - b);
  const age = text.match(/(?:at least|minimum age(?: of)?|under)\s+(18|21)\s+years?\s+of\s+age/i);
  const operators = text.match(/(?:up to|maximum of|not more than)\s+(\d+)\s+(?:mobile\s+)?(?:licenses?|operators?|skins?)/i);
  const revenueRecipients = unique([
    /problem gambling|compulsive gambling/i.test(text) ? 'problem_gambling' : undefined,
    /horse racing|racetrack|racing commission/i.test(text) ? 'horse_racing' : undefined,
    /youth sports/i.test(text) ? 'youth_sports' : undefined,
    /(?:tribal|Indian) nation|tribes?/i.test(text) ? 'tribal_nations' : undefined,
    /general fund/i.test(text) ? 'general_fund' : undefined,
  ].filter((value): value is string => Boolean(value)));
  const policyFlags = unique([
    /official league data/i.test(text) ? 'official_league_data' : undefined,
    /in-game|in game|proposition wager/i.test(text) ? 'in_game_wagering' : undefined,
    /geofenc|geolocat/i.test(text) ? 'geolocation' : undefined,
    /constitutional amendment/i.test(text) ? 'constitutional_amendment' : undefined,
    /problem gambling|compulsive gambling/i.test(text) ? 'responsible_gaming_funding' : undefined,
  ].filter((value): value is string => Boolean(value)));
  const collegeBettingPolicy = /college|collegiate/i.test(text)
    ? /college|collegiate.{0,100}(?:prohibited|may not|not permit)/is.test(text) ? 'prohibited'
      : /college|collegiate.{0,100}(?:restrict|in-state|Minnesota team)/is.test(text) ? 'restricted' : 'allowed'
    : 'unknown';

  return {
    schemaVersion: GAMBLING_FEATURE_SCHEMA_VERSION,
    topic: classification.topic,
    scope: classification.scope,
    licenseModel: tribal && commercial ? 'hybrid' : tribal ? 'tribal_exclusive' : commercial ? 'commercial' : 'unknown',
    mobileAllowed,
    retailAllowed,
    racetrackRole: racetrackLicense ? 'licensee' : racetrackRevenue ? 'revenue_share' : racetrack ? 'unknown' : 'none',
    taxRatesPercent,
    minimumAge: age ? Number(age[1]) : undefined,
    operatorCount: operators ? Number(operators[1]) : undefined,
    collegeBettingPolicy,
    revenueRecipients,
    policyFlags,
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
