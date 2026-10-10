/**
 * Issue #864, bucket D. Offline, source-byte-verified audit only.
 * A news mention is not a senator statement. No prediction/DB writes.
 */
import { createHash } from 'node:crypto';
import { LOCAL_TRADE_NEWS_SEEDS } from './local-trade-news-history.js';

export const SENATE_MEDIA_REMARKS_AUDIT_VERSION = 'senate-media-remarks-2021-25-offline-v1' as const;
const SHA = /^[a-f0-9]{64}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const YEARS = [2021, 2022, 2023, 2024, 2025] as const;
const SEEDS = new Map(LOCAL_TRADE_NEWS_SEEDS.map(seed => [seed.id, seed]));

export interface SenateMediaContextExport {
  evidenceId: string;
  sourceDocumentId: string;
  sourceKind: string;
  sourceUrl: string;
  sourceSha256: string;
  seedId: string | null;
  publisher: string | null;
  originalUrl: string | null;
  archiveUrl: string | null;
  archiveCapturedAt: string | null;
  archiveDigest: string | null;
  publisherPublishedAt: string | null;
  evidencePublishedAt: string | null;
  evidenceKind: string;
  stance: string | null;
  contextOnly: boolean;
  sameDayEligible: boolean;
  modelWeight: number;
  articleInfersLegislativeStance: boolean;
  mentionedMembers: string[];
}

export interface SenateMediaRosterYear {
  year: number;
  membershipId: string;
  senatorId: string;
  senatorName: string;
  activeFrom: string | null;
  activeThrough: string | null;
}

export interface SenateMediaSourceSnapshot {
  sourceDocumentId: string;
  /** Base64 of the exact original archived HTML response bytes, not text excerpt. */
  rawBodyBase64: string;
}

export type SenateMediaReviewDisposition =
  | 'exact_named_quote' | 'contextual_mention' | 'speaker_ambiguous' | 'source_unavailable';

export interface SenateMediaReview {
  sourceDocumentId: string;
  disposition: SenateMediaReviewDisposition;
  membershipId?: string;
  issueCategory?: string;
  exactQuote?: string;
  /** Contiguous original article passage containing BOTH the cue and quote. */
  sourcePassage?: string;
  /** Explicit "Sen. Surname said" / full-name attribution, in sourcePassage. */
  attributionCue?: string;
  /** Source page's publication date, independently reviewed; not the availability date. */
  publisherPublishedAt?: string;
  /** Exact HTML metadata/date line or visible date passage supporting the publication date. */
  publicationDateProof?: string;
  reviewedBy: string;
  reviewedAt: string;
  reviewerNotes?: string;
}

function validDay(value: string | null | undefined): value is string {
  if (!value || !DATE.test(value)) return false;
  const day = new Date(value + 'T00:00:00Z');
  return Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === value;
}
function instant(value: string | null | undefined): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}
function digest(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}
function plain(value: string): string {
  return value.replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([a-f0-9]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, ' ').trim();
}
function visibleBody(raw: string): string {
  return plain(raw.replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(?:script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/(?:script|style|noscript|svg)\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '));
}
function parseArchive(url: string | null, original: string | null) {
  if (!url || !original) return null;
  const match = url.match(/^https:\/\/web\.archive\.org\/web\/(\d{14})id_\/(https?:\/\/.+)$/i);
  if (!match || match[2] !== original) return null;
  const d = match[1]!;
  const date = d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8)
    + 'T' + d.slice(8, 10) + ':' + d.slice(10, 12) + ':' + d.slice(12, 14) + 'Z';
  return instant(date) === null ? null : date;
}
function contextIssues(row: SenateMediaContextExport): string[] {
  const issues: string[] = [];
  const seed = row.seedId && SEEDS.get(row.seedId);
  if (!seed || row.publisher !== seed.publisher) issues.push('unknown_publisher_or_seed');
  if (row.sourceKind !== 'wayback_local_trade_news'
      || row.evidenceKind !== 'context' || row.stance !== 'neutral'
      || row.contextOnly !== true || row.sameDayEligible !== false
      || row.modelWeight !== 0 || row.articleInfersLegislativeStance !== false) {
    issues.push('not_neutral_archived_context');
  }
  if (!SHA.test(row.sourceSha256)) issues.push('missing_original_content_hash');
  if (!row.archiveDigest?.trim()) issues.push('missing_archive_digest');
  const urlDate = parseArchive(row.archiveUrl, row.originalUrl);
  const captured = instant(row.archiveCapturedAt);
  if (!urlDate || captured === null || instant(urlDate) !== captured
      || row.sourceUrl !== row.archiveUrl || instant(row.evidencePublishedAt) !== captured) {
    issues.push('archive_url_capture_or_evidence_date_mismatch');
  }
  if (row.publisherPublishedAt !== null && instant(row.publisherPublishedAt) === null)
    issues.push('invalid_publisher_date');
  if (captured !== null && instant(row.publisherPublishedAt) !== null
      && instant(row.publisherPublishedAt)! > captured) issues.push('publisher_date_after_archive');
  if (!Array.isArray(row.mentionedMembers) || row.mentionedMembers.some(name => typeof name !== 'string'))
    issues.push('invalid_mentioned_members');
  return issues;
}
function active(row: SenateMediaRosterYear, day: string): boolean {
  return validDay(row.activeFrom) && validDay(row.activeThrough)
    && row.activeFrom <= day && day <= row.activeThrough;
}
function quoteIssues(
  review: SenateMediaReview,
  source: SenateMediaContextExport,
  sourceProblems: string[],
  roster: SenateMediaRosterYear[],
  snapshot: SenateMediaSourceSnapshot | undefined,
): string[] {
  const issues = [...sourceProblems];
  const member = roster.find(m => m.membershipId === review.membershipId
    && m.year === Number(review.publisherPublishedAt?.slice(0, 4)));
  if (!member) issues.push('unresolved_senate_membership_in_publication_year');
  const pub = instant(review.publisherPublishedAt);
  const capture = instant(source.archiveCapturedAt);
  if (pub === null || pub > (capture ?? -1)
      || review.publisherPublishedAt !== source.publisherPublishedAt) {
    issues.push('publisher_publication_date_not_proven');
  }
  if (pub !== null && member && !active(member, new Date(pub).toISOString().slice(0, 10)))
    issues.push('senator_not_active_on_publication_date');
  if (!review.issueCategory?.trim()) issues.push('issue_not_reviewed');
  if (!review.reviewedBy?.trim() || instant(review.reviewedAt) === null)
    issues.push('missing_human_review');
  if (!review.exactQuote || review.exactQuote.trim().length < 12
      || !review.sourcePassage || !review.attributionCue) {
    issues.push('no_exact_quote_and_named_attribution_passage');
  }
  let decoded = '';
  let raw = '';
  if (!snapshot) issues.push('original_snapshot_bytes_unavailable');
  else if (!/^[A-Za-z0-9+/]+={0,2}$/.test(snapshot.rawBodyBase64)
      || snapshot.rawBodyBase64.length > 5_000_000) issues.push('invalid_snapshot_encoding_or_size');
  else {
    const bytes = Buffer.from(snapshot.rawBodyBase64, 'base64');
    if (bytes.toString('base64') !== snapshot.rawBodyBase64
        || digest(bytes) !== source.sourceSha256) issues.push('archived_original_bytes_hash_mismatch');
    else {
      raw = bytes.toString('utf8');
      decoded = visibleBody(raw);
    }
  }
  if (!decoded) issues.push('exact_article_text_not_authenticated');
  else {
    const passage = plain(review.sourcePassage ?? '');
    const cue = plain(review.attributionCue ?? '');
    const quote = plain(review.exactQuote ?? '');
    if (!passage || !decoded.includes(passage)) issues.push('passage_not_in_original_article');
    if (!cue || !passage.includes(cue) || !quote || !passage.includes(quote)
        || passage.indexOf(cue) > passage.indexOf(quote)
        || passage.indexOf(quote) - passage.indexOf(cue) > 260) {
      issues.push('quote_or_attribution_cue_not_contiguous');
    }
    // A surname alone, anonymous caption or "said they" cannot prove a speaker.
    if (member) {
      const last = member.senatorName.trim().split(/\s+/).at(-1)?.toLowerCase() ?? '';
      const named = cue.toLowerCase();
      if (!last || !(named.includes(member.senatorName.toLowerCase())
        || new RegExp('\\bsen(?:ator)?\\.?\\s+' + last.replace(/[.*+?^()|[\]{}\\]/g, '\\$&') + '\\b', 'i').test(cue))) {
        issues.push('speaker_not_explicitly_named_in_attribution');
      }
    }
    const dateProof = review.publicationDateProof?.trim() ?? '';
    if (dateProof.length < 6 || !raw.includes(dateProof))
      issues.push('original_publisher_date_proof_missing');
  }
  return [...new Set(issues)];
}

/** All rates here are proportions of the supplied export, NEVER a statewide media denominator. */
export function auditSenateMediaRemarks(input: {
  contexts: readonly SenateMediaContextExport[];
  roster: readonly SenateMediaRosterYear[];
  snapshots?: readonly SenateMediaSourceSnapshot[];
  reviews?: readonly SenateMediaReview[];
}) {
  const contexts = input.contexts;
  const roster = input.roster;
  const reviews = input.reviews ?? [];
  const snapshots = input.snapshots ?? [];
  const seenEvidence = new Set<string>();
  const byDocument = new Map<string, SenateMediaContextExport>();
  let outsideScope = 0;
  const allContexts: SenateMediaContextExport[] = [];
  for (const row of contexts) {
    if (!row.evidenceId || !row.sourceDocumentId || seenEvidence.has(row.evidenceId))
      throw Error('Missing or duplicate media context evidence identity');
    seenEvidence.add(row.evidenceId);
    const year = Number(row.archiveCapturedAt?.slice(0, 4));
    if (!YEARS.includes(year as typeof YEARS[number])) { outsideScope++; continue; }
    const previous = byDocument.get(row.sourceDocumentId);
    if (previous && (previous.sourceSha256 !== row.sourceSha256
        || previous.archiveUrl !== row.archiveUrl || previous.seedId !== row.seedId))
      throw Error('Conflicting source identities in media context export');
    byDocument.set(row.sourceDocumentId, row);
    allContexts.push(row);
  }
  const rosterKeys = new Set<string>();
  for (const member of roster) {
    const key = member.year + ':' + member.membershipId;
    if (!YEARS.includes(member.year as typeof YEARS[number]) || !member.membershipId
      || !member.senatorId || !member.senatorName.trim() || rosterKeys.has(key))
      throw Error('Invalid or duplicate senator-year roster entry');
    rosterKeys.add(key);
  }
  const snapshotsByDocument = new Map<string, SenateMediaSourceSnapshot>();
  for (const item of snapshots) {
    if (!byDocument.has(item.sourceDocumentId) || snapshotsByDocument.has(item.sourceDocumentId))
      throw Error('Unknown or duplicate archived media snapshot identity');
    snapshotsByDocument.set(item.sourceDocumentId, item);
  }
  const invalidSources = new Map<string, string[]>();
  for (const [id, row] of byDocument) invalidSources.set(id, contextIssues(row));
  const classified: Array<{
    sourceDocumentId: string; membershipId: string | null; senatorName: string | null;
    issueCategory: string | null; disposition: SenateMediaReviewDisposition;
    verified: boolean; failures: string[]; publisher: string | null;
    originalUrl: string | null; archiveUrl: string | null;
    sourceSha256: string; publishedAt: string | null; provenPublicBy: string | null;
    exactQuote: string | null; attributablePassage: string | null;
  }> = [];
  const reviewKeys = new Set<string>();
  for (const review of reviews) {
    const row = byDocument.get(review.sourceDocumentId);
    if (!row) throw Error('Media review references unknown or out-of-scope source');
    const key = review.sourceDocumentId + '|' + (review.membershipId ?? '')
      + '|' + (review.exactQuote ?? '') + '|' + review.disposition;
    if (reviewKeys.has(key)) throw Error('Duplicate media review verdict');
    reviewKeys.add(key);
    const member = roster.find(m => m.membershipId === review.membershipId
      && m.year === Number(review.publisherPublishedAt?.slice(0, 4)));
    const failures = review.disposition === 'exact_named_quote'
      ? quoteIssues(review, row, invalidSources.get(row.sourceDocumentId) ?? [],
        roster, snapshotsByDocument.get(row.sourceDocumentId))
      : [];
    classified.push({
      sourceDocumentId: row.sourceDocumentId,
      membershipId: review.membershipId ?? null,
      senatorName: member?.senatorName ?? null,
      issueCategory: review.issueCategory ?? null,
      disposition: review.disposition,
      verified: review.disposition === 'exact_named_quote' && failures.length === 0,
      failures, publisher: row.publisher, originalUrl: row.originalUrl,
      archiveUrl: row.archiveUrl, sourceSha256: row.sourceSha256,
      publishedAt: row.publisherPublishedAt, provenPublicBy: row.archiveCapturedAt,
      exactQuote: review.disposition === 'exact_named_quote' ? review.exactQuote ?? null : null,
      attributablePassage: review.disposition === 'exact_named_quote' ? review.sourcePassage ?? null : null,
    });
  }
  const verified = classified.filter(x => x.verified);
  const byPublisherYear = YEARS.flatMap(year => LOCAL_TRADE_NEWS_SEEDS.map(seed => {
    const items = allContexts.filter(x => x.seedId === seed.id
      && Number(x.archiveCapturedAt?.slice(0, 4)) === year);
    const ids = new Set(items.map(x => x.sourceDocumentId));
    const accepted = verified.filter(x => ids.has(x.sourceDocumentId));
    return {
      year, seedId: seed.id, publisher: seed.publisher,
      exportedContextItems: items.length, distinctArchivedArticles: ids.size,
      originalSnapshotsSupplied: [...ids].filter(id => snapshotsByDocument.has(id)).length,
      verifiedAttributableQuotes: accepted.length,
      unreviewedArchivedArticles: [...ids].filter(id => !classified.some(x => x.sourceDocumentId === id)).length,
      invalidProvenanceArticles: [...ids].filter(id => (invalidSources.get(id)?.length ?? 0) > 0).length,
      missingness: ids.size === 0 ? 'not_observed_in_export_not_no_published_articles'
        : 'sampled_archive_not_full_publisher_article_universe',
    };
  }));
  const bySenatorYear = roster.map(member => {
    const mentions = new Set(allContexts
      .filter(c => Number(c.archiveCapturedAt?.slice(0, 4)) === member.year
        && c.mentionedMembers?.includes(member.senatorName))
      .map(c => c.sourceDocumentId));
    const attributed = verified.filter(q => q.membershipId === member.membershipId
      && q.publishedAt?.slice(0, 4) === String(member.year));
    return {
      year: member.year, senatorId: member.senatorId,
      membershipId: member.membershipId, senatorName: member.senatorName,
      archiveArticleMentions: mentions.size,
      verifiedPublicationYearQuotes: attributed.length,
      missingness: attributed.length ? 'verified_quotes_in_bounded_corpus_only'
        : 'no_verified_quote_in_export_not_no_public_remark',
    };
  }).sort((a, b) => a.year - b.year || a.senatorName.localeCompare(b.senatorName));
  return {
    version: SENATE_MEDIA_REMARKS_AUDIT_VERSION,
    studyYears: [...YEARS],
    corpusContextItemsInSuppliedExport: allContexts.length,
    corpusContextItemsOutsideStudyYears: outsideScope,
    distinctArchivedArticlesInExport: byDocument.size,
    verifiedAttributedQuotePassages: verified.length,
    reviewedButUnverifiedQuotePassages: classified.filter(x =>
      x.disposition === 'exact_named_quote' && !x.verified).length,
    unreviewedArchivedArticles: [...byDocument.keys()].filter(id =>
      !classified.some(x => x.sourceDocumentId === id)).length,
    missingOrInvalidProvenanceArticles: [...invalidSources.values()].filter(x => x.length).length,
    byPublisherYear, bySenatorYear, reviewResults: classified,
    policy: {
      contextMentionIsNotAStatement: true,
      namedSpeakerAndExactPassageRequired: true,
      originalArchivedBytesSha256Required: true,
      publisherDateAndArchiveAvailabilityAreDistinct: true,
      sameDayEligibility: false, modelWeight: 0,
      stanceInferred: false, productionDatabaseRead: false,
      productionDatabaseWrite: false, servingChanged: false,
      knownStatewideMediaRemarksDenominator: null,
      archiveSelectionCapsPreventCompletenessClaim: true,
      noHistoricalCompletenessCertificate: true,
    },
  };
}
