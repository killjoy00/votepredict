/**
 * #864 Track B: public-only alternate archive lead discovery for three pinned
 * 2021-22 Minnesota CFB candidate finance versions.
 *
 * No database, credentials, raw finance CSV, WARC downloads, donors, vendors,
 * amounts, transaction row keys, original bodies or artifacts. Every endpoint
 * is fixed, bounded and HTTPS; no redirects followed. Index hits are LEADS,
 * not authenticated originals, private stored matches, or first publication.
 */
import {pathToFileURL} from 'node:url';

export const CFB_864_ALT_V7_SCHEMA = 'cfb-864-candidate-alt-archive-public-index-v7';
export const CFB_864_ALT_V7_MARKER =
 'SENATE_864_CFB_PUBLIC_ALT_ARCHIVE_DISCOVERY_V7_20261012';
export const CFB_864_ALT_SOURCES = Object.freeze([
 {id:'candidate_contributions', selector:'-2113865252',
  official:'https://cfb.mn.gov/reports-and-data/self-help/data-downloads/campaign-finance/?download=-2113865252'},
 {id:'candidate_expenditures', selector:'-1890073264',
  official:'https://cfb.mn.gov/reports-and-data/self-help/data-downloads/campaign-finance/?download=-1890073264'},
]);
/** Finite sample of independently published CC index collection IDs, NOT
 * comprehensive archival coverage. Includes collections straddling June 2022
 * and the February/June 2023 independent publisher collection window.
 */
export const CFB_864_CC_INDEXES = Object.freeze([
 'CC-MAIN-2022-21','CC-MAIN-2022-27','CC-MAIN-2022-33',
 'CC-MAIN-2022-49','CC-MAIN-2023-06','CC-MAIN-2023-23',
]);
export const CFB_864_TAP_CLEANED_OBJECTS = Object.freeze([
 {id:'tap_contributions_2023_cleaned',url:
  'https://publicaccountability.s3.amazonaws.com/csv/mn_contribs_clean.csv'},
 {id:'tap_expenditures_2023_cleaned',url:
  'https://publicaccountability.s3.amazonaws.com/csv/mn_expends_20150101-20221231.csv'},
]);
const MAX_INDEX_BODY_BYTES=64000, MAX_RESULTS_PER_INDEX=10;
const INDEX_TIMEOUT_MS=9000;
const B32=/^[A-Z2-7]{32}$/;
const TIMESTAMP=/^202[1-3](?:0[1-9]|1[0-2])(?:0[1-9]|[12][0-9]|3[01])(?:[01]\d|2[0-3])[0-5]\d[0-5]\d$/;

function officialIdentity(raw){
 const u=new URL(raw);
 if(!['https:','http:'].includes(u.protocol)
  ||u.hostname!=='cfb.mn.gov'||u.port||u.username||u.password
  ||u.pathname!=='/reports-and-data/self-help/data-downloads/campaign-finance/'
  ||u.searchParams.size!==1 ||!u.searchParams.has('download'))
  throw Error('Untrusted indexed original identity');
 const selector=u.searchParams.get('download');
 if(!CFB_864_ALT_SOURCES.some(s=>s.selector===selector))
  throw Error('Unapproved indexed original selector');
 return selector;
}
function safeFetchResponse(r,url){
 if(r.url && r.url!==url)throw Error('Public index redirected');
 if(r.status>=300&&r.status<400)throw Error('Public index redirect forbidden');
}
async function boundedMetadataText(response){
 const sizeHeader=response.headers.get('content-length');
 if(sizeHeader!==null){
  const n=Number(sizeHeader);
  if(!Number.isSafeInteger(n)||n<0||n>MAX_INDEX_BODY_BYTES)
   throw Error('Oversized public index');
 }
 if(!response.body)throw Error('Missing public index response');
 const reader=response.body.getReader();const parts=[];let length=0;
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(done)break;
   length+=value.byteLength;
   if(length>MAX_INDEX_BODY_BYTES)throw Error('Oversized public index');
   parts.push(value);
  }
 }finally{await reader.cancel().catch(()=>undefined)}
 const buffer=new Uint8Array(length);let at=0;
 for(const part of parts){buffer.set(part,at);at+=part.byteLength}
 return new TextDecoder('utf-8',{fatal:true}).decode(buffer);
}
function csvLikeMime(mime){
 return /^(?:text\/(?:csv|plain)|application\/(?:csv|octet-stream|vnd\.ms-excel)|unknown|unk)(?:;.*)?$/i.test(mime);
}
function validWarcPointer(record,index){
 const offset=Number(record.offset),length=Number(record.length);
 return typeof record.filename==='string'
  &&record.filename.startsWith('crawl-data/'+index+'/segments/')
  &&/\/warc\/[A-Za-z0-9_.-]+\.warc\.gz$/.test(record.filename)
  &&Number.isSafeInteger(offset)&&offset>=0
  &&Number.isSafeInteger(length)&&length>0&&length<=120000000
  &&Number.isSafeInteger(offset+length);
}
/** Consume only bounded CC metadata, never referenced transaction bodies.
 * A positive result is a WARC retrieval lead, never original-byte proof.
 */
export function parseCfbCommonCrawlIndex(raw,selector,index){
 if(!CFB_864_CC_INDEXES.includes(index)
  ||!CFB_864_ALT_SOURCES.some(s=>s.selector===selector))
  throw Error('Unapproved candidate source or CC collection');
 const lines=raw.trim()===''?[]:raw.trim().split(/\r?\n/);
 if(lines.length>MAX_RESULTS_PER_INDEX)
  throw Error('Too many returned CC metadata records');
 let csvLike200=0, retrievableWarcRecords=0;
 const hashes=new Set();let earliestCaptureDay=null;
 for(const line of lines){
  const r=JSON.parse(line);
  if(!r||typeof r!=='object'||Array.isArray(r)
   ||typeof r.url!=='string'||officialIdentity(r.url)!==selector
   ||typeof r.timestamp!=='string'||!TIMESTAMP.test(r.timestamp)
   ||typeof r.status!=='string'||typeof r.mime!=='string'
   ||typeof r.digest!=='string'||!B32.test(r.digest))
   throw Error('Invalid or wrong-source CC index metadata');
  if(r.status!=='200'||!csvLikeMime(r.mime))continue;
  csvLike200++;
  const day=r.timestamp.slice(0,4)+'-'+r.timestamp.slice(4,6)
   +'-'+r.timestamp.slice(6,8);
  if(earliestCaptureDay===null||day<earliestCaptureDay)
   earliestCaptureDay=day;
  if(validWarcPointer(r,index)){
   retrievableWarcRecords++;
   hashes.add(r.digest);
  }
 }
 return {
  index,recordCount:lines.length,csvLike200,retrievableWarcRecords,
  earliestCaptureDay,warcLeadSha1Base32:[...hashes].sort(),
 };
}
function archiveIndexUrl(source,index){
 const params=new URLSearchParams({
  url:source.official,output:'json',limit:String(MAX_RESULTS_PER_INDEX),
  filter:'status:200',
 });
 return 'https://index.commoncrawl.org/'+index+'-index?'+params.toString();
}
export async function probeCfbAltArchivesV7(fetchPublic=fetch){
 const commonCrawl=[];
 for(const source of CFB_864_ALT_SOURCES){
  for(const index of CFB_864_CC_INDEXES){
   const row={sourceId:source.id,index,status:'index_network_hold',
    recordCount:0,csvLike200:0,retrievableWarcRecords:0,
    earliestCaptureDay:null,warcLeadSha1Base32:[]};
   const url=archiveIndexUrl(source,index);
   try{
    const response=await fetchPublic(url,{
     method:'GET',redirect:'manual',headers:{accept:'application/json',
      'user-agent':'VotePredict/2.0 public-only CFB archive metadata discovery'},
     signal:AbortSignal.timeout(INDEX_TIMEOUT_MS),
    });
    safeFetchResponse(response,url);
    if(response.status===404){row.status='index_404_no_match_for_this_query';}
    else if(!response.ok){row.status='index_http_hold';}
    else{
     const parsed=parseCfbCommonCrawlIndex(
      await boundedMetadataText(response),source.selector,index);
     Object.assign(row,parsed);
     row.status=parsed.retrievableWarcRecords>0
      ?'indexed_csv_warc_lead_only'
      :parsed.csvLike200>0?'indexed_csv_without_valid_warc_lead'
      :'index_no_csv_warc_lead_for_this_query';
    }
   }catch{row.status='index_invalid_or_network_hold'}
   commonCrawl.push(row);
  }
 }
 const arquivo=[];
 for(const source of CFB_864_ALT_SOURCES){
  const row={sourceId:source.id,status:'timemap_network_hold'};
  // A positive metadata response remains an unreviewed discovery lead.
  const url='https://arquivo.pt/wayback/timemap/json/'+source.official;
  try{
   const response=await fetchPublic(url,{
    method:'GET',redirect:'manual',headers:{accept:'application/json',
     'user-agent':'VotePredict/2.0 public-only CFB archive metadata discovery'},
    signal:AbortSignal.timeout(INDEX_TIMEOUT_MS),
   });
   safeFetchResponse(response,url);
   if(response.status===404)row.status='timemap_404_no_match_for_this_query';
   else if(!response.ok)row.status='timemap_http_hold';
   else{
    const body=await boundedMetadataText(response);
    row.status=body.trim()?
     'timemap_response_nonempty_unverified':'timemap_response_empty';
   }
  }catch{row.status='timemap_invalid_or_network_hold'}
  arquivo.push(row);
 }
 const publisherHeads=[];
 for(const object of CFB_864_TAP_CLEANED_OBJECTS){
  const row={objectId:object.id,status:'head_network_hold',contentLength:null};
  try{
   const response=await fetchPublic(object.url,{
    method:'HEAD',redirect:'manual',
    headers:{'user-agent':'VotePredict/2.0 public-only cleaned CSV HEAD'},
    signal:AbortSignal.timeout(INDEX_TIMEOUT_MS),
   });
   safeFetchResponse(response,object.url);
   if(response.status===404)row.status='head_404_this_endpoint_only';
   else if(!response.ok)row.status='head_http_hold';
   else{
    row.status='head_200_cleaned_public_object_only';
    const length=Number(response.headers.get('content-length'));
    if(Number.isSafeInteger(length)&&length>=0)
     row.contentLength=length;
   }
  }catch{row.status='head_invalid_or_network_hold'}
  publisherHeads.push(row);
 }
 return {
  schema:CFB_864_ALT_V7_SCHEMA,issue:864,
  fixedOriginalSelectorCount:CFB_864_ALT_SOURCES.length,
  commonCrawlIndexCount:CFB_864_CC_INDEXES.length,
  sourceCaptureVersionsPreviouslyPinned:3,
  publicOnlyNoNeonOrPrivateDatabase:true,
  rawOriginalsOrWarcBodiesFetched:false,
  originalBytesAuthenticated:false,
  privateStoredTransactionsCompared:false,
  earliestOriginalPublicationKnown:false,
  commonCrawlLookupsNotExhaustive:true,
  thirdPartyCleanedDatasetCannotBackdatePublication:true,
  noDonorVendorAmountRowKeyOrRawUrlExport:true,
  commonCrawl,arquivo,publisherHeads,
 };
}
async function main(){
 if(process.argv.length!==2)throw Error('Public probe has no flags');
 const receipt=await probeCfbAltArchivesV7();
 const safe=JSON.stringify(receipt);
 if(safe.length>16000||safe.includes('cfb.mn.gov')
  ||safe.includes('publicaccountability.s3.amazonaws.com')
  ||safe.includes('crawl-data/'))
  throw Error('Unsafe metadata receipt');
 console.log('CFB_864_ALT_ARCHIVES_V7_PUBLIC_LEADS_ONLY '+safe);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
 await main();
