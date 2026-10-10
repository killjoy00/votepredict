import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import {join} from 'node:path';
import {
  acquisitionTargets, readBoundedPublicResponse,acquireSenateCampaignPublicSources,
} from '../scripts/acquire-senate-campaign-public-archive-sources.js';

const gen=(status:number,body:string,headers:Record<string,string>={}):Response=>
  new Response(body,{status,headers:{'content-type':'text/plain',...headers}});
const temp=()=>mkdtempSync(join(tmpdir(),'cc-real-acquisition-fixture-'));
const ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32(bytes:Buffer):string{
  let word=0,bits=0,out='';
  for(const b of bytes){
    word=(word<<8)|b;bits+=8;
    while(bits>=5){out+=ALPHABET[(word>>(bits-5))&31];bits-=5;}
    word&=(1<<bits)-1;
  }
  if(bits)out+=ALPHABET[(word<<(5-bits))&31];
  return out;
}
const sha1=(bytes:Buffer)=>base32(createHash('sha1').update(bytes).digest());
function syntheticOneRecord(){
  const q=acquisitionTargets().commoncrawl.find(x=>x.candidateName==='Ann Johnson Stewart'
    &&x.collectionId==='CC-MAIN-2024-42')!;
  const stamp='20241009123456';
  const body=Buffer.from('<html><title>Only a synthetic test page</title></html>');
  const uri=q.sourceUrl;
  const http=Buffer.concat([Buffer.from('HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n'),body]);
  const warc=Buffer.concat([
    Buffer.from([
      'WARC/1.0','WARC-Type: response','WARC-Date: 2024-10-09T12:34:56Z',
      'WARC-Target-URI: '+uri,'Content-Type: application/http; msgtype=response',
      'Content-Length: '+http.length,
      'WARC-Block-Digest: sha1:'+sha1(http),
      'WARC-Payload-Digest: sha1:'+sha1(body),
    ].join('\r\n')+'\r\n\r\n'),
    http,Buffer.from('\r\n\r\n'),
  ]);
  const gz=gzipSync(warc);
  const filename='crawl-data/CC-MAIN-2024-42/segments/1728000000000.17/warc/CC-MAIN-20241009000000-20241009180000-00001.warc.gz';
  const row={url:uri,timestamp:stamp,status:'200',mime:'text/html',
    digest:sha1(body),filename,offset:'84000',length:String(gz.length)};
  return {q,gz,body,sourceRow:JSON.stringify(row)+'\n',
    range:'bytes 84000-'+(84000+gz.length-1)+'/19300000',
    fullWarcUrl:'https://data.commoncrawl.org/'+filename};
}
test('one-shot acquisition fixes 14 Common Crawl and six Wayback targets to known candidate elections',()=>{
  const s=acquisitionTargets();
  assert.equal(s.commoncrawl.length,14);
  assert.equal(s.wayback.length,6);
  assert.equal(new Set(s.commoncrawl.map(c=>c.candidateName)).size,6);
  assert.ok(s.commoncrawl.every(c=>c.sourceSiteBytesVerified===false));
  assert.ok(s.commoncrawl.every(c=>c.queryApiUrl.startsWith('https://index.commoncrawl.org/')));
  assert.ok(s.wayback.every(q=>q.url.startsWith('https://web.archive.org/cdx/search/cdx?')));
  const ann=s.wayback.find(q=>q.candidateName==='Ann Johnson Stewart')!;
  const keri=s.wayback.find(q=>q.candidateName==='Keri Heintzeman')!;
  assert.ok(ann.url.includes('to=20241104'));
  assert.ok(keri.url.includes('to=20250428'));
});
test('runtime refuses arbitrary fetch hosts and unsupported HTTP protocol',async()=>{
  let calls=0;
  const never=async()=>{calls++;throw new Error('Should not fetch');};
  await assert.rejects(readBoundedPublicResponse('https://localhost/secrets','commoncrawl_cdx_index',
    {fetchImpl:never as typeof fetch}),/preapproved/);
  await assert.rejects(readBoundedPublicResponse('http://index.commoncrawl.org/CC-MAIN-2025-43-index',
    'commoncrawl_cdx_index',{fetchImpl:never as typeof fetch}),/preapproved/);
  await assert.rejects(readBoundedPublicResponse('https://evil.example/page','public_publisher_page',
    {fetchImpl:never as typeof fetch}),/preapproved/);
  assert.equal(calls,0);
});
test('HTTP 429 or 503 is preserved as unknown, never zero historical captures',async()=>{
  const dir=temp(),out=join(dir,'acquired');
  try{
    let calls=0;
    const mock=async ():Promise<Response>=>{
      calls++;return gen(calls%2?429:503,'temporarily unavailable');
    };
    const m=await acquireSenateCampaignPublicSources(out,mock as typeof fetch);
    assert.equal(m.totals.attemptedCommonCrawlIndexQueries,14);
    assert.equal(m.totals.commonCrawlIndexHttp200,0);
    assert.equal(m.totals.attemptedWaybackIndexQueries,6);
    assert.equal(m.totals.publisherLivePagesDownloaded,0);
    assert.equal(m.totals.verifiedPreElectionCandidateAuthoredStatements,0);
    assert.equal(m.commonCrawlIndexes[0].response.status,429);
    assert.equal(m.commonCrawlIndexes[1].response.status,503);
    assert.ok(m.commonCrawlIndexes.every(x=>!x.persistedSourceBodyFile));
    assert.equal(m.sourceAuthorization.archiveSourceFailureDoesNotMeanZeroCaptures,true);
    assert.equal(m.scope.credentialsRead,false);
    assert.equal(m.scope.productionWrites,false);
    assert.equal(m.scope.activeBackfillEnabled,false);
    assert.equal(readdirSync(out).length,1);
    assert.equal(statSync(join(out,'acquisition-manifest.json')).mode&0o777,0o600);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('publisher HTTP 200 is acquired as 2026 source bytes, not historic campaign page proof',async()=>{
  const dir=temp(),out=join(dir,'acquired');
  try{
    const page='<html><article>Published April 10, 2025 (publisher claim only)</article></html>';
    const mock=async(url:string|URL|Request):Promise<Response>=>{
      const v=String(url);
      if(v.includes('index.commoncrawl.org'))return gen(404,'No captures');
      if(v.includes('web.archive.org'))return gen(503,'Archive unavailable');
      return gen(200,page,{'content-type':'text/html','last-modified':'Sat, 10 Oct 2026 10:00:00 GMT'});
    };
    const m=await acquireSenateCampaignPublicSources(out,mock as typeof fetch);
    assert.equal(m.totals.publisherLivePagesDownloaded,6);
    assert.equal(m.totals.attemptedCommonCrawlOriginalWarcRanges,0);
    assert.equal(m.totals.verifiedPreElectionCandidateAuthoredStatements,0);
    assert.equal(m.sourceAuthorization.preElectionCandidateStatementProofCertified,false);
    assert.equal(m.contemporaneouslyDatedPublisherPages[0].publicationDateOnPageClaim,'2025-04-10');
    assert.equal(m.contemporaneouslyDatedPublisherPages[0].publishingDateIndependentlyCorroboratedByHistoricalCapture,false);
    assert.equal(m.contemporaneouslyDatedPublisherPages[0].response.bodySha256,
      createHash('sha256').update(page).digest('hex'));
    assert.equal(readFileSync(join(out,'media-sd6-20250410.html')).toString(),page);
    assert.equal(readFileSync(join(out,'2025-dorau-original-announcement.html')).toString(),page);
    assert.equal(m.contemporaneouslyDatedPublisherPages[3].publicationDateOnPageClaim,'2025-07-30');
    assert.equal(m.contemporaneouslyDatedPublisherPages[5].publicationDateOnPageClaim,'2025-10-28');
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('actual acquisition flow hashes source index, 206 compressed range and verified original-page bytes',async()=>{
  const dir=temp(),out=join(dir,'acquired');
  try{
    const f=syntheticOneRecord();
    const mock=async(url:string|URL|Request,init?:RequestInit):Promise<Response>=>{
      const u=String(url);
      if(u===f.q.queryApiUrl)return gen(200,f.sourceRow,{'content-type':'application/json'});
      if(u===f.fullWarcUrl){
        assert.equal((init?.headers as Record<string,string>).range,
          'bytes=84000-'+(84000+f.gz.length-1));
        return new Response(f.gz,{status:206,headers:{'content-range':f.range,
          'content-type':'application/octet-stream'}});
      }
      if(u.includes('index.commoncrawl.org'))return gen(404,'No index');
      if(u.includes('web.archive.org'))return gen(503,'Archive unavailable');
      return gen(404,'Not available');
    };
    const m=await acquireSenateCampaignPublicSources(out,mock as typeof fetch);
    assert.equal(m.totals.commonCrawlIndexHttp200,1);
    assert.equal(m.totals.commonCrawlIndexedPreVoteCandidateRecords,1);
    assert.equal(m.totals.attemptedCommonCrawlOriginalWarcRanges,1);
    assert.equal(m.totals.originalWarcHttp206Validated,1);
    assert.equal(m.totals.locallyCrossCheckedWarcPagePayloads,1);
    assert.equal(m.totals.verifiedPreElectionCandidateAuthoredStatements,0);
    const w=m.commonCrawlWarcs.outcomes[0];
    assert.equal(w.http206ByteRangeAndHeadersConsistent,true);
    assert.equal(w.locallyCrossCheckedWarcProof?.warcPayloadDigestCrossChecksPassed,true);
    assert.equal(w.eligibleForForecast,false);
    assert.ok(w.originalCompressedWarcFile);
    assert.ok(w.verifiedOriginalPagePayloadFile);
    assert.ok(readFileSync(join(out,w.verifiedOriginalPagePayloadFile)).equals(f.body));
    assert.equal(w.response.responseHeaders?.contentRange,f.range);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('HTTP 200 whole-WARC fallback without 206 Content-Range is not historical page proof',async()=>{
  const dir=temp(),out=join(dir,'acquired');
  try{
    const f=syntheticOneRecord();
    const mock=async(url:string|URL|Request):Promise<Response>=>{
      const u=String(url);
      if(u===f.q.queryApiUrl)return gen(200,f.sourceRow,{'content-type':'application/json'});
      if(u===f.fullWarcUrl)return new Response(f.gz,{status:200});
      if(u.includes('index.commoncrawl.org'))return gen(404,'No index');
      if(u.includes('web.archive.org'))return gen(503,'Unavailable');
      return gen(404,'Unavailable');
    };
    const m=await acquireSenateCampaignPublicSources(out,mock as typeof fetch);
    assert.equal(m.totals.attemptedCommonCrawlOriginalWarcRanges,1);
    assert.equal(m.totals.originalWarcHttp206Validated,0);
    assert.equal(m.totals.locallyCrossCheckedWarcPagePayloads,0);
    assert.equal(m.commonCrawlWarcs.outcomes[0].originalCompressedWarcFile,null);
    assert.equal(m.totals.verifiedPreElectionCandidateAuthoredStatements,0);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
