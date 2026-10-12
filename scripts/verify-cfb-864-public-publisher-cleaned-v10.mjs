/**
 * #864 Track B V10: PUBLIC-ONLY independent publisher snapshot corroboration.
 *
 * The Accountability Project's February 2023 notebook documented a *cleaned*
 * derivative of CFB data, NOT an immutable June 2022 official original.
 * Fetch only its fixed documented S3 object in ephemeral CI memory; count
 * coverage and compute whole-body SHA256, never emit donor/transaction rows.
 * Historical first-publication and private stored-row equality remain UNKNOWN.
 */
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

export const CFB_864_TAP_V10_MARKER=
 'SENATE_864_CFB_INDEPENDENT_CLEANED_PUBLISHER_V10_20261012';
export const CFB_864_TAP_V10_SCHEMA=
 'cfb-864-publisher-cleaned-csv-independent-corroboration-v10';
export const TAP_PUBLIC_CONTRIBUTIONS=Object.freeze({
 objectId:'tap_cleaned_mn_contributions_2023',
 url:'https://publicaccountability.s3.amazonaws.com/csv/mn_contribs_clean.csv',
 expectedV7HeadBytes:58871220,
 publisherNotebookRows:359673,
 documentedNotebookDate:'2023-02-27',
});
const MAX_BODY_BYTES=85000000,MAX_ROWS=500000,MAX_COLUMNS=64;
const HEADER_REQUIRED=Object.freeze([
 'recipient_reg_num','recipient','recipient_type','amount','date','year',
 'contributor','contrib_reg_num','contrib_type','receipt_type','in_kind',
]);
const yearRange=Array.from({length:9},(_,i)=>String(2015+i));
function sameResponseUrl(r,requested){
 if(r.url&&r.url!==requested)
  throw Error('Unexpected public publisher redirect');
 if(r.status>=300&&r.status<400)
  throw Error('Publisher redirected');
}
function publicDateHeader(value){
 if(!value)return null;
 const time=Date.parse(value);
 if(!Number.isFinite(time))return null;
 const day=new Date(time).toISOString().slice(0,10);
 return day>='2020-01-01'&&day<='2026-12-31'?day:null;
}
/** Parser never materializes unneeded donor/recipient/vendor names.
 * Only the header and two non-identity fields (year, filer type) are read
 * after validating CSV quoting and each row's exact column count.
 */
export function countPublicCleanedCfbRows(bytes){
 const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 let header=null,selected=null,inQuotes=false,fieldIndex=0;
 let field='',fieldLength=0,rowActive=false,rows=0,otherYearCount=0;
 let rowYear='',rowType='',yearColumns=null,typeColumns=null;
 const years=Object.fromEntries(yearRange.map(y=>[y,0]));
 const pccYears={'2021':0,'2022':0};
 let headerFields=[];
 function readSelected(){return header===null||fieldIndex===yearColumns||fieldIndex===typeColumns}
 function add(char){
  fieldLength+=char.length;
  if(fieldLength>10000)throw Error('Overlong CSV field (including unselected donor columns)');
  if(readSelected()){
   field+=char;
   if(field.length>10000)throw Error('Unbounded selected CSV field');
  }
 }
 function finishField(){
  if(fieldIndex>=MAX_COLUMNS)throw Error('Oversized candidate CSV column count');
  if(header===null)headerFields.push(field.replace(/\r$/,'').trim());
  else if(fieldIndex===yearColumns)rowYear=field.trim();
  else if(fieldIndex===typeColumns)rowType=field.trim();
  field='';fieldLength=0;fieldIndex++;
 }
 function finishRow(){
  if(header===null){
   header=headerFields;
   if(header.length<HEADER_REQUIRED.length||header.length>MAX_COLUMNS
    ||new Set(header).size!==header.length
    ||HEADER_REQUIRED.some(key=>!header.includes(key)))
    throw Error('Untrusted publisher CSV header schema');
   yearColumns=header.indexOf('year');
   typeColumns=header.indexOf('recipient_type');
  }else{
   if(fieldIndex!==header.length)throw Error('Inconsistent publisher CSV columns');
   rows++;
   if(rows>MAX_ROWS)throw Error('Oversized publisher row count');
   if(Object.hasOwn(years,rowYear)){
    years[rowYear]++;
    if(rowType==='PCC'&&Object.hasOwn(pccYears,rowYear))pccYears[rowYear]++;
   }else otherYearCount++;
  }
  fieldIndex=0;field='';rowYear='';rowType='';
  rowActive=false;
 }
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  rowActive=true;
  if(inQuotes){
   if(ch==='"'){
    if(text[i+1]==='"'){add('"');i++}
    else inQuotes=false;
   }else add(ch);
   continue;
  }
  if(ch==='"'&&field===''){inQuotes=true;continue}
  if(ch==='"'&&field!=='')throw Error('Unexpected publisher CSV quote');
  if(ch===','){finishField();continue}
  if(ch==='\n'){finishField();finishRow();continue}
  add(ch);
 }
 if(inQuotes)throw Error('Incomplete quoted CSV field');
 if(rowActive){finishField();finishRow()}
 if(header===null||rows<1)throw Error('Empty publisher CSV dataset');
 return {
  schemaColumns:header.length,totalRows:rows,
  yearCounts2015to2023:years,
  otherOrMissingYearCount:otherYearCount,
  filerTypePcc2021:pccYears['2021'],
  filerTypePcc2022:pccYears['2022'],
  financeEntityClassNotSenateVerified:true,
 };
}
async function ephemeralBytes(response,max){
 const stated=response.headers.get('content-length');
 if(stated!==null){
  const n=Number(stated);
  if(!Number.isSafeInteger(n)||n<1||n>max)
   throw Error('Publisher response length cap');
 }
 if(!response.body)throw Error('No response body');
 const reader=response.body.getReader(),parts=[];let size=0;
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(done)break;
   size+=value.byteLength;
   if(size>max)throw Error('Publisher response byte cap');
   parts.push(value);
  }
 }finally{await reader.cancel().catch(()=>undefined)}
 const out=Buffer.alloc(size);let at=0;
 for(const p of parts){Buffer.from(p).copy(out,at);at+=p.byteLength}
 return out;
}
export async function auditTapCleanedContributionBodyV10(fetchPublic=fetch){
 const src=TAP_PUBLIC_CONTRIBUTIONS;
 const result={
  publisherObjectId:src.objectId,
  status:'head_network_or_identity_hold',
  headHttpStatus:null,getHttpStatus:null,
  observedHeadBytes:null,observedGetBytes:null,
  objectHttpLastModifiedDay:null,
  entirePublisherCleanedBodySha256:null,
  coverageCounts:null,
  publisherPublishedRowsAgreement:null,
  priorV7HeadBytesAgreement:null,
 };
 let head;
 try{
  head=await fetchPublic(src.url,{method:'HEAD',redirect:'manual',
   signal:AbortSignal.timeout(18000)});
  sameResponseUrl(head,src.url);
  result.headHttpStatus=head.status;
  if(!head.ok){result.status='head_http_hold';return result}
  const length=Number(head.headers.get('content-length'));
  if(!Number.isSafeInteger(length)||length<5000000||length>MAX_BODY_BYTES){
   result.status='head_length_invalid_hold';return result;
  }
  result.observedHeadBytes=length;
  result.priorV7HeadBytesAgreement=length===src.expectedV7HeadBytes;
  result.objectHttpLastModifiedDay=publicDateHeader(
   head.headers.get('last-modified'));
  if(!result.priorV7HeadBytesAgreement){
   result.status='publisher_object_size_changed_hold';return result;
  }
 }catch{result.status='head_network_or_identity_hold';return result}
 let bytes;
 try{
  const reply=await fetchPublic(src.url,{
   method:'GET',redirect:'manual',
   headers:{'accept-encoding':'identity','user-agent':'VotePredict/2.0 public cleaned source provenance'},
   signal:AbortSignal.timeout(100000),
  });
  sameResponseUrl(reply,src.url);
  result.getHttpStatus=reply.status;
  if(!reply.ok){result.status='body_http_hold';return result}
  const encoding=reply.headers.get('content-encoding');
  if(encoding&&encoding.trim().toLowerCase()!=='identity'){
   result.status='body_content_encoding_hold';return result;
  }
  bytes=await ephemeralBytes(reply,MAX_BODY_BYTES);
  result.observedGetBytes=bytes.length;
  if(bytes.length!==src.expectedV7HeadBytes){
   result.status='body_head_size_mismatch_hold';return result;
  }
 }catch{result.status='body_network_or_integrity_hold';return result}
 try{
  const coverage=countPublicCleanedCfbRows(bytes);
  const hash=createHash('sha256').update(bytes).digest('hex');
  result.entirePublisherCleanedBodySha256=hash;
  result.coverageCounts=coverage;
  result.publisherPublishedRowsAgreement=
   coverage.totalRows===src.publisherNotebookRows;
  result.status=result.publisherPublishedRowsAgreement
   ?'cleaned_publisher_body_sha256_and_counts_verified'
   :'cleaned_publisher_body_count_disagreement_hold';
 }catch{result.status='body_csv_validation_hold'}
 return result;
}
export async function reportIndependentPublisherV10(fetchPublic=fetch){
 return{
  schema:CFB_864_TAP_V10_SCHEMA,issue:864,
  sourceKind:'independent_2023_CFB_derived_cleaned_dataset',
  publisherNotebookDate:'2023-02-27',
  publisherNotebookDateNotSnapshotPublicByProof:true,
  currentlyReturnedS3ObjectNotVerifiedHistoricalJuneVersion:true,
  s3LastModifiedDateNotAffirmativePublicBy:true,
  normalizedCleanedRowsNotOriginalCanonicalCsvKeys:true,
  noSourceSpecificJuneOriginalIdentityProven:true,
  sourceRowsAreAllFilerTypesNotOfficialSenateDenominator:true,
  priorV4OriginalProofUnchanged:true,
  productionEligibilityUnmodified:true,zeroDatabaseWrites:true,
  noDonorsRecipientsAmountsOrTransactionKeysLogged:true,
  sourceBodiesNeverUploaded:true,
  publisher:await auditTapCleanedContributionBodyV10(fetchPublic),
 };
}
async function main(){
 if(process.argv.length!==2)throw Error('No public source CLI options');
 const receipt=await reportIndependentPublisherV10();
 const safe=JSON.stringify(receipt);
 if(safe.length>6000||/https?:\/\/|publicaccountability\.s3|cfb\.mn\.gov|[^\w]"rowKey"\s*:|recipient_reg_num|donorName|contributorName/i.test(safe))
  throw Error('Untrusted publisher output');
 console.log('CFB_864_TAP_V10_CLEANED_BODY_ONLY '+safe);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
 await main();
