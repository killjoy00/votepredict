import { createHash } from 'node:crypto';
import { historicalHtmlLines } from './historical-deep-discovery-extractor';
import {
  extractHistoricalDeepExpansionCandidates,
  type HistoricalDeepExpansionDiscoveryCandidate,
} from './historical-deep-expansion-extractor';
import type {
  HistoricalDeepExpansionDiscoveryCase,
  HistoricalDeepExpansionDiscoveryManifest,
  HistoricalDeepExpansionDiscoveryMember,
} from './historical-deep-expansion-discovery';
import type {
  HistoricalDeepExpansionCollectedSource,
  HistoricalDeepExpansionSourceBundle,
} from './historical-deep-expansion-source-bundle';

export const HISTORICAL_DEEP_EXPANSION_CANDIDATE_V2_SCHEMA = 'historical-deep-expansion-discovery-candidates-v2' as const;
export const HISTORICAL_DEEP_EXPANSION_PARSER_V2 = 'deterministic-house-committee-roll-call-v2' as const;

type ExtractionRule =
  | 'v1-baseline'
  | 'general-register-roll-call'
  | 'alternate-roll-trigger'
  | 'direct-named-roll-list';

export type HistoricalDeepExpansionDiscoveryCandidateV2 = Omit<
  HistoricalDeepExpansionDiscoveryCandidate,
  'extractionMethod'
> & {
  extractionMethod: typeof HISTORICAL_DEEP_EXPANSION_PARSER_V2;
  extractionRule: ExtractionRule;
};

export interface HistoricalDeepExpansionExtractionV2Diagnostic {
  sourceId: string;
  voteEventId: string;
  identifier: string;
  type: 'no_named_bill_roll_call' | 'unresolved_vote_name' | 'ambiguous_vote_name';
  rawName?: string;
  detail: string;
}

export interface HistoricalDeepExpansionDiscoveryCandidateBundleV2 {
  schemaVersion: typeof HISTORICAL_DEEP_EXPANSION_CANDIDATE_V2_SCHEMA;
  generatedAt: string;
  purpose: string;
  metadata: {
    parser: typeof HISTORICAL_DEEP_EXPANSION_PARSER_V2;
    baselineParser: 'deterministic-house-committee-roll-call-v1';
    outcomeUse: 'none';
    designGuard: string;
  };
  input: {
    discoveryCases: number;
    discoveryMemberCasePairs: number;
    sourcePages: number;
    sourceCaseMatches: number;
    casesWithSources: number;
    casesWithoutSources: number;
  };
  summary: {
    candidateCount: number;
    v1BaselineCandidateCount: number;
    supplementalCandidateCount: number;
    memberCasePairsWithCandidates: number;
    casesWithCandidates: number;
    sourcesWithCandidates: number;
    sourceCaseMatchesWithCandidates: number;
    ayeCandidates: number;
    nayCandidates: number;
    currentDeepTargetCandidates: number;
    candidateDeepTargetCandidates: number;
    bothTargetCandidates: number;
    outsideBothTargetCandidates: number;
    generalRegisterCandidates: number;
    alternateRollTriggerCandidates: number;
    directNamedRollListCandidates: number;
  };
  candidates: HistoricalDeepExpansionDiscoveryCandidateV2[];
  diagnostics: HistoricalDeepExpansionExtractionV2Diagnostic[];
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

function memberTokens(member: HistoricalDeepExpansionDiscoveryMember): string[] {
  return normalizeName(member.memberName).split(' ').filter(Boolean);
}

function stripVoteNameDecorations(value: string): string {
  return value
    .replace(/\([^)]*\)/g, ' ')
    .replace(/^[-•]+\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

type PageAliasMap = ReadonlyMap<string, HistoricalDeepExpansionDiscoveryMember | null>;

function resolveExplicitCommaName(
  cleaned: string,
  members: readonly HistoricalDeepExpansionDiscoveryMember[],
): { member?: HistoricalDeepExpansionDiscoveryMember; ambiguous: boolean; alias?: string } {
  const comma = cleaned.indexOf(',');
  if (comma < 1) return { ambiguous: false };
  const lastTokens = normalizeName(cleaned.slice(0, comma)).split(' ').filter(Boolean);
  const firstTokens = normalizeName(cleaned.slice(comma + 1)).split(' ').filter(Boolean);
  const first = firstTokens[0];
  if (lastTokens.length === 0 || !first) return { ambiguous: false };
  const candidates = members.filter((member) => {
    const tokens = memberTokens(member);
    if (!tokens.includes(first)) return false;
    return lastTokens.every((token) => tokens.includes(token));
  });
  if (candidates.length === 1) return { member: candidates[0], ambiguous: false, alias: lastTokens.join(' ') };
  return { ambiguous: candidates.length > 1, alias: lastTokens.join(' ') };
}

function buildPageAliases(
  lines: readonly string[],
  members: readonly HistoricalDeepExpansionDiscoveryMember[],
): Map<string, HistoricalDeepExpansionDiscoveryMember | null> {
  const aliases = new Map<string, HistoricalDeepExpansionDiscoveryMember | null>();
  for (const line of lines) {
    if (!line.includes(',') || line.length > 120) continue;
    const resolved = resolveExplicitCommaName(stripVoteNameDecorations(line), members);
    if (!resolved.member || !resolved.alias) continue;
    if (!aliases.has(resolved.alias)) {
      aliases.set(resolved.alias, resolved.member);
      continue;
    }
    const existing = aliases.get(resolved.alias);
    if (existing && existing.membershipId !== resolved.member.membershipId) aliases.set(resolved.alias, null);
  }
  return aliases;
}

function resolveVoteName(
  rawName: string,
  members: readonly HistoricalDeepExpansionDiscoveryMember[],
  pageAliases: PageAliasMap,
): { member?: HistoricalDeepExpansionDiscoveryMember; ambiguous: boolean } {
  const cleaned = stripVoteNameDecorations(rawName);
  if (!cleaned) return { ambiguous: false };
  if (cleaned.includes(',')) return resolveExplicitCommaName(cleaned, members);

  const sourceTokens = normalizeName(cleaned).split(' ').filter(Boolean);
  if (sourceTokens.length === 1 && pageAliases.has(sourceTokens[0])) {
    const aliased = pageAliases.get(sourceTokens[0]);
    return aliased ? { member: aliased, ambiguous: false } : { ambiguous: true };
  }
  const candidates = members.filter((member) => {
    const tokens = memberTokens(member);
    if (sourceTokens.length === 1) return tokens.at(-1) === sourceTokens[0];
    return sourceTokens.every((token) => tokens.includes(token));
  });
  if (candidates.length === 1) return { member: candidates[0], ambiguous: false };
  return { ambiguous: candidates.length > 1 };
}

function compactIdentifier(identifier: string): string {
  return identifier.replace(/\s+/g, '').toLowerCase();
}

function containsIdentifier(value: string, identifier: string): boolean {
  return compactIdentifier(value).includes(compactIdentifier(identifier));
}

function isBillProceduralMotion(value: string, identifier: string): boolean {
  if (!containsIdentifier(value, identifier) || /\bamendment\b/i.test(value)) return false;
  return /\b(re-?refer|refer(?:red)?|recommend(?:ed)?\s+to\s+pass|recommended\s+to\s+pass|laid\s+over|table)\b/i.test(value)
    || /\b(?:place(?:d)?|recommend(?:ed)?\s+to\s+be\s+placed)\b[^.]{0,100}\bGeneral\s+Register\b/i.test(value);
}

function isV1RollCallRequest(value: string): boolean {
  return /\brequest(?:ed|s)?\b[^.]{0,100}\broll call\b/i.test(value) && !/\bamendment\b/i.test(value);
}

function isExpandedRollTrigger(value: string): boolean {
  if (/\bamendment\b/i.test(value)) return false;
  return isV1RollCallRequest(value)
    || /\b(?:a\s+)?roll call\s+(?:was\s+)?taken\b/i.test(value)
    || /\bclerk\s+(?:then\s+)?noted\s+the\s+roll\b/i.test(value)
    || /\broll\s+was\s+called\b/i.test(value);
}

function voteMarker(value: string): 'aye' | 'nay' | undefined {
  if (/^(?:members voting\s+)?ayes?:?$/i.test(value)) return 'aye';
  if (/^(?:members voting\s+)?nays?:?$/i.test(value)) return 'nay';
  return undefined;
}

function isVoteStop(value: string): boolean {
  return /^(?:(?:members\s+)?(?:excused|absent|abstain)s?:?|there being\b|on a vote\b|with a vote\b|the motion\b|motion\s+(?:prevailed|failed)\b)/i.test(value);
}

function looksLikeVoteName(value: string): boolean {
  if (!value || value.length > 80) return false;
  const cleaned = stripVoteNameDecorations(value);
  if (!cleaned) return false;
  if (/\b(?:motion|prevailed|failed|committee|representative|clerk|roll call|aye|nay|excused|absent|abstain)\b/i.test(cleaned)) return false;
  return /^[A-Za-zÀ-ÖØ-öø-ÿ’'\-. ]+(?:,\s*[A-Za-zÀ-ÖØ-öø-ÿ’'\-. ]+)?(?:\s*\([^)]*\))?$/.test(value);
}

interface ExpandedRollCallBlock {
  motionText: string;
  excerpt: string;
  ayes: string[];
  nays: string[];
  extractionRule: Exclude<ExtractionRule, 'v1-baseline'>;
}

function findExpandedRollCalls(lines: readonly string[], identifier: string): ExpandedRollCallBlock[] {
  const blocks: ExpandedRollCallBlock[] = [];
  for (let motionIndex = 0; motionIndex < lines.length; motionIndex += 1) {
    const motionText = lines[motionIndex];
    if (!isBillProceduralMotion(motionText, identifier)) continue;

    let markerIndex = -1;
    let triggerIndex = -1;
    let blocked = false;
    for (let cursor = motionIndex + 1; cursor < lines.length && cursor <= motionIndex + 10; cursor += 1) {
      const line = lines[cursor];
      if (/\bamendment\b/i.test(line)) {
        blocked = true;
        break;
      }
      if (isBillProceduralMotion(line, identifier)) break;
      if (isExpandedRollTrigger(line) && triggerIndex < 0) triggerIndex = cursor;
      if (voteMarker(line)) {
        markerIndex = cursor;
        break;
      }
    }
    if (blocked || markerIndex < 0) continue;
    if (triggerIndex < 0 && markerIndex - motionIndex > 3) continue;

    const ayes: string[] = [];
    const nays: string[] = [];
    let side = voteMarker(lines[markerIndex]);
    let cursor = markerIndex + 1;
    let endIndex = markerIndex;
    while (cursor < lines.length && cursor <= markerIndex + 80) {
      const line = lines[cursor];
      const marker = voteMarker(line);
      if (marker) {
        side = marker;
        endIndex = cursor;
        cursor += 1;
        continue;
      }
      if (isVoteStop(line) || /\bamendment\b/i.test(line)) {
        endIndex = cursor;
        break;
      }
      if (looksLikeVoteName(line) && side) {
        (side === 'aye' ? ayes : nays).push(line);
      }
      endIndex = cursor;
      cursor += 1;
    }
    if (ayes.length === 0 && nays.length === 0) continue;

    const generalRegister = /\bGeneral\s+Register\b/i.test(motionText);
    const extractionRule: ExpandedRollCallBlock['extractionRule'] = generalRegister
      ? 'general-register-roll-call'
      : triggerIndex >= 0 && !isV1RollCallRequest(lines[triggerIndex])
        ? 'alternate-roll-trigger'
        : 'direct-named-roll-list';
    blocks.push({
      motionText,
      excerpt: lines.slice(motionIndex, Math.min(lines.length, endIndex + 1)).join(' '),
      ayes,
      nays,
      extractionRule,
    });
  }
  return blocks;
}

function verifySourceHash(source: HistoricalDeepExpansionCollectedSource): void {
  const actual = createHash('sha256').update(Buffer.from(source.content, 'utf8')).digest('hex');
  if (actual !== source.contentSha256) {
    throw new Error(`Frozen source hash mismatch for ${source.id}: expected ${source.contentSha256}, got ${actual}`);
  }
}

function validateInputs(
  discovery: HistoricalDeepExpansionDiscoveryManifest,
  sources: HistoricalDeepExpansionSourceBundle,
): Map<string, HistoricalDeepExpansionDiscoveryCase> {
  if (discovery.schemaVersion !== 'historical-deep-expansion-discovery-manifest-v1') {
    throw new Error(`Unsupported expansion discovery schema: ${String(discovery.schemaVersion)}`);
  }
  if (sources.schemaVersion !== 'historical-deep-expansion-source-bundle-v1') {
    throw new Error(`Unsupported expansion source schema: ${String(sources.schemaVersion)}`);
  }
  if (discovery.cases.length !== 24) throw new Error(`Expected 24 expansion cases, got ${discovery.cases.length}`);
  const byVoteId = new Map(discovery.cases.map((item) => [item.voteEventId, item]));
  if (byVoteId.size !== discovery.cases.length) throw new Error('Duplicate expansion discovery vote event id');
  for (const source of sources.sources) {
    verifySourceHash(source);
    for (const match of source.matchedCases) {
      const item = byVoteId.get(match.voteEventId);
      if (!item) throw new Error(`Frozen source ${source.id} refers to unknown vote event ${match.voteEventId}`);
      if (
        item.stableKey !== match.stableKey
        || item.caseKey !== match.caseKey
        || item.externalKey !== match.externalKey
        || item.identifier !== match.identifier
        || item.occurredOn !== match.occurredOn
      ) throw new Error(`Frozen source ${source.id} case lineage mismatch for ${match.voteEventId}`);
      if (source.indexDate >= item.occurredOn) throw new Error(`Frozen source ${source.id} is not strictly pre-vote for ${item.stableKey}`);
    }
  }
  return byVoteId;
}

function candidateKey(candidate: Pick<HistoricalDeepExpansionDiscoveryCandidateV2, 'case' | 'source' | 'motionText' | 'membershipId' | 'voteSide'>): string {
  return [candidate.case.voteEventId, candidate.source.sourceId, candidate.motionText, candidate.membershipId, candidate.voteSide].join('|');
}

export function extractHistoricalDeepExpansionCandidatesV2(
  discovery: HistoricalDeepExpansionDiscoveryManifest,
  sources: HistoricalDeepExpansionSourceBundle,
  generatedAt = new Date().toISOString(),
): HistoricalDeepExpansionDiscoveryCandidateBundleV2 {
  const caseByVoteId = validateInputs(discovery, sources);
  const baseline = extractHistoricalDeepExpansionCandidates(discovery, sources, generatedAt);
  const candidates: HistoricalDeepExpansionDiscoveryCandidateV2[] = baseline.candidates.map((candidate) => ({
    ...candidate,
    extractionMethod: HISTORICAL_DEEP_EXPANSION_PARSER_V2,
    extractionRule: 'v1-baseline',
  }));
  const dedupe = new Set(candidates.map(candidateKey));
  const diagnostics: HistoricalDeepExpansionExtractionV2Diagnostic[] = [];
  const matchedPairsWithCandidates = new Set(candidates.map((item) => `${item.source.sourceId}|${item.case.voteEventId}`));

  for (const source of sources.sources) {
    const lines = historicalHtmlLines(source.content);
    for (const match of source.matchedCases) {
      const discoveryCase = caseByVoteId.get(match.voteEventId);
      if (!discoveryCase) throw new Error(`Missing discovery case ${match.voteEventId}`);
      const pageAliases = buildPageAliases(lines, discoveryCase.members);
      const blocks = findExpandedRollCalls(lines, discoveryCase.identifier);
      let resolvedForSourceCase = 0;

      for (const block of blocks) {
        for (const [voteSide, rawNames] of [['aye', block.ayes], ['nay', block.nays]] as const) {
          for (const rawName of rawNames) {
            const resolved = resolveVoteName(rawName, discoveryCase.members, pageAliases);
            if (!resolved.member) {
              diagnostics.push({
                sourceId: source.id,
                voteEventId: discoveryCase.voteEventId,
                identifier: discoveryCase.identifier,
                type: resolved.ambiguous ? 'ambiguous_vote_name' : 'unresolved_vote_name',
                rawName,
                detail: `Could not ${resolved.ambiguous ? 'uniquely ' : ''}resolve named committee vote to the frozen chamber roster.`,
              });
              continue;
            }
            const member = resolved.member;
            const candidate: HistoricalDeepExpansionDiscoveryCandidateV2 = {
              case: {
                stableKey: discoveryCase.stableKey,
                caseKey: discoveryCase.caseKey,
                externalKey: discoveryCase.externalKey,
                tranche: discoveryCase.tranche,
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
              selectedForCandidateDeep: member.selectedForCandidateDeep,
              kind: 'committee_bill_procedural_vote',
              voteSide,
              motionText: block.motionText,
              excerpt: block.excerpt,
              source: {
                sourceId: source.id,
                sourceClass: source.sourceClass,
                title: source.title,
                url: source.url,
                publishedAt: source.publishedAt,
                contentSha256: source.contentSha256,
              },
              extractionMethod: HISTORICAL_DEEP_EXPANSION_PARSER_V2,
              extractionRule: block.extractionRule,
            };
            const key = candidateKey(candidate);
            if (dedupe.has(key)) continue;
            dedupe.add(key);
            candidates.push(candidate);
            resolvedForSourceCase += 1;
          }
        }
      }

      const pairKey = `${source.id}|${discoveryCase.voteEventId}`;
      if (resolvedForSourceCase > 0) matchedPairsWithCandidates.add(pairKey);
      if (!matchedPairsWithCandidates.has(pairKey) && blocks.length === 0) {
        diagnostics.push({
          sourceId: source.id,
          voteEventId: discoveryCase.voteEventId,
          identifier: discoveryCase.identifier,
          type: 'no_named_bill_roll_call',
          detail: 'No deterministic named-member bill-level procedural roll call was found. Voice votes, motion-result text without member names, amendments, and unrelated roll calls remain non-actionable.',
        });
      }
    }
  }

  candidates.sort((left, right) => left.case.stableKey.localeCompare(right.case.stableKey)
    || left.source.sourceId.localeCompare(right.source.sourceId)
    || left.motionText.localeCompare(right.motionText)
    || left.membershipId.localeCompare(right.membershipId)
    || left.voteSide.localeCompare(right.voteSide));

  const pairKeys = new Set(candidates.map((item) => `${item.case.voteEventId}|${item.membershipId}`));
  return {
    schemaVersion: HISTORICAL_DEEP_EXPANSION_CANDIDATE_V2_SCHEMA,
    generatedAt,
    purpose: 'evaluation-only outcome-blind deterministic extraction from the immutable official pre-vote expansion corpus; broaden formatting coverage without using floor outcomes or changing production evidence behavior',
    metadata: {
      parser: HISTORICAL_DEEP_EXPANSION_PARSER_V2,
      baselineParser: 'deterministic-house-committee-roll-call-v1',
      outcomeUse: 'none',
      designGuard: 'V2 was specified from frozen source-format misses only. It adds General Register motions, alternate official roll-call trigger wording, and direct named AYES/NAYS lists; it still requires named member votes and ignores amendments, voice votes, and outcome data.',
    },
    input: {
      discoveryCases: discovery.cases.length,
      discoveryMemberCasePairs: discovery.metadata.memberCasePairs,
      sourcePages: sources.sources.length,
      sourceCaseMatches: sources.summary.sourceCaseMatches,
      casesWithSources: sources.summary.casesWithSources,
      casesWithoutSources: sources.summary.casesWithoutSources,
    },
    summary: {
      candidateCount: candidates.length,
      v1BaselineCandidateCount: baseline.candidates.length,
      supplementalCandidateCount: candidates.length - baseline.candidates.length,
      memberCasePairsWithCandidates: pairKeys.size,
      casesWithCandidates: new Set(candidates.map((item) => item.case.stableKey)).size,
      sourcesWithCandidates: new Set(candidates.map((item) => item.source.sourceId)).size,
      sourceCaseMatchesWithCandidates: matchedPairsWithCandidates.size,
      ayeCandidates: candidates.filter((item) => item.voteSide === 'aye').length,
      nayCandidates: candidates.filter((item) => item.voteSide === 'nay').length,
      currentDeepTargetCandidates: candidates.filter((item) => item.selectedForCurrentDeep).length,
      candidateDeepTargetCandidates: candidates.filter((item) => item.selectedForCandidateDeep).length,
      bothTargetCandidates: candidates.filter((item) => item.selectedForCurrentDeep && item.selectedForCandidateDeep).length,
      outsideBothTargetCandidates: candidates.filter((item) => !item.selectedForCurrentDeep && !item.selectedForCandidateDeep).length,
      generalRegisterCandidates: candidates.filter((item) => item.extractionRule === 'general-register-roll-call').length,
      alternateRollTriggerCandidates: candidates.filter((item) => item.extractionRule === 'alternate-roll-trigger').length,
      directNamedRollListCandidates: candidates.filter((item) => item.extractionRule === 'direct-named-roll-list').length,
    },
    candidates,
    diagnostics,
  };
}
