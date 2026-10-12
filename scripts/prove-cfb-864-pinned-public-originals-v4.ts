/**
 * #864 Track B — immutable research leads from independently executed 2026-10-02
 * historical CFB original-CSV parsing. A historical successful parse is NOT
 * an authenticated byte-for-byte CDX rehash; this module rechecks original
 * CDX SHA1 on raw Wayback replay bytes or fails closed.
 *
 * NO private DB, CFB raw CSV, row keys, donor names or amounts in the public
 * results. The separately privileged consumer may use authenticated rowKeys
 * only IN MEMORY inside its protected read-only SQL step.
 */
import {createHash} from 'node:crypto';
import {
 parseCfbCandidateContributionCsv,
 parseCfbCandidateExpenditureCsv,
} from '../src/evidence/cfb-candidate-finance-history.js';
import {parseCfbIndependentExpenditureCsv}
 from '../src/evidence/cfb-independent-expenditure-history.js';
import {sha1Base32,exactCaptureOn} from './prove-cfb-864-public-archived-csv-source-v1.js';

export const CFB_864_PINNED_V4_MARKER=
 'SENATE_864_CFB_PINNED_ORIGINALS_V4_20261012' as const;
export const PINNED_V4_SCHEMA='cfb-864-original-csv-pinned-v4' as const;
const base='https://cfb.mn.gov/reports-and-data/self-help/data-downloads/campaign-finance/';
const mk=(download:string)=>base+'?download='+download;
/**
 * Historical source leads pulled from *successful parse* lines, not from
 * guessed dates or later availableOn values. All are PUBLIC archive locators,
 * but every capture still requires fresh CDX digest/original-byte matching.
 */
export const PINNED_CFB_ORIGINALS=[
 {id:'cand_contrib_2022',stream:'candidate_contributions',
  original:mk('-2113865252'),timestamp:'20220606102411'},
 {id:'cand_contrib_2023',stream:'candidate_contributions',
  original:mk('-2113865252'),timestamp:'20230612002907'},
 {id:'cand_expend_2022',stream:'candidate_expenditures',
  original:mk('-1890073264'),timestamp:'20220606103037'},
 {id:'ie_115995361',stream:'independent_expenditures',
  original:mk('-115995361'),timestamp:'20230803043121'},
 {id:'ie_1316131999',stream:'independent_expenditures',
  original:mk('-1316131999'),timestamp:'20230803042903'},
 {id:'ie_275160089',stream:'independent_expenditures',
  original:mk('-275160089'),timestamp:'20230612075719'},
 {id:'ie_325492613',stream:'independent_expenditures',
  original:mk('-325492613'),timestamp:'20230612075657'},
 {id:'ie_479050468',stream:'independent_expenditures',
  original:mk('-479050468'),timestamp:'20230612054839'},
 {id:'ie_617535497',stream:'independent_expenditures',
  original:mk('-617535497'),timestamp:'20230612043206'},
 {id:'ie_478226068',stream:'independent_expenditures',
  original:mk('478226068'),timestamp:'20230612054917'},
] as const;
export type PinnedSource=(typeof PINNED_CFB_ORIGINALS)[number];
export type PinnedStream=PinnedSource['stream'];
export const PINNED_V4_CDX_LIMIT=60;
export const PINNED_V4_CDX_BYTES=160000;
export const PINNED_V4_RAW_BYTES=120000000;
export const PINNED_V4_MAX_REDIRECTS=2;
export type PinnedStatus='verified'
 |'cdx_network_hold'|'cdx_http_hold'|'cdx_invalid_hold'
 |'cdx_pin_not_indexed'|'cdx_identity_hold'
 |'replay_http_hold'|'replay_network_hold'|'replay_redirect_hold'
 |'replay_byte_cap_hold'|'replay_digest_mismatch'
 |'replay_parse_hold';
export interface PinnedProof {
 id:PinnedSource['id'];stream:PinnedStream;
 capturedOn:string;originalSha256:string;cdxSha1Base32:string;
 originalBytes:number;rows2021:number;rows2022:number;
 distinctRowKeys:number;duplicateRowKeys:number;
 safeRedirectHops:number;
}
export interface PinnedResult{
 id:PinnedSource['id'];stream:PinnedStream;status:PinnedStatus;
 cdxRowsChecked:number;replayRequests:number;
 verified:PinnedProof|null;
}
export interface PinnedReceipt{
 schema:typeof PINNED_V4_SCHEMA;issue:864;
 sourceOnlyNoNeon:true;independentlyMatchedRawCdxSha1OnlyWhenVerified:true;
 noPrivateDonorsAmountsOrRowKeysExported:true;
 noOriginalBodiesUploadedOrLogged:true;
 firstPublicDateEstablished:false;privateStoredParityEstablished:false;
 reportFilingDutyDenominatorEstablished:false;
 results:PinnedResult[];
}
export interface AuthenticatedPinnedRows{
 source:PinnedSource;proof:PinnedProof;
 // PRIVATE-memory-only helper; the caller MUST NOT log or serialize these.
 rowKeys:ReadonlySet<string>;
}
const DIGEST=/^[A-Z2-7]{32}$/;
function canonicalOfficial(original:string):string{
 const u=new URL(original);
 if((u.protocol!=='https:'&&u.protocol!=='http:')
   ||u.hostname!=='cfb.mn.gov'
   ||u.username||u.password||u.port
   ||u.pathname!=='/reports-and-data/self-help/data-downloads/campaign-finance/'
   ||u.searchParams.size!==1)
  throw Error('Unsafe original source identity');
 return u.hostname+u.pathname+'?download='+u.searchParams.get('download');
}
const allowed=new Set(PINNED_CFB_ORIGINALS.map(x=>canonicalOfficial(x.original)));
function captureIndexUrl(source:PinnedSource):string{
 exactCaptureOn(source.timestamp);
 if(!allowed.has(canonicalOfficial(source.original)))
  throw Error('Unapproved candidate CSV source');
 const day=source.timestamp.slice(0,8);
 const p=new URLSearchParams({
  url:source.original,output:'json',
  fl:'timestamp,original,statuscode,digest,mimetype,length',
  filter:'statuscode:200',from:day,to:day,
  limit:String(PINNED_V4_CDX_LIMIT),
 });
 return 'https://web.archive.org/cdx/search/cdx?'+p.toString();
}
function parseCdxExactPin(value:unknown,source:PinnedSource){
 if(!Array.isArray(value)||!Array.isArray(value[0])
  ||value.length<1||value.length>PINNED_V4_CDX_LIMIT+1)
  throw Error('Invalid bounded CDX shape');
 const fields=['timestamp','original','statuscode','digest','mimetype','length'];
 if((value[0] as unknown[]).length!==fields.length
  ||(value[0] as unknown[]).some((v,i)=>v!==fields[i]))
  throw Error('Invalid exact CDX fields');
 const expected=canonicalOfficial(source.original);
 let chosen:null|{timestamp:string;original:string;digest:string}=null;
 for(const row of value.slice(1)){
  if(!Array.isArray(row)||row.length!==fields.length
   ||row.some(v=>typeof v!=='string'))throw Error('Invalid CDX row');
  const [timestamp,original,status,digest,mimetype]=row as string[];
  exactCaptureOn(timestamp);
  if(status!=='200'||!DIGEST.test(digest)
   ||!/^(?:text\/csv|text\/plain|application\/(?:csv|octet-stream|vnd\.ms-excel)|unknown|unk)$/i.test(mimetype)
   ||canonicalOfficial(original)!==expected)
   throw Error('Invalid CDX exact historical source identity');
  if(timestamp===source.timestamp){
   if(chosen&&chosen.digest!==digest)
    throw Error('CDX disagrees on identical pinned capture');
   chosen={timestamp,original,digest};
  }
 }
 return {rowsChecked:value.length-1,pin:chosen};
}
function allowArchiveResponse(response:Response,expected:string,kind:'cdx'|'replay'){
 if(!response.url)throw Error('Archive response final URL missing');
 const url=new URL(response.url),req=new URL(expected);
 if(url.origin!=='https://web.archive.org')
  throw Error('Wayback response redirected away from archive host');
 if(url.pathname!==req.pathname||url.search!==req.search)
  throw Error('Wayback response final capture or CDX identity changed');
 if(kind==='cdx'&&url.pathname!=='/cdx/search/cdx')
  throw Error('Unexpected CDX final endpoint');
}
export function validReplayRedirect(
 current:string,location:string,source:PinnedSource,
):string{
 if(location.length>2200)throw Error('Oversized archive redirect');
 const resolved=new URL(location,current);
 if(resolved.protocol!=='https:'||resolved.hostname!=='web.archive.org'
  ||resolved.port||resolved.username||resolved.password)
  throw Error('Archive redirect outside trusted origin');
 const prefix='/web/'+source.timestamp+'id_/';
 if(!resolved.pathname.startsWith(prefix))throw Error('Archive redirect changed timestamp or replay mode');
 const original=resolved.pathname.slice(prefix.length)+resolved.search;
 if(canonicalOfficial(original)!==canonicalOfficial(source.original))
  throw Error('Archive redirect changed official download selector');
 return resolved.toString();
}
async function limited(response:Response,max:number):Promise<Uint8Array>{
 const header=response.headers.get('content-length');
 if(header!==null){
  const n=Number(header);
  if(!Number.isSafeInteger(n)||n<0||n>max)throw Error('Source over byte cap');
 }
 if(!response.body)throw Error('Missing bounded stream');
 const reader=response.body.getReader(),parts:Uint8Array[]=[];let size=0;
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(done)break;
   size+=value.byteLength;
   if(size>max)throw Error('Source over byte cap');
   parts.push(value);
  }
 }finally{await reader.cancel().catch(()=>undefined)}
 const out=new Uint8Array(size);let at=0;
 for(const part of parts){out.set(part,at);at+=part.byteLength}
 return out;
}
function parseAndHash(
 source:PinnedSource,capture:{timestamp:string;digest:string},
 bytes:Uint8Array,hops:number,
):AuthenticatedPinnedRows{
 if(bytes.byteLength<500||bytes.byteLength>PINNED_V4_RAW_BYTES)
  throw Error('Invalid original body byte size');
 if(sha1Base32(bytes)!==capture.digest)
  throw Error('Original raw replay digest mismatch');
 const sha256=createHash('sha256').update(bytes).digest('hex');
 const raw=Buffer.from(bytes).toString('utf8').replace(/^\uFEFF/,'');
 if(!/\bYear\b/i.test(raw.slice(0,500)))throw Error('No candidate CSV header');
 const parsed=source.stream==='candidate_contributions'
  ?parseCfbCandidateContributionCsv(raw,{fromYear:2021,toYear:2022})
  :source.stream==='candidate_expenditures'
  ?parseCfbCandidateExpenditureCsv(raw,{fromYear:2021,toYear:2022})
  :parseCfbIndependentExpenditureCsv(raw,{fromYear:2021,toYear:2022});
 if(parsed.length<(source.stream==='independent_expenditures'?10:25))
  throw Error('Original source did not parse enough historical rows');
 const rowKeys=new Set(parsed.map(x=>x.rowKey));
 const rows2021=parsed.filter(x=>x.year===2021).length;
 const rows2022=parsed.filter(x=>x.year===2022).length;
 const proof:PinnedProof={
  id:source.id,stream:source.stream,capturedOn:exactCaptureOn(source.timestamp),
  originalSha256:sha256,cdxSha1Base32:capture.digest,
  originalBytes:bytes.byteLength,rows2021,rows2022,
  distinctRowKeys:rowKeys.size,duplicateRowKeys:parsed.length-rowKeys.size,
  safeRedirectHops:hops,
 };
 return {source,proof,rowKeys};
}
export async function authenticatePinnedCfbOriginal(
 source:PinnedSource,fetchImpl:typeof fetch=fetch,
):Promise<{result:PinnedResult;authenticated:AuthenticatedPinnedRows|null}>{
 const result:PinnedResult={id:source.id,stream:source.stream,
  status:'cdx_network_hold',cdxRowsChecked:0,replayRequests:0,verified:null};
 const cdx=captureIndexUrl(source);
 let pin:null|{timestamp:string;original:string;digest:string}=null;
 try{
  const response=await fetchImpl(cdx,{
   redirect:'manual',headers:{accept:'application/json',
    'user-agent':'VotePredict/2.0 research archived-original CDX SHA1'},
   signal:AbortSignal.timeout(28000),
  });
  if(!response.ok){result.status='cdx_http_hold';return{result,authenticated:null}}
  allowArchiveResponse(response,cdx,'cdx');
  const body=await limited(response,PINNED_V4_CDX_BYTES);
  const parsed=parseCdxExactPin(JSON.parse(Buffer.from(body).toString('utf8')),source);
  pin=parsed.pin;result.cdxRowsChecked=parsed.rowsChecked;
 }catch(error){
  const m=error instanceof Error?error.message:'';
  result.status=/CDX|source identity|Wayback response|archive host/i.test(m)
   ?'cdx_identity_hold':/shape|fields|row|syntax|JSON|timestamp/i.test(m)
   ?'cdx_invalid_hold':'cdx_network_hold';
  return{result,authenticated:null};
 }
 if(!pin){result.status='cdx_pin_not_indexed';return{result,authenticated:null}}
 let replay='https://web.archive.org/web/'+source.timestamp+'id_/'+pin.original;
 let hop=0;
 for(;;){
  if(result.replayRequests>=PINNED_V4_MAX_REDIRECTS+1){
   result.status='replay_redirect_hold';return{result,authenticated:null};
  }
  result.replayRequests++;
  try{
   const response=await fetchImpl(replay,{
    redirect:'manual',headers:{'user-agent':'VotePredict/2.0 archived original identity SHA1'},
    signal:AbortSignal.timeout(100000),
   });
   if(response.status>=300&&response.status<400){
    const location=response.headers.get('location');
    if(!location){result.status='replay_redirect_hold';return{result,authenticated:null}}
    try{replay=validReplayRedirect(replay,location,source);hop++}
    catch{result.status='replay_redirect_hold';return{result,authenticated:null}}
    continue;
   }
   if(!response.ok){result.status='replay_http_hold';return{result,authenticated:null}}
   allowArchiveResponse(response,replay,'replay');
   const body=await limited(response,PINNED_V4_RAW_BYTES);
   let proof:AuthenticatedPinnedRows;
   try{proof=parseAndHash(source,pin,body,hop)}
   catch(error){
    const m=error instanceof Error?error.message:'';
    result.status=/digest mismatch/.test(m)?'replay_digest_mismatch':
     /byte size/.test(m)?'replay_byte_cap_hold':'replay_parse_hold';
    return{result,authenticated:null};
   }
   result.status='verified';result.verified=proof.proof;
   return{result,authenticated:proof};
  }catch(error){
   const m=error instanceof Error?error.message:'';
   result.status=/byte cap/.test(m)?'replay_byte_cap_hold':
    /redirect|Wayback response|archive host|capture/.test(m)?
     'replay_redirect_hold':'replay_network_hold';
   return{result,authenticated:null};
  }
 }
}
export function validatePinnedV4Receipt(value:unknown):PinnedReceipt{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Bad V4 receipt');
 const o=value as Record<string,unknown>;
 const top=['schema','issue','sourceOnlyNoNeon',
  'independentlyMatchedRawCdxSha1OnlyWhenVerified',
  'noPrivateDonorsAmountsOrRowKeysExported','noOriginalBodiesUploadedOrLogged',
  'firstPublicDateEstablished','privateStoredParityEstablished',
  'reportFilingDutyDenominatorEstablished','results'];
 if(Object.keys(o).length!==top.length||Object.keys(o).some(k=>!top.includes(k))
  ||o.schema!==PINNED_V4_SCHEMA||o.issue!==864||o.sourceOnlyNoNeon!==true
  ||o.independentlyMatchedRawCdxSha1OnlyWhenVerified!==true
  ||o.noPrivateDonorsAmountsOrRowKeysExported!==true
  ||o.noOriginalBodiesUploadedOrLogged!==true
  ||o.firstPublicDateEstablished!==false||o.privateStoredParityEstablished!==false
  ||o.reportFilingDutyDenominatorEstablished!==false
  ||!Array.isArray(o.results)||o.results.length!==PINNED_CFB_ORIGINALS.length)
  throw Error('Bad V4 public envelope');
 const status=new Set<PinnedStatus>([
  'verified','cdx_network_hold','cdx_http_hold','cdx_invalid_hold',
  'cdx_pin_not_indexed','cdx_identity_hold','replay_http_hold',
  'replay_network_hold','replay_redirect_hold','replay_byte_cap_hold',
  'replay_digest_mismatch','replay_parse_hold',
 ]);
 for(let i=0;i<PINNED_CFB_ORIGINALS.length;i++){
  const v=o.results[i] as Record<string,unknown>,source=PINNED_CFB_ORIGINALS[i];
  if(!v||typeof v!=='object'||Array.isArray(v)
   ||Object.keys(v).length!==6
   ||Object.keys(v).some(k=>!['id','stream','status','cdxRowsChecked','replayRequests','verified'].includes(k))
   ||v.id!==source.id||v.stream!==source.stream
   ||!status.has(v.status as PinnedStatus)
   ||!Number.isInteger(v.cdxRowsChecked)||Number(v.cdxRowsChecked)<0||Number(v.cdxRowsChecked)>60
   ||!Number.isInteger(v.replayRequests)||Number(v.replayRequests)<0||Number(v.replayRequests)>3)
   throw Error('Private or invalid V4 result');
  if((v.status==='verified')!==(v.verified!==null))
   throw Error('V4 body-authentication claim mismatch');
  if(v.verified!==null){
   const p=v.verified as Record<string,unknown>;
   const keys=['id','stream','capturedOn','originalSha256','cdxSha1Base32',
    'originalBytes','rows2021','rows2022','distinctRowKeys',
    'duplicateRowKeys','safeRedirectHops'];
   if(!p||typeof p!=='object'||Array.isArray(p)
    ||Object.keys(p).length!==keys.length
    ||Object.keys(p).some(k=>!keys.includes(k))
    ||p.id!==source.id||p.stream!==source.stream
    ||p.capturedOn!==exactCaptureOn(source.timestamp)
    ||typeof p.originalSha256!=='string'||!(/^[a-f0-9]{64}$/.test(p.originalSha256))
    ||typeof p.cdxSha1Base32!=='string'||!DIGEST.test(p.cdxSha1Base32)
    ||!Number.isInteger(p.originalBytes)||Number(p.originalBytes)<500
    ||Number(p.originalBytes)>PINNED_V4_RAW_BYTES
    ||['rows2021','rows2022','distinctRowKeys','duplicateRowKeys','safeRedirectHops']
     .some(k=>!Number.isInteger(p[k])||Number(p[k])<0||Number(p[k])>2000000)
    ||Number(p.rows2021)+Number(p.rows2022)
       !==Number(p.distinctRowKeys)+Number(p.duplicateRowKeys)
    ||Number(p.distinctRowKeys)<1||Number(p.safeRedirectHops)>PINNED_V4_MAX_REDIRECTS)
    throw Error('Invalid public proof body');
  }
 }
 return value as PinnedReceipt;
}
export async function collectPinnedCfbOriginals(
 fetchImpl:typeof fetch=fetch,
 onAuthenticated?:(source:AuthenticatedPinnedRows)=>Promise<void>,
):Promise<PinnedReceipt>{
 const results:PinnedResult[]=[];
 for(const source of PINNED_CFB_ORIGINALS){
  const tested=await authenticatePinnedCfbOriginal(source,fetchImpl);
  results.push(tested.result);
  if(tested.authenticated&&onAuthenticated)
   await onAuthenticated(tested.authenticated);
 }
 return validatePinnedV4Receipt({
  schema:PINNED_V4_SCHEMA,issue:864,sourceOnlyNoNeon:true,
  independentlyMatchedRawCdxSha1OnlyWhenVerified:true,
  noPrivateDonorsAmountsOrRowKeysExported:true,
  noOriginalBodiesUploadedOrLogged:true,firstPublicDateEstablished:false,
  privateStoredParityEstablished:false,reportFilingDutyDenominatorEstablished:false,
  results,
 });
}
