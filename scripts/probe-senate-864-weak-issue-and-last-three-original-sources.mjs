/**
 * #864 read-only 2020–25 low-density candidate-position original source recovery.
 *
 * Invokes independently indexed *full original historical archive* only. A 200
 * response that is not a real CDX table is a PROVIDER FAILURE not "no record".
 * An archived body without its independently indexed SHA1 is not admitted.
 * NEVER promotes current mutable pages, third-party candidate quotations, or
 * candidate-filled form PDF versions to 2020/22/25 first-party site evidence.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,statSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {parseOfficialMnSenateServiceDirectory} from '../src/evidence/senate-official-ever-served-directory.js';
import {historicalArchiveSha1Base32,originalCampaignVisibleText} from '../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
const argv=process.argv.slice(2);
function arg(k){const i=argv.indexOf(k);assert.ok(i>=0&&argv[i+1]&&!argv[i+1].startsWith('--'),'Missing '+k);return resolve(argv[i+1]);}
const group=argv[argv.indexOf('--group')+1];
assert.ok(['low2022','clark2025','lastthree2020'].includes(group));
const out=arg('--out-dir');mkdirSync(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
function bytes(p,min=30,max=7500000){
 const s=statSync(p);assert.ok(s.isFile()&&s.size>=min&&s.size<=max,'Bad required source '+p);
 return readFileSync(p);
}
const seeds=JSON.parse(bytes(resolve('data/evaluation/senate-864-weak-and-unresolved-issue-source-research-queue-v1.json'),1000).toString());
assert.equal(seeds.schema,'mn-senate-864-low-issue-depth-doron-and-last-three-original-source-queue-v1');
assert.equal(seeds.issue,864);
assert.deepEqual([seeds.baseline.actualSenators,seeds.baseline.siteCoveredPersons,seeds.baseline.siteResearchExcerpts],[95,92,1194]);
assert.equal(seeds.productionReadsWrites,0);
const sources=seeds.groups[group].sources;
assert.ok(Array.isArray(sources)&&sources.length>=4&&sources.length<=8);
const gov=bytes(arg('--official-html'),9000);
const officialReceipt=JSON.parse(bytes(arg('--official-receipt')).toString());
const swear=bytes(arg('--official-special-swearing-html'),9000);
assert.equal(sha(gov),'bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51');
assert.equal(officialReceipt.source.sourceBytesSha256,sha(gov));
assert.equal(officialReceipt.supplementalSwearingSource.sourceBytesSha256,sha(swear));
assert.equal(officialReceipt.source.url,'https://www.lrl.mn.gov/legdb/senate_dir');
const official=parseOfficialMnSenateServiceDirectory(gov,officialReceipt.source.observedAt,swear,officialReceipt.supplementalSwearingSource.observedAt);
assert.equal(official.senators.length,105);
const roster=new Set(official.senators.filter(s=>s.senateServiceTerms.some(t=>[2021,2022,2023,2024,2025].some(y=>y>=t.startsYear&&(t.endsYear===null||y<=t.endsYear)))).map(x=>x.officialName));
assert.equal(roster.size,95);
const originalCovered=bytes(arg('--coverage-json'),10000);
const covered=JSON.parse(originalCovered.toString());
assert.equal(covered.summary.actualServingStateSenators,95);
assert.equal(covered.summary.actuallyServedSenatorsWithAnyKnownSelectedOriginalSiteExcerpt,92);
assert.equal(covered.summary.totalExactResearchExcerptRowsForVerifiedSenators,1194);
assert.equal(covered.summary.sourceOriginalGovernmentSHA256,sha(gov));
const displayOverrides=new Map([
 ['Charles Wiger','Sr., Charles W. Wiger'],
 ['David Tomassoni','David J. Tomassoni'],
 ['Thomas Bakk','Thomas M. Bakk']
]);
const norm=s=>String(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const names=[...roster];
function member(person){
 const expected=displayOverrides.get(person);
 const found=expected?names.filter(n=>n===expected):names.filter(n=>norm(n).split(' ')[0]===norm(person).split(' ')[0]&&norm(n).split(' ').at(-1)===norm(person).split(' ').at(-1));
 assert.equal(found.length,1,'Source track person not uniquely matched to actual-serving government Senate roster '+person);
 const inCoverage=covered.byActuallyServedSenator.find(x=>x.officialName===found[0]);
 assert.ok(inCoverage);
 if(group==='lastthree2020')assert.equal(inCoverage.originalSiteQuoteLeadCount,0);
 return {officialName:found[0],originalSiteResearchExcerpts:inCoverage.originalSiteQuoteLeadCount};
}
function iso(ts){assert.match(ts,/^\d{14}$/);return ts.replace(/^(....)(..)(..)(..)(..)(..)$/,'$1-$2-$3T$4:$5:$6.000Z');}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function fetchBytes(url){
 let last;
 for(let attempt=1;attempt<=2;attempt++){
  try{
   const r=await fetch(url,{headers:{'User-Agent':'VotePredict/2.0 archival candidate statements original-byte-research (issue 864)','Accept':'application/json,text/html,*/*'},signal:AbortSignal.timeout(20000)});
   const b=Buffer.from(await r.arrayBuffer());
   assert.ok(b.length<=7000000,'Oversized archive response');
   last={status:r.status,ok:r.status===200,body:b,url:r.url,contentType:r.headers.get('content-type'),attempt,error:null};
   if([429,502,503,504].includes(r.status)&&attempt===1){await pause(1300);continue;}
   return last;
  }catch(e){last={status:null,ok:false,body:Buffer.alloc(0),url,contentType:null,attempt,error:String(e).slice(0,170)};}
 }
 return last;
}
const isDigest=s=>/^[A-Z2-7]{32}$/.test(s);
function originalContext(b,source){
 const v=originalCampaignVisibleText(b);
 const last=source.person.split(' ').at(-1);
 const cue=source.identityCue||last;
 return {hasFamilyName:new RegExp('\\b'+last+'\\b','i').test(v),
  hasSourceSpecifiedIdentityCue:v.toLowerCase().includes(cue.toLowerCase()),
  sourceTextCharacters:v.length,searchContextPreview:v.slice(0,1300),
  originalCandidateSpeechOnlyByFurtherManualSentenceReview:true};
}
async function replay(src,id,entry,mode){
 const stamp=entry[0],url=entry[1],digest=entry[4];
 const u='https://web.archive.org/web/'+stamp+mode+'/'+url;
 const r=await fetchBytes(u);
 const verified=r.ok&&r.body.length>100&&historicalArchiveSha1Base32(r.body)===digest;
 const data={replayMode:mode,capturedAtUtc:iso(stamp),originalUrl:url,
  originalIndexedSha1Base32:digest,originalResponseSha256:r.body.length?sha(r.body):null,
  replayHttpStatus:r.status,replayContentType:r.contentType,exactWholeOriginalDigestVerified:verified,
  savedFullOriginalHtml:null,identitySignals:null,replayFailure:r.error};
 if(verified){
  data.savedFullOriginalHtml=id+'-'+stamp+'-'+mode+'-original.html';
  writeFileSync(join(out,data.savedFullOriginalHtml),r.body,{flag:'wx'});
  data.identitySignals=originalContext(r.body,src);
 }
 return data;
}
async function probe(src,i){
 const id=src.id;
 assert.match(id,/^[a-z0-9-]{4,55}$/);
 assert.match(src.electionDate,/^\d{4}-\d\d-\d\d$/);
 const actual=member(src.person);
 const u=new URL(src.url);assert.ok(['https:','http:'].includes(u.protocol));
 const cut=src.electionDate.replaceAll('-','');
 const isPdf=/\.pdf(?:\?|$)/i.test(src.url);
 const query=new URLSearchParams({
  url:src.url,matchType:'exact',from:group==='lastthree2020'?'20000101':(group==='clark2025'?'20240101':'20200101'),
  to:cut,output:'json',fl:'timestamp,original,mimetype,statuscode,digest,length',limit:'100'});
 query.append('filter','statuscode:200');
 if(isPdf)query.append('filter','mimetype:application/pdf');
 else query.append('filter','mimetype:text/html');
 const indexUrl='https://web.archive.org/cdx/search/cdx?'+query.toString();
 const idx=await fetchBytes(indexUrl);
 const res={id,person:src.person,governmentOfficialName:actual.officialName,
  originalSelectedFirstPartySiteExcerpts:actual.originalSiteResearchExcerpts,
  sourceKind:src.sourceKind,sourceDateClaimNotCertified:src.dateClaim,
  sourceUrl:src.url,sourceElectionCutoff:src.electionDate,
  originalIndexUrl:indexUrl,indexHttpStatus:idx.status,indexResponseContentType:idx.contentType,
  indexResponseSha256:idx.body.length?sha(idx.body):null,
  indexError:idx.error,wholeOriginalCDXFile:null,wholeIndexRowCount:null,
  indexMayBeTruncated:false,completeOriginalPreElectionBytesDigestVerified:false,
  verifiedOriginalBytesCandidateIdentityNeedsManualReview:true,
  originalCandidateOwnedSameElectionSiteAuthenticatedAutomatically:false,
  automaticPublisherSpeakerExcerpts:0,siteCoverageIncrement:0,
  fullOriginalReplays:[]};
 if(!idx.ok){res.indexError=res.indexError||'INDEX_HTTP_'+idx.status;return res;}
 let items=[];
 try{
  const js=JSON.parse(idx.body.toString());
  assert.ok(Array.isArray(js)&&js.length>=1&&js.length<=101);
  assert.deepEqual(js[0],['timestamp','original','mimetype','statuscode','digest','length']);
  res.wholeIndexRowCount=js.length-1;res.indexMayBeTruncated=js.length===101;
  res.wholeOriginalCDXFile=id+'-complete-original-CDX.json';
  writeFileSync(join(out,res.wholeOriginalCDXFile),idx.body,{flag:'wx'});
  items=js.slice(1).filter(e=>e[0]&&/^\d{14}$/.test(e[0])&&e[0]<cut+'000000'&&
   e[3]==='200'&&isDigest(e[4])&&(e[2]==='text/html'||isPdf&&e[2]==='application/pdf'));
 }catch(e){res.indexError='HTTP_200_NON_CDX_OR_WRONG_HEADER:'+String(e).slice(0,175);return res;}
 // Prefer archive closest to its historical election, never a later edited site.
 items.sort((a,b)=>b[0].localeCompare(a[0]));
 const sampled=new Set();
 for(const entry of items){
  // Distinct historical original bodies rather than 100 identical captures.
  if(sampled.has(entry[4]))continue;
  sampled.add(entry[4]);
  for(const mode of ['id_','if_','mp_','']){
   const r=await replay(src,id,entry,mode);
   res.fullOriginalReplays.push(r);
   if(r.exactWholeOriginalDigestVerified)break;
  }
  if(sampled.size>=2)break;
 }
 res.completeOriginalPreElectionBytesDigestVerified=res.fullOriginalReplays.some(r=>r.exactWholeOriginalDigestVerified);
 return res;
}
const results=new Array(sources.length);
let ptr=0;
await Promise.all(new Array(Math.min(3,sources.length)).fill(0).map(async()=>{
 while(ptr<sources.length){
  const k=ptr++;try{results[k]=await probe(sources[k],k);}catch(e){
   results[k]={id:sources[k].id,person:sources[k].person,
    sourceUrl:sources[k].url,researchError:String(e).slice(0,300),
    completeOriginalPreElectionBytesDigestVerified:false,siteCoverageIncrement:0};
  }
 }
}));
const result={schema:'mn-senate-864-three-track-weak-position-source-original-probes-v1',issue:864,group,
 originalOfficialSenateDirectorySha256:sha(gov),sourceCoverageReportSha256:sha(originalCovered),
 genuineActualServingSenators:95,preExistingCandidateSitePeople:92,
 preExistingCandidateSiteExcerptRows:1194,sourceCount:results.length,
 originalCDXIndexesAuthenticated:results.filter(r=>r.wholeOriginalCDXFile).length,
 originalWholeBodiesDigestAuthenticated:results.reduce((s,r)=>s+r.fullOriginalReplays?.filter(p=>p.exactWholeOriginalDigestVerified).length||0,0),
 verifiedOriginalSourceTargets:results.filter(r=>r.completeOriginalPreElectionBytesDigestVerified).length,
 probedSources:results,noStatementAutoAdmitted:true,notSameElectionCandidatePlatformByDefault:true,
 providerErrorsDoNotImplyNoHistoricalSource:true,sourceCategoryPublisherNotCandidateOwnedByDefault:true,
 noProductionReadsWrites:true,noForecastChanges:true};
const output='senate-864-'+group+'-weak-position-deep-original-archive-audit.json';
writeFileSync(join(out,output),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log('HISTORICAL ORIGINALS '+JSON.stringify({group,sourceCount:result.sourceCount,
 indexBodies:result.originalCDXIndexesAuthenticated,authenticCompleteOriginalHtmlBodies:result.originalWholeBodiesDigestAuthenticated,
 coveredSourceTargets:result.verifiedOriginalSourceTargets,noAutoPromoted:true,
 status:results.map(r=>({id:r.id,indexStatus:r.indexHttpStatus,indexRows:r.wholeIndexRowCount,
 verified:r.completeOriginalPreElectionBytesDigestVerified,error:r.indexError||r.researchError||null}))},null,2));
