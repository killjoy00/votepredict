/**
 * #864 / finance Track A. One-shot read-only official CFB acquisition:
 * thirty 2021-22 amended report VERSION PDFs for eleven confirmed
 * serving Minnesota senators; earlier forty original PDFs are source-
 * authenticated and pinned separately. No reports, donors or text persisted.
 *
 * node --import tsx scripts/capture-cfb-2021-22-served-sd25-36-30-amendments.ts
 *   --output artifacts/cfb-2021-22-served-sd25-36-30-amended-report-source.json
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {fetchCfbCandidateHistoricalReportReferenceSnapshot}
  from '../src/evidence/cfb-candidate-report-history.js';
import {fetchCfbReportViewerText}
  from '../src/evidence/cfb-current-report-acquisition.js';
import {
  SD25_36_30_AMENDMENT_SOURCE_VERSION,
  selectServedSd25to36AmendmentVersions,
  auditActualSenatorAmendmentPdf,checkAuthenticatedAmendmentChains,
  classifySd25to36AmendmentReferences,
  verifyServedSd25to36AmendmentSourceOutcome,
  type CfbHistoricalAmendedPdfSource,
} from '../src/evidence/cfb-2021-22-served-sd25-36-30-amendments.js';

const ROOT='docs/evaluation/source-proof/';
const CE=ROOT+'cfb-2022-served-d25-36-original-ce-pdfs.psv';
const YE=ROOT+'cfb-2021-22-served-d25-36-18-original-yearend-pdfs.psv';
const VIEWER=ROOT+'cfb-2021-24-senate-396-original-viewer-source-observations.psv';
const CE_CKPT=ROOT+'cfb-2022-served-d25-36-original-ce-source-checkpoint.json';
const YE_CKPT=ROOT+'cfb-2021-22-served-d25-36-18-original-yearend-source-checkpoint.json';
function errorKind(e:unknown):string{
  const s=e instanceof Error?e.message:String(e);
  return /timeout|abort/i.test(s)?'official_source_http_timeout':
    /HTTP (429|50[0-9]|52[0-9])/i.test(s)?'official_source_temporary_failure':
    /HTTP [45]\d\d/i.test(s)?'official_source_http_failure':
    /sha|mismatch|drift/i.test(s)?'official_source_identity_changed':
    /pdf|text|parse/i.test(s)?'original_pdf_text_or_source_failure':
    'official_source_or_reference_validation_failure';
}
async function main(){
  const args=process.argv.slice(2);
  if(args.length!==2||args[0]!=='--output'||!args[1])
    throw Error('Only --output artifacts/<filename>.json is permitted');
  const output=resolve(args[1]);
  if(!output.startsWith(resolve('artifacts')+sep)||!output.endsWith('.json'))
    throw Error('Only a new metadata JSON under artifacts is permitted');
  const ceCheckpoint=JSON.parse(readFileSync(CE_CKPT,'utf8'));
  const yeCheckpoint=JSON.parse(readFileSync(YE_CKPT,'utf8'));
  const picked=selectServedSd25to36AmendmentVersions({
    originalCePsv:readFileSync(CE,'utf8'),
    originalYePsv:readFileSync(YE,'utf8'),
    originalViewerPsv:readFileSync(VIEWER,'utf8'),
    ceCheckpoint,yeCheckpoint,
  });
  if(ceCheckpoint.pinnedOfficialSources.independentCfb2022Calendar.sha256!==
     yeCheckpoint.independentlyObservedOriginalSources.cfb2022Calendar.sha256
    ||yeCheckpoint.independentlyObservedOriginalSources.cfb2022Calendar.sha256!==
      '3fd6263844d5063156d68d871bd2c575a5b5cef415a61b6125c068491f6b2b25'
    ||yeCheckpoint.population.independentlyVerifiedHistoricalPublicByCount!==0)
    throw Error('Prior original independent CFB 2022 calendar or historical eligibility source changed');
  const regs=[...new Set(picked.targets.map(t=>t.registrationNumber))];
  const viewerRechecks:Array<{registrationNumber:string;
    originalApiBodySha256:string;currentApiBodySha256:string|null;
    apiUrl:string|null;observedAt:string|null;
    expectedAmendmentKeys:number;exactVersionKeysReconfirmed:number;
    errorKind:string|null}>=[];
  const rawPdfs=new Map<string,CfbHistoricalAmendedPdfSource>();
  const failures=new Map<string,string>();
  let next=0;
  async function worker(){
    while(next<regs.length){
      const reg=regs[next++]!;
      const group=picked.targets.filter(t=>t.registrationNumber===reg);
      const expected=group[0]!.originalReportsViewerBodySha256;
      let snap:Awaited<ReturnType<typeof fetchCfbCandidateHistoricalReportReferenceSnapshot>>|undefined;
      try{
        snap=await fetchCfbCandidateHistoricalReportReferenceSnapshot(reg,2022);
        if(snap.responseSha256!==expected||snap.sourceUrl!==
          'https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/'+reg+'/2022/')
          throw Error('Original CFB reports-tab response SHA or URL mismatch');
        const refs=group.map(target=>{
          const found=snap!.references.filter(r=>r.registrationNumber===target.registrationNumber
            &&r.year===String(target.year).slice(2)&&r.type==='pcc'
            &&r.period===target.period&&r.se==='0'
            &&r.amendment===target.amendmentIndex);
          if(found.length!==1)throw Error('Exact official amendment version key not uniquely present');
          return {target,ref:found[0]!};
        });
        viewerRechecks.push({registrationNumber:reg,originalApiBodySha256:expected,
          currentApiBodySha256:snap.responseSha256,apiUrl:snap.sourceUrl,
          observedAt:snap.fetchedAt,expectedAmendmentKeys:group.length,
          exactVersionKeysReconfirmed:refs.length,errorKind:null});
        for(const {target,ref} of refs){
          try{
            const acquired=await fetchCfbReportViewerText(ref,{
              method:'POST',referer:snap.sourceUrl,searchType:'Candidate'});
            rawPdfs.set(target.id,{sourceUrl:acquired.sourceUrl,
              sha256:acquired.contentSha256,bytes:acquired.bytes,
              observedAt:acquired.fetchedAt,text:acquired.text});
          }catch(e){failures.set(target.id,errorKind(e));}
        }
      }catch(e){
        const error=errorKind(e);
        viewerRechecks.push({registrationNumber:reg,originalApiBodySha256:expected,
          currentApiBodySha256:snap?.responseSha256??null,
          apiUrl:snap?.sourceUrl??null,observedAt:snap?.fetchedAt??null,
          expectedAmendmentKeys:group.length,exactVersionKeysReconfirmed:0,errorKind:error});
        for(const t of group)failures.set(t.id,error);
      }
      await new Promise(done=>setTimeout(done,140));
    }
  }
  await Promise.all([worker(),worker()]);
  const reports=classifySd25to36AmendmentReferences(picked.targets.map(t=>
    auditActualSenatorAmendmentPdf(t,rawPdfs.get(t.id)??null,failures.get(t.id)??null)));
  const chain=checkAuthenticatedAmendmentChains(reports);
  const quality=verifyServedSd25to36AmendmentSourceOutcome(reports);
  const authenticated=reports.filter(r=>r.status==='amendment_pdf_and_original_identity_authenticated');
  const distinct=reports.filter(r=>r.referenceClassification==='distinct_authenticated_amended_pdf');
  const aliases=reports.filter(r=>r.referenceClassification===
    'official_amendment_version_reference_alias_of_identical_pdf');
  const checkpoint={
    schemaVersion:SD25_36_30_AMENDMENT_SOURCE_VERSION,
    observedAt:new Date().toISOString(),
    scope:{issueNumber:864,track:'finance_original_amendment_pdf_source',
      actualSenatorsWithOfficialLRLService:11,
      source2022CFBViewerRegistrations:regs.length,
      originalPdfParentIdentitiesAlreadyIndependentlyAuthenticated:40,
      newAmendmentVersionReferences:30,
      source2021YearEndAmendmentReferences:3,
      source2022YearEndAmendmentReferences:13,
      source2022PrePrimaryAmendmentReferences:7,
      source2022PreGeneralAmendmentReferences:7,
      originalParentPdfBodiesNotRedownloaded:true,
      statutoryFilingObligationDenominator:null},
    immutableOriginalSourceProofs:{
      originalCfbViewerProofPath:VIEWER,
      originalCfbCeProofPath:CE,
      originalCfbYearendProofPath:YE,
      sourceCeCheckpointPath:CE_CKPT,
      sourceYeCheckpointPath:YE_CKPT,
      original2022SosGeneralHash:yeCheckpoint.independentlyObservedOriginalSources.sos.sha256,
      originalLRLSenatorServiceHash:yeCheckpoint.independentlyObservedOriginalSources.lrl.sha256,
      originalOfficialCalendarHash:yeCheckpoint.independentlyObservedOriginalSources.cfb2022Calendar.sha256,
    },
    cfbCandidateViewerOriginalApiResponseRechecks:
      viewerRechecks.sort((a,b)=>a.registrationNumber.localeCompare(b.registrationNumber)),
    reports,
    chainValidation:chain,
    sourceVerificationOutcome:quality,
    results:{
      sourceVersionReferencesSelected:picked.targets.length,
      originalAmendmentPdfBodiesRetrievedIntoMemoryOnly:rawPdfs.size,
      originalSourceDocumentsHeldForStrictPaperIdentity:quality.holds,
      firstPageCommitteeAndOriginalPeriodAndReceiptVerified:authenticated.length,
      uniqueAuthenticatedAmendedPdfBinaries:quality.distinctAmendmentPdfBinaries,
      distinctlyAuthenticatedAmendedPdfForms:distinct.length,
      officialAmendmentReferencesAliasingEarlierIdenticalPdf:aliases.length,
      completedAuthenticatedViewerReferenceChains:quality.fullOriginalToAmendmentChainsVerified,
      completedDistinctAuthenticRevisionChains:quality.fullDistinctBinaryRevisionChainsVerified,
      successes:distinct.length,holds:reports.length-authenticated.length,
      independentlyAuthenticatedHistoricalPublicByCount:0,
      statewideLegallyRequiredReports:null,
      historicalProductionDonationAndExpenditureRowReconciliationDone:false,
      finalAsOfForecastEligibilityGranted:false,
    },
    safeguards:{
      originalPdfBytesOrTextPersisted:false,donorAndPaymentInformationPersisted:false,
      namesOfCandidatesWithoutRealSenateServicePersisted:false,
      productionNeonReadOrWrite:false,sourceToLiveDatabaseIngestion:false,
      forecastOrModelOrSchedulerChanges:false,
      no2027Scope:true,keepIssue864Open:true,
    },
  };
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output,JSON.stringify(checkpoint,null,2)+'\n',{flag:'wx'});
  // Metadata-only stdout recovery path for the permanent follow-up ledger:
  // every row is an authenticated source reference, not any report body or donor.
  const sourceProofColumns=[
    'id','actualSenator','electionDistrict2022','originalReportPrintedSenateDistrict',
    'amendedPdfPrintedSenateDistrict','originalReportId','originalReportSha256',
    'originalViewerApiSha256','amendedPdfSha256','amendedPdfByteLength',
    'amendedPdfAcquiredAt','amendedCoverageStartOn','amendedCoverageEndOn',
    'amendedBoardReceivedOn','originalReportStatutoryDueOn',
    'conservativeAmendedVersionNotBeforeOn','referenceClassification',
    'aliasOfAmendmentVersionId',
  ] as const;
  console.log('CFB_SD25_36_30_SOURCE_PROOF_COLUMNS '+sourceProofColumns.join('|'));
  console.log('CFB_SD25_36_30_SOURCE_PROOF_BEGIN');
  for(const r of reports){
    console.log(sourceProofColumns.map(k=>String(r[k]??'')).join('|'));
  }
  console.log('CFB_SD25_36_30_SOURCE_PROOF_END');
  console.log(JSON.stringify({issue:864,selectedOriginalAmendmentVersions:30,
    actualSenators:11,originalParents:40,individualFirstPageChecks:authenticated.length,
    distinctAuthenticatedPdfBinaries:distinct.length,documentedReferenceAliases:aliases.length,
    held:reports.length-authenticated.length,chainValid:chain.valid,
    sourceVerificationOutcome:quality,
    holds:reports.filter(r=>r.status!=='amendment_pdf_and_original_identity_authenticated')
      .map(r=>({id:r.id,status:r.status,sourceError:r.sourceErrorKind})),
    documentedBinaryAliases:chain.documentedBinaryAliases,
    chainViolations:chain.violations,
    authenticatedHashes:authenticated.map(x=>({id:x.id,sha256:x.amendedPdfSha256,
      receivedOn:x.amendedBoardReceivedOn,classification:x.referenceClassification,
      aliasOf:x.aliasOfAmendmentVersionId})),
    output,productionChanges:false},null,2));
  if(!quality.complete||rawPdfs.size!==30||
    viewerRechecks.filter(v=>v.exactVersionKeysReconfirmed>0).length!==picked.registrationsWithAmendments)
    process.exitCode=1;
}
main().catch(e=>{console.error(errorKind(e));process.exitCode=1;});
