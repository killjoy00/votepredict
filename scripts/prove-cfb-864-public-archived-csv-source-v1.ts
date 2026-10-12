/**
 * #864: independent PUBLIC-ONLY original-byte integrity verification for
 * two historically documented CFB 2021-22 candidate bulk-download URLs.
 *
 * No Neon/database access, no private keys, donor/amount/rowKey serialization.
 * A successful CDX digest only authenticates the fetched archived CSV snapshot,
 * NOT the private evidence_item row match, first publication, legal reports,
 * Senate-only coverage, or the current site's downloadable version.
 */
import { createHash } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import {
  parseCfbCandidateContributionCsv,
  parseCfbCandidateExpenditureCsv,
} from '../src/evidence/cfb-candidate-finance-history.js';

export const CFB_ARCHIVED_CSV_V1_MARKER =
  'SENATE_864_CFB_2021_22_ARCHIVE_RAW_CSV_V1' as const;
export const PUBLIC_CFB_ARCHIVED_CSV_SOURCES = [
  {
    stream: 'candidate_contributions',
    original: 'https://cfb.mn.gov/reports-and-data/self-help/data-downloads/campaign-finance/?download=-2113865252',
    documentation:
      'https://github.com/irworkshop/accountability_datacleaning/commit/13fc9173fd4fd586bceaa86be760cde0f4a7d3d2',
  },
  {
    stream: 'candidate_expenditures',
    original: 'https://cfb.mn.gov/reports-and-data/self-help/data-downloads/campaign-finance/?download=-1890073264',
    documentation:
      'https://github.com/irworkshop/accountability_datacleaning/commit/4d94473193a14eb58bf4e689345a8bdaa45de5e5',
  },
] as const;
export type CandidateCsvStream = (typeof PUBLIC_CFB_ARCHIVED_CSV_SOURCES)[number]['stream'];
export const MAX_PUBLIC_ORIGINAL_BYTES = 120_000_000;
export const MAX_CDX_RESULT_BYTES = 160_000;
export const MAX_CDX_CAPTURE_ROWS = 60;
export const MAX_CDX_FETCHES = 2;
export const MAX_ORIGINAL_FETCHES_PER_STREAM = 2;
const CDX_URL = 'https://web.archive.org/cdx/search/cdx';
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const HASH_RE = /^[A-F0-9]{64}$/;
const CDX_RE = /^[A-Z2-7]{32}$/;
const CAPTURE_RE = /^202[1-3](?:0[1-9]|1[0-2])(?:0[1-9]|[12][0-9]|3[01])(?:[01][0-9]|2[0-3])[0-5][0-9][0-5][0-9]$/;
export const PUBLIC_CFB_ARCHIVE_RESULT_SCHEMA = 'cfb-864-cfb-candidate-archived-original-csv-v1';

export interface OriginalCsvCapture {
 stream: CandidateCsvStream;
 original: string;
 timestamp: string;
 capturedOn: string;
 cdxSha1Base32: string;
 originalSha256: string;
 originalBytes: number;
 parsed2021: number;
 parsed2022: number;
 distinctParsedRowKeys: number;
 repeatedParsedRowKeys: number;
}
export type OriginalCsvAttemptStatus =
 | 'authenticated'
 | 'cdx_unavailable'
 | 'no_indexed_capture'
 | 'invalid_cdx_metadata'
 | 'raw_replay_unavailable'
 | 'raw_replay_over_cap'
 | 'cdx_body_digest_mismatch'
 | 'missing_candidate_csv_rows'
 | 'csv_parse_rejected';
export type CfbCsvSourceProbeResult = {
 stream: CandidateCsvStream;
 status: OriginalCsvAttemptStatus;
 capturesConsidered: number;
 capturesAttempted: number;
 verified: OriginalCsvCapture | null;
};
export type CfbCsvProofReceipt = {
 schema: typeof PUBLIC_CFB_ARCHIVE_RESULT_SCHEMA;
 issue:864;
 provenance:'public_wayback_raw_replay_and_cdx_exact_source';
 years:'2021-2022';
 cappedCandidateUrlCount:2;
 maxCdxCaptureRows:60;
 maxOriginalFetchesPerStream:2;
 originalBytesCap:120000000;
 sourceOnlyNoNeon:true;
 privateStoredRowParityEstablished:false;
 originalReportPdfHistoricalPublicByEstablished:false;
 firstPublicationKnown:false;
 legislatorFilingDutyDenominatorEstablished:false;
 noPrivateRowOrDonorOutput:true;
 results:CfbCsvSourceProbeResult[];
};
export function sha1Base32(originalBytes:Uint8Array):string{
 const digest=createHash('sha1').update(originalBytes).digest();
 let bits=0,acc=0,out='';
 for(const byte of digest){
  acc=(acc<<8)|byte;bits+=8;
  while(bits>=5){
   out+=B32[(acc>>>(bits-5))&31];bits-=5;
  }
  acc&=(1<<bits)-1;
 }
 if(bits>0)out+=B32[(acc<<(5-bits))&31];
 return out;
}
export function exactCaptureOn(timestamp:string):string{
 if(!CAPTURE_RE.test(timestamp))throw Error('Invalid bounded historical CDX timestamp');
 const iso=timestamp.slice(0,4)+'-'+timestamp.slice(4,6)+'-'+timestamp.slice(6,8)
  +'T'+timestamp.slice(8,10)+':'+timestamp.slice(10,12)+':'+timestamp.slice(12,14)+'Z';
 const date=new Date(iso);
 if(!Number.isFinite(date.getTime())||date.toISOString()!==iso.replace('Z','.000Z'))
  throw Error('Nonexistent CDX calendar timestamp');
 return iso.slice(0,10);
}
function canonicalOriginal(source:string):string{
 const url=new URL(source);
 if(!['http:','https:'].includes(url.protocol)
  ||url.hostname!=='cfb.mn.gov'||url.username||url.password||url.port
  ||url.pathname!=='/reports-and-data/self-help/data-downloads/campaign-finance/'
  ||url.searchParams.size!==1)
  throw Error('CDX original not a fixed official candidate CSV download');
 const download=url.searchParams.get('download');
 if(download!=='-2113865252'&&download!=='-1890073264')
  throw Error('Unapproved official download selector');
 return url.hostname+url.pathname+'?download='+download;
}
export function validateCdxCandidateCsvCaptures(
 payload:unknown,source:(typeof PUBLIC_CFB_ARCHIVED_CSV_SOURCES)[number],
):Array<{timestamp:string;original:string;digest:string}>{
 if(!Array.isArray(payload)||payload.length<1||!Array.isArray(payload[0])
  ||payload.length>MAX_CDX_CAPTURE_ROWS+1)
  throw Error('Unexpected bounded CDX response');
 const header=(payload[0] as unknown[]);
 const expected=['timestamp','original','statuscode','digest','mimetype','length'];
 if(header.length!==expected.length||header.some((key,i)=>key!==expected[i]))
  throw Error('Unexpected CDX header or extra source field');
 const seen=new Set<string>();
 const result:Array<{timestamp:string;original:string;digest:string}>=[];
 for(const row of payload.slice(1)){
  if(!Array.isArray(row)||row.length!==expected.length
   ||row.some(x=>typeof x!=='string'))throw Error('Unexpected CDX row shape');
  const [timestamp,original,status,digest,mime] = row as string[];
  exactCaptureOn(timestamp);
  if(status!=='200'||!CDX_RE.test(digest)
   ||!canonicalOriginal(original).endsWith(
    new URL(source.original).pathname+'?download='+new URL(source.original).searchParams.get('download')))
    throw Error('Unapproved historical CDX identity');
  if(!/^(?:text\/csv|text\/plain|application\/(?:csv|octet-stream|vnd\.ms-excel)|unknown|unk)$/i.test(mime))
    throw Error('CDX capture does not describe a CSV-like source');
  const key=timestamp+'|'+digest+'|'+canonicalOriginal(original);
  if(seen.has(key))continue;
  seen.add(key);result.push({timestamp,original,digest});
 }
 return result.sort((a,b)=>a.timestamp.localeCompare(b.timestamp)).slice(0,MAX_CDX_CAPTURE_ROWS);
}
export function rawReplayUrl(item:{timestamp:string;original:string}):string{
 exactCaptureOn(item.timestamp);
 canonicalOriginal(item.original);
 return 'https://web.archive.org/web/'+item.timestamp+'id_/'+item.original;
}
export function verifyAndCountCandidateCsv(
 bytes:Uint8Array,capture:{timestamp:string;original:string;digest:string},
 stream:CandidateCsvStream,
):OriginalCsvCapture{
 if(bytes.byteLength>MAX_PUBLIC_ORIGINAL_BYTES||bytes.byteLength<500)
  throw Error('Archived CSV length outside fixed limits');
 if(sha1Base32(bytes)!==capture.digest)
  throw Error('Archived raw replay digest differs from original CDX SHA1');
 const sha256=createHash('sha256').update(bytes).digest('hex');
 if(!HASH_RE.test(sha256))throw Error('Invalid original body fingerprint');
 // Parse original raw bytes; UTF-8 BOM is optional, never modify the hashed bytes.
 const sourceText=Buffer.from(bytes).toString('utf8').replace(/^\uFEFF/,'');
 if(!/\bYear\b/i.test(sourceText.slice(0,400)))
  throw Error('Archived CSV missing year field');
 const parsed=stream==='candidate_contributions'
  ?parseCfbCandidateContributionCsv(sourceText,{fromYear:2021,toYear:2022})
  :parseCfbCandidateExpenditureCsv(sourceText,{fromYear:2021,toYear:2022});
 const year2021=parsed.filter(row=>row.year===2021).length;
 const year2022=parsed.filter(row=>row.year===2022).length;
 if(parsed.length<25||(!year2021&&!year2022))
  throw Error('Archived source lacks at least 25 parsed 2021-22 rows');
 const distinct=new Set(parsed.map(row=>row.rowKey)).size;
 if(distinct>parsed.length||!distinct)throw Error('Invalid parsed candidate row keys');
 return {
  stream,original:capture.original,timestamp:capture.timestamp,
  capturedOn:exactCaptureOn(capture.timestamp),
  cdxSha1Base32:capture.digest,originalSha256:sha256,
  originalBytes:bytes.byteLength,parsed2021:year2021,parsed2022:year2022,
  distinctParsedRowKeys:distinct,repeatedParsedRowKeys:parsed.length-distinct,
 };
}
function reason(error:unknown):OriginalCsvAttemptStatus{
 const message=error instanceof Error?error.message:String(error);
 if(/digest differs/.test(message))return 'cdx_body_digest_mismatch';
 if(/length outside|exceeded maximum/.test(message))return 'raw_replay_over_cap';
 if(/at least 25|missing year field/.test(message))return 'missing_candidate_csv_rows';
 if(/CSV|parsed|utf/i.test(message))return 'csv_parse_rejected';
 return 'raw_replay_unavailable';
}
async function limitedFetchBytes(
 fetchImpl:typeof fetch,url:string,maximum:number,timeoutMs:number,
):Promise<Uint8Array>{
 const response=await fetchImpl(url,{
  redirect:'follow',
  headers:{'user-agent':'VotePredict/2.0 cfb-864-original-public-csv-identity'},
  signal:AbortSignal.timeout(timeoutMs),
 });
 if(!response.ok)throw Error('Public source HTTP unavailable');
 if(response.url){
  const end=new URL(response.url);
  if(end.hostname!=='web.archive.org'||end.protocol!=='https:'
    ||!end.pathname.startsWith('/web/'))
   throw Error('Original replay redirected away from Wayback');
 }
 const sizeHeader=response.headers.get('content-length');
 if(sizeHeader!==null&&Number(sizeHeader)>maximum)
  throw Error('Remote content exceeded maximum');
 const chunks:Buffer[]=[];let length=0;
 if(response.body){
  const reader=response.body.getReader();
  try{
   for(;;){
    const {done,value}=await reader.read();
    if(done)break;
    length+=value.byteLength;
    if(length>maximum)throw Error('Remote content exceeded maximum');
    chunks.push(Buffer.from(value));
   }
  }finally{await reader.cancel().catch(()=>undefined)}
 }else{
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length>maximum)throw Error('Remote content exceeded maximum');
  chunks.push(bytes);
 }
 return Buffer.concat(chunks,length);
}
function indexedCdxUrl(original:string):string{
 canonicalOriginal(original);
 const params=new URLSearchParams({
  url:original,output:'json',
  fl:'timestamp,original,statuscode,digest,mimetype,length',
  filter:'statuscode:200',collapse:'digest',
  from:'20220101',to:'20231231',
  limit:String(MAX_CDX_CAPTURE_ROWS),
 });
 return CDX_URL+'?'+params.toString();
}
export async function provePublicCandidateCsvSources(
 fetchImpl:typeof fetch=fetch,
):Promise<CfbCsvProofReceipt>{
 const results:CfbCsvSourceProbeResult[]=[];
 for(const source of PUBLIC_CFB_ARCHIVED_CSV_SOURCES){
  let rows:Array<{timestamp:string;original:string;digest:string}>=[];
  try{
   const bytes=await limitedFetchBytes(fetchImpl,indexedCdxUrl(source.original),
    MAX_CDX_RESULT_BYTES,45000);
   rows=validateCdxCandidateCsvCaptures(JSON.parse(Buffer.from(bytes).toString('utf8')),source);
  }catch(error){
   results.push({stream:source.stream,
    status:/CDX|capture|original|identity|header/.test(error instanceof Error?error.message:'')
     ?'invalid_cdx_metadata':'cdx_unavailable',
    capturesConsidered:0,capturesAttempted:0,verified:null});
   continue;
  }
  if(!rows.length){
   results.push({stream:source.stream,status:'no_indexed_capture',
    capturesConsidered:0,capturesAttempted:0,verified:null});
   continue;
  }
  let verified:OriginalCsvCapture|null=null;
  let status:OriginalCsvAttemptStatus='raw_replay_unavailable';
  let attempted=0;
  for(const row of rows.slice(0,MAX_ORIGINAL_FETCHES_PER_STREAM)){
   attempted++;
   try{
    const bytes=await limitedFetchBytes(fetchImpl,rawReplayUrl(row),
     MAX_PUBLIC_ORIGINAL_BYTES,180000);
    verified=verifyAndCountCandidateCsv(bytes,row,source.stream);
    status='authenticated';break;
   }catch(error){status=reason(error)}
  }
  results.push({
   stream:source.stream,status,capturesConsidered:rows.length,
   capturesAttempted:attempted,verified,
  });
 }
 return {
  schema:PUBLIC_CFB_ARCHIVE_RESULT_SCHEMA,issue:864,
  provenance:'public_wayback_raw_replay_and_cdx_exact_source',
  years:'2021-2022',cappedCandidateUrlCount:2,maxCdxCaptureRows:60,
  maxOriginalFetchesPerStream:2,originalBytesCap:120000000,
  sourceOnlyNoNeon:true,privateStoredRowParityEstablished:false,
  originalReportPdfHistoricalPublicByEstablished:false,
  firstPublicationKnown:false,legislatorFilingDutyDenominatorEstablished:false,
  noPrivateRowOrDonorOutput:true,results,
 };
}
export function assertPublicCfbCsvV1MainOnly(env:Record<string,string|undefined>){
 const ownerComment=env.GITHUB_EVENT_NAME==='issue_comment'
  &&env.CFB_864_CSV_V1_OWNER_ISSUE_COMMENT_VERIFIED==='true';
 if(env.GITHUB_REPOSITORY!=='killjoy00/votepredict'
  ||env.GITHUB_REF!=='refs/heads/main'
  ||env.GITHUB_RUN_ATTEMPT!=='1'
  ||!(/^[a-f0-9]{40}$/.test(env.GITHUB_SHA??''))
  ||env.CFB_864_CSV_V1_VERIFIED_MARKER!=='true'
  ||!(env.GITHUB_EVENT_NAME==='push'||ownerComment))
  throw Error('Reviewed one-shot main source probe only');
}
async function main(){
 if(process.argv.length!==2)throw Error('No options permitted on archived source probe');
 assertPublicCfbCsvV1MainOnly(process.env);
 const receipt=await provePublicCandidateCsvSources();
 const json=JSON.stringify(receipt);
 if(json.length>18000)throw Error('Unexpected oversized public safe proof receipt');
 if(process.env.GITHUB_OUTPUT)
  appendFileSync(process.env.GITHUB_OUTPUT,
   'public_csv_proof_b64='+Buffer.from(json,'utf8').toString('base64')+'\n');
 // Counts and statuses only; never log CSV bodies, full headers, or row keys.
 console.log('CFB_864_PUBLIC_CSV_PROBE',JSON.stringify(receipt.results.map(x=>({
  stream:x.stream,status:x.status,parsed:x.verified
   ?x.verified.parsed2021+x.verified.parsed2022:0,
 }))));
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/prove-cfb-864-public-archived-csv-source-v1.ts'))
 void main().catch(()=>{console.error('CFB_864_PUBLIC_CSV_PROBE_HELD');process.exitCode=1});
