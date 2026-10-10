/**
 * #912 Track D: source-byte rehydration for the bounded historical media corpus.
 *
 * Operator-controlled, offline planning + independently bounded public Wayback
 * GETs. The hash of the original HTTP body must equal source_documents SHA256.
 * A re-fetched page, matching URL, quoted name or text alone proves NOTHING.
 * No DB connections, writes, automatically inferred speakers or model effects.
 */
import { createHash } from 'node:crypto';
import {
  senateMediaContextProvenanceIssues,
  type SenateMediaContextExport,
  type SenateMediaSourceSnapshot,
} from './senate-media-remarks-audit.js';

export const SENATE_MEDIA_REHYDRATION_VERSION = 'senate-media-wayback-exact-bytes-v1' as const;
export const SENATE_MEDIA_MAX_ORIGINAL_BYTES = 2_500_000;
const SHA = /^[0-9a-f]{64}$/;
const YEARS = new Set([2021, 2022, 2023, 2024, 2025]);

export interface SenateMediaSnapshotCandidate {
  sourceDocumentId: string;
  archiveUrl: string;
  sourceSha256: string;
  archiveCapturedAt: string;
  originalUrl: string;
  publisher: string;
  seedId: string;
  mentionedMembers: string[];
  captureYear: number;
}

export type MediaArchiveFetchStatus =
  | 'verified_original_bytes'
  | 'untrusted_archive_location'
  | 'redirect_refused'
  | 'http_not_200'
  | 'non_article_content_type'
  | 'body_size_limit'
  | 'empty_or_short_body'
  | 'original_bytes_hash_mismatch'
  | 'fetch_failed';

export interface MediaArchiveFetchResult {
  sourceDocumentId: string;
  status: MediaArchiveFetchStatus;
  archiveCapturedAt: string;
  publisher: string;
  fetchedAt: string;
  bytes: number | null;
  observedSha256: string | null;
  /** Exists ONLY when fetched content equals original recorded SHA256. */
  snapshot?: SenateMediaSourceSnapshot;
}

function validExactArchiveLocation(row: SenateMediaContextExport): boolean {
  const archive = row.archiveUrl;
  const original = row.originalUrl;
  if (!archive || !original || !row.archiveCapturedAt) return false;
  if (!archive.startsWith('https://web.archive.org/web/')) return false;
  try {
    const outer = new URL(archive);
    const inner = new URL(original);
    if (outer.protocol !== 'https:' || outer.hostname !== 'web.archive.org'
      || outer.host !== 'web.archive.org' || outer.username || outer.password
      || outer.hash || outer.toString() !== archive
      || !['http:', 'https:'].includes(inner.protocol)
      || inner.username || inner.password || inner.hash) return false;
    const match = archive.match(/^https:\/\/web\.archive\.org\/web\/(\d{14})id_\/(https?:\/\/.+)$/);
    if (!match || match[2] !== original || match[1]!.length !== 14) return false;
    const ts = match[1]!;
    const asIso = ts.slice(0, 4) + '-' + ts.slice(4, 6) + '-' + ts.slice(6, 8)
      + 'T' + ts.slice(8, 10) + ':' + ts.slice(10, 12) + ':' + ts.slice(12, 14) + 'Z';
    const parsed = Date.parse(asIso);
    return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 19) === asIso.slice(0, 19)
      && Date.parse(row.archiveCapturedAt) === parsed && row.sourceUrl === archive;
  } catch { return false; }
}

export interface SenateMediaRehydrationPlan {
  eligibleDocuments: number;
  studyYearContexts: number;
  excludedOutside2021To2025: number;
  rejectedInStudy: number;
  rejectionReasons: Record<string, number>;
  selected: SenateMediaSnapshotCandidate[];
  nextOffset: number | null;
  safeToDeclareHistoricalCompleteness: false;
}

export function planSenateMediaRehydration(
  contexts: readonly SenateMediaContextExport[],
  options: { year?: number; offset?: number; limit?: number } = {},
): SenateMediaRehydrationPlan {
  const year = options.year;
  const offset = options.offset ?? 0;
  const limit = options.limit ?? 6;
  if (year !== undefined && !YEARS.has(year)) throw Error('Year must be within 2021–2025');
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 20000)
    throw Error('Private archive source offset must be between 0 and 20000');
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 12)
    throw Error('Private archive batch size must be between 1 and 12');
  if (contexts.length > 20000) throw Error('Private media context exceeds rehydration row cap');
  const seenEvidence = new Set<string>();
  const seenSources = new Map<string, string>();
  const candidates: SenateMediaSnapshotCandidate[] = [];
  const reasons: Record<string, number> = {};
  let excludedOutside2021To2025 = 0;
  let studyYearContexts = 0;
  let rejectedInStudy = 0;
  for (const row of contexts) {
    if (!row || !row.evidenceId || !row.sourceDocumentId
      || seenEvidence.has(row.evidenceId)) throw Error('Duplicate or missing context evidence id');
    seenEvidence.add(row.evidenceId);
    const identity = JSON.stringify([row.archiveUrl, row.sourceSha256, row.seedId, row.originalUrl]);
    const previous = seenSources.get(row.sourceDocumentId);
    if (previous !== undefined) {
      if (previous !== identity) throw Error('Conflicting original archived source identity');
      continue;
    }
    seenSources.set(row.sourceDocumentId, identity);
    const captureYear = Number(row.archiveCapturedAt?.slice(0, 4));
    if (!YEARS.has(captureYear)) { excludedOutside2021To2025++; continue; }
    studyYearContexts++;
    const problems = senateMediaContextProvenanceIssues(row);
    if (!validExactArchiveLocation(row)) problems.push('unsafe_or_noncanonical_original_archive_url');
    if (!SHA.test(row.sourceSha256)) problems.push('missing_valid_original_sha256');
    if (!row.seedId || !row.publisher || !row.originalUrl || !row.archiveUrl
      || !row.archiveCapturedAt) problems.push('incomplete_article_identity');
    if (problems.length) {
      rejectedInStudy++;
      for (const problem of new Set(problems)) reasons[problem] = (reasons[problem] ?? 0) + 1;
      continue;
    }
    candidates.push({
      sourceDocumentId: row.sourceDocumentId, archiveUrl: row.archiveUrl!,
      sourceSha256: row.sourceSha256, archiveCapturedAt: row.archiveCapturedAt!,
      originalUrl: row.originalUrl!, publisher: row.publisher!,
      seedId: row.seedId!, mentionedMembers: [...row.mentionedMembers],
      captureYear,
    });
  }
  const filtered = candidates.filter(item => year === undefined || item.captureYear === year);
  filtered.sort((a,b) => a.archiveCapturedAt.localeCompare(b.archiveCapturedAt)
    || a.seedId.localeCompare(b.seedId)
    || a.sourceDocumentId.localeCompare(b.sourceDocumentId));
  const selected = filtered.slice(offset, offset + limit);
  return {
    eligibleDocuments: filtered.length, studyYearContexts,
    excludedOutside2021To2025, rejectedInStudy,
    rejectionReasons: reasons, selected,
    nextOffset: offset + limit < filtered.length ? offset + limit : null,
    safeToDeclareHistoricalCompleteness: false,
  };
}

function outcome(
  candidate: SenateMediaSnapshotCandidate,
  status: MediaArchiveFetchStatus,
  fetchedAt: string,
  bytes: number | null = null,
  observedSha256: string | null = null,
  snapshot?: SenateMediaSourceSnapshot,
): MediaArchiveFetchResult {
  return {
    sourceDocumentId: candidate.sourceDocumentId,
    archiveCapturedAt: candidate.archiveCapturedAt,
    publisher: candidate.publisher,
    status, fetchedAt, bytes, observedSha256,
    ...(snapshot ? { snapshot } : {}),
  };
}

async function boundedBytes(response: Response): Promise<Uint8Array> {
  const header = response.headers.get('content-length');
  if (header !== null && (/^\d+$/.test(header) === false
      || Number(header) > SENATE_MEDIA_MAX_ORIGINAL_BYTES)) {
    throw Error('body_size_limit');
  }
  if (!response.body) throw Error('empty_or_short_body');
  const chunks: Uint8Array[] = [];
  const reader = response.body.getReader();
  let size = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    size += next.value.byteLength;
    if (size > SENATE_MEDIA_MAX_ORIGINAL_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw Error('body_size_limit');
    }
    chunks.push(next.value);
  }
  if (size < 40) throw Error('empty_or_short_body');
  const bytes = new Uint8Array(size);
  let position = 0;
  for (const chunk of chunks) { bytes.set(chunk, position); position += chunk.byteLength; }
  return bytes;
}

/**
 * Never follow redirects or fall back to a different Wayback capture, original
 * live publisher URL, proxy or canonicalized article. Exact bytes only.
 */
export async function fetchSenateMediaOriginalBytes(
  candidate: SenateMediaSnapshotCandidate,
  fetchImpl: typeof fetch = fetch,
): Promise<MediaArchiveFetchResult> {
  const fetchedAt = new Date().toISOString();
  const loc = {
    sourceDocumentId: candidate.sourceDocumentId,
    evidenceId: 'source-authentication-only',
    sourceUrl: candidate.archiveUrl,
    sourceKind: 'wayback_local_trade_news',
    archiveUrl: candidate.archiveUrl,
    originalUrl: candidate.originalUrl,
    archiveCapturedAt: candidate.archiveCapturedAt,
  } as SenateMediaContextExport;
  if (!validExactArchiveLocation(loc) || !SHA.test(candidate.sourceSha256)
    || !YEARS.has(candidate.captureYear)
    || candidate.captureYear !== Number(candidate.archiveCapturedAt.slice(0, 4))) {
    return outcome(candidate, 'untrusted_archive_location', fetchedAt);
  }
  try {
    const response = await fetchImpl(candidate.archiveUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        accept: 'text/html,text/plain,application/xhtml+xml',
        'user-agent': 'VotePredict/2.0 private-historical-source-reconciliation',
      },
      signal: AbortSignal.timeout(20_000),
    });
    if ([301,302,303,307,308].includes(response.status))
      return outcome(candidate, 'redirect_refused', fetchedAt);
    if (response.status !== 200) return outcome(candidate, 'http_not_200', fetchedAt);
    const type = (response.headers.get('content-type') ?? '').split(';',1)[0]!.trim().toLowerCase();
    if (!['text/html','text/plain','application/xhtml+xml'].includes(type))
      return outcome(candidate, 'non_article_content_type', fetchedAt);
    const body = await boundedBytes(response);
    const observedSha256 = createHash('sha256').update(body).digest('hex');
    if (observedSha256 !== candidate.sourceSha256)
      return outcome(candidate, 'original_bytes_hash_mismatch', fetchedAt, body.byteLength, observedSha256);
    return outcome(candidate, 'verified_original_bytes', fetchedAt, body.byteLength, observedSha256,
      { sourceDocumentId: candidate.sourceDocumentId, rawBodyBase64: Buffer.from(body).toString('base64') });
  } catch (error) {
    const status = error instanceof Error && error.message === 'body_size_limit'
      ? 'body_size_limit'
      : error instanceof Error && error.message === 'empty_or_short_body'
        ? 'empty_or_short_body' : 'fetch_failed';
    return outcome(candidate, status, fetchedAt);
  }
}
