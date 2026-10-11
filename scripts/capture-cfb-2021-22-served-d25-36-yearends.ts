/**
 * #864 finance Track A — ONE-SHOT PR-only original CFB 2021/22 year-end PDFs.
 * Scope: the same 11 independently verified actual senators authenticated in
 * PR #1012. No raw PDFs/text, donors, financial records, addresses, names of
 * never-serving candidates, or original election vote counts are persisted.
 *
 * node --import tsx scripts/capture-cfb-2021-22-served-d25-36-yearends.ts
 *   --output artifacts/cfb-2021-22-served-d25-36-18-ye-original-pdf-proofs.json
 */
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL,
  parseOfficialMnSenateServiceDirectory}
  from '../src/evidence/senate-official-ever-served-directory.js';
import {SOS_2022_OFFICIAL_SENATE_FILES,parseSos2022SenateElectionResults}
  from '../src/evidence/cfb-2022-senate-sos-ballot-obligation-reconciliation.js';
import {cfbSenateDistrictPageUrl,parseCfbSenateDistrictCandidatePage}
  from '../src/evidence/cfb-senate-district-registration-inventory.js';
import {
  SERVED_2022_GENERAL_SOURCE_SHA,SERVED_2022_D25_36_DISTRICTS,
  selectServed2022D25to36OriginalCe,
} from '../src/evidence/cfb-2022-served-d25-36-original-ce.js';
import {
  SERVED_2021_22_D25_36_YE_PROOF_VERSION,SERVED_2021_22_D25_36_YE_CALENDAR_URL,
  selectServedD25to36OriginalYearEndTargets,cfbServedD25to36YearEndReference,
  verifyServedD25to36YearEndCalendar,auditServedD25to36YearEnd,
  type YearEnd2022SourcePdf,
} from '../src/evidence/cfb-2021-22-served-d25-36-yearend-original-proof.js';
import {fetchCfbCandidateHistoricalReportReferenceSnapshot}
  from '../src/evidence/cfb-candidate-report-history.js';
import {fetchCfbReportViewerText}
  from '../src/evidence/cfb-current-report-acquisition.js';

const REG_CHECKPOINT='docs/evaluation/source-proof/cfb-2021-25-senate-district-registration-source-checkpoint.json';
const API_LEDGER='docs/evaluation/source-proof/cfb-2021-24-senate-396-original-viewer-source-observations.psv';
const PRIOR_CE='docs/evaluation/source-proof/cfb-2022-senate-24-original-ce-pdf-headers.psv';
const NEW_CE='docs/evaluation/source-proof/cfb-2022-served-d13-24-original-ce-pdfs.psv';
const SD25_CE='docs/evaluation/source-proof/cfb-2022-served-d25-36-original-ce-pdfs.psv';
function errorKind(e:unknown):string{
  const x=e instanceof Error?e.message:String(e);
  return /timeout|abort/i.test(x)?'http_timeout':
    /HTTP (429|5\d\d)/i.test(x)?'official_source_temporarily_unavailable':
    /HTTP [4-5]\d\d/i.test(x)?'official_source_http_error':
    /mismatch|sha|drift/i.test(x)?'original_source_identity_drift':
    /pdf|text|parse/i.test(x)?'original_report_parse_error':
    'official_source_or_report_validation_error';
}
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
async function source(url:string,host:string,accept:string,max:number){
  const response=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(50_000),
    headers:{'user-agent':'VotePredict/2.0 original-2021-22-yearend-source-proof',accept}});
  const a=new URL(response.url),b=new URL(url);
  if(!response.ok||a.protocol!=='https:'||a.hostname!==host
    ||a.pathname!==b.pathname||a.search!==b.search)
    throw Error('Unexpected original official HTTP '+response.status+' or host/path');
  if(Number(response.headers.get('content-length'))>max)
    throw Error('Original public source exceeds byte budget');
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.length<500||bytes.length>max)throw Error('Official source missing or outside bound');
  return {url,bytes,sha256:sha(bytes),observedAt:new Date().toISOString()};
}
async function yearendCalendar():Promise<YearEnd2022SourcePdf>{
  const r=await source(SERVED_2021_22_D25_36_YE_CALENDAR_URL,'cfb.mn.gov','application/pdf',12_000_000);
  if(Buffer.from(r.bytes.subarray(0,5)).toString('ascii')!=='%PDF-')
    throw Error('Original 2022 CFB report calendar is not a PDF');
  const bytes=r.bytes.length;
  const {CanvasFactory}=await import('pdf-parse/worker');
  const {PDFParse}=await import('pdf-parse');
  const pdf=new PDFParse({data:r.bytes,CanvasFactory});
  try{
    return {sourceUrl:r.url,sha256:r.sha256,bytes,observedAt:r.observedAt,
      text:(await pdf.getText()).text??''};
  }finally{await pdf.destroy();}
}
async function main(){
  const args=process.argv.slice(2);
  if(args.length!==2||args[0]!=='--output'||!args[1])
    throw Error('Only --output artifacts/<new-file>.json allowed');
  const output=resolve(args[1]);
  if(!output.startsWith(resolve('artifacts')+sep)||!output.endsWith('.json'))
    throw Error('Output may only be new metadata JSON under artifacts');
  const [lrl,sos]=await Promise.all([
    source(OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL,'www.lrl.mn.gov','text/html',5_000_000),
    source(SOS_2022_OFFICIAL_SENATE_FILES.general,'electionresultsfiles.sos.mn.gov','text/plain',200_000),
  ]);
  if(sos.sha256!==SERVED_2022_GENERAL_SOURCE_SHA)
    throw Error('Original 2022 SOS Senate general-result source SHA changed');
  const official=parseOfficialMnSenateServiceDirectory(lrl.bytes,lrl.observedAt);
  const sosRows=parseSos2022SenateElectionResults({election:'general',sourceUrl:sos.url,
    text:Buffer.from(sos.bytes).toString('utf8')});
  const pages=await Promise.all(SERVED_2022_D25_36_DISTRICTS.map(async district=>{
    const url=cfbSenateDistrictPageUrl(district,2022);
    const r=await source(url,'register.cfb.mn.gov','text/html',3_000_000);
    return parseCfbSenateDistrictCandidatePage({district,segmentEndYear:2022,
      sourceUrl:url,fetchedAt:r.observedAt,htmlSha256:r.sha256,
      html:Buffer.from(r.bytes).toString('utf8'),responseBytes:r.bytes.length});
  }));
  const previous24=readFileSync(PRIOR_CE,'utf8').trim().split('\n')
    .map(row=>row.split('|')[0]!);
  const previous22=readFileSync(NEW_CE,'utf8').trim().split('\n')
    .map(row=>row.split('|')[0]!);
  const newlyAuthenticated22=readFileSync(SD25_CE,'utf8').trim().split('\n')
    .map(row=>row.split('|')[0]!);
  const prior=new Set([...previous24,...previous22,...newlyAuthenticated22]);
  if(previous24.length!==24||previous22.length!==22||newlyAuthenticated22.length!==22||prior.size!==68
    ||[...prior].some(id=>!/^\d{3,8}:22:pcc:[CE]:0:0$/.test(id)))
    throw Error('Previously authenticated 68 original report identities missing or duplicate');
  const viewerPsv=readFileSync(API_LEDGER,'utf8');
  const eligible=selectServed2022D25to36OriginalCe({
    official,sosGeneral:sosRows,originalSosGeneralBytesSha256:sos.sha256,
    cfbDistrictPages:pages,viewerPsv,
    registrationCheckpoint:JSON.parse(readFileSync(REG_CHECKPOINT,'utf8')),
    alreadyAuthenticatedReportIds:new Set([...previous24,...previous22]),
  });
  const targets=selectServedD25to36OriginalYearEndTargets({
    cEProofs:eligible.targets,official,originalViewerPsv:viewerPsv,priorReportIds:prior});
  let calendar:YearEnd2022SourcePdf|null=null;
  let calendarError:string|null=null;
  try{calendar=await yearendCalendar();}catch(e){calendarError=errorKind(e);}
  const cVerified=verifyServedD25to36YearEndCalendar(calendar);
  const viewerProofs:Array<{reg:string;apiUrl:string|null;
    originalSha256:string;observedSha256:string|null;
    originalKeysReverified:number;observedAt:string|null;
    errorKind:string|null}>=[];
  const pdfs=new Map<string,YearEnd2022SourcePdf>();
  const failures=new Map<string,string>();
  const regs=[...new Set(targets.map(t=>t.reg))];
  let next=0;
  async function worker(){
    while(next<regs.length){
      const reg=regs[next++]!;
      const group=targets.filter(t=>t.reg===reg);
      let snap:Awaited<ReturnType<typeof fetchCfbCandidateHistoricalReportReferenceSnapshot>>|undefined;
      try{
        snap=await fetchCfbCandidateHistoricalReportReferenceSnapshot(reg,2022);
        if(snap.responseSha256!==group[0]!.viewerSha
          ||snap.sourceUrl!=='https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/'+
            reg+'/2022/')throw Error('Previously pinned original reports_data API source SHA drift');
        const selected=group.map(t=>{
          const found=snap!.references.filter(r=>r.registrationNumber===t.reg
            &&r.year===String(t.year).slice(2)&&r.type==='pcc'
            &&r.period==='YE'&&r.se==='0'&&r.amendment===0);
          if(found.length!==1)throw Error('Official original year-end viewer version key ambiguous');
          return {t,ref:found[0]!};
        });
        viewerProofs.push({reg,apiUrl:snap.sourceUrl,originalSha256:group[0]!.viewerSha,
          observedSha256:snap.responseSha256,originalKeysReverified:selected.length,
          observedAt:snap.fetchedAt,errorKind:null});
        for(const {t,ref} of selected){
          try{
            const p=await fetchCfbReportViewerText(ref,{
              method:'POST',referer:snap.sourceUrl,searchType:'Candidate'});
            pdfs.set(t.reportId,{sourceUrl:p.sourceUrl,sha256:p.contentSha256,
              bytes:p.bytes,observedAt:p.fetchedAt,text:p.text});
          }catch(e){failures.set(t.reportId,errorKind(e));}
        }
      }catch(e){
        viewerProofs.push({reg,apiUrl:snap?.sourceUrl??null,
          originalSha256:group[0]!.viewerSha,observedSha256:snap?.responseSha256??null,
          originalKeysReverified:0,observedAt:snap?.fetchedAt??null,errorKind:errorKind(e)});
        for(const t of group)failures.set(t.reportId,errorKind(e));
      }
      await new Promise(done=>setTimeout(done,135));
    }
  }
  await Promise.all([worker(),worker()]);
  const reports=targets.map(t=>auditServedD25to36YearEnd(
    t,pdfs.get(t.reportId)??null,calendar,failures.get(t.reportId)??null));
  const authenticated=reports.filter(x=>x.status==='original_pdf_first_page_and_calendar_authenticated').length;
  const payload={
    schema:SERVED_2021_22_D25_36_YE_PROOF_VERSION,observedAt:new Date().toISOString(),
    sourceScope:{historicalReportYears:[2021,2022],selectedVerifiedActualSenators:11,
      distinctOriginalReportTargets:18,year2021OriginalYearEndReferences:7,
      year2022OriginalYearEndReferences:11,sourceCfbViewerSegment:2022,
      priorAuthenticatedOriginalCEIdentitiesExcluded:68,
      owedFilingDenominator:null,anyHistoricalPredictionEligibility:false},
    independentOriginalServiceSource:{url:lrl.url,sha256:lrl.sha256,
      bytes:lrl.bytes.length,observedAt:lrl.observedAt},
    independentOriginalElectionSource:{url:sos.url,sha256:sos.sha256,
      bytes:sos.bytes.length,observedAt:sos.observedAt,
      pastElectionResultUsedForHistoricalAcquisitionOnly:true},
    originalCfbDistrictSources:pages.map(p=>({district:p.district,
      url:p.sourceUrl,sha256:p.htmlSha256,observedAt:p.retrievedAt,
      status:p.status,nonServingCandidateNamesStored:false})),
    selectedOnlyActualSenators:eligible.selectedSenators,
    originalViewerApiRechecks:viewerProofs.sort((a,b)=>a.reg.localeCompare(b.reg)),
    originalCalendar:{url:SERVED_2021_22_D25_36_YE_CALENDAR_URL,
      sha256:calendar?.sha256??null,bytes:calendar?.bytes??null,
      observedAt:calendar?.observedAt??null,year2021And2022YeCalendarVerified:cVerified,
      calendarSourceError:calendarError,
      year2021ReportDueOn:cVerified?'2022-01-31':null,
      year2022ReportDueOn:cVerified?'2023-01-31':null},
    reports,
    results:{newlyDownloadedOriginalPdfs:pdfs.size,
      authenticatedOriginalPdfHeaderAndCalendar:authenticated,
      failedOrUnverifiedOriginalPdfCount:targets.length-authenticated,
      viewerApiRegistrationsReauthenticated:viewerProofs.filter(v=>
        v.originalKeysReverified>0).length,
      independentHistoricalPublicByVerified:0,legalOwedOriginalReportDenominator:null,
      rowLevelDonationExpenditureCoverageReconciled:false,
      additionalReportsAlreadyAuthenticatedExcluded:true},
    safeguards:{noRawPdfsStored:true,noDonorOrTransactionTextStored:true,
      noNeverServedPersonNamesStored:true,noElectionVoteTotalsStored:true,
      noProductionDbReadOrWrite:true,noRetrospectiveAsOfPromotion:true,
      noModelOrSchedulerOrServingOr2027Changes:true,issue864RemainsOpen:true},
  };
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output,JSON.stringify(payload,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({sourceScope:'11 independently served Senate members; original 2021/22 YE only',
    selectedOriginalPdfReferences:targets.length,authenticatedOriginalPdfs:authenticated,
    sourceFailures:targets.length-authenticated,calendarVerified:cVerified,
    errors:reports.filter(x=>x.status!=='original_pdf_first_page_and_calendar_authenticated')
      .map(x=>({id:x.reportId,status:x.status,errorKind:x.sourceError})),
    newOriginalPdfHashes:reports.filter(x=>x.status==='original_pdf_first_page_and_calendar_authenticated')
      .map(x=>({id:x.reportId,sha256:x.originalPdfSha256})),
    output,productionDataChanged:false},null,2));
  if(!cVerified||authenticated!==18||viewerProofs.filter(x=>x.originalKeysReverified>0).length!==11)
    process.exitCode=1;
}
main().catch(e=>{console.error(errorKind(e));process.exitCode=1;});
