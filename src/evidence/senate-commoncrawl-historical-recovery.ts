/**
 * #864 Workstream C: bounded Common Crawl archive research over OFFLINE inputs.
 *
 * Candidate/website leads come from later 2026 research copies; neither the
 * source catalogue nor an indexed capture attests that a 2024/25 issue-page
 * statement was actually present. No network, database, forecasts or writes.
 */
import type { CampaignPageLeadManifest, CandidatePageLead } from './campaign-archive-source-recovery.js';

export const SENATE_COMMONCRAWL_INDEX_PLAN_VERSION='senate-commoncrawl-index-review-v1' as const;
const FIRST_DATE=Date.UTC(2024,0,1);
const MAX_RECORDS=400;
const MAX_WARC_RECORD_BYTES=8*1024*1024;
export interface CommonCrawlWindow {
  id:string;
  from:string;
  to:string;
  indexApiUrl:string;
  sourceClaim:string;
}
export interface CommonCrawlCatalog {
  schema:'mn-senate-commoncrawl-historical-windows-2024-25-v1';
  source:{
    officialCollectionRegistryUrl:string;
    officialDocumentationUrl:string;
    registryAccessedOn:string;
    originalRegistryResponseBytesStored:false;
    originalRegistryResponseHashIndependentlyVerified:false;
    sourceIsCrawlIndexMetadataOnly:true;
  };
  indexes:CommonCrawlWindow[];
}
export type CcQueryKind='host_prefix'|'homepage_exact'|'issue_exact';
export interface CcSourceQuery {
  id:string;collectionId:string;
  candidateName:string;district:string;candidateHost:string;
  campaignElectionYear:number;
  primaryElectionOn:string;generalElectionOn:string;
  sourceUrl:string;queryKind:CcQueryKind;
  queryApiUrl:string;maxIndexRecords:400;
  collectionFrom:string;collectionTo:string;
  indexWindowOverlapsGeneralCutoff:boolean;
  indexWindowOverlapsPrimaryCutoff:boolean;
  sourceSiteBytesVerified:false;
  originalCampaignStatementVerified:false;
}
export interface CcIndexRecord {
  queryId:string;candidateName:string;district:string;candidateHost:string;
  campaignElectionYear:number;primaryElectionOn:string;generalElectionOn:string;
  collectionId:string;originalUrl:string;capturedAt:string;timestamp:string;
  mime:string;digest:string;warcFilename:string;warcOffset:number;
  warcLength:number;warcRangeEndInclusive:number;
  warcDataUrl:string;httpRange:string;isStrictlyBeforePrimary:boolean;
  isKnownOriginalIssuePageUrl:boolean;
  indexClaimIndependentlyAuthenticated:false;
  originalWarcBytesRetrieved:false;
  originalStatementTextVerified:false;
  forecastEligible:false;
}
function dateTimeUtc(value:string):number {
  if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(value))throw new Error('Bad UTC timestamp');
  const ms=Date.parse(value);
  if(!Number.isFinite(ms)||new Date(ms).toISOString()!==value.replace('Z','.000Z'))
    throw new Error('Impossible ISO timestamp');
  return ms;
}
function cdxTimestamp(raw:string):number {
  if(!/^\d{14}$/.test(raw))throw new Error('Invalid CDX timestamp');
  const iso=raw.slice(0,4)+'-'+raw.slice(4,6)+'-'+raw.slice(6,8)+'T'
    +raw.slice(8,10)+':'+raw.slice(10,12)+':'+raw.slice(12,14)+'Z';
  return dateTimeUtc(iso);
}
function electionMs(day:string):number {
  if(!/^\d{4}-\d\d-\d\d$/.test(day))throw new Error('Bad election day');
  const ms=Date.parse(day+'T00:00:00Z');
  if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==day)
    throw new Error('Impossible election day');
  return ms;
}
function canonicalHost(url:string):string {
  let parsed:URL;
  try{parsed=new URL(url);}catch{throw new Error('Bad campaign/source URL');}
  if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password||parsed.port)
    throw new Error('Unexpected candidate URL protocol/credentials/port');
  return parsed.hostname.replace(/^www\./i,'').toLowerCase();
}
function exactPagePath(a:string,b:string):boolean {
  const left=new URL(a),right=new URL(b);
  return canonicalHost(a)===canonicalHost(b)
    &&left.pathname.replace(/\/$/,'')===right.pathname.replace(/\/$/,'')
    &&left.search===right.search;
}
function checkSource(c:CandidatePageLead) {
  if(!/^[1-9]\d?$/.test(c.district)||Number(c.district)>67)throw new Error('Bad district');
  if(c.electionYear!==2024&&c.electionYear!==2025)throw new Error('Out-of-scope election year');
  if(electionMs(c.primaryElectionOn)>=electionMs(c.generalElectionOn)
    ||c.generalElectionOn.slice(0,4)!==String(c.electionYear))
    throw new Error('Impossible Senate primary/general election chronology');
  if(!c.campaignHost.includes('.')||/^localhost$/i.test(c.campaignHost)
    ||canonicalHost('https://'+c.campaignHost+'/')!==c.campaignHost)
    throw new Error('Unsafe candidate source domain');
  if(c.sourceOriginalCampaignDomainCertified!==false||c.sitesFromOfficialHistoricalFiling!==false)
    throw new Error('Do not upgrade publisher website lead to original SOS filing proof');
  for(const p of c.pages) {
    if(canonicalHost(p.originalUrl)!==c.campaignHost)throw new Error('Cross-domain 2026 campaign page');
    if(p.pageTextExtractedIn2026Only!==true||p.historicalSitePageBytesProven!==false
      ||p.historicalSnapshotCapturedAt!==null)throw new Error('Backdated 2026 page claim');
  }
}
function checkCatalog(catalog:CommonCrawlCatalog):CommonCrawlWindow[] {
  if(catalog.schema!=='mn-senate-commoncrawl-historical-windows-2024-25-v1'
    ||catalog.source.officialCollectionRegistryUrl!=='https://index.commoncrawl.org/collinfo.json'
    ||catalog.source.originalRegistryResponseBytesStored!==false
    ||catalog.source.originalRegistryResponseHashIndependentlyVerified!==false
    ||catalog.source.sourceIsCrawlIndexMetadataOnly!==true
    ||catalog.indexes.length!==20)
    throw new Error('Unrecognized or upgraded Common Crawl registry metadata');
  const seen=new Set<string>();
  let lastFrom=0;
  for(const w of catalog.indexes){
    if(!/^CC-MAIN-202[45]-\d{2}$/.test(w.id)||seen.has(w.id)
      ||w.indexApiUrl!=='https://index.commoncrawl.org/'+w.id+'-index'
      ||w.sourceClaim!=='common_crawl_official_collinfo_metadata_not_capture_proof')
      throw new Error('Invalid/duplicate Common Crawl collection index');
    const from=dateTimeUtc(w.from),to=dateTimeUtc(w.to);
    if(from<FIRST_DATE||from>=to||to>=Date.UTC(2026,0,1)||from<=lastFrom)
      throw new Error('Impossible or unordered historical crawl window');
    lastFrom=from;seen.add(w.id);
  }
  return catalog.indexes;
}
function cdxUrl(window:CommonCrawlWindow,sourceUrl:string,kind:CcQueryKind):string {
  const params=new URLSearchParams();
  const url=kind==='host_prefix'?'*.'+canonicalHost(sourceUrl)+'/*':sourceUrl;
  params.set('url',url);
  params.set('output','json');
  params.set('filter','status:200');
  params.set('fl','url,timestamp,status,mime,digest,length,offset,filename');
  params.set('limit',String(MAX_RECORDS));
  // Avoid per-month digest collapse: changed policy versions may matter.
  return window.indexApiUrl+'?'+params.toString();
}
export function planSenateCommonCrawlIndexResearch(
  siteLeads:CampaignPageLeadManifest,catalog:CommonCrawlCatalog,
) {
  if(siteLeads.schema!=='mn-senate-campaign-issue-original-url-leads-2024-25-v1'
    ||siteLeads.laterResearchSnapshot.usableAs2021to2025StatementProof!==false
    ||siteLeads.laterResearchSnapshot.originalSiteResponseBytesIndependentlyVerified!==false)
    throw new Error('Cannot backdate third-party campaign-site crawl');
  const windows=checkCatalog(catalog);
  if(siteLeads.candidates.length!==6)throw new Error('Expected six candidate-domain leads');
  const seenCandidates=new Set<string>();
  const queries:CcSourceQuery[]=[];
  for(const candidate of siteLeads.candidates){
    checkSource(candidate);
    if(seenCandidates.has(candidate.campaignHost))throw new Error('Duplicate campaign-domain seed');
    seenCandidates.add(candidate.campaignHost);
    const root=candidate.pages.find(p=>p.kind==='homepage'||p.kind==='homepage_issues')?.originalUrl
      ??'https://'+candidate.campaignHost+'/';
    const targets=[
      {url:root,kind:'host_prefix' as const},
      {url:root,kind:'homepage_exact' as const},
      ...candidate.pages.filter(p=>!p.kind.startsWith('homepage')).map(p=>({
        url:p.originalUrl,kind:'issue_exact' as const,
      })),
    ];
    for(const window of windows){
      const start=dateTimeUtc(window.from),end=dateTimeUtc(window.to);
      const general=electionMs(candidate.generalElectionOn);
      const primary=electionMs(candidate.primaryElectionOn);
      if(start>=general||end<FIRST_DATE)continue;
      for(const target of targets){
        queries.push({
          id:'cc-'+String(queries.length+1).padStart(4,'0'),
          collectionId:window.id,candidateName:candidate.candidateName,
          district:candidate.district,candidateHost:candidate.campaignHost,
          campaignElectionYear:candidate.electionYear,
          primaryElectionOn:candidate.primaryElectionOn,generalElectionOn:candidate.generalElectionOn,
          sourceUrl:target.url,queryKind:target.kind,
          queryApiUrl:cdxUrl(window,target.url,target.kind),maxIndexRecords:400,
          collectionFrom:window.from,collectionTo:window.to,
          indexWindowOverlapsGeneralCutoff:end>=general,
          indexWindowOverlapsPrimaryCutoff:start<primary&&end>=primary,
          sourceSiteBytesVerified:false,originalCampaignStatementVerified:false,
        });
      }
    }
  }
  const prioritized=[...queries].sort((a,b)=>{
    const priority=(q:CcSourceQuery)=>{
      const start=dateTimeUtc(q.collectionFrom);
      const election=electionMs(q.generalElectionOn);
      const primary=electionMs(q.primaryElectionOn);
      // Closest month before vote has highest retrieval priority.
      const age=Math.max(0,election-start);
      const recent=age<45*864e5?0:age<120*864e5?1:2;
      return recent*10 + (q.queryKind==='issue_exact'?0:q.queryKind==='homepage_exact'?1:2)
        + (start<primary?0:0);
    };
    return priority(a)-priority(b)
      ||b.collectionFrom.localeCompare(a.collectionFrom)
      ||a.candidateName.localeCompare(b.candidateName)
      ||a.id.localeCompare(b.id);
  });
  return {
    schema:SENATE_COMMONCRAWL_INDEX_PLAN_VERSION,
    scope:{years:[2024,2025],noNetwork:true,noDatabase:true,noLiveBackfill:true,
      registryBytesAuthenticated:false,actualWarcBytesAuthenticated:false,
      indexQueriesPerformed:0,statementEvidenceCertified:false,
      originalHistoricalWebsiteAvailabilityCertified:false,
      completeArchivePopulationKnown:false},
    totals:{candidateDomains:siteLeads.candidates.length,indexWindows:windows.length,
      plannedTargetedQueries:queries.length,distinctSourcePolicyPagePaths:4,
      overlappingGeneralElectionWindows:queries.filter(q=>q.indexWindowOverlapsGeneralCutoff).length,
      officialArchiveRecordsRetrieved:0},
    registrySourceUrl:catalog.source.officialCollectionRegistryUrl,
    queries:prioritized,
    warnings:[
      'Public Common Crawl indexes are incomplete sampling of the web and cannot prove site absence.',
      'A crawl window crossing election day is queried but ONLY individual WARC records strictly before vote may be accepted.',
      'Official index catalogue dates and later 2026 candidate-site URLs are discovery metadata, not original site text or pre-vote proof.',
      'Index API URL lookup may fail/return 404/429; unresolved is not zero. More host spellings or pagination may be necessary.',
      'WARC index rows must be paired with actual HTTP 206 byte range downloads and independently matched original WARC response content.',
      'A campaign URL may identify a losing candidate, not an elected senator; no opponent positions promoted.',
    ],
  };
}
function object(value:unknown):value is Record<string,unknown>{
  return value!==null&&typeof value==='object'&&!Array.isArray(value);
}
function filenameOk(filename:string,id:string):boolean {
  return filename.startsWith('crawl-data/'+id+'/segments/')
    &&/^crawl-data\/CC-MAIN-202[45]-\d{2}\/segments\/[A-Za-z0-9._-]+\/warc\/CC-MAIN-[A-Za-z0-9._-]+\.warc\.gz$/.test(filename)
    &&!filename.includes('..');
}
export function reviewOfflineCommonCrawlIndexRows(
  query:CcSourceQuery,rawJsonl:string,
) {
  if(rawJsonl.length>2_000_000)throw new Error('CDX JSONL input exceeds 2 MiB');
  if(!/^cc-\d{4}$/.test(query.id)||!/^CC-MAIN-202[45]-\d{2}$/.test(query.collectionId)
    ||query.queryApiUrl.split('?')[0]!=='https://index.commoncrawl.org/'+query.collectionId+'-index'
    ||query.sourceSiteBytesVerified!==false||query.originalCampaignStatementVerified!==false)
    throw new Error('Invalid untrusted query definition');
  const start=dateTimeUtc(query.collectionFrom),end=dateTimeUtc(query.collectionTo);
  const general=electionMs(query.generalElectionOn),primary=electionMs(query.primaryElectionOn);
  const lines=rawJsonl.split(/\r?\n/).filter(x=>x.trim());
  if(lines.length>MAX_RECORDS)throw new Error('CDX response reaches/exceeds offline 400 row cap without paging');
  const selected:CcIndexRecord[]=[];
  const seen=new Set<string>();
  let nonHtmlOrNon200=0,postVoteOrTooEarly=0,duplicates=0;
  for(const line of lines){
    let raw:unknown;
    try{raw=JSON.parse(line);}catch{throw new Error('Invalid Common Crawl CDX JSONL row');}
    if(!object(raw))throw new Error('Common Crawl CDX row must be object');
    const string=(key:string)=>{
      if(typeof raw[key]!=='string')throw new Error('Missing string CDX '+key);
      return raw[key] as string;
    };
    const url=string('url'),timestamp=string('timestamp'),mime=string('mime').toLowerCase();
    const status=string('status'),digest=string('digest'),filename=string('filename');
    const offsetString=string('offset'),lengthString=string('length');
    const when=cdxTimestamp(timestamp);
    if(canonicalHost(url)!==query.candidateHost)throw new Error('Cross-candidate index host');
    if(query.queryKind!=='host_prefix'&&!exactPagePath(query.sourceUrl,url))
      throw new Error('Unrequested Common Crawl exact candidate page URL');
    if(!filenameOk(filename,query.collectionId))throw new Error('Unsafe or wrong-collection WARC filename');
    if(when<start||when>end)throw new Error('CDX timestamp outside selected Common Crawl collection window');
    if(!/^(?:0|[1-9]\d*)$/.test(offsetString)
      ||!/^[1-9]\d*$/.test(lengthString))throw new Error('Invalid WARC byte-range fields');
    const offset=Number(offsetString),length=Number(lengthString);
    if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)
      ||offset+length>Number.MAX_SAFE_INTEGER||length>MAX_WARC_RECORD_BYTES)
      throw new Error('Unsafe/big original WARC byte range');
    if(status!=='200'||!['text/html','text/plain','application/xhtml+xml'].includes(mime)){
      nonHtmlOrNon200++;continue;
    }
    if(!/^[A-Z2-7]{32}$/.test(digest))
      throw new Error('Expected original crawl base32 SHA1 content digest');
    if(when>=general||when<FIRST_DATE){postVoteOrTooEarly++;continue;}
    const key=timestamp+'\u0000'+url+'\u0000'+digest;
    if(seen.has(key)){duplicates++;continue;}
    seen.add(key);
    const u=new URL(url);
    const exactLead=query.queryKind!=='host_prefix'&&query.queryKind==='issue_exact'
      &&exactPagePath(query.sourceUrl,url);
    selected.push({
      queryId:query.id,candidateName:query.candidateName,district:query.district,
      candidateHost:query.candidateHost,campaignElectionYear:query.campaignElectionYear,
      primaryElectionOn:query.primaryElectionOn,generalElectionOn:query.generalElectionOn,
      collectionId:query.collectionId,originalUrl:u.toString(),
      capturedAt:new Date(when).toISOString(),timestamp,mime,digest,warcFilename:filename,
      warcOffset:offset,warcLength:length,warcRangeEndInclusive:offset+length-1,
      warcDataUrl:'https://data.commoncrawl.org/'+filename,
      httpRange:'bytes='+offset+'-'+(offset+length-1),
      isStrictlyBeforePrimary:when<primary,isKnownOriginalIssuePageUrl:exactLead,
      indexClaimIndependentlyAuthenticated:false,originalWarcBytesRetrieved:false,
      originalStatementTextVerified:false,forecastEligible:false,
    });
  }
  selected.sort((a,b)=>a.timestamp.localeCompare(b.timestamp)
    ||a.originalUrl.localeCompare(b.originalUrl)||a.digest.localeCompare(b.digest));
  return {
    schema:'senate-commoncrawl-index-row-review-v1',
    sourceQueryId:query.id,
    candidateName:query.candidateName,collectionId:query.collectionId,
    records: selected,
    counts:{providedLines:lines.length,indexCandidateRecords: selected.length,
      discardedStatusOrMime:nonHtmlOrNon200,
      discardedPostVoteOrPre2024:postVoteOrTooEarly,duplicateIndexRecords:duplicates,
      possibleServerTruncation:lines.length>=MAX_RECORDS,
      statementTextBytesRetrieved:0},
    originalCdxServiceResponseAuthenticated:false,
    originalWarcBytesVerified:false,sourceCandidateIssueTextVerified:false,
    completenessCertified:false,
  };
}
