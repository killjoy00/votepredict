/**
 * #864: one-shot original 2020 campaign site archival recovery,
 * three independently actually-served MN Senate people, not just ballot filers.
 *
 * A real Wayback CDX row is only an index lead. No original 2022 page copy
 * or policy stance is accepted unless its downloaded original HTML matches
 * the *independently retrieved* CDX payload SHA-1 digest. A current website
 * is strictly a discovery lead. Exact author-first-posted date stays UNKNOWN.
 *
 * No private infrastructure, Neon/Vercel, email, scheduler, serving, models,
 * production evidence, votes, forecasts or contacting government offices.
 */
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import leads from '../data/evaluation/senate-three-former-serving-2020-original-campaign-domain-targets-v1.json' with {type:'json'};
import {parseWaybackCdxJson,type WaybackCapture} from '../src/evidence/wayback.js';
import {originalCampaignVisibleText} from
 '../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
import {validateActualSenateServiceForElection,type AuditedOfficialSenateDirectory}
 from '../src/evidence/senate-official-ever-served-directory.js';
import {
 base32Sha1Archive,fetchDatedBoundedPublic,type PublicReply,
} from './acquire-senate-2022-ever-served-campaign-originals.js';

export const THREE_2021_ACTUAL_SENATORS_2020_ORIGINAL_CAMPAIGN_ACQUISITION =
 'mn-three-actually-2021-serving-senators-2020-genuine-campaign-originals-v1' as const;

export const PINNED_THREE_ACTUAL_2021_SENATORS_2020_CAMPAIGN_HOSTS=[
 {name:'Susan Kent',district:'53',domain:'susankentmn.com'},
 {name:'Karla Bigham',district:'54',domain:'karlabigham.com'},
 {name:'David Tomassoni',district:'6',domain:'tomassoni4senate.com'},
] as const;
const FROM='2020-01-01T00:00:00.000Z',UNTIL='2020-11-03T00:00:00.000Z';
const CDX_FIELDS=['timestamp','original','mimetype','statuscode','digest','length'] as const;

function exactHost(url:string,domain:string):URL{
 const u=new URL(url);
 if(!['http:','https:'].includes(u.protocol)||u.username||u.password
   ||u.port||u.search||u.hash
   ||u.hostname.replace(/^www\./,'').toLowerCase()!==domain
   ||u.pathname.length>190)
   throw Error('Archive URL not from approved real serving senator campaign domain');
 return u;
}
export function verifyThreeActually2021Serving2020CandidateOriginalDomains(
 official:AuditedOfficialSenateDirectory,
){
 const s=leads.scope,g=leads.originalActualSenatorGovernmentDirectory;
 if(leads.schema!=='mn-three-2021-2022-served-mn-senators-2020-first-party-original-site-probes-v1'
  ||leads.issue!==864||s.campaignElectionYear!==2020
  ||s.electionDay!=='2020-11-03'
  ||s.originalCaptureFromUtc!==FROM||s.originalCaptureUntilExclusiveUtc!==UNTIL
  ||s.actuallyServedStateSenateIn2021Required!==true
  ||s.exactDistinctServingPeople!==3
  ||s.fullAuthenticatedLRLGovernmentOriginalRequiredBeforeNetwork!==true
  ||s.maxCDXRowsPerDomain!==300
  ||s.maxOriginalHTMLReplaysPerPerson!==4
  ||s.maxTotalOriginalHTMLReplays!==12
  ||s.originalCaptureUtcSufficesAsPubliclyAttributableDate!==true
  ||s.originalAuthorFirstPostingDateRequired!==false
  ||s.current2026WebsiteDoesNotDateHistoric2020Text!==true
  ||s.officialSOSFiledDomain2020NotAuthenticated!==true
  ||s.actualOriginalPolicyExcerptsAdmittedByDiscovery!==0
  ||s.productionDatabaseReadsWritesOrForecastChanges!==0
  ||g.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
  ||g.originalRun!==38094976711||g.artifactId!==11685387674
  ||g.htmlSHA256!=='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51'
  ||g.rehashedBeforeNetwork!==true
  ||official.source.sourceBytesSha256!==g.htmlSHA256
  ||leads.targets.length!==PINNED_THREE_ACTUAL_2021_SENATORS_2020_CAMPAIGN_HOSTS.length)
  throw Error('Original LRL State Senate 2021 service/person or 2020 source dates changed');
 const confirmed=[];
 for(const [i,expected] of PINNED_THREE_ACTUAL_2021_SENATORS_2020_CAMPAIGN_HOSTS.entries()){
  const p=leads.targets[i];
  if(!p||p.id!=='three20-'+String(i+1).padStart(2,'0')
   ||p.candidateName!==expected.name||p.electionDistrict!==expected.district
   ||p.year!==2020||p.domain!==expected.domain
   ||p.actuallyServed2021PersonVerifiedOnOriginalGovernmentSourceRequired!==true
   ||p.historic2020OriginalWebsiteTextUnverifiedBeforeNetwork!==true
   ||p.firstWriterPostedAtUnknownAndNotRequired!==true
   ||p.contemporaneous2020SOSFiledCampaignWebsiteUnknown!==true
   ||!p.discoveryUrl||!p.discoveryBasis||!p.discoverySourceUrl)
   throw Error('Original 2020 candidate campaign source person/scope changed');
  exactHost(p.discoveryUrl,expected.domain);
  const served=validateActualSenateServiceForElection(
   official,expected.name,expected.district,2020);
  if(served.status!=='verified_senate_service'
   ||served.serviceForThisElectionFollowingYearVerified!==true
   ||!served.officialName||!served.officialServiceSource||!served.term)
   throw Error('Not a PERSON that actually served Minnesota Senate in 2021: '+expected.name);
  confirmed.push({...p,verifiedLRLSenatorName:served.officialName,
   officialVerifiedTerm:served.term,officialServiceSourceUrl:served.officialServiceSource});
 }
 if(new Set(confirmed.map(p=>p.verifiedLRLSenatorName)).size!==3)
  throw Error('Three 2021 actual MN Senator people not distinct');
 return confirmed;
}
export function three2021Senators2020OriginalCandidateCDXUrl(domain:string){
 if(!PINNED_THREE_ACTUAL_2021_SENATORS_2020_CAMPAIGN_HOSTS.some(x=>x.domain===domain))
  throw Error('Unknown / never verified served 2022 Senate candidate domain');
 const q=new URLSearchParams({
  url:domain,matchType:'domain',output:'json',
  fl:CDX_FIELDS.join(','),filter:'statuscode:200',
  from:'20200101',to:'20201102',limit:'300',
 });
 return 'https://web.archive.org/cdx/search/cdx?'+q.toString();
}
function rankSourcePagePath(path:string):number{
 const p=path.toLowerCase().replace(/\/+$/,'')||'/';
 if(/^\/(?:issues?(?:-[a-z0-9]+)?|priorities(?:-[a-z0-9]+)?|platform(?:-[a-z0-9]+)?|polic(?:y|ies)|vision|legislative-issues|positions|our-issues|our-priorities)(?:\.html?)?$/.test(p))return 0;
 if(/\/(?:issues?|priorities|platform|polic(?:y|ies)|vision|our-issues)\/[a-z0-9_-]+$/.test(p))return 1;
 if(p==='/')return 2;
 if(/^\/(?:about|meet|bio|our-campaign|campaign|news|news-events|why-im-running|why-i-am-running)$/.test(p))return 3;
 if(/\/(?:agenda|about|priorities|issues|policy|campaign|platform)/.test(p))return 4;
 return 8;
}
export function parseThree2021Senators2020OriginalCDX(
 payload:unknown,domain:string,
){
 if(!PINNED_THREE_ACTUAL_2021_SENATORS_2020_CAMPAIGN_HOSTS.some(x=>x.domain===domain))
  throw Error('Unapproved candidate domain');
 if(Array.isArray(payload)&&payload.length===0)
  return{eligible:[] as WaybackCapture[],rawRows:0,indexAtCap:false,validEmpty:true};
 if(!Array.isArray(payload)||!payload.length
   ||!Array.isArray(payload[0])||payload.length>301)
  throw Error('Missing/unbounded candidate historical 2022 archive index matrix');
 const head=payload[0].map(String);
 if(CDX_FIELDS.some(k=>!head.includes(k)))
  throw Error('Missing historical original index required field');
 const unique=new Set<string>();
 const eligible:WaybackCapture[]=[];
 for(const c of parseWaybackCdxJson(payload)){
  let original:URL;
  try{original=exactHost(c.original,domain);}catch{continue;}
  if(c.capturedAt<FROM||c.capturedAt>=UNTIL
    ||c.statuscode!=='200'||!/^[A-Z2-7]{32}$/.test(c.digest)
    ||/\.(?:js|css|png|jpe?g|webp|gif|svg|ico|woff2?|pdf|mp4|zip|eot|txt|xml|json|map)(?:$|\/)/i.test(original.pathname)
    ||/^\/(?:wp-admin|wp-includes|wp-json|wp-content|admin|cart|checkout|login|assets|plugins|_author)(?:\/|$)/i.test(original.pathname)
    ||/\/(?:embed|donate|contact|volunteer|endorsements|subscribe)(?:\/|$)/i.test(original.pathname))
   continue;
  const id=c.original+'|'+c.timestamp+'|'+c.digest;
  if(unique.has(id))continue;
  unique.add(id);eligible.push(c);
 }
 eligible.sort((a,b)=>
  rankSourcePagePath(new URL(a.original).pathname)-
    rankSourcePagePath(new URL(b.original).pathname)
  ||a.capturedAt.localeCompare(b.capturedAt));
 return{
  eligible,rawRows:payload.length-1,
  indexAtCap:payload.length===301,validEmpty:false,
 };
}
export function chooseFourOriginalPagesPer2021ServingSenator2020Candidate(
 captures:WaybackCapture[],
){
 const chosen:WaybackCapture[]=[];
 const paths=new Set<string>();
 for(const c of captures){
  const path=new URL(c.original).pathname.toLowerCase().replace(/\/+$/,'')||'/';
  if(paths.has(path))continue;
  paths.add(path);chosen.push(c);
  if(chosen.length>=4)return chosen;
 }
 for(const c of captures.slice().reverse()){
  if(chosen.length>=4)break;
  if(chosen.some(x=>x.original===c.original&&x.timestamp===c.timestamp)
    ||chosen.some(x=>x.digest===c.digest))continue;
  chosen.push(c);
 }
 return chosen;
}
function safeWrite(folder:string,name:string,body:Buffer|null){
 if(!body||!body.byteLength)return null;
 if(!/^[a-z0-9._-]{1,120}$/.test(name)||name.includes('..'))
  throw Error('Unsafe filename for immutable original public source');
 writeFileSync(join(folder,name),body,{flag:'wx',mode:0o600});
 return name;
}
function metadata(x:PublicReply){const {body,...copy}=x;return copy;}
export async function acquire2020OriginalCampaignSitesForThree2021ServingSenators(
 outputDir:string,official:AuditedOfficialSenateDirectory,
 network:typeof fetch=fetch,
){
 // Verify the ENTIRE actual member cohort before even the first web request.
 const targets=verifyThreeActually2021Serving2020CandidateOriginalDomains(official);
 const output=resolve(outputDir);
 if(existsSync(output))throw Error('Original campaign evidence directory already exists');
 mkdirSync(output,{recursive:true,mode:0o700});
 const records=[];
 for(const [personIndex,p] of targets.entries()){
  const indexUrl=three2021Senators2020OriginalCandidateCDXUrl(p.domain);
  const indexReply=await fetchDatedBoundedPublic(indexUrl,1_500_000,network);
  const rawIndexFile=safeWrite(
   output,p.id+'-real-2022-cdx-source.json',
   indexReply.status===200?indexReply.body:null);
  let index:ReturnType<typeof parseThree2021Senators2020OriginalCDX>|null=null;
  let error:string|null=null;
  if(indexReply.status===200&&indexReply.body){
   try{index=parseThree2021Senators2020OriginalCDX(
    JSON.parse(indexReply.body.toString('utf8')) as unknown,p.domain);}
   catch(e){error=e instanceof Error?e.message:'unknown/invalid archived 2022 index format';}
  }
  const chosen=index?chooseFourOriginalPagesPer2021ServingSenator2020Candidate(index.eligible):[];
  const originalPageChecks=[];
  for(const [i,c] of chosen.entries()){
   const replay=await fetchDatedBoundedPublic(c.archiveUrl,2_500_000,network);
   const authentic=Boolean(replay.status===200&&replay.body
    &&base32Sha1Archive(replay.body)===c.digest
    &&/^(?:text\/html|text\/plain|application\/xhtml\+xml)(?:;|$)/i.test(
     replay.headers.contentType??''));
   const htmlText=authentic&&replay.body?
    originalCampaignVisibleText(replay.body):'';
   const personTokens=p.candidateName.toLowerCase().split(/\s+/)
    .filter(w=>w.length>3);
   const hasCandidateIdentity=personTokens.length>=2
    &&personTokens.slice(-1).some(last=>
     htmlText.toLowerCase().includes(last));
   const pageFile=safeWrite(output,
    p.id+'-archive-'+c.timestamp+'-'+String(i)+'.html',
    authentic?replay.body:null);
   originalPageChecks.push({
    originalUrl:c.original,
    historicalArchiveCaptureUtc:c.capturedAt,
    archiveOriginalReplayUrl:c.archiveUrl,
    independentlyObtainedOriginalCDXSha1Base32:c.digest,
    originalPageFile:pageFile,
    originalBodySha256:authentic?replay.responseBodySha256:null,
    originalHtmlExactlyMatchesHistoricalCDXDigest:authentic,
    originalHtmlContainsSenatorSurname:authentic?hasCandidateIdentity:null,
    htmlVisibleBytesReproducedInThisRun:authentic,
    archivedResponse:metadata(replay),
    campaignCycleOfPageTextHumanReviewed:false,
    exactCandidateIssueQuoteHumanReviewed:false,
    firstAuthorPostedAtUtc:null,
    historicalForecastFeatureEligible:false,
   });
  }
  const item={
   candidate:p.candidateName,electionDistrict:p.electionDistrict,
   historicalElectionYear:2020,
   independentlyActualSenateLRLName:p.verifiedLRLSenatorName,
   independentlyVerifiedFollowingSenateServiceTerm:p.officialVerifiedTerm,
   originalGovernmentServiceSource:p.officialServiceSourceUrl,
   originalGovernmentServiceHtmlSha256:official.source.sourceBytesSha256,
   originalGovernmentDirectoryActuallyObservedAtUtc:official.source.observedAt,
   candidateDomain:p.domain,
   modernOrExternalDiscoveryLink:p.discoveryUrl,
   historicalCampaignSOSFiledWebsiteFieldProven:false,
   exactOriginalArchiveDomainIndexQuery:indexUrl,
   originalArchiveIndexSource:metadata(indexReply),
   downloadedOriginalIndexFile:rawIndexFile,
   originalArchiveIndexValid:Boolean(index),
   originalArchiveIndexError:error??indexReply.error,
   historical200HtmlIndexRowsInBoundedSample:index?.eligible.length??null,
   indexReached300RowLimit:index?.indexAtCap??null,
   archivedOriginalPageChecks:originalPageChecks,
   noOriginal2022PageOrPositionConclusionDrawnFromAnyEmptyOrFailedRequest:true,
  };
  records.push(item);
  console.log('THREE-SERVING-2021-SENATOR-2020-ORIGINAL '+JSON.stringify({
   member:p.candidateName,district:p.electionDistrict,
   indexStatus:indexReply.status,
   indexCount:item.historical200HtmlIndexRowsInBoundedSample,
   capped:item.indexReached300RowLimit,
   archivedOriginalHtmlFetched:originalPageChecks.length,
   authenticatedSourcePages:originalPageChecks.filter(x=>
    x.originalHtmlExactlyMatchesHistoricalCDXDigest).length,
   originalArchiveQueryFailed:index===null,
   originalIssuePositionCountAutomaticallyAdmitted:0,
  }));
 }
 const checked=records.flatMap(x=>x.archivedOriginalPageChecks);
 const matched=checked.filter(x=>x.originalHtmlExactlyMatchesHistoricalCDXDigest);
 const manifest={
  schema:THREE_2021_ACTUAL_SENATORS_2020_ORIGINAL_CAMPAIGN_ACQUISITION,
  acquiredOriginalSourcesUtc:new Date().toISOString(),
  actualOfficialLRLSenateServiceSource:{
   originalHtmlSha256:official.source.sourceBytesSha256,
   actuallyObservedAtUtc:official.source.observedAt,
   verifiedOnlyPeopleWhoServedSenate:true,
  },
  bounds:{
   exactThreeActual2021ServingSenators2020OriginalDomains:true,
   year2020CutoffExclusive:UNTIL,
   perDomainHistoricalIndexRowMaximum:300,
   perDomainActualArchivedHtmlReplayMaximum:4,
   totalOriginalArchivedHtmlReplayMaximum:12,
   current2026WebsitesAreDiscoveryLeadsOnly:true,
   sourceAuthorFirstPublishedDateUnknown:true,
   original2020Or2022SOSFiledCampaignWebsiteFieldCertified:false,
   indexCappedOrUnavailableDoesNotProveNoHistoricalPolicy:true,
   statementAttributionRequiresSeparateCandidateCycleAndQuoteAudit:true,
   networkAllowedOnlyPublicWaybackOriginalArchives:true,
   noProductionNeonVercelDatabaseEvidenceTrainingForecastOrSchedulerChange:true,
  },
  totals:{
   verifiedActuallyServedSenatorPeople:records.length,
   domainOriginalArchiveIndexQueries:records.length,
   indexHTTP200:records.filter(x=>x.originalArchiveIndexSource.status===200).length,
   indexSuccessfullyParsed:records.filter(x=>x.originalArchiveIndexValid).length,
   originalHTMLPageReplaysAttempted:checked.length,
   originalHTMLBodiesVerifiedAgainstIndependentCDXSha1:matched.length,
   distinctActualSenatePeopleWithAuthenticated2022Originals:
    new Set(records.filter(x=>x.archivedOriginalPageChecks.some(y=>
     y.originalHtmlExactlyMatchesHistoricalCDXDigest)).map(x=>x.candidate)).size,
   originalCandidateIssuePassagesActuallyReviewed:0,
   firstAuthorPostedDateProvenForAnyStatement:0,
   forecastSourcesAutomaticallyAdmitted:0,
   productionDatabaseReadsOrWrites:0,
  },
  candidates:records,
 };
 safeWrite(output,'source-acquisition-manifest.json',
  Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
 return manifest;
}
