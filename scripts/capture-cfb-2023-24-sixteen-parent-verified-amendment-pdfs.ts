/**
 * #864 one-shot finance source-only original CFB amendment PDF collection.
 * 16 historical 2023/24 official versions, 6 source-authenticated original
 * parents, 5 actual 2022 Senate-serving people. PR only. Metadata artifact.
 *
 * node --import tsx scripts/capture-cfb-2023-24-sixteen-parent-verified-amendment-pdfs.ts
 * --output artifacts/cfb-2023-24-sixteen-amendment-source.json
 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {fetchCfbCandidateHistoricalReportReferenceSnapshot}
  from '../src/evidence/cfb-candidate-report-history.js';
import {fetchCfbReportViewerText}
  from '../src/evidence/cfb-current-report-acquisition.js';
import {
  PARENT_VERIFIED_2023_24_16_AMENDMENTS_VERSION,
  selectSixteenParentAuthenticatedYeAmendments,
  auditAuthenticatedParentYeAmendment,auditSixteenAmendmentSourceSequence,
  classifySixteenReviewed2023to24AmendedSourceReferences,
} from '../src/evidence/cfb-2023-24-sixteen-parent-authenticated-amendments.js';

const P='docs/evaluation/source-proof/';
function kind(e:unknown){
  const msg=e instanceof Error?e.message:String(e);
  return /timeout|abort/i.test(msg)?'official_original_source_timeout'
    :/HTTP [45]\d\d/i.test(msg)?'official_original_source_http_failure'
    :/sha|mismatch|drift|changed/i.test(msg)?'pinned_source_identity_mismatch'
    :'official_cfb_report_reference_or_pdf_identity_failure';
}
async function main(){
  const args=process.argv.slice(2);
  if(args.length!==2||args[0]!=='--output'||!args[1])
    throw Error('Only --output artifacts/<new-json> is permitted');
  const out=resolve(args[1]);
  if(!out.startsWith(resolve('artifacts')+sep)||!out.endsWith('.json'))
    throw Error('Output must be new metadata-only JSON inside artifacts/');
  const ledgerFiles=[
    'cfb-2021-25-served-senator-next-source-pdf-targets.psv',
    'cfb-2023-24-verified-served-28-original-yearend-pdfs.psv',
    'cfb-2021-24-senate-396-original-viewer-source-observations.psv',
    'cfb-2023-24-verified-served-28-original-yearend-source-checkpoint.json',
  ];
  const [originalQueuePsv,authenticatedOriginal28Psv,sourceViewer396Psv,
    sourceOriginalCheckpointJson]=ledgerFiles.map(n=>readFileSync(P+n,'utf8'));
  const targets=selectSixteenParentAuthenticatedYeAmendments({
    originalQueuePsv,authenticatedOriginal28Psv,sourceViewer396Psv,
    sourceOriginalCheckpointJson});
  const regs=[...new Set(targets.map(t=>t.registrationNumber))];
  const sourceViewerRechecks:Array<{reg:string;expectedApiSha:string;observedApiSha:string|null;
    officialUrl:string|null;observedAt:string|null;exactAmendmentKeys:number;
    sourceErrorKind:string|null}>=[];
  const pdfs=new Map<string,{sourceUrl:string;sha256:string;bytes:number;observedAt:string;text:string}>();
  const failures=new Map<string,string>();
  let next=0;
  async function worker(){
    while(next<regs.length){
      const reg=regs[next++]!;
      const group=targets.filter(t=>t.registrationNumber===reg);
      const expectedApi=group[0]!.viewerApiSha256;
      let snap:Awaited<ReturnType<typeof fetchCfbCandidateHistoricalReportReferenceSnapshot>>|null=null;
      try{
        snap=await fetchCfbCandidateHistoricalReportReferenceSnapshot(reg,2024);
        if(snap.responseSha256!==expectedApi
          ||snap.sourceUrl!=='https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/'+reg+'/2024/')
          throw Error('Previously pinned original candidate viewer API SHA changed');
        const mapped=group.map(t=>{
          const found=snap!.references.filter(r=>r.registrationNumber===reg
            &&r.year===String(t.year).slice(2)&&r.type==='pcc'&&r.period==='YE'
            &&r.se==='0'&&r.amendment===t.amendmentIndex);
          if(found.length!==1)throw Error('Exact authentic CFB amendment version reference absent or duplicated');
          return{t,ref:found[0]!};
        });
        sourceViewerRechecks.push({reg,expectedApiSha:expectedApi,
          observedApiSha:snap.responseSha256,officialUrl:snap.sourceUrl,
          observedAt:snap.fetchedAt,exactAmendmentKeys:mapped.length,sourceErrorKind:null});
        for(const {t,ref} of mapped){
          try{
            const pdf=await fetchCfbReportViewerText(ref,{
              method:'POST',referer:snap.sourceUrl,searchType:'Candidate'});
            pdfs.set(t.id,{sourceUrl:pdf.sourceUrl,sha256:pdf.contentSha256,
              bytes:pdf.bytes,observedAt:pdf.fetchedAt,text:pdf.text});
          }catch(e){failures.set(t.id,kind(e));}
        }
      }catch(e){
        const err=kind(e);
        sourceViewerRechecks.push({reg,expectedApiSha:expectedApi,
          observedApiSha:snap?.responseSha256??null,
          officialUrl:snap?.sourceUrl??null,observedAt:snap?.fetchedAt??null,
          exactAmendmentKeys:0,sourceErrorKind:err});
        for(const t of group)failures.set(t.id,err);
      }
      await new Promise(done=>setTimeout(done,145));
    }
  }
  await Promise.all([worker(),worker()]);
  const reports=targets.map(t=>auditAuthenticatedParentYeAmendment(t,
    pdfs.get(t.id)??null,failures.get(t.id)??null));
  const assessed=auditSixteenAmendmentSourceSequence(reports);
  const reviewed=classifySixteenReviewed2023to24AmendedSourceReferences(reports);
  const result={
    schemaVersion:PARENT_VERIFIED_2023_24_16_AMENDMENTS_VERSION,
    observedAt:new Date().toISOString(),
    scope:{issueNumber:864,originalFinancesOnly:true,
      senatorsIndependentlyActuallyServingIn2022:5,originalReportsAlreadyPdfVerified:6,
      original2023AmendmentVersionIds:6,original2024AmendmentVersionIds:10,
      sourceCfbViewerSegment:2024,
      actual2023Or2024SenateServiceIndependentlyProvenHere:false,
      legallyRequiredReportCount:null},
    immutablePriorSourceProofs:{paths:ledgerFiles.map(n=>P+n),
      previousOriginalYearendAuthenticity:true},
    officialCfbViewerApiRechecks:sourceViewerRechecks.sort((a,b)=>a.reg.localeCompare(b.reg)),
    sourcePdfAmendmentVersions:reports,
    outcome:{...assessed,documentedReviewedSourceExceptions:reviewed,
      sourcePdfBinariesFetched:pdfs.size,
      originalViewerRegistrationsVerified:sourceViewerRechecks
        .filter(x=>x.exactAmendmentKeys>0).length,
      independentlyProvenActualHistoricalPublicBy:0},
    safeguards:{rawPdfBytesOrOriginalBodyTextPersisted:false,
      donorOrFinancialTransactionRowsPersisted:false,everServedProofMaintained:true,
      rawCfbApiResponsePersisted:false,statutoryDueUnverified:true,
      noLiveProductionDatabaseReadOrWrite:true,
      noHistoricalForecastEligibilityGranted:true,
      noModelServingSchedulerTrainingOr2027Work:true,issue864MustStayOpen:true},
  };
  mkdirSync(dirname(out),{recursive:true});
  writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({issue:864,sourcePdfBinariesFetched:pdfs.size,
    exactVersionRefs:assessed.exactOfficialAmendmentVersions,
    verified:assessed.independentlyAuthenticatedAmendmentPdfReferences,
    distinctHashes:assessed.distinctlyAuthenticatedAmendedPdfBinaries,
    duplicateVersionRefs:assessed.unexpectedDuplicateVersionPdfContent,
    sourceHolds:assessed.sourceHolds,output:out,
    productionChanges:false},null,2));
  if(!reviewed.sourceAccountingAcceptedWithOneExactIdentityHoldAndOneBinaryAlias
    ||pdfs.size!==16
    ||sourceViewerRechecks.filter(r=>r.exactAmendmentKeys>0).length!==5)
    process.exitCode=1;
}
main().catch(e=>{console.error(kind(e));process.exitCode=1;});
