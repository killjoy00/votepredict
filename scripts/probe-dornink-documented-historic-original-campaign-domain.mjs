/**
 * #864: Original historical Gene Dornink campaign domain acquisition.
 * Contemporary 2020 SD27 and 2022 SD23 print candidate advertising names
 * dorninkforsenate.com (different from the previously probed
 * genedorninkforsenate.com). Reopen entire original LRL state Senate service,
 * constrain public Wayback CDX/replays to before each original election.
 * Source acquisition only: never classify as 2020/2022 policy without audited
 * full original HTML, authenticated ownership, and exact literal excerpt.
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
const args=process.argv.slice(2);
function arg(k){const i=args.indexOf(k);assert.ok(i>=0&&args[i+1]&&!args[i+1].startsWith('--'),'Missing '+k);return resolve(args[i+1]);}
function original(p,min=50,max=6000000){const st=statSync(p);assert.ok(st.isFile()&&st.size>=min&&st.size<=max,p);return readFileSync(p);}
const officialHtml=original(arg('--official-html'),9000);
const receipt=JSON.parse(original(arg('--official-receipt')).toString());
const swearing=original(arg('--official-special-swearing-html'),9000);
assert.equal(sha(officialHtml),govHash);assert.equal(receipt.source.sourceBytesSha256,govHash);
assert.equal(receipt.source.url,'https://www.lrl.mn.gov/legdb/senate_dir');
assert.equal(sha(swearing),receipt.supplementalSwearingSource.sourceBytesSha256);
const service=parseOfficialMnSenateServiceDirectory(
 officialHtml,receipt.source.observedAt,swearing,receipt.supplementalSwearingSource.observedAt);
assert.equal(service.senators.length,105);
for(const [district,year] of [['27',2020],['23',2022]]){
 const m=validateActualSenateServiceForElection(service,'Gene Dornink',district,year);
 assert.equal(m.status,'verified_senate_service');
 assert.equal(m.officialName,'Gene Dornink');
 assert.equal(m.serviceForThisElectionFollowingYearVerified,true);
}
const known=JSON.parse(original(arg('--prior-86-coverage-json'),9000,2000000).toString());
assert.equal(known.summary.actualServingStateSenators,95);
assert.equal(known.summary.actuallyServedSenatorsWithAnyKnownSelectedOriginalSiteExcerpt,86);
assert.equal(known.summary.totalExactResearchExcerptRowsForVerifiedSenators,1105);
assert.equal(known.summary.actuallyServedSenatorsUnobservedInSelectedOriginalSiteSourceLedgers,9);
const d=known.byActuallyServedSenator.find(x=>x.officialName==='Gene Dornink');
assert.ok(d);assert.equal(d.originalSiteQuoteLeadCount,0);
const windows=[
 {key:'dornink-2020-home',host:'dorninkforsenate.com',path:'/',match:'exact',year:2020,district:'27',from:'20160101',to:'20201102'},
 {key:'dornink-2020-www',host:'www.dorninkforsenate.com',path:'/',match:'exact',year:2020,district:'27',from:'20160101',to:'20201102'},
 {key:'dornink-2020-domain',host:'dorninkforsenate.com',match:'domain',year:2020,district:'27',from:'20160101',to:'20201102'},
 {key:'dornink-2022-www',host:'www.dorninkforsenate.com',path:'/',match:'exact',year:2022,district:'23',from:'20210101',to:'20221107'},
 {key:'dornink-2022-domain',host:'dorninkforsenate.com',match:'domain',year:2022,district:'23',from:'20210101',to:'20221107'},
 {key:'dornink-2022-issues',host:'dorninkforsenate.com',path:'/issues',match:'prefix',year:2022,district:'23',from:'20210101',to:'20221107'}
];
assert.equal(windows.length,6);
const out=arg('--out-dir');mkdirSync(out,{recursive:true});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function request(url){
 let result;
 for(let attempt=1;attempt<=3;attempt++){
  const when=new Date().toISOString();
  try{
   const res=await fetch(url,{headers:{'User-Agent':'MN-Senate-Authentic-Candidate-Original-Research/1.0'},
    signal:AbortSignal.timeout(30000)});
   const bytes=Buffer.from(await res.arrayBuffer());
   assert.ok(bytes.length<=4000000,'Archive return too large');
   result={status:res.status,ok:res.ok,bytes,attempt,when,actualUrl:res.url};
   if([429,502,503,504].includes(res.status)&&attempt<3){
    await pause(1500*attempt);continue;
   }
   return result;
  }catch(e){
   result={status:null,ok:false,bytes:Buffer.alloc(0),attempt,when,error:String(e).slice(0,200)};
   if(attempt<3)await pause(1800*attempt);
  }
 }
 return result;
}
const seenOriginals=new Set();
const reports=[];
for(const w of windows){
 const u=new URL('https://web.archive.org/cdx/search/cdx');
 const fields={url:w.host+(w.path||''),matchType:w.match,
   from:w.from,to:w.to,output:'json',
   fl:'timestamp,original,mimetype,statuscode,digest,length',
   filter:'statuscode:200',limit:'150'};
 for(const [k,v] of Object.entries(fields))u.searchParams.set(k,v);
 if(w.match==='domain')u.searchParams.set('collapse','urlkey');
 const cdx=await request(u.toString());
 const info={...w,indexQueryUrl:u.toString(),originalCdxHttpStatus:cdx.status,
  originalCdxAttempts:cdx.attempt,indexError:cdx.error||null,
  originalCdxBytesSha256:cdx.bytes.length?sha(cdx.bytes):null,
  originalCdxFile:null,originalCdxRows:0,originalCdxCapped:false,replays:[],
  archiveCaptureNotOriginalAuthorship:true,
  failedOrEmptyArchiveQueryDoesNotProveNoPolicy:true};
 let rows=[];
 if(!cdx.ok)info.indexError=info.indexError||'CDX HTTP '+cdx.status;
 else try{
  const p=JSON.parse(cdx.bytes.toString('utf8'));
  assert.ok(Array.isArray(p)&&p.length>=1&&p.length<=151);
  assert.deepEqual(p[0],['timestamp','original','mimetype','statuscode','digest','length']);
  rows=p.slice(1);info.originalCdxRows=rows.length;
  info.originalCdxCapped=rows.length===150;
  info.originalCdxFile=w.key+'-full-original-cdx.json';
  writeFileSync(join(out,info.originalCdxFile),cdx.bytes,{flag:'wx'});
 }catch(e){info.indexError='CDX shape/bytes unavailable '+String(e).slice(0,160);}
 const cutoff=w.year===2020?'20201103000000':'20221108000000';
 const ranked=rows.filter(row=>Array.isArray(row)&&row[0]<cutoff&&row[2]==='text/html'
   &&row[3]==='200'&&/^[A-Z2-7]{32}$/.test(row[4])
   &&/^https?:\/\//.test(row[1])
   &&!/\/(?:feed|tag|category|wp-content|wp-json)\b/i.test(row[1]))
  .sort((a,b)=>{
   const score=x=>/(issues?|priorities|platform|education|about|policy|taxes|health)/i.test(x[1])?10:0;
   return score(b)-score(a)||b[0].localeCompare(a[0]);
  });
 const seenPaths=new Set();
 for(const item of ranked){
  const path=new URL(item[1]).pathname.toLowerCase().replace(/\/$/,'');
  if(seenPaths.has(path))continue;seenPaths.add(path);
  if(info.replays.length===4)break;
  const originalKey=item[0]+'|'+item[1]+'|'+item[4];
  if(seenOriginals.has(originalKey))continue;seenOriginals.add(originalKey);
  const url='https://web.archive.org/web/'+item[0]+'id_/'+item[1];
  const response=await request(url);
  const cap=item[0].replace(/^(....)(..)(..)(..)(..)(..)$/,'$1-$2-$3T$4:$5:$6.000Z');
  const result={originalCandidateUrl:item[1],archiveCaptureUtc:cap,
   indexedOriginalSha1Base32:item[4],originalArchiveReplayUrl:url,
   replayHttpStatus:response.status,replayAttempts:response.attempt,
   responseSha256:response.bytes.length?sha(response.bytes):null,
   wholeHtmlBytesMatchOriginalCdxSha1:false,originalHtmlFile:null,
   originalCandidateIdentityInVisibleText:false,candidateIssuesPreview:[],requiresIndependentQuoteAudit:true};
  if(response.ok&&response.status===200&&response.bytes.length>150){
   result.wholeHtmlBytesMatchOriginalCdxSha1=historicalArchiveSha1Base32(response.bytes)===item[4];
   if(result.wholeHtmlBytesMatchOriginalCdxSha1){
    const v=originalCampaignVisibleText(response.bytes);
    result.originalCandidateIdentityInVisibleText=/Gene Dornink|Dornink for Senate|Friends of Gene Dornink/i.test(v);
    if(result.originalCandidateIdentityInVisibleText){
     result.originalHtmlFile=w.key+'-'+info.replays.length+'-'+item[0]+'-full-original.html';
     writeFileSync(join(out,result.originalHtmlFile),response.bytes,{flag:'wx'});
     result.candidateIssuesPreview=[...v.matchAll(/\b(health|jobs?|education|schools?|business|taxes?|spending|police|labor|agriculture|second amendment|parent)\b/ig)]
      .slice(0,12).map(m=>v.slice(Math.max(0,m.index-80),Math.min(v.length,m.index+180)));
     result.visibleFirst2000=v.slice(0,2000);
    }
   }
  }
  info.replays.push(result);
 }
 reports.push(info);
 console.log('DORNINK HISTORIC DOCUMENTED DOMAIN ORIGINAL WINDOW '+JSON.stringify({
  window:w.key,CDX:info.originalCdxHttpStatus,rows:info.originalCdxRows,
  originals:info.replays.filter(r=>r.originalHtmlFile).length,
  error:info.indexError}));
 await pause(600);
}
const proof={schema:'mn-senate-gene-dornink-documented-2020-22-campaign-domain-originals-v1',
 issue:864,officialFullLRLServiceSourceSHA256:sha(officialHtml),
 separatelyIndependentlyServiceMatchedOriginalElections:[
  {electionYear:2020,senateDistrict:'27'},{electionYear:2022,senateDistrict:'23'}],
 documentedHistoricalCandidateOwnedDomain:'dorninkforsenate.com',
 publisherOriginalLead2022:'Waseca County Pioneer 2022 primary printed candidate advertisement',
 otherPreviouslyFailedDistinctDomain:'genedorninkforsenate.com',
 publiclyVerifiedOriginalCampaignAdNotEqualFullOriginalHTML:true,
 previousOfficial95MemberCoverageWithQuotes:86,
 researchDateConstrainedOriginalCDXWindows:windows.length,
 preservedFullRawWaybackCDXIndexes:reports.filter(x=>x.originalCdxFile).length,
 fullSHA1VerifiedOriginalCandidateOwnedHTML:reports.flatMap(x=>x.replays).filter(x=>x.originalHtmlFile).length,
 originalFirstAuthoredDateProven:false,
 quotesAutomaticallyClassified:0,
 officialLegislativeVotesVerifiedFromCampaignText:0,productionDatabaseReadsWrites:0,
 modelForecastTrainingSchedulerChanges:0,queryOutcomes:reports};
writeFileSync(join(out,'gene-dornink-authentic-original-historical-domain-research-manifest.json'),
 JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
console.log('DORNINK VERIFIED ORIGINAL SITE ACQUISITION '+JSON.stringify({
 windows:proof.researchDateConstrainedOriginalCDXWindows,
 archiveIndexes:proof.preservedFullRawWaybackCDXIndexes,
 authenticatedFirstPartyOriginalHtml:proof.fullSHA1VerifiedOriginalCandidateOwnedHTML,
 forecastOrProductionWrites:0}));
