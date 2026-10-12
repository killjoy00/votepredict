/**
 * #864 Track B V6: candidate originals only. The June 2022 expenditure CSV
 * was independently CDX-SHA1 and whole-body SHA256 authenticated in the public
 * V4 run (38285676317). This bounded retry requires those BOTH fixed hashes
 * on freshly fetched exact archived raw bytes. It never substitutes a live CSV
 * or treats unavailable Wayback as missing finance observations.
 *
 * Other candidate captures still require the V4 fresh CDX+raw-body proof.
 * Private transaction rowKeys are ONLY exposed to the protected in-memory
 * callback; neither source bodies nor row keys are printable receipts.
 */
import {createHash} from 'node:crypto';
import {parseCfbCandidateExpenditureCsv}
 from '../src/evidence/cfb-candidate-finance-history.js';
import {sha1Base32}
 from './prove-cfb-864-public-archived-csv-source-v1.js';
import {
 authenticatePinnedCfbOriginal,validReplayRedirect,
 PINNED_CFB_ORIGINALS,PINNED_V4_RAW_BYTES,PINNED_V4_MAX_REDIRECTS,
} from './prove-cfb-864-pinned-public-originals-v4.js';
import type {
 AuthenticatedPinnedRows,PinnedResult,
} from './prove-cfb-864-pinned-public-originals-v4.js';

export const CFB_864_CANDIDATE_V6_MARKER=
 'SENATE_864_CFB_CANDIDATE_PARITY_READONLY_V6_20261012' as const;
export const V6_CANDIDATE_SOURCES=[
 PINNED_CFB_ORIGINALS[0],PINNED_CFB_ORIGINALS[1],PINNED_CFB_ORIGINALS[2],
] as const;
const expenditure=PINNED_CFB_ORIGINALS[2];

/** Public immutable fingerprint from merged V4 independently verified receipt.
 * No raw CSV body is retained in source control.
 */
export const V4_EXPENDITURE_CHECKPOINT=Object.freeze({
 sourceId:'cand_expend_2022',
 timestamp:'20220606103037',
 officialSelector:'-1890073264',
 cdxSha1Base32:'GMF33XY3X4LNADGCPU52JWEDWRHXE23V',
 originalSha256:'6d9d9061a0a4080083b62b352763697852105c10b3ab1d1bef96fea25ce4d00b',
 originalBytes:41138871,
 rows2021:18497,rows2022:3241,distinctRowKeys:21495,
});
export type OriginalFingerprint={
 cdxSha1Base32:string;originalSha256:string;originalBytes:number;
};
/** Offline-testable WHOLE-byte dual-digest check. Caller must pin the trusted
 * fingerprint separately; production uses the frozen V4 public checkpoint.
 */
export function matchesWholePriorOriginal(
 bytes:Uint8Array,expected:OriginalFingerprint,
):boolean{
 return Number.isSafeInteger(expected.originalBytes)
  &&bytes.byteLength===expected.originalBytes
  &&/^[A-Z2-7]{32}$/.test(expected.cdxSha1Base32)
  &&/^[a-f0-9]{64}$/.test(expected.originalSha256)
  &&sha1Base32(bytes)===expected.cdxSha1Base32
  &&createHash('sha256').update(bytes).digest('hex')===expected.originalSha256;
}
function fixedExpenditureIdentity(){
 if(expenditure.id!==V4_EXPENDITURE_CHECKPOINT.sourceId
  ||expenditure.timestamp!==V4_EXPENDITURE_CHECKPOINT.timestamp
  ||new URL(expenditure.original).searchParams.get('download')
    !==V4_EXPENDITURE_CHECKPOINT.officialSelector
  ||expenditure.stream!=='candidate_expenditures')
  throw Error('V4 public original identity changed; do not retry');
}
async function boundedBytes(response:Response):Promise<Uint8Array>{
 const header=response.headers.get('content-length');
 if(header!==null){
  const length=Number(header);
  if(!Number.isSafeInteger(length)||length<0||length>PINNED_V4_RAW_BYTES)
   throw Error('Raw replay byte cap');
 }
 if(!response.body)throw Error('Missing complete replay stream');
 const reader=response.body.getReader();
 const chunks:Uint8Array[]=[];let length=0;
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(done)break;
   length+=value.byteLength;
   if(length>PINNED_V4_RAW_BYTES)throw Error('Raw replay byte cap');
   chunks.push(value);
  }
 }finally{await reader.cancel().catch(()=>undefined)}
 const out=new Uint8Array(length);let at=0;
 for(const chunk of chunks){out.set(chunk,at);at+=chunk.length}
 return out;
}
function identicalArchiveReplay(finalUrl:string,requested:string):boolean{
 if(!finalUrl)return false;
 try{
  const actual=new URL(finalUrl),expected=new URL(requested);
  return actual.origin==='https://web.archive.org'
   &&actual.pathname===expected.pathname
   &&actual.search===expected.search
   &&actual.hash===''&&actual.username===''&&actual.password==='';
 }catch{return false}
}
/** No CDX index request on this precise expenditure original. A positive
 * result still demands that independently fetched full immutable replay bytes
 * match BOTH digests from the earlier V4 CDX-authenticated source proof.
 */
export async function authenticatePriorProvenExpenditureV6(
 fetchImpl:typeof fetch=fetch,
):Promise<{result:PinnedResult;authenticated:AuthenticatedPinnedRows|null}>{
 fixedExpenditureIdentity();
 const result:PinnedResult={id:expenditure.id,stream:expenditure.stream,
  status:'replay_network_hold',cdxRowsChecked:0,replayRequests:0,verified:null};
 let requested='https://web.archive.org/web/'+expenditure.timestamp+'id_/'+expenditure.original;
 let hops=0;
 for(;;){
  if(result.replayRequests>=PINNED_V4_MAX_REDIRECTS+1){
   result.status='replay_redirect_hold';return{result,authenticated:null};
  }
  result.replayRequests++;
  try{
   const response=await fetchImpl(requested,{
    redirect:'manual',
    headers:{'user-agent':'VotePredict/2.0 immutable V4 original dual digest'},
    signal:AbortSignal.timeout(100000),
   });
   if(response.status>=300&&response.status<400){
    const location=response.headers.get('location');
    if(!location){result.status='replay_redirect_hold';return{result,authenticated:null}}
    try{requested=validReplayRedirect(requested,location,expenditure);hops++}
    catch{result.status='replay_redirect_hold';return{result,authenticated:null}}
    continue;
   }
   if(!response.ok){result.status='replay_http_hold';return{result,authenticated:null}}
   if(!identicalArchiveReplay(response.url,requested)){
    result.status='replay_redirect_hold';return{result,authenticated:null};
   }
   const bytes=await boundedBytes(response);
   if(!matchesWholePriorOriginal(bytes,V4_EXPENDITURE_CHECKPOINT)){
    result.status='replay_digest_mismatch';return{result,authenticated:null};
   }
   // No parser or row keys are trusted until BOTH complete-byte hashes match.
   const csv=Buffer.from(bytes).toString('utf8').replace(/^\uFEFF/,'');
   const rows=parseCfbCandidateExpenditureCsv(csv,{fromYear:2021,toYear:2022});
   const rowKeys=new Set(rows.map(x=>x.rowKey));
   const rows2021=rows.filter(x=>x.year===2021).length;
   const rows2022=rows.filter(x=>x.year===2022).length;
   if(rows2021!==V4_EXPENDITURE_CHECKPOINT.rows2021
    ||rows2022!==V4_EXPENDITURE_CHECKPOINT.rows2022
    ||rowKeys.size!==V4_EXPENDITURE_CHECKPOINT.distinctRowKeys
    ||[...rowKeys].some(k=>!(/^[a-f0-9]{64}$/.test(k)))){
    result.status='replay_parse_hold';return{result,authenticated:null};
   }
   const proof={
    id:expenditure.id,stream:expenditure.stream,capturedOn:'2022-06-06',
    originalSha256:V4_EXPENDITURE_CHECKPOINT.originalSha256,
    cdxSha1Base32:V4_EXPENDITURE_CHECKPOINT.cdxSha1Base32,
    originalBytes:bytes.byteLength,rows2021,rows2022,
    distinctRowKeys:rowKeys.size,duplicateRowKeys:rows.length-rowKeys.size,
    safeRedirectHops:hops,
   };
   const authenticated={source:expenditure,proof,rowKeys};
   result.status='verified';result.verified=proof;
   return {result,authenticated};
  }catch(error){
   const msg=error instanceof Error?error.message:'';
   result.status=/byte cap/i.test(msg)?'replay_byte_cap_hold':
    /redirect|archive|URL/i.test(msg)?'replay_redirect_hold':
    /parse|CSV|column|row|date/i.test(msg)?'replay_parse_hold':
    'replay_network_hold';
   return{result,authenticated:null};
  }
 }
}
export async function collectCandidateOriginalsV6(
 fetchImpl:typeof fetch=fetch,
 onAuthenticated?:(source:AuthenticatedPinnedRows)=>Promise<void>,
):Promise<{results:PinnedResult[]}>{
 const results:PinnedResult[]=[];
 // Exact, bounded contribution versions: fresh CDX + whole-body hash.
 for(const source of V6_CANDIDATE_SOURCES.slice(0,2)){
  const tested=await authenticatePinnedCfbOriginal(source,fetchImpl);
  results.push(tested.result);
  if(tested.authenticated&&onAuthenticated)
   await onAuthenticated(tested.authenticated);
 }
 // Expenditure: same archived original and prior independently trusted SHA1
 // AND SHA256; every raw byte must be independently re-fetched and rehashed.
 const tested=await authenticatePriorProvenExpenditureV6(fetchImpl);
 results.push(tested.result);
 if(tested.authenticated&&onAuthenticated)
  await onAuthenticated(tested.authenticated);
 return{results};
}
