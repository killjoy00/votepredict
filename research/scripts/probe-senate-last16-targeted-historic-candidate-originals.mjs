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
const branch='audit/864-last16-targeted-archived-firstparty-domains-20261011';
const people=[
 {person:"Susan Pha",officialRosterName:"Susan Pha",district:"38",year:2022,host:"votesusanpha.com",matchType:"domain",lead:"2022 Sahan Journal explicitly linked this candidate-owned domain"},
 {person:"Robert Kupec",officialRosterName:"Robert Kupec",district:"4",year:2022,host:"kupec4mnsenate.com",matchType:"prefix",prefix:"/issues",lead:"2022 prior original WIX site menu issues and first pass CDX 300 capped"},
 {person:"Gene Dornink",officialRosterName:"Gene Dornink",district:"27",year:2020,host:"genedorninkforsenate.com",matchType:"exact",prefix:"/",lead:"Independent 2020 actual senator site known, prior domain-wide empty/invalid"},
 {person:"Michael Kreun",officialRosterName:"Michael E. Kreun",district:"32",year:2022,host:"michaelformnsenate.com",matchType:"exact",prefix:"/priorities",lead:"Original candidate priorities path current but 2022 origin unproven"},
 {person:"Eric Lucero",officialRosterName:"Eric Lucero",district:"30",year:2022,host:"ericlucero.com",matchType:"exact",prefix:"/",lead:"2022 candidate homepage issue snippets site remains 2022 branding"},
 {person:"Matt Klein",officialRosterName:"Matt D. Klein",district:"53",year:2022,host:"mattkleinforsenate.com",matchType:"domain",lead:"2022 West St Paul Reader explicitly linked campaign domain"},
 {person:"Jason Rarick",officialRosterName:"Jason Rarick",district:"11",year:2020,host:"jasonrarick.com",matchType:"exact",prefix:"/issues",lead:"Original 2021 issues menu-only, seek earlier pre-2020 issues text"},
 {person:"Bruce Anderson",officialRosterName:"Bruce Douglas Anderson",district:"29",year:2022,host:"bruceforsenate.com",matchType:"exact",prefix:"/issues/",lead:"2022 original candidate-owned issues oEmbed independently named underlying page"},
 {person:"Julie Rosen",officialRosterName:"Julie A. Rosen",district:"23",year:2020,host:"julierosen.com",matchType:"exact",prefix:"/",lead:"2007 preserved candidate campaign site; retrospective 2020 service"},
 {person:"Mary Kiffmeyer",officialRosterName:"Mary Kiffmeyer",district:"30",year:2020,host:"kiffmeyer.org",matchType:"exact",prefix:"/",lead:"Old personally attributed domain repurposed by 2020, restrict historic candidate pages"},
 {person:"David Tomassoni",officialRosterName:"David J. Tomassoni",district:"6",year:2020,host:"tomassoni4senate.com",matchType:"exact",prefix:"/",lead:"2019 WordPress receipt spam disqualified, try earlier captures"},
 {person:"Doron Clark",officialRosterName:"Doron Clark",district:"60",year:2025,host:"doronforsenate.org",matchType:"exact",prefix:"/priorities",lead:"2025 first-party priorities site, require before Jan 28 election"},
 {person:"Kelly Morrison",officialRosterName:"Kelly L. Morrison",district:"45",year:2022,host:"morrisonforsenate.com",matchType:"domain",lead:"Wikipedia historically links About Kelly KMsenate to this exact former Senate campaign domain"},
 {person:"Scott Newman",officialRosterName:"Scott J. Newman",district:"18",year:2020,host:"scottnewmanforsenate.com",matchType:"exact",prefix:"/issues",lead:"2020 original MN Scott Newman candidate-owned home explicitly linked Issues"},
 {person:"Charles Wiger",officialRosterName:"Sr., Charles W. Wiger",district:"43",year:2020,host:"chuckwiger.com",matchType:"exact",prefix:"/",lead:"Earlier campaign site hypothesis, original official member service"},
 {person:"Thomas Bakk",officialRosterName:"Thomas M. Bakk",district:"3",year:2020,host:"tombakk.com",matchType:"exact",prefix:"/",lead:"Earlier campaign domain hypothesis, 2020 official incumbent"},
];
const additional=[
 {person:"Susan Pha",officialRosterName:"Susan Pha",district:"38",year:2022,host:"www.votesusanpha.com",matchType:"exact",prefix:"/",lead:"2022 candidate homepage same domain with www"},
 {person:"Susan Pha",officialRosterName:"Susan Pha",district:"38",year:2022,host:"votesusanpha.com",matchType:"prefix",prefix:"/issues",lead:"Historical original issues path within 2022 campaign"},
 {person:"Susan Pha",officialRosterName:"Susan Pha",district:"38",year:2022,host:"votesusanpha.com",matchType:"prefix",prefix:"/priorities",lead:"Historical original priorities path within 2022 campaign"},
 {person:"Robert Kupec",officialRosterName:"Robert Kupec",district:"4",year:2022,host:"www.kupec4mnsenate.com",matchType:"exact",prefix:"/issues",lead:"2022 Wix menu issue page exact"},
 {person:"Robert Kupec",officialRosterName:"Robert Kupec",district:"4",year:2022,host:"www.kupec4mnsenate.com",matchType:"exact",prefix:"/our-campaign",lead:"2022 former original campaign about path exact"},
 {person:"Robert Kupec",officialRosterName:"Robert Kupec",district:"4",year:2022,host:"www.kupec4mnsenate.com",matchType:"exact",prefix:"/",lead:"2022 original campaign homepage exact"},
 {person:"Gene Dornink",officialRosterName:"Gene Dornink",district:"27",year:2020,host:"genedorninkforsenate.com",matchType:"domain",lead:"2016 and 2020 archived candidate site alternate domain-wide status check"},
 {person:"Gene Dornink",officialRosterName:"Gene Dornink",district:"27",year:2020,host:"votegenedornink.com",matchType:"domain",lead:"Alternate historical campaign site domain hypothesis"},
 {person:"Michael Kreun",officialRosterName:"Michael E. Kreun",district:"32",year:2022,host:"www.michaelformnsenate.com",matchType:"exact",prefix:"/",lead:"Exact campaign home alternative despite empty domain wide index"},
 {person:"Michael Kreun",officialRosterName:"Michael E. Kreun",district:"32",year:2022,host:"www.michaelformnsenate.com",matchType:"prefix",prefix:"/priorities",lead:"Precise campaign priorities path from current first-party site"},
 {person:"Michael Kreun",officialRosterName:"Michael E. Kreun",district:"32",year:2022,host:"michaelforsenate.com",matchType:"domain",lead:"Alternate candidate name campaign site hypothesis"},
 {person:"Eric Lucero",officialRosterName:"Eric Lucero",district:"30",year:2022,host:"www.ericlucero.com",matchType:"exact",prefix:"/",lead:"Exact 2022 first-party homepage rather than capped 300-row domain index"},
 {person:"Eric Lucero",officialRosterName:"Eric Lucero",district:"30",year:2022,host:"www.ericlucero.com",matchType:"prefix",prefix:"/copy-of-photos",lead:"Archived 2022 Wix menu paths possible extra candidate policy"},
 {person:"Eric Lucero",officialRosterName:"Eric Lucero",district:"30",year:2022,host:"ericlucero.com",matchType:"prefix",prefix:"/real-solutions",lead:"Campaign headline Real Solutions for Minnesota alternate issue path"},
 {person:"Matt Klein",officialRosterName:"Matt D. Klein",district:"53",year:2022,host:"www.mattkleinforsenate.com",matchType:"exact",prefix:"/",lead:"Candidate homepage explicit 2022 newspaper link"},
 {person:"Matt Klein",officialRosterName:"Matt D. Klein",district:"53",year:2022,host:"www.mattkleinforsenate.com",matchType:"prefix",prefix:"/issues",lead:"Candidate issue subpaths 2022 domain"},
 {person:"Matt Klein",officialRosterName:"Matt D. Klein",district:"53",year:2022,host:"mattklein.org",matchType:"exact",prefix:"/",lead:"2022 voter guide alternative self-reported original domain"},
 {person:"Jason Rarick",officialRosterName:"Jason Rarick",district:"11",year:2020,host:"www.jasonrarick.com",matchType:"exact",prefix:"/",lead:"Older original Senate homepage before 2020 election"},
 {person:"Jason Rarick",officialRosterName:"Jason Rarick",district:"11",year:2020,host:"www.jasonrarick.com",matchType:"prefix",prefix:"/issues",lead:"Earlier original candidate issue page captures before 2020"},
 {person:"Jason Rarick",officialRosterName:"Jason Rarick",district:"11",year:2020,host:"rarickforhouse.com",matchType:"domain",lead:"Historical original Minnesota House election candidate site hypothesis"},
 {person:"Bruce Anderson",officialRosterName:"Bruce Douglas Anderson",district:"29",year:2022,host:"www.bruceforsenate.com",matchType:"exact",prefix:"/issues/",lead:"2022 candidate WordPress source exact full issues not embed"},
 {person:"Bruce Anderson",officialRosterName:"Bruce Douglas Anderson",district:"29",year:2022,host:"bruceforsenate.com",matchType:"exact",prefix:"/issues",lead:"Possible no slash original issues URL"},
 {person:"Bruce Anderson",officialRosterName:"Bruce Douglas Anderson",district:"29",year:2022,host:"bruceforsenate.com",matchType:"exact",prefix:"/",lead:"2022 candidate homepage root"},
 {person:"Julie Rosen",officialRosterName:"Julie A. Rosen",district:"23",year:2020,host:"www.julierosen.com",matchType:"exact",prefix:"/",lead:"2007 candidate site exact original internet archive reference"},
 {person:"Julie Rosen",officialRosterName:"Julie A. Rosen",district:"23",year:2020,host:"julierosen.com",matchType:"prefix",prefix:"/issues",lead:"Possible older campaign policy issues path pre-2012"},
 {person:"Julie Rosen",officialRosterName:"Julie A. Rosen",district:"23",year:2020,host:"julierosenforsenate.com",matchType:"domain",lead:"Unconfirmed alternative Senate campaign domain"},
 {person:"Mary Kiffmeyer",officialRosterName:"Mary Kiffmeyer",district:"30",year:2020,host:"kiffmeyer.org",matchType:"prefix",prefix:"/issues",lead:"Older original Senate candidate issues before 2020 domain repurpose"},
 {person:"Mary Kiffmeyer",officialRosterName:"Mary Kiffmeyer",district:"30",year:2020,host:"marykiffmeyer.com",matchType:"domain",lead:"Alternate old Minnesota Senate candidate identity domain hypothesis"},
 {person:"Mary Kiffmeyer",officialRosterName:"Mary Kiffmeyer",district:"30",year:2020,host:"kiffmeyerforsenate.com",matchType:"domain",lead:"Alternate historical Kiffmeyer Senate domain"},
 {person:"David Tomassoni",officialRosterName:"David J. Tomassoni",district:"6",year:2020,host:"www.tomassoni4senate.com",matchType:"exact",prefix:"/",lead:"Original before unrelated 2019 WordPress receipt spam"},
 {person:"David Tomassoni",officialRosterName:"David J. Tomassoni",district:"6",year:2020,host:"tomassoni4senate.com",matchType:"prefix",prefix:"/issues",lead:"Original old candidate policy page before unrelated 2019 takeover"},
 {person:"David Tomassoni",officialRosterName:"David J. Tomassoni",district:"6",year:2020,host:"tomassoniforsenate.com",matchType:"domain",lead:"Alternate old candidate senate site hypothesis"},
 {person:"Doron Clark",officialRosterName:"Doron Clark",district:"60",year:2025,host:"www.doronforsenate.org",matchType:"exact",prefix:"/",lead:"First-party campaign homepage prior to Jan 28 2025 election"},
 {person:"Doron Clark",officialRosterName:"Doron Clark",district:"60",year:2025,host:"doronforsenate.org",matchType:"domain",lead:"First-party original exact 2025 pre-election captures by domain"},
 {person:"Doron Clark",officialRosterName:"Doron Clark",district:"60",year:2025,host:"doronclark.com",matchType:"domain",lead:"Alternate pre Jan 28 2025 original campaign domain hypothesis"},
 {person:"Kelly Morrison",officialRosterName:"Kelly L. Morrison",district:"45",year:2022,host:"www.morrisonforsenate.com",matchType:"exact",prefix:"/about-kelly",lead:"History citation former 2022 original About Kelly site"},
 {person:"Kelly Morrison",officialRosterName:"Kelly L. Morrison",district:"45",year:2022,host:"www.morrisonforsenate.com",matchType:"exact",prefix:"/",lead:"Former original Senate campaign homepage 2022"},
 {person:"Kelly Morrison",officialRosterName:"Kelly L. Morrison",district:"45",year:2022,host:"morrisonforsenate.com",matchType:"prefix",prefix:"/issues",lead:"2022 candidate page site issues"},
 {person:"Kelly Morrison",officialRosterName:"Kelly L. Morrison",district:"45",year:2022,host:"kellyformn.com",matchType:"exact",prefix:"/",lead:"2018-2022 possible House-era original campaign"},
 {person:"Scott Newman",officialRosterName:"Scott J. Newman",district:"18",year:2020,host:"www.scottnewmanforsenate.com",matchType:"exact",prefix:"/issues/",lead:"2020 authenticated MN campaign website Issues menu"},
 {person:"Scott Newman",officialRosterName:"Scott J. Newman",district:"18",year:2020,host:"www.scottnewmanforsenate.com",matchType:"prefix",prefix:"/issues",lead:"2020 WordPress candidate site issue subpaths"},
 {person:"Scott Newman",officialRosterName:"Scott J. Newman",district:"18",year:2020,host:"www.scottnewmanforsenate.com",matchType:"exact",prefix:"/about-scott",lead:"2020 official candidate site About Scott policy possibility"},
 {person:"Charles Wiger",officialRosterName:"Sr., Charles W. Wiger",district:"43",year:2020,host:"senatorwiger.com",matchType:"exact",prefix:"/",lead:"Alternative domain previous CDX throttle"},
 {person:"Charles Wiger",officialRosterName:"Sr., Charles W. Wiger",district:"43",year:2020,host:"wigerforsenate.com",matchType:"domain",lead:"Alternate Senator Chuck Wiger campaign domain hypothesis"},
 {person:"Charles Wiger",officialRosterName:"Sr., Charles W. Wiger",district:"43",year:2020,host:"charleswiger.com",matchType:"domain",lead:"Historic Wiger personally-owned candidate domain hypothesis"},
 {person:"Thomas Bakk",officialRosterName:"Thomas M. Bakk",district:"3",year:2020,host:"bakkforsenate.com",matchType:"exact",prefix:"/",lead:"2020 alternate earlier candidate website previous 429"},
 {person:"Thomas Bakk",officialRosterName:"Thomas M. Bakk",district:"3",year:2020,host:"tombakk.com",matchType:"prefix",prefix:"/issues",lead:"Previous official candidate website possible issue path"},
 {person:"Thomas Bakk",officialRosterName:"Thomas M. Bakk",district:"3",year:2020,host:"tombakk.org",matchType:"domain",lead:"Alternate old senate original site domain hypothesis"},
];
const pins=[...people,...additional];
assert.equal(people.length,16);
assert.equal(new Set(people.map(p=>p.person)).size,16);
assert.equal(pins.length,64);
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
assert.equal(sha(rawCoverage),'a9b6e0345a1b030bde162d83d6b3ab20167ad395ed66aceac8957f6ab11c117a',
 'Original prior successful audited 95-person coverage artifact unexpectedly changed');
const priorCoverage=JSON.parse(rawCoverage.toString());
assert.equal(priorCoverage.summary.actualServingStateSenators,95);
assert.equal(priorCoverage.summary.actuallyServedSenatorsWithAnyKnownSelectedOriginalSiteExcerpt,79);
assert.equal(priorCoverage.summary.actuallyServedSenatorsUnobservedInSelectedOriginalSiteSourceLedgers,16);
assert.equal(priorCoverage.summary.totalExactResearchExcerptRowsForVerifiedSenators,1006);
const previousByName=new Map(priorCoverage.byActuallyServedSenator.map(x=>[x.officialName,x]));
assert.equal(previousByName.size,95);
assert.equal(new Set(people.map(p=>p.officialRosterName)).size,16);
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
  assert.equal(p.person,'Doron Clark','2025 specially dated candidate differs');
  return {from:'20240101',to:'20250127',last:'20250128000000',actualElectionDate:'2025-01-28'};
 }
 if(p.year===2020)return {from:p.person==='Julie Rosen'?'20010101':'20080101',to:'20201102',last:'20201103000000',actualElectionDate:'2020-11-03'};
 if(p.year===2022)return {from:'20160101',to:'20221107',last:'20221108000000',actualElectionDate:'2022-11-08'};
 throw Error('Unproven cycle '+p.year);
}
function slug(p,i){return String(i+1).padStart(2,'0')+'-'+p.person.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'-'+p.year+(p.prefix?'-'+p.prefix.slice(1).replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,''):'');}
function queryUrl(p){
 const dates=windowDates(p),u=new URL('https://web.archive.org/cdx/search/cdx');
 const fields={
  url:p.target||p.host+(p.prefix||''),matchType:p.matchType|| (p.prefix?'prefix':'domain'),
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
 const rec={person:p.person,originalOfficialElectionDistrict:p.district,electionYear:p.year,archiveQueryMatchType:p.matchType,
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
 const ranked=rows.filter(v=>v[0]<dates.last&&score(v,p.host.replace(/^www\./,''))>=0)
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
 console.log('LAST16 TARGETED ORIGINAL SOURCE WINDOW '+JSON.stringify({person:p.person,year:p.year,domain:p.host,
  specialPath:p.prefix||null,http:rec.indexHttpStatus,rows:rec.indexRows,capped:rec.indexCappedAt300,
  shaMatchedOriginalHtml:rec.sha1CdxMatchedOriginalHtml,status:rec.boundedSourceResult}));
 return rec;
}
const concurrency=7;
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
assert.equal(output.filter(v=>v.unexpectedWindowFailure).length,0,
 'Unexpected local archive acquisition window failure; cannot silently call 64 windows complete');
const senatorResults=people.map(p=>({
 person:p.person,officialRosterName:p.officialRosterName,sourceWindows:output.filter(x=>x.person===p.person).length,
 originalHtmlBodies:output.filter(x=>x.person===p.person).reduce((n,x)=>n+(x.sha1CdxMatchedOriginalHtml||0),0),
 sourceIndexErrors:output.filter(x=>x.person===p.person&&x.indexError).length,
 autoAdmittedQuotes:0}));
assert.equal(senatorResults.length,16);
assert.equal(new Set(senatorResults.map(x=>x.person)).size,16);
const report={baselineOriginal95SourceResearchCoverageSHA256:sha(rawCoverage),
 baselineActualSenatorsWithAnyOriginalFirstPartyExcerpt:79,
 baselineActualSenatorsUnobserved:16,
 special2025SenateElectionCutoffsIndependentlyPinned:true,
 sourceOnlyNoPolicyAutomaticallyCounted:true,
 targetedDomainAndPathOriginalsIndependentOfPreviousBroadCdx:true,
 schema:'mn-2021-25-last16-targeted-uncovered-original-site-64-archive-search-windows-v1',
 issue:864,scope:'Historical first-party campaign website research only; no election forecasting',
 branch,independentGovernmentLRLSourceSha256:sha(gov),
 actualServingStateSenatorsVerifiedAgainstGovernmentBeforeArchiveNetwork:16,
 independentDateSegmentedCandidateSiteWindows:pins.length,
 completeOriginalCdxResponseFilesRetained:output.filter(x=>x.fullOriginalCdxFilename).length,
 digestAndVisibleIdentityMatchedCompleteArchivedHtml:output.reduce((n,x)=>n+(x.sha1CdxMatchedOriginalHtml||0),0),
 sourcesAreBoundedNotCompleteSiteCensus:true,noOriginalAuthorshipDateInferredFromCapture:true,
 candidateSiteDomainOwnershipAndPersonalIssueStancesMustBeAuditedBeforeCounting:true,
 exactCandidatePolicyExcerptsAutomaticallyAdmitted:0,
 officialSenateVotesOrCandidatePositionsInferred:0,forecastDataOrProductionDatabaseReadsWrites:0,
 senateRoster:senatorResults,originalSourceWindows:output};
writeFileSync(join(out,'last16-targeted-candidate-original-archive-manifest.json'),
 JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log('LAST SIXTEEN ACTUAL SENATORS TARGETED ORIGINAL PUBLIC ARCHIVE ACQUISITION '+JSON.stringify({
 realSenators:16,windows:pins.length,sourceCdxFiles:report.completeOriginalCdxResponseFilesRetained,
 authenticOriginalHtml:report.digestAndVisibleIdentityMatchedCompleteArchivedHtml,
 automaticPolicyQuotes:0,productionChanges:0}));
