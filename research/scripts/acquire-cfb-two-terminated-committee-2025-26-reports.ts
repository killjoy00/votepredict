/**
 * Issue #864 FINANCE ONLY. Two already independently authenticated Minnesota
 * senators whose 2026 current CFB candidate heading says "(Terminated)".
 * Investigate original CFB 2025/26 reports and report metadata WITHOUT
 * turning a 2026 label or form's blank "termination" checkbox into a legal
 * termination date, final report, missing earlier return or historic public-by.
 * Original PDF text and personal/donor/transaction fields are never saved.
 */
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve,sep} from 'node:path';
import {
 select22AuthenticSenatorRegistrationTargets,
 inspectCurrentOfficialCfbCandidateHeading,
} from '../evidence/cfb-2023-24-official-committee-status-proof.js';
import {fetchCfbCandidateHistoricalReportReferenceSnapshot} from
 '../../src/evidence/cfb-candidate-report-history.js';
import {fetchCfbReportViewerText,cfbReportViewerUrl} from
 '../../src/evidence/cfb-current-report-acquisition.js';
import {
 inspectPossibleOriginalCfbTerminationReportText,selectTwoTerminatedSenators,
 classifyTwoSenatorsInPublicCfbCurrentLists,
} from '../evidence/cfb-two-terminated-original-report-investigation.js';
import {parseCfbCandidateRegistryGrid, type CfbCandidateRegistryListAction} from
 '../evidence/cfb-current-candidate-registry-join.js';

const SOURCE71='docs/evaluation/source-proof/cfb-2023-24-served-22-71-yearend-version-statutory-release-bounds.psv';
const UA='Mozilla/5.0 VotePredict/2.0 original Minnesota CFB finance historical committee status research';
const CFB_ORIGIN='https://register.cfb.mn.gov';
const KEY_IDS=['18763','17362'] as const;
async function getOfficialLiveViewer(registration:string){
 const url=CFB_ORIGIN+'/reports-and-data/viewers/campaign-finance/candidates/'
  +registration+'/2026/';
 const res=await fetch(url,{redirect:'follow',headers:{accept:'text/html','user-agent':UA},
  signal:AbortSignal.timeout(45_000)});
 if(!res.ok)throw Error('Official original CFB 2026 candidate page HTTP '+res.status);
 const final=new URL(res.url);
 if(final.protocol!=='https:'||final.hostname!=='register.cfb.mn.gov')
  throw Error('CFB original candidate HTML redirected outside regulator');
 const raw=new Uint8Array(await res.arrayBuffer());
 if(raw.byteLength<3_000||raw.byteLength>1_000_000)
  throw Error('CFB candidate original HTML size unexpectedly invalid');
 const html=new TextDecoder().decode(raw);
 if(!/<!doctype html|<html/i.test(html))throw Error('Original CFB viewer was not HTML');
 return {url,bytes:raw.byteLength,sha256:createHash('sha256').update(raw).digest('hex'),
  html,fetchedAt:new Date().toISOString()};
}
async function inspectCandidate(input:{registrationNumber:string;senator:string;district2022:number}){
 const h=await getOfficialLiveViewer(input.registrationNumber);
 const parsed=inspectCurrentOfficialCfbCandidateHeading({
   registrationNumber:input.registrationNumber,html:h.html,observedAt:h.fetchedAt});
 const surname=input.senator.trim().split(/\s+/).at(-1)!;
 const humanPage=h.html.replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ')
  .replace(/\s+/g,' ');
 const targetReg=new RegExp('Senate Committee\\s*-\\s*'+input.registrationNumber+'\\s*\\(Terminated\\)','i');
 if(!parsed.officeIsSenateFromHeading||!parsed.exactRegistrationInHeading
  ||parsed.latestVisibleStatus!=='terminated_as_of_current_viewer'
  ||!new RegExp('\\b'+surname+'\\b','i').test(humanPage)||!targetReg.test(humanPage))
  throw Error('Original target current candidate status heading failed exact Senate/reg/person check');
 const index=await fetchCfbCandidateHistoricalReportReferenceSnapshot(input.registrationNumber,2026);
 if(index.registrationNumber!==input.registrationNumber||index.segmentEndYear!==2026)
  throw Error('Source reports-tab API returned incorrect target committee or segment');
 const versions=index.references.filter(q=>q.registrationNumber===input.registrationNumber
   &&(q.year==='25'||q.year==='26')&&q.type==='pcc');
 const allVersionKeys=versions.map(r=>
  [input.registrationNumber,r.year,r.type,r.period,r.se,r.amendment].join(':'));
 // A complete source index is always retained; PDF probes are deliberately
 // bounded to 16 official refs per senator to avoid heavy regulator traffic.
 const candidates=versions.slice(0,16);
 const scans=[];
 for(const ref of candidates){
  const versionKey=[input.registrationNumber,ref.year,ref.type,ref.period,ref.se,ref.amendment].join(':');
  try{
   const report=await fetchCfbReportViewerText(ref,{
    method:'POST',referer:h.url,searchType:'Candidate'});
   const proof=inspectPossibleOriginalCfbTerminationReportText({
    reportText:report.text,registrationNumber:input.registrationNumber,
    expectedSurname:surname,versionKey,reportName:ref.reportName,
   });
   scans.push({
    versionKey,officialReportViewerUrl:cfbReportViewerUrl(ref),
    originalPdfSha256:report.contentSha256,originalPdfBytes:report.bytes,
    downloadedAtUTC:report.fetchedAt,
    reportName:ref.reportName,...proof,
    sourceResult:'authenticated_original_pdf_metadata' as const,
   });
  }catch(err){
   const message=err instanceof Error?err.message:String(err);
   scans.push({
    versionKey,officialReportViewerUrl:cfbReportViewerUrl(ref),
    sourceResult:'HOLD_no_authenticated_original_pdf' as const,
    reasonClass:/timeout|abort/i.test(message)?'timeout':
      /HTTP \d{3}/i.test(message)?'http_failure':'identity_or_source_not_authenticated',
    originalPdfSha256:null,originalPdfBytes:null,
   });
  }
 }
 const holds=scans.filter(x=>x.sourceResult.startsWith('HOLD'));
 return{
  registrationNumber:input.registrationNumber,senator:input.senator,
  authenticated2022SenateDistrict:input.district2022,
  current2026Page:{url:h.url,sha256:h.sha256,bytes:h.bytes,
   observedAtUTC:h.fetchedAt,headingExactSenateRegAndPersonVerified:true,
   labelledTerminatedOnCurrent2026Viewer:true,
   actualTerminationDateFromThisPage:null,
  },
  officialCandidate2026ReportsTab:{
   sourceUrl:index.sourceUrl,originalAPIURL:index.apiUrl,
   responseSHA256:index.responseSha256,observedAtUTC:index.fetchedAt,
   segment2025And2026VersionCount:versions.length,
   completeExact2025And2026VersionKeys:allVersionKeys,
   pdfOriginalVersionProbed:candidates.length,
   unprobedDueToBound:Math.max(0,versions.length-candidates.length),
  },
  originalReportScans:scans,
  originalPdfHolds:holds.length,
  actualVoluntaryOrAdministrativeTerminationDate:null,
  actualBoardAcceptanceOfTermination:null,
  historical2023RegisteredState:null,
  historical2024RegisteredState:null,
  legallyOwedYearEnd2023:null,
  legallyOwedYearEnd2024:null,
  original2023Or2024ExactReportVersionPublicBy:null,
 };
}

/** Original nightly *current* public CFB registration and recent termination
 * lists: historical status-change dates may be present, but the list alone
 * never proves a signed 2023/24 final PDF or voluntary/admin route. */
async function acquireCurrentOfficialRegistryTerminationSnapshots(){
 const app=CFB_ORIGIN+'/reports/current-lists/';
 const api=CFB_ORIGIN+'/reports/api/';
 const session=await fetch(app,{headers:{'user-agent':UA},signal:AbortSignal.timeout(40_000)});
 if(!session.ok||new URL(session.url).hostname!=='register.cfb.mn.gov')
  throw Error('Original official CFB current registration app session unavailable');
 const headers=session.headers as Headers & {getSetCookie?:()=>string[]};
 const cookies=(typeof headers.getSetCookie==='function'?headers.getSetCookie()
   :[session.headers.get('set-cookie')??''].filter(Boolean))
   .map(v=>v.split(';',1)[0]?.trim()).filter(Boolean).join('; ');
 await session.arrayBuffer();
 async function get(action:CfbCandidateRegistryListAction){
  const params=new URLSearchParams();
  params.set('action','grid_data');
  params.set('data[action]',action);
  params.set('data[type]','current-lists');
  params.set('data[params][0]','all');
  const res=await fetch(api,{method:'POST',redirect:'follow',headers:{
   'user-agent':UA,'content-type':'application/x-www-form-urlencoded; charset=UTF-8',
   referer:app,origin:CFB_ORIGIN,'x-requested-with':'XMLHttpRequest',...(cookies?{cookie:cookies}:{})
  },body:params.toString(),signal:AbortSignal.timeout(40_000)});
  if(!res.ok||res.url!==api)throw Error('Original CFB register source API failed identity or returned non-2xx');
  const bytes=new Uint8Array(await res.arrayBuffer());
  if(bytes.length<200||bytes.length>8_000_000)throw Error('Unexpected CFB current registration grid body size');
  const grid=parseCfbCandidateRegistryGrid(new TextDecoder().decode(bytes),action);
  if(grid.rejectedRowCount>0||grid.rawRowCount!==grid.rows.length)
   throw Error('Original current CFB candidate registration rows malformed/held');
  return{
   action,originalOfficialApiURL:api,originalResponseSHA256:createHash('sha256').update(bytes).digest('hex'),
   originalResponseBytes:bytes.length,sourceRetrievedAtUTC:new Date().toISOString(),
   originalTotalCandidateRows:grid.rows.length,
   allTargetRows:grid.rows.filter(row=>KEY_IDS.includes(row.registrationNumber as typeof KEY_IDS[number])),
   parsed:grid,
  };
 }
 const all=await get('all-registered-candidates');
 const recent=await get('recent-candidate-terminations');
 const classifications=classifyTwoSenatorsInPublicCfbCurrentLists(all.parsed.rows,recent.parsed.rows);
 return{
  originalCurrentRegisteredCandidates:{
   action:all.action,url:all.originalOfficialApiURL,
   fullBodySha256:all.originalResponseSHA256,originalBytes:all.originalResponseBytes,
   retrievedAtUTC:all.sourceRetrievedAtUTC,totalAllOfficeRows:all.originalTotalCandidateRows,
   selectedMatchedExactRegistrationOnly:all.allTargetRows,
  },
  originalRecentTerminatedCandidateList:{
   action:recent.action,url:recent.originalOfficialApiURL,
   fullBodySha256:recent.originalResponseSHA256,originalBytes:recent.originalResponseBytes,
   retrievedAtUTC:recent.sourceRetrievedAtUTC,totalAllOfficeRows:recent.originalTotalCandidateRows,
   selectedMatchedExactRegistrationOnly:recent.allTargetRows,
  },
  exactPreviouslyAuthenticatedSenators:classifications,
  notACompleteHistoricalTerminationArchive:true,
  notProofSignedTerminationForms:true,
 };
}

async function main(){
 const a=process.argv.slice(2);
 if(a.length!==2||a[0]!=='--output')throw Error('Only --output artifacts/<filename>.json supported');
 const path=resolve(a[1]!);
 if(!path.startsWith(resolve('artifacts')+sep)||!path.endsWith('.json'))
  throw Error('Output must be a new JSON metadata file within artifacts/');
 const psv=readFileSync(SOURCE71,'utf8');
 const targets=selectTwoTerminatedSenators(select22AuthenticSenatorRegistrationTargets(psv));
 if(targets.length!==2||targets.map(x=>x.registrationNumber).join(',')!==KEY_IDS.join(','))
  throw Error('Original 71-version authenticated senator committee source drift');
 const data=[];
 for(const target of targets)data.push(await inspectCandidate(target));
 const currentBoardRegistry=await acquireCurrentOfficialRegistryTerminationSnapshots();
 const output={
  schemaVersion:'original-cfb-2025-26-two-as-of-2026-terminated-committee-finance-evidence-probe-v1',
  issue:864,researchDate:'2026-10-11',
  immutableOriginal71Reference:{path:SOURCE71,
   gitBlobSha:'bfa1c1eff6a095a3a0d03aa49a34e1d929d6a388',
   originalVersions:71,servingSenators:22},
  twoOriginalGovernmentCurrentPagesAndFullOfficialReportsTabIndices:data,
  publicOfficialCurrentRegisteredAndRecentTerminatedOriginalBoardRegistry:currentBoardRegistry,
  limitations:{
   current2026TerminatedLabelNot2023Or2024Termination:true,
   reportContainingWordsTerminationNotLegalTerminationProof:true,
   finalReportFormCheckboxIfUnverifiableNeverProvesFinalFiling:true,
   noOriginalBoardCertifiedAdministrativeTerminationNoticeObserved:true,
   legalYearEndReportDuty2023or2024Unknown:true,
   exactHistoricalPublicByOfOriginal2023and2024VersionsProvenNew:0,
   missingPDFOrVersionNotEvidenceCommitteeFailedToFile:true,
  },
  safeguards:{rawCandidateHtmlOrReportPDFTextNotPersisted:true,
   donorNamesContactsContributionsAndTransactionRowsNotPersisted:true,
   noProductionWritesOrForecastModelTrainingServingScheduler2027:true,issue864Open:true},
 };
 mkdirSync(dirname(path),{recursive:true});
 writeFileSync(path,JSON.stringify(output,null,2)+'\n',{flag:'wx'});
 console.log('EXACT_2026_BOARD_RECENT_TERMINATION_RECORDS='+JSON.stringify(currentBoardRegistry.exactPreviouslyAuthenticatedSenators));
 console.log('TWO_CFB_COMMITTEE_ORIGINAL_INDEX_PROBE='+JSON.stringify(
  data.map(d=>({
   registration:d.registrationNumber,currentLabel:'terminated_2026_only',
   refs:d.officialCandidate2026ReportsTab.segment2025And2026VersionCount,
   versionKeys:d.officialCandidate2026ReportsTab.completeExact2025And2026VersionKeys,
   originalPDFs:d.originalReportScans.filter(s=>s.sourceResult==='authenticated_original_pdf_metadata').length,
   holds:d.originalPdfHolds,
   pdfShaAndReceiptOnly:d.originalReportScans.filter(s=>s.sourceResult==='authenticated_original_pdf_metadata').map(s=>({
    versionKey:s.versionKey,sha256:(s as {originalPdfSha256?:string}).originalPdfSha256,
    bytes:(s as {originalPdfBytes?:number}).originalPdfBytes,
    boardReceipt:(s as {boardPrintedReceiptText?:string|null}).boardPrintedReceiptText??null,
   })),
   safeTerminationOrFinalKeywords:d.originalReportScans.filter(s=>
    s.sourceResult==='authenticated_original_pdf_metadata').map(s=>({
     versionKey:s.versionKey,sourceResult:s.sourceResult,
     potentialTerminationText:(s as {formMentionsTermination?:boolean}).formMentionsTermination??false,
     potentialFinalReportText:(s as {formMentionsFinal?:boolean}).formMentionsFinal??false,
    })),
   officialTerminationDateVerified:false,
  }))));
 if(data.some(d=>d.originalPdfHolds>0))process.exitCode=1;
}
main().catch(e=>{
 console.error('Original 2-committee CFB public finance source verification failed: '+
  (e instanceof Error?e.message:String(e)));
 process.exitCode=1;
});