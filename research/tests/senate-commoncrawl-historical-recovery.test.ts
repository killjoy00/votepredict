import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { mkdtempSync,readFileSync,rmSync,writeFileSync,statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import leadJson from '../../data/evaluation/senate-campaign-issue-page-url-leads-2024-25-v1.json' with {type:'json'};
import catalogJson from '../../data/evaluation/senate-commoncrawl-index-windows-2024-25-v1.json' with {type:'json'};
import {
  planSenateCommonCrawlIndexResearch,
  reviewOfflineCommonCrawlIndexRows,
  type CommonCrawlCatalog,type CcSourceQuery,
} from '../../src/evidence/senate-commoncrawl-historical-recovery.js';
import { inspectSenateCommonCrawlWarcBytes } from '../../src/evidence/senate-commoncrawl-warc-proof.js';
import type {CampaignPageLeadManifest} from '../../src/evidence/campaign-archive-source-recovery.js';

const leads=leadJson as unknown as CampaignPageLeadManifest;
const catalog=catalogJson as unknown as CommonCrawlCatalog;
const query=(name:string,index:string,kind:string):CcSourceQuery=>{
  const v=planSenateCommonCrawlIndexResearch(leads,catalog).queries.find(q=>
    q.candidateName===name&&q.collectionId===index&&q.queryKind===kind);
  assert.ok(v,'missing test query '+name+' '+index+' '+kind);
  return v;
};
const ALPH='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Digest(data:Buffer):string{
  const bytes=createHash('sha1').update(data).digest();
  let value=0,bits=0,result='';
  for(const n of bytes){
    value=(value<<8)|n;bits+=8;
    while(bits>=5){result+=ALPH[(value>>(bits-5))&31];bits-=5;}
    value&=(1<<bits)-1;
  }
  if(bits)result+=ALPH[(value<<(5-bits))&31];
  return result;
}
const sampleBody=Buffer.from('<html><head><title>Synthetic archived candidate homepage</title></head><body>Archive test: synthetic only; no real campaign quotation.</body></html>','utf8');
function fixture(q:CcSourceQuery,stamp:string,opts:{body?:Buffer;warcType?:string;httpStatus?:number;httpEncoding?:string;target?:string;payloadDigest?:string;warcDate?:string;httpMime?:string;extraWarcHeaders?:string[]}={}){
  const original=q.queryKind==='host_prefix'?'https://'+q.candidateHost+'/':q.sourceUrl;
  const body=opts.body??sampleBody;
  const httpBlock=Buffer.concat([
    Buffer.from('HTTP/1.1 '+(opts.httpStatus??200)+' OK\r\nContent-Type: '+(opts.httpMime??'text/html')+'; charset=UTF-8\r\n'
      +(opts.httpEncoding?'Content-Encoding: '+opts.httpEncoding+'\r\n':'')+'\r\n','utf8'),
    body,
  ]);
  const digest=base32Digest(body);
  const warcDate=opts.warcDate??stamp.slice(0,4)+'-'+stamp.slice(4,6)+'-'+stamp.slice(6,8)+'T'+
    stamp.slice(8,10)+':'+stamp.slice(10,12)+':'+stamp.slice(12,14)+'Z';
  const head=[
    'WARC/1.0','WARC-Type: '+(opts.warcType??'response'),
    'WARC-Date: '+warcDate,'WARC-Target-URI: '+(opts.target??original),
    ...(opts.extraWarcHeaders??[]),
    'Content-Type: application/http; msgtype=response',
    'Content-Length: '+httpBlock.length,
    'WARC-Block-Digest: sha1:'+base32Digest(httpBlock),
    'WARC-Payload-Digest: sha1:'+(opts.payloadDigest??digest),
  ].join('\r\n')+'\r\n\r\n';
  const blob=Buffer.concat([Buffer.from(head),httpBlock,Buffer.from('\r\n\r\n')]);
  const gz=gzipSync(blob);
  const filename='crawl-data/'+q.collectionId+'/segments/1728000000000.17/warc/CC-MAIN-20241009000000-20241009180000-00001.warc.gz';
  const raw={
    urlkey:'com,example)/',
    timestamp:stamp,url:original,status:'200',
    mime:'text/html',digest,length:String(gz.length),offset:'84000',filename,
  };
  const review=reviewOfflineCommonCrawlIndexRows(q,JSON.stringify(raw));
  assert.equal(review.records.length,1);
  return {record:review.records[0],gz,html:body,raw};
}
test('20 official 2024-25 crawl windows generate bounded 275 source queries across six website hosts',()=>{
  const report=planSenateCommonCrawlIndexResearch(leads,catalog);
  assert.equal(report.totals.candidateDomains,6);
  assert.equal(report.totals.indexWindows,20);
  assert.equal(report.totals.plannedTargetedQueries,275);
  assert.equal(report.totals.officialArchiveRecordsRetrieved,0);
  assert.equal(report.totals.distinctSourcePolicyPagePaths,4);
  assert.equal(report.scope.actualWarcBytesAuthenticated,false);
  assert.equal(new Set(report.queries.map(x=>x.id)).size,275);
  assert.ok(report.queries.every(q=>q.queryApiUrl.startsWith('https://index.commoncrawl.org/CC-MAIN-')));
  assert.ok(report.queries.every(q=>q.maxIndexRecords===400));
  assert.ok(report.queries.every(q=>!q.queryApiUrl.includes('collapse')));
});
test('2024 cross-vote crawl window and 2025 April near-vote window are not discarded wholesale',()=>{
  const ann=query('Ann Johnson Stewart','CC-MAIN-2024-46','issue_exact');
  const keri=query('Keri Heintzeman','CC-MAIN-2025-18','homepage_exact');
  assert.equal(ann.indexWindowOverlapsGeneralCutoff,true);
  assert.equal(ann.indexWindowOverlapsPrimaryCutoff,false);
  assert.equal(keri.indexWindowOverlapsGeneralCutoff,true);
  assert.equal(keri.indexWindowOverlapsPrimaryCutoff,false);
  assert.ok(!planSenateCommonCrawlIndexResearch(leads,catalog).queries.some(q=>
    q.candidateName==='Ann Johnson Stewart'&&q.collectionId==='CC-MAIN-2024-51'));
  assert.ok(!planSenateCommonCrawlIndexResearch(leads,catalog).queries.some(q=>
    q.candidateName==='Keri Heintzeman'&&q.collectionId==='CC-MAIN-2025-21'));
});
test('exact issue page, campaign domain and candidate election join are preserved',()=>{
  const plan=planSenateCommonCrawlIndexResearch(leads,catalog);
  const rows=plan.queries.filter(q=>q.collectionId==='CC-MAIN-2025-43'&&q.queryKind==='issue_exact');
  assert.equal(rows.length,3);
  assert.deepEqual(rows.map(q=>q.sourceUrl).sort(),[
    'https://amandaformn.com/issues/','https://www.mike4mnsenate.com/platform',
    'https://louismcnuttformnsenate.com/issues',
  ].sort());
  assert.ok(rows.every(q=>!q.originalCampaignStatementVerified));
  assert.ok(plan.queries.filter(q=>q.queryKind==='host_prefix').every(q=>
    decodeURIComponent(q.queryApiUrl).includes('*.'+q.candidateHost+'/*')));
});
test('later site text is not upgraded into historical campaign evidence through corrupted catalog',()=>{
  const x=structuredClone(catalog);
  (x.source as unknown as {originalRegistryResponseHashIndependentlyVerified:boolean}).originalRegistryResponseHashIndependentlyVerified=true;
  assert.throws(()=>planSenateCommonCrawlIndexResearch(leads,x),/Unrecognized or upgraded/);
  const y=structuredClone(leads);
  (y.candidates[0].pages[0] as unknown as {historicalSitePageBytesProven:boolean}).historicalSitePageBytesProven=true;
  assert.throws(()=>planSenateCommonCrawlIndexResearch(y,catalog),/Backdated/);
});
test('invalid or post-2025, duplicate, unsorted index windows are fail closed',()=>{
  const bad=structuredClone(catalog);
  bad.indexes[0].from='2025-01-01T01:01:01Z';
  assert.throws(()=>planSenateCommonCrawlIndexResearch(leads,bad),/Impossible or unordered/);
  const copy=structuredClone(catalog);
  copy.indexes[1].id=copy.indexes[0].id;
  assert.throws(()=>planSenateCommonCrawlIndexResearch(leads,copy),/Invalid\/duplicate/);
});
test('real-shaped CDXJ JSONL is linked to a candidate and a source WARC Range URI',()=>{
  const q=query('Ann Johnson Stewart','CC-MAIN-2024-42','issue_exact');
  const {record,gz}=fixture(q,'20241009123456');
  assert.equal(record.originalUrl,'https://annjohnsonstewart.com/priorities/');
  assert.equal(record.isKnownOriginalIssuePageUrl,true);
  assert.equal(record.warcLength,gz.length);
  assert.equal(record.warcRangeEndInclusive,84000+gz.length-1);
  assert.equal(record.httpRange,'bytes=84000-'+(84000+gz.length-1));
  assert.equal(record.warcDataUrl,'https://data.commoncrawl.org/'+record.warcFilename);
  assert.equal(record.capturedAt,'2024-10-09T12:34:56.000Z');
  assert.equal(record.indexClaimIndependentlyAuthenticated,false);
  assert.equal(record.originalStatementTextVerified,false);
});
test('valid synthetic WARC.gz passes block SHA1, payload SHA1, gzip CRC, byte length and exact original URL/time checks',()=>{
  const q=query('Ann Johnson Stewart','CC-MAIN-2024-42','issue_exact');
  const {record,gz,html}=fixture(q,'20241009123456');
  const {report,originalHttpPagePayloadBytes}=inspectSenateCommonCrawlWarcBytes(record,gz,leads);
  assert.ok(originalHttpPagePayloadBytes.equals(html));
  assert.equal(report.originalHttpPagePayloadSha256,createHash('sha256').update(html).digest('hex'));
  assert.equal(report.warcPayloadDigestCrossChecksPassed,true);
  assert.equal(report.warcBlockDigestCrossChecksPassed,true);
  assert.equal(report.gzipLengthAndCrcMatched,true);
  assert.equal(report.exactTargetUrlAndCaptureTimeMatched,true);
  assert.equal(report.candidateAttributionAndStatementTextIndependentlyVerified,false);
  assert.equal(report.originalRemoteWarcByteRangeRetrievalIndependentlyAuthenticated,false);
  assert.equal(report.campaignStanceEvidencePromoted,false);
  assert.equal(report.firstHistoricalStatementPublicBy,null);
  assert.equal(report.forecastEligible,false);
});
test('WARC checksum tamper is fail closed at block digest or payload digest, not silently a quote',()=>{
  const q=query('Ann Johnson Stewart','CC-MAIN-2024-42','issue_exact');
  const {record,gz}=fixture(q,'20241009123456',{payloadDigest:'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'});
  assert.throws(()=>inspectSenateCommonCrawlWarcBytes(record,gz,leads),/payload checksum/);
  const normal=fixture(q,'20241009123456');
  const altered={...normal.record,digest:'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'};
  assert.throws(()=>inspectSenateCommonCrawlWarcBytes(altered,normal.gz,leads),/payload checksum/);
});
test('wrong origin target URL or WARC time is rejected, even with recomputed digests',()=>{
  const q=query('Ann Johnson Stewart','CC-MAIN-2024-42','issue_exact');
  const w=fixture(q,'20241009123456',{target:'https://anothercampaign.org/priorities/'});
  assert.throws(()=>inspectSenateCommonCrawlWarcBytes(w.record,w.gz,leads),/target URL/);
  const t=fixture(q,'20241009123456',{warcDate:'2024-10-08T12:34:56Z'});
  assert.throws(()=>inspectSenateCommonCrawlWarcBytes(t.record,t.gz,leads),/capture date/);
});
test('WARC revisit, HTTP error and HTTP gzip/chunked response cannot become original campaign-page byte proof',()=>{
  const q=query('Ann Johnson Stewart','CC-MAIN-2024-42','issue_exact');
  for(const mutation of [
    {warcType:'revisit'},{httpStatus:302},{httpEncoding:'gzip'},
  ]){
    const item=fixture(q,'20241009123456',mutation);
    assert.throws(()=>inspectSenateCommonCrawlWarcBytes(item.record,item.gz,leads),/Unverified Common Crawl WARC/);
  }
});
test('corrupted or wrongly sized gzip member cannot be accepted as original archive proof',()=>{
  const q=query('Ann Johnson Stewart','CC-MAIN-2024-42','issue_exact');
  const {record,gz}=fixture(q,'20241009123456');
  assert.throws(()=>inspectSenateCommonCrawlWarcBytes(record,gz.subarray(0,-2),leads),/Range length/);
  const altered=Buffer.from(gz);altered[altered.length-6]^=0x01;
  assert.throws(()=>inspectSenateCommonCrawlWarcBytes(record,altered,leads),/corrupted\/oversize gzip/);
});
test('no imported CDX index row dated on election day or after may be treated as pre-general capture',()=>{
  const q=query('Ann Johnson Stewart','CC-MAIN-2024-46','issue_exact');
  const w=fixture(q,'20241104123456');
  const raw={...w.raw,timestamp:'20241105123456'};
  const r=reviewOfflineCommonCrawlIndexRows(q,JSON.stringify(raw));
  assert.equal(r.records.length,0);
  assert.equal(r.counts.discardedPostVoteOrPre2024,1);
  assert.equal(r.sourceCandidateIssueTextVerified,false);
});
test('cross-candidate, wrong month, remote filename traversal and misleading CDX data are rejected',()=>{
  const q=query('Ann Johnson Stewart','CC-MAIN-2024-42','issue_exact');
  const {raw}=fixture(q,'20241009123456');
  const cases=[
    {...raw,url:'https://othercandidate.example/platform'},
    {...raw,filename:raw.filename.replace('CC-MAIN-2024-42','CC-MAIN-2025-43')},
    {...raw,timestamp:'20241104123456'},
    {...raw,filename:'crawl-data/CC-MAIN-2024-42/segments/../secret.warc.gz'},
    {...raw,digest:'not-a-sha1'},
  ];
  for(const example of cases)assert.throws(()=>reviewOfflineCommonCrawlIndexRows(q,JSON.stringify(example)));
});
test('duplicate crawl row appears once, with explicit no-completeness proof',()=>{
  const q=query('Ann Johnson Stewart','CC-MAIN-2024-42','issue_exact');
  const {raw}=fixture(q,'20241009123456');
  const r=reviewOfflineCommonCrawlIndexRows(q,JSON.stringify(raw)+'\n'+JSON.stringify(raw));
  assert.equal(r.counts.providedLines,2);
  assert.equal(r.counts.duplicateIndexRecords,1);
  assert.equal(r.records.length,1);
  assert.equal(r.completenessCertified,false);
});
test('offline CLI creates 0600 query catalog and imports previously exported index bytes',()=>{
  const dir=mkdtempSync(join(tmpdir(),'senate-commoncrawl-'));
  try{
    const target=join(dir,'queries.json');
    const args=['--import','tsx','scripts/audit-senate-commoncrawl-offline.ts'];
    execFileSync('node',[...args,'--output',target],{timeout:15000,stdio:'pipe'});
    const report=JSON.parse(readFileSync(target,'utf8'));
    assert.equal(report.totals.plannedTargetedQueries,275);
    assert.equal(report.promotedHistoricalCampaignStatements,0);
    assert.equal(statSync(target).mode&0o777,0o600);
    const q=query('Ann Johnson Stewart','CC-MAIN-2024-42','issue_exact');
    const {raw}=fixture(q,'20241009123456');
    const rowsPath=join(dir,'source.jsonl'), reviewedFile=join(dir,'review.json');
    writeFileSync(rowsPath,JSON.stringify(raw)+'\n');
    execFileSync('node',[...args,'--query-id',q.id,'--index-jsonl',rowsPath,
      '--output',reviewedFile],{timeout:15000,stdio:'pipe'});
    const reviewed=JSON.parse(readFileSync(reviewedFile,'utf8'));
    assert.equal(reviewed.importedCdxIndexReview.records.length,1);
    assert.equal(reviewed.locallyCrossCheckedWarcBytes,null);
    assert.equal(reviewed.promotedHistoricalCampaignStatements,0);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('offline CLI validates one WARC byte range and optionally keeps its exact original payload',()=>{
  const dir=mkdtempSync(join(tmpdir(),'senate-commoncrawl-warc-'));
  try{
    const q=query('Ann Johnson Stewart','CC-MAIN-2024-42','issue_exact');
    const {raw,gz,html}=fixture(q,'20241009123456');
    const rawPath=join(dir,'cdx.jsonl'),warcPath=join(dir,'range.warc.gz');
    const payload=join(dir,'page.html'),out=join(dir,'result.json');
    writeFileSync(rawPath,JSON.stringify(raw)+'\n');writeFileSync(warcPath,gz);
    const args=['--import','tsx','scripts/audit-senate-commoncrawl-offline.ts',
      '--query-id',q.id,'--index-jsonl',rawPath,'--record-number','1',
      '--warc-gz',warcPath,'--payload-output',payload,'--output',out];
    execFileSync('node',args,{timeout:15000,stdio:'pipe'});
    const output=JSON.parse(readFileSync(out,'utf8'));
    assert.equal(output.locallyCrossCheckedWarcBytes.warcPayloadDigestCrossChecksPassed,true);
    assert.equal(output.locallyCrossCheckedWarcBytes.forecastEligible,false);
    assert.ok(readFileSync(payload).equals(html));
    assert.equal(statSync(payload).mode&0o777,0o600);
    assert.throws(()=>execFileSync('node',args,{timeout:15000,stdio:'pipe'}));
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('authentic multi-hop WARC-Protocol headers are accepted without allowing duplicate identity or digest',()=>{
  const q=query('Ann Johnson Stewart','CC-MAIN-2024-42','issue_exact');
  const good=fixture(q,'20241009123456',{extraWarcHeaders:[
    'WARC-Protocol: http/1.1','WARC-Protocol: tls/1.3',
  ]});
  const passed=inspectSenateCommonCrawlWarcBytes(good.record,good.gz,leads);
  assert.equal(passed.report.warcPayloadDigestCrossChecksPassed,true);
  assert.equal(passed.report.campaignStanceEvidencePromoted,false);
  const bad=fixture(q,'20241009123456',{extraWarcHeaders:[
    'WARC-Date: 2024-10-08T12:34:56Z',
  ]});
  assert.throws(()=>inspectSenateCommonCrawlWarcBytes(bad.record,bad.gz,leads),
    /malformed\/duplicate header warc-date/);
  const badDigest=fixture(q,'20241009123456',{extraWarcHeaders:[
    'WARC-Payload-Digest: sha1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  ]});
  assert.throws(()=>inspectSenateCommonCrawlWarcBytes(badDigest.record,badDigest.gz,leads),
    /malformed\/duplicate header warc-payload-digest/);
});
