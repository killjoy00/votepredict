/**
 * #864 Track A. One-time PR-only acquisition of precisely TWO new 2025
 * ordinary year-end original-version PDFs for independently served senators.
 * Official LRL directory + oath, original pinned CFB district rosters/viewer
 * version keys, actual CFB PDF binary headers, independently hashed original
 * 2025 disclosure calendar. NEVER persist report body/donor transactions.
 * Usage: node --import tsx scripts/capture-cfb-2025-served-two-yearend-originals.ts
 *    --output artifacts/cfb-2025-served-two-yearend-originals.json
 */
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve,sep} from 'node:path';
import {
  parseOfficialMnSenateServiceDirectory,OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL,
  OFFICIAL_MN_SENATE_SWEARING_HISTORY_URL,
} from '../src/evidence/senate-official-ever-served-directory.js';
import {
  cfbSenateDistrictPageUrl,parseCfbSenateDistrictCandidatePage,
} from '../src/evidence/cfb-senate-district-registration-inventory.js';
import {
  selectServed2025SpecialFinalTargets,
} from '../src/evidence/cfb-2025-served-special-final-pdf-proof.js';
import {
  SERVED_2025_YE_ORIGINAL_VERSION,SERVED_2025_YE_CALENDAR,
  selectServed2025YearEndTargets,served2025YearEndRef,
  validateServed2025YearEndCalendar,auditServed2025YearEndPdf,
} from '../src/evidence/cfb-2025-served-two-ordinary-year-end-originals.js';
import {
  fetchCfbCandidateHistoricalReportReferenceSnapshot,
} from '../src/evidence/cfb-candidate-report-history.js';
import {fetchCfbReportViewerText} from '../src/evidence/cfb-current-report-acquisition.js';
const PREFIX='docs/evaluation/source-proof/';
const LEDGER=PREFIX+'cfb-2025-dated-senate-85-reference-versions.psv';
const CHECKPOINT=PREFIX+'cfb-2025-served-senators-2-special-cycle-final-original-source-checkpoint.json';

function safeError(e:unknown):string{
  return (e instanceof Error?e.message:'unclassified original source error')
    .replace(/https?:\/\/\S+/g,'[approved original source]').slice(0,250);
}
async function original(url:string,host:string,accept='text/html',max=5_000_000){
  const r=await fetch(url,{
    headers:{'user-agent':'VotePredict/2.0 independent-served-2025-yearend-original-proof',accept},
    signal:AbortSignal.timeout(45000),redirect:'follow',
  });
  const expected=new URL(url),actual=new URL(r.url);
  if(!r.ok||actual.protocol!=='https:'||actual.hostname!==host
    ||actual.pathname!==expected.pathname||(host!=='cfb.mn.gov'&&actual.search!==expected.search))
    throw Error('Unexpected original official source identity or response status');
  const declared=Number(r.headers.get('content-length'));
  if(declared>max)throw Error('Original official source exceeds byte cap');
  const data=new Uint8Array(await r.arrayBuffer());
  if(data.byteLength<500||data.byteLength>max)throw Error('Original source file size outside bounds');
  return{
    url,data,sha256:createHash('sha256').update(data).digest('hex'),
    bytes:data.byteLength,fetchedAt:new Date().toISOString(),
    text:host==='cfb.mn.gov'?'':Buffer.from(data).toString('utf8'),
  };
}
async function calendar(){
  const src=await original(SERVED_2025_YE_CALENDAR,'cfb.mn.gov','application/pdf',12000000);
  if(Buffer.from(src.data.subarray(0,5)).toString('ascii')!=='%PDF-')
    throw Error('Original 2025 general disclosure calendar is not a PDF');
  // pdf-parse may detach input ArrayBuffer: snapshot its byte count BEFORE construction.
  const bytes=src.bytes;
  const {CanvasFactory}=await import('pdf-parse/worker');
  const {PDFParse}=await import('pdf-parse');
  const reader=new PDFParse({data:src.data,CanvasFactory});
  try{
    const body=(await reader.getText()).text??'';
    return{url:SERVED_2025_YE_CALENDAR,sha256:src.sha256,
      bytes,observedAt:src.fetchedAt,text:body};
  }finally{await reader.destroy();}
}
async function main(){
  const a=process.argv.slice(2);
  if(a.length!==2||a[0]!=='--output'||!a[1])throw Error('Exactly --output artifacts/<file>.json required');
  const output=resolve(a[1]);
  if(!output.startsWith(resolve('artifacts')+sep)||!output.endsWith('.json'))
    throw Error('Only a new metadata-only file under artifacts is allowed');
  // Actual senator service identity must be established from original LRL HTML,
  // not current 2026 political candidacy or a post-election winner label.
  const [lrl,sworn]=await Promise.all([
    original(OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL,'www.lrl.mn.gov'),
    original(OFFICIAL_MN_SENATE_SWEARING_HISTORY_URL,'www.lrl.mn.gov'),
  ]);
  const memberSource=parseOfficialMnSenateServiceDirectory(
    lrl.data,lrl.fetchedAt,sworn.data,sworn.fetchedAt);
  const rosters=await Promise.all(([29,47] as const).map(async district=>{
    const url=cfbSenateDistrictPageUrl(district,2026);
    const page=await original(url,'register.cfb.mn.gov');
    return parseCfbSenateDistrictCandidatePage({
      district,segmentEndYear:2026,sourceUrl:url,fetchedAt:page.fetchedAt,
      htmlSha256:page.sha256,html:page.text,responseBytes:page.bytes,
    });
  }));
  const sourceTargets=selectServed2025SpecialFinalTargets(
    memberSource,rosters,readFileSync(LEDGER,'utf8'));
  const checkpoint=JSON.parse(readFileSync(CHECKPOINT,'utf8'));
  const targets=selectServed2025YearEndTargets(
    sourceTargets,checkpoint,readFileSync(LEDGER,'utf8'));
  if(targets.length!==2)throw Error('Unexpected number of ever-served senator year-end targets');
  const originalCalendar=await calendar();
  const calendarCheck=validateServed2025YearEndCalendar(originalCalendar);
  // Validate calendar independently of reports: a failed authoritative calendar
  // does not allow an original PDF identity or legal due date to be certified.
  const reports=[];
  const apiSources=[];
  for(const t of targets){
    try{
      const viewer=await fetchCfbCandidateHistoricalReportReferenceSnapshot(t.registrationNumber,2026);
      const refs=viewer.references.filter(ref=>
        ref.registrationNumber===t.registrationNumber&&ref.year==='25'
        &&ref.type==='pcc'&&ref.period==='YE'
        &&ref.se==='0'&&ref.amendment===0);
      if(refs.length!==1||viewer.responseSha256!==t.originalViewerApiSha256)
        throw Error('Original pinned 2025 CFB YE0.0 reference absent/changed/ambiguous');
      apiSources.push({
        registrationNumber:t.registrationNumber,url:viewer.sourceUrl,
        fetchedAt:viewer.fetchedAt,originalApiSha256:t.originalViewerApiSha256,
        currentApiSha256:viewer.responseSha256,unchanged:true,
      });
      const pdf=await fetchCfbReportViewerText(refs[0]!,{
        method:'POST',referer:viewer.sourceUrl,searchType:'Candidate',
      });
      reports.push(auditServed2025YearEndPdf(t,{
        sourceUrl:pdf.sourceUrl,sha256:pdf.contentSha256,
        bytes:pdf.bytes,observedAt:pdf.fetchedAt,text:pdf.text,
      },calendarCheck.verified,null));
    }catch(e){
      reports.push(auditServed2025YearEndPdf(t,null,calendarCheck.verified,safeError(e)));
    }
  }
  const verified=reports.filter(r=>r.status==='original_pdf_and_independent_calendar_verified').length;
  const body={
    schemaVersion:SERVED_2025_YE_ORIGINAL_VERSION,
    capturedAt:new Date().toISOString(),
    originalMemberServiceSources:[
      {url:lrl.url,sha256:lrl.sha256,bytes:lrl.bytes,observedAt:lrl.fetchedAt},
      {url:sworn.url,sha256:sworn.sha256,bytes:sworn.bytes,observedAt:sworn.fetchedAt},
    ],
    scope:{
      issue:864,reportYear:2025,viewerSegmentEndYear:2026,
      onlyIndependentlyVerifiedActualSenators:true,
      senatorCount:2,senateDistricts:[29,47],
      sourcePinned2025VersionLedger:LEDGER,
      priorActualServiceAndSpecialFinalProof:CHECKPOINT,
      sourceYearEndVersions:['19229:25:pcc:YE:0:0','19233:25:pcc:YE:0:0'],
      noneOfTheseOrdinaryYearEndOriginalsPreviouslyAuthenticated:true,
    },
    independentGeneralCalendar:{
      url:originalCalendar.url,originalPdfSha256:originalCalendar.sha256,
      originalPdfBytes:originalCalendar.bytes,observedAt:originalCalendar.observedAt,
      calendarAuthenticated:calendarCheck.verified,
      failure:calendarCheck.failure,yearEnd2025DueOn:calendarCheck.verified?'2026-02-02':null,
    },
    originalCandidateViewerApiProvenance:apiSources,
    originalYearEndReports:reports,
    results:{
      yearEndViewerVersionsSelected:2,
      reportPdfOriginalHeaderAndCalendarAuthenticated:verified,
      reportOriginalAuthenticationFailed:2-verified,
      newlyAuthenticatedOriginalPdfCount:verified,
      coverageComparisons:reports.map(r=>({
        reportId:r.reportId,classification:r.cycleFinalToYearEndCoverage,
      })),
      legalYearEndFilingObligationCount:null,
      finalReportsAreTerminationReportsIndependentlyDetermined:false,
      sourceProvenHistoricalPublicByCount:0,
      statewideCommitteeRegistrationTerminationDenominator:null,
      statewideLegallyOwedReportDenominator:null,
      databaseRowContainmentReconciled:false,
    },
    safeguards:{
      reportBodiesPersisted:false,contributorsPersisted:false,
      campaignContactFieldsPersisted:false,
      originalReportCheckboxNotInferred:true,
      noHistoricalForecastPromotion:true,
      noProductionDbOrServingChanges:true,
      noScheduledAutomation:true,keepIssue864Open:true,
    },
  };
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output,JSON.stringify(body,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({
    onlyIndependentlyVerifiedSenators:2,
    reportYear:2025,yearEndViewerVersionKeys:2,
    reportPdfsAndCalendarAuthenticated:verified,
    generalOriginalCalendarVerified:calendarCheck.verified,
    sourceFailures:2-verified,
    sourceErrors:reports.filter(r=>r.sourceFailure).map(r=>({
      id:r.reportId,reason:r.sourceFailure,
    })),
    reportOutcomes:reports.map(r=>({id:r.reportId,status:r.status,
      periodStart:r.startOn,periodEnd:r.endOn,
      boardReceivedOn:r.boardReceivedOn,
      legalFloor:r.earliestLegalAndReceiptNotBeforeOn,
      coverageComparison:r.cycleFinalToYearEndCoverage,
    })),
    historicalPublicByVerified:0,legallyOwedCount:null,
    output,
  },null,2));
  if(!calendarCheck.verified||verified!==2)process.exitCode=1;
}
main().catch(e=>{console.error(safeError(e));process.exitCode=1;});
