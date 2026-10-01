import { createHash } from 'node:crypto';
import type { DurableEvidenceDraft, DurableEvidenceStance } from './durable-ingestion';

export const ISSUE_POSITION_EXTRACTOR_VERSION = 'issue-position-v1' as const;

export const ISSUE_POSITION_FAMILIES = [
  'education',
  'health',
  'human_services',
  'taxes_revenue',
  'public_safety',
  'housing',
  'transportation',
  'environment_natural_resources',
  'labor_employment',
  'elections',
  'agriculture',
  'commerce_consumer',
  'local_government',
  'judiciary_civil_law',
  'state_government',
] as const;

export type IssuePositionFamily = (typeof ISSUE_POSITION_FAMILIES)[number];
export type IssuePositionCommitment =
  | 'explicit_support'
  | 'explicit_opposition'
  | 'promise_action'
  | 'priority_statement';

export interface ExtractIssuePositionsInput {
  membershipId: string;
  memberName: string;
  text: string;
  publishedAt?: string;
  fetchedAt: string;
  sourceSubtype: 'campaign_site_page' | 'member_primary_article';
}

const FAMILY_PATTERNS: ReadonlyArray<{ family: IssuePositionFamily; pattern: RegExp }> = [
  { family: 'education', pattern: /\b(?:education|school|teacher|student|college|university|tuition|literacy)\b/i },
  { family: 'health', pattern: /\b(?:health(?:care)?|medical|hospital|patient|pharmacy|medicaid|mncare|insurance coverage)\b/i },
  { family: 'human_services', pattern: /\b(?:human services|child care|childcare|disabilit(?:y|ies)|foster care|public assistance|long-term care)\b/i },
  { family: 'taxes_revenue', pattern: /\b(?:tax(?:es|ation)?|revenue|tax credit|deduction|exemption|property tax)\b/i },
  { family: 'public_safety', pattern: /\b(?:public safety|police|law enforcement|crime|criminal|correction|firearm|gun|violence)\b/i },
  { family: 'housing', pattern: /\b(?:housing|tenant|landlord|rent|residential|homeownership|homelessness)\b/i },
  { family: 'transportation', pattern: /\b(?:transportation|highway|road|transit|vehicle|driver|bridge|rail)\b/i },
  { family: 'environment_natural_resources', pattern: /\b(?:environment|natural resources|water|climate|pollution|wetland|clean energy|renewable energy)\b/i },
  { family: 'labor_employment', pattern: /\b(?:labor|employment|employer|employee|worker|wage|workplace|paid leave|family leave|medical leave|union)\b/i },
  { family: 'elections', pattern: /\b(?:election|ballot|voter|voting|campaign finance|redistricting)\b/i },
  { family: 'agriculture', pattern: /\b(?:agriculture|farm|farmer|crop|livestock|rural development)\b/i },
  { family: 'commerce_consumer', pattern: /\b(?:commerce|consumer|business|insurance|licens(?:e|ing)|small business|banking)\b/i },
  { family: 'local_government', pattern: /\b(?:local government|county|municipal|municipality|township|city government)\b/i },
  { family: 'judiciary_civil_law', pattern: /\b(?:judiciary|court|judge|civil law|attorney|legal system|lawsuit)\b/i },
  { family: 'state_government', pattern: /\b(?:state government|state agency|department|commission|government accountability|state budget)\b/i },
];

const FIRST_PERSON = /\b(?:i|we|my|our)\b/i;
const SUPPORT = /\b(?:i|we)\s+(?:strongly\s+)?(?:support|back|favor|endorse)\b|\b(?:support|back|favor|endorse)(?:s|ed|ing)?\b/i;
const OPPOSE = /\b(?:i|we)\s+(?:strongly\s+)?(?:oppose|reject)\b|\b(?:oppose|reject)(?:s|d|ing)?\b/i;
const PROMISE = /\b(?:i|we)\s+(?:will|pledge\s+to|promise\s+to|am\s+committed\s+to|are\s+committed\s+to|commit\s+to)\b/i;
const PRIORITY = /\b(?:my|our)\s+(?:top\s+)?priorit(?:y|ies)\b|\b(?:i|we)\s+(?:will\s+)?(?:fight|work)\s+to\b/i;

function compactSentence(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function sentences(text: string): string[] {
  return text
    .replace(/\r/g, '\n')
    .split(/(?<=[.!?])\s+|\n+/)
    .map(compactSentence)
    .filter((value) => value.length >= 18 && value.length <= 900);
}

function memberSurnamePattern(memberName: string): RegExp | undefined {
  const token = memberName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .split(/\s+/)
    .at(-1)
    ?.replace(/[^A-Za-z'-]/g, '');
  if (!token) return undefined;
  const escaped = token.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  return new RegExp('\\b(?:sen(?:ator)?\\.?|rep(?:resentative)?\\.?)?\\s*' + escaped + '\\b', 'i');
}

function familyForSentence(sentence: string): IssuePositionFamily | undefined {
  const matches = FAMILY_PATTERNS.filter((row) => row.pattern.test(sentence));
  return matches.length === 1 ? matches[0].family : undefined;
}

function commitmentForSentence(sentence: string): {
  commitment: IssuePositionCommitment;
  stance: DurableEvidenceStance;
} | undefined {
  const support = SUPPORT.test(sentence);
  const oppose = OPPOSE.test(sentence);
  if (support && !oppose) return { commitment: 'explicit_support', stance: 'supports' };
  if (oppose && !support) return { commitment: 'explicit_opposition', stance: 'opposes' };
  if (PROMISE.test(sentence)) return { commitment: 'promise_action', stance: 'unclear' };
  if (PRIORITY.test(sentence)) return { commitment: 'priority_statement', stance: 'unclear' };
  return undefined;
}

function freshness(value: string | undefined, nowIso: string): 'current' | 'recent' | 'stale' | 'unknown' {
  if (!value) return 'unknown';
  const at = new Date(value);
  const now = new Date(nowIso);
  if (Number.isNaN(at.getTime()) || Number.isNaN(now.getTime())) return 'unknown';
  const ageDays = Math.max(0, (now.getTime() - at.getTime()) / 86_400_000);
  if (ageDays <= 45) return 'current';
  if (ageDays <= 365) return 'recent';
  return 'stale';
}

function identityKey(input: {
  membershipId: string;
  family: IssuePositionFamily;
  commitment: IssuePositionCommitment;
  sentence: string;
}): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

export function extractIssuePositions(input: ExtractIssuePositionsInput): DurableEvidenceDraft[] {
  const surname = memberSurnamePattern(input.memberName);
  const results: DurableEvidenceDraft[] = [];

  for (const sentence of sentences(input.text)) {
    const attributed = FIRST_PERSON.test(sentence) || Boolean(surname?.test(sentence));
    if (!attributed) continue;

    const family = familyForSentence(sentence);
    if (!family) continue;

    const direction = commitmentForSentence(sentence);
    if (!direction) continue;

    results.push({
      target: { membershipId: input.membershipId },
      kind: 'related_statement',
      stance: direction.stance,
      claim: input.memberName + ' published an attributable ' + family.replaceAll('_', ' ') + ' issue position.',
      excerpt: sentence.slice(0, 600),
      publishedAt: input.publishedAt,
      sourceQuality: 'member_primary',
      relevance: 'medium',
      freshness: freshness(input.publishedAt ?? input.fetchedAt, input.fetchedAt),
      extractionMethod: 'deterministic-issue-position',
      extractionVersion: ISSUE_POSITION_EXTRACTOR_VERSION,
      confidence: direction.stance === 'unclear' ? 0.9 : 0.98,
      metadata: {
        contextType: 'issue_position',
        subtype: 'issue_position',
        policyFamily: family,
        commitmentType: direction.commitment,
        propositionText: sentence.slice(0, 900),
        sourceSubtype: input.sourceSubtype,
        sourceVerified: true,
        exactBillPosition: false,
        contextOnly: true,
        mechanicallyActionable: false,
        modelWeight: 0,
        ingestionIdentityKey: identityKey({
          membershipId: input.membershipId,
          family,
          commitment: direction.commitment,
          sentence,
        }),
      },
    });
  }

  return results;
}
