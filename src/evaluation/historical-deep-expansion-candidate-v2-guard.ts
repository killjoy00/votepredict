import { historicalHtmlLines } from './historical-deep-discovery-extractor';
import type {
  HistoricalDeepExpansionDiscoveryCandidateBundleV2,
  HistoricalDeepExpansionDiscoveryCandidateV2,
} from './historical-deep-expansion-extractor-v2';
import type { HistoricalDeepExpansionSourceBundle } from './historical-deep-expansion-source-bundle';

function compactIdentifier(value: string): string {
  const match = value.replace(/\s+/g, '').match(/^(HF|SF)(\d+)/i);
  if (!match) throw new Error(`Unsupported Minnesota bill identifier: ${value}`);
  return `${match[1].toLowerCase()}${match[2]}`;
}

function identifiersInLine(value: string): string[] {
  const found: string[] = [];
  for (const match of value.matchAll(/\b(HF|SF)\s*\.?\s*(\d+)/gi)) {
    found.push(`${match[1].toLowerCase()}${match[2]}`);
  }
  return found;
}

function excerptMatchesAt(lines: readonly string[], index: number, excerpt: string): boolean {
  let joined = '';
  for (let cursor = index; cursor < lines.length && cursor <= index + 90; cursor += 1) {
    joined = joined ? `${joined} ${lines[cursor]}` : lines[cursor];
    if (joined === excerpt) return true;
    if (joined.length >= excerpt.length) return false;
  }
  return false;
}

function nearbyBillContextMatches(
  lines: readonly string[],
  motionIndex: number,
  identifier: string,
): boolean {
  const target = compactIdentifier(identifier);
  for (let cursor = motionIndex - 1; cursor >= 0 && cursor >= motionIndex - 12; cursor -= 1) {
    const ids = identifiersInLine(lines[cursor]);
    if (ids.length === 0) continue;
    return ids.includes(target);
  }
  return true;
}

function candidateHasSafeLocalContext(
  candidate: HistoricalDeepExpansionDiscoveryCandidateV2,
  sourceLines: readonly string[],
): boolean {
  if (candidate.extractionRule === 'v1-baseline') return true;
  const matchingOccurrences: number[] = [];
  for (let index = 0; index < sourceLines.length; index += 1) {
    if (sourceLines[index] !== candidate.motionText) continue;
    if (excerptMatchesAt(sourceLines, index, candidate.excerpt)) matchingOccurrences.push(index);
  }
  if (matchingOccurrences.length === 0) {
    throw new Error(`Could not bind v2 candidate excerpt back to frozen source ${candidate.source.sourceId}`);
  }
  return matchingOccurrences.some((index) => nearbyBillContextMatches(sourceLines, index, candidate.case.identifier));
}

function recalculateSummary(
  bundle: HistoricalDeepExpansionDiscoveryCandidateBundleV2,
  candidates: HistoricalDeepExpansionDiscoveryCandidateV2[],
): HistoricalDeepExpansionDiscoveryCandidateBundleV2['summary'] {
  const baselineCount = candidates.filter((item) => item.extractionRule === 'v1-baseline').length;
  return {
    candidateCount: candidates.length,
    v1BaselineCandidateCount: baselineCount,
    supplementalCandidateCount: candidates.length - baselineCount,
    memberCasePairsWithCandidates: new Set(candidates.map((item) => `${item.case.voteEventId}|${item.membershipId}`)).size,
    casesWithCandidates: new Set(candidates.map((item) => item.case.stableKey)).size,
    sourcesWithCandidates: new Set(candidates.map((item) => item.source.sourceId)).size,
    sourceCaseMatchesWithCandidates: new Set(candidates.map((item) => `${item.source.sourceId}|${item.case.voteEventId}`)).size,
    ayeCandidates: candidates.filter((item) => item.voteSide === 'aye').length,
    nayCandidates: candidates.filter((item) => item.voteSide === 'nay').length,
    currentDeepTargetCandidates: candidates.filter((item) => item.selectedForCurrentDeep).length,
    candidateDeepTargetCandidates: candidates.filter((item) => item.selectedForCandidateDeep).length,
    bothTargetCandidates: candidates.filter((item) => item.selectedForCurrentDeep && item.selectedForCandidateDeep).length,
    outsideBothTargetCandidates: candidates.filter((item) => !item.selectedForCurrentDeep && !item.selectedForCandidateDeep).length,
    generalRegisterCandidates: candidates.filter((item) => item.extractionRule === 'general-register-roll-call').length,
    alternateRollTriggerCandidates: candidates.filter((item) => item.extractionRule === 'alternate-roll-trigger').length,
    directNamedRollListCandidates: candidates.filter((item) => item.extractionRule === 'direct-named-roll-list').length,
  };
}

export function applyHistoricalDeepExpansionV2LocalBillGuard(
  bundle: HistoricalDeepExpansionDiscoveryCandidateBundleV2,
  sources: HistoricalDeepExpansionSourceBundle,
): HistoricalDeepExpansionDiscoveryCandidateBundleV2 {
  const sourceLines = new Map(sources.sources.map((source) => [source.id, historicalHtmlLines(source.content)]));
  const candidates = bundle.candidates.filter((candidate) => {
    const lines = sourceLines.get(candidate.source.sourceId);
    if (!lines) throw new Error(`V2 candidate refers to unknown frozen source ${candidate.source.sourceId}`);
    return candidateHasSafeLocalContext(candidate, lines);
  });
  return {
    ...bundle,
    metadata: {
      ...bundle.metadata,
      designGuard: `${bundle.metadata.designGuard} Supplemental candidates are also rejected when the nearest preceding local bill reference within 12 parsed lines identifies a different bill, protecting against section-local copy/paste bill-number errors in official minutes.`,
    },
    summary: recalculateSummary(bundle, candidates),
    candidates,
  };
}
