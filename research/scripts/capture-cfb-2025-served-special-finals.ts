/**
 * #864 one-shot, PR-only original-source acquisition. NO production databases,
 * donor data, PDF bodies, candidate contact details, or evidence backfills.
 * Usage: node --import tsx scripts/capture-cfb-2025-served-special-finals.ts
 *   --output artifacts/cfb-2025-served-special-final-originals.json
 */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve,sep} from 'node:path';
import {
  parseOfficialMnSenateServiceDirectory,OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL,
  OFFICIAL_MN_SENATE_SWEARING_HISTORY_URL,
} from '../../src/evidence/senate-official-ever-served-directory.js';
import {
  cfbSenateDistrictPageUrl,parseCfbSenateDistrictCandidatePage,
} from '../../src/evidence/cfb-senate-district-registration-inventory.js';
import {
  SERVED_2025_SPECIAL_FINAL_VERSION,selectServed2025SpecialFinalTargets,
  verifyServed2025SpecialFinalCalendar,cfbServed2025FinalReference,
  auditServed2025SpecialFinalReport,
} from '../evidence/cfb-2025-served-special-final-pdf-proof.js';
import {fetchCfbCandidateHistoricalReportReferenceSnapshot}
  from '../../src/evidence/cfb-candidate-report-history.js';
import {fetchCfbReportViewerText}
  from '../../src/evidence/cfb-current-report-acquisition.js';

const LEDGER='docs/evaluation/source-proof/cfb-2025-dated-senate-85-reference-versions.psv';
function safeError(e:unknown):string{
  if(!(e instanceof Error))return 'unknown_error';
  return e.message.replace(/https?:\/\/\S+/g,'[original source]').slice(0,240);
}
async function source(url:string,host:string,accept='text/html',max=5_000_000){
  const resp=await fetch(url,{headers:{'user-agent':'VotePredict/2.0 senator-only-2025-source-audit',accept},
    signal:AbortSignal.timeout(45_000),redirect:'follow'});
  const u=new URL(resp.url),expect=new URL(url);
  if(!resp.ok||u.protocol!=='https:'||u.hostname!==host||u.pathname!==expect.pathname
    ||u.search!==expect.search)throw Error('Source URL identity or HTTP response invalid');
  const len=Number(resp.headers.get('content-length'));
  if(len>max)throw Error('Original source too large');
  const bytes=new Uint8Array(await resp.arrayBuffer());
  if(bytes.length<500||bytes.length>max)throw Error('Original source body out of bounds');
  return {sourceUrl:url,bytes,sha256:createHash('sha256').update(bytes).digest('hex'),
    observedAt:new Date().toISOString(),text:Buffer.from(bytes).toString('utf8')};
}
async function pdfCalendar(url:string){
  const r=await source(url,'cfb.mn.gov','application/pdf',12_000_000);
  if(Buffer.from(r.bytes.subarray(0,5)).toString('ascii')!=='%PDF-')
    throw Error('Calendar returned no PDF header');
  // pdf-parse can detach its input ArrayBuffer; snapshot byte length before parsing.
  const originalPdfBytes=r.bytes.byteLength;
  const {CanvasFactory}=await import('pdf-parse/worker');
  const {PDFParse}=await import('pdf-parse');
  const parser=new PDFParse({data:r.bytes,CanvasFactory});
  try{
    const text=(await parser.getText()).text??'';
    return {url,sha256:r.sha256,bytes:originalPdfBytes,observedAt:r.observedAt,text};
  }finally{await parser.destroy();}
}
async function main(){
  const args=process.argv.slice(2);
  if(args.length!==2||args[0]!=='--output'||!args[1])throw Error('Use --output artifacts/<file>.json');
  const output=resolve(args[1]);
  if(!output.startsWith(resolve('artifacts')+sep)||!output.endsWith('.json'))
    throw Error('Only a metadata-only artifact path is permitted');
  // Independent official original Senate directory AND special swearing dates.
  const [directory,swearing]=await Promise.all([
    source(OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL,'www.lrl.mn.gov'),
    source(OFFICIAL_MN_SENATE_SWEARING_HISTORY_URL,'www.lrl.mn.gov'),
  ]);
  const official=parseOfficialMnSenateServiceDirectory(
    directory.bytes,directory.observedAt,swearing.bytes,swearing.observedAt);
  const rosters=await Promise.all(([29,47] as const).map(async district=>{
    const url=cfbSenateDistrictPageUrl(district,2026);
    const r=await source(url,'register.cfb.mn.gov');
    return parseCfbSenateDistrictCandidatePage({
      district,segmentEndYear:2026,sourceUrl:url,fetchedAt:r.observedAt,
      htmlSha256:r.sha256,html:r.text,responseBytes:r.bytes.length,
    });
  }));
  const targets=selectServed2025SpecialFinalTargets(
    official,rosters,readFileSync(LEDGER,'utf8'));
  if(targets.length!==2)throw Error('Must select exactly two independently served senators');

  const reports=[];const viewers=[];const calendars=[];
  let sourceFailures=0;
  for(const target of targets){
    let viewer;
    try{
      viewer=await fetchCfbCandidateHistoricalReportReferenceSnapshot(target.registrationNumber,2026);
      if(viewer.sourceUrl!==('https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/'+
        target.registrationNumber+'/2026/'))throw Error('Wrong original CFB candidate segment URL');
      const refs=viewer.references.filter(r=>r.registrationNumber===target.registrationNumber
        &&r.year==='25'&&r.type==='pcc'&&r.period==='YE'&&r.se==='1'&&r.amendment===0);
      if(refs.length!==1)throw Error('Missing/ambiguous original YE1.0 reference');
      viewers.push({
        registrationNumber:target.registrationNumber,sourceUrl:viewer.sourceUrl,
        observedAt:viewer.fetchedAt,originalApiSha256:target.viewerSha256,
        currentApiSha256:viewer.responseSha256,
        originalSourceUnchanged:viewer.responseSha256===target.viewerSha256,
        sourceVersionId:target.reportId,
      });
      const calendar=await pdfCalendar(target.calendarUrl);
      const calendarValid=verifyServed2025SpecialFinalCalendar(target,calendar);
      calendars.push({
        district:target.district,url:calendar.url,sha256:calendar.sha256,
        bytes:calendar.bytes,observedAt:calendar.observedAt,
        originalIdentityAndDuePeriodDatesVerified:calendarValid,
      });
      const fetched=await fetchCfbReportViewerText(refs[0]!,{
        method:'POST',referer:viewer.sourceUrl,searchType:'Candidate',
      });
      const audit=auditServed2025SpecialFinalReport(target,{
        sourceUrl:fetched.sourceUrl,sha256:fetched.contentSha256,
        bytes:fetched.bytes,observedAt:fetched.fetchedAt,text:fetched.text,
      },calendarValid,null);
      if(audit.status!=='original_pdf_and_calendar_verified')sourceFailures++;
      reports.push(audit);
    }catch(error){
      sourceFailures++;
      reports.push(auditServed2025SpecialFinalReport(target,null,false,safeError(error)));
    }
  }
  const good=reports.filter(r=>r.status==='original_pdf_and_calendar_verified').length;
  const body={
    schema: SERVED_2025_SPECIAL_FINAL_VERSION,capturedAt:new Date().toISOString(),
    scope:{
      issue:864,reportYear:2025,districts:[29,47],senateServedPeople:2,
      targetReportType:'special_election_cycle_final',
      reportsAlreadyVerifiedIn2025SpecialCEOrDistrict6CohortsExcluded:true,
      originalCandidateViewerReferences:2,
      legalSenateFilingDenominator:null,
    },
    originalSenateServiceSources:[
      {url:directory.sourceUrl,sha256:directory.sha256,bytes:directory.bytes.length,
       observedAt:directory.observedAt},
      {url:swearing.sourceUrl,sha256:swearing.sha256,bytes:swearing.bytes.length,
       observedAt:swearing.observedAt},
    ],
    matchedOnlyServedSenators:targets.map(t=>({
      registrationNumber:t.registrationNumber,district:t.district,
      verifiedName:t.officialName,candidateRosterLabel:t.label,
      districtRosterSha256:t.rosterHtmlSha256,
      actualServiceSourceUrl:t.originalServiceSourceUrl,
    })),
    sourceViewers:viewers,officialCalendarPdfs:calendars,
    reports,summary:{
      selectedOriginalViewerKeys:2,
      sourcePdfBinaryAndFirstPageCalendarVerified:good,
      originalPdfSourceFailures:sourceFailures,
      newOriginalPdfsNotPreviouslyAuthenticated:good,
      independentlyProvenHistoricalPublicBy:0,
      complete2025ReportingDenominator:null,
      legallyRequired2025SenateReports:null,
      reportRowsReconciledAgainstDatabase:false,
    },
    safeguards:{
      noRawPdfBodiesPersisted:true,noDonorsOrTransactionsPersisted:true,
      noNonServingCandidateNamesPersisted:true,
      historicalPredictionEligibilityGranted:false,noProductionDbOrServingOperations:true,
      noModelTrainingOrSchedulerChanges:true,keepIssue864Open:true,
    },
  };
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output,JSON.stringify(body,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({scope:'two ever-served Senate special winners',targets:2,
    originalPdfsVerified:good,sourceFailures,calendarPdfsVerified:calendars.filter(c=>
      c.originalIdentityAndDuePeriodDatesVerified).length,
    historicalPublicByVerified:0,originalPdfReportIds:reports.map(r=>({
      reportId:r.reportId,status:r.status,error:r.sourceError,
    })),output},null,2));
  if(good!==2||sourceFailures!==0||calendars.length!==2)process.exitCode=1;
}
main().catch(e=>{console.error(safeError(e));process.exitCode=1;});
