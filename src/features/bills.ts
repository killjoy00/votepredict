import { createHash } from 'node:crypto';
import { extractGamblingBillFeatures, type GamblingBillFeatures } from '../gambling/policy';

export const BILL_FEATURE_SCHEMA_VERSION = 'bill-features-v2';
export const DETERMINISTIC_EXTRACTOR_VERSION = 'deterministic-v2.1';

export type FiscalDirection = 'expansionary' | 'contractionary' | 'mixed' | 'unknown';

export interface DeterministicBillFeatures {
  schemaVersion: typeof BILL_FEATURE_SCHEMA_VERSION;
  bodyHash: string;
  tokenCount: number;
  lineCount: number;
  sectionCount: number;
  titleTokens: string[];
  keywords: string[];
  policyAreas: string[];
  actionTypes: string[];
  affectedEntities: string[];
  fiscal: {
    appropriation: boolean;
    taxChange: boolean;
    bonding: boolean;
    direction: FiscalDirection;
  };
  gambling?: GamblingBillFeatures;
}

export interface BillFeatureIdentity {
  billId: string;
  billVersionId: string;
  identifier: string;
  session: string;
  title: string;
  publishedAt: string;
  companionIdentifier?: string;
  features: DeterministicBillFeatures;
}

export interface HistoricalAnalogueCandidate extends BillFeatureIdentity {
  voteEventId: string;
  occurredAt: string;
  chamber: string;
  yeaCount: number;
  nayCount: number;
  passed: boolean | null;
}

export interface AnalogueResult {
  candidate: HistoricalAnalogueCandidate;
  similarity: number;
  recencyWeight: number;
  score: number;
  relationship?: 'same-bill' | 'official-companion' | 'companion-text' | 'reintroduced' | 'identical-text';
  reasons: string[];
}

export interface AnalogueOptions {
  limit?: number;
  halfLifeDays?: number;
  minimumSimilarity?: number;
}

const STOPWORDS = new Set([
  'about','after','again','against','also','among','been','being','between','bill','chapter','commissioner','each','from','have','into','more','must','other','provided','providing','relating','section','shall','state','than','that','their','there','these','this','under','upon','which','with','within','would','Minnesota'.toLowerCase(),
]);

const POLICY_TERMS: Record<string, string[]> = {
  agriculture: ['agriculture','agricultural','farm','farmer','crop','livestock'],
  commerce: ['commerce','consumer','business','license','licensing','insurance'],
  education: ['education','school','teacher','student','college','university'],
  elections: ['election','ballot','voter','campaign','candidate'],
  environment: ['environment','pollution','climate','water','natural resources','wetland'],
  health: ['health','medical','hospital','patient','medicaid','pharmacy'],
  housing: ['housing','tenant','landlord','rent','residential'],
  human_services: ['human services','child care','disability','public assistance','foster care'],
  judiciary: ['court','judge','judicial','attorney','civil law'],
  labor: ['labor','employment','employer','employee','wage','workplace'],
  local_government: ['county','municipal','municipality','township','city council'],
  public_safety: ['police','law enforcement','crime','criminal','corrections','firearm'],
  state_government: ['state agency','department','commission','office of','inspector general'],
  taxes: ['tax','taxation','revenue','credit','deduction','exemption'],
  transportation: ['transportation','highway','road','transit','vehicle','driver'],
};

const ACTION_TERMS: Record<string, string[]> = {
  appropriation: ['appropriat'],
  authorization: ['authorized','authorization','may establish','may issue'],
  bonding: ['bond','general obligation'],
  grant: ['grant program','grants','grant award'],
  mandate: ['shall','must','required to','requirement'],
  prohibition: ['may not','shall not','prohibited','prohibition'],
  regulatory: ['license','permit','rulemaking','regulation','regulated'],
  reporting: ['report to','submit a report','study','task force'],
  tax_change: ['tax','credit','deduction','exemption','surcharge'],
};

const ENTITY_TERMS: Record<string, string[]> = {
  agencies: ['department','agency','commissioner','board'],
  children_families: ['child','children','family','families'],
  courts: ['court','judge','judicial'],
  employers_workers: ['employer','employee','worker','workplace'],
  health_providers: ['hospital','provider','physician','pharmacy'],
  local_governments: ['county','city','municipal','township'],
  schools_students: ['school','student','teacher','district'],
  taxpayers: ['taxpayer','tax credit','income tax','sales tax'],
  voters: ['voter','election','ballot'],
};

function normalizedText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokens(value: string): string[] {
  return normalizedText(value).split(' ').filter((token) => token.length >= 4 && !STOPWORDS.has(token));
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort();
}

function matchedTags(text: string, dictionary: Record<string, string[]>): string[] {
  const haystack = normalizedText(text);
  return Object.entries(dictionary)
    .filter(([, terms]) => terms.some((term) => haystack.includes(term)))
    .map(([tag]) => tag)
    .sort();
}

function topKeywords(text: string, limit = 24): string[] {
  const counts = new Map<string, number>();
  for (const token of tokens(text)) counts.set(token, (counts.get(token) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([token]) => token);
}

function fiscalDirection(text: string, actionTypes: readonly string[]): FiscalDirection {
  const haystack = normalizedText(text);
  const expansionary = actionTypes.includes('appropriation')
    || /tax credit|tax deduction|tax exemption|grant program|money is appropriated/.test(haystack);
  const contractionary = /tax increase|increase the tax|surcharge|fee increase|reduce the appropriation|appropriation is reduced/.test(haystack);
  if (expansionary && contractionary) return 'mixed';
  if (expansionary) return 'expansionary';
  if (contractionary) return 'contractionary';
  return 'unknown';
}

export function extractDeterministicBillFeatures(input: { title: string; text: string }): DeterministicBillFeatures {
  const normalized = normalizedText(input.text);
  const actionTypes = matchedTags(input.text, ACTION_TERMS);
  return {
    schemaVersion: BILL_FEATURE_SCHEMA_VERSION,
    bodyHash: createHash('sha256').update(normalized).digest('hex'),
    tokenCount: normalized ? normalized.split(' ').length : 0,
    lineCount: input.text.split(/\r?\n/).filter((line) => line.trim()).length,
    sectionCount: (input.text.match(/\bSec\.\s*\d+|\bSection\s+\d+/gi) ?? []).length,
    titleTokens: uniqueSorted(tokens(input.title)),
    keywords: topKeywords(`${input.title}\n${input.text}`),
    policyAreas: matchedTags(`${input.title}\n${input.text}`, POLICY_TERMS),
    actionTypes,
    affectedEntities: matchedTags(`${input.title}\n${input.text}`, ENTITY_TERMS),
    fiscal: {
      appropriation: actionTypes.includes('appropriation'),
      taxChange: actionTypes.includes('tax_change'),
      bonding: actionTypes.includes('bonding'),
      direction: fiscalDirection(input.text, actionTypes),
    },
    gambling: extractGamblingBillFeatures(input.title, input.text),
  };
}

function jaccard(a: readonly string[], b: readonly string[]): number {
  const left = new Set(a);
  const right = new Set(b);
  if (left.size === 0 && right.size === 0) return 1;
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection += 1;
  const union = new Set([...left, ...right]).size;
  return union === 0 ? 0 : intersection / union;
}

function structuralSimilarity(a: number, b: number): number {
  if (a === 0 && b === 0) return 1;
  if (a <= 0 || b <= 0) return 0;
  return Math.exp(-Math.abs(Math.log(a / b)));
}

export function billFeatureSimilarity(a: DeterministicBillFeatures, b: DeterministicBillFeatures): number {
  if (a.bodyHash === b.bodyHash) return 1;
  const generic = 0.24 * jaccard(a.policyAreas, b.policyAreas)
    + 0.18 * jaccard(a.actionTypes, b.actionTypes)
    + 0.10 * jaccard(a.affectedEntities, b.affectedEntities)
    + 0.20 * jaccard(a.keywords, b.keywords)
    + 0.16 * jaccard(a.titleTokens, b.titleTokens)
    + 0.12 * structuralSimilarity(a.tokenCount, b.tokenCount);
  if (!a.gambling || !b.gambling) return generic;
  const designMatches = [
    a.gambling.topic === b.gambling.topic,
    a.gambling.licenseModel === b.gambling.licenseModel,
    a.gambling.mobileAllowed === b.gambling.mobileAllowed,
    a.gambling.retailAllowed === b.gambling.retailAllowed,
    a.gambling.racetrackRole === b.gambling.racetrackRole,
    a.gambling.collegeBettingPolicy === b.gambling.collegeBettingPolicy,
  ];
  const designSimilarity = designMatches.filter(Boolean).length / designMatches.length;
  return 0.7 * generic + 0.3 * designSimilarity;
}

export function classifyBillRelationship(a: BillFeatureIdentity, b: BillFeatureIdentity): AnalogueResult['relationship'] | undefined {
  if (a.billId === b.billId) return 'same-bill';
  if (a.session === b.session && (a.companionIdentifier === b.identifier || b.companionIdentifier === a.identifier)) return 'official-companion';
  if (a.features.bodyHash !== b.features.bodyHash) return undefined;
  if (a.session !== b.session) return 'reintroduced';
  if (a.identifier.slice(0, 2) !== b.identifier.slice(0, 2)) return 'companion-text';
  return 'identical-text';
}

function overlapReason(label: string, a: readonly string[], b: readonly string[]): string | undefined {
  const overlap = a.filter((value) => b.includes(value));
  return overlap.length ? `${label}: ${overlap.slice(0, 4).join(', ')}` : undefined;
}

export function selectVersionAsOf<T extends { publishedAt: string }>(versions: readonly T[], asOf: string): T | undefined {
  return [...versions]
    .filter((version) => version.publishedAt <= asOf)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0];
}

export function retrieveHistoricalAnalogues(
  target: BillFeatureIdentity,
  candidates: readonly HistoricalAnalogueCandidate[],
  asOf: string,
  options: AnalogueOptions = {},
): AnalogueResult[] {
  const limit = options.limit ?? 10;
  const halfLifeDays = options.halfLifeDays ?? 730;
  const minimumSimilarity = options.minimumSimilarity ?? 0.18;
  if (!Number.isFinite(halfLifeDays) || halfLifeDays <= 0) throw new Error('halfLifeDays must be positive');
  const targetTime = Date.parse(asOf);
  if (!Number.isFinite(targetTime)) throw new Error(`Invalid asOf: ${asOf}`);

  return candidates.flatMap((candidate): AnalogueResult[] => {
    if (candidate.billId === target.billId && candidate.voteEventId === '') return [];
    if (candidate.occurredAt >= asOf) return [];
    if (candidate.publishedAt > candidate.occurredAt) return [];
    const candidateTime = Date.parse(candidate.occurredAt);
    if (!Number.isFinite(candidateTime)) return [];
    const relationship = classifyBillRelationship(target, candidate);
    const similarity = billFeatureSimilarity(target.features, candidate.features);
    if (!relationship && similarity < minimumSimilarity) return [];
    const ageDays = Math.max(0, (targetTime - candidateTime) / 86_400_000);
    const recencyWeight = 2 ** (-ageDays / halfLifeDays);
    const relationshipFloor = relationship === 'same-bill' || relationship === 'official-companion' ? 0.98
      : relationship === 'reintroduced' || relationship === 'companion-text' ? 0.94
      : relationship === 'identical-text' ? 0.90
      : 0;
    const effectiveSimilarity = Math.max(similarity, relationshipFloor);
    const score = effectiveSimilarity * (0.75 + 0.25 * recencyWeight);
    const reasons = [
      relationship ? `relationship: ${relationship}` : undefined,
      overlapReason('policy', target.features.policyAreas, candidate.features.policyAreas),
      overlapReason('actions', target.features.actionTypes, candidate.features.actionTypes),
      overlapReason('entities', target.features.affectedEntities, candidate.features.affectedEntities),
      overlapReason('keywords', target.features.keywords, candidate.features.keywords),
    ].filter((reason): reason is string => Boolean(reason));
    return [{ candidate, similarity, recencyWeight, score, relationship, reasons }];
  }).sort((a, b) => b.score - a.score || b.candidate.occurredAt.localeCompare(a.candidate.occurredAt)).slice(0, limit);
}
