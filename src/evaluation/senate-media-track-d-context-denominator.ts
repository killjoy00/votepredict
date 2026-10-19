/**
 * #946 / #987: independently measure the actual bounded local media context
 * denominator BEFORE interpreting a set of zero public-original matches.
 * All SQL projections are counts only, never private sources, names or rows.
 */
import type {PublicOriginalPin,AggregatedSourceRow} from
 './senate-media-track-d-scoped-coverage.js';
import {summarizeTrackDProtectedAggregate} from
 './senate-media-track-d-scoped-coverage.js';

export const TRACK_D_DENOMINATOR_MARKER=
 'TRACK_D_946_987_READONLY_CONTEXT_DENOMINATOR_V2_20261018';
export type TrackDContextDenominator={
 context_rows:number;source_documents:number;
 rows_with_original_url:number;rows_with_archive_url:number;
 rows_with_archive_utc:number;rows_with_archive_digest:number;
 rows_with_body_sha256:number;
 reformer_source_documents:number;mpr_source_documents:number;
 reformer_brief_url_rows:number;mpr_episode_url_rows:number;
};
// A single static one-row query, all metadata stays inside protected Neon.
export const TRACK_D_CONTEXT_DENOMINATOR_SQL=[
 'SELECT count(ei.id)::int AS context_rows,',
 'count(DISTINCT sd.id)::int AS source_documents,',
 "count(ei.id) FILTER (WHERE nullif(ei.metadata->>'originalUrl','') IS NOT NULL)::int AS rows_with_original_url,",
 "count(ei.id) FILTER (WHERE nullif(ei.metadata->>'archiveUrl','') IS NOT NULL)::int AS rows_with_archive_url,",
 "count(ei.id) FILTER (WHERE nullif(ei.metadata->>'archiveCapturedAt','') IS NOT NULL)::int AS rows_with_archive_utc,",
 "count(ei.id) FILTER (WHERE nullif(ei.metadata->>'archiveDigest','') IS NOT NULL)::int AS rows_with_archive_digest,",
 "count(DISTINCT sd.id) FILTER (WHERE sd.content_sha256 ~ '^[a-f0-9]{64}$')::int AS rows_with_body_sha256,",
 "count(DISTINCT sd.id) FILTER (WHERE ei.metadata->>'publisher'='Minnesota Reformer')::int AS reformer_source_documents,",
 "count(DISTINCT sd.id) FILTER (WHERE ei.metadata->>'publisher'='MPR News')::int AS mpr_source_documents,",
 "count(ei.id) FILTER (WHERE ei.metadata->>'originalUrl' LIKE 'https://minnesotareformer.com/briefs/%')::int AS reformer_brief_url_rows,",
 "count(ei.id) FILTER (WHERE ei.metadata->>'originalUrl' LIKE 'https://www.mprnews.org/episode/%')::int AS mpr_episode_url_rows",
 'FROM evidence_items ei JOIN source_documents sd ON sd.id=ei.source_document_id',
 "WHERE sd.source_kind='wayback_local_trade_news'",
 "AND ei.metadata->>'contextType'='local_trade_news' LIMIT 1",
].join(' ');
export function assertTrackDDenominatorSQL():true{
 if(!TRACK_D_CONTEXT_DENOMINATOR_SQL.startsWith('SELECT ')||
  !TRACK_D_CONTEXT_DENOMINATOR_SQL.endsWith(' LIMIT 1')||
  /;|--|\/\*|\*\/|\b(?:UPDATE|DELETE|INSERT|ALTER|DROP|CREATE|TRUNCATE|COPY|EXECUTE|CALL|GRANT|REVOKE|pg_sleep|dblink)\b/i.test(TRACK_D_CONTEXT_DENOMINATOR_SQL)||
  /(?:sd|ei)\.\*/.test(TRACK_D_CONTEXT_DENOMINATOR_SQL)||
  /\$\d/.test(TRACK_D_CONTEXT_DENOMINATOR_SQL))
  throw Error('Unsafe denominator SQL or nonaggregate source disclosure');
 return true;
}
export function classifyTrackDScopedCoverageDenominator(
 scope:TrackDContextDenominator,publicPins:readonly PublicOriginalPin[],
 crosswalkRows:readonly AggregatedSourceRow[],
){
 assertTrackDDenominatorSQL();
 const keys=[
  'context_rows','source_documents','rows_with_original_url','rows_with_archive_url',
  'rows_with_archive_utc','rows_with_archive_digest','rows_with_body_sha256',
  'reformer_source_documents','mpr_source_documents',
  'reformer_brief_url_rows','mpr_episode_url_rows',
 ] as const;
 if(!scope||keys.some(k=>!Number.isSafeInteger(scope[k])||
  scope[k]<0||scope[k]>1000000)||
  scope.source_documents>scope.context_rows||
  scope.rows_with_original_url>scope.context_rows||
  scope.rows_with_archive_url>scope.context_rows||
  scope.rows_with_archive_utc>scope.context_rows||
  scope.rows_with_archive_digest>scope.context_rows||
  scope.rows_with_body_sha256>scope.source_documents||
  scope.reformer_source_documents>scope.source_documents||
  scope.mpr_source_documents>scope.source_documents||
  scope.reformer_brief_url_rows>scope.context_rows||
  scope.mpr_episode_url_rows>scope.context_rows)
  throw Error('Unexpected stored media metadata denominator counters');
 const old=summarizeTrackDProtectedAggregate(publicPins,crosswalkRows);
 const nonempty=scope.context_rows>0&&scope.source_documents>0;
 const hasUrl=scope.rows_with_original_url>0;
 const hasHashes=scope.rows_with_body_sha256>0;
 const publishers=(old.issues as typeof old.issues).map(issue=>{
  const docs=issue.issue===946?scope.reformer_source_documents:scope.mpr_source_documents;
  const inScope=issue.issue===946?scope.reformer_brief_url_rows:scope.mpr_episode_url_rows;
  const coverageBasis=(!nonempty?'empty_filtered_context':
   !hasUrl||!hasHashes?'insufficient_metadata_for_source_identity':
   docs===0?'no_publisher_records_in_filtered_context':
   'nonempty_publisher_context_with_url_and_source_digest_columns') as string;
  return {
   issue:issue.issue,
   publicOriginalVersionsAudited:issue.publicArchiveVersionsAudited,
   publicPublisherUrlsAudited:issue.distinctPublicPublisherUrls,
   exactVersionMatches:issue.exactArchivedVersionsObservedWithinBoundedContext,
   differentStoredOriginalVersionMatches:issue.sameUrlOtherVersionsOrMetadata,
   sourceIdentifierConflicts:issue.conflictingStoredArchiveIdentifiers,
   notObservedInExactFilteredContext:issue.notObservedInBoundedContext,
   publisherSourceDocumentsInContext:docs,
   samePathFamilyEvidenceRowsInContext:inScope,
   coverageBasis,
   claimMissingArticlesInAllSources:false,
   claimsOfVerifiedLegislatorRemarksOrModelEligibility:false,
  };
 });
 return {
  marker:TRACK_D_DENOMINATOR_MARKER,
  version:'senate-media-track-d-946-987-denominator-and-original-source-crosswalk-v2',
  scannedScope:'only_old_44_seed_wayback_local_trade_news_context_evidence',
  safeAggregates:{
   contextRows:scope.context_rows,sourceDocuments:scope.source_documents,
   withOriginalUrl:scope.rows_with_original_url,
   withArchiveUrl:scope.rows_with_archive_url,
   withArchiveUtc:scope.rows_with_archive_utc,
   withArchiveDigest:scope.rows_with_archive_digest,
   documentsWithRawSha256:scope.rows_with_body_sha256,
   reformerSourceDocs:scope.reformer_source_documents,
   mprSourceDocs:scope.mpr_source_documents,
   reformerBriefContextItems:scope.reformer_brief_url_rows,
   mprEpisodeContextItems:scope.mpr_episode_url_rows,
  },
  issues:publishers,
  allPrivateSourceIdentitiesAndContentsKeptInsideDatabase:true,
  absenceFromAllOtherSourcesOrVotePredictNotEstablished:true,
  historicPublisherFirstPublicationOrAudioVerified:false,
  externalPublisherOrFullLegislativeDenominatorKnown:false,
  aliasesAutomaticallyMerged:0,
  sqlReadOnly:true,explicitRollbackRequired:true,
  productionSourcesVotesOrModelsModified:false,
 };
}
