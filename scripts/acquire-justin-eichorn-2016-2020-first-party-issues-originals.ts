/**
 * #864 bounded actual first-party original candidate /issues/ HTML recovery.
 * October 20 2020 publisher relayed Justin Eichorn's campaign issues and
 * explicitly linked https://www.justinformnsenate.com/issues. The two previous
 * authenticated 2020 source HTML pages are JavaScript-only shells. We do NOT
 * claim that publisher-relayed exact quotes are genuine original page HTML.
 *
 * Validate ENTIRE original LRL actual Senate membership and 2020 candidate
 * home original SHA/CDX BEFORE any network. Only Wayback archive, no live site.
 * No production evidence/database/model/forecasts/scheduling, ever.
 */
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import target from '../data/evaluation/senate-justin-eichorn-2016-2020-original-issues-historical-archive-target-v1.json' with {type:'json'};
import {parseWaybackCdxJson,type WaybackCapture} from '../src/evidence/wayback.js';
import {originalCampaignVisibleText,historicalArchiveSha1Base32}
 from '../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
import {validateActualSenateServiceForElection,type AuditedOfficialSenateDirectory}
 from '../src/evidence/senate-official-ever-served-directory.js';
import {fetchDatedBoundedPublic,type PublicReply}
 from './acquire-senate-2022-ever-served-campaign-originals.js';
export const EICHORN_HISTORICAL_FIRST_PARTY_ISSUES_ARCHIVE_VERSION=
 'mn-eichorn-original-2016-through-2020-issues-html-source-probe-v1' as const;
const GOV='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const HOME='e1cf0bad13e365607f802de2e881ad8f45773aea308b368fc3e1878e641b3424';
const CDXHOME='O5XRMF3E73RCZZMMUGUEMEVGLACMJJY4';
const FROM='2016-01-01T00:00:00.000Z',TO='2020-11-03T00:00:00.000Z';
const columns=['timestamp','original','mimetype','statuscode','digest','length'] as const;
const sha=(x:Uint8Array)=>createHash('sha256').update(x).digest('hex');
function fixedFirstPartyPage(url:string){
 const x=new URL(url);
 if(!['http:','https:'].includes(x.protocol)
  ||x.hostname.replace(/^www\./,'').toLowerCase()!=='justinformnsenate.com'
  ||!['/issues','/issues/'].includes(x.pathname)||x.port||x.username||x.password
  ||x.search||x.hash)
  throw Error('Unapproved historical first-party Justin Eichorn /issues original URL');
 return x;
}
export function verifyEichornFullOriginalSourcesBeforeArchiveNetwork(
 actualServed:AuditedOfficialSenateDirectory,original2020CandidateHome:Uint8Array,
){
 const p=target.source,s=target.scope,c=target.person;
 if(target.schema!=='mn-eichorn-2021-serving-2016-2020-first-party-issues-archive-target-v1'
  ||target.issue!==864||s.actual2021SenateServiceRequired!==true
  ||s.electionDistrict2020!=='5'||s.fromUtc!==FROM||s.toExclusiveUtc!==TO
  ||s.exactCandidateIssuesOriginalURLCount!==8
  ||s.maxCDXRowsPerQuery!==220||s.maxOriginalHTMLReplayAttempts!==8
  ||s.original2020HomeRehashedBeforeNetwork!==true
  ||s.originalGovActualSenatorDirectoryRehashedBeforeNetwork!==true
  ||s.publisher2020QuotationNotIdenticalWithOriginalSiteHTML!==true
  ||s.archivedJavascriptShellContainsNoPolicyText!==true
  ||s.sourceAcquisitionAddsPolicyStatements!==0
  ||s.productionDatabaseEvidenceModelForecastSchedulerChanges!==0
  ||p.officialSenateDirectory!=='https://www.lrl.mn.gov/legdb/senate_dir'
  ||p.officialDirectoryRun!==38094976711||p.officialDirectoryArtifact!==11685387674
  ||p.officialDirectorySHA256!==GOV
  ||p.original2020SiteAcquisitionRun!==38156756023
  ||p.original2020SiteArtifact!==11708239911
  ||p.original2020SiteArtifactName!=='senate-five-2021-serving-2020-original-candidate-html-v1'
  ||p.original2020HomeFile!=='five20-02-archive-20200520132938-0.html'
  ||p.original2020HomeURL!=='https://www.justinformnsenate.com/'
  ||p.original2020HomeCaptureUTC!=='2020-05-20T13:29:38.000Z'
  ||p.original2020HomeSHA256!==HOME||p.original2020HomeCDXSHA1!==CDXHOME
  ||p.datedPublisher!=='Minnesota Reformer'
  ||p.datedPublisherPublication!=='2020-10-20'
  ||p.datedPublisherLinkedFirstPartyIssues!=='https://www.justinformnsenate.com/issues'
  ||!p.datedPublisherArticleURL.startsWith('https://minnesotareformer.com/2020/10/20/')
  ||c.actualServingSenator!=='Justin Eichorn'||c.district2020!=='5'
  ||c.firstPartyDomain!=='justinformnsenate.com'
  ||c.historicalOriginalIssuesHTMLUnverified!==true
  ||actualServed.schema!=='mn-lrl-official-senate-ever-served-directory-v1'
  ||actualServed.source.url!==p.officialSenateDirectory
  ||actualServed.source.sourceBytesSha256!==GOV
  ||actualServed.source.directoryIsSenatorServiceNotCandidateFiling!==true
  ||actualServed.source.originalHistoricDateForDisplayedDirectoryEstablished!==false)
  throw Error('Actual Senate service, original HTML/CDX or exactly linked October 2020 campaign issues discovery altered');
 const expected=['http:','https:'].flatMap(scheme=>['','www.'].flatMap(sub=>
  ['/issues','/issues/'].map(path=>scheme+'//'+sub+'justinformnsenate.com'+path)));
 if(target.exactIssuesOriginalURLTargets.length!==8
  ||target.exactIssuesOriginalURLTargets.some((url,i)=>url!==expected[i]))
  throw Error('Eight fixed exact original candidate issue-page historical archive paths changed');
 const person=validateActualSenateServiceForElection(actualServed,c.actualServingSenator,c.district2020,2020);
 if(person.status!=='verified_senate_service'
  ||person.serviceForThisElectionFollowingYearVerified!==true
  ||!person.officialName||!person.term)
  throw Error('Eichorn is not independently documented actually-serving MN Senate 2021 SD5');
 if(original2020CandidateHome.length<1000||original2020CandidateHome.length>2_500_000
  ||sha(original2020CandidateHome)!==HOME
  ||historicalArchiveSha1Base32(original2020CandidateHome)!==CDXHOME)
  throw Error('Original 2020 Justin Eichorn first-party website complete SHA/CDX source absent');
 const original=Buffer.from(original2020CandidateHome).toString('utf8');
 if(!original.includes('ng-app="BuzzProviders"')||!original.includes('src="./app.js"'))
  throw Error('Previously authenticated 2020 first-party original JavaScript-only shell changed');
 return{officialSenatorName:person.officialName,officialServiceTerm:person.term,originalHomeSha256:HOME};
}
export function exactEichornOriginalIssuesCDXRequests(){
 return target.exactIssuesOriginalURLTargets.map(original=>{
  fixedFirstPartyPage(original);
  const q=new URLSearchParams({
   url:original,matchType:'exact',output:'json',fl:columns.join(','),
   filter:'statuscode:200',from:'20160101',to:'20201102',limit:'220',
  });
  return'https://web.archive.org/cdx/search/cdx?'+q.toString();
 });
}
export function parseExactEichornIssuesArchiveIndex(data:unknown){
 if(Array.isArray(data)&&data.length===0)
  return{eligible:[] as WaybackCapture[],indexRows:0,reachedCap:false};
 if(!Array.isArray(data)||data.length<1||data.length>221
  ||!Array.isArray(data[0])||columns.some(k=>!(data[0] as unknown[]).map(String).includes(k)))
  throw Error('Original bounded Eichorn issues CDX index missing or invalid');
 const seen=new Set<string>(),eligible:WaybackCapture[]=[];
 for(const row of parseWaybackCdxJson(data)){
  try{fixedFirstPartyPage(row.original);}catch{continue;}
  if(row.capturedAt<FROM||row.capturedAt>=TO||!/^[A-Z2-7]{32}$/.test(row.digest))
   continue;
  const id=row.original+'|'+row.timestamp+'|'+row.digest;
  if(seen.has(id))continue;
  seen.add(id);eligible.push(row);
 }
 eligible.sort((a,b)=>a.capturedAt.localeCompare(b.capturedAt));
 return{eligible,indexRows:data.length-1,reachedCap:data.length===221};
}
export function selectEichornOriginalIssuesPages(rows:ReadonlyArray<WaybackCapture>){
 const ordered=[...rows].sort((a,b)=>a.capturedAt.localeCompare(b.capturedAt));
 const selected:WaybackCapture[]=[],used=new Set<string>();
 const choose=(x:WaybackCapture|undefined)=>{
  if(!x||selected.length>=8)return;
  const k=x.timestamp+'|'+x.original+'|'+x.digest;
  if(!used.has(k)){used.add(k);selected.push(x);}
 };
 choose(ordered[0]);
 for(const year of ['2016','2017','2018','2019','2020']){
  choose(ordered.find(x=>x.capturedAt.startsWith(year)));
 }
 choose(ordered.at(Math.floor(ordered.length/2)));
 choose(ordered.at(-1));
 for(const x of ordered)choose(x);
 return selected;
}
function keep(dir:string,name:string,body:Buffer|null){
 if(!body?.length)return null;
 if(!/^[a-z0-9._-]{1,120}$/.test(name)||name.includes('..'))
  throw Error('Unsafe original first-party archive source output filename');
 writeFileSync(join(dir,name),body,{flag:'wx',mode:0o600});
 return name;
}
const receipt=(r:PublicReply)=>{const {body,...metadata}=r;return metadata;};
export async function acquireAuthenticEichornHistoricalOriginalIssuesPages(
 outputDir:string,actualSenators:AuditedOfficialSenateDirectory,
 original2020CandidateHome:Uint8Array,network:typeof fetch=fetch,
){
 const verified=verifyEichornFullOriginalSourcesBeforeArchiveNetwork(
  actualSenators,original2020CandidateHome);
 const output=resolve(outputDir);
 if(existsSync(output))throw Error('Immutable output original source directory already exists');
 mkdirSync(output,{recursive:true,mode:0o700});
 const indexes=[];
 const eligible:WaybackCapture[]=[];
 for(const [i,url] of exactEichornOriginalIssuesCDXRequests().entries()){
  const reply=await fetchDatedBoundedPublic(url,1_500_000,network);
  const f='eichornissue-index-'+String(i+1).padStart(2,'0')+'-original-cdx-2016-2020.json';
  const saved=keep(output,f,reply.status===200?reply.body:null);
  let parsed:ReturnType<typeof parseExactEichornIssuesArchiveIndex>|null=null,error:string|null=null;
  if(reply.status===200&&reply.body){
   try{parsed=parseExactEichornIssuesArchiveIndex(JSON.parse(reply.body.toString('utf8')) as unknown);}
   catch(e){error=e instanceof Error?e.message:'Invalid original bounded Wayback CDX source';}
  }
  if(parsed)eligible.push(...parsed.eligible);
  indexes.push({originalTarget:target.exactIssuesOriginalURLTargets[i],
   originalCDXSourceFile:saved,originalCDXRequestUrl:url,
   response:receipt(reply),indexValid:parsed!==null,
   authenticHTMLIndexRows:parsed?.eligible.length??null,
   indexReachedCap:parsed?.reachedCap??null,error:error??reply.error});
 }
 const unique=new Map<string,WaybackCapture>();
 for(const x of eligible)unique.set(x.original+'|'+x.timestamp+'|'+x.digest,x);
 const chosen=selectEichornOriginalIssuesPages([...unique.values()]);
 const replays=[];
 for(const [i,row] of chosen.entries()){
  const replay=await fetchDatedBoundedPublic(row.archiveUrl,2_500_000,network);
  const exact=Boolean(replay.status===200&&replay.body
    &&historicalArchiveSha1Base32(replay.body)===row.digest
    &&/^(?:text\/html|text\/plain|application\/xhtml\+xml)(?:;|$)/i.test(replay.headers.contentType??''));
  const visible=exact&&replay.body?originalCampaignVisibleText(replay.body):'';
  const file='eichornissue-original-'+row.timestamp+'-'+i+'.html';
  const preserved=keep(output,file,exact?replay.body:null);
  replays.push({originalURL:row.original,actualArchivedCaptureUTC:row.capturedAt,
   independentIndexedOriginalCDXSHA1:row.digest,originalHTMLPageFile:preserved,
   originalHTMLSHA256:exact?replay.responseBodySha256:null,
   originalHTMLBytesMatchIndexedCDXSHA1:exact,
   hasVisibleSenatorSurname:visible.toLowerCase().includes('eichorn'),
   renderedVisibleTextLength:visible.length,
   onlyJavascriptShellOrNoVisiblePolicyPossible:visible.length<200,
   archiveReply:receipt(replay),verifiedExactCandidateIssueStatements:0,
   authenticatedFirstPartyPolicyTextYet:false,productionEvidenceAdmitted:false});
 }
 const report={
  schema:EICHORN_HISTORICAL_FIRST_PARTY_ISSUES_ARCHIVE_VERSION,
  fullIndependentOriginalGovernmentLRLSenateDirectorySha256:actualSenators.source.sourceBytesSha256,
  actualSenatorIndependentlyVerified:verified.officialSenatorName,
  verifiedActual2021SenateServiceBeforeAnyArchiveRequest:true,
  original2020SiteFullHtmlSha256:verified.originalHomeSha256,
  external2020PublisherReporterRelayIsNotOriginalHtml:true,
  searchCaptureRangeUTC:{from:FROM,untilExclusive:TO},
  indices:indexes,originalArchiveCDXSourceQueries:indexes.length,
  independentlyParsedIndexCount:indexes.filter(x=>x.indexValid).length,
  distinctArchivedIndexCaptures:unique.size,
  selectedWholeOriginalHTMLReplays:chosen.length,
  fullOriginalHTMLBodiesVerifiedAgainstIndependentCDXSHA1:replays.filter(x=>x.originalHTMLBytesMatchIndexedCDXSHA1).length,
  originalHTMLPagesWithVisibleSenatorName:replays.filter(x=>x.originalHTMLBytesMatchIndexedCDXSHA1&&x.hasVisibleSenatorSurname).length,
  selectedOriginalPolicyExcerpts:0,productionDatabaseEvidenceModelForecastSchedulerChanges:0,
  sourceResultsDoNotProvePresenceOrAbsenceOfHistoricalPolicy:true,
  fullOriginalPageReplays:replays,
 };
 keep(output,'source-acquisition-manifest.json',Buffer.from(JSON.stringify(report,null,2)+'\n'));
 console.log('JUSTIN-EICHORN-PUBLIC-HISTORIC-ORIGINAL-ISSUES-SOURCE '+JSON.stringify({
  authenticSenator:report.actualSenatorIndependentlyVerified,
  cdxIndexes:report.originalArchiveCDXSourceQueries,
  validIndexes:report.independentlyParsedIndexCount,
  archivedIndexRows:report.distinctArchivedIndexCaptures,
  replayAttempts:report.selectedWholeOriginalHTMLReplays,
  genuineOriginalHTML:report.fullOriginalHTMLBodiesVerifiedAgainstIndependentCDXSHA1,
  visibleCandidateHTML:report.originalHTMLPagesWithVisibleSenatorName,
  newStatements:report.selectedOriginalPolicyExcerpts,
  productionChanges:report.productionDatabaseEvidenceModelForecastSchedulerChanges,
 }));
 return report;
}
