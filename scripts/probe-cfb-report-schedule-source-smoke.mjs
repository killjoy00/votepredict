/** Public no-secret source smoke test. Only emits aggregate counts; never donor text. */
import {createHash} from 'node:crypto';
import {registry830} from '../src/evidence/cfb-864-pdf-registry-eligibility-v48.mjs';
import {fetchVerifiedReportPdf,parseVerifiedPdfPages,extractScheduleEntries}
 from '../src/evidence/cfb-report-schedule-raw.mjs';

async function main(){
 const records=registry830().filter(r=>r.year===2025)
  .sort((a,b)=>b.id.localeCompare(a.id));
 const seen=new Set(),selected=[];
 for(const r of records){
  if(seen.has(r.sha))continue;
  seen.add(r.sha);selected.push(r);
  if(selected.length===2)break;
 }
 if(selected.length!==2)throw Error('2025 official source PDF sample not available');
 let verified=0,extracted=0,rawLines=0,parseFailures=0;
 for(const record of selected){
  try{
   const binary=await fetchVerifiedReportPdf(record);
   verified++;
   const pages=await parseVerifiedPdfPages(binary.bytes);
   // Regression: PDF.js workers must not detach/mutate the caller's exact
   // SHA-pinned source body before it is reused by the production collector.
   if(binary.bytes.length!==record.bytes ||
     createHash('sha256').update(binary.bytes).digest('hex')!==record.sha)
    throw Error('Parser mutated or detached original verified PDF bytes');
   extracted++;
   rawLines+=extractScheduleEntries(pages,2025).length;
  }catch{
   parseFailures++;
  }
 }
 console.log('CFB_864_OFFICIAL_PDF_SOURCE_SMOKE_SAFE_COUNTS '+
  JSON.stringify({sampledVersions:selected.length,shaVerified:verified,
   textExtracted:extracted,entryLinesDetected:rawLines,failed:parseFailures}));
 if(verified!==2||extracted!==2)process.exitCode=1;
}
main().catch(()=>{
 console.error('CFB_864_OFFICIAL_PDF_SOURCE_SMOKE_HELD');
 process.exitCode=1;
});
