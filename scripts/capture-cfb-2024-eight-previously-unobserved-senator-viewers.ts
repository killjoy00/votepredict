/**
 * #864 finance source-only discovery of eight REAL 2022 serving senators whose
 * CFB 2024-segment API responses were absent from a bounded earlier sample.
 * No document absence/no-filer inference; no PDF/donor/transaction persistence.
 *
 * node --import tsx scripts/capture-cfb-2024-eight-previously-unobserved-senator-viewers.ts
 *   --output artifacts/cfb-2024-eight-verified-senator-viewer-responses.json
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {fetchCfbCandidateHistoricalReportReferenceSnapshot}
  from '../src/evidence/cfb-candidate-report-history.js';
import {
  CFB_EIGHT_2024_VIEWER_DISCOVERY_VERSION,
  selectEightPreviouslyUnobservedActualSenators,
  auditPreviouslyUnobserved2024CfbViewer,
} from '../src/evidence/cfb-2024-eight-unobserved-verified-senator-viewers.js';
const P='docs/evaluation/source-proof/';
const TARGETS={firstCfbOriginalCePsv:readFileSync(P+'cfb-2022-served-d13-24-original-ce-pdfs.psv','utf8'),
  secondCfbOriginalCePsv:readFileSync(P+'cfb-2022-served-d25-36-original-ce-pdfs.psv','utf8'),
  priorSampledViewerPsv:readFileSync(P+'cfb-2021-24-senate-396-original-viewer-source-observations.psv','utf8')};
function category(e:unknown):string{
  const s=e instanceof Error?e.message:String(e);
  return /timeout|abort/i.test(s)?'original_cfb_api_timeout'
    :/HTTP [45]\d\d/i.test(s)?'original_cfb_api_http_error'
    :'original_cfb_api_unexpected_response';
}
async function main(){
  const a=process.argv.slice(2);
  if(a.length!==2||a[0]!=='--output'||!a[1])
    throw Error('Only --output artifacts/<name>.json supported');
  const out=resolve(a[1]);
  if(!out.startsWith(resolve('artifacts')+sep)||!out.endsWith('.json'))
    throw Error('Only new source metadata JSON artifact is permitted');
  const targets=selectEightPreviouslyUnobservedActualSenators(TARGETS);
  const observations:ReturnType<typeof auditPreviouslyUnobserved2024CfbViewer>[]=[];
  let next=0;
  async function worker(){
    while(next<targets.length){
      const t=targets[next++]!;
      try{
        const snapshot=await fetchCfbCandidateHistoricalReportReferenceSnapshot(t.reg,2024);
        observations.push(auditPreviouslyUnobserved2024CfbViewer(t,snapshot));
      }catch(e){
        observations.push(auditPreviouslyUnobserved2024CfbViewer(t,null,category(e)));
      }
      await new Promise(done=>setTimeout(done,140));
    }
  }
  await Promise.all([worker(),worker(),worker()]);
  observations.sort((a,b)=>a.elected2022SenateDistrict-b.elected2022SenateDistrict);
  const complete=observations.length===8&&new Set(observations.map(r=>r.officialCfbRegistration)).size===8
    &&observations.every(r=>r.status==='original_source_viewer_references_discovered'
      ||r.status==='official_viewer_response_received_with_no_2023_24_pcc_report_refs');
  const results={
    verifiedOfficialViewerSnapshots:observations.filter(r=>r.currentViewerResponseSha256).length,
    discoveredNewOriginalVersionReferences:observations.reduce((a,r)=>
      a+(r.observed2023OriginalRefs??0)+(r.observed2024OriginalRefs??0),0),
    discoveredNewAmendmentVersionReferences:observations.reduce((a,r)=>
      a+(r.observed2023AmendedRefs??0)+(r.observed2024AmendedRefs??0),0),
    discoveredDistinctReportReferenceIds:observations.flatMap(r=>r.originalCfbViewerReportVersionIds).length,
    successfulSourceDiscovery:complete,
    sourceFailuresOrHolds:observations.filter(r=>r.status!=='original_source_viewer_references_discovered'
      &&r.status!=='official_viewer_response_received_with_no_2023_24_pcc_report_refs')
      .map(r=>({reg:r.officialCfbRegistration,sourceStatus:r.status})),
    legallyOwedReports:null,reportPdfBinariesAcquired:0,
  };
  const payload={schemaVersion:CFB_EIGHT_2024_VIEWER_DISCOVERY_VERSION,
    observedAt:new Date().toISOString(),
    researchScope:{issue:864,financeOnly:true,verified2022ActualSenators:8,
      priorCFB2024ViewerSampleHadNoTheseEightResponses:true,
      official2024CandidateViewerSnapshotsAttempted:8,
      missingPreviouslySampledResponseIsNotNonfiling:true},
    originalSourceAnchors:{
      olderUnmodified396ViewerPsv:'docs/evaluation/source-proof/cfb-2021-24-senate-396-original-viewer-source-observations.psv',
      pinnedPreviousAuthenticated2022SenatorCeLedgers:[
        'docs/evaluation/source-proof/cfb-2022-served-d13-24-original-ce-pdfs.psv',
        'docs/evaluation/source-proof/cfb-2022-served-d25-36-original-ce-pdfs.psv']},
    observations,results,
    safeguards:{sourceResponseMetadataOnly:true,rawApiResponseNotSaved:true,
      noCandidateNeverServedNames:true,noneOfTheseReportRefsAreAuthenticatedPdfBinaries:true,
      noNoFilerClaims:true,statutoryRequiredDutyUnknown:true,historicPublicByUnknown:true,
      noProductionDatabaseReadsOrWrites:true,noForecastModelSchedulerChanges:true,
      no2027Scope:true,issue864MustRemainOpen:true},
  };
  mkdirSync(dirname(out),{recursive:true});
  writeFileSync(out,JSON.stringify(payload,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({issue:864,...results,
    verifiedActualSenatorNamesOnly:observations.map(x=>x.independentlyVerified2022ActualSenator),
    output:out,productionChanges:false},null,2));
  if(!complete)process.exitCode=1;
}
main().catch(e=>{console.error(category(e));process.exitCode=1;});
