/**
 * #864 public source, one-shot PR-only: sixteen 2023/24 YE original CFB
 * PDFs from eight actual 2022-serving senators. Never store original PDF
 * bytes, extracted body text, donor/transaction rows, or non-serving names.
 *
 * node --import tsx scripts/capture-cfb-2023-24-eight-recovered-16-original-pdfs.ts
 * --output artifacts/cfb-2023-24-eight-16-original-pdf-sources.json
 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {fetchCfbCandidateHistoricalReportReferenceSnapshot}
  from '../../src/evidence/cfb-candidate-report-history.js';
import {fetchCfbReportViewerText}
  from '../../src/evidence/cfb-current-report-acquisition.js';
import {selectEightRecoveredSenators16OriginalYearends,
  EIGHT_NEW_2023_24_ORIGINALS_VERSION,classifyEightRecovered16OriginalSourceRuns}
  from '../evidence/cfb-2023-24-eight-recovered-16-yearend-originals.js';
import {
  auditServed2023to24OriginalYearEnd,summarize28YearEndSource,
} from '../../src/evidence/cfb-2023-24-served-28-yearend-originals.js';

const P='docs/evaluation/source-proof/';
function errClass(e:unknown){
  const v=e instanceof Error?e.message:String(e);
  return /timeout|abort/i.test(v)?'original_official_source_timeout'
    :/HTTP [45]\d\d/i.test(v)?'original_official_source_http_failure'
    :/sha|mismatch|changed|drift/i.test(v)?'original_source_identity_changed'
    :'original_official_pdf_or_viewer_identity_failure';
}
async function main(){
  const a=process.argv.slice(2);
  if(a.length!==2||a[0]!=='--output'||!a[1])
    throw Error('Only --output artifacts/<new-file>.json is permitted');
  const out=resolve(a[1]);
  if(!out.startsWith(resolve('artifacts')+sep)||!out.endsWith('.json'))
    throw Error('Only write new metadata JSON under artifacts');
  const files=[
    'cfb-2022-served-d13-24-original-ce-pdfs.psv',
    'cfb-2022-served-d25-36-original-ce-pdfs.psv',
    'cfb-2021-24-senate-396-original-viewer-source-observations.psv',
    'cfb-2024-eight-verified-senators-original-viewer-responses.psv',
    'cfb-2023-24-eight-more-senators-27-source-report-reference-targets.psv',
    'cfb-2024-eight-verified-senators-viewer-gap-source-checkpoint.json',
  ];
  const [firstCePsv,secondCePsv,previousViewerPsv,sourceSnapshotPsv,
    source27VersionPsv,sourceCheckpointJson]=files.map(n=>readFileSync(P+n,'utf8'));
  const targets=selectEightRecoveredSenators16OriginalYearends({
    firstCePsv,secondCePsv,previousViewerPsv,sourceSnapshotPsv,
    source27VersionPsv,sourceCheckpointJson});
  const regs=[...new Set(targets.map(x=>x.reg))];
  const sourceApiChecks:Array<{registrationNumber:string;previousApiSha256:string;
    recheckedApiSha256:string|null;officialUrl:string|null;retrievedAt:string|null;
    originalVersionIdsFound:number;sourceFailure:string|null}>=[];
  const fetched=new Map<string,{sourceUrl:string;sha256:string;bytes:number;observedAt:string;text:string}>();
  const fail=new Map<string,string>();
  let idx=0;
  async function worker(){
    while(idx<regs.length){
      const reg=regs[idx++]!,group=targets.filter(t=>t.reg===reg);
      const expectedSha=group[0]!.originalViewerApiSha256;
      let viewer:Awaited<ReturnType<typeof fetchCfbCandidateHistoricalReportReferenceSnapshot>>|null=null;
      try{
        viewer=await fetchCfbCandidateHistoricalReportReferenceSnapshot(reg,2024);
        if(viewer.responseSha256!==expectedSha
          ||viewer.sourceUrl!=='https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/'+reg+'/2024/')
          throw Error('Original CFB viewer API response SHA/source URL mismatch');
        const pairs=group.map(target=>{
          const matches=viewer!.references.filter(r=>r.registrationNumber===reg
            &&r.year===String(target.reportYear).slice(2)&&r.type==='pcc'
            &&r.period==='YE'&&r.se==='0'&&r.amendment===0);
          if(matches.length!==1)throw Error('Exact CFB original YE version key not uniquely reobserved');
          return {target,reference:matches[0]!};
        });
        sourceApiChecks.push({registrationNumber:reg,previousApiSha256:expectedSha,
          recheckedApiSha256:viewer.responseSha256,officialUrl:viewer.sourceUrl,
          retrievedAt:viewer.fetchedAt,originalVersionIdsFound:pairs.length,
          sourceFailure:null});
        for(const {target,reference} of pairs){
          try{
            const p=await fetchCfbReportViewerText(reference,
              {method:'POST',referer:viewer.sourceUrl,searchType:'Candidate'});
            fetched.set(target.id,{sourceUrl:p.sourceUrl,sha256:p.contentSha256,
              bytes:p.bytes,observedAt:p.fetchedAt,text:p.text});
          }catch(e){fail.set(target.id,errClass(e));}
        }
      }catch(e){
        const f=errClass(e);
        sourceApiChecks.push({registrationNumber:reg,previousApiSha256:expectedSha,
          recheckedApiSha256:viewer?.responseSha256??null,
          officialUrl:viewer?.sourceUrl??null,retrievedAt:viewer?.fetchedAt??null,
          originalVersionIdsFound:0,sourceFailure:f});
        for(const t of group)fail.set(t.id,f);
      }
      await new Promise(ok=>setTimeout(ok,150));
    }
  }
  await Promise.all([worker(),worker()]);
  const reports=targets.map(t=>auditServed2023to24OriginalYearEnd(t,
    fetched.get(t.id)??null,fail.get(t.id)??null));
  const checked=summarize28YearEndSource(reports);
  const authenticated=reports.filter(x=>x.status==='original_pdf_first_page_authenticated');
  const officialClassification=classifyEightRecovered16OriginalSourceRuns(reports);
  const distinctHashes=new Set(authenticated.map(x=>x.sourcePdfSha256!));
  const result={
    schemaVersion:EIGHT_NEW_2023_24_ORIGINALS_VERSION,
    observedAt:new Date().toISOString(),
    scope:{issueNumber:864,financeOnly:true,earlierActually2022ServingSenators:8,
      historicalReportYears:[2023,2024],originalsExpected:16,
      original2023YearEndRefs:8,original2024YearEndRefs:8,
      realServiceIn2023Or2024NotIndependentlyReestablished:true,
      statutoryFilingDutyDenominator:null},
    independentlyPinnedOriginalInputs:{paths:files.map(n=>P+n),
      originalCFBViewerSegment:2024,reportPdfSources:'cfb.mn.gov/rptViewer/Main.php'},
    original2024ViewerRechecks:sourceApiChecks.sort((a,b)=>a.registrationNumber.localeCompare(b.registrationNumber)),
    sourcePdfReports:reports,
    outcome:{expectedSourceReferences:16,officialPdfBinariesFetched:fetched.size,
      sourceAccountingWithReviewedStrictHold:officialClassification,
      authenticatedFirstPagePdfReferences:authenticated.length,
      uniqueAuthenticatedPdfBinaries:distinctHashes.size,
      duplicateOriginalBinaryHashes:checked.unexpectedOriginalBinaryDuplicates,
      sourceIdentityHolds:checked.identityOrSourceHolds,
      exactEightMemberViewerSourceRechecks:sourceApiChecks.filter(r=>r.originalVersionIdsFound===2).length,
      all16SourceOriginalsIndependentlyAuthenticated:reports.length===16&&
        authenticated.length===16&&distinctHashes.size===16&&fetched.size===16&&
        sourceApiChecks.filter(r=>r.originalVersionIdsFound===2).length===8,
      independentLegalCalendarFor2023And2024Verified:false,
      actualHistoricalPublicByProvenCount:0},
    safeguards:{fullOriginalPdfBodiesOrTextCommitted:false,donorOrPaymentRows:false,
      candidateNamesWithoutActual2022SenateService:false,productionDbReadOrWrite:false,
      legalReportDutyAsserted:false,modelForecastServingSchedulerOr2027Touched:false,
      issue864MustRemainOpen:true},
  };
  mkdirSync(dirname(out),{recursive:true});
  writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({issue:864,...result.outcome,output:out,productionWrites:false},null,2));
  if(!officialClassification.acceptedFifteenOriginalsOneStrictSourceIdentityHold
    ||fetched.size!==16||sourceApiChecks.filter(r=>r.originalVersionIdsFound===2).length!==8)
    process.exitCode=1;
}
main().catch(e=>{console.error(errClass(e));process.exitCode=1;});
