/**
 * VotePredict #864 five low-depth Minnesota Senate original campaign source probe.
 * Research-only and ZERO production/model side effects.
 *
 * Only an independently indexed SHA1/CDX digest-matching complete ORIGINAL
 * pre-election HTML body can even be considered as potential candidate evidence.
 * Site ownership, exact speaker scope, issue specificity, and other-election
 * provenance require a separate independent audit. A Wayback HTTP 200 that is
 * not a valid full CDX table is an error; never conclude no website or policy.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {parseOfficialMnSenateServiceDirectory,validateActualSenateServiceForElection}
 from '../src/evidence/senate-official-ever-served-directory.js';
import {historicalArchiveSha1Base32,originalCampaignVisibleText}
 from '../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
const av=process.argv.slice(2);
function arg(k){const n=av.indexOf(k);assert.ok(n>=0&&av[n+1]&&!av[n+1].startsWith('--'),'Missing '+k);return resolve(av[n+1]);}
const group=av[av.indexOf('--track')+1];
assert.ok(['kari','weber','newman','wesenberg','klein'].includes(group),'Unknown track');
const out=arg('--out-dir');mkdirSync(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
function getFile(p,min=20,max=8000000){const st=statSync(p);assert.ok(st.isFile()&&st.size>=min&&st.size<=max,'Original evidence missing '+p);return readFileSync(p);}
const manifest=JSON.parse(getFile(resolve('data/evaluation/senate-864-five-thin-served-senator-firstparty-original-targets-v1.json'),1500).toString());
assert.equal(manifest.schema,'senate-864-five-selected-weak-served-senators-new-original-firstparty-site-probe-v1');
assert.equal(manifest.issue,864);
assert.equal(manifest.baseline.actualServed2021_25Senators,95);
assert.equal(manifest.baseline.peopleWithAnyPreviouslyVerifiedCandidateOwnedSiteExcerpts,92);
assert.equal(manifest.baseline.selectedAuthenticatedCandidateOwnedResearchExcerpts,1272);
assert.equal(manifest.productionDbReadWrites,0);
const candidate=manifest.tracks[group];
assert.ok(candidate&&candidate.probes.length===6);
const officialHtml=getFile(arg('--official-html'),9000),receipt=JSON.parse(getFile(arg('--official-receipt')).toString());
const swearHtml=getFile(arg('--official-special-swearing-html'),9000);
assert.equal(sha(officialHtml),manifest.baseline.sourceGovernmentSha256);
assert.equal(receipt.source.url,'https://www.lrl.mn.gov/legdb/senate_dir');
assert.equal(receipt.source.sourceBytesSha256,sha(officialHtml));
assert.equal(receipt.supplementalSwearingSource.sourceBytesSha256,sha(swearHtml));
const service=parseOfficialMnSenateServiceDirectory(officialHtml,receipt.source.observedAt,swearHtml,receipt.supplementalSwearingSource.observedAt);
assert.equal(service.senators.length,105);
const actual=validateActualSenateServiceForElection(service,candidate.name,candidate.district,candidate.electionYear);
assert.equal(actual.status,'verified_senate_service');
assert.equal(actual.officialName,candidate.officialName);
assert.equal(actual.serviceForThisElectionFollowingYearVerified,true);
const reportRaw=getFile(arg('--augmented-matrix-json'),10000),coverage=JSON.parse(reportRaw.toString());
assert.equal(coverage.summary.actualServingSenators,95);
assert.equal(coverage.summary.authenticatedOriginalSitePeople,92);
assert.equal(coverage.summary.totalSelectedAuthenticatedCandidateSiteResearchFragments,1272);
assert.equal(coverage.byActuallyServedSenator.length,95);
const original=coverage.byActuallyServedSenator.find(x=>x.officialName===candidate.officialName);
assert.ok(original);
assert.equal(original.campaignSiteResearchExcerptsAfterAddendum,candidate.baselineOriginalSiteResearchExcerpts);
const cooldown=ms=>new Promise(r=>setTimeout(r,ms));
async function fetchArchive(url){
 let last={status:null,ok:false,body:Buffer.alloc(0),url,error:'unattempted'};
 for(let attempt=1;attempt<=2;attempt++){
  try{
   const r=await fetch(url,{headers:{accept:'application/json,text/html;q=0.9,*/*;q=0.4','User-Agent':'MN-Senate-historic-candidate-source-research/1.0'},signal:AbortSignal.timeout(20000)});
   const body=Buffer.from(await r.arrayBuffer());
   assert.ok(body.length<=6500000,'Archive payload over 6.5MB limit');
   last={status:r.status,ok:r.status===200,body,url:r.url,error:null,contentType:r.headers.get('content-type'),attempt};
   if(attempt===1&&[429,500,502,503,504].includes(r.status)){await cooldown(1100);continue;}
   return last;
  }catch(e){last={status:null,ok:false,body:Buffer.alloc(0),url,error:String(e).slice(0,180),attempt};}
 }
 return last;
}
const validDigest=s=>/^[A-Z2-7]{32}$/.test(s);
const utc=t=>t.replace(/^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)$/,'$1-$2-$3T$4:$5:$6.000Z');
function sourceIdentity(body){
 const visible=originalCampaignVisibleText(body);
 const name=candidate.name,last=candidate.name.split(' ').at(-1);
 const domain=/prepared.{0,40}paid for|paid for by|contributions.{0,30}committee/i;
 return {
  personFullNameFound:visible.toLowerCase().includes(name.toLowerCase()),
  personSurnameFound:new RegExp('\\b'+last+'\\b','i').test(visible),
  originalCampaignOwnershipFooterCue:domain.test(visible),
  historicSenateDistrictCue:new RegExp('(?:SD\\s*|district\\s*)'+candidate.district+'\\b','i').test(visible),
  originalVisibleCharLength:visible.length,
  originalVisiblePreviewForResearch:visible.slice(0,1500),
  officialPolicySiteIdentityCertifiedAutomatically:false,
  sourceQuoteAutomaticallyAccepted:0
 };
}
async function replay(record,id,mode){
 const [ts,url,mime,status,digest]=record;
 assert.match(ts,/^\d{14}$/);assert.ok(validDigest(digest));
 const archive='https://web.archive.org/web/'+ts+mode+'/'+url;
 const r=await fetchArchive(archive);
 const valid=r.ok&&r.body.length>100&&historicalArchiveSha1Base32(r.body)===digest;
 const data={mode,originalUrl:url,archiveCaptureUtc:utc(ts),indexedOriginalSHA1Base32:digest,
  fullResponseSha256:r.body.length?sha(r.body):null,originalHttpStatus:r.status,
  originalIndexedDigestEqualsCompleteHtml:valid,fullOriginalHtmlFile:null,
  sourceOwnershipSignals:null,replayError:r.error};
 if(valid){
  const file=id+'-'+ts+'-'+mode+'-original.html';
  writeFileSync(join(out,file),r.body,{flag:'wx'});
  data.fullOriginalHtmlFile=file;
  data.sourceOwnershipSignals=sourceIdentity(r.body);
 }
 return data;
}
async function one(src){
 const q=new URL(src.url);
 assert.ok(['https:','http:'].includes(q.protocol));
 assert.match(src.id,/^[a-z0-9-]{4,65}$/);
 assert.ok(['exact','prefix','domain'].includes(src.matchType));
 const prefix=src.matchType==='domain'?'domain':src.matchType;
 const cutoff=candidate.electionDate.replaceAll('-','')+'000000';
 const params=new URLSearchParams({url:src.url,matchType:prefix,from:'20100101',
  to:candidate.electionDate.replaceAll('-',''),output:'json',
  fl:'timestamp,original,mimetype,statuscode,digest,length',limit:'100'});
 params.append('filter','statuscode:200');params.append('filter','mimetype:text/html');
 const indexUrl='https://web.archive.org/cdx/search/cdx?'+params.toString();
 const response=await fetchArchive(indexUrl);
 const result={id:src.id,sourceUrl:src.url,sourceKind:src.sourceClass,
  sourceQueryReason:src.reason,matchType:src.matchType,originalIndexUrl:indexUrl,
  indexStatus:response.status,indexContentType:response.contentType??null,
  indexResponseSha256:response.body.length?sha(response.body):null,indexRows:null,indexMayBeTruncated:false,
  originalWholeCdxFile:null,invalidIndexResponseReason:response.error,
  matchedCompletePreElectionOriginalPages:0,replays:[],
  newResearchExcerptsAutomaticallyAccepted:0,
  domainOwnershipVerifiedAutomatically:false};
 if(!response.ok){result.invalidIndexResponseReason=result.invalidIndexResponseReason||'Archive index HTTP '+response.status;return result;}
 let rows=[];
 try{
  const decoded=JSON.parse(response.body.toString());
  assert.ok(Array.isArray(decoded)&&decoded.length>0&&decoded.length<=101);
  assert.deepEqual(decoded[0],['timestamp','original','mimetype','statuscode','digest','length']);
  rows=decoded.slice(1);
  result.indexRows=rows.length;
  result.indexMayBeTruncated=rows.length===100;
  result.originalWholeCdxFile=src.id+'-whole-original-index.json';
  writeFileSync(join(out,result.originalWholeCdxFile),response.body,{flag:'wx'});
 }catch(e){result.invalidIndexResponseReason='Provider 200 non-CDX original: '+String(e).slice(0,160);return result;}
 const acceptable=rows.filter(r=>r[0]&&/^\d{14}$/.test(r[0])&&r[0]<cutoff&&r[2]==='text/html'&&r[3]==='200'&&validDigest(r[4]));
 acceptable.sort((a,b)=>b[0].localeCompare(a[0]));
 const seen=new Set();
 for(const row of acceptable){
  if(seen.has(row[4]))continue;
  seen.add(row[4]);
  for(const mode of ['id_','if_','mp_','']){
   const attempt=await replay(row,src.id,mode);
   result.replays.push(attempt);
   if(attempt.originalIndexedDigestEqualsCompleteHtml){result.matchedCompletePreElectionOriginalPages++;break;}
  }
  if(seen.size===2)break;
 }
 return result;
}
let ptr=0;const results=new Array(candidate.probes.length);
await Promise.all(Array.from({length:Math.min(2,results.length)},async()=>{
 while(ptr<candidate.probes.length){
  const i=ptr++;
  try{results[i]=await one(candidate.probes[i]);}catch(e){
   results[i]={id:candidate.probes[i].id,sourceUrl:candidate.probes[i].url,
    probeError:String(e).slice(0,300),matchedCompletePreElectionOriginalPages:0,
    newResearchExcerptsAutomaticallyAccepted:0};
  }
 }
}));
const report={schema:'senate-864-five-weak-original-owned-candidate-pages-historical-probe-results-v1',
 issue:864,track:group,person:candidate.name,officialName:actual.officialName,originalElectionDate:candidate.electionDate,
 originalGovernmentSha256:sha(officialHtml),baselineAugmentedMatrixSha256:sha(reportRaw),
 independentlyValidatedSenateService:true,actualServingSenators:95,
 earlierCandidateSitePeople:92,earlierCandidateSiteExcerptRows:1272,
 earlierSelectedExcerptsForThisPerson:candidate.baselineOriginalSiteResearchExcerpts,
 historicalOriginalDomainQueries:results.length,validOriginalCdxIndexes:results.filter(r=>r.originalWholeCdxFile).length,
 preElectionFullHtmlDigestMatchingPages:results.reduce((sum,r)=>sum+(r.matchedCompletePreElectionOriginalPages||0),0),
 sources:results,providerErrorsOrNoIndexDoesNotProveNoPolicy:true,originalCaptureNotOriginalAuthoredDate:true,
 originalWholeIndexDigestMustMatchFullHTML:true,originalOfficeAndCandidateIdentityManualAuditRequired:true,
 publisherSourceNotCampaignSite:true,noAutoQuotedPositions:true,productionReadsWrites:0,
 forecastOrModelChanges:0};
writeFileSync(join(out,'senate-864-five-weak-original-'+group+'-acquisition-report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log('ORIGINAL SITE DEPTH '+JSON.stringify({track:group,person:candidate.name,
 indexCount:report.validOriginalCdxIndexes,wholeDigestMatchedPages:report.preElectionFullHtmlDigestMatchingPages,
 bySource:results.map(r=>({id:r.id,index:r.indexRows,full:r.matchedCompletePreElectionOriginalPages,
  error:r.invalidIndexResponseReason||r.probeError||null})),positionsAutoAccepted:0},null,2));
