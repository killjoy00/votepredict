/**
 * #864 independently attempt BOTH Common Crawl January 2025 WARC records
 * (CC-MAIN-2025-05, Jan 12-26) and exact original Wayback sources for Doron
 * Clark's Jan 28, 2025 special-election campaign.
 * Never interpret a current 2026 campaign site as pre-election content.
 * Only retain independently SHA1/CDX-matched original source bodies; all
 * failures are bounded UNKNOWN; zero forecast or production work.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {readFileSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {parseOfficialMnSenateServiceDirectory,validateActualSenateServiceForElection}
 from '../src/evidence/senate-official-ever-served-directory.js';
import {historicalArchiveSha1Base32,originalCampaignVisibleText}
 from '../src/evidence/senate-authenticated-campaign-excerpt-audit.js';
const sha=b=>createHash('sha256').update(b).digest('hex');
const govSHA='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const coverageSHA='a59826f30bd46fd955d9136091ae18c00977351f2420f1f55819264a15f68713';
const args=process.argv.slice(2);
function arg(k){const i=args.indexOf(k);assert.ok(i>=0&&args[i+1]&&!args[i+1].startsWith('--'),'Missing '+k);return resolve(args[i+1]);}
function read(p,min=50,max=6000000){const st=statSync(p);assert.ok(st.isFile()&&st.size>=min&&st.size<=max,p);return readFileSync(p);}
const destination=arg('--out-dir');mkdirSync(destination,{recursive:true});
const gov=read(arg('--official-html'),9000),receipt=JSON.parse(read(arg('--official-receipt')).toString()),
 swear=read(arg('--official-special-swearing-html'),9000);
assert.equal(sha(gov),govSHA);
assert.equal(receipt.source.sourceBytesSha256,govSHA);
assert.equal(sha(swear),receipt.supplementalSwearingSource.sourceBytesSha256);
const official=parseOfficialMnSenateServiceDirectory(gov,receipt.source.observedAt,
 swear,receipt.supplementalSwearingSource.observedAt);
assert.equal(official.senators.length,105);
const member=validateActualSenateServiceForElection(official,'Doron Clark','60',2025);
assert.equal(member.status,'verified_senate_service');
assert.equal(member.officialName,'Doron Clark');
assert.equal(member.serviceForThisElectionFollowingYearVerified,true);
const cb=read(arg('--coverage-json'),9000,2000000);
assert.equal(sha(cb),coverageSHA);
const coverage=JSON.parse(cb.toString());
assert.equal(coverage.summary.actualServingStateSenators,95);
assert.equal(coverage.summary.actuallyServedSenatorsWithAnyKnownSelectedOriginalSiteExcerpt,87);
assert.equal(coverage.summary.actuallyServedSenatorsUnobservedInSelectedOriginalSiteSourceLedgers,8);
assert.equal(coverage.summary.totalExactResearchExcerptRowsForVerifiedSenators,1140);
assert.equal(coverage.byActuallyServedSenator.find(x=>x.officialName==='Doron Clark').originalSiteQuoteLeadCount,0);
const before='2025-01-28T00:00:00.000Z';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function retrieve(url,headers={},timeout=25000){
 let o;
 for(let attempt=1;attempt<=2;attempt++){
  try{
   const res=await fetch(url,{headers:{'User-Agent':'MN-Historical-Campaign-Independent-Public-Source-Audit/1.0',...headers},
    signal:AbortSignal.timeout(timeout)});
   const bytes=Buffer.from(await res.arrayBuffer());
   assert.ok(bytes.length<6500000,'Unbounded archive source response');
   o={httpStatus:res.status,ok:res.ok,bytes,attempt,returnedUrl:res.url,
    rangeResponse:res.headers.get('content-range'),
    contentType:res.headers.get('content-type')};
   if([429,502,503,504].includes(res.status)&&attempt<2){await sleep(1200);continue;}
   return o;
  }catch(error){
   o={httpStatus:null,ok:false,bytes:Buffer.alloc(0),attempt,error:String(error).slice(0,250)};
  }
 }
 return o;
}
function ensurePreElectionTimestamp(d,context){
 const v=d.length===14?d.replace(/^(....)(..)(..)(..)(..)(..)$/,'$1-$2-$3T$4:$5:$6.000Z'):new Date(d).toISOString();
 assert.ok(!Number.isNaN(Date.parse(v)),context+' invalid capture');
 assert.ok(v<before,context+' after special election');
 return v;
}
function withinCandidateDomain(url){
 try{const h=new URL(url).hostname.toLowerCase();
  return h==='doronforsenate.org'||h.endsWith('.doronforsenate.org');
 }catch{return false;}
}
function cues(original){
 const t=originalCampaignVisibleText(original);
 return {candidateVisible:/Doron Clark|Doron for Senate/i.test(t),
  candidateIssueContext:[...t.matchAll(/\b(education|schools?|housing|healthcare|safety|transportation|climate|police|rights|priorities|taxes|affordable)\b/gi)]
   .slice(0,10).map(m=>t.slice(Math.max(0,m.index-80),Math.min(t.length,m.index+180))),
  visibleFirst2500:t.slice(0,2500)};
}
function parseHeaders(raw){
 return Object.fromEntries(raw.split(/\r?\n/).slice(1)
  .filter(x=>x.includes(':')).map(s=>[s.slice(0,s.indexOf(':')).toLowerCase(),s.slice(s.indexOf(':')+1).trim()]));
}
function unpackWarc(bytes){
 const raw=gunzipSync(bytes);
 assert.ok(raw.length<=8000000);
 const div=raw.indexOf('\r\n\r\n');
 assert.ok(div>5,'Missing WARC header');
 const h=raw.subarray(0,div).toString();
 assert.ok(h.startsWith('WARC/1.'),'Not an independently original WARC');
 const headers=parseHeaders(h);
 assert.equal(headers['warc-type'],'response','Not original web response');
 const rest=raw.subarray(div+4);
 const div2=rest.indexOf('\r\n\r\n');
 assert.ok(div2>5,'Missing original HTTP record headers');
 const http=rest.subarray(0,div2).toString();
 assert.match(http,/^HTTP\/[\d.]+ 200\b/,'HTTP 200 not original');
 const body=rest.subarray(div2+4);
 assert.ok(body.length>100);
 return {body,warcHeaders:headers,httpHeaders:parseHeaders(http),wholeUncompressedWarcSHA256:sha(raw)};
}
const ccSearch=[
 {key:'january2025-domain',crawl:'CC-MAIN-2025-05',domain:'doronforsenate.org',match:'domain'},
 {key:'december2024-domain',crawl:'CC-MAIN-2024-51',domain:'doronforsenate.org',match:'domain'},
 {key:'january2025-priorities',crawl:'CC-MAIN-2025-05',domain:'www.doronforsenate.org/priorities',match:'exact'},
 {key:'january2025-home',crawl:'CC-MAIN-2025-05',domain:'www.doronforsenate.org/',match:'exact'}
];
const cc=[];
for(const q of ccSearch){
 const params=new URLSearchParams({url:q.domain+(q.match==='domain'?'/*':''),
  matchType:q.match,output:'json'});
 params.append('filter','status:200');
 const indexUrl='https://index.commoncrawl.org/'+q.crawl+'-index?'+params.toString();
 const r=await retrieve(indexUrl);
 const record={key:q.key,collection:q.crawl,queryUrl:indexUrl,indexStatus:r.httpStatus,
  completeIndexResponseSHA256:r.bytes.length?sha(r.bytes):null,
  fullIndexResponseFile:null,indexError:r.error||null,
  indexedRecords:0,candidatesBeforeElection:0,selectedOriginalWarcs:[],indexFailedMeansNoWebsite:false};
 let rows=[];
 if(r.ok&&r.httpStatus===200){
  try{
   const contents=r.bytes.toString().trim();
   rows=contents.split(/\n/).filter(Boolean).map(x=>JSON.parse(x));
   assert.ok(rows.length<=200,'CC index too large; not exhaustively audited');
   record.indexedRecords=rows.length;
   record.fullIndexResponseFile=q.key+'-complete-index.jsonl';
   writeFileSync(join(destination,record.fullIndexResponseFile),r.bytes,{flag:'wx'});
  }catch(e){record.indexError='CC index parse/unbounded '+String(e).slice(0,140);}
 }else record.indexError=record.indexError||'HTTP '+r.httpStatus;
 const candidates=rows.filter(v=>v.timestamp&&v.url&&v.status==='200'
  &&v.timestamp<'20250128000000'&&withinCandidateDomain(v.url)&&
  Number.isSafeInteger(Number(v.offset))&&Number.isSafeInteger(Number(v.length))&&
  Number(v.length)>100&&Number(v.length)<5000000&&v.filename&&
  /^sha1:[A-Z2-7]{32}$/i.test(v.digest||''));
 record.candidatesBeforeElection=candidates.length;
 candidates.sort((a,b)=>{
  const issue=x=>/priority|issue|platform|policy/i.test(x.url)?3:0;
  return issue(b)-issue(a)||b.timestamp.localeCompare(a.timestamp);
 });
 const selectedPaths=new Set();
 for(const v of candidates){
  const pathname=new URL(v.url).pathname;
  if(selectedPaths.has(pathname))continue;selectedPaths.add(pathname);
  if(record.selectedOriginalWarcs.length>=3)break;
  const from=Number(v.offset),to=from+Number(v.length)-1;
  const warcUrl='https://data.commoncrawl.org/'+v.filename;
  const response=await retrieve(warcUrl,{Range:'bytes='+from+'-'+to},40000);
  const p={indexedOriginalUrl:v.url,indexedCapturedUtc:ensurePreElectionTimestamp(v.timestamp,'CC capture'),
   indexedDigest:v.digest,publicCrawlIndex:q.crawl,indexedWarcFilename:v.filename,
   originalRangeOffset:from,originalRangeLength:Number(v.length),rangeUrl:warcUrl,
   rangedHTTPStatus:response.httpStatus,contentRange:response.rangeResponse,
   completeRangedWarcGzipSha256:response.bytes.length?sha(response.bytes):null,
   fullOriginalWarcGzipFile:null,independentWarcPayloadDigestMatched:false,
   originalPayloadHTMLFile:null,warcBodyHtmlSha256:null,originalIdentityCues:null,error:response.error||null};
  if(response.httpStatus===206&&response.bytes.length===Number(v.length)){
   try{
    const u=unpackWarc(response.bytes);
    assert.equal(u.warcHeaders['warc-target-uri'],v.url,'Different URL in original WARC');
    assert.equal(ensurePreElectionTimestamp(u.warcHeaders['warc-date'],'WARC header'),p.indexedCapturedUtc,
     'WARC capture time not same as independent index');
    p.independentWarcPayloadDigestMatched=historicalArchiveSha1Base32(u.body)===v.digest.slice(5).toUpperCase();
    p.actualUncompressedWarcSHA256=u.wholeUncompressedWarcSHA256;
    if(p.independentWarcPayloadDigestMatched){
     const n=q.key+'-'+record.selectedOriginalWarcs.length+'-'+v.timestamp;
     p.fullOriginalWarcGzipFile=n+'-original.warc.gz';
     p.originalPayloadHTMLFile=n+'-raw-html.html';
     writeFileSync(join(destination,p.fullOriginalWarcGzipFile),response.bytes,{flag:'wx'});
     writeFileSync(join(destination,p.originalPayloadHTMLFile),u.body,{flag:'wx'});
     p.warcBodyHtmlSha256=sha(u.body);
     p.originalIdentityCues=cues(u.body);
    }
   }catch(e){p.error='WARC provenance parse/digest '+String(e).slice(0,220);}
  }
  record.selectedOriginalWarcs.push(p);
 }
 cc.push(record);
 console.log('DORON INDEPENDENT COMMONCRAWL '+JSON.stringify({index:q.key,HTTP:r.httpStatus,
  preElection:candidates.length,SHAOriginal:record.selectedOriginalWarcs.filter(v=>v.originalPayloadHTMLFile).length,
  error:record.indexError}));
}
const waybackQ=[
 {key:'doron-priorities-exact',url:'doronforsenate.org/priorities',match:'exact'},
 {key:'doron-priorities-www',url:'www.doronforsenate.org/priorities',match:'exact'},
 {key:'doron-home-https',url:'www.doronforsenate.org/',match:'exact'},
 {key:'doron-home-nonwww',url:'doronforsenate.org/',match:'exact'},
 {key:'doron-domain',url:'doronforsenate.org',match:'domain'}
];
const wayback=[];
for(const q of waybackQ){
 const params=new URLSearchParams({url:q.url,matchType:q.match,from:'20241201',to:'20250127',
  output:'json',fl:'timestamp,original,mimetype,statuscode,digest,length',limit:'100'});
 params.append('filter','statuscode:200');
 params.append('filter','mimetype:text/html');
 const indexUrl='https://web.archive.org/cdx/search/cdx?'+params.toString();
 const r=await retrieve(indexUrl);
 const item={key:q.key,indexUrl,indexHttpStatus:r.httpStatus,indexSHA256:r.bytes.length?sha(r.bytes):null,
  originalFullIndexFile:null,indexRows:0,indexError:r.error||null,
  originalHTMLReplays:[],unknownNotCandidatePolicyAbsence:true};
 let entries=[];
 if(r.ok&&r.httpStatus===200){
  try{
   const arr=JSON.parse(r.bytes.toString());
   assert.ok(Array.isArray(arr)&&arr.length>=1&&arr.length<=101);
   assert.deepEqual(arr[0],['timestamp','original','mimetype','statuscode','digest','length']);
   entries=arr.slice(1);
   item.indexRows=entries.length;
   item.originalFullIndexFile=q.key+'-whole-wayback-index.json';
   writeFileSync(join(destination,item.originalFullIndexFile),r.bytes,{flag:'wx'});
  }catch(e){item.indexError='Wayback CDX parse '+String(e).slice(0,160);}
 }else item.indexError=item.indexError||'HTTP '+r.httpStatus;
 const paths=new Set();
 for(const v of entries.filter(x=>x[0]<'20250128000000'&&withinCandidateDomain(x[1])
  &&x[2]==='text/html'&&x[3]==='200'&&/^[A-Z2-7]{32}$/.test(x[4]))
  .sort((a,b)=>b[0].localeCompare(a[0]))){
  const path=new URL(v[1]).pathname.toLowerCase();
  if(paths.has(path))continue;paths.add(path);
  if(item.originalHTMLReplays.length>=2)break;
  const replayUrl='https://web.archive.org/web/'+v[0]+'id_/'+v[1];
  const got=await retrieve(replayUrl);
  const page={url:v[1],publicByUTC:ensurePreElectionTimestamp(v[0],'Wayback capture'),
   indexedSha1Base32:v[4],replayUrl,httpStatus:got.httpStatus,
   entireHtmlSha256:got.bytes.length?sha(got.bytes):null,
   independentOriginalDigestEqualsFullHtml:false,originalFullHTMLFile:null,sourceIdentityCues:null};
  if(got.ok&&got.httpStatus===200&&got.bytes.length>100){
   page.independentOriginalDigestEqualsFullHtml=historicalArchiveSha1Base32(got.bytes)===v[4];
   if(page.independentOriginalDigestEqualsFullHtml){
    page.originalFullHTMLFile=q.key+'-'+v[0]+'-whole-original.html';
    writeFileSync(join(destination,page.originalFullHTMLFile),got.bytes,{flag:'wx'});
    page.sourceIdentityCues=cues(got.bytes);
   }
  }
  item.originalHTMLReplays.push(page);
 }
 wayback.push(item);
 console.log('DORON JANUARY 2025 WAYBACK '+JSON.stringify({key:q.key,index:r.httpStatus,
  rows:item.indexRows,exactOriginal:item.originalHTMLReplays.filter(x=>x.originalFullHTMLFile).length}));
}
const results={schema:'mn-doron-2025-special-prejanuary28-independent-commoncrawl-and-wayback-originals-v1',
 issue:864,trueActuallyServingStateSenator:'Doron Clark',
 originalGovernmentServiceSHA256:sha(gov),original87Of95ResearchCoverageSHA256:sha(cb),
 electionOffice:'Minnesota State Senate District 60',specialElectionOn:'2025-01-28',
 archivesExplicitlyPreElection:['CC-MAIN-2025-05','CC-MAIN-2024-51','Wayback_2024Dec-2025Jan27'],
 Jan2025CommonCrawlSourceCrawledJan12To26:true,
 publicOnlyAndNoProductionConnection:true,originalCreationDateNeverInferredFromCapture:true,
 originalCampaignHtmlSHAAuthenticatedByOriginalIndependentIndexOnly:true,
 indexedMissingOrDigestMismatchAlwaysUnknown:true,
 independentlyMatchedWarcHtmlBodies:cc.flatMap(x=>x.selectedOriginalWarcs).filter(x=>x.originalPayloadHTMLFile).length,
 independentlyMatchedWaybackOriginals:wayback.flatMap(x=>x.originalHTMLReplays).filter(x=>x.originalFullHTMLFile).length,
 sourcePagesAutomaticallyAdmittedAsPolicy:0,officialSenateVotesVerified:0,productionDBReadsWrites:0,
 modelForecastTrainingScheduler2027Changes:0,commonCrawlOriginalIndexes:cc,waybackOriginalIndexes:wayback};
writeFileSync(join(destination,'doron-2025-prejanuary28-original-cc-warcs-and-wayback-manifest.json'),
 JSON.stringify(results,null,2)+'\n',{flag:'wx'});
console.log('DORON 2025 ORIGINAL DUAL-ARCHIVE TRACK RESULT '+JSON.stringify({
 originalCommonCrawl:results.independentlyMatchedWarcHtmlBodies,
 originalWayback:results.independentlyMatchedWaybackOriginals,
 candidateQuoteAutoAdmitted:0,productionChanges:0}));
