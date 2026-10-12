/**
 * #864 Track B V8: independently re-fetch exactly two 2022-07-04 Common Crawl
 * WARC index leads discovered by the public-only V7 GitHub CI run.
 *
 * This is a public-source byte-integrity audit ONLY. No Neon, private stored
 * evidence, production credentials, correction, or data/artifact upload.
 * Original CSV/WARC bytes and transaction keys are NEVER logged or persisted.
 * A valid July 4 archive copy is its OWN version, not proof that the known
 * June 6 Wayback version is byte-identical or publicly available earlier.
 */
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import {
 parseCfbCandidateContributionCsv,parseCfbCandidateExpenditureCsv,
} from '../src/evidence/cfb-candidate-finance-history.js';
import {sha1Base32} from './prove-cfb-864-public-archived-csv-source-v1.js';
import {V4_EXPENDITURE_CHECKPOINT} from './prove-cfb-864-candidate-originals-v6.js';

export const CFB_864_CRAWL_V8_MARKER=
 'SENATE_864_CFB_CRAWL_ORIGINAL_BYTES_PUBLIC_V8_20261012';
export const CFB_864_CRAWL_V8_SOURCES=Object.freeze([
 {id:'candidate_contributions',stream:'candidate_contributions',
  selector:'-2113865252',captureDay:'20220704',
  original:'https://cfb.mn.gov/reports-and-data/self-help/data-downloads/campaign-finance/?download=-2113865252',
  digest:'MUZRYIIC5EO6SZH55HJZ5R77RSOT5JNK'},
 {id:'candidate_expenditures',stream:'candidate_expenditures',
  selector:'-1890073264',captureDay:'20220704',
  original:'https://cfb.mn.gov/reports-and-data/self-help/data-downloads/campaign-finance/?download=-1890073264',
  digest:'IY4OVW75AC2SDHPMKL5KYDCVQYO7CBBK'},
]);
export const CFB_864_CRAWL_V8_INDEX='CC-MAIN-2022-27';
const MAX_INDEX_BYTES=64000,MAX_INDEX_ROWS=10;
const MAX_COMPRESSED_WARC_BYTES=120000000;
const MAX_WARC_INFLATED_BYTES=130000000;
const MAX_CSV_BYTES=120000000;
const CAPTURE_RE=/^202[1-3](?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])(?:[01]\d|2[0-3])[0-5]\d[0-5]\d$/;
const B32=/^[A-Z2-7]{32}$/;
function assertOfficialUrl(raw,selector){
 const u=new URL(raw);
 if(!['https:','http:'].includes(u.protocol)||u.hostname!=='cfb.mn.gov'
  ||u.port||u.username||u.password
  ||u.pathname!=='/reports-and-data/self-help/data-downloads/campaign-finance/'
  ||u.searchParams.size!==1||u.searchParams.get('download')!==selector)
  throw Error('WARC/index official original does not match pinned download selector');
}
function assertResponseOrigin(r,requested){
 if(r.url&&r.url!==requested)throw Error('Unexpected external redirect');
 if(r.status>=300&&r.status<400)throw Error('External redirect not allowed');
}
async function exactLimitedBytes(r,max){
 const size=r.headers.get('content-length');
 if(size!==null){
  const n=Number(size);
  if(!Number.isSafeInteger(n)||n<0||n>max)
   throw Error('Invalid or over-limit response length');
 }
 if(!r.body)throw Error('Missing response stream');
 const reader=r.body.getReader(),chunks=[];let length=0;
 try{
  for(;;){
   const {done,value}=await reader.read();if(done)break;
   length+=value.length;if(length>max)throw Error('Response byte cap');
   chunks.push(value);
  }
 }finally{await reader.cancel().catch(()=>undefined)}
 const buf=Buffer.alloc(length);let at=0;
 for(const chunk of chunks){Buffer.from(chunk).copy(buf,at);at+=chunk.length}
 return buf;
}
export function choosePinnedCrawlRecord(body,source){
 const lines=body.trim()===''?[]:body.trim().split(/\r?\n/);
 if(lines.length>MAX_INDEX_ROWS)throw Error('Unbounded CC index results');
 const eligible=[];
 for(const line of lines){
  const r=JSON.parse(line);
  if(!r||typeof r!=='object'||Array.isArray(r)
   ||typeof r.url!=='string'||typeof r.timestamp!=='string'
   ||!CAPTURE_RE.test(r.timestamp)||typeof r.status!=='string'
   ||typeof r.digest!=='string'||!B32.test(r.digest))
   throw Error('Invalid CDX record');
  assertOfficialUrl(r.url,source.selector);
  if(r.status!=='200')continue;
  if(r.timestamp.slice(0,8)!==source.captureDay)continue;
  if(r.digest!==source.digest)throw Error('Crawl index digest changed');
  if(typeof r.mime!=='string'
   ||!/^(?:text\/(?:csv|plain)|application\/(?:csv|octet-stream|vnd\.ms-excel)|unknown|unk)(?:;.*)?$/i.test(r.mime))
   throw Error('Indexed response was not CSV-like');
  const offset=Number(r.offset),length=Number(r.length);
  if(typeof r.filename!=='string'
   ||!r.filename.startsWith('crawl-data/'+CFB_864_CRAWL_V8_INDEX+'/segments/')
   ||!/\/warc\/[A-Za-z0-9_.-]+\.warc\.gz$/.test(r.filename)
   ||!Number.isSafeInteger(offset)||offset<0
   ||!Number.isSafeInteger(length)||length<1
   ||length>MAX_COMPRESSED_WARC_BYTES
   ||!Number.isSafeInteger(offset+length))
   throw Error('Untrusted WARC range pointer');
  eligible.push({...r,offset,length});
 }
 if(eligible.length!==1)throw Error('Missing or conflicting exact July crawl record');
 return eligible[0];
}
function headerMap(block,startLine){
 const lines=block.toString('latin1').split('\r\n');
 if(lines.shift()!==startLine)throw Error('Wrong WARC/HTTP response header');
 const headers=new Map();
 for(const line of lines){
  const split=line.indexOf(':');
  if(split<1)throw Error('Malformed WARC or HTTP header');
  const key=line.slice(0,split).trim().toLowerCase();
  if(headers.has(key))throw Error('Duplicate WARC or HTTP header');
  headers.set(key,line.slice(split+1).trim());
 }
 return headers;
}
/** Verify entire bounded gzip record / WARC / HTTP entity, without parsing
 * donor/transaction data or printing any bytes. Index digest and embedded
 * WARC payload digest must BOTH equal SHA1 of the complete HTTP entity.
 */
export function verifyCfbWarcOriginal(gzipBytes,record,source){
 if(gzipBytes.byteLength!==record.length||gzipBytes.byteLength<50)
  throw Error('Compressed record not exact indexed range');
 let unpacked;
 try{
  unpacked=gunzipSync(gzipBytes,{
   maxOutputLength:MAX_WARC_INFLATED_BYTES,rejectGarbageAfterEnd:true,
  });
 }catch{throw Error('Invalid or over-limit gzip WARC record')}
 const split=unpacked.indexOf('\r\n\r\n');
 if(split<10||split>32768)throw Error('Invalid WARC header boundary');
 const headerPart=unpacked.subarray(0,split);
 const start=headerPart.toString('latin1').split('\r\n')[0];
 if(start!=='WARC/1.0'&&start!=='WARC/1.1')
  throw Error('Not an original WARC response');
 const warc=headerMap(headerPart,start);
 assertOfficialUrl(warc.get('warc-target-uri')||'',source.selector);
 if(warc.get('warc-target-uri')!==record.url)
  throw Error('WARC target and CC index identity disagree');
 if(warc.has('warc-truncated'))throw Error('WARC record marked truncated');
 if(warc.get('warc-type')!=='response'
  ||!/^application\/http\s*;\s*msgtype=response$/i.test(warc.get('content-type')||'')
  ||warc.get('warc-payload-digest')!=='sha1:'+source.digest)
  throw Error('Not a complete indexed WARC response payload');
 const captured=new Date(warc.get('warc-date')||'');
 if(!Number.isFinite(captured.valueOf())
  ||captured.toISOString().slice(0,10).replaceAll('-','')
   !==source.captureDay)
  throw Error('WARC timestamp does not match indexed capture day');
 const declared=Number(warc.get('content-length'));
 const bodyStart=split+4;
 if(!Number.isSafeInteger(declared)||declared<50||declared>MAX_CSV_BYTES+32768
  ||bodyStart+declared>unpacked.length)
  throw Error('Invalid WARC HTTP block length');
 const trailing=unpacked.subarray(bodyStart+declared);
 if(trailing.length&&trailing.toString('latin1')!=='\r\n\r\n')
  throw Error('Extraneous WARC bytes after response record');
 const http=unpacked.subarray(bodyStart,bodyStart+declared);
 const hs=http.indexOf('\r\n\r\n');
 if(hs<8||hs>32768)throw Error('Missing HTTP response headers');
 const statusLine=http.subarray(0,hs).toString('latin1').split('\r\n')[0];
 if(!/^HTTP\/(?:1\.[01]|2(?:\.0)?) 200(?:\s|$)/.test(statusLine))
  throw Error('Indexed WARC is not HTTP 200');
 const httpHeaders=headerMap(http.subarray(0,hs),statusLine);
 const activeEncoding=httpHeaders.get('content-encoding');
 const activeTransfer=httpHeaders.get('transfer-encoding');
 if((activeEncoding&&activeEncoding.toLowerCase()!=='identity')
  ||(activeTransfer&&activeTransfer.toLowerCase()!=='identity'))
  throw Error('Unexpected active HTTP body encoding');
 const body=http.subarray(hs+4);
 if(body.length<500||body.length>MAX_CSV_BYTES)
  throw Error('Truncated or oversize original CSV');
 const lengthHeader=httpHeaders.get('content-length');
 if(lengthHeader!==undefined&&Number(lengthHeader)!==body.length)
  throw Error('Incomplete HTTP entity length');
 const contentType=httpHeaders.get('content-type')||'';
 if(!/^(?:text\/(?:csv|plain)|application\/(?:csv|octet-stream|vnd\.ms-excel))(?:;.*)?$/i.test(contentType))
  throw Error('Original HTTP entity is not CSV');
 if(sha1Base32(body)!==source.digest||record.digest!==source.digest)
  throw Error('Whole original entity does not match CC SHA1');
 return body;
}
export function parseAuthenticatedCfbOriginal(body,source,record){
 const raw=body.toString('utf8').replace(/^\uFEFF/,'');
 if(!/\bYear\b/i.test(raw.slice(0,512)))
  throw Error('Original CSV header missing');
 const parsed=source.stream==='candidate_contributions'
  ?parseCfbCandidateContributionCsv(raw,{fromYear:2021,toYear:2022})
  :source.stream==='candidate_expenditures'
  ?parseCfbCandidateExpenditureCsv(raw,{fromYear:2021,toYear:2022})
  :(()=>{throw Error('Unapproved finance original stream')})();
 if(parsed.length<25||parsed.length>500000)
  throw Error('Original CSV has unexpected historical row count');
 const keys=new Set(parsed.map(x=>x.rowKey));
 if(keys.size<1||[...keys].some(k=>!/^[a-f0-9]{64}$/.test(k)))
  throw Error('Untrusted original row identities');
 const sha256=createHash('sha256').update(body).digest('hex');
 return{
  sourceId:source.id,captureDay:source.captureDay.slice(0,4)+'-'
   +source.captureDay.slice(4,6)+'-'+source.captureDay.slice(6,8),
  sha1Base32:source.digest,originalSha256:sha256,
  originalBytes:body.length,
  rows2021:parsed.filter(x=>x.year===2021).length,
  rows2022:parsed.filter(x=>x.year===2022).length,
  distinctCanonicalRowKeys:keys.size,
  matchesPriorV4JuneExpenditureExactBody:source.id==='candidate_expenditures'
   &&body.length===V4_EXPENDITURE_CHECKPOINT.originalBytes
   &&source.digest===V4_EXPENDITURE_CHECKPOINT.cdxSha1Base32
   &&sha256===V4_EXPENDITURE_CHECKPOINT.originalSha256,
 };
}
function indexRequestUrl(source){
 const p=new URLSearchParams({url:source.original,output:'json',
  filter:'status:200',limit:String(MAX_INDEX_ROWS)});
 return 'https://index.commoncrawl.org/'+CFB_864_CRAWL_V8_INDEX+'-index?'+p.toString();
}
/** Only fixed, code-authored failure categories may be printed: never raw
 * exception strings, URLs, WARC bytes, or original CSV row identities.
 */
function classifiedIntegrityHold(error){
 const message=error instanceof Error?error.message:'';
 const known=[
  ['Compressed record not exact indexed range','compressed_range_mismatch'],
  ['Invalid or over-limit gzip WARC record','gzip_invalid_or_oversized'],
  ['Invalid WARC header boundary','warc_header_invalid'],
  ['Not an original WARC response','warc_version_invalid'],
  ['Wrong WARC/HTTP response header','response_header_invalid'],
  ['Malformed WARC or HTTP header','response_header_invalid'],
  ['Duplicate WARC or HTTP header','duplicate_header_invalid'],
  ['WARC/index official original does not match pinned download selector','warc_target_invalid'],
  ['WARC target and CC index identity disagree','warc_target_index_mismatch'],
  ['WARC record marked truncated','warc_truncated'],
  ['Not a complete indexed WARC response payload','warc_payload_header_invalid'],
  ['WARC timestamp does not match indexed capture day','warc_timestamp_mismatch'],
  ['Invalid WARC HTTP block length','warc_http_length_invalid'],
  ['Extraneous WARC bytes after response record','warc_trailing_bytes'],
  ['Missing HTTP response headers','http_header_missing'],
  ['Indexed WARC is not HTTP 200','http_status_invalid'],
  ['Unexpected active HTTP body encoding','http_content_encoded'],
  ['Truncated or oversize original CSV','csv_size_invalid'],
  ['Incomplete HTTP entity length','http_entity_length_mismatch'],
  ['Original HTTP entity is not CSV','http_content_type_invalid'],
  ['Whole original entity does not match CC SHA1','whole_entity_sha1_mismatch'],
  ['Original CSV header missing','csv_header_missing'],
  ['Original CSV has unexpected historical row count','csv_parsed_row_count_invalid'],
  ['Untrusted original row identities','csv_canonical_keys_invalid'],
  ['Unapproved finance original stream','unapproved_stream'],
 ];
 return known.find(([reason])=>reason===message)?.[1]||'other_integrity_hold';
}
export async function verifyOneCfbCrawlSource(source,fetchPublic=fetch){
 const result={sourceId:source.id,status:'index_network_hold',
  indexDigestPinned:source.digest,verified:null,
  indexHttpStatus:null,rangeHttpStatus:null,holdCode:null};
 const url=indexRequestUrl(source);
 let record;
 try{
  const r=await fetchPublic(url,{method:'GET',redirect:'manual',
   headers:{accept:'application/json'},signal:AbortSignal.timeout(25000)});
  assertResponseOrigin(r,url);
  if(!r.ok){result.status='index_http_hold';result.indexHttpStatus=r.status;return result}
  record=choosePinnedCrawlRecord(
   (await exactLimitedBytes(r,MAX_INDEX_BYTES)).toString('utf8'),source);
 }catch{result.status='index_invalid_or_network_hold';return result}
 const target='https://data.commoncrawl.org/'+record.filename;
 const end=record.offset+record.length-1;
 let gzip;
 try{
  const r=await fetchPublic(target,{method:'GET',redirect:'manual',
   headers:{range:'bytes='+record.offset+'-'+end},
   signal:AbortSignal.timeout(90000)});
  assertResponseOrigin(r,target);
  if(r.status!==206){result.status='warc_range_http_hold';result.rangeHttpStatus=r.status;return result}
  const expectedPrefix='bytes '+record.offset+'-'+end+'/';
  const range=r.headers.get('content-range')||'';
  if(!range.startsWith(expectedPrefix)
   ||!/^bytes \d+-\d+\/(?:\d+|\*)$/.test(range)){
   result.status='warc_invalid_range_hold';return result;
  }
  gzip=await exactLimitedBytes(r,record.length);
  if(gzip.length!==record.length)throw Error('Partial WARC range');
 }catch{result.status='warc_range_network_or_size_hold';return result}
 try{
  const body=verifyCfbWarcOriginal(gzip,record,source);
  const proof=parseAuthenticatedCfbOriginal(body,source,record);
  result.status='verified_independent_2022_07_04_crawl_original';
  result.verified=proof;
 }catch(error){result.status='warc_entity_or_csv_integrity_hold';
  result.holdCode=classifiedIntegrityHold(error)}
 return result;
}
export async function proveCfbCrawlOriginalsV8(fetchPublic=fetch){
 const results=[];
 for(const source of CFB_864_CRAWL_V8_SOURCES)
  results.push(await verifyOneCfbCrawlSource(source,fetchPublic));
 return{
  schema:'cfb-864-candidate-commoncrawl-original-byte-proof-v8',
  issue:864,publicOnlyNoNeon:true,zeroDatabaseWrites:true,
  rawCsvWarcAndKeysNotExported:true,rawBodiesNeverUploaded:true,
  distinctSourceVersionsFromPriorJuneV4:true,
  noFirstPublicationInference:true,storedParityUnproven:true,
  officialSenateDutyDenominatorUnproven:true,
  historicalEligibilityUnmodified:true,
  results,
 };
}
async function main(){
 if(process.argv.length!==2)throw Error('No public proof flags');
 const receipt=await proveCfbCrawlOriginalsV8();
 const safe=JSON.stringify(receipt);
 if(safe.length>7000||safe.includes('cfb.mn.gov')
  ||safe.includes('crawl-data/')||safe.includes('vendorName')
  ||safe.includes('"rowKey"'))
  throw Error('Unsafe original-proof receipt');
 console.log('CFB_864_CRAWL_V8_PUBLIC_BODY_PROOFS_ONLY '+safe);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
 await main();
