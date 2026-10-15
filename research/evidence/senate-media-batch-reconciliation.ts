/**
 * #912: reconcile multiple privately obtained, source-hash-checked media
 * Wayback batches. All arithmetic is WITHIN the bounded exported corpus.
 * No database/network/CI, no automatically inferred quotation or stance.
 */
import { createHash } from 'node:crypto';
import { LOCAL_TRADE_NEWS_SEEDS } from '../../src/evidence/local-trade-news-history.ts';
import {
  auditSenateMediaRemarks,
  type SenateMediaContextExport,
  type SenateMediaRosterYear,
  type SenateMediaSourceSnapshot,
} from './senate-media-remarks-audit.ts';
import {
  SENATE_MEDIA_MAX_ORIGINAL_BYTES,
  SENATE_MEDIA_REHYDRATION_VERSION,
  planSenateMediaRehydration,
  type MediaArchiveFetchResult,
  type MediaArchiveFetchStatus,
  type SenateMediaSnapshotCandidate,
} from './senate-media-archive-rehydration.ts';

export const MEDIA_BATCH_RECONCILIATION_VERSION =
  'senate-media-private-batch-reconciliation-v1' as const;
const YEARS = [2021,2022,2023,2024,2025] as const;
const SHA = /^[a-f0-9]{64}$/;
const VALID_STATUSES: readonly MediaArchiveFetchStatus[] = [
  'verified_original_bytes','untrusted_archive_location','redirect_refused',
  'http_not_200','non_article_content_type','body_size_limit',
  'empty_or_short_body','original_bytes_hash_mismatch','fetch_failed',
];

export interface PrivateMediaBatchManifest {
  version: typeof SENATE_MEDIA_REHYDRATION_VERSION;
  selection: {
    requestedYear: number | null;
    offset: number;
    limit: number;
    eligibleDocuments: number;
    studyYearContexts: number;
    excludedOutside2021To2025: number;
    rejectedInvalidProvenance: number;
    rejectionReasons: Record<string,number>;
    nextOffset: number | null;
  };
  attempted: number;
  verifiedSourceBodies: number;
  statuses: Record<string,number>;
  files: Record<string,{ bytes:number; sha256:string; rows?:number }>;
}

export interface SenateMediaPrivateBatch {
  manifest: PrivateMediaBatchManifest;
  attempts: Array<Omit<MediaArchiveFetchResult,'snapshot'>>;
  snapshots: SenateMediaSourceSnapshot[];
}

export interface SenateMediaPrivateCoverageGroup {
  year: number;
  publisher: string;
  seedId: string;
  eligibleDistinctArchivedArticles: number;
  retrievalAttempted: number;
  exactOriginalHashMatched: number;
  originalHashMismatched: number;
  retrievalUnavailableOrRejected: number;
  notAttempted: number;
  /** Not a published-articles or statewide coverage denominator. */
  coverageScope: 'eligible_sources_in_selected_private_export_only';
  missingness: 'not_observed_in_export_not_no_published_articles'
    | 'sampled_archive_not_full_publisher_article_universe';
}

export interface SenateMediaBatchSummary {
  version: typeof MEDIA_BATCH_RECONCILIATION_VERSION;
  studyYears: number[];
  suppliedContextRows: number;
  eligibleDistinctArchivedArticles: number;
  studyYearDistinctSourceRows: number;
  outsideStudyYearContextRows: number;
  invalidProvenanceStudyYearDistinctSources: number;
  attemptedDistinctSources: number;
  exactOriginalHashMatched: number;
  originalHashMismatched: number;
  attemptedButUnavailableOrRejected: number;
  notAttempted: number;
  retrievalAttemptsCompleteForEligibleExport: boolean;
  batchCount: number;
  byCaptureYear: Array<{
    year:number; eligible:number; attempted:number; hashMatched:number;
    hashMismatched:number; unavailableOrRejected:number; notAttempted:number;
  }>;
  byPublisherCaptureYear: SenateMediaPrivateCoverageGroup[];
  statusCounts: Record<string,number>;
  auditVerifiedQuotePassages: 0;
  quotesHumanReviewed: false;
  statewideMediaArticleDenominatorKnown: false;
  retrospectiveSourceCompletenessProven: false;
  productionDatabaseReadOrWritten: false;
}

/** Canonical base64 and source fingerprint both required before accepting bytes. */
function authenticatedSnapshot(
  input: SenateMediaSourceSnapshot,
  expected: SenateMediaSnapshotCandidate,
): { sourceDocumentId:string; rawBodyBase64:string; size:number } {
  if (!input || input.sourceDocumentId !== expected.sourceDocumentId
    || typeof input.rawBodyBase64 !== 'string'
    || input.rawBodyBase64.length < 4
    || input.rawBodyBase64.length > 4_000_000
    || !/^[A-Za-z0-9+/]+={0,2}$/.test(input.rawBodyBase64)) {
    throw Error('Invalid or mismatched private original-source snapshot encoding');
  }
  const bytes=Buffer.from(input.rawBodyBase64,'base64');
  if (bytes.toString('base64') !== input.rawBodyBase64
    || bytes.byteLength < 40 || bytes.byteLength > SENATE_MEDIA_MAX_ORIGINAL_BYTES
    || createHash('sha256').update(bytes).digest('hex') !== expected.sourceSha256) {
    throw Error('Original source snapshot bytes do not authenticate to export fingerprint');
  }
  return {sourceDocumentId:input.sourceDocumentId, rawBodyBase64:input.rawBodyBase64,size:bytes.byteLength};
}

function assertSameNumbers(
  label: string,
  received: Record<string,number>,
  expected: Record<string,number>,
): void {
  const allKeys=new Set([...Object.keys(received),...Object.keys(expected)]);
  for (const key of allKeys)
    if (received[key] !== expected[key])
      throw Error('Private media batch '+label+' does not match authenticated attempts');
}

function consistentInstant(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return false;
  const num=Date.parse(value);
  return Number.isFinite(num) && new Date(num).toISOString() === value;
}

export function reconcileSenateMediaPrivateBatches(input: {
  contexts: readonly SenateMediaContextExport[];
  roster: readonly SenateMediaRosterYear[];
  batches: readonly SenateMediaPrivateBatch[];
}): { summary: SenateMediaBatchSummary; authenticatedSnapshots: SenateMediaSourceSnapshot[] } {
  const {contexts,roster,batches}=input;
  if (batches.length > 1000) throw Error('Too many private media batches');
  // Validate ALL context and roster identities even for zero supplied batches.
  const emptyAudit=auditSenateMediaRemarks({contexts,roster});
  const base=planSenateMediaRehydration(contexts,{limit:12});
  const eligible: SenateMediaSnapshotCandidate[]=[];
  for(let offset=0; offset<base.eligibleDocuments; offset+=12) {
    const page=planSenateMediaRehydration(contexts,{offset,limit:12});
    eligible.push(...page.selected);
  }
  if (eligible.length !== base.eligibleDocuments)
    throw Error('Source rehydration plan is internally inconsistent');
  const bySource=new Map(eligible.map(x=>[x.sourceDocumentId,x]));
  if (bySource.size !== eligible.length) throw Error('Conflicting eligible source identity');
  const actual=new Map<string, Omit<MediaArchiveFetchResult,'snapshot'>>();
  const snapshots=new Map<string,SenateMediaSourceSnapshot>();
  for (const batch of batches) {
    const m=batch?.manifest;
    if (!m || m.version !== SENATE_MEDIA_REHYDRATION_VERSION || !m.selection
      || !Array.isArray(batch.attempts) || !Array.isArray(batch.snapshots))
      throw Error('Invalid or unknown private media rehydration batch schema');
    const year=m.selection.requestedYear ?? undefined;
    const page=planSenateMediaRehydration(contexts,{
      ...(year===undefined?{}:{year}),
      offset:m.selection.offset,limit:m.selection.limit,
    });
    if (!page.selected.length)
      throw Error('Empty or out-of-range private media batch cannot establish a recovery attempt');
    const expectedReasons=page.rejectionReasons;
    if (m.selection.eligibleDocuments !== page.eligibleDocuments
      || m.selection.studyYearContexts !== page.studyYearContexts
      || m.selection.excludedOutside2021To2025 !== page.excludedOutside2021To2025
      || m.selection.rejectedInvalidProvenance !== page.rejectedInStudy
      || m.selection.nextOffset !== page.nextOffset
      || m.attempted !== page.selected.length
      || batch.attempts.length !== page.selected.length) {
      throw Error('Private media batch metadata or source pagination disagrees with export');
    }
    assertSameNumbers('provenance rejects',m.selection.rejectionReasons,expectedReasons);
    const observedStatuses: Record<string,number>={};
    let matched=0;
    for(let i=0;i<page.selected.length;i++) {
      const expected=page.selected[i]!;
      const row=batch.attempts[i];
      if (!row || row.sourceDocumentId !== expected.sourceDocumentId
        || row.archiveCapturedAt !== expected.archiveCapturedAt
        || row.publisher !== expected.publisher
        || !consistentInstant(row.fetchedAt)
        || !VALID_STATUSES.includes(row.status)
        || Object.hasOwn(row,'snapshot')) {
        throw Error('Private media attempt row does not match requested original archive');
      }
      if(actual.has(row.sourceDocumentId))
        throw Error('Overlapping private media batches attempt the same source twice');
      actual.set(row.sourceDocumentId,row);
      observedStatuses[row.status]=(observedStatuses[row.status]??0)+1;
      const hasDigest=typeof row.observedSha256 === 'string' && SHA.test(row.observedSha256);
      if (row.status==='verified_original_bytes') {
        if (!hasDigest || row.observedSha256 !== expected.sourceSha256
          || !Number.isSafeInteger(row.bytes) || row.bytes! < 40
          || row.bytes! > SENATE_MEDIA_MAX_ORIGINAL_BYTES) {
          throw Error('Reported original hash match lacks exact source byte proof');
        }
        matched++;
      } else if (row.status==='original_bytes_hash_mismatch') {
        if (!hasDigest || row.observedSha256 === expected.sourceSha256
          || !Number.isSafeInteger(row.bytes) || row.bytes! < 40
          || row.bytes! > SENATE_MEDIA_MAX_ORIGINAL_BYTES)
          throw Error('Original-byte hash mismatch status is inconsistent with observed digest');
      } else if (row.bytes !== null || row.observedSha256 !== null) {
        throw Error('Non-response media retrieval status cannot claim a source digest');
      }
    }
    assertSameNumbers('retrieval statuses',m.statuses,observedStatuses);
    if(m.verifiedSourceBodies !== matched || batch.snapshots.length !== matched)
      throw Error('Private media batch original-byte match count disagrees with snapshots');
    const snapSeen=new Set<string>();
    for(const raw of batch.snapshots){
      if(snapSeen.has(raw.sourceDocumentId))throw Error('Duplicate source snapshot within batch');
      snapSeen.add(raw.sourceDocumentId);
      const expected=bySource.get(raw.sourceDocumentId);
      const row=actual.get(raw.sourceDocumentId);
      if(!expected || !row || row.status!=='verified_original_bytes')
        throw Error('Source snapshot lacks corresponding exact-hash verified attempt');
      const inspected=authenticatedSnapshot(raw,expected);
      if(inspected.size !== row.bytes)
        throw Error('Snapshot original byte length differs from fetch receipt');
      if(snapshots.has(raw.sourceDocumentId))throw Error('Duplicate source snapshot across batches');
      snapshots.set(raw.sourceDocumentId,raw);
    }
    // A success without its original raw bytes is NOT treated as a success.
    for (const row of batch.attempts) {
      if (row.status==='verified_original_bytes' && !snapSeen.has(row.sourceDocumentId))
        throw Error('Source receipt claims a match without authenticated original bytes');
    }
  }
  const statuses:Record<string,number>={};
  let mismatched=0, unavailable=0;
  for(const row of actual.values()){
    statuses[row.status]=(statuses[row.status]??0)+1;
    if(row.status==='original_bytes_hash_mismatch')mismatched++;
    else if(row.status!=='verified_original_bytes')unavailable++;
  }
  // The denominator is the *bounded source export*, never publisher output.
  // Explicit zero rows for all 44 seeds/year pairs prevent silently treating
  // an unobserved source as having published zero relevant articles.
  const publisherGroups=new Map<string,SenateMediaPrivateCoverageGroup>();
  for (const year of YEARS) for (const seed of LOCAL_TRADE_NEWS_SEEDS) {
    publisherGroups.set(year+'|'+seed.id,{
      year,publisher:seed.publisher,seedId:seed.id,
      eligibleDistinctArchivedArticles:0,retrievalAttempted:0,
      exactOriginalHashMatched:0,originalHashMismatched:0,
      retrievalUnavailableOrRejected:0,notAttempted:0,
      coverageScope:'eligible_sources_in_selected_private_export_only',
      missingness:'not_observed_in_export_not_no_published_articles',
    });
  }
  const yearGroups=YEARS.map(year=>({
    year,eligible:0,attempted:0,hashMatched:0,hashMismatched:0,
    unavailableOrRejected:0,notAttempted:0,
  }));
  for (const row of eligible) {
    const key=row.captureYear+'|'+row.seedId;
    let group=publisherGroups.get(key);
    if(!group){
      group={
        year:row.captureYear,publisher:row.publisher,seedId:row.seedId,
        eligibleDistinctArchivedArticles:0,retrievalAttempted:0,
        exactOriginalHashMatched:0,originalHashMismatched:0,
        retrievalUnavailableOrRejected:0,notAttempted:0,
        coverageScope:'eligible_sources_in_selected_private_export_only',
        missingness:'sampled_archive_not_full_publisher_article_universe',
      };
      publisherGroups.set(key,group);
    }
    const yr=yearGroups.find(x=>x.year===row.captureYear)!;
    group.eligibleDistinctArchivedArticles++;
    group.missingness='sampled_archive_not_full_publisher_article_universe';
    yr.eligible++;
    const attempt=actual.get(row.sourceDocumentId);
    if(!attempt){
      group.notAttempted++;
      yr.notAttempted++;
    } else {
      group.retrievalAttempted++;
      yr.attempted++;
      if(attempt.status==='verified_original_bytes'){
        group.exactOriginalHashMatched++;
        yr.hashMatched++;
      } else if(attempt.status==='original_bytes_hash_mismatch'){
        group.originalHashMismatched++;
        yr.hashMismatched++;
      } else {
        group.retrievalUnavailableOrRejected++;
        yr.unavailableOrRejected++;
      }
    }
  }
  const auditWithSources=auditSenateMediaRemarks({
    contexts,roster,snapshots:[...snapshots.values()],
  });
  if (auditWithSources.verifiedAttributedQuotePassages!==0)
    throw Error('Non-human media source recovery cannot verify any attributed quotations');
  const result: SenateMediaBatchSummary={
    version:MEDIA_BATCH_RECONCILIATION_VERSION,
    studyYears:[...YEARS],
    suppliedContextRows:contexts.length,
    eligibleDistinctArchivedArticles:eligible.length,
    studyYearDistinctSourceRows:emptyAudit.distinctArchivedArticlesInExport,
    outsideStudyYearContextRows:emptyAudit.corpusContextItemsOutsideStudyYears,
    invalidProvenanceStudyYearDistinctSources:base.rejectedInStudy,
    attemptedDistinctSources:actual.size,
    exactOriginalHashMatched:snapshots.size,
    originalHashMismatched:mismatched,
    attemptedButUnavailableOrRejected:unavailable,
    notAttempted:eligible.length-actual.size,
    retrievalAttemptsCompleteForEligibleExport:eligible.length>0 && actual.size===eligible.length,
    batchCount:batches.length,
    byCaptureYear:yearGroups,
    byPublisherCaptureYear:[...publisherGroups.values()]
      .sort((a,b)=>a.year-b.year || a.publisher.localeCompare(b.publisher)
        || a.seedId.localeCompare(b.seedId)),
    statusCounts:statuses,
    auditVerifiedQuotePassages:0,quotesHumanReviewed:false,
    statewideMediaArticleDenominatorKnown:false,
    retrospectiveSourceCompletenessProven:false,
    productionDatabaseReadOrWritten:false,
  };
  return {
    summary:result,
    authenticatedSnapshots:[...snapshots.values()]
      .sort((a,b)=>a.sourceDocumentId.localeCompare(b.sourceDocumentId)),
  };
}
