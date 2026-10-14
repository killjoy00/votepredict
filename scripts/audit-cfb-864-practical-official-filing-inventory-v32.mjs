/**
 * #864: Official CFB indexed filing is useful public evidence even when
 * a government PDF is scanned, its text date looks wrong, or the candidate
 * is listed as William/Bill, James/Jim, Matthew/Matt, Gregory/Greg, Jeff/Jeffrey.
 * Keep specific contents and before-vote availability claims separate.
 * This is entirely offline and makes no database or prediction changes.
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {audit435FullOriginalReportSources} from './audit-cfb-864-435-exact-reports-86-senators-v28.mjs';

export const SCHEMA='cfb-864-practical-source-recognition-445-version-95-senators-v32';
const D='docs/evaluation/source-proof/';
const FILES={
 old:D+'cfb-2021-25-86-serving-senators-435-exact-original-amended-report-versions-v28.psv',
 added:D+'cfb-2021-22-five-senator-name-variants-ten-official-yearend-originals-v32.psv',
 accepted:D+'cfb-2021-25-95-senators-445-official-filing-version-inventory-v32.psv',
 principals:D+'cfb-2021-25-95-serving-senators-86-authentic-90-viewer-principals-v28.psv',
 json:'data/cfb-senate-official-filings-2021-25-v32.json'
};
const SHA=/^[a-f0-9]{64}$/,PDF='https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&';
const sha1=s=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex');
const PIN={
 added:'ab3a825008e611885b5819e442c1d8f0697f4c8f',
 accepted:'8b944ed4e0ca2bf40eb4367eba0741f0abec4e36',
 json:'14d6abac4be9657c101a6c0ee451d5ae233b5620'
};
function readPsv(k,n,c){
 const source=readFileSync(FILES[k],'utf8');
 if(!source.endsWith('\n')||source.includes('\r')||(PIN[k]&&sha1(source)!==PIN[k]))
  throw Error('Official CFB source ledger changed bytes or newlines: '+k);
 const rows=source.trimEnd().split('\n').map(x=>x.split('|'));
 if(rows.length!==n||rows.some(x=>x.length!==c||x.some(y=>y==='')))
  throw Error('Official CFB source ledger lost or added references: '+k);
 return rows;
}
const STATUS=Object.freeze({
 authenticated_original_pdf:'readable_official_pdf',
 authenticated_amendment_pdf:'readable_official_pdf',
 source_identity_hold:'downloaded_pdf_details_unreadable_or_unresolved',
 source_fetch_hold:'official_filing_indexed_pdf_fetch_failed',
 exact_pdf_alias:'indexed_alias_of_same_pdf'
});
export function auditPracticalCFBSourceAcceptance(){
 const prior=audit435FullOriginalReportSources();
 if(prior.sourceObservedOfficialExactReportVersions!==435||prior.sourceVerifiedOriginalPdfVersions!==416)
  throw Error('Original source proof drift');
 const old=readPsv('old',435,22),aliases=readPsv('added',10,20),accepted=readPsv('accepted',445,19),people=readPsv('principals',95,17);
 const rawJson=readFileSync(FILES.json,'utf8');
 if(sha1(rawJson)!==PIN.json)throw Error('Source JSON byte drift');
 const root=JSON.parse(rawJson);
 if(root.schemaVersion!=='cfb-senate-95-serving-senators-445-official-indexed-filings-practical-source-v32'
  ||root.senators?.length!==95||root.sourceVerifiedCounts?.total!==445)
  throw Error('CFB public source JSON schema mismatch');
 const byReg=new Map(people.map(x=>[x[4],x]));
 const byPerson=new Map(people.map(x=>[x[0],x]));
 const indexed=new Map(accepted.map(x=>[x[0],x]));
 if(byReg.size!==95||byPerson.size!==95||indexed.size!==445)
  throw Error('Duplicate official senator, committee or report identity');
 const yrs={},pdfShas=new Set();
 const check=(reg,person,id,year,period,se,am,kind,status,nameLink,sha,bytes,viewer,received,url)=>{
  const p=byReg.get(reg),row=indexed.get(id);
  if(!p||p[0]!==person||!row||row[1]!==person||row[2]!==year||row[3]!==reg
    ||row[4]!==period||row[5]!==am||row[6]!==kind||row[7]!==status
    ||row[8]!==nameLink||row[9]!==url||row[10]!==sha||row[11]!==bytes
    ||row[12]!==viewer||row[13]!==received||row[18]!=='UNKNOWN'
    ||!url.startsWith(PDF)||!SHA.test(viewer))
   throw Error('Original CFB indexed filing version absent or not truthfully attributed: '+id);
  const api=PDF+'downloadpdf=false&year='+year.slice(2)+'&type=pcc&period='+period+'&se='+se+'&regnum='+reg+'&amend='+am;
  if(url!==api||id!==reg+':'+year.slice(2)+':pcc:'+period+':'+se+':'+am)
   throw Error('Wrong exact government PDF viewer path/version '+id);
  if(sha==='-'){
   if(bytes!=='-'||status!=='official_filing_indexed_pdf_fetch_failed')
    throw Error('No original PDF bytes should never be called source retrieved');
  } else {
   if(!SHA.test(sha)||!Number.isSafeInteger(Number(bytes))||Number(bytes)<1000)
    throw Error('Invalid complete government source PDF byte hash');
   pdfShas.add(sha);
  }
  yrs[year]=(yrs[year]??0)+1;
 };
 for(const x of old){
  const[id,year,name,,reg,period,se,am,kind,status,sha,bytes,,,received,,,viewer,,,url]=x;
  if(!Object.hasOwn(STATUS,status))throw Error('Original official CFB filing category removed');
  check(reg,name,id,year,period,se,am,kind,STATUS[status],
   'official_candidate_full_name',sha,bytes,viewer,received,url);
 }
 const singleRead=[];
 for(const x of aliases){
  const[id,name,reg,year,candidateName,candidateDistrict,registrySha,viewer,sha,bytes,
   start,end,received,body,repeat,url,first,second,note,pub]=x;
  const p=byReg.get(reg),expected=body==='report_indexed_with_date_conflict'
   ?'downloaded_pdf_report_date_conflict':'readable_official_pdf';
  if(!p||p[5]!=='ALIAS_HOLD'||!candidateName||!Number(candidateDistrict)
   ||!SHA.test(registrySha)||!SHA.test(viewer)||!SHA.test(sha)
   ||!['official_pdf_form_fields_readable','report_indexed_with_date_conflict'].includes(body)
   ||!['independent_second_read_same_sha','first_official_download_second_retrieval_failed'].includes(repeat)
   ||first!=='115668421613'||second!=='115669135235'||pub!=='-')
   throw Error('Unproven CFB Senate first-name variant original report');
  check(reg,name,id,year,'YE','0','0','original',expected,
   'official_candidate_documented_name_variant',sha,bytes,viewer,received,url);
  const row=indexed.get(id);
  if(row[14]!==start||row[15]!==end||row[16]!==body)
   throw Error('Government source PDF form fields silently changed');
  if(repeat==='first_official_download_second_retrieval_failed')singleRead.push(id);
 }
 if(singleRead.length!==2||pdfShas.size!==440)
  throw Error('Public PDF content hashes incomplete or second-fetch artificially required');
 const observed=new Set(),docs=[];
 for(const s of root.senators){
  const p=byPerson.get(s.name),rr=accepted.filter(x=>x[3]===s.registrationNumber);
  if(!p||p[4]!==s.registrationNumber||s.observedVersions<1
   ||s.observedVersions!==s.filings.length||rr.length!==s.observedVersions
   ||s.downloadedVersions!==rr.filter(x=>x[10]!=='-').length
   ||s.originalVersions!==rr.filter(x=>x[6]==='original').length
   ||s.amendedVersions!==rr.filter(x=>x[6]==='amended').length
   ||s.officialNameLink!==(p[5]==='ALIAS_HOLD'?'documented_official_name_variant':'direct_official_registration'))
   throw Error('Candidate record excluded from current senator profile by name or scan');
  const segment=2*Math.ceil(Math.max(...rr.map(x=>Number(x[2])))/2);
  if(s.viewerUrl!=='https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/'+p[4]+'/'+segment+'/')
   throw Error('CFB original candidate segment URL not pinned');
  for(const f of s.filings){
   const x=indexed.get(f.id);
   if(!x||f.url!==x[9]||f.status!==x[7]||f.kind!==x[6]
     ||f.year!==Number(x[2])||f.amendment!==Number(x[5])||observed.has(f.id))
    throw Error('Source report missing/mismatched original public version in profile');
   observed.add(f.id);docs.push(f);
  }
 }
 const statuses=Object.fromEntries([
  'readable_official_pdf','downloaded_pdf_details_unreadable_or_unresolved',
  'downloaded_pdf_report_date_conflict','official_filing_indexed_pdf_fetch_failed',
  'indexed_alias_of_same_pdf'].map(status=>[status,accepted.filter(x=>x[7]===status).length]));
 if(observed.size!==445||accepted.filter(x=>x[10]!=='-').length!==444
  ||statuses.readable_official_pdf!==425
  ||statuses.downloaded_pdf_details_unreadable_or_unresolved!==14
  ||statuses.downloaded_pdf_report_date_conflict!==1
  ||statuses.official_filing_indexed_pdf_fetch_failed!==1
  ||statuses.indexed_alias_of_same_pdf!==4
  ||root.sourceVerifiedCounts.distinctSha!==440||root.sourceVerifiedCounts.original!==274
  ||root.sourceVerifiedCounts.amended!==171||root.sourceVerifiedCounts.senatorsCovered!==95
  ||JSON.stringify([2021,2022,2023,2024,2025].map(y=>yrs[y]))!==JSON.stringify([103,207,54,60,21])))
  throw Error('Government indexed reports missing from practical acceptance');
 return{
  schema:SCHEMA,indexedOfficialReportVersions:445,originalVersionRefs:274,amendedVersionRefs:171,
  allActualServing2021to25SenatorsWithOfficialIndexedReportReferences:95,
  versionsWithDownloadedPDF:444,distinctDownloadedGovernmentPDFs:440,
  sourceReadableFormVersions:425,downloadedPDFsNeedingFormReviewRetained:14,
  indexedReportWithDateAnomalyRetained:1,
  officialIndexedPDFTemporarilyUnavailableRetained:1,samePDFRepeatedIndexReferences:4,
  documentedGovernmentNameVariantSenatorsIncluded:5,
  independentSecondPDFDownloadNotRequiredForInclusion:2,
  everyPrevious435IndexedReferenceRetained:true,
  historicallyContemporaneousPublicationNotAssumed:true,
  historicalPredictionFeatureAndProductionDBUnchanged:true,
  byYear:[2021,2022,2023,2024,2025].map(year=>({year,count:yrs[year]}))
 };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2)throw Error('No private DB or source mutation input accepted');
 console.log('CFB_864_PRACTICAL_445_OFFICIAL_V32 '+JSON.stringify(auditPracticalCFBSourceAcceptance()));
}
