/**
 * #864 historic ORIGINAL campaign page source acquisition around the 2020
 * election for six independently actually serving MN senators (2021+).
 * Website source may have 2019/older carryover; no policy is inferred until
 * the exact first-party page's historical campaign cycle is reviewed.
 * No production, database, forecasts, scraping current sites or outreach.
 */
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import sites from '../data/evaluation/senate-six-served-2020-historical-original-campaign-domain-targets-v1.json' with {type:'json'};
import {parseWaybackCdxJson,type WaybackCapture} from '../src/evidence/wayback.js';
import {validateActualSenateServiceForElection,type AuditedOfficialSenateDirectory}
 from '../src/evidence/senate-official-ever-served-directory.js';
import {originalCampaignVisibleText} from '../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
import {fetchDatedBoundedPublic,base32Sha1Archive,type PublicReply}
 from './acquire-senate-2022-ever-served-campaign-originals.js';

export const ORIGINAL_2020_CAMPAIGN_SIX_REAL_SENATORS_VERSION=
 'mn-2020-six-actual-served-senators-original-campaign-sites-v1' as const;
export const FIXED_SIX_2020_SENATORS=[
 {name:'Mark Johnson',district:'1',domain:'markjohnsonmnsenate.com'},
 {name:'Jen McEwen',district:'7',domain:'votemcewen.com'},
 {name:'Aric Putnam',district:'14',domain:'aricformn.com'},
 {name:'Gary Dahms',district:'16',domain:'dahmsforsenate.com'},
 {name:'Mary Kunesh',district:'41',domain:'marykunesh.com'},
 {name:'Steve Cwodzinski',district:'48',domain:'cwodforsenate.com'},
] as const;
const BEGIN='2019-01-01T00:00:00.000Z';
const END='2020-11-03T00:00:00.000Z';
function safeOriginalUrl(url:string,domain:string){
 const u=new URL(url);
 if(!['http:','https:'].includes(u.protocol)||u.username||u.password
   ||u.port||u.search||u.hash||u.pathname.length>200
   ||u.hostname.replace(/^www\./,'').toLowerCase()!==domain)
  throw Error('Original archive page is not a fixed 2020 serving senator domain');
 return u;
}
export function verifyActualSixSenatorsFor2020OriginalCampaignArchive(
 official:AuditedOfficialSenateDirectory,
){
 if(sites.schema!=='senate-six-actually-served-2020-original-campaign-domains-v1'
   ||sites.issue!==864||sites.scope.electionYear!==2020
   ||sites.scope.electionDay!=='2020-11-03'
   ||sites.scope.fromInclusive!==BEGIN||sites.scope.toExclusive!==END
   ||sites.scope.verifiedEverActuallyServedSenatePeople!==6
   ||sites.scope.onlySenatorsWith2021ActualFollowingElectionSenateService!==true
   ||sites.scope.targetsCount!==6||sites.scope.domainArchiveIndexMaxRows!==300
   ||sites.scope.archivedOriginalHtmlPageReplaysPerCandidateMax!==4
   ||sites.scope.anyLrlIdentityMismatchPreventsAllNetworkFetches!==true
   ||sites.scope.campaignSitesCurrentlyKnownAreDiscoveryLeadsNotHistoricalFiledWebsites!==true
   ||sites.scope.noForecastOrProductionEvidenceActions!==true
   ||sites.provenance.originalLrlSenateDirectoryRunId!==38094976711
   ||sites.provenance.originalLrlArtifactId!==11685387674
   ||sites.provenance.originalLrlDirectoryUrl!=='https://www.lrl.mn.gov/legdb/senate_dir'
   ||sites.targets.length!==6)
  throw Error('Original official senator-only 2020 scope or source provenance changed');
 const output=[];
 for(const [i,person] of FIXED_SIX_2020_SENATORS.entries()){
  const t=sites.targets[i];
  if(t.id!=='senate20-'+String(i+1).padStart(2,'0')
   ||t.personLRLName!==person.name||t.electionDistrict2020!==person.district
   ||t.sourceCampaignDomain!==person.domain
   ||!t.webDiscoveryLead||t.siteArchivedContent2019Or2020ProofPending!==true
   ||t.originalSosFiledCampaignWebsiteAt2020Unverified!==true
   ||t.sourceCampaignTextNotYetHumanVerified!==true
   ||person.name==='Mary Kunesh'&&('official2020BallotNameVariant' in t
     &&t.official2020BallotNameVariant!=='Mary Kunesh-Podein'))
   throw Error('Original 2020 person, service district and research site mismatch');
  safeOriginalUrl(t.webDiscoveryLead,person.domain);
  const record=validateActualSenateServiceForElection(
   official,person.name,person.district,2020);
  if(record.status!=='verified_senate_service'
    ||record.serviceForThisElectionFollowingYearVerified!==true
    ||!record.officialName||!record.term||!record.officialServiceSource)
   throw Error('Not an original independently verified ACTUALLY SERVED 2021 Minnesota senator: '+t.id);
  output.push({...t,verifiedOfficialSenateName:record.officialName,
   originalOfficialServiceSource:record.officialServiceSource,
   provenSenateTerm:record.term});
 }
 if(new Set(output.map(x=>x.verifiedOfficialSenateName)).size!==6)
  throw Error('Same Senate person assigned to two different campaign domains');
 return output;
}
export function real2020SenatorHistoricalCdxQuery(domain:string){
 if(!FIXED_SIX_2020_SENATORS.some(p=>p.domain===domain))
  throw Error('Original web archive outside verified actual senator domains');
 const q=new URLSearchParams({
  url:domain,matchType:'domain',from:'20190101',to:'20201102',
  output:'json',fl:'timestamp,original,mimetype,statuscode,digest,length',
  filter:'statuscode:200',limit:'300',
 });
 return 'https://web.archive.org/cdx/search/cdx?'+q.toString();
}
function rank(path:string){
 const p=path.toLowerCase().replace(/\/+$/,'')||'/';
 if(/^\/(?:issues?|priorities|platform|polic(?:y|ies)|vision|legislative-issues|positions|our-issues|our-priorities)$/.test(p))return 0;
 if(/\/(?:issues?|priorities|platform|polic(?:y|ies)|vision)\/[a-z0-9_-]+$/.test(p))return 1;
 if(p==='/')return 2;
 if(/^\/(?:about|meet|bio|our-campaign|campaign|why-im-running)$/.test(p))return 3;
 return 7;
}
export function parse2020ActualSenatorOriginalCampaignCdx(
 payload:unknown,domain:string,
){
 if(!FIXED_SIX_2020_SENATORS.some(p=>p.domain===domain))
  throw Error('Non-serving or unreviewed original campaign domain');
 if(Array.isArray(payload)&&payload.length===0)return{
  pageRows:[] as WaybackCapture[],rawIndexRows:0,indexAtCap:false,validEmpty:true,
 };
 if(!Array.isArray(payload)||!payload.length||!Array.isArray(payload[0])
  ||payload.length>301)
  throw Error('No bounded original 2019-2020 historic Senate campaign index');
 const fields=(payload[0] as unknown[]).map(String);
 if(['timestamp','original','mimetype','statuscode','digest','length'].some(
   k=>!fields.includes(k)))
  throw Error('Original archive index header incomplete');
 const chosen:WaybackCapture[]=[],unique=new Set<string>();
 for(const p of parseWaybackCdxJson(payload)){
  let u:URL;
  try{u=safeOriginalUrl(p.original,domain);}catch{continue;}
  if(p.capturedAt<BEGIN||p.capturedAt>=END
    ||!/^[A-Z2-7]{32}$/.test(p.digest)||p.statuscode!=='200'
    ||/\.(?:css|js|png|jpg|jpeg|svg|gif|webp|mp4|pdf|woff2?|zip)$/i.test(u.pathname)
    ||/^\/(?:wp-admin|wp-includes|wp-json|login|admin)(?:\/|$)/i.test(u.pathname))
   continue;
  const key=p.original+'|'+p.timestamp+'|'+p.digest;
  if(unique.has(key))continue;
  unique.add(key);chosen.push(p);
 }
 chosen.sort((a,b)=>rank(new URL(a.original).pathname)-
   rank(new URL(b.original).pathname)||a.capturedAt.localeCompare(b.capturedAt));
 return{pageRows:chosen,rawIndexRows:payload.length-1,
  indexAtCap:payload.length===301,validEmpty:false};
}
export function choose2020OriginalCandidatePlatformReplays(
 rows:WaybackCapture[],
){
 const chosen:WaybackCapture[]=[],paths=new Set<string>();
 for(const c of rows){
  const path=new URL(c.original).pathname.toLowerCase().replace(/\/+$/,'')||'/';
  if(paths.has(path))continue;
  paths.add(path);chosen.push(c);
  if(chosen.length===4)break;
 }
 if(chosen.length<4){
  for(const c of [...rows].reverse()){
   if(chosen.length===4)break;
   if(chosen.some(a=>a.original===c.original&&a.timestamp===c.timestamp)
    ||chosen.some(a=>a.digest===c.digest))continue;
   chosen.push(c);
  }
 }
 return chosen;
}
function save(dir:string,name:string,buf:Buffer|null){
 if(!buf||!buf.byteLength)return null;
 if(!/^[a-z0-9._-]{1,120}$/.test(name)||name.includes('..'))
  throw Error('Unsafe public original file path');
 writeFileSync(join(dir,name),buf,{flag:'wx',mode:0o600});
 return name;
}
const meta=(x:PublicReply)=>{const {body,...rest}=x;return rest;};
export async function acquire2020OriginalCampaignSitesOfSixActualSenators(
 outDir:string,official:AuditedOfficialSenateDirectory,
 network:typeof fetch=fetch,
){
 const verified=verifyActualSixSenatorsFor2020OriginalCampaignArchive(official);
 const output=resolve(outDir);
 if(existsSync(output))throw Error('Refuse to overwrite any original campaign source');
 mkdirSync(output,{recursive:true,mode:0o700});
 const reports=[];
 for(const p of verified){
  const indexUrl=real2020SenatorHistoricalCdxQuery(p.sourceCampaignDomain);
  const r=await fetchDatedBoundedPublic(indexUrl,1_500_000,network);
  const file=save(output,p.id+'-2019-2020-cdx-original.json',
   r.status===200?r.body:null);
  let parsed:ReturnType<typeof parse2020ActualSenatorOriginalCampaignCdx>|null=null;
  let parseError:string|null=null;
  if(r.status===200&&r.body){
   try{parsed=parse2020ActualSenatorOriginalCampaignCdx(
    JSON.parse(r.body.toString('utf8')) as unknown,p.sourceCampaignDomain);}
   catch(e){parseError=e instanceof Error?e.message:'invalid historic original index';}
  }
  const snapshots=[];
  for(const [index,c] of (parsed?
    choose2020OriginalCandidatePlatformReplays(parsed.pageRows):[]).entries()){
   const replay=await fetchDatedBoundedPublic(c.archiveUrl,2_500_000,network);
   const valid=Boolean(replay.status===200&&replay.body&&
    base32Sha1Archive(replay.body)===c.digest
    &&/^(?:text\/html|text\/plain|application\/xhtml\+xml)(?:;|$)/i.test(
      replay.headers.contentType??''));
   const nameCheck=valid&&replay.body?
    originalCampaignVisibleText(replay.body).toLowerCase().includes(
      p.personLRLName.toLowerCase().split(/\s+/).at(-1)!):null;
   const original=save(output,p.id+'-original-'+c.timestamp+'-'+String(index)+'.html',
    valid?replay.body:null);
   snapshots.push({
    originalWebsiteUrl:c.original,firstAttestedArchiveCaptureAtUtc:c.capturedAt,
    archivedOriginalReplayUrl:c.archiveUrl,
    independentlyIndexedHistoricalOriginalSha1Base32:c.digest,
    originalFullHtmlSourceFile:original,
    originalFullHtmlSha256:valid?replay.responseBodySha256:null,
    actualRetrievedOriginalHtmlMatchesIndependentHistoricalCdxDigest:valid,
    originalHtmlDisplaysSenatorSurname:nameCheck,
    originalRetrievedHttpResponse:meta(replay),
    sourceYearAndCandidateCampaignCycleIndependentlyReviewed:false,
    anyPolicyQuoteAttributedOrAdmitted:false,
    originalAuthorFirstPostedAtUtc:null,
   });
  }
  reports.push({
   actualLRLServedSenatorName:p.verifiedOfficialSenateName,
   2020ElectionDistrict:p.electionDistrict2020,
   2020CandidateIdentityLead:p.personLRLName,
   originalActualSenateServiceTerm:p.provenSenateTerm,
   originalOfficialSenateServiceSource:p.originalOfficialServiceSource,
   originalOfficialSenateDirectoryHtmlSha256:official.source.sourceBytesSha256,
   publicArchiveDomain:p.sourceCampaignDomain,
   campaignDomainLeadOriginalSOS2020FiledSiteProven:false,
   historicIndexUrl:indexUrl,historicIndexHttpReceipt:meta(r),
   rawArchivedCdxIndexFile:file,
   independentlyParsedHistoricalCdx:Boolean(parsed),
   indexError:parseError??r.error,
   sampled2019To2020OriginalHtmlRows:parsed?.pageRows.length??null,
   historicalIndexReachedRowCap:parsed?.indexAtCap??null,
   authenticOriginalPageReceipts:snapshots,
  });
  console.log('SENATE-2020-FIRST-PARTY-ORIGINAL '+JSON.stringify({
   verifiedActualPerson:p.personLRLName,
   indexHttp:r.status,indexRows:parsed?.pageRows.length??null,
   pageOriginalReplays:snapshots.length,
   hashAuthenticatedOriginalHTML:snapshots.filter(x=>
    x.actualRetrievedOriginalHtmlMatchesIndependentHistoricalCdxDigest).length,
   noArchiveMatchIsNotProofOfNoOriginalPosition:true,
  }));
 }
 const all=reports.flatMap(x=>x.authenticOriginalPageReceipts),
   authenticated=all.filter(x=>
     x.actualRetrievedOriginalHtmlMatchesIndependentHistoricalCdxDigest);
 const result={
  schema:ORIGINAL_2020_CAMPAIGN_SIX_REAL_SENATORS_VERSION,
  actuallyAcquiredOnUtc:new Date().toISOString(),
  originalIndependentlyVerifiedOfficialLRLSenateDirectory:{
   url:official.source.url,sourceSha256:official.source.sourceBytesSha256,
   independentlyAcquiredUtc:official.source.observedAt,
  },
  totals:{
   actuallyServedSenatorPeople:reports.length,
   2019To2020OriginalCdxIndexQueries:reports.length,
   originalIndexSuccessfullyParsed:reports.filter(p=>p.independentlyParsedHistoricalCdx).length,
   originalIndexHTTP200:reports.filter(p=>p.historicIndexHttpReceipt.status===200).length,
   originalPageReplaysAttempted:all.length,
   authenticOriginalHtmlAndIndependentCdxMatches:authenticated.length,
   uniqueActualSenatePeopleWithOriginalPreElectionCapturedPages:
    reports.filter(p=>p.authenticOriginalPageReceipts.some(x=>
      x.actualRetrievedOriginalHtmlMatchesIndependentHistoricalCdxDigest)).length,
   sourceStatementQuoteSpansAuthenticatedInThisRun:0,
   forecastFeatureRowsAdmitted:0,
   databaseOrModelChanges:0,
  },
  limits:{
   allSenatorsPersonallyLRLVerifiedBeforeInternetArchiveQuery:true,
   independentOriginalHistoricalHTMLRequiredForAnyQuote:true,
   pre2020ElectionCutoffStrict:true,
   2019PagesMayContainOlderCycleContent:true,
   historicalSiteSOS2020FilingUrlProofStillMissing:true,
   300RowDomainIndexCanMissOtherSourcePages:true,
   failedSourceMeansUnknownNotNoIssuePositions:true,
   current2026SiteNeverProves2020Text:true,
   noProductionSourceModelServingOrDataChanges:true,
  },
  actualSenateCandidateDomains:reports,
 };
 save(output,'acquisition-manifest.json',Buffer.from(JSON.stringify(result,null,2)+'\n'));
 return result;
}
