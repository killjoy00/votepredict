/**
 * Issue #864, bucket D. Offline, source-byte-verified audit only.
 * A news mention is not a senator statement. No prediction/DB writes.
 */
import { createHash } from 'node:crypto';
import { LOCAL_TRADE_NEWS_SEEDS } from '../../src/evidence/local-trade-news-history.ts';

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

/**
 * These are ALTERNATIVE forms of direct quotation in original, SHA-verified
 * publisher HTML. This does not certify that separate audio existed at
 * publication time, that a transcript is contemporaneous with broadcast,
 * or that a forecast cutoff can reuse its archive capture.
 */
export type SenateMediaQuotePresentation =
  | 'reported_quotation' | 'speaker_labeled_transcript';

export interface SenateMediaReview {
  sourceDocumentId: string;
  disposition: SenateMediaReviewDisposition;
  membershipId?: string;
  issueCategory?: string;
  exactQuote?: string;
  /** Contiguous original article passage containing BOTH the cue and quote. */
  sourcePassage?: string;
  /** Reporter named cue, OR exact full-name speaker label, in sourcePassage. */
  attributionCue?: string;
  /**
   * Opt in explicitly to speaker-labeled original MPR interview transcripts;
   * absent field retains the old quoted-reporter-text-only rule.
   */
  quotePresentation?: SenateMediaQuotePresentation;
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
/**
 * Source, reviewer and archive timestamps must declare a timezone.
 * Date.parse otherwise treats zone-less publisher clocks as process-local and
 * may silently normalize impossible dates, inventing a historical cutoff.
 */
function instant(value: string | null | undefined): number | null {
  if (typeof value !== 'string') return null;
  const parts = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!parts || !validDay(parts[1])) return null;
  if (parts[2] !== 'Z') {
    const hours = Number(parts[4]), minutes = Number(parts[5]);
    if (hours > 14 || minutes > 59 || (hours === 14 && minutes !== 0))
      return null;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}
function digest(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}
function plain(value: string): string {
  return value.replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
    .replace(/&ldquo;/gi, '“').replace(/&rdquo;/gi, '”')
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
export function senateMediaContextProvenanceIssues(row: SenateMediaContextExport): string[] {
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
/**
 * A surname-only attribution cannot select between two concurrent senators
 * sharing that surname. Unknown peer term bounds count as possibly active;
 * this is a conservative attribution gate, not a claim of historical absence.
 */
function possibleOnDate(row: SenateMediaRosterYear, day: string): boolean {
  if (!validDay(row.activeFrom) || !validDay(row.activeThrough)) return true;
  return active(row, day);
}
function senatorSurname(name: string): string {
  return name.trim().split(/\s+/).at(-1)?.toLowerCase() ?? '';
}
function mediaRegexEscape(value: string): string {
  // Callback replacement avoids RegExp replacement-string $-substitutions.
  return value.replace(/[.*+?^()|[\]{}\\$]/g, char => '\\' + char);
}
function namedSenatorIssues(
  cue: string,
  member: SenateMediaRosterYear,
  roster: readonly SenateMediaRosterYear[],
  publicationDay: string | null,
): string[] {
  const last = senatorSurname(member.senatorName);
  if (!last) return ['speaker_not_explicitly_named_in_attribution'];
  const full = mediaRegexEscape(member.senatorName.trim().replace(/\s+/g,' '));
  const fullInCue = new RegExp('(?:^|[^\\w])' + full + '(?=$|[^\\w])','i').test(cue);
  const surnameOnlyCue = new RegExp('\\bsen(?:ator)?\\.?\\s+'
    + mediaRegexEscape(last) + '\\b','i').test(cue);
  if (!fullInCue && !surnameOnlyCue)
    return ['speaker_not_explicitly_named_in_attribution'];
  if (fullInCue || publicationDay === null) return [];
  const competingSenator=roster.some(other=>other.year===member.year
    && other.membershipId!==member.membershipId
    && senatorSurname(other.senatorName)===last
    && possibleOnDate(other,publicationDay));
  return competingSenator ? ['ambiguous_senator_surname_requires_full_named_cue'] : [];
}
/**
 * The original HTML itself must visibly label one FULL-NAME senator speaker
 * turn under the audio transcript heading. A host's answer, a journalist's
 * paraphrase, a senator merely named in page metadata, a surname-only cue
 * and a quote borrowed from the NEXT speaker all remain unverified.
 *
 * A transcript-text proof is NOT original MP3/audio proof. The archive's
 * authenticated capture remains the EARLIEST demonstrated public-by for
 * the precise page version; the current page's broadcast clock is not.
 */
function transcriptTurnIssues(
  review: SenateMediaReview,
  source: SenateMediaContextExport,
  member: SenateMediaRosterYear | undefined,
  passage: string,
  cue: string,
  quote: string,
  decodedArticle: string,
): string[] {
  const issues: string[] = [];
  const url = source.originalUrl ?? '';
  if (source.publisher !== 'MPR News' || source.seedId !== 'mpr-news-story-archive'
    || !/^https:\/\/www\.mprnews\.org\/(?:episode|story)\/20(?:21|22|23|24|25)\//.test(url))
    issues.push('speaker_transcript_requires_original_first_party_mpr_source');
  const section = decodedArticle.toLowerCase().indexOf('audio transcript');
  if (section < 0 || decodedArticle.indexOf(passage) < section)
    issues.push('speaker_transcript_section_not_in_original_article');
  if (!member) return issues;
  // No surname-only fallback for transcript speakers. Require exact member
  // full name followed by ':' instead of inferring from a nearby mention.
  const label = member.senatorName.trim().replace(/\s+/g, ' ').toUpperCase() + ':';
  if (cue.toUpperCase() !== label || !passage.toUpperCase().includes(label)) {
    issues.push('speaker_transcript_full_member_label_missing');
    return issues;
  }
  const start = passage.toUpperCase().indexOf(label) + label.length;
  const after = passage.slice(start);
  // Bound the attributed turn at the NEXT two-word all-caps speaker label.
  // Also match one-word labels and Unicode uppercase names (e.g. LÓPEZ)
  // with punctuation and suffixes. False negatives are safer than borrowing
  // someone else's words.
  const nextSpeaker = /(?:^|\s)[\p{Lu}][\p{Lu}\p{M}.'’,-]{1,30}(?:\s+[\p{Lu}][\p{Lu}\p{M}.'’,-]{1,30}){0,6}:(?=\s|$)/u.exec(after);
  const turn = nextSpeaker ? after.slice(0, nextSpeaker.index) : after;
  if (!quote || !turn.includes(quote))
    issues.push('speaker_transcript_quote_outside_named_senator_turn');
  return issues;
}

function quoteIssues(
  review: SenateMediaReview,
  source: SenateMediaContextExport,
  sourceProblems: string[],
  roster: readonly SenateMediaRosterYear[],
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
  // Publication date is the *publisher's calendar day* in its declared zone,
  // not UTC's potentially different day for the same instant.
  const publicationDay = pub === null ? null : review.publisherPublishedAt!.slice(0, 10);
  if (publicationDay !== null && member && !active(member, publicationDay))
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
    const quotePresentation = review.quotePresentation ?? 'reported_quotation';
    if (quotePresentation === 'speaker_labeled_transcript') {
      issues.push(...transcriptTurnIssues(review,source,member,passage,cue,quote,decoded));
    } else if (quotePresentation === 'reported_quotation') {
      // A reporter's paraphrase is not a verbatim senator quotation.
      const quotedSpans = [...passage.matchAll(/["“]([^"”]+)["”]/g)];
      if (!quote || !quotedSpans.some(match => plain(match[1]).includes(quote)))
        issues.push('claimed_quote_not_delimited_as_direct_speech');
    } else {
      issues.push('unsupported_direct_quote_presentation');
    }
    // Named-source presence is necessary but not sufficient for semantic
    // attribution. Same-surname peers require a full, unambiguous name cue.
    if (member) issues.push(...namedSenatorIssues(cue,member,roster,publicationDay));
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
  const sourceProblems = new Map<string,Set<string>>();
  let outsideScope = 0;
  const allContexts: SenateMediaContextExport[] = [];
  const immutableSourceIdentity=(row:SenateMediaContextExport)=>JSON.stringify([
    row.sourceKind,row.sourceUrl,row.sourceSha256,row.seedId,row.publisher,
    row.originalUrl,row.archiveUrl,row.archiveCapturedAt,row.archiveDigest,
    row.publisherPublishedAt,
  ]);
  for (const row of contexts) {
    if (!row?.evidenceId || !row.sourceDocumentId || seenEvidence.has(row.evidenceId))
      throw Error('Missing or duplicate media context evidence identity');
    seenEvidence.add(row.evidenceId);
    const year = Number(row.archiveCapturedAt?.slice(0, 4));
    if (!YEARS.includes(year as typeof YEARS[number])) { outsideScope++; continue; }
    const previous = byDocument.get(row.sourceDocumentId);
    if (previous && immutableSourceIdentity(previous) !== immutableSourceIdentity(row))
      throw Error('Conflicting source identities in media context export');
    // A repeated context may carry a different neutral-state verdict:
    // never let input row order silently erase a provenance failure and
    // approve a quote based on only the last row's metadata.
    const issues=sourceProblems.get(row.sourceDocumentId) ?? new Set<string>();
    for(const issue of senateMediaContextProvenanceIssues(row))issues.add(issue);
    sourceProblems.set(row.sourceDocumentId,issues);
    if (!previous) byDocument.set(row.sourceDocumentId,row);
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
  for (const id of byDocument.keys())
    invalidSources.set(id,[...(sourceProblems.get(id) ?? [])]);
  const classified: Array<{
    sourceDocumentId: string; membershipId: string | null; senatorName: string | null;
    issueCategory: string | null; disposition: SenateMediaReviewDisposition;
    quotePresentation: SenateMediaQuotePresentation;
    archivedAudioIndependentlyAuthenticated: false;
    verified: boolean; failures: string[]; publisher: string | null;
    originalUrl: string | null; archiveUrl: string | null;
    sourceSha256: string; publishedAt: string | null; provenPublicBy: string | null;
    exactQuote: string | null; attributablePassage: string | null;
  }> = [];
  const reviewKeys = new Set<string>();
  const dispositionsBySource=new Map<string,Set<SenateMediaReviewDisposition>>();
  for (const review of reviews) {
    const row = byDocument.get(review.sourceDocumentId);
    if (!row) throw Error('Media review references unknown or out-of-scope source');
    if (!(['exact_named_quote', 'contextual_mention', 'speaker_ambiguous', 'source_unavailable'] as unknown[])
      .includes(review.disposition) || !review.reviewedBy?.trim()
      || instant(review.reviewedAt) === null) {
      throw Error('Invalid disposition or missing human media review identity/time');
    }
    const priorDispositions=dispositionsBySource.get(review.sourceDocumentId)
      ?? new Set<SenateMediaReviewDisposition>();
    if ((review.disposition==='source_unavailable' && priorDispositions.has('exact_named_quote'))
      || (review.disposition==='exact_named_quote' && priorDispositions.has('source_unavailable'))) {
      throw Error('Contradictory media source-unavailable and named-quote reviews');
    }
    priorDispositions.add(review.disposition);
    dispositionsBySource.set(review.sourceDocumentId,priorDispositions);
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
      quotePresentation: review.quotePresentation ?? 'reported_quotation',
      /** Explicitly NOT proof of original audio bytes or original broadcast time. */
      archivedAudioIndependentlyAuthenticated: false as const,
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
