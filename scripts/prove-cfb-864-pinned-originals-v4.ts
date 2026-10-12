/**
 * #864 CFB source-only pinned original reauthentication:
 * - contributions, expenditures, and two independently documented 2021-22 IE CSVs
 * - exact historical original URL selectors and archival timestamps from
 *   previously successful #514 read-only and salvage job public receipts
 * - bounded CDX SHA1/Base32 + raw id_ body + canonical parser aggregation
 *
 * Output only proof/HOLD status and public entire-original fingerprints.
 * Never log/upload original CSV, donor/vendor, rowKey, or finance row content.
 * No private DB, SQL, secrets or business-logic eligibility edits.
 */
import {createHash} from 'node:crypto';
import {
 sha1Base32,
 exactCaptureOn,
} from './prove-cfb-864-public-archived-csv-source-v1.js';
import {
 parseCfbCandidateContributionCsv,parseCfbCandidateExpenditureCsv,
} from '../src/evidence/cfb-candidate-finance-history.js';
import {parseCfbIndependentExpenditureCsv}
 from '../src/evidence/cfb-independent-expenditure-history.js';

export const CFB_864_PINNED_V4_MARKER='SENATE_864_CFB_PINNED_ORIGINALS_V4_20261012';
export const CFB_864_PINNED_V4_SCHEMA='cfb-864-four-track-pinned-source-v4';
export const MAX_INDEX_BYTES=120_000;
export const MAX_BODY_BYTES=120_000_000;
export const MAX_CAPTURE_ROWS=50;
const ORIGIN='https://web.archive.org';
const CFB_PATH='/reports-and-data/self-help/data-downloads/campaign-finance/';
const selector=(id:string)=>'https://cfb.mn.gov'+CFB_PATH+'?download='+id;
// Original source selectors and UTC captures were observed in successful
// original-data processing jobs 37074044717 and 37078525502.
export const PINNED_CFB_ORIGINALS=[
 {stream:'candidate_contributions',original:selector('-2113865252'),
  captures:['20220606102411','20230612002907']},
 {stream:'candidate_expenditures',original:selector('-1890073264'),
  captures:['20220606103037','20230607232346']},
 {stream:'ie_primary',original:selector('-617535497'),
  captures:['20230612043206']},
 {stream:'ie_secondary',original:selector('-479050468'),
  captures:['20230612054839']},
] as const;
export type Stream=(typeof PINNED_CFB_ORIGINALS)[number]['stream'];
export type RedirectClass='none'|'same_capture_equivalent'
 |'missing_location'|'outside_archive'|'changed_capture'
 |'wrong_original'|'not_raw_id_replay';
export type SourceStatus='authenticated'|'cdx_http_hold'|'cdx_network_hold'
 |'cdx_invalid_hold'|'exact_capture_not_indexed'
 |'replay_http_hold'|'replay_network_hold'|'replay_redirect_hold'
 |'replay_origin_changed'|'replay_over_cap'|'replay_digest_mismatch'
 |'replay_not_csv'|'replay_parse_hold';
export type Proof={
 stream:Stream;captureDay:string;cdxSha1Base32:string;
 rawSha256:string;rawBytes:number;parsed2021:number;parsed2022:number;
 distinctRowKeys:number;duplicateRowObservations:number;
};
export type Result={
 stream:Stream;status:SourceStatus;redirectClass:RedirectClass;
 pinnedCapturesAttempted:number;indexedExactCaptures:number;
 replayRequests:number;verified:Proof|null;
};
export type Receipt={
 schema:typeof CFB_864_PINNED_V4_SCHEMA;
 issue:864;publicOriginalSourcesOnly:true;noNeonOrPrivateDatabase:true;
 fullBodyHashRequiredForPositiveProof:true;
 privateStoredRowParityEstablished:false;
 firstPublicationKnown:false;
 originalReportPdfHistoricPublicByProven:false;
 sourceDocumentCoverageCensusEstablished:false;
 sourceOnlyNoRawBodyOrRowKeyOutput:true;
 results:Result[];
};
type Pin=(typeof PINNED_CFB_ORIGINALS)[number];
type Indexed={timestamp:string;original:string;digest:string};

function canonical(source:string):string{
 const url=new URL(source);
 if(!['https:','http:'].includes(url.protocol)||url.hostname!=='cfb.mn.gov'
  ||url.port||url.username||url.password||url.pathname!==CFB_PATH
  ||url.searchParams.size!==1)throw Error('source identity');
 const id=url.searchParams.get('download');
 if(!PINNED_CFB_ORIGINALS.some(x=>new URL(x.original).searchParams.get('download')===id))
  throw Error('unapproved selector');
 return url.hostname+url.pathname+'?download='+id;
}
function indexUrl(source:Pin,timestamp:string):string{
 exactCaptureOn(timestamp);
 const params=new URLSearchParams({
  url:source.original,output:'json',
  fl:'timestamp,original,statuscode,digest,mimetype,length',
  filter:'statuscode:200',from:timestamp,to:timestamp,
  limit:String(MAX_CAPTURE_ROWS),
 });
 return ORIGIN+'/cdx/search/cdx?'+params.toString();
}
export function exactPinnedCdxRows(payload:unknown,source:Pin,timestamp:string):Indexed[]{
 if(!Array.isArray(payload)||payload.length<1||payload.length>MAX_CAPTURE_ROWS+1
  ||!Array.isArray(payload[0]))throw Error('CDX shape');
 const cols=['timestamp','original','statuscode','digest','mimetype','length'];
 if(payload[0].length!==cols.length||payload[0].some((v:unknown,i:number)=>v!==cols[i]))
  throw Error('CDX header');
 const matches:Indexed[]=[];
 for(const raw of payload.slice(1)){
  if(!Array.isArray(raw)||raw.length!==6||raw.some(v=>typeof v!=='string'))
   throw Error('CDX row shape');
  const [ts,original,status,digest,mime]=raw;
  if(ts!==timestamp)continue;
  if(status!=='200'||!/^[A-Z2-7]{32}$/.test(digest)
   ||canonical(original)!==canonical(source.original)
   ||!(/csv|text\/plain|octet-stream|unknown|unk|vnd\.ms-excel/i.test(mime)))
   throw Error('CDX identity/digest');
  matches.push({timestamp:ts,original,digest});
 }
 if(matches.length>1 && new Set(matches.map(x=>x.digest)).size>1)
  throw Error('ambiguous same-time CDX originals');
 return matches.slice(0,1);
}
function idReplay(c:Indexed):string{
 exactCaptureOn(c.timestamp);canonical(c.original);
 return ORIGIN+'/web/'+c.timestamp+'id_/'+c.original;
}
function parseArchiveLocation(location:string|null,request:string,c:Indexed):
 {kind:RedirectClass;next?:string}{
 if(!location)return{kind:'missing_location'};
 let next:URL;
 try{next=new URL(location,request)}catch{return{kind:'outside_archive'}}
 if(next.origin!==ORIGIN||next.username||next.password||next.port)
  return{kind:'outside_archive'};
 const match=next.pathname.match(/^\/web\/(\d{14})id_\/(https?:\/\/.+)$/);
 if(!match)return{kind:'not_raw_id_replay'};
 if(match[1]!==c.timestamp)return{kind:'changed_capture'};
 try{
  const source=match[2]+next.search;
  if(canonical(source)!==canonical(c.original))return{kind:'wrong_original'};
 }catch{return{kind:'wrong_original'}}
 return{kind:'same_capture_equivalent',next:next.toString()};
}
export function classifyPinnedReplayRedirect(location:string|null,request:string,c:Indexed):
 RedirectClass{
 return parseArchiveLocation(location,request,c).kind;
}
async function fetchBounded(fetchImpl:typeof fetch,url:string,max:number,timeout:number,
 purpose:'index'|'body'):Promise<{status:number;url:string;headers:Headers;bytes:Uint8Array;location:string|null}>{
 const response=await fetchImpl(url,{
  redirect:'manual',
  headers:{'user-agent':'VotePredict/2.0 cfb-864-pinned-original-v4'},
  signal:AbortSignal.timeout(timeout),
 });
 const target=new URL(response.url||url);
 if(target.origin!==ORIGIN||target.username||target.password||target.port
  ||(purpose==='index'&&target.pathname!=='/cdx/search/cdx')
  ||(purpose==='body'&&!target.pathname.startsWith('/web/')))
  throw Error('unapproved response destination');
 const declared=response.headers.get('content-length');
 if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>max))
  throw Error('body cap');
 if(!response.ok){
  await response.body?.cancel().catch(()=>undefined);
  return {status:response.status,url:target.toString(),headers:response.headers,
   bytes:new Uint8Array(),location:response.headers.get('location')};
 }
 if(!response.body)throw Error('no streaming response body');
 const reader=response.body.getReader();const chunks:Uint8Array[]=[];let total=0;
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(done)break;
   total+=value.byteLength;
   if(total>max)throw Error('body cap');
   chunks.push(value);
  }
 }finally{await reader.cancel().catch(()=>undefined)}
 const out=new Uint8Array(total);let i=0;
 for(const chunk of chunks){out.set(chunk,i);i+=chunk.byteLength}
 return {status:response.status,url:target.toString(),headers:response.headers,
  bytes:out,location:null};
}
function probeBody(bytes:Uint8Array,c:Indexed,stream:Stream):Proof{
 if(bytes.byteLength<500||bytes.byteLength>MAX_BODY_BYTES)
  throw Error('body cap');
 if(sha1Base32(bytes)!==c.digest)throw Error('digest mismatch');
 const sha=createHash('sha256').update(bytes).digest('hex');
 const text=Buffer.from(bytes).toString('utf8').replace(/^\uFEFF/,'');
 if(!/\bYear\b/i.test(text.slice(0,450)))throw Error('not csv');
 const rows=stream==='candidate_contributions'
  ?parseCfbCandidateContributionCsv(text,{fromYear:2021,toYear:2022})
  :stream==='candidate_expenditures'
   ?parseCfbCandidateExpenditureCsv(text,{fromYear:2021,toYear:2022})
   :parseCfbIndependentExpenditureCsv(text,{fromYear:2021,toYear:2022});
 const n21=rows.filter(x=>x.year===2021).length;
 const n22=rows.filter(x=>x.year===2022).length;
 const threshold=stream.startsWith('candidate')?25:10;
 if(n21+n22<threshold)throw Error('parsed count');
 const unique=new Set(rows.map(x=>x.rowKey)).size;
 return {stream,captureDay:exactCaptureOn(c.timestamp),
  cdxSha1Base32:c.digest,rawSha256:sha,rawBytes:bytes.byteLength,
  parsed2021:n21,parsed2022:n22,distinctRowKeys:unique,
  duplicateRowObservations:rows.length-unique};
}
function errorStatus(e:unknown,forIndex:boolean):SourceStatus{
 const reason=e instanceof Error?e.message:'';
 if(forIndex)return /CDX|source identity|selector|JSON|shape|header/i.test(reason)
  ?'cdx_invalid_hold':'cdx_network_hold';
 if(/body cap/.test(reason))return'replay_over_cap';
 if(/digest mismatch/.test(reason))return'replay_digest_mismatch';
 if(/not csv/.test(reason))return'replay_not_csv';
 if(/parsed|column|CSV|record/.test(reason))return'replay_parse_hold';
 return'replay_network_hold';
}
export async function reauthenticatePinnedCfbOriginalsV4(
 fetchImpl:typeof fetch=fetch,
):Promise<Receipt>{
 const results:Result[]=[];
 for(const source of PINNED_CFB_ORIGINALS){
  const r:Result={stream:source.stream,status:'exact_capture_not_indexed',
   redirectClass:'none',pinnedCapturesAttempted:0,
   indexedExactCaptures:0,replayRequests:0,verified:null};
  results.push(r);
  for(const ts of source.captures){
   r.pinnedCapturesAttempted++;
   let index:Indexed[];
   try{
    const url=indexUrl(source,ts);
    const response=await fetchBounded(fetchImpl,url,MAX_INDEX_BYTES,30000,'index');
    if(response.status!==200){r.status='cdx_http_hold';continue}
    index=exactPinnedCdxRows(JSON.parse(Buffer.from(response.bytes).toString('utf8')),source,ts);
    if(!index.length){r.status='exact_capture_not_indexed';continue}
    r.indexedExactCaptures+=index.length;
   }catch(e){r.status=errorStatus(e,true);continue}
   const capture=index[0];const url=idReplay(capture);
   try{
    let response=await fetchBounded(fetchImpl,url,MAX_BODY_BYTES,110000,'body');
    r.replayRequests++;
    if(response.status>=300&&response.status<400){
     const next=parseArchiveLocation(response.location,url,capture);
     r.redirectClass=next.kind;
     if(next.kind!=='same_capture_equivalent'||!next.next){
      r.status='replay_redirect_hold';continue;
     }
     r.replayRequests++;
     response=await fetchBounded(fetchImpl,next.next,MAX_BODY_BYTES,110000,'body');
    }
    if(response.status!==200&&response.status!==206){
     r.status='replay_http_hold';continue;
    }
    try{
     r.verified=probeBody(response.bytes,capture,source.stream);
     r.status='authenticated';break;
    }catch(e){r.status=errorStatus(e,false)}
   }catch(e){r.status=errorStatus(e,false)}
  }
 }
 return {schema:CFB_864_PINNED_V4_SCHEMA,issue:864,
  publicOriginalSourcesOnly:true,noNeonOrPrivateDatabase:true,
  fullBodyHashRequiredForPositiveProof:true,
  privateStoredRowParityEstablished:false,firstPublicationKnown:false,
  originalReportPdfHistoricPublicByProven:false,
  sourceDocumentCoverageCensusEstablished:false,
  sourceOnlyNoRawBodyOrRowKeyOutput:true,results};
}
export function assertPinnedV4Execution(e:Record<string,string|undefined>):void{
 const owner=e.GITHUB_EVENT_NAME==='issue_comment'
  &&e.CFB_864_PINNED_V4_OWNER_VERIFIED==='true';
 if(e.GITHUB_REPOSITORY!=='killjoy00/votepredict'
  ||e.GITHUB_REF!=='refs/heads/main'||e.GITHUB_RUN_ATTEMPT!=='1'
  ||!(/^[a-f0-9]{40}$/.test(e.GITHUB_SHA??''))
  ||e.CFB_864_PINNED_V4_MERGE_MARKER!=='true'
  ||!(e.GITHUB_EVENT_NAME==='push'||owner))
  throw Error('Reviewed one-shot main only');
}
async function main(){
 if(process.argv.length!==2)throw Error('No CLI source selection allowed');
 assertPinnedV4Execution(process.env);
 try{
  const receipt=await reauthenticatePinnedCfbOriginalsV4();
  const text=JSON.stringify(receipt);
  if(text.length>12000)throw Error('unsafe receipt length');
  console.log('CFB_864_PINNED_V4 '+text);
 }catch{
  console.error('CFB_864_PINNED_V4_HELD');
  process.exitCode=1;
 }
}
if(process.argv[1]?.replace(/\\/g,'/')
 .endsWith('/prove-cfb-864-pinned-originals-v4.ts'))void main();
