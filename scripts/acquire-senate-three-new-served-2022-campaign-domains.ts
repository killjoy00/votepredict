/**
 * #864: bounded ORIGINAL 2022 first-party campaign-page acquisition for three
 * separately verified actual Minnesota Senate members, not opponents.
 * No pre-election statement is claimed without actual original Wayback HTML
 * matched to an independent historical CDX source digest. Fail closed to
 * "archive unavailable" for 503/timeout, not "zero historical positions".
 * No database, historical feature, production or scheduled action.
 */
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import targets from '../data/evaluation/senate-three-new-served-person-2022-campaign-domains-v1.json' with {type:'json'};
import {
 validateActualSenateServiceForElection,type AuditedOfficialSenateDirectory,
} from '../src/evidence/senate-official-ever-served-directory.js';
import {originalCampaignVisibleText} from
 '../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
import {parseWaybackCdxJson,type WaybackCapture} from '../src/evidence/wayback.js';
import {
 fetchDatedBoundedPublic,base32Sha1Archive,type PublicReply,
} from './acquire-senate-2022-ever-served-campaign-originals.js';

export const THREE_NEW_SERVED_2022_SOURCE_ACQUISITION_VERSION=
 'senate-three-2022-original-served-candidate-campaign-domains-v1' as const;
const identities=[
 {id:'judy22',name:'Judy Seeberger',district:'41',domain:'judyforsenate.com'},
 {id:'bonnie22',name:'Bonnie Westlin',district:'42',domain:'bonniewestlinformnsenate.com'},
 {id:'steve22',name:'Steve Cwodzinski',district:'49',domain:'cwodforsenate.com'},
] as const;
type Person=typeof identities[number];
const starting='2022-01-01T00:00:00.000Z',ending='2022-11-08T00:00:00.000Z';
const META_FIELDS=['timestamp','original','mimetype','statuscode','digest','length'];
function exactHost(original:string,domain:string){
 const url=new URL(original);
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password
   ||url.port||url.search||url.hash||url.pathname.length>400
   ||url.hostname.replace(/^www\./,'').toLowerCase()!==domain)
  throw Error('Original historical archive indexed URL is not the approved 2022 senator campaign domain');
 return url;
}
export function verifyThreeActualServed2022Candidates(official:AuditedOfficialSenateDirectory){
 if(targets.schema!=='senate-2022-three-original-campaign-domain-recovery-served-persons-v1'
   ||targets.issue!==864||targets.historicalWindow.sourceIndexRowsPerDomainMaximum!==300
   ||targets.historicalWindow.originalReplayPerPersonMaximum!==3
   ||targets.historicalWindow.afterInclusive!==starting
   ||targets.historicalWindow.beforeExclusive!==ending
   ||targets.officialSenatorSource.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
   ||targets.officialSenatorSource.originalRunId!==38094976711
   ||targets.officialSenatorSource.originalArtifactId!==11685387674
   ||targets.rules.onlyIndependentlyActuallyServedSenators!==true
   ||targets.rules.archiveIndexWithoutMatchingOriginalHtmlDoesNotProveHistoricWords!==true
   ||targets.rules.noSourceAdmissionForecastDatabaseProductionOrModelChanges!==true
   ||targets.rules.unavailableArchiveNotCountedAsZero!==true
   ||targets.targets.length!==3)
  throw Error('Wrong bounded public 2022 campaign original-source targets');
 const result=[];
 for(let i=0;i<3;i++){
  const expected=identities[i],site=targets.targets[i];
  if(site.id!==expected.id||site.person!==expected.name
    ||site.district!==expected.district||site.year!==2022
    ||site.domain!==expected.domain
    ||site.currentlyDiscoveredCampaignHostNotVerifiedFiledSite!==true
    ||site.modernUrlLeads.length!==2
    ||site.modernUrlLeads.some(u=>{try{return exactHost(u,expected.domain)===false;}catch{return true;}}))
   throw Error('Unverified candidate identity or mutable current site URL assigned to 2022');
  const person=validateActualSenateServiceForElection(
   official,expected.name,expected.district,2022);
  if(person.status!=='verified_senate_service'
    ||person.serviceForThisElectionFollowingYearVerified!==true
    ||!person.officialName||!person.term)
   throw Error('Every 2022 first-party campaign domain must belong to an independently actually served Senator');
  result.push({...site,officialLRLServedName:person.officialName,
   officialLRLSenateServiceTerm:person.term});
 }
 return result;
}
export function originalSenator2022DomainIndexUrl(domain:string){
 if(!identities.some(x=>x.domain===domain))
  throw Error('Unknown or candidate-nonserving Senate domain blocked');
 const p=new URLSearchParams({
  url:domain,matchType:'domain',from:'20220101',to:'20221107',output:'json',
  fl:META_FIELDS.join(','),filter:'statuscode:200',limit:'300',
 });
 return 'https://web.archive.org/cdx/search/cdx?'+p.toString();
}
function priority(path:string){
 const p=path.toLowerCase().replace(/\/+$/,'');
 if(/^\/(?:issue|issues|platform|policy|policies|priority|priorities|vision|legislative-issues)$/.test(p))
  return 0;
 if(!p||p==='/')return 1;
 if(/^\/(?:about|meet|judy|our-campaign|announcement)$/.test(p))return 2;
 if(/\/(?:issues|priorities|platform|vision)(?:\/|$)/.test(p))return 3;
 return 5;
}
export function parseThreeActualSenator2022DomainIndex(
 payload:unknown,domain:string,
){
 if(!identities.some(x=>x.domain===domain))throw Error('Unapproved 2022 campaign domain');
 if(Array.isArray(payload)&&payload.length===0)
  return{found:[] as WaybackCapture[],rows:0,sampleAtCapacity:false,validEmpty:true};
 if(!Array.isArray(payload)||payload.length<1
    ||!Array.isArray(payload[0])||payload.length>301)
  throw Error('Missing or unbounded 2022 candidate-owned historical CDX matrix');
 const head=payload[0].map(String);
 if(META_FIELDS.some(f=>!head.includes(f)))
  throw Error('Historical Senate campaign original CDX column layout incomplete');
 const result:WaybackCapture[]=[],used=new Set<string>();
 for(const row of parseWaybackCdxJson(payload)){
  let url:URL;
  try{url=exactHost(row.original,domain);}catch{continue;}
  const path=url.pathname.toLowerCase();
  if(row.capturedAt<starting||row.capturedAt>=ending
    ||!/^[A-Z2-7]{32}$/.test(row.digest)||row.statuscode!=='200'
    ||/\.(?:css|js|jpg|jpeg|png|webp|gif|ico|svg|woff2?|pdf|zip)$/.test(path)
    ||/^\/(?:wp-admin|wp-includes|admin|login|api|event-details)\//.test(path)
    ||path.length>160)
   continue;
  const key=row.timestamp+'|'+url.href+'|'+row.digest;
  if(used.has(key))continue;
  used.add(key);result.push(row);
 }
 result.sort((a,b)=>priority(new URL(a.original).pathname)-priority(new URL(b.original).pathname)
   ||a.capturedAt.localeCompare(b.capturedAt));
 return{found:result,rows:payload.length-1,sampleAtCapacity:payload.length===301,validEmpty:false};
}
export function chooseSourcePageVersionCandidates(rows:WaybackCapture[]){
 const saved:WaybackCapture[]=[],uniquePath=new Set<string>(),uniqueDigest=new Set<string>();
 for(const row of rows){
  const url=new URL(row.original);
  const path=url.pathname.toLowerCase().replace(/\/+$/,'')||'/';
  if(uniquePath.has(path))continue;
  const key=row.digest+'|'+path;
  if(uniqueDigest.has(key))continue;
  uniquePath.add(path);uniqueDigest.add(key);
  saved.push(row);
  if(saved.length===3)break;
 }
 if(saved.length<3){
  for(const row of rows.slice().reverse()){
   if(saved.length>=3)break;
   if(saved.some(s=>s.timestamp===row.timestamp&&s.original===row.original))
    continue;
   if(saved.some(s=>s.digest===row.digest))continue;
   saved.push(row);
  }
 }
 return saved;
}
function writeOriginal(directory:string,file:string,body:Buffer|null){
 if(!body||!body.length)return null;
 if(!/^[a-z0-9._-]{1,120}$/.test(file)||file.includes('..'))
  throw Error('Unbounded/nonliteral historic original source filename');
 writeFileSync(join(directory,file),body,{flag:'wx',mode:0o600});
 return file;
}
function noBody(data:PublicReply){const {body,...meta}=data;return meta;}
/** Real original archived source acquisition. No historical stances emitted:
 * this is only a proof-and-original-source discovery run for later review.
 */
export async function acquireThree2022ActuallyServedCampaignDomains(
 outputDir:string,official:AuditedOfficialSenateDirectory,impl:typeof fetch=fetch,
){
 const people=verifyThreeActualServed2022Candidates(official);
 const directory=resolve(outputDir);
 if(existsSync(directory))throw Error('Original source folder already exists: refuse to overwrite');
 mkdirSync(directory,{recursive:true,mode:0o700});
 const reports=[];
 for(const person of people){
  const url=originalSenator2022DomainIndexUrl(person.domain);
  const response=await fetchDatedBoundedPublic(url,1_500_000,impl);
  let parsed:ReturnType<typeof parseThreeActualSenator2022DomainIndex>|null=null;
  let parseError:string|null=null;
  const indexFile=writeOriginal(directory,person.id+'-2022-original-cdx.json',
   response.status===200?response.body:null);
  if(response.status===200&&response.body){
   try{parsed=parseThreeActualSenator2022DomainIndex(
    JSON.parse(response.body.toString('utf8')) as unknown,person.domain);
   }catch(e){parseError=e instanceof Error?e.message:'unrecognized historical archive index';}
  }
  const chosen=parsed?chooseSourcePageVersionCandidates(parsed.found):[];
  const replays=[];
  for(const [i,page] of chosen.entries()){
   const r=await fetchDatedBoundedPublic(page.archiveUrl,2_500_000,impl);
   const valid=Boolean(r.status===200&&r.body&&
    base32Sha1Archive(r.body)===page.digest
    &&/^(?:text\/html|text\/plain|application\/xhtml\+xml)/i.test(r.headers.contentType??''));
   const text=valid&&r.body?originalCampaignVisibleText(r.body):'';
   const actuallyCampaignIdentified=Boolean(text.toLowerCase().includes(
    person.person.toLowerCase())&&/senat/i.test(text));
   const file=writeOriginal(directory,person.id+'-original-'+page.timestamp+'-'+i+'.html',
    valid?r.body:null);
   replays.push({
    originalCampaignUrl:page.original,archiveCapturedAtUtc:page.capturedAt,
    originalWaybackCdxDigestSha1Base32:page.digest,
    archiveReplayUrl:page.archiveUrl,
    originalHttp:noBody(r),originalHtmlFile:file,
    originalHtmlSourceSha256:valid?r.responseBodySha256:null,
    independentActualArchivedHtmlEqualsOriginalCdxDigest:valid,
    originalPageIncludesSenatorCampaignIdentity:actuallyCampaignIdentified,
    candidateStatementOrIssueTextHumanReviewed:false,
    originalIssueExcerptHistoryCertified:0,
    sourceAuthorOriginalFirstPublishedAt:null,
    forecastEligible:false,
   });
  }
  const report={
   person:person.person,districtAt2022Election:person.district,
   officialLRLSenatorIdentity:person.officialLRLServedName,
   officialLRLServiceTerm:person.officialLRLSenateServiceTerm,
   officialSourceOriginalHtmlSha256:official.source.sourceBytesSha256,
   officialSourceActuallyObservedAtUtc:official.source.observedAt,
   currentSiteUrlDiscoveryLeadsNeverOriginalFiledCampaignProof:person.modernUrlLeads,
   campaignDomainHistoricallyFiledWithSOSProven:false,
   originalIndexQuery:url,indexResponse:noBody(response),indexFile,
   indexSuccessfullyParsed:Boolean(parsed),indexFailureReason:parseError??response.error,
   actualBoundedHistoricalHtmlIndexRows:parsed?.found.length??null,
   sampledIndexAtCapacity:parsed?.sampleAtCapacity??null,
   unavailableHistoricalIndexIsNotProofOfNoPosition:true,
   replays,
  };
  reports.push(report);
  console.log('SENATE-2022-ORIGINAL-SITE '+JSON.stringify({
   senator:person.person,district:person.district,
   indexHttp:response.status,originalIndexEligibleRows:report.actualBoundedHistoricalHtmlIndexRows,
   replayedOriginalPages:replays.length,
   originalHtmlDigestMatched:replays.filter(x=>x.independentActualArchivedHtmlEqualsOriginalCdxDigest).length,
   unknownOriginalPolicyText:true,
  }));
 }
 const matched=reports.flatMap(p=>p.replays)
  .filter(x=>x.independentActualArchivedHtmlEqualsOriginalCdxDigest);
 const manifest={
  schema:THREE_NEW_SERVED_2022_SOURCE_ACQUISITION_VERSION,
  observedAfterStartAtUtc:new Date().toISOString(),
  sourceOriginalActualLRLHtmlSha256:official.source.sourceBytesSha256,
  sourceActualSenateLRLObservedAtUtc:official.source.observedAt,
  totals:{
   onlyOfficialActuallyServedSenatorsExamined:reports.length,
   originalDomainIndexQueriesMade:reports.length,
   originalIndexHttp200Count:reports.filter(x=>x.indexResponse.status===200).length,
   originalIndexParsedCount:reports.filter(x=>x.indexSuccessfullyParsed).length,
   archivedOriginalPageReplaysAttempted:reports.reduce((n,p)=>n+p.replays.length,0),
   actualOriginalHtmlDigestAndCdxMatched:matched.length,
   additionalSenatorsWithIndependentOriginal2022PageCopies:
    new Set(reports.filter(p=>p.replays.some(x=>
     x.independentActualArchivedHtmlEqualsOriginalCdxDigest
     &&x.originalPageIncludesSenatorCampaignIdentity)).map(p=>p.person)).size,
   candidateIssueExcerptPositionRowsPromoted:0,
   productionModelOrDbWrites:0,
  },
  controls:{
   everyPersonIndependentlyVerifiedToHaveServedSenate:true,
   original2022SosFiledCandidateWebsiteFieldVerified:false,
   exactQuotePublicByRequiresSeparateHumanExcerptVerification:true,
   pageIndexLimitsCanOmitOtherCampaignPages:true,
   originalCaptureDoesNotEstablishFirstSitePublicationDate:true,
   failedArchiveQueryMeansUnknownNotZeroPages:true,
   noProductionChanges:true,
  },
  senators:reports,
 };
 writeOriginal(directory,'acquisition-manifest.json',
  Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
 return manifest;
}
