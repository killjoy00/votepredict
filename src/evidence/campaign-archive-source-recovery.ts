/**
 * #864 C: offline archive research planner. NO network/database/backfill.
 * The 2026 GitHub crawl provides URL paths only; even an imported CDX digest
 * is NOT archived page bytes, candidate attribution, or pre-vote content proof.
 */
import { createHash } from 'node:crypto';
import { parseWaybackCdxJson, type WaybackCapture } from './wayback.js';
import { planWaybackCampaignVersionCaptures } from './wayback-campaign-version-plan.js';
import { strictCandidateKey, type SenateSosSeedManifest } from './sos-senate-historical-candidate-inventory.js';

export const CAMPAIGN_ARCHIVE_SOURCE_PLAN_VERSION = 'senate-campaign-archive-source-plan-v1' as const;
export type PageKind = 'homepage' | 'homepage_issues' | 'issues' | 'priorities' | 'platform';
export interface SourcePageLead {
  kind: PageKind;
  originalUrl: string;
  sourceMetadataFile: string;
  sourceMetadataGitBlobSha: string;
  sourceTextFile: string;
  sourceTextGitBlobSha: string;
  sourceCrawlerFingerprint: string;
  sourceMetadataMentionsYears: string[];
  pageTextExtractedIn2026Only: true;
  historicalSitePageBytesProven: false;
  historicalSnapshotCapturedAt: null;
  historicalArchiveCdxDigest: null;
}
export interface CandidatePageLead {
  candidateName: string;
  district: string;
  electionYear: number;
  primaryElectionOn: string;
  generalElectionOn: string;
  publisherWebsiteLeadSourceId: string;
  campaignHost: string;
  sourceOriginalCampaignDomainCertified: false;
  sitesFromOfficialHistoricalFiling: false;
  laterResearchSnapshotLookupStatus: 'page_paths_found_in_later_snapshot' | 'not_recovered_in_targeted_research_search';
  pages: SourcePageLead[];
}
export interface CampaignPageLeadManifest {
  schema: 'mn-senate-campaign-issue-original-url-leads-2024-25-v1';
  laterResearchSnapshot: {
    repository: string;
    immutableCommit: string;
    githubCommitCommitterDate: string;
    snapshotFormat: 3;
    sourceKind: 'third_party_later_site_crawl';
    actualCrawlTimestampIndependentlyVerified: false;
    publisherGitBlobHashesVerifyRepositoryObjectsOnly: true;
    originalSiteResponseBytesIndependentlyVerified: false;
    earliestHistoricallyProvenPublicBy: null;
    usableAs2021to2025StatementProof: false;
  };
  candidates: CandidatePageLead[];
}
type QueryKind = 'site_prefix' | 'homepage_exact' | 'issue_exact';
export interface ArchiveRequest {
  id: string;
  candidateName: string;
  campaignHost: string;
  electionYear: number;
  primaryElectionOn: string;
  generalElectionOn: string;
  queryKind: QueryKind;
  originalUrl: string;
  sourcePageKind: PageKind | null;
  requestedFrom: string;
  requestedTo: string;
  requestedLimit: 400;
  cdxApiUrl: string;
  originalPageBytesAlreadyAuthenticated: false;
  indexResultsAreStatementProof: false;
}
export interface OfflineCdxResult {
  queryId: string;
  status: 'complete'|'failed';
  rows: unknown;
  sourceResponseBytesAuthenticated: false;
}
const cutoffDate = (day:string): number => {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day))throw new Error('Invalid election date');
  const ms=Date.parse(day+'T00:00:00Z');
  if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==day)throw new Error('Impossible election date');
  return ms;
};
const normHost=(value:string):string=>{
  let u:URL;
  try{u=new URL(value);}catch{throw new Error('Invalid candidate or archive URL: '+value);}
  if(!['http:','https:'].includes(u.protocol)||u.username||u.password||!u.hostname.includes('.')
    ||u.port||/^(?:localhost|\d+\.\d+\.\d+\.\d+)$/.test(u.hostname))
    throw new Error('Unsafe campaign host URL');
  return u.hostname.toLowerCase().replace(/^www\./,'');
};
function strictTimestamp(t:string):number {
  if(!/^\d{14}$/.test(t))throw new Error('Malformed CDX timestamp');
  const iso=t.slice(0,4)+'-'+t.slice(4,6)+'-'+t.slice(6,8)+'T'+t.slice(8,10)+':'+t.slice(10,12)+':'+t.slice(12,14)+'Z';
  const ms=Date.parse(iso);
  if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,19)!==iso.slice(0,19))
    throw new Error('Impossible CDX capture timestamp');
  return ms;
}
function earlierDay(date:string):string {
  return new Date(cutoffDate(date)-86_400_000).toISOString().slice(0,10).replace(/-/g,'');
}
function cdxUrl(originalUrl:string, queryKind:QueryKind, to:string):string {
  const params=new URLSearchParams({
    url:originalUrl,output:'json',fl:'timestamp,original,mimetype,statuscode,digest,length',
    filter:'statuscode:200',from:'20240101',to,limit:'400',
  });
  if(queryKind==='site_prefix')params.set('matchType','prefix');
  // Deliberately NO digest collapse: later snapshots can hide policy edits.
  return 'https://web.archive.org/cdx/search/cdx?'+params.toString();
}
function exactPageMatch(captured:string, requested:string):boolean {
  const a=new URL(captured),b=new URL(requested);
  return normHost(captured)===normHost(requested) && a.pathname.replace(/\/$/,'')===b.pathname.replace(/\/$/,'')
    && a.search===b.search;
}
function validateManifest(input: CampaignPageLeadManifest,winners:SenateSosSeedManifest) {
  if(input.schema!=='mn-senate-campaign-issue-original-url-leads-2024-25-v1')
    throw new Error('Unexpected issue-page discovery manifest');
  const snap=input.laterResearchSnapshot;
  if(snap.repository!=='nniiicc/electionsitechange' || snap.immutableCommit!=='888e15a64c67d221de427aac49dc82ddc11a0c84'
    || snap.githubCommitCommitterDate!=='2026-10-10T17:33:17Z' || snap.snapshotFormat!==3
    || snap.sourceKind!=='third_party_later_site_crawl'
    || snap.actualCrawlTimestampIndependentlyVerified!==false
    || snap.publisherGitBlobHashesVerifyRepositoryObjectsOnly!==true
    || snap.originalSiteResponseBytesIndependentlyVerified!==false
    || snap.earliestHistoricallyProvenPublicBy!==null
    || snap.usableAs2021to2025StatementProof!==false)
    throw new Error('Refusing to treat later third-party crawl as historical proof');
  if(input.candidates.length!==6)throw new Error('Expected six inventoried campaign domain leads');
  const keys=new Set<string>(),hosts=new Set<string>();
  let issuePathCount=0;
  for(const c of input.candidates){
    const year=c.electionYear;
    if(year!==2024&&year!==2025)throw new Error('Out-of-scope campaign election');
    const primary=cutoffDate(c.primaryElectionOn),general=cutoffDate(c.generalElectionOn);
    if(primary>=general||c.generalElectionOn.slice(0,4)!==String(year))
      throw new Error('Invalid primary/general election chronology');
    if(!/^[1-9]\d?$/.test(c.district)||Number(c.district)>67)
      throw new Error('Invalid Senate district');
    const key=year+':'+c.district+':'+strictCandidateKey(c.candidateName);
    if(keys.has(key)||hosts.has(c.campaignHost))throw new Error('Duplicate campaign candidate or host');
    keys.add(key);hosts.add(c.campaignHost);
    if(c.sourceOriginalCampaignDomainCertified!==false||c.sitesFromOfficialHistoricalFiling!==false)
      throw new Error('Unverified campaign domain cannot be certified official');
    const matching=winners.websiteLeads.filter(l=>l.candidateName===c.candidateName
      &&l.district===c.district&&l.electionYear===year&&l.sourceId===c.publisherWebsiteLeadSourceId
      &&normHost(l.url)===c.campaignHost);
    if(matching.length!==1)throw new Error('No unique prior candidate/publisher website URL identity');
    if(c.pages.length===0){
      if(c.laterResearchSnapshotLookupStatus!=='not_recovered_in_targeted_research_search')
        throw new Error('Missing source page must remain unresolved');
      continue;
    }
    if(c.laterResearchSnapshotLookupStatus!=='page_paths_found_in_later_snapshot')
      throw new Error('Later page inventory must be source-backed');
    const pageUrls=new Set<string>();
    let homepageCount=0;
    for(const p of c.pages){
      if(normHost(p.originalUrl)!==c.campaignHost
        ||!['homepage','homepage_issues','issues','priorities','platform'].includes(p.kind)
        ||!/^[a-f0-9]{40}$/.test(p.sourceMetadataGitBlobSha)
        ||!/^[a-f0-9]{40}$/.test(p.sourceTextGitBlobSha)
        ||!/^[a-f0-9]{40}$/.test(p.sourceCrawlerFingerprint)
        ||p.pageTextExtractedIn2026Only!==true||p.historicalSitePageBytesProven!==false
        ||p.historicalSnapshotCapturedAt!==null||p.historicalArchiveCdxDigest!==null
        ||!p.sourceMetadataFile.startsWith('sites/')||!p.sourceTextFile.startsWith('sites/')
        ||p.sourceMetadataFile.replace(/\/meta\.json$/,'')!==p.sourceTextFile.replace(/\/text\.md$/,'')
        ||pageUrls.has(p.originalUrl))
        throw new Error('Unverified/invalid issue-page path or archive provenance');
      if(p.kind==='homepage'||p.kind==='homepage_issues')homepageCount++;
      else issuePathCount++;
      // A text mention of 2024 in a page crawled in 2026 is NOT evidence that
      // its page text or candidate positions existed in 2024.
      if(!Array.isArray(p.sourceMetadataMentionsYears)||p.sourceMetadataMentionsYears.some(y=>!/^\d{4}$/.test(y)))
        throw new Error('Unexpected crawl text year metadata');
      pageUrls.add(p.originalUrl);
    }
    if(homepageCount!==1)throw new Error('Exactly one later-snapshot homepage required');
  }
  if(issuePathCount!==4)throw new Error('Unexpected issue page URL discovery denominator');
}
export function planCampaignArchiveSourceRecovery(
  manifest: CampaignPageLeadManifest,
  winners: SenateSosSeedManifest,
  providedIndexRows: readonly OfflineCdxResult[] = [],
) {
  validateManifest(manifest,winners);
  const requests:ArchiveRequest[]=[];
  for(const c of manifest.candidates){
    const publisherRoot=winners.websiteLeads.find(l=>l.electionYear===c.electionYear
      &&l.candidateName===c.candidateName&&l.district===c.district)!.url;
    const root=c.pages.find(p=>p.kind==='homepage'||p.kind==='homepage_issues')?.originalUrl??publisherRoot;
    const originalUrls=[
      {queryKind:'site_prefix' as const,originalUrl:root,sourcePageKind:null},
      {queryKind:'homepage_exact' as const,originalUrl:root,sourcePageKind:'homepage' as PageKind},
      ...c.pages.filter(p=>!['homepage','homepage_issues'].includes(p.kind))
        .map(p=>({queryKind:'issue_exact' as const,originalUrl:p.originalUrl,sourcePageKind:p.kind})),
    ];
    for(const row of originalUrls){
      const id='q'+String(requests.length+1).padStart(2,'0');
      const to=earlierDay(c.generalElectionOn);
      requests.push({
        id,candidateName:c.candidateName,campaignHost:c.campaignHost,electionYear:c.electionYear,
        primaryElectionOn:c.primaryElectionOn,generalElectionOn:c.generalElectionOn,
        queryKind:row.queryKind,originalUrl:row.originalUrl,sourcePageKind:row.sourcePageKind,
        requestedFrom:'20240101',requestedTo:to,requestedLimit:400,
        cdxApiUrl:cdxUrl(row.originalUrl,row.queryKind,to),
        originalPageBytesAlreadyAuthenticated:false,indexResultsAreStatementProof:false,
      });
    }
  }
  const reqById=new Map(requests.map(r=>[r.id,r]));
  const responseIds=new Set<string>();
  const perCandidateCaptures=new Map<string,WaybackCapture[]>();
  const queryAudit:Array<{
    id:string; status:'failed'|'complete'; indexRows:number;
    preGeneralRows:number; prePrimaryRows:number;
    captureLimitMayHaveTruncated:boolean; originalResponseBytesAuthenticated:false;
  }>=[];
  for(const result of providedIndexRows){
    const requested=reqById.get(result.queryId);
    if(!requested||responseIds.has(result.queryId))throw new Error('Unknown/duplicate CDX input request');
    responseIds.add(result.queryId);
    if(result.sourceResponseBytesAuthenticated!==false)
      throw new Error('CDX response authentication cannot be self-attested');
    if(result.status==='failed'){
      if(result.rows!==null)throw new Error('Failed CDX query must have null response');
      queryAudit.push({id:result.queryId,status:'failed',indexRows:0,preGeneralRows:0,prePrimaryRows:0,
        captureLimitMayHaveTruncated:false,originalResponseBytesAuthenticated:false});
      continue;
    }
    if(result.status!=='complete'||!Array.isArray(result.rows)
      ||result.rows.length>2001)throw new Error('Invalid bounded offline CDX response');
    // Existing parser discards non-200 and non-HTML without promoting text.
    const captures=parseWaybackCdxJson(result.rows);
    const allBefore:WaybackCapture[]=[];
    let prePrimaryRows=0;
    for(const capture of captures){
      if(normHost(capture.original)!==requested.campaignHost)throw new Error('Cross-candidate CDX original host');
      if(requested.queryKind!=='site_prefix'&&!exactPageMatch(capture.original,requested.originalUrl))
        throw new Error('CDX original URL not in exact-source request');
      const at=strictTimestamp(capture.timestamp);
      const general=cutoffDate(requested.generalElectionOn);
      if(at>=general)continue; // Same-day NEVER counted, even when index includes it.
      if(at<cutoffDate('2024-01-01'))continue;
      if(at<cutoffDate(requested.primaryElectionOn))prePrimaryRows++;
      allBefore.push(capture);
    }
    const seen=perCandidateCaptures.get(requested.campaignHost)??[];
    seen.push(...allBefore);
    perCandidateCaptures.set(requested.campaignHost,seen);
    queryAudit.push({id:result.queryId,status:'complete',indexRows:captures.length,
      preGeneralRows:allBefore.length,prePrimaryRows,
      captureLimitMayHaveTruncated:result.rows.length-1>=requested.requestedLimit,
      originalResponseBytesAuthenticated:false});
  }
  const candidateSummaries=manifest.candidates.map(c=>{
    const raw=perCandidateCaptures.get(c.campaignHost)??[];
    const unique=new Map(raw.map(x=>[x.archiveUrl,x]));
    const snapshots=[...unique.values()].sort((a,b)=>a.timestamp.localeCompare(b.timestamp)||a.original.localeCompare(b.original));
    const selection=planWaybackCampaignVersionCaptures(snapshots,{maxCaptures:40});
    const policyUrls=new Set(c.pages.filter(p=>!p.kind.startsWith('homepage')).map(p=>new URL(p.originalUrl).pathname.replace(/\/$/,'')));
    const policyCandidates=snapshots.filter(s=>policyUrls.has(new URL(s.original).pathname.replace(/\/$/,'')));
    const primary=cutoffDate(c.primaryElectionOn);
    const queryResults=queryAudit.filter(q=>requests.find(r=>r.id===q.id)?.campaignHost===c.campaignHost);
    return {
      candidateName:c.candidateName,district:c.district,electionYear:c.electionYear,
      electionDay:c.generalElectionOn,primaryDay:c.primaryElectionOn,
      sourceLaterResearchPagePaths:c.pages.length,
      exactIssuePageUrls:c.pages.filter(p=>!p.kind.startsWith('homepage')).map(p=>p.originalUrl),
      requestedQueries:requests.filter(r=>r.campaignHost===c.campaignHost).length,
      queriedCompleted:queryResults.filter(r=>r.status==='complete').length,
      queriedFailed:queryResults.filter(r=>r.status==='failed').length,
      unqueried:requests.filter(r=>r.campaignHost===c.campaignHost).length-queryResults.length,
      indexRowsStrictlyBeforeGeneral:snapshots.length,
      indexRowsStrictlyBeforePrimary:snapshots.filter(s=>strictTimestamp(s.timestamp)<primary).length,
      indexedPolicyUrlCandidatesStrictlyBeforeGeneral:policyCandidates.length,
      earliestIndexClaimedGeneralCapture:snapshots[0]?.capturedAt??null,
      earliestIndexClaimedPolicyCapture:policyCandidates[0]?.capturedAt??null,
      versionsSelectedForFutureByteReview:selection.selectedCaptures.map(s=>({
        originalUrl:s.original,archiveUrl:s.archiveUrl,cdxDigest:s.digest,indexReportedCapturedAt:s.capturedAt,
        originalArchiveResponseBytesVerified:false,statementExcerptAuthenticated:false,
        historicalForecastEligible:false,
      })),
      distinctVersionsSkippedByPlanCap:selection.unselectedDistinctVersions,
      anyDiscoveryTruncated:queryResults.some(q=>q.captureLimitMayHaveTruncated),
      independentlyProvenPagePublicBy:null,
      campaignIssueStatementsVerified:0,
      completenessCertified:false,
    };
  });
  return {
    schema:CAMPAIGN_ARCHIVE_SOURCE_PLAN_VERSION,
    scope:{auditYears:[2024,2025],newVerifiedHistoricalCampaignIssueStatements:0,
      historicalCampaignPageBytesVerified:0,officialCampaignSiteDenominatorCertified:false,
      noProductionReads:true,noProductionWrites:true,doesNotFetchArchives:true,
      cdxAuthenticityIndependentlyVerified:false,postElectionSnapshotsExcluded:true},
    totals:{candidateDomains:manifest.candidates.length,
      laterCrawlDomainsWithPagePaths:manifest.candidates.filter(x=>x.pages.length>0).length,
      exactPolicyPageUrlLeads:manifest.candidates.reduce((n,c)=>n+c.pages.filter(p=>!p.kind.startsWith('homepage')).length,0),
      archiveRequests:requests.length,queriesExecutedByThisTool:0,
      providedOfflineCdxResponses:providedIndexRows.length,
      candidatesWithAnyIndexCapture: candidateSummaries.filter(c=>c.indexRowsStrictlyBeforeGeneral>0).length,
      independentlyVerifiedPreVoteIssueStatements:0},
    laterCrawlCommit:manifest.laterResearchSnapshot.immutableCommit,
    laterCrawlCommitDate:manifest.laterResearchSnapshot.githubCommitCommitterDate,
    queries:requests,queryAudit,candidates:candidateSummaries,
    warnings:[
      '2026 researcher crawl Git blobs are not a 2024/2025 website archive or publication-time proof.',
      'A CDX timestamp is index metadata: original archived response bytes, redirects, digest and candidate excerpt must be fetched and independently verified.',
      'No records in provided CDX results never establish absence elsewhere; missing files, blocked access and upstream limits remain unknown.',
      'The planned queries deliberately omit election-day captures and later pages for historical pre-vote comparisons.',
      'All six campaign domains are publisher-linked leads, not independently authenticated official historical filing-site assignments.',
      'Prioritize actual archived page text/attribution only after original captured bytes are obtained with hashes; do not alter forecasting.',
    ],
  };
}
