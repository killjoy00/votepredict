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
 from '../../src/evidence/senate-official-ever-served-directory.js';
import {historicalArchiveSha1Base32,originalCampaignVisibleText}
 from '../../src/evidence/senate-authenticated-campaign-excerpt-audit.js';

const sha=b=>createHash('sha256').update(b).digest('hex');
const governmentSourceSha='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const branch='audit/864-20-senator-historical-campaign-original-acquisition-20261011';
const people=[
 {person:'Susan Pha',district:'38',year:2022,host:'susanphaforsenate.com',lead:'prior #1028 authentic bounded index'},
 {person:'Robert Kupec',district:'4',year:2022,host:'kupec4mnsenate.com',lead:'2022 campaign https://www.kupec4mnsenate.com/our-campaign'},
 {person:'Gene Dornink',district:'27',year:2020,host:'genedorninkforsenate.com',lead:'prior #1139 archive investigation'},
 {person:'Michael Kreun',district:'32',year:2022,host:'michaelformnsenate.com',lead:'prior #1139 archive investigation'},
 {person:'Eric Lucero',district:'30',year:2022,host:'ericlucero.com',lead:'prior #1139 original candidate About page'},
 {person:'Matt Klein',district:'53',year:2022,host:'mattklein.org',lead:'2022 voter guide https://www.eastmetrovoterguide.com/matt-klein.html'},
 {person:'Torrey Westrom',district:'12',year:2022,host:'torreywestrom.com',lead:'MN SOS campaign filing website listing (2026 association, 2022 not verified)'},
 {person:'Eric Pratt',district:'54',year:2022,host:'ericprattmn.com',lead:'prior Minnesota Senate candidate site; later reused for 2026 Congress'},
 {person:'Bill Weber',district:'21',year:2022,host:'weberforsenate.com',lead:'historical official campaign site reference'},
 {person:'Jason Rarick',district:'11',year:2022,host:'jasonrarick.com',lead:'candidate site https://www.jasonrarick.com/'},
 {person:'Jeremy Miller',district:'26',year:2022,host:'friendsformiller.com',lead:'historical Senate site https://www.friendsformiller.com/meet-jeremy/'},
 {person:'Steve Drazkowski',district:'20',year:2022,host:'draz.com',lead:'original Senate 2022 candidate website https://www.draz.com/'},
 {person:'Andrew Mathews',district:'27',year:2022,host:'andrewmathews.com',lead:'2022 Senate platform https://andrewmathews.com/'},
 {person:'Bruce Anderson',district:'29',year:2022,host:'bruceforsenate.com',lead:'historical candidate website reference'},
 {person:'Jason Isaacson',district:'42',year:2020,host:'isaacsonforsd42.com',lead:'historical Senate candidate website reference'},
 {person:'Jeff Howe',district:'13',year:2022,host:'jeffhoweformn.com',lead:'historical candidate site reference'},
 {person:'Julie Rosen',district:'23',year:2020,host:'julierosen.com',lead:'archived original campaign website referenced 2007'},
 {person:'Mary Kiffmeyer',district:'30',year:2020,host:'kiffmeyer.org',lead:'2006 candidate site reported; site ownership in 2020 unverified'},
 {person:'David Tomassoni',district:'6',year:2020,host:'tomassoni4senate.com',lead:'historic URL now known repurposed, do not accept spam'},
 {person:'Bill Lieske',district:'58',year:2022,host:'lieske4senate.com',lead:'original 2022 Minnesota Senate candidate website'},
];
const additional=[
 {person:'Gene Dornink',district:'23',year:2022,host:'genedorninkforsenate.com',lead:'2022 prior #1057 original probe'},
 {person:'Eric Pratt',district:'55',year:2020,host:'ericprattmn.com',lead:'earlier Senate domain (exclude later Congress copy)'},
 {person:'Jeff Howe',district:'13',year:2020,host:'jeffhoweforsenate.com',lead:'2018 independent contemporaneous reporting of site'},
 {person:'Bill Weber',district:'22',year:2020,host:'weberforsenate.com',lead:'previous district Senate website'},
 {person:'Eric Lucero',district:'30',year:2022,host:'ericlucero.com',prefix:'/issues',lead:'2022 original CDX previously capped, targeted path-only search'},
 {person:'Eric Lucero',district:'30',year:2022,host:'ericlucero.com',prefix:'/priorities',lead:'2022 original CDX previously capped, targeted path-only search'},
];
const pins=[...people,...additional];
assert.equal(people.length,20);
assert.equal(new Set(people.map(p=>p.person)).size,20);
assert.equal(pins.length,26);
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
for(const p of pins){
 const v=validateActualSenateServiceForElection(directory,p.person,p.district,p.year);
 assert.equal(v.status,'verified_senate_service',p.person+' SD'+p.district);
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
 return p.year===2020?{from:'20160101',to:'20201102',last:'20201103000000'}:
  {from:'20210101',to:'20221107',last:'20221108000000'};
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
  fromInclusive:dates.from,toInclusive:dates.to,queryUrl:url,indexRequestAtUtc:index.requestedAtUtc,
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
 const ranked=rows.filter(v=>v[0]<dates.last&&score(v,p.host)>-9000)
  .sort((a,b)=>score(b,p.host)-score(a,p.host)||b[0].localeCompare(a[0]));
 rec.selectableOriginalHtmlRows=ranked.length;
 const selected=[],seen=new Set();
 for(const v of ranked){
  const u=new URL(v[1]),key=u.hostname.replace(/^www\./,'').toLowerCase()+u.pathname.toLowerCase().replace(/\/$/,'');
  if(seen.has(key))continue;seen.add(key);selected.push(v);
  if(selected.length===3)break;
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
const concurrency=4;
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
 person:p.person,sourceWindows:output.filter(x=>x.person===p.person).length,
 originalHtmlBodies:output.filter(x=>x.person===p.person).reduce((n,x)=>n+(x.sha1CdxMatchedOriginalHtml||0),0),
 sourceIndexErrors:output.filter(x=>x.person===p.person&&x.indexError).length,
 autoAdmittedQuotes:0}));
assert.equal(senatorResults.length,20);
assert.equal(new Set(senatorResults.map(x=>x.person)).size,20);
const report={schema:'mn-2021-25-first-batch-20-uncovered-actual-senators-26-original-archive-search-windows-v1',
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
writeFileSync(join(out,'first-20-senators-historical-candidate-site-originals-manifest.json'),
 JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log('FIRST TWENTY ACTUAL SENATORS PUBLIC ORIGINAL ARCHIVE ACQUISITION '+JSON.stringify({
 realSenators:20,windows:pins.length,sourceCdxFiles:report.completeOriginalCdxResponseFilesRetained,
 authenticOriginalHtml:report.digestAndVisibleIdentityMatchedCompleteArchivedHtml,
 automaticPolicyQuotes:0,productionChanges:0}));
