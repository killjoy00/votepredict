import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {mkdtempSync,readFileSync,readdirSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import targetData from '../data/evaluation/senate-2022-ever-served-campaign-archive-public-targets-v1.json' with {type:'json'};
import type {AuditedOfficialSenateDirectory} from '../src/evidence/senate-official-ever-served-directory.js';
import {
 strictlySenatorsOnly2022Targets,fetchDatedBoundedPublic,base32Sha1Archive,
 parseStrict2022CommonCrawlCdxj,verifyActual2022CommonCrawlWarc,
 acquire2022EverServedSenateCampaignOriginals,
} from '../scripts/acquire-senate-2022-ever-served-campaign-originals.js';

const now='2026-10-10T23:40:00.000Z';
function realSenatorFixture():AuditedOfficialSenateDirectory{
 return {
  schema:'mn-lrl-official-senate-ever-served-directory-v1',
  source:{
   url:'https://www.lrl.mn.gov/legdb/senate_dir',
   observedAt:now,sourceBytesSha256:'a'.repeat(64),sourceBytesLength:316000,
   originalHistoricDateForDisplayedDirectoryEstablished:false,
   directoryIsSenatorServiceNotCandidateFiling:true,
  },
  senators:[
   {officialName:'Carla J. Nelson',officialNameRaw:'Nelson, Carla J.',
    officialSourceUrl:'https://www.lrl.mn.gov/legdb/senate_dir',
    senateServiceTerms:[{startsYear:2011,endsYear:2026,district:'24'}]},
   {officialName:'Nicole L. Mitchell',officialNameRaw:'Mitchell, Nicole L.',
    officialSourceUrl:'https://www.lrl.mn.gov/legdb/senate_dir',
    senateServiceTerms:[{startsYear:2023,endsYear:2025,district:'47'}]},
   {officialName:'Robert Kupec',officialNameRaw:'Kupec, Robert - "Rob"',
    officialSourceUrl:'https://www.lrl.mn.gov/legdb/senate_dir',
    senateServiceTerms:[{startsYear:2023,endsYear:2026,district:'4'}]},
   {officialName:'Michael E. Kreun',officialNameRaw:'Kreun, Michael E.',
    officialSourceUrl:'https://www.lrl.mn.gov/legdb/senate_dir',
    senateServiceTerms:[{startsYear:2023,endsYear:2026,district:'32'}]},
  ],
 };
}
const kupec=targetData.targets.find(t=>t.candidateName==='Rob Kupec')!;
const carla=targetData.targets.find(t=>t.id==='carla-2022-page-a')!;
function fakeWarc(originalUrl=kupec.sourceUrl,date='2022-10-05T12:12:12Z'){
 const html=Buffer.from('<html><body>Only a fictional archived historical Senate campaign test fixture</body></html>');
 const http=Buffer.concat([
  Buffer.from('HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n'),html,
 ]);
 const headers=[
  'WARC/1.0','WARC-Type: response','WARC-Date: '+date,
  'WARC-Target-URI: '+originalUrl,
  'WARC-Protocol: http/1.1','WARC-Protocol: tls/1.3',
  'Content-Type: application/http; msgtype=response',
  'Content-Length: '+http.length,
  'WARC-Block-Digest: sha1:'+base32Sha1Archive(http),
  'WARC-Payload-Digest: sha1:'+base32Sha1Archive(html),
 ].join('\r\n');
 const gzip=gzipSync(Buffer.concat([
  Buffer.from(headers+'\r\n\r\n'),http,Buffer.from('\r\n\r\n'),
 ]));
 const filename='crawl-data/CC-MAIN-2022-40/segments/1664000000000.11/warc/CC-MAIN-20220924180000-20221009180000-00001.warc.gz';
 const offset=88000;
 const indexed={
  url:originalUrl,timestamp:'20221005121212',status:'200',mime:'text/html',
  digest:base32Sha1Archive(html),filename,offset:String(offset),length:String(gzip.length),
 };
 const line='com,kupec4mnsenate)/our-campaign 20221005121212 '+JSON.stringify(indexed)+'\n';
 const rows=parseStrict2022CommonCrawlCdxj(
  Buffer.from(line),kupec.sourceUrl,'CC-MAIN-2022-40');
 return{
  html,gzip,row:rows[0],line,url:'https://data.commoncrawl.org/'+filename,
  range:'bytes '+offset+'-'+(offset+gzip.length-1)+'/10000000',
 };
}
test('every one of five historical source queries is independently validated as a person who actually served in MN Senate',()=>{
 const people=strictlySenatorsOnly2022Targets(realSenatorFixture());
 assert.equal(people.length,5);
 assert.equal(new Set(people.map(x=>x.candidateName)).size,4);
 assert.ok(people.every(p=>p.independentlyVerifiedSenatorService===true));
 assert.ok(people.every(p=>p.verifiedSenateServiceTerm.includes('SD')));
 const missing=realSenatorFixture();
 missing.senators=missing.senators.filter(p=>!p.officialName.includes('Kreun'));
 assert.throws(()=>strictlySenatorsOnly2022Targets(missing),/has not been verified/);
 const wrong=realSenatorFixture();
 wrong.senators[0].senateServiceTerms[0].district='40';
 assert.throws(()=>strictlySenatorsOnly2022Targets(wrong),/has not been verified/);
});
test('hard allowlist rejects arbitrary web hosts, local targets, wrong campaign path and unsafe WARC URL',async()=>{
 let calls=0;
 const noFetch=async()=>{calls++;throw Error('unexpected HTTP');};
 for(const address of [
  'https://127.0.0.1/secrets','https://localhost/keys',
  'http://www.carlanelson.com/home-page/',
  'https://www.carlanelson.com/admin',
  'https://web.archive.org/unsafe/injected',
  'https://data.commoncrawl.org/crawl-data/CC-MAIN-2022-49/segments/x/warc/a.warc.gz',
 ]){
  await assert.rejects(()=>fetchDatedBoundedPublic(address,10000,noFetch as typeof fetch),
   /Unapproved|Unsafe/);
 }
 assert.equal(calls,0);
});
test('every actual HTTP response has requested and observed UTC timestamps, but failures are NOT publication proofs',async()=>{
 const mock=async()=>new Response('unavailable',{status:503});
 const row=await fetchDatedBoundedPublic(carla.sourceUrl,10000,mock as typeof fetch);
 assert.equal(row.status,503);
 assert.ok(row.requestedAtUtc.startsWith('2026-'));
 assert.ok(Date.parse(row.observedAtUtc)>=Date.parse(row.requestedAtUtc));
 assert.equal(row.body?.toString(),'unavailable');
 assert.equal(row.responseBodySha256?.length,64);
});
test('real 2022 original Common Crawl gzip WARC proves payload/time/URL/digest only after matching all bytes',()=>{
 const fixture=fakeWarc();
 const verified=verifyActual2022CommonCrawlWarc(fixture.row,fixture.gzip);
 assert.ok(verified.html.equals(fixture.html));
 assert.equal(verified.report.pageWasPublicByNoLaterThanCaptureUtc,
  '2022-10-05T12:12:12.000Z');
 assert.equal(verified.report.firstAuthorPublicationDateEstablished,false);
 assert.equal(verified.report.forecastEvidenceInserted,false);
 const wrong=Buffer.from(fixture.gzip);
 wrong[wrong.length-20]^=0x32;
 assert.throws(()=>verifyActual2022CommonCrawlWarc(fixture.row,wrong));
 const datedWrong=fakeWarc(kupec.sourceUrl,'2022-10-06T12:12:12Z');
 assert.throws(()=>verifyActual2022CommonCrawlWarc(datedWrong.row,datedWrong.gzip),/response URL\/date incompatible/);
 const spoofed={...fixture.row,digest:'A'.repeat(32)};
 assert.throws(()=>verifyActual2022CommonCrawlWarc(spoofed,fixture.gzip),/not equal to 2022 CDX/);
});
test('only real exact original 2022 Common Crawl rows before November 8 and same site path pass',()=>{
 const fixture=fakeWarc();
 assert.equal(fixture.row.digest.length,32);
 const falseYear=fixture.line.replaceAll('20221005121212','20221109121212');
 assert.equal(parseStrict2022CommonCrawlCdxj(Buffer.from(falseYear),kupec.sourceUrl,
  'CC-MAIN-2022-40').length,0);
 const crossPerson=fixture.line.replace(kupec.sourceUrl,carla.sourceUrl);
 assert.equal(parseStrict2022CommonCrawlCdxj(Buffer.from(crossPerson),kupec.sourceUrl,
  'CC-MAIN-2022-40').length,0);
 assert.throws(()=>parseStrict2022CommonCrawlCdxj(Buffer.from(fixture.line),kupec.sourceUrl,
  'CC-MAIN-2022-49'),/Unknown original historical/);
});
test('full fixed-source acquisition: verified 2022 Wayback and HTTP206 WARC plus dated present copies, ZERO policy promotion',async()=>{
 const root=mkdtempSync(join(tmpdir(),'2022-ever-served-archive-fixture-'));
 try{
  const capture='20221004030802';
  const archived=Buffer.from('<html><body>Fictional 2022 site page, do not label actual policy</body></html>');
  const archiveUrl='https://web.archive.org/web/'+capture+'id_/'+carla.sourceUrl;
  const fixture=fakeWarc();
  let actualRanges=0,requestCount=0;
  const mock=async(url:string|URL|Request,init?:RequestInit):Promise<Response>=>{
   requestCount++;
   const u=String(url);
   if(u===archiveUrl)return new Response(archived,{status:200,
    headers:{'content-type':'text/html','memento-datetime':'Tue, 04 Oct 2022 03:08:02 GMT'}});
   if(u.startsWith('https://web.archive.org/cdx/search/cdx?')){
    const source=new URL(u).searchParams.get('url');
    if(source===carla.sourceUrl)return new Response(JSON.stringify([
     ['timestamp','original','mimetype','statuscode','digest','length'],
     [capture,carla.sourceUrl,'text/html','200',base32Sha1Archive(archived),String(archived.length)],
    ]),{status:200});
    return new Response(JSON.stringify([
     ['timestamp','original','mimetype','statuscode','digest','length'],
    ]),{status:200});
   }
   if(u.startsWith('https://index.commoncrawl.org/')){
    const parsed=new URL(u);
    if(parsed.pathname==='/CC-MAIN-2022-40-index'
      &&parsed.searchParams.get('url')===kupec.sourceUrl)
      return new Response(fixture.line,{status:200});
    return new Response('No Captures',{status:404});
   }
   if(u===fixture.url){
    actualRanges++;
    assert.equal((init?.headers as Record<string,string>).range,
     'bytes='+fixture.row.offset+'-'+(fixture.row.offset+fixture.row.length-1));
    return new Response(fixture.gzip,{status:206,headers:{
     'content-type':'application/octet-stream','content-range':fixture.range}});
   }
   if(targetData.targets.some(t=>t.sourceUrl===u))
    return new Response('<html><body>Current 2026 mutable page</body></html>',{status:200,
     headers:{'content-type':'text/html'}});
   return new Response('unavailable',{status:404});
  };
  const result=await acquire2022EverServedSenateCampaignOriginals(join(root,'received'),
   realSenatorFixture(),mock as typeof fetch);
  assert.equal(requestCount,5+5+1+15+1);
  assert.equal(actualRanges,1);
  assert.equal(result.totals.actualEverServedSenators,4);
  assert.equal(result.totals.exactSourcePathsAttempted,5);
  assert.equal(result.totals.waybackIndexHistoricalRows,1);
  assert.equal(result.totals.historicWaybackPagesVerifiedByOriginalDigest,1);
  assert.equal(result.totals.commonCrawlOriginalWarcRangesAttempted,1);
  assert.equal(result.totals.commonCrawlOriginalPagesVerifiedByWarcAndIndexDigest,1);
  assert.equal(result.totals.senatorsWithAtLeastOneVerifiedPreElectionPage,2);
  assert.equal(result.totals.nonsenatorNamesIncluded,0);
  assert.equal(result.totals.historicallyOriginalCandidatePolicyExcerptsAttributed,0);
  assert.equal(result.totals.forecastEvidenceAdmitted,0);
  const carlaRow=result.persons.find(p=>p.candidateName==='Carla Nelson'
   &&p.targetId==='carla-2022-page-a')!;
  assert.equal(carlaRow.earliestVerifiedOriginalPageCaptureByUtc,'2022-10-04T03:08:02.000Z');
  assert.ok(carlaRow.currentWebPageRetrieval.observedAtUtc.startsWith('2026-'));
  assert.equal(carlaRow.originalPageFirstAuthorPublicationDate,null);
  const robRow=result.persons.find(p=>p.candidateName==='Rob Kupec')!;
  assert.equal(robRow.earliestVerifiedOriginalPageCaptureByUtc,'2022-10-05T12:12:12.000Z');
  assert.equal(robRow.earliestVerifiedOriginalPolicyStatementPublicBy,null);
  assert.ok(readFileSync(join(root,'received',
    'rob-2022-campaign-20221005121212-cc-main-2022-40.html')).equals(fixture.html));
  assert.equal(statSync(join(root,'received','acquisition-manifest.json')).mode&0o777,0o600);
  assert.ok(readdirSync(join(root,'received')).length>=8);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('HTTP200 WARC response without valid 206 byte-range is NOT historical page proof',async()=>{
 const root=mkdtempSync(join(tmpdir(),'2022-warc-not206-'));
 try{
  const fixture=fakeWarc();
  const mock=async(url:string|URL|Request):Promise<Response>=>{
   const u=String(url);
   if(u.startsWith('https://web.archive.org/cdx'))return new Response('No index',{status:503});
   if(u.startsWith('https://index.commoncrawl.org/')){
    if(new URL(u).searchParams.get('url')===kupec.sourceUrl
     &&new URL(u).pathname==='/CC-MAIN-2022-40-index')
     return new Response(fixture.line,{status:200});
    return new Response('No index',{status:404});
   }
   if(u===fixture.url)return new Response(fixture.gzip,{status:200});
   return new Response('unavailable',{status:404});
  };
  const r=await acquire2022EverServedSenateCampaignOriginals(join(root,'received'),
   realSenatorFixture(),mock as typeof fetch);
  assert.equal(r.totals.commonCrawlHistoricalIndexCandidateRows,1);
  assert.equal(r.totals.commonCrawlOriginalPagesVerifiedByWarcAndIndexDigest,0);
  assert.equal(r.totals.senatorsWithAtLeastOneVerifiedPreElectionPage,0);
  assert.ok(r.persons.every(x=>x.earliestVerifiedOriginalPolicyStatementPublicBy===null));
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('official directory missing a served senator stops BEFORE network and artifact creation',async()=>{
 const root=mkdtempSync(join(tmpdir(),'2022-lrl-gate-'));
 try{
  const directory=realSenatorFixture();
  directory.senators=directory.senators.filter(p=>!p.officialName.includes('Nelson'));
  let called=0;
  await assert.rejects(()=>acquire2022EverServedSenateCampaignOriginals(
   join(root,'no-run'),directory,(async()=>{called++;throw Error('not allowed');}) as typeof fetch),
   /has not been verified/);
  assert.equal(called,0);
 }finally{rmSync(root,{recursive:true,force:true});}
});
