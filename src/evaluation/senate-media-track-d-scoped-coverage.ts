/**
 * #946 + #987: private scope, only aggregate exact-source coverage.
 * The public originals are pre-verified HTML by Wayback index SHA1 and raw
 * body SHA256, with observed archive clocks. Not original publication clocks.
 * Does not fetch sources, export private rows, backdate any evidence or score.
 */
export const TRACK_D_946_987_MARKER='TRACK_D_946_987_SCOPED_READONLY_COVERAGE_V1_20261018';

type Rec=Record<string,any>;
export type PublicOriginalPin={
 publicId:string;issue:946|987;displayedYear:number;
 originalUrl:string;archiveUrl:string;capturedUtc:string;
 rawSha256:string;indexedSha1:string;publisher:string;seedId:string;
};
export type AggregatedSourceRow={
 public_id:string;same_url_docs:number;exact_archive_link_docs:number;
 exact_source_docs:number;exact_context_items:number;
 exact_other_seed_docs:number;conflicting_digest_docs:number;
};
const SHA=/^[a-f0-9]{64}$/;
const SHA1=/^[A-Z2-7]{32}$/;
const UTC=/^20(?:21|22|23|24|25)-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const archive=(original:string,utc:string)=>
 'https://web.archive.org/web/'+utc.replace(/[-:TZ]/g,'')+'id_/'+original;
const leadUrl=(value:string,issue:946|987):true=>{
 let u:URL;
 try{u=new URL(value)}catch{throw Error('Invalid original publisher URL')}
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||u.search||
  u.href!==value)throw Error('Unsafe media publisher URL');
 if(issue===946){
  if(u.hostname!=='minnesotareformer.com'||
    !/^\/briefs\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/.test(u.pathname))
   throw Error('Not an exact Minnesota Reformer /briefs/ page');
 }else if(u.hostname!=='www.mprnews.org'||
  !/^\/(?:episode|story)\/20(?:21|22|23|24|25)\/\d\d\/\d\d\/[a-z0-9-]+\/?$/.test(u.pathname)){
   throw Error('Not an exact MPR 2021-25 page');
 }
 return true;
};
export function validateTrackDPins(pins:readonly PublicOriginalPin[]):true{
 if(!Array.isArray(pins)||pins.length!==18||
   pins.filter(x=>x.issue===946).length!==12||
   pins.filter(x=>x.issue===987).length!==6||
   new Set(pins.map(x=>x.publicId)).size!==18||
   new Set(pins.map(x=>x.originalUrl+'|'+x.capturedUtc)).size!==18)
  throw Error('Track D exact original pinned coverage changed');
 for(const pin of pins){
  if(![946,987].includes(pin.issue)||!UTC.test(pin.capturedUtc)||
   new Date(pin.capturedUtc).toISOString()!==pin.capturedUtc.replace('Z','.000Z')||
   !Number.isInteger(pin.displayedYear)||
   pin.displayedYear<2021||pin.displayedYear>2025||
   !pin.publicId.endsWith('@'+pin.capturedUtc)||
   !/^[a-z0-9-]{6,105}@20(?:21|22|23|24|25)-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(pin.publicId)||
   !SHA.test(pin.rawSha256)||!SHA1.test(pin.indexedSha1)||
   (pin.issue===946&&
    (pin.publisher!=='Minnesota Reformer'||pin.seedId!=='minnesota-reformer-article-archive'))||
   (pin.issue===987&&
    (pin.publisher!=='MPR News'||pin.seedId!=='mpr-news-story-archive'))||
   pin.archiveUrl!==archive(pin.originalUrl,pin.capturedUtc))
   throw Error('Malformed or broadened authenticated source pin');
  leadUrl(pin.originalUrl,pin.issue);
 }
 if(new Set(pins.filter(x=>x.issue===946).map(x=>x.originalUrl)).size!==10||
  new Set(pins.filter(x=>x.issue===987).map(x=>x.originalUrl)).size!==4||
  !pins.some(x=>x.issue===987&&x.originalUrl.includes('/2024/02/19/without-total-dfl-support-'))||
  !pins.some(x=>x.issue===946&&x.originalUrl.includes('/briefs/senate-dfl-outlines-')))
  throw Error('2021-25 Reformer/MPR source family and Hauschild audit scope changed');
 return true;
}
export function selectTrackDPins(input:{
 leadLedger:Rec;earlierOriginals:Rec;fourAliases:Rec;aliasQueue:Rec;mprSix:Rec;
}):PublicOriginalPin[]{
 const {leadLedger,earlierOriginals,fourAliases,aliasQueue,mprSix}=input;
 if(leadLedger.version!=='senate-media-public-discovery-leads-v1'||
  !Array.isArray(leadLedger.selectedNonExhaustiveArticleLeads)||
  leadLedger.selectedNonExhaustiveArticleLeads.length!==31||
  earlierOriginals.version!=='senate-media-2021-25-public-index-consistent-exact-replay-receipts-v1'||
  earlierOriginals.indexConsistentCaptureReceipts?.length!==19||
  fourAliases.version!=='senate-media-four-public-reformer-historic-alias-pairs-receipts-v1'||
  fourAliases.pairOriginalHistoricalFindings?.length!==4||
  aliasQueue.version!=='minnesota-reformer-original-briefs-vs-dated-path-pairs-2021-25-v1'||
  aliasQueue.pairs?.length!==4||
  mprSix.version!=='mpr-six-senator-interviews-public-original-and-seed-receipts-v1'||
  mprSix.urls?.length!==6||
  mprSix.originals?.historicallySha1AuthenticatedOriginalHtmlCaptureCount!==5)
  throw Error('Original frozen publisher research manifest version/count drift');
 const lookup=new Map<string,Rec>();
 for(const l of leadLedger.selectedNonExhaustiveArticleLeads as Rec[]){
  if(lookup.has(l.id))throw Error('Duplicate public publisher lead');
  lookup.set(l.id,l);
 }
 const pins:PublicOriginalPin[]=[];
 const add=(id:string,issue:946|987,url:string,displayedDay:string,
   capturedUtc:string,rawSha256:string,indexedSha1:string)=>{
  if(typeof displayedDay!=='string'||
    !/^20(?:21|22|23|24|25)-\d\d-\d\d$/.test(displayedDay)||
    Number.isNaN(Date.parse(displayedDay+'T00:00:00Z')))
   throw Error('Displayed source date outside approved public five-year sample');
  const publicationYear=Number(displayedDay.slice(0,4));
  if(pins.some(p=>p.originalUrl===url&&p.capturedUtc===capturedUtc)){
   const old=pins.find(p=>p.originalUrl===url&&p.capturedUtc===capturedUtc)!;
   if(old.rawSha256!==rawSha256||old.indexedSha1!==indexedSha1||old.issue!==issue)
    throw Error('Conflicting identical archived original identity from different source receipts');
   return;
  }
  pins.push({publicId:id+'@'+capturedUtc,issue,displayedYear:publicationYear,
   originalUrl:url,archiveUrl:archive(url,capturedUtc),capturedUtc,
   rawSha256,indexedSha1,
   publisher:issue===946?'Minnesota Reformer':'MPR News',
   seedId:issue===946?'minnesota-reformer-article-archive':'mpr-news-story-archive'});
 };
 for(const r of earlierOriginals.indexConsistentCaptureReceipts as Rec[]){
  const l=lookup.get(r.leadId);
  if(!l)throw Error('Unlisted historical original lead');
  if(l.seedId==='minnesota-reformer-article-archive' &&
   l.livePageUrl.includes('/briefs/')){
   add(l.id,946,l.livePageUrl,l.publicationDayDisplayedOnPublicPage,
    r.archivedCaptureUtc,r.observedOriginalHtmlSha256,r.indexedPayloadSha1Base32);
  }else if(l.id==='mpr-2024-hauschild-north-star-on-air-interview'){
   add(l.id,987,l.livePageUrl,l.publicationDayDisplayedOnPublicPage,
    r.archivedCaptureUtc,r.observedOriginalHtmlSha256,r.indexedPayloadSha1Base32);
  }
 }
 if(pins.filter(x=>x.issue===946).length!==9||
    pins.filter(x=>x.issue===987).length!==1)
  throw Error('Prior immutable initial Reformer/Hauschild original subset drift');
 for(const mpr of mprSix.urls as Rec[]){
  for(const o of mpr.originals as Rec[]){
   add(mpr.id,987,mpr.url,mpr.day,o.captureUtc,o.sha256,o.sha1);
  }
 }
 for(const q of aliasQueue.pairs as Rec[]){
  const finding=(fourAliases.pairOriginalHistoricalFindings as Rec[])
   .find(x=>x.pair===q.pair);
  const lead=lookup.get(q.briefId);
  if(!finding||!lead||
   lead.livePageUrl!==q.briefOriginalUrl||
   finding.exactHistoricTwoSidedIdentityProven!==false||
   finding.canDeduplicateArticleUrls!==false||
   finding.datedPath?.cdx!=='index_unavailable_unknown')
   throw Error('Historical alias identity unsafe or unexpectedly resolved');
  for(const o of finding.briefPath.firstTwoActualRawOriginalBodyReplays as Rec[]){
   if(o.replayStatus!=='indexed_sha1_original_html_authenticated')continue;
   if(o.historicalHtmlCanonicalPointsToOwnBriefUrl!==true)
    throw Error('Original brief canonical unexpectedly points elsewhere');
   add(lead.id,946,lead.livePageUrl,lead.publicationDayDisplayedOnPublicPage,
    o.captureUtc,o.rawOriginalBodySha256,o.indexSha1Base32);
  }
 }
 pins.sort((a,b)=>a.publicId.localeCompare(b.publicId));
 validateTrackDPins(pins);
 return pins;
}

// Exactly one parameterized, bounded READ-ONLY source/evidence aggregate query.
// No private row IDs, names, articles, timestamps, URLs, digests or original
// byte data are selected. Metadata comparisons happen only inside Neon.
export const TRACK_D_SCOPED_COVERAGE_SQL=[
 'WITH pins AS (SELECT * FROM jsonb_to_recordset($1::jsonb)',
 'AS p(public_id text,original_url text,archive_url text,captured_utc text,',
 'raw_sha256 text,indexed_sha1 text,publisher text,seed_id text))',
 'SELECT p.public_id,',
 "count(DISTINCT sd.id) FILTER (WHERE ev.metadata->>'originalUrl'=p.original_url)::int AS same_url_docs,",
 "count(DISTINCT sd.id) FILTER (WHERE ev.metadata->>'originalUrl'=p.original_url",
 "AND ev.metadata->>'archiveUrl'=p.archive_url)::int AS exact_archive_link_docs,",
 "count(DISTINCT sd.id) FILTER (WHERE ev.metadata->>'originalUrl'=p.original_url",
 "AND ev.metadata->>'archiveUrl'=p.archive_url",
 "AND ev.metadata->>'archiveCapturedAt'=p.captured_utc",
 "AND ev.metadata->>'archiveDigest'=p.indexed_sha1",
 "AND ev.metadata->>'publisher'=p.publisher",
 'AND sd.source_url=p.archive_url AND sd.content_sha256=p.raw_sha256)::int AS exact_source_docs,',
 "count(ev.id) FILTER (WHERE ev.metadata->>'originalUrl'=p.original_url",
 "AND ev.metadata->>'archiveUrl'=p.archive_url",
 "AND ev.metadata->>'archiveCapturedAt'=p.captured_utc",
 "AND ev.metadata->>'archiveDigest'=p.indexed_sha1",
 "AND ev.metadata->>'publisher'=p.publisher",
 'AND sd.source_url=p.archive_url AND sd.content_sha256=p.raw_sha256)::int AS exact_context_items,',
 "count(DISTINCT sd.id) FILTER (WHERE ev.metadata->>'originalUrl'=p.original_url",
 "AND ev.metadata->>'archiveUrl'=p.archive_url",
 "AND ev.metadata->>'archiveCapturedAt'=p.captured_utc",
 "AND ev.metadata->>'archiveDigest'=p.indexed_sha1",
 "AND ev.metadata->>'publisher'=p.publisher",
 'AND sd.source_url=p.archive_url AND sd.content_sha256=p.raw_sha256',
 "AND ev.metadata->>'seedId' IS DISTINCT FROM p.seed_id)::int AS exact_other_seed_docs,",
 "count(DISTINCT sd.id) FILTER (WHERE ev.metadata->>'originalUrl'=p.original_url",
 "AND ev.metadata->>'archiveUrl'=p.archive_url",
 "AND (sd.source_url IS DISTINCT FROM p.archive_url",
 'OR sd.content_sha256 IS DISTINCT FROM p.raw_sha256',
 "OR ev.metadata->>'archiveDigest' IS DISTINCT FROM p.indexed_sha1))::int AS conflicting_digest_docs",
 'FROM pins p LEFT JOIN evidence_items ev',
 "ON ev.metadata->>'contextType'='local_trade_news'",
 "AND (ev.metadata->>'originalUrl'=p.original_url",
 "OR ev.metadata->>'archiveUrl'=p.archive_url)",
 'LEFT JOIN source_documents sd ON sd.id=ev.source_document_id',
 "AND sd.source_kind='wayback_local_trade_news'",
 'GROUP BY p.public_id ORDER BY p.public_id LIMIT 19',
].join(' ');
export function assertTrackDCrosswalkSQL():true{
 if(!TRACK_D_SCOPED_COVERAGE_SQL.startsWith('WITH pins AS ')||
  !TRACK_D_SCOPED_COVERAGE_SQL.endsWith(' LIMIT 19')||
  (TRACK_D_SCOPED_COVERAGE_SQL.match(/\$1::jsonb/g)||[]).length!==1||
  /;|--|\/\*|\*\/|\b(?:UPDATE|DELETE|INSERT|CREATE|ALTER|DROP|TRUNCATE|COPY|EXECUTE|GRANT|REVOKE|CALL|pg_sleep|dblink)\b/i.test(TRACK_D_SCOPED_COVERAGE_SQL)||
  /\bsd\.\*\b|\bev\.\*\b/i.test(TRACK_D_SCOPED_COVERAGE_SQL))
  throw Error('Mutable or unbounded Track D exact context source inspection');
 return true;
}
export function summarizeTrackDProtectedAggregate(
 pins:readonly PublicOriginalPin[],rows:readonly AggregatedSourceRow[],
){
 validateTrackDPins(pins);assertTrackDCrosswalkSQL();
 if(rows.length!==pins.length||new Set(rows.map(r=>r.public_id)).size!==18)
  throw Error('Private coverage aggregate incomplete or duplicated');
 const byId=new Map(pins.map(x=>[x.publicId,x]));
 const groups={946:[] as Rec[],987:[] as Rec[]};
 for(const r of rows){
  const publicPin=byId.get(r.public_id);
  if(!publicPin||[r.same_url_docs,r.exact_archive_link_docs,r.exact_source_docs,
   r.exact_context_items,r.exact_other_seed_docs,r.conflicting_digest_docs]
    .some(x=>!Number.isSafeInteger(x)||x<0||x>10000)||
    r.exact_source_docs>r.exact_archive_link_docs||
    r.exact_archive_link_docs>r.same_url_docs||
    r.exact_other_seed_docs>r.exact_source_docs)
   throw Error('Unexpected private aggregate shape or count scope');
  const status=r.exact_source_docs>0?'exact_original_in_bounded_local_media_context':
   r.conflicting_digest_docs>0?'same_archive_link_conflicting_or_unproven_source_bytes':
   r.same_url_docs>0?'other_capture_or_metadata_of_same_original_url_only':
   'not_observed_in_bounded_local_media_context';
  groups[publicPin.issue].push({
   publicOriginalId:publicPin.publicId,
   year:publicPin.displayedYear,
   status,
   exactSourceDocuments:r.exact_source_docs,
   exactContextItems:r.exact_context_items,
   sameOriginalUrlOtherOrMatchingSourceCount:r.same_url_docs,
   exactStoredUnderDifferentSeed:r.exact_other_seed_docs,
   privateRawRowIdsOrArticleTextDisclosed:false,
  });
 }
 const summary=(issue:946|987)=>{
  const arr=groups[issue],originals=pins.filter(x=>x.issue===issue);
  return{
   issue,scope:'original_archive_versions_in_44_local_trade_news_seed_context_only',
   publicArchiveVersionsAudited:arr.length,
   distinctPublicPublisherUrls:new Set(originals.map(x=>x.originalUrl)).size,
   publicationYearsOfSelectedUrls:[...new Set(originals.map(x=>x.displayedYear))].sort(),
   exactArchivedVersionsObservedWithinBoundedContext:arr.filter(x=>
     x.status==='exact_original_in_bounded_local_media_context').length,
   sameUrlOtherVersionsOrMetadata:arr.filter(x=>
     x.status==='other_capture_or_metadata_of_same_original_url_only').length,
   conflictingStoredArchiveIdentifiers:arr.filter(x=>
     x.status==='same_archive_link_conflicting_or_unproven_source_bytes').length,
   notObservedInBoundedContext:arr.filter(x=>
     x.status==='not_observed_in_bounded_local_media_context').length,
   exactStoredOutsideExpectedSeed:arr.reduce((n,x)=>n+x.exactStoredUnderDifferentSeed,0),
   rows:arr.sort((a,b)=>a.publicOriginalId.localeCompare(b.publicOriginalId)),
   allOtherSourcesAndCollectionsOutOfScope:true,
   missingArticleCountOrPublisherDenominatorInferred:false,
   exactPublisherFirstPublicationTimeProven:false,
   originalFullPersonQuoteOrVoteLabelVerified:false,
   noHistoricalAliasPairsAutomaticallyMerged:true,
   noPrivateDataRowsExported:true,
  };
 };
 return{
  version:'senate-media-track-d-946-987-scoped-protected-source-coverage-v1',
  marker:TRACK_D_946_987_MARKER,
  readOnlyOnly:true,outputsOnlyPreexistingPublicIdsAndNumericAggregates:true,
  issues:[summary(946),summary(987)],
  localTradeNewsContextNotEveryMediaOrPredictionPipeline:true,
  privateIdentifiersSourceUrlsOrRawArticlesExcludedFromOutput:true,
  forecastEligibilityEstablished:false,productionSourceMutation:false,
  collectorPathPriorityModelOrServingChanged:false,
 };
}
