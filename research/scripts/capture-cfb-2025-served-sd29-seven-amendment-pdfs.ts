/**
 * Issue #864 finance only. One-shot PR-triggered retrieval of EXACTLY seven
 * source CFB amendment PDFs for independently verified SD29 serving senator.
 * Store metadata only, no report text, donors, vendors, amounts, or addresses.
 *
 * node --import tsx scripts/capture-cfb-2025-served-sd29-seven-amendment-pdfs.ts
 *   --output artifacts/cfb-2025-served-sd29-seven-amendment-source.json
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {fetchCfbCandidateHistoricalReportReferenceSnapshot}
  from '../../src/evidence/cfb-candidate-report-history.js';
import {fetchCfbReportViewerText}
  from '../../src/evidence/cfb-current-report-acquisition.js';
import {
  SD29_2025_SEVEN_AMENDMENTS_SCHEMA,SD29_2025_SOURCE_RESPONSE_SHA,
  selectSd29SevenAmendmentTargets,auditSd29Amendment,
  classifySd29AmendmentSequence,
} from '../../src/evidence/cfb-2025-served-sd29-seven-amendments.js';

const P='docs/evaluation/source-proof/';
const TARGET_QUEUE=P+'cfb-2021-25-served-senator-next-source-pdf-targets.psv';
const VIEWER=P+'cfb-2025-dated-senate-85-reference-versions.psv';
const C=P+'cfb-2025-senate-12-special-original-pdf-source-ledger.psv';
const SF=P+'cfb-2025-served-senators-2-special-cycle-final-original-pdf-ledger.psv';
const YE=P+'cfb-2025-two-served-senators-yearend-original-pdf-ledger.psv';
const FINAL_CK=P+'cfb-2025-served-senators-2-special-cycle-final-original-source-checkpoint.json';
function category(e:unknown){
  const str=e instanceof Error?e.message:String(e);
  return /timeout|abort/i.test(str)?'official_source_http_timeout'
    :/HTTP [45]\d\d/i.test(str)?'official_source_http_failure'
    :/drift|sha|mismatch/i.test(str)?'pinned_official_source_identity_mismatch'
    :'official_pdf_or_identity_validation_failed';
}
async function main(){
  const args=process.argv.slice(2);
  if(args.length!==2||args[0]!=='--output'||!args[1])
    throw Error('Only --output artifacts/<new-file>.json is allowed');
  const output=resolve(args[1]);
  if(!output.startsWith(resolve('artifacts')+sep)||!output.endsWith('.json'))
    throw Error('Only a new metadata JSON under artifacts may be written');
  const targets=selectSd29SevenAmendmentTargets({
    queuePsv:readFileSync(TARGET_QUEUE,'utf8'),
    viewerLedgerPsv:readFileSync(VIEWER,'utf8'),
    specialCePsv:readFileSync(C,'utf8'),
    specialFinalPsv:readFileSync(SF,'utf8'),
    ordinaryYePsv:readFileSync(YE,'utf8')});
  const service=JSON.parse(readFileSync(FINAL_CK,'utf8'));
  const sourceSenator=service.sourceOriginalReports?.find(
    (x:{registrationNumber:string})=>x.registrationNumber==='19229');
  if(!sourceSenator||sourceSenator.senator!=='Michael Holmstrom Jr'
    ||sourceSenator.district!==29
    ||!sourceSenator.independentHeaderRegistrationOfficePeriodReceivedVerified
    ||!service.sourceService?.senateServiceSha256)
    throw Error('Actual SD29 senator service and original CFB source identity not pinned');
  let snapshot:Awaited<ReturnType<typeof fetchCfbCandidateHistoricalReportReferenceSnapshot>>|null=null;
  let snapshotError:string|null=null;
  const failure=new Map<string,string>();
  const fetched=new Map<string,{sourceUrl:string;sha256:string;bytes:number;observedAt:string;text:string}>();
  try{
    snapshot=await fetchCfbCandidateHistoricalReportReferenceSnapshot('19229',2026);
    if(snapshot.responseSha256!==SD29_2025_SOURCE_RESPONSE_SHA
      ||snapshot.sourceUrl!=='https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/19229/2026/')
      throw Error('Previously permanently pinned official source reports-tab API response changed');
    const mapped=targets.map(t=>{
      const matches=snapshot!.references.filter(ref=>ref.registrationNumber==='19229'
        &&ref.year==='25'&&ref.type==='pcc'&&ref.period===t.period
        &&ref.se===t.se&&ref.amendment===t.index);
      if(matches.length!==1)throw Error('Official amendment PDF reference missing or duplicated');
      return {t,ref:matches[0]!};
    });
    for(const {t,ref} of mapped){
      try{
        const item=await fetchCfbReportViewerText(ref,{
          method:'POST',referer:snapshot.sourceUrl,searchType:'Candidate'});
        fetched.set(t.id,{sourceUrl:item.sourceUrl,sha256:item.contentSha256,
          bytes:item.bytes,observedAt:item.fetchedAt,text:item.text});
      }catch(e){failure.set(t.id,category(e));}
    }
  }catch(e){
    snapshotError=category(e);
    for(const t of targets)failure.set(t.id,snapshotError);
  }
  const reports=targets.map(t=>auditSd29Amendment(t,fetched.get(t.id)??null,
    failure.get(t.id)??null));
  const check=classifySd29AmendmentSequence(reports);
  const result={
    schemaVersion:SD29_2025_SEVEN_AMENDMENTS_SCHEMA,
    observedAt:new Date().toISOString(),
    scope:{issue:864,sourceType:'original_CFB_amended_version_pdf',
      actualServingSenator:'Michael Holmstrom Jr',electionDistrict:29,
      registrationNumber:'19229',originalRefsInPinnedViewer:7,
      independentlyAuthenticatedPdfParents:4,
      versionIndicesNotAssumedDistinctBinary:true,
      statewideFilingDenominator:null},
    preservedPriorOriginalSources:{officialViewerLedger:VIEWER,
      officialViewerSourceSha256:SD29_2025_SOURCE_RESPONSE_SHA,
      exactAcquisitionQueue:TARGET_QUEUE,verifiedSpecialCEParents:C,
      verifiedSpecialFinalParent:SF,verifiedOrdinaryYearEndParent:YE,
      priorActualServiceAndFinalSourceCheckpoint:FINAL_CK},
    originalViewerRecheck:{originalApiSha256:SD29_2025_SOURCE_RESPONSE_SHA,
      actualApiSha256:snapshot?.responseSha256??null,
      apiUrl:snapshot?.sourceUrl??null,fetchedAt:snapshot?.fetchedAt??null,
      exactAmendmentKeysPresent:snapshotError?0:7,
      sourceFailure:snapshotError},
    reports:reports.map(r=>r),
    outcome:check,
    originalPdfBodiesFetchedOnlyInWorkflowMemory:fetched.size,
    safeguards:{pdfBodyOrExtractedFullTextSaved:false,donorDataSaved:false,
      otherCandidateNamesSaved:false,productionNeonReadOrWrite:false,
      forecastingOrModelUpdated:false,statutoryDutyConclusions:false,
      verifiedHistoricalPublicByCount:0,eligibleForHistoricalAsOf:false,
      issue864RemainsOpen:true},
  };
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({issue:864,totalExpected:7,pdfBinariesFetched:fetched.size,
    authenticated:check.sourcePdfIdentityAuthenticated,
    distinctPdfBinaries:check.uniqueAuthenticatedPdfHashes,
    unexpectedAliases:check.unexpectedBinaryAliases,
    documentedOriginalParentAliases:check.documentedOriginalParentAliases,
    sourceHolds:check.sourceHolds,sourceFailure:snapshotError,
    output,productionWrites:0},null,2));
  if(!check.sourceAcquisitionAcceptedWithExactReviewedParentAlias||fetched.size!==7
    ||snapshotError)process.exitCode=1;
}
main().catch(e=>{console.error(category(e));process.exitCode=1;});
