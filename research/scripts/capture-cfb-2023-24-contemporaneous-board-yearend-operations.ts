/**
 * #864 public original Board Executive Director contemporaneous year-end
 * filing-population memos; PDF source SHA and memo's bounded statistical
 * conclusions only. Never stores raw PDFs, text, treasury, personal emails.
 *
 * node --import tsx scripts/capture-cfb-2023-24-contemporaneous-board-yearend-operations.ts
 * --output artifacts/cfb-2023-24-original-board-yearend-counts.json
 */
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve,sep} from 'node:path';
import {
  BOARD_2023_24_CFB_YE_OPERATIONS_VERSION,
  BOARD_YE_OPERATIONS_ORIGINAL_SOURCES,
  inspectCfbBoardContemporaryYearEndMemo,
  type AuditYear,
} from '../evidence/cfb-2023-24-board-contemporaneous-yearend-filing-counts.js';
function errorKind(e:unknown):string{
 const v=e instanceof Error?e.message:String(e);
 return /timeout|abort/i.test(v)?'official_board_original_pdf_timeout':
   /HTTP [45]\d\d/i.test(v)?'original_board_pdf_http_failure':
   /Board|memo|count|Operations/i.test(v)?'official_board_director_memo_content_mismatch':
   'official_original_board_pdf_source_failed';
}
async function original(year:AuditYear){
 const record=year===2023?BOARD_YE_OPERATIONS_ORIGINAL_SOURCES.report2023:
  BOARD_YE_OPERATIONS_ORIGINAL_SOURCES.report2024;
 const res=await fetch(record.sourceUrl,{
  headers:{'user-agent':'Mozilla/5.0 VotePredict original CFB Board meeting records research',
    accept:'application/pdf'},
  redirect:'follow',signal:AbortSignal.timeout(65_000),
 });
 if(!res.ok)throw Error('Original Board meeting materials HTTP '+res.status);
 const url=new URL(res.url);
 if(url.protocol!=='https:'||!['cfb.mn.gov','www.cfb.mn.gov'].includes(url.hostname))
  throw Error('Original Board materials redirected outside cfb.mn.gov');
 const pdf=new Uint8Array(await res.arrayBuffer());
 const bytes=pdf.byteLength;
 if(bytes<15000||bytes>12_000_000
  ||new TextDecoder('ascii').decode(pdf.subarray(0,5))!=='%PDF-')
  throw Error('Official Board original materials were not bounded PDF');
 const sha=createHash('sha256').update(pdf).digest('hex');
 const {PDFParse}=await import('pdf-parse');
 const {CanvasFactory}=await import('pdf-parse/worker');
 const parse=new PDFParse({data:pdf,CanvasFactory});
 let body:string;
 try{body=(await parse.getText()).text??'';}
 finally{await parse.destroy();}
 if(body.length<3000)throw Error('Original Board materials PDF text extraction too short');
 const memo=inspectCfbBoardContemporaryYearEndMemo(year,body);
 return{
  sourcePdfUrl:record.sourceUrl,originalPDFSha256:sha,originalPDFBytes:bytes,
  sourceObservedAt:new Date().toISOString(),sourceOfficialHostVerified:true,
  sourceBoardMemo: memo,
 };
}
async function main(){
 const a=process.argv.slice(2);
 if(a.length!==2||a[0]!=='--output'||!a[1])
  throw Error('Only --output artifacts/<new>.json permitted');
 const out=resolve(a[1]);
 if(!out.startsWith(resolve('artifacts')+sep)||!out.endsWith('.json'))
  throw Error('Output only new metadata JSON under artifacts/');
 const originals=await Promise.all([original(2023),original(2024)]);
 const p={
  schemaVersion:BOARD_2023_24_CFB_YE_OPERATIONS_VERSION,
  issue:864,scope:'original public original CFB Board campaign finance director operations memos only',
  sourceRecords:originals,
  aggregateAccounting:{
    year2023ExpectedCombinedProgramYearEndReports:1299,
    year2023FinalActualLegallyOwedCount:null,
    year2023ReportsFiledByDeadline:null,
    year2024DueCombinedProgramYearEndReports:1320,
    year2024CombinedProgramFiledByDeadline:1212,
    year2024CombinedProgramStillOutstandingOnFeb5:64,
    thisScopeIncludesNonCandidatePoliticalPartyAndFundReports:true,
    theseAreNotMinnesotaSenatorsOnly:true,
    noCommitteeSpecificLegalDutyProven:true,
    senate22Original2023Or2024LegallyOwedYearEndReportCount:null,
    historicalActualPublicByVersionProvenCount:0,
    noFinanceReportIdentityOrPDFFromThisAggregate:true,
  },
  safeguards:{rawBoardPDFOrExtractedTextSaved:false,
   namesOfOtherPeopleOrContactsFromMeetingAttachmentsStored:false,
   noIndividualCampaignFinancialRowsSaved:true,
   noProductionReadWrite:true,noModelServingOrSchedulerChanges:true,
   noCandidateContactOr2027Scope:true,issue864MustRemainOpen:true},
 };
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(p,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({issue:864,originalBoardMemos:2,
  sourcePDFMetadata:originals.map(x=>({url:x.sourcePdfUrl,
    sha:x.originalPDFSha256,bytes:x.originalPDFBytes})),
  allProgramYear2023Expected:1299,allProgramYear2024Due:1320,
  allProgramYear2024FiledByDeadline:1212,
  allProgramYear2024StillOutstandingAtMemoDate:64,
  senateCohortLegallyOwedDenominator:null,
  perReportPublicByProven:0,output:out,productionWrites:0},null,2));
}
main().catch(e=>{console.error(errorKind(e));process.exitCode=1;});
