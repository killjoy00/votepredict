import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {
 CFB_ARCHIVED_CSV_V1_MARKER,PUBLIC_CFB_ARCHIVED_CSV_SOURCES,
 PUBLIC_CFB_ARCHIVE_RESULT_SCHEMA,
 sha1Base32,exactCaptureOn,validateCdxCandidateCsvCaptures,
 verifyAndCountCandidateCsv,rawReplayUrl,provePublicCandidateCsvSources,
 assertPublicCfbCsvV1MainOnly,
} from '../scripts/prove-cfb-864-public-archived-csv-source-v1.js';

const stamp='20230227163825';
const headers=['timestamp','original','statuscode','digest','mimetype','length'];
const first=PUBLIC_CFB_ARCHIVED_CSV_SOURCES[0];
const second=PUBLIC_CFB_ARCHIVED_CSV_SOURCES[1];
function fixture(stream:'candidate_contributions'|'candidate_expenditures'):Buffer{
 const contrib=stream==='candidate_contributions';
 const header=contrib
  ?'Year,Recipient,Recipient reg num,Receipt date,Contributor,Amount'
  :'Year,Committee name,Committee reg num,Date,Amount,Unpaid amount,Vendor name';
 const rows=Array.from({length:30},(_,i)=>{
  const year=i<15?2021:2022;
  const day=String((i%28)+1).padStart(2,'0');
  return contrib
   ?[year,'Example Senate Committee','12345',year+'-03-'+day,'Synthetic '+i,10+i].join(',')
   :[year,'Example Senate Committee','12345',year+'-03-'+day,10+i,0,'Synthetic '+i].join(',');
 });
 return Buffer.from([header,...rows].join('\n')+'\n','utf8');
}
function cdxRows(original:string,timestamp:string,bytes:Buffer){
 return [headers,[timestamp,original,'200',sha1Base32(bytes),'text/plain',String(bytes.length)]];
}
const image1=fixture(first.stream),image2=fixture(second.stream);
const dig1=sha1Base32(image1),dig2=sha1Base32(image2);

test('RFC4648 base32 SHA1 computes original CDX digest exactly, independent SHA256 available',()=>{
 assert.equal(sha1Base32(Buffer.from('abc')), 'VGMT4NSHA2AWVOR6EVYXQUGCNSONBWE5');
 assert.match(createHash('sha256').update(image1).digest('hex'),/^[a-f0-9]{64}$/);
 assert.notEqual(dig1,dig2);
 assert.equal(dig1.length,32);
 assert.equal(exactCaptureOn(stamp),'2023-02-27');
 assert.throws(()=>exactCaptureOn('20230229010000'));
 assert.throws(()=>exactCaptureOn('20240101000000'));
 assert.throws(()=>exactCaptureOn('20230227163825more'));
});
test('CDX source identity is exact two approved CFB download selectors, no extra fields',()=>{
 const captures=validateCdxCandidateCsvCaptures(cdxRows(first.original,stamp,image1),first);
 assert.deepEqual(captures,[{timestamp:stamp,original:first.original,digest:dig1}]);
 assert.equal(rawReplayUrl(captures[0]),
  'https://web.archive.org/web/'+stamp+'id_/'+first.original);
 const bad=[
  [headers,[stamp,second.original,'200',dig1,'text/plain','1234']],
  [headers,[stamp,first.original,'301',dig1,'text/plain','1234']],
  [headers,[stamp,first.original,'200','AA','text/plain','1234']],
  [headers,[stamp,first.original,'200',dig1,'text/html','1234']],
  [[...headers,'private_donor_value'],[stamp,first.original,'200',dig1,'text/plain','1234','n']],
 ];
 for(const payload of bad)assert.throws(()=>validateCdxCandidateCsvCaptures(payload,first));
});
test('original raw bytes CDX SHA1 AND public SHA256 required before parsing deterministic keys',()=>{
 const candidate={timestamp:stamp,original:first.original,digest:dig1};
 const r=verifyAndCountCandidateCsv(image1,candidate,'candidate_contributions');
 assert.equal(r.originalBytes,image1.length);
 assert.equal(r.originalSha256,createHash('sha256').update(image1).digest('hex'));
 assert.equal(r.cdxSha1Base32,dig1);
 assert.equal(r.parsed2021,15);assert.equal(r.parsed2022,15);
 assert.equal(r.distinctParsedRowKeys,30);assert.equal(r.repeatedParsedRowKeys,0);
 assert.deepEqual(Object.keys(r).sort(),[
  'stream','original','timestamp','capturedOn','cdxSha1Base32',
  'originalSha256','originalBytes','parsed2021','parsed2022',
  'distinctParsedRowKeys','repeatedParsedRowKeys',
 ].sort());
 assert.throws(()=>verifyAndCountCandidateCsv(
  Buffer.from('bad'+image1.toString().slice(3)),candidate,'candidate_contributions'),
  /digest differs/);
 assert.throws(()=>verifyAndCountCandidateCsv(image1,{
  ...candidate,digest:dig2,
 },'candidate_contributions'),/digest differs/);
 const spend=verifyAndCountCandidateCsv(image2,{
  timestamp:stamp,original:second.original,digest:dig2,
 },'candidate_expenditures');
 assert.equal(spend.parsed2021,15);assert.equal(spend.parsed2022,15);
});
test('strict public-only mocked CDX and id_ raw retrieval yields count-only two-family receipt',async()=>{
 const calls:string[]=[];
 const fake=async(url:RequestInfo|URL)=>{
  const value=String(url);calls.push(value);
  if(value.startsWith('https://web.archive.org/cdx/search/cdx?')){
   const query=new URL(value).searchParams.get('url');
   if(query===first.original)
    return new Response(JSON.stringify(cdxRows(first.original,stamp,image1)),{status:200});
   if(query===second.original)
    return new Response(JSON.stringify(cdxRows(second.original,stamp,image2)),{status:200});
  }
  if(value===rawReplayUrl({timestamp:stamp,original:first.original}))
   return new Response(image1.toString('utf8'),{status:200});
  if(value===rawReplayUrl({timestamp:stamp,original:second.original}))
   return new Response(image2.toString('utf8'),{status:200});
  throw Error('Unexpected public source URL');
 };
 const result=await provePublicCandidateCsvSources(fake as typeof fetch);
 assert.equal(result.schema,PUBLIC_CFB_ARCHIVE_RESULT_SCHEMA);
 assert.equal(result.results.length,2);
 assert.deepEqual(result.results.map(x=>x.status),['authenticated','authenticated']);
 assert.deepEqual(result.results.map(x=>x.verified?.distinctParsedRowKeys),[30,30]);
 assert.equal(result.privateStoredRowParityEstablished,false);
 assert.equal(result.sourceOnlyNoNeon,true);
 assert.equal(result.originalReportPdfHistoricalPublicByEstablished,false);
 assert.equal(result.firstPublicationKnown,false);
 assert.equal(result.legislatorFilingDutyDenominatorEstablished,false);
 assert.equal(calls.length,4);
 assert.doesNotMatch(JSON.stringify(result),/Synthetic [0-9]+|donor|address|employer|metadata\.rowKey/i);
});
test('digest mismatch does not return proof even with a valid parser',async()=>{
 const fake=async(url:RequestInfo|URL)=>{
  const value=String(url);
  if(value.includes('/cdx/search/cdx?')){
   const source=new URL(value).searchParams.get('url')===first.original?first:second;
   const bytes=source.stream==='candidate_contributions'?image1:image2;
   return new Response(JSON.stringify(cdxRows(source.original,stamp,bytes)),{status:200});
  }
  // Raw replay has changed without matching the CDX original snapshot.
  return new Response('X'.repeat(510),{status:200});
 };
 const result=await provePublicCandidateCsvSources(fake as typeof fetch);
 assert.deepEqual(result.results.map(x=>x.status),[
  'cdx_body_digest_mismatch','cdx_body_digest_mismatch',
 ]);
 assert.ok(result.results.every(x=>x.verified===null));
 assert.ok(result.results.every(x=>x.capturesAttempted===1));
});
test('malformed CDX, unknown source and unavailable captures fail closed; not zero original rows',async()=>{
 const fake=async(url:RequestInfo|URL)=>{
  if(String(url).includes('/cdx/search/cdx?'))
   return new Response(JSON.stringify([headers.slice(1)]),{status:200});
  throw Error('Unexpected replay fetch');
 };
 const result=await provePublicCandidateCsvSources(fake as typeof fetch);
 assert.ok(result.results.every(x=>x.status==='invalid_cdx_metadata'));
 assert.ok(result.results.every(x=>x.verified===null));
 const none=async()=>new Response(JSON.stringify([headers]),{status:200});
 const empty=await provePublicCandidateCsvSources(none as typeof fetch);
 assert.ok(empty.results.every(x=>x.status==='no_indexed_capture'));
});
test('reviewed first attempt main-only owner comment or genuine push, never a PR or rerun',()=>{
 const pass={
  GITHUB_EVENT_NAME:'push',GITHUB_REPOSITORY:'killjoy00/votepredict',
  GITHUB_REF:'refs/heads/main',GITHUB_RUN_ATTEMPT:'1',
  GITHUB_SHA:'a'.repeat(40),CFB_864_CSV_V1_VERIFIED_MARKER:'true',
 };
 assert.doesNotThrow(()=>assertPublicCfbCsvV1MainOnly(pass));
 assert.throws(()=>assertPublicCfbCsvV1MainOnly({...pass,GITHUB_EVENT_NAME:'issue_comment'}));
 assert.doesNotThrow(()=>assertPublicCfbCsvV1MainOnly({
  ...pass,GITHUB_EVENT_NAME:'issue_comment',
  CFB_864_CSV_V1_OWNER_ISSUE_COMMENT_VERIFIED:'true',
 }));
 for(const change of [
  {GITHUB_EVENT_NAME:'pull_request'},{GITHUB_REPOSITORY:'other/repo'},
  {GITHUB_REF:'refs/heads/feature'},{GITHUB_RUN_ATTEMPT:'2'},
  {GITHUB_SHA:'bad'},{CFB_864_CSV_V1_VERIFIED_MARKER:'false'},
 ])assert.throws(()=>assertPublicCfbCsvV1MainOnly({...pass,...change}));
 assert.equal(CFB_ARCHIVED_CSV_V1_MARKER,'SENATE_864_CFB_2021_22_ARCHIVE_RAW_CSV_V1');
});
test('workflow has no Neon/private input, no source body upload, and script validates as JavaScript',()=>{
 const wf=readFileSync('.github/workflows/senate-864-cfb-2021-22-public-original-csv-v1.yml','utf8');
 assert.match(wf,/issue_comment:\n    types: \[created\]/);
 assert.match(wf,/github\.event\.issue\.number == 864/);
 assert.match(wf,/github\.event\.comment\.user\.login == 'killjoy00'/);
 assert.match(wf,/github\.event\.comment\.author_association == 'OWNER'/);
 assert.match(wf,/SENATE_864_CFB_2021_22_CSV_V1_OWNER_ONE_SHOT/);
 assert.match(wf,/git log -1 --format=%B \| grep -Fq/);
 assert.match(wf,/npm run check/);
 assert.match(wf,/npm audit --omit=dev --audit-level=high/);
 assert.match(wf,/DATABASE_URL_UNPOOLED: postgresql:\/\/postgres:postgres@localhost:5432\/votepredict/);
 assert.doesNotMatch(wf,/NEON_API_KEY|VERCEL_TOKEN|secrets\.|upload-artifact|^\s*schedule:/m);
 const part=wf.split('          script: |\n')[1]??'';
 assert.ok(part.length>1500);
 const source=part.split('\n').filter(Boolean).map(s=>s.startsWith('            ')?s.slice(12):s).join('\n');
 assert.doesNotThrow(()=>new Function('return (async()=>{\n'+source+'\n})'));
});
