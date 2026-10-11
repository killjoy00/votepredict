/**
 * Issue #864. Two actually-serving-2021 Minnesota State Senators have
 * candidate-site research gaps after the initial bounded 2020 site search:
 * Carrie Ruud - a specific 2013 Wayback candidate "Meet Carrie" page,
 * Roger Chamberlain - a DIFFERENT 2022 candidate domain found in a
 * third-party independent expenditure, not authorized by the candidate.
 *
 * Source DISCOVERY only. Verify original complete LRL actual 2021 Senate
 * service HTML plus independently pinned UTC/SHA original first; then
 * bounded 2012-2022 public Wayback historical CDX and actual original
 * page responses. No live campaign site fetching. Preserve sha256/CDX-SHA1
 * complete-page receipts. NO quotes automatically promoted.
 * NO production app, private DB, model, prediction, scheduler or contacts.
 */
import {createHash} from 'node:crypto';
import {readFileSync,statSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import lead from '../data/evaluation/senate-ruud-chamberlain-2012-2022-alt-original-domain-probes-v1.json' with {type:'json'};
import {parseWaybackCdxJson,type WaybackCapture} from '../src/evidence/wayback.js';
import {originalCampaignVisibleText,historicalArchiveSha1Base32}
 from '../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
import {parseOfficialMnSenateServiceDirectory,validateActualSenateServiceForElection,
 type AuditedOfficialSenateDirectory}
 from '../src/evidence/senate-official-ever-served-directory.js';
import {fetchDatedBoundedPublic,type PublicReply}
 from './acquire-senate-2022-ever-served-campaign-originals.js';

export const RUUD_CHAMBERLAIN_HISTORICAL_FIRST_PARTY_ARCHIVE_VERSION=
 'mn-two-serving-2021-senators-historical-2012-2022-original-website-probe-v1' as const;
const GOV_SHA='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const CDX_COLS=['timestamp','original','mimetype','statuscode','digest','length'] as const;
const people=[
 {name:'Carrie Ruud',district:'10',domain:'carrieruud.com'},
 {name:'Roger Chamberlain',district:'38',domain:'rogerchamberlainmn.com'},
] as const;
type PersonName=(typeof people)[number]['name'];
const sha256=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const exactTime=(s:string)=>Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s;
function entryCandidate(url:string,expectedDomain:string){
 const u=new URL(url);
 if(!['https:','http:'].includes(u.protocol)||u.username||u.password
  ||u.search||u.hash||u.port
  ||u.hostname.replace(/^www\./,'').toLowerCase()!==expectedDomain
  ||u.pathname.length>210)
  throw Error('Not an exact approved first-party historical campaign domain');
 if(/\.(?:pdf|gif|jpe?g|png|webp|ico|svg|css|js|woff2?|zip|mp4|mov|json|xml|txt)$/i.test(u.pathname)
  ||/^\/(?:wp-content|wp-admin|wp-json|admin|assets|plugins|api|cart|checkout)(?:\/|$)/i.test(u.pathname))
  throw Error('Not historical candidate-owned visible HTML candidate policy');
 return u;
}
export function validateRuudChamberlain2021ActualServiceBeforeOriginalNetwork(
 actual:AuditedOfficialSenateDirectory,
){
 const s=lead.scope,g=lead.originalGovernment;
 if(lead.schema!=='mn-two-served-senators-alternate-historical-first-party-original-sites-2012-2022-v1'
  ||lead.issue!==864
  ||s.actualMinnesotaSenateServiceBeforeAnyNetwork!==true
  ||s.senatorsActuallyServing2021!==2||s.distinctCandidateWebDomains!==2
  ||s.archiveIndexRequests!==6||s.maximumRowsPerIndex!==300
  ||s.maxFullOriginalHTMLReplaysEach!==5||s.maxTotalReplays!==10
  ||s.originalHtmlBodyMustMatchIndependentCDXSHA1!==true
  ||s.acceptedSourceMUSTShowSenatorSurname!==true
  ||s.verifiedExactIssueStatementsAtThisDiscoveryStage!==0
  ||s.unknownOrMissingArchivalSourcesNotProofOfNoPolicies!==true
  ||s.productionDatabaseEvidenceForecastModelSchedulerChanges!==0
  ||g.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
  ||g.run!==38094976711||g.artifact!==11685387674||g.sha256!==GOV_SHA
  ||g.requireFullOriginalHTMLAndObservedUTCReceipt!==true
  ||actual.schema!=='mn-lrl-official-senate-ever-served-directory-v1'
  ||actual.source.url!==g.url||actual.source.sourceBytesSha256!==GOV_SHA
  ||actual.source.directoryIsSenatorServiceNotCandidateFiling!==true
  ||actual.source.originalHistoricDateForDisplayedDirectoryEstablished!==false
  ||!exactTime(actual.source.observedAt)
  ||lead.people.length!==2||lead.archiveQueries.length!==6)
  throw Error('Whole original government Senate service/person/source scope not independently established');
 const certified=[];
 for(const [i,person] of people.entries()){
  const t=lead.people[i];
  if(t.senator!==person.name||t.domain!==person.domain
   ||t.actual2021ServiceDistrict!==person.district
   ||t.candidateAuthorshipOfArchivedPageToBeVerified!==true
   ||(i===0&&(t.specificHistoricalOriginal!=='http://www.carrieruud.com/index.cfm/pageid/18'
    ||t.historical2013CandidatePageIndependentlyFullBodyVerifiedYet!==false
    ||!t.documentedWaybackHistoricalURL?.includes('20130922051655')))
   ||(i===1&&(t.specificHistoricalOriginal!=='https://rogerchamberlainmn.com/'
    ||t.thirdPartyElectionYearFromPage!==2022
    ||t.independentExpenditureIsNotCandidateAuthorized!==true
    ||t.historical2022CandidateHTMLIndependentlyFullBodyVerifiedYet!==false
    ||t.domainOwnershipCurrent2026UntrustedBecauseMayHaveExpired!==true)))
   throw Error('Alternate historical candidate domain lead is not pinned or first-party attribution is pre-certified');
  const service=validateActualSenateServiceForElection(
   actual,person.name,person.district,2020);
  if(service.status!=='verified_senate_service'
   ||service.serviceForThisElectionFollowingYearVerified!==true
   ||!service.officialName||!service.term
   ||!service.officialServiceSource)
   throw Error('Candidate not independently proven actual Minnesota 2021-serving Senator: '+person.name);
  certified.push({name:person.name,officialName:service.officialName,
   original2021SenateTerm:service.term,domain:person.domain});
 }
 if(new Set(certified.map(x=>x.officialName)).size!==2)
  throw Error('Duplicate or unresolved actual Senate service');
 const expected=[
  ['ruud-2013-exact','Carrie Ruud','exact','http://www.carrieruud.com/index.cfm/pageid/18','20120101','20161107'],
  ['ruud-2012-2016-domain','Carrie Ruud','domain','carrieruud.com','20120101','20161107'],
  ['ruud-2017-2020-domain','Carrie Ruud','domain','carrieruud.com','20170101','20201102'],
  ['chamberlain-2020-2021-domain','Roger Chamberlain','domain','rogerchamberlainmn.com','20200101','20211231'],
  ['chamberlain-2022-domain','Roger Chamberlain','domain','rogerchamberlainmn.com','20220101','20221107'],
  ['chamberlain-2022-exact-home','Roger Chamberlain','exact','https://rogerchamberlainmn.com/','20220101','20221107'],
 ];
 for(const [i,values] of expected.entries()){
  const q=lead.archiveQueries[i];
  if([q.id,q.person,q.kind,q.url,q.from,q.to].join('|')!==values.join('|'))
   throw Error('Index URL, person, capture window or original domain was changed');
  entryCandidate(q.kind==='domain'?'https://'+q.url+'/':q.url,
   q.person==='Carrie Ruud'?'carrieruud.com':'rogerchamberlainmn.com');
 }
 return certified;
}
export function buildOriginalTwoSenatorHistoricalWaybackIndexes(){
 return lead.archiveQueries.map(q=>{
  const params=new URLSearchParams({
   url:q.url,matchType:q.kind,output:'json',fl:CDX_COLS.join(','),
   filter:'statuscode:200',from:q.from,to:q.to,limit:'300',
  });
  return 'https://web.archive.org/cdx/search/cdx?'+params.toString();
 });
}
export function parseBoundedRuudChamberlainOriginalCDXIndex(
 raw:unknown,queryId:string,
){
 const q=lead.archiveQueries.find(q=>q.id===queryId);
 if(!q)throw Error('Unknown senator historical Wayback source query');
 if(Array.isArray(raw)&&raw.length===0)
  return{eligible:[] as WaybackCapture[],rawRows:0,atCap:false};
 if(!Array.isArray(raw)||!raw.length||raw.length>301||!Array.isArray(raw[0])
  ||CDX_COLS.some(k=>!(raw[0] as unknown[]).map(String).includes(k)))
  throw Error('Original historical CDX index incomplete or exceeds bounded 300 rows');
 const used=new Set<string>(),eligible:WaybackCapture[]=[];
 for(const c of parseWaybackCdxJson(raw)){
  let u:URL;
  try{u=entryCandidate(c.original,
   q.person==='Carrie Ruud'?'carrieruud.com':'rogerchamberlainmn.com');}
  catch{continue;}
  const date=c.capturedAt.slice(0,10).replace(/-/g,'');
  if(date<q.from||date>q.to||!/^[A-Z2-7]{32}$/.test(c.digest))
   continue;
  if(q.kind==='exact'
    &&(u.pathname!==new URL(q.url).pathname
      ||u.hostname.replace(/^www\./,'')!==new URL(q.url).hostname.replace(/^www\./,'')))
   continue;
  const id=c.original+'|'+c.timestamp+'|'+c.digest;
  if(used.has(id))continue;
  used.add(id);eligible.push(c);
 }
 return{eligible,rawRows:raw.length-1,atCap:raw.length===301};
}
function rankPage(url:string,person:PersonName){
 const path=new URL(url).pathname.toLowerCase().replace(/\/+$/,'')||'/';
 if(person==='Carrie Ruud'&&path==='/index.cfm/pageid/18')return 0;
 if(/\/(?:issues?|priorities|platform|polic(?:y|ies)|positions|agenda)(?:\/|$|\.)/.test(path))return 1;
 if(/\/(?:issues?|priorities|platform|policy)[-_][a-z0-9_-]+/.test(path))return 2;
 if(path==='/')return 3;
 if(/\/(?:meet|about|bio|our-campaign|vision|news|accomplishments)/.test(path))return 4;
 return 8;
}
export function selectWholeRuudChamberlainOriginalHtmlReplays(
 all:ReadonlyArray<WaybackCapture>,person:PersonName,
){
 const matches=all.filter(c=>{
  try{entryCandidate(c.original,
   people.find(x=>x.name===person)!.domain);return true;}catch{return false;}
 });
 const ordered=[...matches].sort((a,b)=>
  rankPage(a.original,person)-rankPage(b.original,person)
  ||a.capturedAt.localeCompare(b.capturedAt));
 const chosen:WaybackCapture[]=[],paths=new Set<string>(),identities=new Set<string>();
 const add=(x:WaybackCapture|undefined)=>{
  if(!x||chosen.length>=5)return;
  const id=x.original+'|'+x.timestamp+'|'+x.digest;
  if(identities.has(id))return;
  const path=new URL(x.original).pathname.toLowerCase().replace(/\/+$/,'')||'/';
  if(paths.has(path))return;
  identities.add(id);paths.add(path);chosen.push(x);
 };
 for(const c of ordered)add(c);
 // If only one or two distinct paths exist, retain different-year body
 // versions with a different digest, not count extra "policy statements".
 for(const c of [...matches].sort((a,b)=>b.capturedAt.localeCompare(a.capturedAt))){
  if(chosen.length>=5)break;
  if(chosen.some(x=>x.digest===c.digest))continue;
  const id=c.original+'|'+c.timestamp+'|'+c.digest;
  if(identities.has(id))continue;
  identities.add(id);chosen.push(c);
 }
 return chosen;
}
function sourceOnlyFile(dir:string,file:string,body:Buffer|null){
 if(!body||!body.length)return null;
 if(!/^[a-z0-9._-]{1,120}$/.test(file)||file.includes('..'))
  throw Error('Unsafe original historical source output filename');
 writeFileSync(join(dir,file),body,{flag:'wx',mode:0o600});
 return file;
}
function asMetadata(raw:PublicReply){const {body,...other}=raw;return other;}
export async function acquireTwoHistoricalOriginalCandidateDomainSources(
 outputDir:string,actual:AuditedOfficialSenateDirectory,network:typeof fetch=fetch,
){
 // NEVER begin public network without authentic whole LRL senator service.
 const served=validateRuudChamberlain2021ActualServiceBeforeOriginalNetwork(actual);
 const dir=resolve(outputDir);
 if(existsSync(dir))throw Error('Research-only immutable original source output already exists');
 mkdirSync(dir,{recursive:true,mode:0o700});
 const originalIndexes=[],byPerson=new Map<PersonName,WaybackCapture[]>();
 for(const p of people)byPerson.set(p.name,[]);
 for(const [i,url] of buildOriginalTwoSenatorHistoricalWaybackIndexes().entries()){
  const q=lead.archiveQueries[i],response=await fetchDatedBoundedPublic(url,1_500_000,network);
  const name='ruudchamberlain-'+String(i+1).padStart(2,'0')+'-original-cdx-index.json';
  const archived=sourceOnlyFile(dir,name,response.status===200?response.body:null);
  let parsed:ReturnType<typeof parseBoundedRuudChamberlainOriginalCDXIndex>|null=null;
  let parsingError:string|null=null;
  if(response.status===200&&response.body){
   try{parsed=parseBoundedRuudChamberlainOriginalCDXIndex(
    JSON.parse(response.body.toString('utf8')) as unknown,q.id);}
   catch(e){parsingError=e instanceof Error?e.message:'Original CDX parse error';}
  }
  if(parsed)byPerson.get(q.person as PersonName)?.push(...parsed.eligible);
  originalIndexes.push({
   id:q.id,candidate:q.person,from:q.from,to:q.to,originalIndexURL:url,
   fullOriginalCDXJsonFile:archived,rawIndexResponse:asMetadata(response),
   parsedSuccessfully:parsed!==null,
   sourceIndexRows:parsed?.rawRows??null,
   eligibleOriginalCandidateHTMLIndexRows:parsed?.eligible.length??null,
   hitIndexCap:parsed?.atCap??null,error:parsingError??response.error,
  });
 }
 const allReplays=[];
 for(const [pi,p] of people.entries()){
  const uniques=new Map<string,WaybackCapture>();
  for(const x of byPerson.get(p.name)??[])uniques.set(x.original+'|'+x.timestamp+'|'+x.digest,x);
  const selected=selectWholeRuudChamberlainOriginalHtmlReplays([...uniques.values()],p.name);
  for(const [i,c] of selected.entries()){
   const raw=await fetchDatedBoundedPublic(c.archiveUrl,2_500_000,network);
   const matches=Boolean(raw.status===200&&raw.body&&historicalArchiveSha1Base32(raw.body)===c.digest
    &&/^(?:text\/html|text\/plain|application\/xhtml\+xml)(?:;|$)/i.test(raw.headers.contentType??''));
   const visible=matches&&raw.body?originalCampaignVisibleText(raw.body):'';
   const candidateInText=visible.toLowerCase().includes(p.name.split(' ').at(-1)!.toLowerCase());
   const authenticated=matches&&candidateInText;
   const saved=sourceOnlyFile(dir,'rc-'+String(pi+1).padStart(2,'0')+
    '-archive-'+c.timestamp+'-'+i+'.html',authenticated?raw.body:null);
   allReplays.push({
    candidate:p.name,personGovernmentLRL2021District:p.district,
    originalCandidateURL:c.original,archiveCaptureUTC:c.capturedAt,
    fullOriginalArchiveReplayURL:c.archiveUrl,
    independentOriginalCDXSHA1Base32:c.digest,
    originalFullCandidateHTMLFile:saved,
    originalFullHTMLSHA256:authenticated?raw.responseBodySha256:null,
    originalResponseHashMatchesIndexedCDXSHA1:matches,
    originalCandidateSurnameVisible:candidateInText,
    authenticatedCandidateHTML:authenticated,
    originalPageHasEnoughVisibleText:visible.length>=150,
    visibleContentLength:visible.length,
    originalSourceResponse:asMetadata(raw),
    candidateSiteStatementHumanReviewed:false,
    firstAuthorPostedAtUTC:null,
    productionEvidenceOrForecastEligible:false,
   });
  }
 }
 const report={
  schema:RUUD_CHAMBERLAIN_HISTORICAL_FIRST_PARTY_ARCHIVE_VERSION,
  completeOriginalGovernmentSenatorServiceSHA256:actual.source.sourceBytesSha256,
  originalGovernmentSourceObservedUTC:actual.source.observedAt,
  actual2021ServingSenatorsIndependentlyVerified:served,
  observedSourcesAtUtc:new Date().toISOString(),
  candidateSite2013And2022LeadTrustIsNotArchivedHTML:true,
  originalSourceIndexes:originalIndexes,
  originalPageReplayResults:allReplays,
  counts:{
   actualVerifiedStateSenators:served.length,
   totalIndexQueries:originalIndexes.length,
   validOriginalCDXIndexes:originalIndexes.filter(x=>x.parsedSuccessfully).length,
   indexQueriesAtCap:originalIndexes.filter(x=>x.hitIndexCap).length,
   totalOriginalHTMLReplayAttempts:allReplays.length,
   fullyAuthenticatedOriginalPageHTMLBodies:allReplays.filter(x=>x.authenticatedCandidateHTML).length,
   distinctActuallyServingSenatorsWithOriginalHTML:new Set(
    allReplays.filter(x=>x.authenticatedCandidateHTML).map(x=>x.candidate)).size,
   independentlyHumanVerifiedDirectPolicyStatements:0,
   productionDatabaseEvidenceModelForecastSchedulerChanges:0,
  },
  unavailableSourceNeverMeansNoPosition:true,
  earliestOriginalAuthorPublicationDateProven:false,
  mutableModernCandidateDomainUsedAsHistoricalEvidence:false,
 };
 sourceOnlyFile(dir,'source-acquisition-manifest.json',
  Buffer.from(JSON.stringify(report,null,2)+'\n'));
 console.log('RUUD-CHAMBERLAIN-HISTORICAL-ORIGINAL-SITE-SOURCE-RESULT '+JSON.stringify({
  people:report.counts.actualVerifiedStateSenators,
  indexQueries:report.counts.totalIndexQueries,
  validIndices:report.counts.validOriginalCDXIndexes,
  capped:report.counts.indexQueriesAtCap,
  downloadedHTML:report.counts.totalOriginalHTMLReplayAttempts,
  authenticatedOriginalPages:report.counts.fullyAuthenticatedOriginalPageHTMLBodies,
  distinctSenatorsWithOriginals:report.counts.distinctActuallyServingSenatorsWithOriginalHTML,
  admittedStatements:report.counts.independentlyHumanVerifiedDirectPolicyStatements,
  productionChanges:report.counts.productionDatabaseEvidenceModelForecastSchedulerChanges,
 }));
 return report;
}
function boundedFile(path:string,min:number,max:number){
 const s=statSync(path);
 if(!s.isFile()||s.size<min||s.size>max)
  throw Error('Independently original full LRL Minnesota public serving-Senator directory missing');
 return readFileSync(path);
}
async function main(){
 const args=process.argv.slice(2),
 keys=['--entire-original-mn-lrl-actual-senator-directory-html',
  '--original-mn-lrl-utc-sha-receipt','--output-dir'];
 if(args.length!==keys.length*2||keys.some(k=>args.filter(x=>x===k).length!==1))
  throw Error('Complete original government HTML, original receipt and exclusive output directory required');
 const [gov,receipt,dir]=keys.map(k=>{
  const i=args.indexOf(k),v=i<0?undefined:args[i+1];
  if(!v||v.startsWith('--'))throw Error('Whole original government source path required');
  return resolve(v);
 });
 if(new Set([gov,receipt,dir]).size!==3)
  throw Error('Source-only output must not overwrite or conflate original government source');
 const govHTML=boundedFile(gov,9000,5*1024*1024);
 const info=JSON.parse(boundedFile(receipt,100,3*1024*1024).toString('utf8')) as{
  source?:{url?:string;observedAt?:string;sourceBytesSha256?:string};
 };
 const computed=sha256(govHTML);
 if(computed!==GOV_SHA
  ||info.source?.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
  ||info.source.sourceBytesSha256!==GOV_SHA||!info.source.observedAt)
  throw Error('Independent whole actual Minnesota Senate government directory SHA/UTC receipt invalid');
 const official=parseOfficialMnSenateServiceDirectory(govHTML,info.source.observedAt);
 await acquireTwoHistoricalOriginalCandidateDomainSources(dir,official);
}
if(process.argv[1]?.endsWith('acquire-ruud-chamberlain-two-historical-first-party-originals.ts')){
 main().catch(error=>{
  console.error('Not admitted as candidate original 2012-2022 website source: '+
   (error instanceof Error?error.message.slice(0,500):'unknown'));
  process.exitCode=1;
 });
}
