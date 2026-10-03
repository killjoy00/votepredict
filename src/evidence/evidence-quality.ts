import { createHash } from 'node:crypto';

export const EVIDENCE_QUALITY_SCHEMA_VERSION = 'evidence-quality-v1' as const;
export const EVIDENCE_QUALITY_PROMPT_VERSION = 'evidence-quality-prompt-v1' as const;
export const EVIDENCE_QUALITY_TEXT_VERSION = 'evidence-quality-text-v1' as const;

export const EVIDENCE_QUALITY_SOURCE_KINDS = [
  'wayback_local_trade_news',
  'public_news_article',
  'member_primary_article',
  'campaign_site',
  'wayback_campaign_site',
  'wayback_member_primary',
  'house_member_primary_historical_article',
  'senate_member_primary_historical_article',
  'wayback_organization_publication',
  'house_session_daily',
] as const;

export type EvidenceQualitySourceKind = (typeof EVIDENCE_QUALITY_SOURCE_KINDS)[number];
export type EvidenceQualityContentMode = 'verified_full_text' | 'excerpt_only';

export const EVIDENCE_QUALITY_LINKAGES = [
  'exact_member_bill',
  'member_issue',
  'bill_only',
  'member_only',
  'generic_legislative',
  'none',
] as const;
export type EvidenceQualityLinkage = (typeof EVIDENCE_QUALITY_LINKAGES)[number];

export const EVIDENCE_QUALITY_CENTRALITY = ['primary', 'substantial', 'incidental', 'none'] as const;
export type EvidenceQualityCentrality = (typeof EVIDENCE_QUALITY_CENTRALITY)[number];

export const EVIDENCE_QUALITY_CLAIM_TYPES = [
  'explicit_position',
  'quoted_position',
  'legislative_action',
  'sponsorship',
  'procedural_action',
  'policy_discussion',
  'background',
  'other',
] as const;
export type EvidenceQualityClaimType = (typeof EVIDENCE_QUALITY_CLAIM_TYPES)[number];

export const EVIDENCE_QUALITY_STANCES = ['supports', 'opposes', 'mixed', 'none', 'unclear'] as const;
export type EvidenceQualityStance = (typeof EVIDENCE_QUALITY_STANCES)[number];

export const EVIDENCE_QUALITY_SPECIFICITY = [
  'exact_bill',
  'named_proposal',
  'issue_family',
  'generic',
  'none',
] as const;
export type EvidenceQualitySpecificity = (typeof EVIDENCE_QUALITY_SPECIFICITY)[number];

export const EVIDENCE_QUALITY_EXPLICITNESS = [
  'direct_quote',
  'attributed_paraphrase',
  'document_position',
  'none',
] as const;
export type EvidenceQualityExplicitness = (typeof EVIDENCE_QUALITY_EXPLICITNESS)[number];

export const EVIDENCE_QUALITY_NOVELTY = [
  'new_claim',
  'repeated_claim',
  'syndicated_or_duplicate',
  'unknown',
] as const;
export type EvidenceQualityNovelty = (typeof EVIDENCE_QUALITY_NOVELTY)[number];

export const EVIDENCE_QUALITY_CORROBORATION = [
  'independent',
  'same_origin_repetition',
  'uncorroborated',
  'unknown',
] as const;
export type EvidenceQualityCorroboration = (typeof EVIDENCE_QUALITY_CORROBORATION)[number];

export interface EvidenceQualityCandidateContext {
  sourceKind: EvidenceQualitySourceKind;
  sourceUrl: string;
  contentMode: EvidenceQualityContentMode;
  text: string;
  title?: string;
  publishedAt?: string;
  availableAt?: string;
  candidateMemberNames: readonly string[];
  candidateBillIdentifiers: readonly string[];
}

export interface EvidenceQualityClaim {
  memberNames: string[];
  billIdentifiers: string[];
  linkage: EvidenceQualityLinkage;
  claimType: EvidenceQualityClaimType;
  stance: EvidenceQualityStance;
  specificity: EvidenceQualitySpecificity;
  explicitness: EvidenceQualityExplicitness;
  normalizedClaim: string;
  supportingExcerpt: string;
  extractionConfidence: number;
}

export interface EvidenceQualityAnnotation {
  document: {
    legislativeRelevance: 'high' | 'medium' | 'low' | 'none';
    centrality: EvidenceQualityCentrality;
    contentType: 'news_report' | 'member_statement' | 'campaign_position' | 'organization_advocacy' | 'official_reporting' | 'other';
    novelty: EvidenceQualityNovelty;
    corroboration: EvidenceQualityCorroboration;
    topics: string[];
    documentConfidence: number;
  };
  claims: EvidenceQualityClaim[];
  notes: string[];
}

export function isEvidenceQualitySourceKind(value: string): value is EvidenceQualitySourceKind {
  return (EVIDENCE_QUALITY_SOURCE_KINDS as readonly string[]).includes(value);
}

export function sha256Text(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function sourceContentIdentityMatches(storedSha256: string, fetchedSha256: string): boolean {
  return /^[a-f0-9]{64}$/i.test(storedSha256)
    && /^[a-f0-9]{64}$/i.test(fetchedSha256)
    && storedSha256.toLowerCase() === fetchedSha256.toLowerCase();
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function compactText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function evidenceQualityExtractionConfidence(annotation: EvidenceQualityAnnotation): number {
  const values = [
    annotation.document.documentConfidence,
    ...annotation.claims.map((claim) => claim.extractionConfidence),
  ].filter((value) => Number.isFinite(value));
  return values.length === 0 ? 0 : Math.min(...values);
}

export function supportingExcerptIsGrounded(sourceText: string, excerpt: string): boolean {
  const source = compactText(sourceText).toLowerCase();
  const candidate = compactText(excerpt).toLowerCase();
  return candidate.length > 0 && source.includes(candidate);
}

export function validateEvidenceQualityAnnotation(
  annotation: EvidenceQualityAnnotation,
  input: EvidenceQualityCandidateContext,
): void {
  if (!Number.isFinite(annotation.document.documentConfidence)
    || annotation.document.documentConfidence < 0
    || annotation.document.documentConfidence > 1) {
    throw new Error('Evidence quality document confidence must be between 0 and 1');
  }
  if (annotation.document.topics.length > 12) throw new Error('Evidence quality topics must contain at most 12 items');
  if (annotation.claims.length > 16) throw new Error('Evidence quality annotations may contain at most 16 claims');

  const members = new Set(uniqueSorted(input.candidateMemberNames));
  const bills = new Set(uniqueSorted(input.candidateBillIdentifiers).map((value) => value.toUpperCase()));

  for (const claim of annotation.claims) {
    if (!claim.normalizedClaim.trim()) throw new Error('Evidence quality normalizedClaim is required');
    if (claim.normalizedClaim.length > 500) throw new Error('Evidence quality normalizedClaim exceeds 500 characters');
    if (!claim.supportingExcerpt.trim()) throw new Error('Evidence quality supportingExcerpt is required');
    if (claim.supportingExcerpt.length > 500) throw new Error('Evidence quality supportingExcerpt exceeds 500 characters');
    if (!supportingExcerptIsGrounded(input.text, claim.supportingExcerpt)) {
      throw new Error('Evidence quality supportingExcerpt is not grounded in the supplied source text');
    }
    if (!Number.isFinite(claim.extractionConfidence)
      || claim.extractionConfidence < 0
      || claim.extractionConfidence > 1) {
      throw new Error('Evidence quality claim confidence must be between 0 and 1');
    }
    for (const member of claim.memberNames) {
      if (!members.has(member)) throw new Error(`Evidence quality claim returned unknown member: ${member}`);
    }
    for (const bill of claim.billIdentifiers) {
      if (!bills.has(bill.toUpperCase())) throw new Error(`Evidence quality claim returned unknown bill: ${bill}`);
    }
    if (['supports', 'opposes', 'mixed'].includes(claim.stance)
      && !['explicit_position', 'quoted_position'].includes(claim.claimType)) {
      throw new Error('Directional stance requires an explicit_position or quoted_position claim type');
    }
  }
}

export function buildEvidenceQualityPrompt(input: EvidenceQualityCandidateContext): string {
  const candidateMemberNames = uniqueSorted(input.candidateMemberNames);
  const candidateBillIdentifiers = uniqueSorted(input.candidateBillIdentifiers);

  return [
    'Classify the meaning and evidentiary specificity of one legislative source document.',
    '',
    'This is evidence annotation, not forecasting.',
    'Do NOT predict how anyone will vote.',
    'Do NOT use or infer later outcomes.',
    'Do NOT use party affiliation, ideology, donors, endorsements, article tone, or generic issue sentiment to infer a legislative stance.',
    'A stance of supports/opposes/mixed is allowed only when the supplied text itself contains an attributable explicit position or quote.',
    'Legislative actions, sponsorship, committee activity, procedural actions, or being named in coverage are not by themselves support/opposition to final passage.',
    'If the source does not establish a directional position, use stance=none or stance=unclear.',
    'Confidence is confidence in extraction/attribution only, never a vote probability.',
    'Every returned claim must include a short supportingExcerpt copied from the supplied text.',
    'Only return candidate member names and bill identifiers listed below. Do not invent or resolve new identities.',
    'For novelty/corroboration, use unknown unless the supplied document itself provides strong evidence of syndication, repetition, or independent corroboration.',
    '',
    `Source kind: ${input.sourceKind}`,
    `Source URL: ${input.sourceUrl}`,
    `Content mode: ${input.contentMode}`,
    `Title: ${input.title ?? '(unknown)'}`,
    `Published at: ${input.publishedAt ?? '(unknown)'}`,
    `Historically available at: ${input.availableAt ?? '(unknown)'}`,
    '',
    'Candidate members:',
    JSON.stringify(candidateMemberNames),
    'Candidate bills:',
    JSON.stringify(candidateBillIdentifiers),
    '',
    'Required document-level judgments:',
    '- legislativeRelevance: high | medium | low | none',
    '- centrality: primary | substantial | incidental | none',
    '- contentType: news_report | member_statement | campaign_position | organization_advocacy | official_reporting | other',
    '- novelty: new_claim | repeated_claim | syndicated_or_duplicate | unknown',
    '- corroboration: independent | same_origin_repetition | uncorroborated | unknown',
    '- topics: short neutral policy/process labels only',
    '- documentConfidence: 0..1 extraction confidence',
    '',
    'For each substantive claim, return:',
    '- memberNames: zero or more names from Candidate members',
    '- billIdentifiers: zero or more identifiers from Candidate bills',
    '- linkage: exact_member_bill | member_issue | bill_only | member_only | generic_legislative | none',
    '- claimType: explicit_position | quoted_position | legislative_action | sponsorship | procedural_action | policy_discussion | background | other',
    '- stance: supports | opposes | mixed | none | unclear',
    '- specificity: exact_bill | named_proposal | issue_family | generic | none',
    '- explicitness: direct_quote | attributed_paraphrase | document_position | none',
    '- normalizedClaim: a concise factual restatement of what the source says',
    '- supportingExcerpt: exact text from the supplied document, maximum 500 characters',
    '- extractionConfidence: 0..1',
    '',
    'Source text:',
    input.text,
  ].join('\n');
}
