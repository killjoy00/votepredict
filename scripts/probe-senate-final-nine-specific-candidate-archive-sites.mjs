/**
 * #864: final nine uncovered actual 2021–25 Minnesota senators: a deliberately
 * small source-only targeted archive acquisition, rather than another 300-row
 * domain crawl. First replays six exact Susan Pha originals independently
 * indexed in previously preserved full original 300-row Wayback CDX.
 * Then date-bounds 12 precise alternate 2004/2020/2022/2025 original URLs.
 * Zero policy excerpt auto-admission, historical publication date inference,
 * official vote/forecast/model/scheduler/production interactions.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {parseOfficialMnSenateServiceDirectory,validateActualSenateServiceForElection}
 from '../src/evidence/senate-official-ever-served-directory.js';
import {historicalArchiveSha1Base32,originalCampaignVisibleText}
 from '../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
const sha=b=>createHash('sha256').update(b).digest('hex');
const govHash='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const coverageHash='95f1ed00ca95efab181a9a389053768ddc34e8d37c4daad938935f58b6114f25';
const argv=process.argv.slice(2);
function arg(k){const i=argv.indexOf(k);assert.ok(i>=0&&argv[i+1]&&!argv[i+1].startsWith('--'),'Missing '+k);return resolve(argv[i+1]);}
function original(p,min=50,max=6000000){
 const st=statSync(p);assert.ok(st.isFile()&&st.size>=min&&st.size<=max,'Missing complete original '+p);
 return readFileSync(p);
}
const officialRaw=original(arg('--official-html'),9000),receipt=JSON.parse(original(arg('--official-receipt')).toString()),
 swornRaw=original(arg('--official-special-swearing-html'),9000);
assert.equal(sha(officialRaw),govHash);
assert.equal(receipt.source.sourceBytesSha256,govHash);
assert.equal(receipt.source.url,'https://www.lrl.mn.gov/legdb/senate_dir');
assert.equal(sha(swornRaw),receipt.supplementalSwearingSource.sourceBytesSha256);
const service=parseOfficialMnSenateServiceDirectory(
 officialRaw,receipt.source.observedAt,swornRaw,receipt.supplementalSwearingSource.observedAt);
assert.equal(service.senators.length,105);
const prior=original(arg('--prior-85-coverage-json'),9000,2000000);
assert.equal(sha(prior),coverageHash,'Must reopen precise final successful 85/95 official original coverage');
const report=JSON.parse(prior.toString());
assert.equal(report.summary.actualServingStateSenators,95);
assert.equal(report.summary.actuallyServedSenatorsWithAnyKnownSelectedOriginalSiteExcerpt,85);
assert.equal(report.summary.actuallyServedSenatorsUnobservedInSelectedOriginalSiteSourceLedgers,10);
assert.equal(report.summary.totalExactResearchExcerptRowsForVerifiedSenators,1093);
const before=new Map(report.byActuallyServedSenator.map(x=>[x.officialName,x]));
assert.equal(before.size,95);
const nine=[
 ['Susan Pha','Susan Pha','38',2022],
 ['Gene Dornink','Gene Dornink','27',2020],
 ['Michael Kreun','Michael E. Kreun','32',2022],
 ['Mary Kiffmeyer','Mary Kiffmeyer','30',2020],
 ['David Tomassoni','David J. Tomassoni','6',2020],
 ['Doron Clark','Doron Clark','60',2025],
 ['Scott Newman','Scott J. Newman','18',2020],
 ['Charles Wiger','Sr., Charles W. Wiger','43',2020],
 ['Thomas Bakk','Thomas M. Bakk','3',2020]
];
assert.equal(nine.length,9);
assert.equal(new Set(nine.map(x=>x[0])).size,9);
for(const [name,originalName,district,year] of nine){
 const m=before.get(originalName);
 assert.ok(m,'Original official 95-person service record absent '+originalName);
 assert.equal(m.originalSiteQuoteLeadCount,0,'Cannot recover an already quote-covered candidate '+originalName);
 assert.equal(m.sourceCoverageState,'unobserved_from_selected_research_ledger_not_no_policy');
 const official=validateActualSenateServiceForElection(service,name,district,year);
 assert.equal(official.status,'verified_senate_service',name);
 assert.equal(official.officialName,originalName);
 assert.equal(official.serviceForThisElectionFollowingYearVerified,true);
}
assert.equal(before.get('Julie A. Rosen').originalSiteQuoteLeadCount,0,
 'This source experiment is pinned BEFORE the separately validated Rosen VML ledger merge');
const lastDir=arg('--prior-64-window-original-dir'),dest=arg('--out-dir');
mkdirSync(dest,{recursive:true});
const last=JSON.parse(original(join(lastDir,'last16-targeted-candidate-original-archive-manifest.json')).toString());
assert.equal(last.schema,'mn-2021-25-last16-targeted-uncovered-original-site-64-archive-search-windows-v1');
assert.equal(last.independentGovernmentLRLSourceSha256,govHash);
const phaBase=last.originalSourceWindows.find(w=>w.person==='Susan Pha'
 &&w.originalCandidateDomainLead==='votesusanpha.com'&&w.indexRows===300);
assert.ok(phaBase,'Missing entire original 300-row Pha candidate domain archive index');
assert.equal(phaBase.indexCappedAt300,true);
assert.ok(phaBase.fullOriginalCdxFilename);
const cdxb=original(join(lastDir,phaBase.fullOriginalCdxFilename),4000);
assert.equal(sha(cdxb),phaBase.fullOriginalCdxResponseSha256);
const oldPhaRows=JSON.parse(cdxb.toString());
assert.deepEqual(oldPhaRows[0],['timestamp','original','mimetype','statuscode','digest','length']);
assert.equal(oldPhaRows.length-1,300);
const proofFromOriginalCDX=[
 ['pha-author-2022','20221103120404','https://votesusanpha.com/author/susanpha'],
 ['pha-2021-archived-572','20210623123324','https://votesusanpha.com/572-2'],
 ['pha-2022-endorsement-chris','20221102234853','https://votesusanpha.com/home/chris-eaton'],
 ['pha-2022-mna-endorsement','20221102235819','https://votesusanpha.com/home/mna-endorsed'],
 ['pha-2022-assets-attachment','20221103022835','https://votesusanpha.com/home/bg-home-2'],
 ['pha-2022-candidate-archive','20221103124108','https://votesusanpha.com/author/susanpha/feed']
];
assert.equal(proofFromOriginalCDX.length,6);
const exactRows=proofFromOriginalCDX.map(([label,timestamp,url])=>{
 const match=oldPhaRows.slice(1).filter(v=>v[0]===timestamp&&v[1]===url&&v[3]==='200');
 assert.equal(match.length,1,'Entire authentic CDX does not independently pin Susan '+label);
 assert.ok(/^[A-Z2-7]{32}$/.test(match[0][4]));
 assert.ok(timestamp<'20221108000000');
 return {label,timestamp,originalUrl:url,archiveMimeType:match[0][2],originalCdxSHA1Base32:match[0][4]};
});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function http(url){
 let last;
 for(let attempt=1;attempt<=3;attempt++){
  const requestedAt=new Date().toISOString();
  try{
   const response=await fetch(url,{headers:{'User-Agent':'MN-Senate-Original-Historical-Candidate-Archive-Source-Research/1.0'},
    signal:AbortSignal.timeout(30000)});
   const bytes=Buffer.from(await response.arrayBuffer());
   assert.ok(bytes.length<=5000000,'Out of bounds original source bytes');
   last={status:response.status,ok:response.ok,bytes,attempt,requestedAt,receivedAt:new Date().toISOString(),
    contentType:response.headers.get('content-type'),actualUrl:response.url};
   if([429,502,503,504].includes(response.status)&&attempt<3){await pause(2000*attempt);continue;}
   return last;
  }catch(err){
   last={status:null,ok:false,bytes:Buffer.alloc(0),attempt,requestedAt,receivedAt:new Date().toISOString(),
    error:String(err).slice(0,230)};
   if(attempt<3)await pause(1400*attempt);
  }
 }
 return last;
}
function visibleSnippet(b){
 const t=originalCampaignVisibleText(b);
 const re=/\b(educat(?:ion|ional)|school|health|safety|housing|jobs|economy|tax|care|environment|climate|priorit(?:y|ies)|democra|family|police|transport)\b/ig;
 return {firstVisible1500:t.slice(0,1500),
  candidateIssuesContexts:[...t.matchAll(re)].slice(0,8).map(m=>t.slice(Math.max(0,m.index-75),Math.min(t.length,m.index+175)))};
}
async function replay(label,timestamp,url,digest,mime){
 const replayUrl='https://web.archive.org/web/'+timestamp+'id_/'+url;
 const response=await http(replayUrl);
 const rec={label,originalUrl:url,originalCaptureUtc:timestamp.replace(/^(....)(..)(..)(..)(..)(..)$/,'$1-$2-$3T$4:$5:$6.000Z'),
  fullOriginalCdxIndexedSha1Base32:digest,originalMimeType:mime,replayUrl,replayStatus:response.status,
  replayAttempts:response.attempt,replayError:response.error||null,
  originalHtmlBodySha256:response.bytes.length?sha(response.bytes):null,
  originalFullBytesMatchIndependentOriginalCdxSHA1:false,fullOriginalHtmlFile:null,
  candidateIdentityNotAutoProven:true,noIssueQuotesAutomaticallyCounted:true};
 if(response.ok&&response.status===200&&response.bytes.length>=100
  &&(mime==='text/html'||mime==='application/rss+xml')){
  rec.originalFullBytesMatchIndependentOriginalCdxSHA1=historicalArchiveSha1Base32(response.bytes)===digest;
  if(rec.originalFullBytesMatchIndependentOriginalCdxSHA1){
   rec.fullOriginalHtmlFile=label+'-'+timestamp+'-entire-original'+(mime==='application/rss+xml'?'.xml':'.html');
   writeFileSync(join(dest,rec.fullOriginalHtmlFile),response.bytes,{flag:'wx'});
   const text=visibleSnippet(response.bytes);
   rec.firstVisible1500=text.firstVisible1500;
   rec.candidateIssuesContexts=text.candidateIssuesContexts;
  }
 }
 console.log('PINNED PHA ORIGINAL ARCHIVE REPLAY '+JSON.stringify({
  label,status:response.status,independentIndexDigestMatch:rec.originalFullBytesMatchIndependentOriginalCdxSHA1}));
 return rec;
}
const recoveredKnown=[];
for(const row of exactRows){
 recoveredKnown.push(await replay(row.label,row.timestamp,row.originalUrl,
  row.originalCdxSHA1Base32,row.archiveMimeType));
 await pause(350);
}
const queries=[
 {name:'Susan Pha',originalName:'Susan Pha',district:'38',year:2022,host:'votesusanpha.com',path:'/',match:'exact',from:'20220101',to:'20221107',purpose:'2022 pre-election home original version not broad capped CDX'},
 {name:'Susan Pha',originalName:'Susan Pha',district:'38',year:2022,host:'susanphaforsenate.com',match:'domain',from:'20220101',to:'20221107',purpose:'alternate 2022 genuine original domain hypothesis, distinct from later site'},
 {name:'Scott Newman',originalName:'Scott J. Newman',district:'18',year:2020,host:'www.scottnewmanforsenate.com',path:'/issues/',match:'exact',from:'20190101',to:'20201102',purpose:'2020 original Minnesota candidate website issue nav exact target'},
 {name:'Doron Clark',originalName:'Doron Clark',district:'60',year:2025,host:'www.doronforsenate.org',path:'/priorities',match:'exact',from:'20240101',to:'20250127',purpose:'2025 pre January 28 special election priorities exact'},
 {name:'Doron Clark',originalName:'Doron Clark',district:'60',year:2025,host:'www.doronforsenate.org',path:'/',match:'exact',from:'20240101',to:'20250127',purpose:'2025 Jan 28 special election original campaign homepage'},
 {name:'Gene Dornink',originalName:'Gene Dornink',district:'27',year:2020,host:'genedorninkforsenate.com',match:'domain',from:'20160101',to:'20201102',purpose:'older 2016/2020 first-party candidate site prior original CDX gap'},
 {name:'Michael Kreun',originalName:'Michael E. Kreun',district:'32',year:2022,host:'www.michaelformnsenate.com',path:'/',match:'exact',from:'20220101',to:'20221107',purpose:'2022 original state Senate candidate home before modern refashion'},
 {name:'Mary Kiffmeyer',originalName:'Mary Kiffmeyer',district:'30',year:2020,host:'kiffmeyerforsenate.com',match:'domain',from:'20090101',to:'20201102',purpose:'historical state Senate alternative domain, NOT 2008 secretary of state site'},
 {name:'David Tomassoni',originalName:'David J. Tomassoni',district:'6',year:2020,host:'tomassoni4senate.com',match:'domain',from:'20010101',to:'20161231',purpose:'pre-spam older true Senate site only, exclude 2019 repurposed WordPress'},
 {name:'Charles Wiger',originalName:'Sr., Charles W. Wiger',district:'43',year:2020,host:'wigerforsenate.com',match:'domain',from:'20080101',to:'20201102',purpose:'alternate first party old Senate website, avoid newer personal page'},
 {name:'Thomas Bakk',originalName:'Thomas M. Bakk',district:'3',year:2020,host:'bakkforsenate.com',match:'domain',from:'20000101',to:'20201102',purpose:'real Senate domain hypothesis; former tombakk.com is 2008 Governor, exclude'},
 {name:'Julie Rosen',originalName:'Julie A. Rosen',district:'23',year:2020,host:'julierosen.com',path:'/platform.htm',match:'exact',from:'20010101',to:'20160101',purpose:'linked by genuine original March 2004 SD24 candidate website; old era depth only'}
];
assert.equal(queries.length,12);
const results=[];
let i=0;
for(const q of queries){
 const lookup=validateActualSenateServiceForElection(service,q.name,q.district,q.year);
 assert.equal(lookup.status,'verified_senate_service',q.name);
 assert.equal(lookup.officialName,q.originalName);
 const params=new URLSearchParams();
 params.set('url',q.host+(q.path||''));params.set('matchType',q.match);
 params.set('from',q.from);params.set('to',q.to);params.set('output','json');
 params.set('fl','timestamp,original,mimetype,statuscode,digest,length');
 params.append('filter','statuscode:200');
 params.append('filter','mimetype:text/html');
 if(q.match==='domain')params.set('collapse','urlkey');
 params.set('limit','120');
 const url='https://web.archive.org/cdx/search/cdx?'+params.toString();
 const index=await http(url);
 const slug=String(++i).padStart(2,'0')+'-'+q.name.toLowerCase().replace(/[^a-z0-9]+/g,'-');
 const item={person:q.name,officialSenateName:lookup.officialName,originalDistrict:q.district,
  electionYear:q.year,domain:q.host,queryPath:q.path||null,matchType:q.match,queryUrl:url,
  fromInclusive:q.from,toInclusive:q.to,purpose:q.purpose,
  originalCdxHttpStatus:index.status,indexAttempts:index.attempt,
  originalCdxResponseSha256:index.bytes.length?sha(index.bytes):null,
  originalCdxFile:null,indexError:index.error||null,indexRows:0,indexCappedAt120:false,
  originalHtmlReplays:[],noCandidateIssueStatementsAutomaticallyAdmitted:true,
  missingOrThrottledIndexNeverNoPolicy:true};
 let rows=[];
 if(!index.ok)item.indexError=item.indexError||('HTTP '+index.status);
 else try{
  const parsed=JSON.parse(index.bytes.toString('utf8'));
  assert.ok(Array.isArray(parsed)&&parsed.length>=1&&parsed.length<=121,'Unbounded CDX');
  assert.deepEqual(parsed[0],['timestamp','original','mimetype','statuscode','digest','length']);
  rows=parsed.slice(1);
  item.indexRows=rows.length;
  item.indexCappedAt120=rows.length===120;
  item.originalCdxFile=slug+'-entire-original-cdx.json';
  writeFileSync(join(dest,item.originalCdxFile),index.bytes,{flag:'wx'});
 }catch(err){item.indexError='invalid, empty, or non-CDX original index: '+String(err).slice(0,140);}
 const cutoff=q.year===2020?'20201103000000':q.year===2022?'20221108000000':q.year===2025?'20250128000000':null;
 assert.ok(cutoff);
 const ranked=rows.filter(r=>Array.isArray(r)&&r[0]<cutoff&&r[2]==='text/html'
   &&r[3]==='200'&&/^[A-Z2-7]{32}$/.test(r[4])
   &&/^(?:https?:\/\/)/.test(r[1])&&!/\.(?:png|jpe?g|svg|css|js|woff|gif)(?:$|\?)/i.test(r[1]))
  .sort((a,b)=>{
   const score=v=>/(issues?|priorities|platform|policy|education|health|about)(?:[\/.?-]|$)/i.test(v[1])?4:0;
   return score(b)-score(a)||b[0].localeCompare(a[0]);
  });
 const seen=new Set();
 for(const row of ranked){
  const key=new URL(row[1]).pathname.toLowerCase().replace(/\/$/,'');
  if(seen.has(key))continue;seen.add(key);
  if(item.originalHtmlReplays.length>=3)break;
  const result=await replay(slug+'-'+(item.originalHtmlReplays.length+1),row[0],row[1],row[4],row[2]);
  item.originalHtmlReplays.push(result);
 }
 results.push(item);
 console.log('FINAL NINE PRECISE ORIGINAL ARCHIVE WINDOW '+JSON.stringify({
  name:q.name,source:q.host+(q.path||''),CDX:index.status,rows:item.indexRows,
  originalRawArchivedHtml:item.originalHtmlReplays.filter(x=>x.fullOriginalHtmlFile).length,
  indexError:item.indexError,unknownMeansNoPositions:false}));
 await pause(600);
}
const manifest={schema:'mn-senate-final-nine-archived-original-2004-2020-2022-2025-specific-recovery-v1',
 issue:864,originalOfficialGovernmentLRLServiceSHA256:sha(officialRaw),
 original95ServingResearchCoverageSHA256:sha(prior),
 baselineActualServingSenatorPeople:95,baselineWithOriginalSiteIssueQuoteLeads:85,
 baselineAuthenticatedShortSourceRows:1093,remainingNineUniqueActuallyServedSenators:nine.map(x=>x[0]),
 historicalSearchWindows:queries.length,
 independentlyReopenedOriginalPhaFullCdxSHA256:sha(cdxb),
 independentlyReopenedOriginalPhaCdxRows:300,
 independentlySelectedFullOriginalPhaPages:recoveredKnown.length,
 retrievedExactPhaOriginals:recoveredKnown.filter(x=>x.fullOriginalHtmlFile).length,
 completeNewOriginalCdxJsonIndexes:results.filter(x=>x.originalCdxFile).length,
 completeAdditionalOriginalHTML:results.flatMap(x=>x.originalHtmlReplays).filter(x=>x.fullOriginalHtmlFile).length,
 archivedIndexRateLimitAndNoRowsNotEvidenceOfNoPolicy:true,
 exactArchiveCaptureOnlyPublicByNotOriginalAuthoredDate:true,
 historicalRosen2004SD24Not2020SenatePledge:true,
 DoronPreJanuary282025SpecialElectionStrict:true,
 automaticCandidatePolicyStatementsAdmitted:0,productionDBReadsWrites:0,
 forecastModelSchedulerChanges:0,
 priorPhaIndexedOriginalReplayProofs:recoveredKnown,historicalPreciseCdxWindows:results};
writeFileSync(join(dest,'senate-final-nine-specific-historic-originals-research-manifest.json'),
 JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log('FINAL NINE ORIGINAL ARCHIVE RESEARCH '+JSON.stringify({
  officialNine:9,preciseWindows:queries.length,pinnedPha:recoveredKnown.length,
  authenticatedNewHtml:manifest.retrievedExactPhaOriginals+manifest.completeAdditionalOriginalHTML,
  productionWrites:0}));
