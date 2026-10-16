/**
 * #864 track 1. One PR-only read-only acquisition:
 * 12 source-pinned 2022 Senate candidate viewer tabs, 24 original-version
 * C/E report PDFs and 1 independent original official 2022 disclosure calendar.
 * Original report and calendar PDF bytes/text exist only in memory.
 *
 * node --import tsx scripts/capture-cfb-2022-senate-24-original-ce-pdf-proofs.ts \
 *   --output artifacts/cfb-2022-senate-24-original-ce-pdf-proofs.json
 */
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname,resolve,sep } from 'node:path';
import { fetchCfbCandidateHistoricalReportReferenceSnapshot }
  from '../../src/evidence/cfb-candidate-report-history.js';
import { fetchCfbReportViewerText } from '../../src/evidence/cfb-current-report-acquisition.js';
import {
  CFB_2022_SENATE_CE_PROOF_VERSION, CFB_2022_CE_INDEPENDENT_CALENDAR_URL,
  auditCfb2022OriginalCePdf, cfb2022OriginalCePdfTargets,
  diagnoseCfb2022CeCalendar, diagnoseCfb2022OriginalCeHeader,
  verifyCfb2022CeCalendar, type Cfb2022PdfProofCapture,
} from '../../src/evidence/cfb-2022-senate-original-ce-pdf-proof.js';
const ROOT='https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/';
const SOURCE_CHECKPOINT='docs/evaluation/source-proof/cfb-2021-24-senate-396-source-viewer-count-checkpoint.json';

function errorKind(e:unknown):string {
  if(!(e instanceof Error))return 'unknown_failure';
  if(/timeout|abort/i.test(e.message)) return 'timeout_or_abort';
  if(/HTTP [45]\d\d/i.test(e.message)) return 'source_http_error';
  if(/pdf|parse|text|reference/i.test(e.message)) return 'official_source_pdf_or_reference_error';
  if(/sha|identity|mismatch/i.test(e.message)) return 'source_identity_drift';
  return e.name.slice(0,60)||'unclassified_failure';
}

async function officialCalendar():Promise<Cfb2022PdfProofCapture> {
  const url=CFB_2022_CE_INDEPENDENT_CALENDAR_URL;
  const response=await fetch(url,{
    headers:{'user-agent':'VotePredict/2.0 source-only-2022-senate-calendar-authentication',accept:'application/pdf'},
    redirect:'follow',signal:AbortSignal.timeout(45_000),
  });
  const final=new URL(response.url);
  if(!response.ok || final.protocol!=='https:'
    || !['cfb.mn.gov','www.cfb.mn.gov'].includes(final.hostname)
    || final.pathname!==new URL(url).pathname) throw Error('Official immutable calendar source invalid');
  const declared=Number(response.headers.get('content-length'));
  if(declared>12_000_000) throw Error('2022 calendar length exceeds bound');
  const body=new Uint8Array(await response.arrayBuffer());
  if(body.length<500 || body.length>12_000_000
    || new TextDecoder('ascii').decode(body.subarray(0,5))!=='%PDF-') {
    throw Error('Original 2022 CFB calendar is not PDF');
  }
  // pdf-parse can transfer/detach the passed ArrayBuffer, so hash AND
  // snapshot byte length before passing PDF data into the worker.
  const bytes=body.byteLength;
  const sha256=createHash('sha256').update(body).digest('hex');
  const {CanvasFactory}=await import('pdf-parse/worker');
  const {PDFParse}=await import('pdf-parse');
  const parser=new PDFParse({data:body,CanvasFactory});
  try {
    const text=(await parser.getText()).text??'';
    if(text.length<100)throw Error('Calendar PDF extraction empty');
    return {sourceUrl:url,sha256,bytes,fetchedAt:new Date().toISOString(),text};
  }finally{await parser.destroy();}
}

async function main(){
  const args=process.argv.slice(2);
  if(args.length!==2 || args[0]!=='--output' || !args[1])throw Error('Use --output artifacts/<new_file>.json');
  const out=resolve(args[1]);
  if(!out.startsWith(resolve('artifacts')+sep) || !out.endsWith('.json'))throw Error('Artifact path invalid');
  const checkpoint=JSON.parse(readFileSync(SOURCE_CHECKPOINT,'utf8'));
  if(checkpoint?.scope?.originalCandidateReportsTabApiCalls!==396
    || checkpoint?.observations?.principalCampaignCommitteeOriginalVersionReferencesAmendmentZero!==941
    || checkpoint?.provenance?.officialSourceArtifactId!==11683227803) {
    throw Error('Original historical CFB report-reference source checkpoint unverified');
  }
  const targets=cfb2022OriginalCePdfTargets();
  if(targets.length!==24) throw Error('Exact 24 original C/E targets required');
  let calendar:Cfb2022PdfProofCapture|null=null;
  let calendarError:string|null=null;
  try{calendar=await officialCalendar();}catch(e){calendarError=errorKind(e);}
  const calendarVerified=verifyCfb2022CeCalendar(calendar);
  const registrations=[...new Set(targets.map(t=>t.reg))].sort();
  const candidateViewers:Array<{
    registrationNumber:string; priorOfficialApiSha256:string;
    currentOfficialApiSha256:string|null; sourcePdfVersionKeysMatched:number;
    sourceApiBodyUnchanged:boolean; errorKind:string|null;
  }>=[];
  const pdfs=new Map<string,Cfb2022PdfProofCapture>();
  const failed=new Map<string,string>();
  let next=0;
  async function worker(){
    while(next<registrations.length){
      const reg=registrations[next++]!;
      const matched=targets.filter(t=>t.reg===reg);
      try{
        const s=await fetchCfbCandidateHistoricalReportReferenceSnapshot(reg,2022);
        if(s.sourceUrl!==ROOT+reg+'/2022/' || s.registrationNumber!==reg
          || s.segmentEndYear!==2022
          || s.responseSha256!==matched[0]!.viewerSha){
          throw Error('Original CFB viewer API source identity or SHA changed');
        }
        const selected=matched.map(target=>{
          const refs=s.references.filter(r=>r.registrationNumber===target.reg && r.year==='22'
            && r.type==='pcc'&&r.period===target.period&&r.se==='0'&&r.amendment===0);
          if(refs.length!==1)throw Error('Expected original C/E viewer key missing or ambiguous');
          return {target,ref:refs[0]!};
        });
        candidateViewers.push({
          registrationNumber:reg,priorOfficialApiSha256:matched[0]!.viewerSha,
          currentOfficialApiSha256:s.responseSha256,sourcePdfVersionKeysMatched:selected.length,
          sourceApiBodyUnchanged:true,errorKind:null,
        });
        for(const {target,ref} of selected){
          try{
            const p=await fetchCfbReportViewerText(ref,{
              method:'POST',referer:s.sourceUrl,searchType:'Candidate',
            });
            pdfs.set(target.id,{
              sourceUrl:p.sourceUrl,sha256:p.contentSha256,bytes:p.bytes,
              fetchedAt:p.fetchedAt,text:p.text,
            });
          }catch(e){failed.set(target.id,errorKind(e));}
        }
      }catch(e){
        candidateViewers.push({
          registrationNumber:reg,priorOfficialApiSha256:matched[0]!.viewerSha,
          currentOfficialApiSha256:null,sourcePdfVersionKeysMatched:0,
          sourceApiBodyUnchanged:false,errorKind:errorKind(e),
        });
        for(const t of matched)failed.set(t.id,errorKind(e));
      }
      await new Promise(done=>setTimeout(done,120));
    }
  }
  await Promise.all([worker(),worker()]);
  const reports=targets.map(t=>auditCfb2022OriginalCePdf(
    t,pdfs.get(t.id)??null,calendar,failed.get(t.id)??null));
  const successful=reports.filter(t=>t.status==='original_version_pdf_header_and_independent_calendar_verified').length;
  const body={
    schemaVersion:CFB_2022_SENATE_CE_PROOF_VERSION,
    capturedAt:new Date().toISOString(),
    originalReferenceSourceCheckpoint:SOURCE_CHECKPOINT,
    originalSourceArtifactId:11683227803,
    scope:{
      targetYear:2022,sourceCfbViewerSegmentEndYear:2022,
      originalViewerReportVersionReferenceCount:24,
      originalVersionReferentCandidateCommittees:12,
      districts:[1,2,3,4,5,6,7,8,9,10,11,12],
      periods:['C','E'],amendmentVersionIndex:0,
      scopedSourceOnlyNotStatewide:true,
    },
    candidateViewers:candidateViewers.sort((a,b)=>a.registrationNumber.localeCompare(b.registrationNumber)),
    independentCalendar:{
      sourceUrl:CFB_2022_CE_INDEPENDENT_CALENDAR_URL,
      officialDated2022CalendarPdfSha256:calendar?.sha256??null,
      originalPdfBytes:calendar?.bytes??null,
      fetchedAt:calendar?.fetchedAt??null,
      calendarIdentityAndBothReportDatesVerified:calendarVerified,
      originalDatedCalendarStructuralDiagnostic:diagnoseCfb2022CeCalendar(calendar),
      errorKind:calendarError,
      preprimaryDueOn:calendarVerified?'2022-07-25':null,
      preprimaryCoverageEndOn:calendarVerified?'2022-07-18':null,
      pregeneralDueOn:calendarVerified?'2022-10-31':null,
      pregeneralCoverageEndOn:calendarVerified?'2022-10-24':null,
    },
    reports:reports.map(row=>({
      ...row,
      sourceFirstPageMetadataDiagnostic:pdfs.has(row.id)
        ? diagnoseCfb2022OriginalCeHeader(targets.find(t=>t.id===row.id)!,pdfs.get(row.id)!.text)
        : null,
    })),
    results:{
      reportPdfBytesDownloaded:pdfs.size,
      reportHeadersAndIndependentCalendarAuthenticated:successful,
      reportHeaderOrCalendarOrSourceFailures:24-successful,
      distinctRegistrationsSuccessfullyReprobed:
        candidateViewers.filter(v=>v.sourceApiBodyUnchanged).length,
      totalTargetRegistrations:12,
      separateOriginalCheckboxIndependentlyVerifiedCount:0,
      historicalPublicByIndependentlyVerifiedCount:0,
      legalFilingObligationDenominator:null,
      statewideActualOriginalFiledReportDenominator:null,
    },
    boundaries:{
      reportRawPdfsStored:false,calendarRawPdfStored:false,
      reportPdfTextOrDonorTransactionDataStored:false,
      noProductionNeonOrVercelReadsOrWrites:true,
      noBackfillOrModelRetraining:true,noServingOr2027Changes:true,
      noBackgroundSchedule:true,issue864RemainsOpen:true,
    },
  };
  mkdirSync(dirname(out),{recursive:true});
  writeFileSync(out,JSON.stringify(body,null,2)+'\n',{encoding:'utf8',flag:'wx'});
  console.log(JSON.stringify({
    schemaVersion:body.schemaVersion,
    scopedCandidates:12,targetOriginalC_EVersionPdfs:24,
    officialCalendarAuthenticated:calendarVerified,
    officialCandidateViewersUnchanged:body.results.distinctRegistrationsSuccessfullyReprobed,
    pdfsDownloaded:pdfs.size,pdfAndIndependentCalendarAuthenticated:successful,
    notAuthenticated:reports.filter(x=>x.status!=='original_version_pdf_header_and_independent_calendar_verified')
      .map(x=>({id:x.id,status:x.status,errorKind:x.sourceError})),
    historicalPublicByProved:0,
    statewideLegallyRequiredReportDenominator:null,productionMutation:false,
    output:out,
  },null,2));
  if(!calendarVerified || successful!==24 || body.results.distinctRegistrationsSuccessfullyReprobed!==12)
    process.exitCode=1;
}
main().catch(e=>{console.error(errorKind(e));process.exitCode=1;});
