/**
 * One-shot, PR-only original PDF retrieval for 2022 SD13-24 verified served
 * Minnesota senators. Never log or store campaign report text, donors, SOS
 * candidate names who did not serve, raw PDF bodies or vote counts.
 *
 * node --import tsx scripts/capture-cfb-2022-served-next-original-ce.ts
 *   --output artifacts/cfb-2022-served-d13-24-original-ce.json
 */
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {
  OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL,parseOfficialMnSenateServiceDirectory,
} from '../../src/evidence/senate-official-ever-served-directory.js';
import {
  SOS_2022_OFFICIAL_SENATE_FILES,parseSos2022SenateElectionResults,
} from '../evidence/cfb-2022-senate-sos-ballot-obligation-reconciliation.js';
import {
  cfbSenateDistrictPageUrl,parseCfbSenateDistrictCandidatePage,
} from '../../src/evidence/cfb-senate-district-registration-inventory.js';
import {
  SERVED_2022_NEXT_CE_VERSION,SERVED_2022_NEXT_DISTRICTS,
  SERVED_2022_GENERAL_SOURCE_SHA,selectServed2022NextOriginalCe,
  auditServed2022RedistrictedOriginalCe,
} from '../evidence/cfb-2022-served-senators-next-original-ce.js';
import {
  CFB_2022_CE_INDEPENDENT_CALENDAR_URL,
  diagnoseCfb2022CeCalendar,diagnoseCfb2022OriginalCeHeader,
  verifyCfb2022CeCalendar,type Cfb2022PdfProofCapture,
} from '../../src/evidence/cfb-2022-senate-original-ce-pdf-proof.js';
import {fetchCfbCandidateHistoricalReportReferenceSnapshot}
  from '../../src/evidence/cfb-candidate-report-history.js';
import {fetchCfbReportViewerText}
  from '../../src/evidence/cfb-current-report-acquisition.js';

const INDEX='docs/evaluation/source-proof/cfb-2021-25-senate-district-registration-source-checkpoint.json';
const API_LEDGER='docs/evaluation/source-proof/cfb-2021-24-senate-396-original-viewer-source-observations.psv';
const PRIOR='docs/evaluation/source-proof/cfb-2022-senate-24-original-ce-pdf-headers.psv';
const CALENDAR_SHA='3fd6263844d5063156d68d871bd2c575a5b5cef415a61b6125c068491f6b2b25';
function err(e:unknown){
  const s=e instanceof Error?e.message:String(e);
  return /timeout|abort/i.test(s)?'http_timeout':
    /HTTP 429|HTTP 503|HTTP 502|HTTP 504/i.test(s)?'official_source_transient':
    /HTTP [45]\d\d/i.test(s)?'official_source_http_error':
    /hash|sha|drift|mismatch/i.test(s)?'source_identity_drift':
    /pdf|parse|text/i.test(s)?'official_pdf_parse_error':'official_source_or_identity_error';
}
function sha(b:Uint8Array){return createHash('sha256').update(b).digest('hex');}
async function officialBytes(url:string,host:string,accept:string,max:number){
  const r=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(55_000),
    headers:{'user-agent':'VotePredict/2.0 source-only-senator-finance-2022',accept}});
  const actual=new URL(r.url),expected=new URL(url);
  if(!r.ok||actual.protocol!=='https:'||actual.hostname!==host
    ||actual.pathname!==expected.pathname||actual.search!==expected.search)
    throw Error('Official source HTTP '+r.status+' or URL identity mismatch');
  const len=Number(r.headers.get('content-length'));
  if(len>max)throw Error('Official source exceeds byte bound');
  const bytes=new Uint8Array(await r.arrayBuffer());
  if(bytes.byteLength<500||bytes.byteLength>max)throw Error('Missing or oversized original source');
  return {url,bytes,sha256:sha(bytes),observedAt:new Date().toISOString()};
}
async function official2022Calendar():Promise<Cfb2022PdfProofCapture>{
  const r=await officialBytes(CFB_2022_CE_INDEPENDENT_CALENDAR_URL,'cfb.mn.gov','application/pdf',12_000_000);
  if(Buffer.from(r.bytes.subarray(0,5)).toString('ascii')!=='%PDF-'||r.sha256!==CALENDAR_SHA)
    throw Error('2022 CFB original calendar binary SHA or PDF magic mismatch');
  const count=r.bytes.byteLength;
  const {CanvasFactory}=await import('pdf-parse/worker');
  const {PDFParse}=await import('pdf-parse');
  const parser=new PDFParse({data:r.bytes,CanvasFactory});
  try{
    return {sourceUrl:r.url,sha256:r.sha256,bytes:count,fetchedAt:r.observedAt,
      text:(await parser.getText()).text??''};
  }finally{await parser.destroy();}
}
async function main(){
  const args=process.argv.slice(2);
  if(args.length!==2||args[0]!=='--output'||!args[1])
    throw Error('Use --output artifacts/<new-name>.json');
  const output=resolve(args[1]);
  if(!output.startsWith(resolve('artifacts')+sep)||!output.endsWith('.json'))
    throw Error('Only new metadata JSON under artifacts is permitted');
  const [lr,sos]=await Promise.all([
    officialBytes(OFFICIAL_MN_SENATE_SERVICE_DIRECTORY_URL,'www.lrl.mn.gov','text/html',5_000_000),
    officialBytes(SOS_2022_OFFICIAL_SENATE_FILES.general,'electionresultsfiles.sos.mn.gov','text/plain',200_000),
  ]);
  if(sos.sha256!==SERVED_2022_GENERAL_SOURCE_SHA)
    throw Error('Official original SOS 2022 general-result bytes changed; stop for review');
  const official=parseOfficialMnSenateServiceDirectory(lr.bytes,lr.observedAt);
  const resultRows=parseSos2022SenateElectionResults({
    election:'general',sourceUrl:sos.url,text:Buffer.from(sos.bytes).toString('utf8'),
  });
  const pages=await Promise.all(SERVED_2022_NEXT_DISTRICTS.map(async district=>{
    const url=cfbSenateDistrictPageUrl(district,2022);
    const r=await officialBytes(url,'register.cfb.mn.gov','text/html',3_000_000);
    return parseCfbSenateDistrictCandidatePage({
      district,segmentEndYear:2022,sourceUrl:url,fetchedAt:r.observedAt,
      htmlSha256:r.sha256,html:Buffer.from(r.bytes).toString('utf8'),
      responseBytes:r.bytes.byteLength,
    });
  }));
  const prior=new Set(readFileSync(PRIOR,'utf8').trim().split('\n').map(row=>row.split('|')[0]!));
  if(prior.size!==24||[...prior].some(id=>!/^\d+:22:pcc:[CE]:0:0$/.test(id)))
    throw Error('Previously authenticated original 24-report identities changed');
  const chosen=selectServed2022NextOriginalCe({
    official,sosGeneral:resultRows,originalSosGeneralBytesSha256:sos.sha256,
    cfbDistrictPages:pages,viewerPsv:readFileSync(API_LEDGER,'utf8'),
    registrationCheckpoint:JSON.parse(readFileSync(INDEX,'utf8')),
    alreadyAuthenticatedReportIds:prior,
  });
  let calendar:Cfb2022PdfProofCapture|null=null;
  let calendarError:string|null=null;
  try{calendar=await official2022Calendar();}catch(e){calendarError=err(e);}
  const calendarVerified=verifyCfb2022CeCalendar(calendar);
  const viewers:Array<{registrationNumber:string;sourceUrl:string|null;
    sourceApiSha256:string;currentApiSha256:string|null;
    exactOriginalKeysPresent:boolean;observedAt:string|null;errorKind:string|null}>=[];
  const pdfs=new Map<string,Cfb2022PdfProofCapture>();
  const failures=new Map<string,string>();
  let next=0;
  async function worker(){
    while(next<chosen.selectedSenators.length){
      const item=chosen.selectedSenators[next++]!;
      const related=chosen.targets.filter(t=>t.reg===item.registrationNumber);
      let snap:Awaited<ReturnType<typeof fetchCfbCandidateHistoricalReportReferenceSnapshot>>|undefined;
      try{
        snap=await fetchCfbCandidateHistoricalReportReferenceSnapshot(item.registrationNumber,2022);
        if(snap.responseSha256!==item.originalViewerApiSha256
          ||snap.sourceUrl!=='https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/'+
            item.registrationNumber+'/2022/')
          throw Error('Official original CFB viewer body SHA drift or wrong URL');
        const refs=related.map(t=>{
          const found=snap!.references.filter(ref=>ref.registrationNumber===t.reg
            &&ref.year==='22'&&ref.type==='pcc'&&ref.period===t.period
            &&ref.se==='0'&&ref.amendment===0);
          if(found.length!==1)throw Error('Expected exact original version reference not unique');
          return {t,ref:found[0]!};
        });
        viewers.push({registrationNumber:item.registrationNumber,sourceUrl:snap.sourceUrl,
          sourceApiSha256:item.originalViewerApiSha256,currentApiSha256:snap.responseSha256,
          exactOriginalKeysPresent:true,observedAt:snap.fetchedAt,errorKind:null});
        for(const {t,ref} of refs){
          try{
            const pdf=await fetchCfbReportViewerText(ref,{
              method:'POST',referer:snap.sourceUrl,searchType:'Candidate'});
            pdfs.set(t.id,{sourceUrl:pdf.sourceUrl,sha256:pdf.contentSha256,
              bytes:pdf.bytes,fetchedAt:pdf.fetchedAt,text:pdf.text});
          }catch(e){failures.set(t.id,err(e));}
        }
      }catch(e){
        viewers.push({registrationNumber:item.registrationNumber,
          sourceUrl:null,sourceApiSha256:item.originalViewerApiSha256,
          currentApiSha256:snap?.responseSha256??null,
          exactOriginalKeysPresent:false,observedAt:snap?.fetchedAt??null,
          errorKind:err(e)});
        for(const t of related)failures.set(t.id,err(e));
      }
      await new Promise(resolve=>setTimeout(resolve,140));
    }
  }
  await Promise.all([worker(),worker()]);
  const reports=chosen.targets.map(t=>{
    const pdf=pdfs.get(t.id)??null;
    return {...auditServed2022RedistrictedOriginalCe(t,pdf,calendar,failures.get(t.id)??null),
      officialServedSenator:t.senator,officialServiceSource:t.officialServiceSource,
      officialServiceObservedAt:t.officialServiceSourceObservedAt,
      sourcePdfHeaderDiagnostics:pdf?diagnoseCfb2022OriginalCeHeader(t,pdf.text):null};
  });
  const ok=reports.filter(r=>r.status==='original_version_pdf_header_and_independent_calendar_verified').length;
  const report={
    schemaVersion:SERVED_2022_NEXT_CE_VERSION,observedAt:new Date().toISOString(),
    scope:{issue:864,calendarYear:2022,districts:[...SERVED_2022_NEXT_DISTRICTS],
      originalPdfVersionKeysSelected:chosen.targets.length,
      senatorsWithMatchedOfficialService:chosen.selectedSenators.length,
      periodClasses:['C','E'],existingSD1to12PdfIdentitiesExcluded:true,
      senateActualServiceMandatory:true,legallyRequiredSenateReportDenominator:null},
    independentOfficialSources:{
      senateService:{url:lr.url,sha256:lr.sha256,observedAt:lr.observedAt,bytes:lr.bytes.length},
      electionGeneral:{url:sos.url,sha256:sos.sha256,observedAt:sos.observedAt,bytes:sos.bytes.length,
        resultVoteCountsAndNeverServedNamesStored:false},
      cfbDistrictPages:pages.map(p=>({district:p.district,sourceUrl:p.sourceUrl,
        observedAt:p.retrievedAt,sha256:p.htmlSha256,status:p.status,
        candidateNamesOrContactsStored:false})),
    },
    selectedVerifiedSenators:chosen.selectedSenators,
    skippedDistricts:chosen.skippedDistricts,
    sourceCandidateViewerRechecks:viewers.sort((a,b)=>a.registrationNumber.localeCompare(b.registrationNumber)),
    independent2022Calendar:{
      url:CFB_2022_CE_INDEPENDENT_CALENDAR_URL,sourceSha256:calendar?.sha256??null,
      observedAt:calendar?.fetchedAt??null,bytes:calendar?.bytes??null,
      verified:calendarVerified,errorKind:calendarError,
      diagnostic:diagnoseCfb2022CeCalendar(calendar),
      preprimaryDueOn:calendarVerified?'2022-07-25':null,
      pregeneralDueOn:calendarVerified?'2022-10-31':null,
    },
    reports,
    results:{selectedOriginalPdfReferences:chosen.targets.length,
      authenticatedOriginalPdfHeadersAndCalendar:ok,
      downloadedPdfBodiesInMemory:pdfs.size,
      sourceOrHeaderFailures:chosen.targets.length-ok,
      actualHistoricalPublicByIndependentlyVerified:0,
      statewideRequiredReports:null,fullStatewideFiledOriginals:null,
      datasetReportAndFinancialRowReconciliationDone:false},
    safeguards:{noPdfsOrFinancialTransactionBodiesStored:true,
      noDonorContactOrNonServingCandidateNames:true,
      noSourceToProductionWrites:true,noHistoricalPredictionEligibilityGranted:true,
      noModelServingSchedulerOr2027Work:true,keepIssue864Open:true},
  };
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({selectedSenators:chosen.selectedSenators.length,
    targetPdfs:chosen.targets.length,success:ok,
    sourceFailures:chosen.targets.length-ok,skippedDistricts:chosen.skippedDistricts,
    calendarVerified,authenticatedReportIds:reports.filter(r=>
      r.status==='original_version_pdf_header_and_independent_calendar_verified')
      .map(r=>r.id),reportErrors:reports.filter(r=>
      r.status!=='original_version_pdf_header_and_independent_calendar_verified')
      .map(r=>({id:r.id,status:r.status,error:r.sourceError})),
    output,productionChange:false},null,2));
  if(!calendarVerified||ok!==chosen.targets.length
    ||viewers.filter(v=>v.exactOriginalKeysPresent).length!==chosen.selectedSenators.length)
    process.exitCode=1;
}
main().catch(e=>{console.error(err(e));process.exitCode=1;});
