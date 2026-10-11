/**
 * Issue #864: bounded 20-person 2020-22 MN Senate first-party archive acquisition.
 * Public originals only; does NOT authenticate policy statements or infer absence.
 * One shared batch, multiple historically dated candidate-owned domain windows.
 * Completely offline with respect to application DB, forecast and schedulers.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {parseOfficialMnSenateServiceDirectory,validateActualSenateServiceForElection}
 from '../src/evidence/senate-official-ever-served-directory.js';
import {historicalArchiveSha1Base32,originalCampaignVisibleText}
 from '../src/evidence/senate-authenticated-campaign-excerpt-audit.js';

const sha=b=>createHash('sha256').update(b).digest('hex');
const governmentSourceSha='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const branch='audit/864-second-20-senators-archived-firstparty-20261011';
const people=[
 {person:"Amanda Hemmingsen-Jaeger",officialRosterName:"Amanda Hemmingsen-Jaeger",district:"47",year:2025,host:"amandaformn.com",lead:"2025 Senate special-election Vote411 original candidate domain"},
 {person:"Ann Rest",officialRosterName:"Ann H. Rest",district:"43",year:2022,host:"annrest4mn.com",lead:"live candidate-owned 2022 SD43 committee-paid domain"},
 {person:"Calvin Bahr",officialRosterName:"Calvin K. Bahr",district:"31",year:2022,host:"bahrforsenate.com",lead:"candidate 2022 Senate campaign archived domain"},
 {person:"Chris Eaton",officialRosterName:"Chris A. Eaton",district:"40",year:2020,host:"eaton4senate.com",lead:"2011 first-party campaign site in documented historical archive"},
 {person:"David Osmek",officialRosterName:"David J. Osmek",district:"33",year:2020,host:"davidosmek.com",lead:"ODP State Senate directory identified campaign domain"},
 {person:"Doron Clark",officialRosterName:"Doron Clark",district:"60",year:2025,host:"doronforsenate.org",lead:"original first-party candidate campaign priorities domain; January 28 2025 cutoff"},
 {person:"Gregory Clausen",officialRosterName:"Gregory D. Clausen",district:"57",year:2020,host:"clausenforsenate.com",lead:"contemporaneous 2020 East Metro voter guide first-party domain"},
 {person:"Jerry Newton",officialRosterName:"Jerry Newton",district:"37",year:2020,host:"jerrynewton.us",lead:"2020 candidate interview North Metro TV first-party website"},
 {person:"Kari Dziedzic",officialRosterName:"Kari Dziedzic",district:"60",year:2020,host:"kariforsenate.com",lead:"historical State Senate candidate-owned domain"},
 {person:"Kelly Morrison",officialRosterName:"Kelly L. Morrison",district:"45",year:2022,host:"kellymorrisonformn.com",lead:"unverified domain hypothesis; only count original senator-paid policy if authenticated"},
 {person:"Melisa Franzen",officialRosterName:"Melisa López Franzen",district:"49",year:2020,host:"melisafranzen.com",lead:"unverified campaign-domain hypothesis; 2025 federal Senate campaign not admissible"},
 {person:"Michael Goggin",officialRosterName:"Michael P. Goggin",district:"21",year:2020,host:"gogginforsenate.com",lead:"documented Senate campaign owned domain"},
 {person:"Michelle Benson",officialRosterName:"Michelle R. Benson",district:"31",year:2020,host:"michellebenson.com",lead:"unverified old senate-domain hypothesis, not 2022 governor campaign"},
 {person:"Patricia Torres Ray",officialRosterName:"Patricia Torres Ray",district:"63",year:2020,host:"patriciatorresray.com",lead:"older personal candidate domain; later congressional content excluded"},
 {person:"Paul Gazelka",officialRosterName:"Paul E. Gazelka",district:"9",year:2020,host:"paulgazelka.com",lead:"unverified Senate campaign domain hypothesis"},
 {person:"Scott Newman",officialRosterName:"Scott J. Newman",district:"18",year:2020,host:"scottnewmanforsenate.com",lead:"unverified Senate campaign domain hypothesis"},
 {person:"Charles Wiger",officialRosterName:"Sr., Charles W. Wiger",district:"43",year:2020,host:"chuckwiger.com",lead:"unverified historic candidate website hypothesis"},
 {person:"Steve Green",officialRosterName:"Steve Green",district:"2",year:2022,host:"stevegreenforsenate.com",lead:"Senate campaign domain hypothesis"},
 {person:"Thomas Bakk",officialRosterName:"Thomas M. Bakk",district:"3",year:2020,host:"tombakk.com",lead:"unverified older senate campaign website hypothesis"},
 {person:"Tou Xiong",officialRosterName:"Tou Xiong",district:"44",year:2022,host:"touxiong53a.com",lead:"documented 2018 House-era candidate-owned site, not automatically 2022 Senate platform"},
];
const additional=[
 {person:"Amanda Hemmingsen-Jaeger",officialRosterName:"Amanda Hemmingsen-Jaeger",district:"47",year:2025,host:"amandaformnhouse.com",lead:"old 2022 House campaign, not 2025 Senate-authored policy"},
 {person:"Ann Rest",officialRosterName:"Ann H. Rest",district:"45",year:2020,host:"annrest4mn.com",lead:"older 2020 SD45 pre-redistricting Senate service"},
 {person:"Jerry Newton",officialRosterName:"Jerry Newton",district:"37",year:2020,host:"jerrynewton.org",lead:"historical alternative candidate-owned domain"},
 {person:"Kelly Morrison",officialRosterName:"Kelly L. Morrison",district:"45",year:2022,host:"kellyformn.com",lead:"alternative unverified old campaign domain"},
 {person:"Melisa Franzen",officialRosterName:"Melisa López Franzen",district:"49",year:2020,host:"melisaforsenate.com",lead:"alternative candidate domain hypothesis"},
 {person:"Michelle Benson",officialRosterName:"Michelle R. Benson",district:"31",year:2020,host:"bensonforsenate.com",lead:"alternative Senate candidate domain hypothesis"},
 {person:"Paul Gazelka",officialRosterName:"Paul E. Gazelka",district:"9",year:2020,host:"gazelkaforsenate.com",lead:"alternative candidate domain hypothesis"},
 {person:"Scott Newman",officialRosterName:"Scott J. Newman",district:"18",year:2020,host:"newmanforsenate.com",lead:"alternative candidate domain hypothesis"},
 {person:"Steve Green",officialRosterName:"Steve Green",district:"2",year:2022,host:"sites.google.com",prefix:"/site/stevegreen2b/",lead:"historic House candidate site, old-cycle origin, exact path-only query"},
 {person:"Tou Xiong",officialRosterName:"Tou Xiong",district:"44",year:2022,host:"touxiongforsenate.com",lead:"alternative 2022 state Senate campaign site hypothesis"},
 {person:"Thomas Bakk",officialRosterName:"Thomas M. Bakk",district:"3",year:2020,host:"bakkforsenate.com",lead:"alternative candidate domain hypothesis"},
 {person:"Charles Wiger",officialRosterName:"Sr., Charles W. Wiger",district:"43",year:2020,host:"senatorwiger.com",lead:"alternative historic candidate domain hypothesis"},
 {person:"Patricia Torres Ray",officialRosterName:"Patricia Torres Ray",district:"63",year:2020,host:"torresrayforsenate.com",lead:"alternative campaign domain hypothesis"},
];
const pins=[...people,...additional];
assert.equal(people.length,20);
assert.equal(new Set(people.map(p=>p.person)).size,20);
assert.equal(pins.length,33);
const inputs=process.argv.slice(2);
function arg(k){const i=inputs.indexOf(k);assert.ok(i>=0&&inputs[i+1]&&!inputs[i+1].startsWith('--'),k);return resolve(inputs[i+1]);}
function original(p,min=20,max=6000000){const s=statSync(p);assert.ok(s.isFile()&&s.size>=min&&s.size<=max,'missing original '+p);return readFileSync(p);}
const gov=original(arg('--official-html'),9000),officialReceipt=JSON.parse(original(arg('--official-receipt')).toString()),out=arg('--out-dir');
assert.equal(sha(gov),governmentSourceSha);
assert.equal(officialReceipt.source.url,'https://www.lrl.mn.gov/legdb/senate_dir');
assert.equal(officialReceipt.source.sourceBytesSha256,governmentSourceSha);
const swearing=original(arg('--official-special-swearing-html'),9000);
assert.equal(sha(swearing),officialReceipt.supplementalSwearingSource.sourceBytesSha256);
const directory=parseOfficialMnSenateServiceDirectory(
 gov,officialReceipt.source.observedAt,swearing,officialReceipt.supplementalSwearingSource.observedAt);
assert.equal(directory.senators.length,105);

const rawCoverage=original(arg('--coverage-json'),9000,2000000);
assert.equal(sha(rawCoverage),'d93505d2598218f79075ba596dec1a6a860edfe8deaf94d8659ec4e493fa7923',
 'Original prior successful audited 95-person coverage artifact unexpectedly changed');
const priorCoverage=JSON.parse(rawCoverage.toString());
assert.equal(priorCoverage.summary.actualServingStateSenators,95);
assert.equal(priorCoverage.summary.actuallyServedSenatorsWithAnyKnownSelectedOriginalSiteExcerpt,64);
assert.equal(priorCoverage.summary.actuallyServedSenatorsUnobservedInSelectedOriginalSiteSourceLedgers,31);
assert.equal(priorCoverage.summary.totalExactResearchExcerptRowsForVerifiedSenators,869);
const previousByName=new Map(priorCoverage.byActuallyServedSenator.map(x=>[x.officialName,x]));
assert.equal(previousByName.size,95);
assert.equal(new Set(people.map(p=>p.officialRosterName)).size,20);
for(const p of people){
 const before=previousByName.get(p.officialRosterName);
 assert.ok(before,'No original LRL coverage identity for '+p.officialRosterName);
 assert.equal(before.originalSiteQuoteLeadCount,0,'Candidate already covered; do not repeat '+p.person);
 assert.equal(before.sourceCoverageState,'unobserved_from_selected_research_ledger_not_no_policy');
}

for(const p of pins){
 const v=validateActualSenateServiceForElection(directory,p.person,p.district,p.year);
 assert.equal(v.status,'verified_senate_service',p.person+' SD'+p.district);
 assert.equal(v.officialName,p.officialRosterName,'Original LRL full identity mismatch for '+p.person);
 assert.equal(v.serviceForThisElectionFollowingYearVerified,true,p.person+' '+p.year);
}
mkdirSync(out,{recursive:true});
const pause=ms=>new Promise(res=>setTimeout(res,ms));
async function http(url,timeout=30000){
 const requestedAtUtc=new Date().toISOString();
 for(let attempt=1;attempt<=2;attempt++){
  try{
   const response=await fetch(url,{
    headers:{'User-Agent':'MN-Senate-Historical-FirstParty-Archive-Research/1.0 (original-public-evidence-only)'},
    signal:AbortSignal.timeout(timeout)});
   const bytes=Buffer.from(await response.arrayBuffer());
   assert.ok(bytes.length<=5000000,'unbounded archive response');
   if(attempt===1&&(response.status===429||response.status===502||response.status===503||response.status===504)){
    await pause(1150);
    continue;
   }
   return {ok:response.ok,status:response.status,bytes,attempt,requestedAtUtc,
    receivedAtUtc:new Date().toISOString(),contentType:response.headers.get('content-type'),actualUrl:response.url};
  }catch(error){
   if(attempt===1){await pause(950);continue;}
   return {ok:false,status:null,bytes:Buffer.alloc(0),attempt,requestedAtUtc,
    receivedAtUtc:new Date().toISOString(),error:String(error).slice(0,200)};
  }
 }
 throw Error('unreachable');
}
function windowDates(p){
 if(p.year===2025){
  if(p.person==='Doron Clark')return {from:'20240101',to:'20250127',last:'20250128000000',actualElectionDate:'2025-01-28'};
  if(p.person==='Amanda Hemmingsen-Jaeger')return {from:'20220101',to:'20251103',last:'20251104000000',actualElectionDate:'2025-11-04'};
  throw Error('2025 individual special election date not validated '+p.person);
 }
 if(p.year===2020)return {from:'20130101',to:'20201102',last:'20201103000000',actualElectionDate:'2020-11-03'};
 if(p.year===2022)return {from:'20160101',to:'20221107',last:'20221108000000',actualElectionDate:'2022-11-08'};
 throw Error('Unproven cycle '+p.year);
}

function slug(p,i){return String(i+1).padStart(2,'0')+'-'+p.person.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'-'+p.year+(p.prefix?'-'+p.prefix.slice(1):'');}
function queryUrl(p){
 const dates=windowDates(p),u=new URL('https://web.archive.org/cdx/search/cdx');
 const fields={
  url:p.host+(p.prefix||''),matchType:p.prefix?'prefix':'domain',
  from:dates.from,to:dates.to,output:'json',
  fl:'timestamp,original,mimetype,statuscode,digest,length',
  filter:'statuscode:200',collapse:'urlkey',limit:'300'};
 for(const [k,v]of Object.entries(fields))u.searchParams.set(k,v);
 return u.toString();
}
function score(v,host){
 if(!Array.isArray(v)||!/^20[0-9]{12}$/.test(v[0])||v[3]!=='200'
  ||!String(v[2]).toLowerCase().includes('html')
  ||!/^[A-Z2-7]{32}$/.test(v[4]))return -10000;
 try{
  const url=new URL(v[1]),hostname=url.hostname.toLowerCase().replace(/^www\./,'');
  if(hostname!==host&&!hostname.endsWith('.'+host))return -10000;
  const path=url.pathname.toLowerCase();
  if(/\.(?:js|css|png|jpe?g|gif|woff2?|webp|svg|ico|pdf|zip|mp4)(?:$|\/)/i.test(path))return -1000;
  let s=0;
  if(/\/(issues?|priorit(?:y|ies)|platform|policy|positions?|vision|education|taxes?|environment|health|public-safety)(?:\/|[.-]|$)/i.test(path))s+=80;
  if(/\/(about|meet|home|index|campaign|where-i-stand)(?:\/|[.-]|$)/i.test(path))s+=32;
  if(/^\/(?:index\.(?:html?|php))?$/.test(path))s+=25;
  if(/\/(wp-content|assets|images|static|files?|upload|tag|category)\//i.test(path))s-=65;
  return s;
 }catch{return -10000;}
}
const issueWord=/\b(healthcare|health care|public schools?|education|taxes|housing|climate|renewable energy|gun violence|public safety|workers|small business|infrastructure|immigration|environment|child care|broadband|minimum wage|reproductive|affordability)\b/ig;
function previews(visible){
 const out=[],matches=[...visible.matchAll(issueWord)];
 for(const match of matches){
  const a=Math.max(0,match.index-100),b=Math.min(visible.length,match.index+180);
  const excerpt=visible.slice(a,b).replace(/\s+/g,' ').trim();
  if(!out.some(x=>x===excerpt))out.push(excerpt);
  if(out.length===10)break;
 }
 return out;
}
const output=Array(pins.length);
async function research(p,i){
 const id=slug(p,i),dates=windowDates(p),url=queryUrl(p),index=await http(url);
 const rec={person:p.person,originalOfficialElectionDistrict:p.district,electionYear:p.year,
  originalCandidateDomainLead:p.host,domainLeadEvidence:p.lead,targetedArchivePath:p.prefix||null,
  fromInclusive:dates.from,toInclusive:dates.to,actualElectionDate:dates.actualElectionDate,queryUrl:url,indexRequestAtUtc:index.requestedAtUtc,
  indexResponseAtUtc:index.receivedAtUtc,indexHttpStatus:index.status,indexAttempts:index.attempt,
  fullOriginalCdxResponseSha256:index.bytes.length?sha(index.bytes):null,
  fullOriginalCdxFilename:null,indexError:null,indexRows:0,indexCappedAt300:false,
  selectableOriginalHtmlRows:0,selectedOriginalReplaysAttempted:0,
  sha1CdxMatchedOriginalHtml:0,originalHtmlReplays:[],
  notFoundNeverMeansNoPolicy:true,archivalCaptureOnlyPublicByNotAuthoredDate:true,
  candidateSiteAttributionRequiresSeparateManualAudit:true};
 let rows=[];
 if(!index.ok)rec.indexError=index.error||('HTTP '+index.status);
 else try{
  const parsed=JSON.parse(index.bytes.toString('utf8'));
  assert.ok(Array.isArray(parsed)&&parsed.length>=1&&parsed.length<=301,'CDX dimensions');
  assert.deepEqual(parsed[0],['timestamp','original','mimetype','statuscode','digest','length']);
  rows=parsed.slice(1);
  rec.indexRows=rows.length;rec.indexCappedAt300=rows.length===300;
  rec.fullOriginalCdxFilename=id+'-entire-original-cdx.json';
  writeFileSync(join(out,rec.fullOriginalCdxFilename),index.bytes,{flag:'wx'});
 }catch(error){rec.indexError='invalid source CDX JSON '+String(error).slice(0,180);}
 const ranked=rows.filter(v=>v[0]<dates.last&&score(v,p.host)>=0)
  .sort((a,b)=>score(b,p.host)-score(a,p.host)||b[0].localeCompare(a[0]));
 rec.selectableOriginalHtmlRows=ranked.length;
 const selected=[],seen=new Set();
 for(const v of ranked){
  const u=new URL(v[1]),key=u.hostname.replace(/^www\./,'').toLowerCase()+u.pathname.toLowerCase().replace(/\/$/,'');
  if(seen.has(key))continue;seen.add(key);selected.push(v);
  if(selected.length===4)break;
 }
 for(const [j,v]of selected.entries()){
  rec.selectedOriginalReplaysAttempted++;
  const replay='https://web.archive.org/web/'+v[0]+'id_/'+v[1],r=await http(replay);
  const cap=v[0].replace(/^(....)(..)(..)(..)(..)(..)$/,'$1-$2-$3T$4:$5:$6.000Z');
  const record={originalSiteUrl:v[1],captureUtc:cap,originalCdxIndexedSha1Base32:v[4],
   replayUrl:replay,replayHttpStatus:r.status,replayAttempts:r.attempt,
   actualReplayUrl:r.actualUrl||null,replayedAtUtc:r.receivedAtUtc,
   fullResponseSha256:r.bytes.length?sha(r.bytes):null,
   fullOriginalByteDigestMatchesSeparateOriginalCdx:false,senatorSurnameInVisibleBody:false,
   retainedRawOriginalHtml:null,originalVisiblePreview:null,possiblePolicySentenceContexts:[],
   candidatePaidForAttributionAndIssueStatementsStillRequireManualAudit:true};
  if(r.ok&&r.bytes.length>=64&&r.bytes.length<=4000000){
   record.fullOriginalByteDigestMatchesSeparateOriginalCdx=historicalArchiveSha1Base32(r.bytes)===v[4];
   if(record.fullOriginalByteDigestMatchesSeparateOriginalCdx){
    const visible=originalCampaignVisibleText(r.bytes);
    const surname=p.person.split(/\s+/).at(-1).toLowerCase();
    record.senatorSurnameInVisibleBody=visible.toLowerCase().includes(surname);
    if(record.senatorSurnameInVisibleBody){
     record.originalVisiblePreview=visible.slice(0,6000);
     record.possiblePolicySentenceContexts=previews(visible);
     record.retainedRawOriginalHtml=id+'-'+String(j+1)+'-original-'+v[0]+'.html';
     writeFileSync(join(out,record.retainedRawOriginalHtml),r.bytes,{flag:'wx'});
     rec.sha1CdxMatchedOriginalHtml++;
    }
   }
  }
  rec.originalHtmlReplays.push(record);
 }
 rec.boundedSourceResult=rec.indexError?'archive_index_unavailable_or_invalid_unknown':
  rec.sha1CdxMatchedOriginalHtml>0?'digest_authenticated_original_html_source_candidate_manual_attribution_needed':
  rec.indexRows===0?'bounded_index_no_rows_unknown':
  rec.indexCappedAt300?'source_index_capped_or_no_verified_candidate_html_unknown':
  'no_verified_first_party_original_in_bounded_sample_unknown';
 console.log('TWENTY-SENATOR ORIGINAL SOURCE WINDOW '+JSON.stringify({person:p.person,year:p.year,domain:p.host,
  specialPath:p.prefix||null,http:rec.indexHttpStatus,rows:rec.indexRows,capped:rec.indexCappedAt300,
  shaMatchedOriginalHtml:rec.sha1CdxMatchedOriginalHtml,status:rec.boundedSourceResult}));
 return rec;
}
const concurrency=5;
let next=0;
await Promise.all(Array.from({length:concurrency},async()=>{
 while(true){
  const i=next++;
  if(i>=pins.length)return;
  try{output[i]=await research(pins[i],i);}
  catch(e){output[i]={person:pins[i].person,originalCandidateDomainLead:pins[i].host,
   unexpectedWindowFailure:String(e).slice(0,300),notFoundNeverMeansNoPolicy:true};
   console.error('RECOVERABLE WINDOW FAILURE',pins[i].person,String(e));}
 }
}));
const senatorResults=people.map(p=>({
 person:p.person,officialRosterName:p.officialRosterName,sourceWindows:output.filter(x=>x.person===p.person).length,
 originalHtmlBodies:output.filter(x=>x.person===p.person).reduce((n,x)=>n+(x.sha1CdxMatchedOriginalHtml||0),0),
 sourceIndexErrors:output.filter(x=>x.person===p.person&&x.indexError).length,
 autoAdmittedQuotes:0}));
assert.equal(senatorResults.length,20);
assert.equal(new Set(senatorResults.map(x=>x.person)).size,20);
const report={baselineOriginal95SourceResearchCoverageSHA256:sha(rawCoverage),
 baselineActualSenatorsWithAnyOriginalFirstPartyExcerpt:64,
 baselineActualSenatorsUnobserved:31,
 special2025SenateElectionCutoffsIndependentlyPinned:true,
 sourceOnlyNoPolicyAutomaticallyCounted:true,
 schema:'mn-2021-25-second-batch-20-distinct-uncovered-actual-senators-26-original-archive-search-windows-v1',
 issue:864,scope:'Historical first-party campaign website research only; no election forecasting',
 branch,independentGovernmentLRLSourceSha256:sha(gov),
 actualServingStateSenatorsVerifiedAgainstGovernmentBeforeArchiveNetwork:20,
 independentDateSegmentedCandidateSiteWindows:pins.length,
 completeOriginalCdxResponseFilesRetained:output.filter(x=>x.fullOriginalCdxFilename).length,
 digestAndVisibleIdentityMatchedCompleteArchivedHtml:output.reduce((n,x)=>n+(x.sha1CdxMatchedOriginalHtml||0),0),
 sourcesAreBoundedNotCompleteSiteCensus:true,noOriginalAuthorshipDateInferredFromCapture:true,
 candidateSiteDomainOwnershipAndPersonalIssueStancesMustBeAuditedBeforeCounting:true,
 exactCandidatePolicyExcerptsAutomaticallyAdmitted:0,
 officialSenateVotesOrCandidatePositionsInferred:0,forecastDataOrProductionDatabaseReadsWrites:0,
 senateRoster:senatorResults,originalSourceWindows:output};
writeFileSync(join(out,'second-20-senators-historical-candidate-site-originals-manifest.json'),
 JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log('FIRST TWENTY ACTUAL SENATORS PUBLIC ORIGINAL ARCHIVE ACQUISITION '+JSON.stringify({
 realSenators:20,windows:pins.length,sourceCdxFiles:report.completeOriginalCdxResponseFilesRetained,
 authenticOriginalHtml:report.digestAndVisibleIdentityMatchedCompleteArchivedHtml,
 automaticPolicyQuotes:0,productionChanges:0}));
