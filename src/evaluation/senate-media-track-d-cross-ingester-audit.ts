/**
 * #946/#987: cross-INGESTER, *not all external universe*, READ ONLY stored
 * source_documents/evidence_items audit of 23 public historical raw snapshots.
 * Aggregate source documents by PUBLIC pinned capture ID. Never select a
 * private row, source id, person, stored URL, source-kind label or source SHA.
 */
import type {HistoricalShadowPin} from './senate-media-track-d-historic-shadow.js';
import {validateTrackDHistoricalShadowPins} from './senate-media-track-d-historic-shadow.js';
export const TRACK_D_CROSS_INGESTER_MARKER=
 'TRACK_D_946_987_CROSS_INGESTER_READONLY_SHADOW_V3_20261018';
export type CrossSourceContext={
 stored_source_documents:number;
 stored_source_kinds:number;
 stored_evidence_items:number;
};
export type CrossMatchRow={
 public_id:string;matching_body_sha_docs:number;
 exact_archive_body_docs:number;
 archive_link_docs:number;
 same_original_url_docs:number;
 same_original_url_and_sha_docs:number;
 potential_dated_alias_reference_docs:number;
 matching_other_source_kind_docs:number;
};
export const TRACK_D_CROSS_SOURCE_DENOMINATOR_SQL=
 'SELECT (SELECT count(*)::int FROM source_documents) AS stored_source_documents,'+
 ' (SELECT count(DISTINCT source_kind)::int FROM source_documents) AS stored_source_kinds,'+
 ' (SELECT count(*)::int FROM evidence_items) AS stored_evidence_items LIMIT 1';

export const TRACK_D_CROSS_SOURCE_SQL=[
 'WITH pins AS (SELECT * FROM jsonb_to_recordset($1::jsonb)',
 'AS p(public_id text, original_url text, archive_url text,',
 'candidate_alias_url text, raw_sha256 text)),',
 'matches AS (',
 'SELECT p.public_id,sd.id AS sid,sd.content_sha256 AS digest,sd.source_kind AS kind,',
 "(sd.source_url=p.original_url OR sd.metadata->>'originalUrl'=p.original_url) AS original_link,",
 "(sd.source_url=p.archive_url OR sd.metadata->>'archiveUrl'=p.archive_url) AS archive_link,",
 "(p.candidate_alias_url IS NOT NULL AND (sd.source_url=p.candidate_alias_url",
 "OR sd.metadata->>'originalUrl'=p.candidate_alias_url)) AS alias_link",
 'FROM pins p JOIN source_documents sd ON',
 '(sd.source_url=p.original_url OR sd.source_url=p.archive_url',
 'OR sd.content_sha256=p.raw_sha256',
 "OR sd.metadata->>'originalUrl'=p.original_url",
 "OR sd.metadata->>'archiveUrl'=p.archive_url",
 'OR (p.candidate_alias_url IS NOT NULL AND (sd.source_url=p.candidate_alias_url',
 "OR sd.metadata->>'originalUrl'=p.candidate_alias_url)))",
 'UNION ALL',
 'SELECT p.public_id,sd.id AS sid,sd.content_sha256 AS digest,sd.source_kind AS kind,',
 "(sd.source_url=p.original_url OR sd.metadata->>'originalUrl'=p.original_url",
 "OR ei.metadata->>'originalUrl'=p.original_url) AS original_link,",
 "(sd.source_url=p.archive_url OR sd.metadata->>'archiveUrl'=p.archive_url",
 "OR ei.metadata->>'archiveUrl'=p.archive_url) AS archive_link,",
 "(p.candidate_alias_url IS NOT NULL AND (sd.source_url=p.candidate_alias_url",
 "OR sd.metadata->>'originalUrl'=p.candidate_alias_url",
 "OR ei.metadata->>'originalUrl'=p.candidate_alias_url)) AS alias_link",
 'FROM pins p JOIN evidence_items ei ON',
 "(ei.metadata->>'originalUrl'=p.original_url",
 "OR ei.metadata->>'archiveUrl'=p.archive_url",
 "OR (p.candidate_alias_url IS NOT NULL AND ei.metadata->>'originalUrl'=p.candidate_alias_url))",
 'JOIN source_documents sd ON sd.id=ei.source_document_id',
 ')',
 'SELECT p.public_id,',
 'count(DISTINCT m.sid) FILTER (WHERE m.digest=p.raw_sha256)::int AS matching_body_sha_docs,',
 'count(DISTINCT m.sid) FILTER (WHERE m.archive_link AND m.digest=p.raw_sha256)::int AS exact_archive_body_docs,',
 'count(DISTINCT m.sid) FILTER (WHERE m.archive_link)::int AS archive_link_docs,',
 'count(DISTINCT m.sid) FILTER (WHERE m.original_link)::int AS same_original_url_docs,',
 'count(DISTINCT m.sid) FILTER (WHERE m.original_link AND m.digest=p.raw_sha256)::int AS same_original_url_and_sha_docs,',
 'count(DISTINCT m.sid) FILTER (WHERE m.alias_link)::int AS potential_dated_alias_reference_docs,',
 "count(DISTINCT m.sid) FILTER (WHERE m.kind<>'wayback_local_trade_news')::int AS matching_other_source_kind_docs",
 'FROM pins p LEFT JOIN matches m ON m.public_id=p.public_id',
 'GROUP BY p.public_id ORDER BY p.public_id LIMIT 24',
].join(' ');

export function assertTrackDCrossSourceStaticSQL():true{
 for(const q of [TRACK_D_CROSS_SOURCE_DENOMINATOR_SQL,TRACK_D_CROSS_SOURCE_SQL]){
  if(!/^(?:SELECT|WITH)\s/.test(q)||!/ LIMIT (?:1|24)$/.test(q)||
   /;|--|\/\*|\*\/|\b(?:UPDATE|DELETE|INSERT|ALTER|DROP|CREATE|TRUNCATE|COPY|EXECUTE|CALL|GRANT|REVOKE|pg_sleep|dblink)\b/i.test(q)||
   /\b(?:sd|ei)\.\*/.test(q))
   throw Error('Unsafe or nonaggregate private cross-ingester SQL');
 }
 if((TRACK_D_CROSS_SOURCE_SQL.match(/\$1::jsonb/g)||[]).length!==1||
  TRACK_D_CROSS_SOURCE_DENOMINATOR_SQL.includes('$1')||
  !TRACK_D_CROSS_SOURCE_SQL.includes('GROUP BY p.public_id')||
  !TRACK_D_CROSS_SOURCE_SQL.includes('count(DISTINCT m.sid)')||
  !TRACK_D_CROSS_SOURCE_SQL.includes("JOIN source_documents sd ON sd.id=ei.source_document_id"))
  throw Error('Cross-ingester query is not public-identity-only and bounded');
 return true;
}

export function summarizeTrackDCrossSource(
 pins:readonly HistoricalShadowPin[],context:CrossSourceContext,
 rows:readonly CrossMatchRow[],
){
 validateTrackDHistoricalShadowPins(pins);assertTrackDCrossSourceStaticSQL();
 if(!context||
  !Number.isSafeInteger(context.stored_source_documents)||
  !Number.isSafeInteger(context.stored_source_kinds)||
  !Number.isSafeInteger(context.stored_evidence_items)||
  context.stored_source_documents<0||context.stored_source_documents>50_000_000||
  context.stored_evidence_items<0||context.stored_evidence_items>50_000_000||
  context.stored_source_kinds<0||context.stored_source_kinds>1_000||
  context.stored_source_kinds>context.stored_source_documents||
  !Array.isArray(rows)||rows.length!==23||
  new Set(rows.map(x=>x.public_id)).size!==23)
  throw Error('Unexpected all-source aggregate scope');
 const byId=new Map(pins.map(p=>[p.publicId,p]));
 const out=rows.map(row=>{
  const pin=byId.get(row.public_id);
  const v=[
   row.matching_body_sha_docs,row.exact_archive_body_docs,
   row.archive_link_docs,row.same_original_url_docs,
   row.same_original_url_and_sha_docs,
   row.potential_dated_alias_reference_docs,
   row.matching_other_source_kind_docs,
  ];
  if(!pin||v.some(x=>!Number.isSafeInteger(x)||x<0||x>context.stored_source_documents)||
   row.exact_archive_body_docs>row.matching_body_sha_docs||
   row.exact_archive_body_docs>row.archive_link_docs||
   row.same_original_url_and_sha_docs>row.same_original_url_docs||
   (pin.candidateDatedAlias===null && row.potential_dated_alias_reference_docs!==0))
   throw Error('Malformed cross-ingester source match totals');
  const disposition=row.exact_archive_body_docs>0?
   'same_historic_archive_url_and_raw_body_sha_stored_in_a_source_kind':
   row.same_original_url_and_sha_docs>0?
   'same_original_publisher_url_and_raw_body_sha_stored_elsewhere':
   row.archive_link_docs>0?
   'archive_url_stored_but_raw_body_sha_not_this_authenticated_version':
   row.same_original_url_docs>0?
   'same_original_url_reference_but_original_archive_body_unverified':
   row.matching_body_sha_docs>0?
   'same_raw_sha_only_no_verified_original_url_identity':
   'no_exact_original_archive_identity_observed_in_source_documents_or_context_metadata';
  return{
   publicOriginalId:pin.publicId,issue:pin.issue,
   disposition,
   exactArchiveAndBodyShaSourceDocs:row.exact_archive_body_docs,
   originalUrlAndBodyShaSourceDocs:row.same_original_url_and_sha_docs,
   originalUrlReferenceSourceDocs:row.same_original_url_docs,
   candidateDatedAliasReferenceDocs:row.potential_dated_alias_reference_docs,
   rawBodyShaOnlyOrCombinedSourceDocs:row.matching_body_sha_docs,
   storedUnderNonlocalTradeNewsSourceKindDocs:row.matching_other_source_kind_docs,
   privateSourceRowsOrSourceKindsPublished:false,
   candidateAliasAutomaticallyDeduplicated:false,
   historicSpeechOrPredictionEligibilityVerified:false,
  };
 });
 const issueSummaries=([946,987] as const).map(issue=>{
  const items=out.filter(x=>x.issue===issue);
  return{
   issue,sourceCaptureVersionsChecked:items.length,
   distinctOriginalPublisherUrls:new Set(pins.filter(x=>x.issue===issue).map(x=>x.originalUrl)).size,
   exactArchiveAndBodyShaVersionsSeen:items.filter(x=>x.exactArchiveAndBodyShaSourceDocs>0).length,
   exactOriginalUrlAndBodyShaVersionsSeen:items.filter(x=>x.originalUrlAndBodyShaSourceDocs>0).length,
   onlySameOriginalUrlReferenceVersions:items.filter(x=>x.originalUrlReferenceSourceDocs>0 &&
    x.exactArchiveAndBodyShaSourceDocs===0&&x.originalUrlAndBodyShaSourceDocs===0).length,
   possibleDatedAliasRefVersions:items.filter(x=>x.candidateDatedAliasReferenceDocs>0).length,
   noExactOriginalUrlOrShaSeenInStoredSourceKinds:items.filter(x=>
    x.exactArchiveAndBodyShaSourceDocs===0&&
    x.originalUrlAndBodyShaSourceDocs===0&&
    x.originalUrlReferenceSourceDocs===0&&
    x.rawBodyShaOnlyOrCombinedSourceDocs===0).length,
   verifiedNewQuoteCount:0,
   allOtherExternalArchivesAndOriginalSourceUniversesUnknown:true,
  };
 });
 return{
  version:'senate-media-track-d-946-987-all-stored-source-kinds-aggregate-v1',
  marker:TRACK_D_CROSS_INGESTER_MARKER,
  actualSourceDocumentRowsAcrossAllStoredKinds:context.stored_source_documents,
  distinctStoredSourceKinds:context.stored_source_kinds,
  actualEvidenceItemRowsAllKinds:context.stored_evidence_items,
  issues:issueSummaries,
  byPublicOriginal:out.sort((a,b)=>a.publicOriginalId.localeCompare(b.publicOriginalId)),
  allSourceDocumentsAndEvidenceItemsMetadataExamined:true,
  noPrivateSourceDocumentIdentitiesContentNamesOrUnknownURLsReturned:true,
  noPrivateSourceKindValuesPublished:true,
  historicallyIdenticalDatedVsBriefSourceBytesNotEstablished:true,
  noGlobalArticleAbsenceClaim:true,
  oldMediaContextSubsetStillDistinctFromAllStoredKinds:true,
  noDatabaseWritesOrModelServingChanges:true,
  readOnlySnapshotExplicitRollback:true,
 };
}
