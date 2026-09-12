import { createHash } from 'node:crypto';
import type {
  HistoricalDeepDiscoveryCase,
  HistoricalDeepDiscoveryManifest,
  HistoricalDeepDiscoveryMember,
} from './historical-deep-discovery';
import type {
  HistoricalDeepCollectedSource,
  HistoricalDeepSourceBundle,
} from './historical-deep-source-catalog';

export const HISTORICAL_DEEP_DISCOVERY_CANDIDATE_SCHEMA = 'historical-deep-discovery-candidates-v1' as const;

export interface HistoricalDeepDiscoveryCandidate {
  case: {
    voteEventId: string;
    session: string;
    chamber: string;
    identifier: string;
    occurredOn: string;
    asOf: string;
  };
  membershipId: string;
  legislatorId: string;
  memberName: string;
  party: string;
  district?: string;
  quickYesProbability?: number;
  quickEvidenceQuality: HistoricalDeepDiscoveryMember['evidenceQuality'];
  selectedForCurrentDeep: boolean;
  kind: 'committee_bill_advancement_vote';
  voteSide: 'aye' | 'nay';
  motionText: string;
  excerpt: string;
  source: {
    sourceId: string;
    sourceClass: HistoricalDeepCollectedSource['sourceClass'];
    title: string;
    url: string;
    publishedAt: string;
    contentSha256: string;
  };
  extractionMethod: 'deterministic-house-committee-roll-call-v1';
}

export interface HistoricalDeepDiscoveryExtractionDiagnostic {
  sourceId: string;
  identifier: string;
  type: 'unresolved_vote_name' | 'ambiguous_vote_name' | 'no_bill_advancement_roll_call';
  rawName?: string;
  detail: string;
}

export interface HistoricalDeepDiscoveryCandidateBundle {
  schemaVersion: typeof HISTORICAL_DEEP_DISCOVERY_CANDIDATE_SCHEMA;
  generatedAt: string;
  purpose: string;
  input: {
    discoveryCases: number;
    discoveryMemberCasePairs: number;
    sourceCount: number;
    sourceCaseCount: number;
  };
  summary: {
    candidateCount: number;
    memberCasePairsWithCandidates: number;
    casesWithCandidates: number;
    sourcesWithCandidates: number;
    ayeCandidates: number;
    nayCandidates: number;
    currentDeepTargetCandidates: number;
    outsideCurrentDeepCandidates: number;
  };
  candidates: HistoricalDeepDiscoveryCandidate[];
  diagnostics: HistoricalDeepDiscoveryExtractionDiagnostic[];
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)));
}

export function historicalHtmlLines(html: string): string[] {
  const withBreaks = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|tr|td|th|h[1-6]|section|article|header|footer)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(withBreaks)
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(?:jr|sr|ii|iii|iv)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function memberTokens(member: HistoricalDeepDiscoveryMember): string[] {
  return normalizeName(member.memberName).split(' ').filter(Boolean);
}

function stripVoteNameDecorations(value: string): string {
  return value
    .replace(/\([^)]*\)/g, ' ')
    .replace(/^[-•]+\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveVoteName(
  rawName: string,
  members: readonly HistoricalDeepDiscoveryMember[],
): { member?: HistoricalDeepDiscoveryMember; ambiguous: boolean } {
  const cleaned = stripVoteNameDecorations(rawName);
  if (!cleaned) return { ambiguous: false };
  const comma = cleaned.indexOf(',');
  let candidates: HistoricalDeepDiscoveryMember[];

  if (comma >= 0) {
    const lastTokens = normalizeName(cleaned.slice(0, comma)).split(' ').filter(Boolean);
    const firstTokens = normalizeName(cleaned.slice(comma + 1)).split(' ').filter(Boolean);
    const first = firstTokens[0];
    candidates = members.filter((member) => {
      const tokens = memberTokens(member);
      if (first && !tokens.includes(first)) return false;
      return lastTokens.every((token) => tokens.includes(token));
    });
  } else {
    const sourceTokens = normalizeName(cleaned).split(' ').filter(Boolean);
    candidates = members.filter((member) => {
      const tokens = memberTokens(member);
      if (sourceTokens.length === 1) return tokens.at(-1) === sourceTokens[0];
      return sourceTokens.every((token) => tokens.includes(token));
    });
  }

  if (candidates.length === 1) return { member: candidates[0], ambiguous: false };
  return { ambiguous: candidates.length > 1 };
}

function compactIdentifier(identifier: string): string {
  return identifier.replace(/\s+/g, '').toLowerCase();
}

function containsIdentifier(value: string, identifier: string): boolean {
  return compactIdentifier(value).includes(compactIdentifier(identifier));
}

function isAdvancementMotion(value: string, identifier: string): boolean {
  const normalized = value.toLowerCase();
  if (!containsIdentifier(value, identifier)) return false;
  if (normalized.includes('amendment')) return false;
  return /\b(re-?refer|refer(?:red)?|recommend(?:ed)?\s+to\s+pass|recommended\s+to\s+pass|laid\s+over|table)\b/i.test(value);
}

function isRollCallRequest(value: string): boolean {
  return /\broll call\b/i.test(value) && !/\bamendment\b/i.test(value);
}

function voteMarker(value: string): 'aye' | 'nay' | undefined {
  if (/^(?:members voting\s+)?ayes?:?$/i.test(value)) return 'aye';
  if (/^(?:members voting\s+)?nays?:?$/i.test(value)) return 'nay';
  return undefined;
}

function isVoteStop(value: string): boolean {
  return /^(?:(?:members\s+)?(?:excused|absent|abstain)s?:?|there being\b|on a vote\b|with a vote\b)/i.test(value);
}

function looksLikeVoteName(value: string): boolean {
  if (!value || value.length > 80) return false;
  if (/\b(?:motion|prevailed|committee|representative|chair|clerk|roll call|aye|nay|excused|absent|abstain)\b/i.test(value)) {
    return false;
  }
  return /^[A-Za-zÀ-ÖØ-öø-ÿ’'\-. ]+(?:,\s*[A-Za-zÀ-ÖØ-öø-ÿ’'\-. ]+)?(?:\s*\([^)]*\))?$/.test(value);
}

interface RollCallBlock {
  requestIndex: number;
  motionIndex: number;
  motionText: string;
  resultIndex: number;
  ayes: string[];
  nays: string[];
  excerpt: string;
}

export function extractBillAdvancementRollCalls(lines: readonly string[], identifier: string): RollCallBlock[] {
  const blocks: RollCallBlock[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const request = lines[index];
    if (!isRollCallRequest(request)) continue;

    let motionIndex = -1;
    for (let back = index - 1; back >= Math.max(0, index - 4); back -= 1) {
      if (/\bamendment\b/i.test(lines[back])) break;
      if (isAdvancementMotion(lines[back], identifier)) {
        motionIndex = back;
        break;
      }
    }
    if (motionIndex < 0 && containsIdentifier(request, identifier)) {
      for (let back = index - 1; back >= Math.max(0, index - 6); back -= 1) {
        if (/\bamendment\b/i.test(lines[back])) break;
        if (isAdvancementMotion(lines[back], identifier)) {
          motionIndex = back;
          break;
        }
      }
    }
    if (motionIndex < 0) continue;

    let cursor = index + 1;
    while (cursor < lines.length && cursor <= index + 8 && voteMarker(lines[cursor]) === undefined) cursor += 1;
    if (cursor >= lines.length || cursor > index + 8) continue;
    if (voteMarker(lines[cursor]) !== 'aye') continue;

    const ayes: string[] = [];
    const nays: string[] = [];
    cursor += 1;
    while (cursor < lines.length && voteMarker(lines[cursor]) !== 'nay' && !isVoteStop(lines[cursor])) {
      if (looksLikeVoteName(lines[cursor])) ayes.push(lines[cursor]);
      cursor += 1;
    }
    if (cursor >= lines.length || voteMarker(lines[cursor]) !== 'nay') continue;
    cursor += 1;
    while (cursor < lines.length && !isVoteStop(lines[cursor])) {
      if (looksLikeVoteName(lines[cursor])) nays.push(lines[cursor]);
      cursor += 1;
    }
    if (ayes.length === 0 || nays.length === 0) continue;

    const resultIndex = Math.min(cursor, lines.length - 1);
    blocks.push({
      requestIndex: index,
      motionIndex,
      motionText: lines[motionIndex],
      resultIndex,
      ayes,
      nays,
      excerpt: lines.slice(motionIndex, Math.min(lines.length, resultIndex + 1)).join(' '),
    });
  }
  return blocks;
}

function sourceCaseKey(source: Pick<HistoricalDeepCollectedSource, 'case'>): string {
  return [source.case.session, source.case.chamber, source.case.identifier, source.case.occurredOn].join('|');
}

function discoveryCaseKey(value: HistoricalDeepDiscoveryCase): string {
  return [value.session, value.chamber, value.identifier, value.occurredOn].join('|');
}

function verifySourceContentHash(source: HistoricalDeepCollectedSource): void {
  const actual = createHash('sha256').update(Buffer.from(source.content, 'utf8')).digest('hex');
  if (actual !== source.contentSha256) {
    throw new Error(`Frozen source hash mismatch for ${source.id}: expected ${source.contentSha256}, got ${actual}`);
  }
}

export function extractHistoricalDeepDiscoveryCandidates(
  discovery: HistoricalDeepDiscoveryManifest,
  sources: HistoricalDeepSourceBundle,
  generatedAt = new Date().toISOString(),
): HistoricalDeepDiscoveryCandidateBundle {
  if (!Array.isArray(discovery.cases) || discovery.cases.length === 0) {
    throw new Error('Historical discovery manifest has no cases');
  }
  if (!Array.isArray(sources.sources) || sources.sources.length === 0) {
    throw new Error('Historical source bundle has no sources');
  }

  const discoveryByCase = new Map(discovery.cases.map((value) => [discoveryCaseKey(value), value]));
  const candidates: HistoricalDeepDiscoveryCandidate[] = [];
  const diagnostics: HistoricalDeepDiscoveryExtractionDiagnostic[] = [];
  const dedupe = new Set<string>();

  for (const source of sources.sources) {
    verifySourceContentHash(source);
    const discoveryCase = discoveryByCase.get(sourceCaseKey(source));
    if (!discoveryCase) throw new Error(`Frozen source ${source.id} has no matching discovery case`);
    if (source.sourceClass !== 'house_committee_record') continue;

    const rollCalls = extractBillAdvancementRollCalls(historicalHtmlLines(source.content), discoveryCase.identifier);
    if (rollCalls.length === 0) {
      diagnostics.push({
        sourceId: source.id,
        identifier: discoveryCase.identifier,
        type: 'no_bill_advancement_roll_call',
        detail: 'No unambiguous bill-advancement roll call was found; amendment and unrelated roll calls are intentionally ignored.',
      });
      continue;
    }

    for (const rollCall of rollCalls) {
      for (const [voteSide, rawNames] of [['aye', rollCall.ayes], ['nay', rollCall.nays]] as const) {
        for (const rawName of rawNames) {
          const resolved = resolveVoteName(rawName, discoveryCase.members);
          if (!resolved.member) {
            diagnostics.push({
              sourceId: source.id,
              identifier: discoveryCase.identifier,
              type: resolved.ambiguous ? 'ambiguous_vote_name' : 'unresolved_vote_name',
              rawName,
              detail: `Could not ${resolved.ambiguous ? 'uniquely ' : ''}resolve committee vote name to the active chamber roster.`,
            });
            continue;
          }
          const member = resolved.member;
          const key = [source.id, rollCall.motionText, member.membershipId, voteSide].join('|');
          if (dedupe.has(key)) continue;
          dedupe.add(key);
          candidates.push({
            case: {
              voteEventId: discoveryCase.voteEventId,
              session: discoveryCase.session,
              chamber: discoveryCase.chamber,
              identifier: discoveryCase.identifier,
              occurredOn: discoveryCase.occurredOn,
              asOf: discoveryCase.asOf,
            },
            membershipId: member.membershipId,
            legislatorId: member.legislatorId,
            memberName: member.memberName,
            party: member.party,
            district: member.district,
            quickYesProbability: member.yesProbability,
            quickEvidenceQuality: member.evidenceQuality,
            selectedForCurrentDeep: member.selectedForCurrentDeep,
            kind: 'committee_bill_advancement_vote',
            voteSide,
            motionText: rollCall.motionText,
            excerpt: rollCall.excerpt,
            source: {
              sourceId: source.id,
              sourceClass: source.sourceClass,
              title: source.title,
              url: source.url,
              publishedAt: source.publishedAt,
              contentSha256: source.contentSha256,
            },
            extractionMethod: 'deterministic-house-committee-roll-call-v1',
          });
        }
      }
    }
  }

  candidates.sort((left, right) =>
    left.case.occurredOn.localeCompare(right.case.occurredOn)
    || left.case.identifier.localeCompare(right.case.identifier)
    || left.source.sourceId.localeCompare(right.source.sourceId)
    || left.memberName.localeCompare(right.memberName)
    || left.voteSide.localeCompare(right.voteSide));

  const pairKeys = new Set(candidates.map((item) => `${item.case.voteEventId}|${item.membershipId}`));
  return {
    schemaVersion: HISTORICAL_DEEP_DISCOVERY_CANDIDATE_SCHEMA,
    generatedAt,
    purpose: 'evaluation-only outcome-blind candidate extraction from frozen pre-vote official committee records; no floor outcomes, probability updates, or evidence application',
    input: {
      discoveryCases: discovery.cases.length,
      discoveryMemberCasePairs: discovery.cases.reduce((sum, value) => sum + value.members.length, 0),
      sourceCount: sources.sourceCount,
      sourceCaseCount: sources.caseCount,
    },
    summary: {
      candidateCount: candidates.length,
      memberCasePairsWithCandidates: pairKeys.size,
      casesWithCandidates: new Set(candidates.map((item) => item.case.voteEventId)).size,
      sourcesWithCandidates: new Set(candidates.map((item) => item.source.sourceId)).size,
      ayeCandidates: candidates.filter((item) => item.voteSide === 'aye').length,
      nayCandidates: candidates.filter((item) => item.voteSide === 'nay').length,
      currentDeepTargetCandidates: candidates.filter((item) => item.selectedForCurrentDeep).length,
      outsideCurrentDeepCandidates: candidates.filter((item) => !item.selectedForCurrentDeep).length,
    },
    candidates,
    diagnostics,
  };
}
