import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  CFB_SENATE_SOURCE_VIEWER_CHECKPOINT_PATH,
  deriveCfb2021to24SenateViewerCohort,
} from '../evidence/cfb-2021-24-senate-viewer-report-counts.js';

const ROOT='docs/evaluation/source-proof/';
const CHECKPOINT=ROOT+'cfb-2021-24-senate-396-source-viewer-count-checkpoint.json';
const CURRENT=ROOT+'cfb-2026-public-current-senate-registration-dates.psv';
function p(){return JSON.parse(readFileSync(CHECKPOINT,'utf8')) as Record<string,any>;}
function original(){return JSON.parse(readFileSync(CFB_SENATE_SOURCE_VIEWER_CHECKPOINT_PATH,'utf8'));}
test('source data from 396 official CFB candidate tab requests remain pinned to two independently identical snapshots',()=>{
  const x=p();
  assert.equal(x.provenance.verifiedSourceWorkflowRunId,38088965276);
  assert.equal(x.provenance.verifiedSourceWorkflowHeadSha,'1bc271a9cbd55d393b8884afba5f2eece2fba333');
  assert.equal(x.provenance.verifiedSourcePrMergedSquashSha,'3bab03ea8107584e159cf9d76c7797b6ec26c921');
  assert.equal(x.provenance.officialSourceArtifactId,11683227803);
  assert.equal(x.provenance.artifactZipSha256IndependentlyRechecked,
    '5516f3863ae9e5122df923b2d0f7f1fc88b5a5af3ddcb6dba2d3160570844914');
  assert.equal(x.provenance.sourceArtifactJsonSha256IndependentlyRechecked,
    '933f9c55c71da049a4a9af21574f562676e8e930f0cb6be6883e50b5f8901da0');
  assert.equal(x.provenance.sourceArtifactJsonBytes,562731);
  assert.equal(x.provenance.initialAcquisitionRawJsonSha256,
    'e3052b357d1580508d1c7f452674ce480e619ee6302d952001dca836668c6337');
  assert.equal(x.provenance.initialAcquisitionArtifactId,11683905559);
  assert.equal(x.provenance.all396OriginalOfficialApiBodySha256ReobservedIdentically,true);
  assert.equal(x.provenance.all1382OriginalOfficialViewerDocumentIdentityKeysReobservedIdentically,true);
  assert.equal(x.provenance.sourceApiResponseHashesJoinedInSegmentYearThenRegLexOrderSha256,
    'be6d3bde4a606ecfb6182756095c3aac36bbd97df7bd6d706f3e32be58331eca');
  assert.equal(x.provenance.all1382ReportAndAncillaryDocumentIdsLexicographicNewlineSha256,
    '7e375ae8e240e69c74f4aae9e058aa57869f22815897a43750904d397d50954b');
  assert.equal(x.provenance.metadataOnly396SourceRowsCanonicalPsvSha256WithoutTrailingNewline,
    '6056ce0072adfc6711588fe8d2b4b09694a658e52a249631fbf4e92f65a2a4f9');
  assert.equal(x.provenance.metadataOnly396SourceRowsCanonicalPsvBytesWithoutTrailingNewline,49059);
});

test('scope derives exactly 275 unique registration IDs, 396 segment observations, and 792 filer-years',()=>{
  const x=p(), cohort=deriveCfb2021to24SenateViewerCohort(original());
  assert.equal(cohort.scopedDistinctRegistrationNumbers.length,275);
  assert.equal(cohort.targets.length,396);
  assert.equal(x.scope['2022SegmentRegistrationCount'],270);
  assert.equal(x.scope['2024SegmentRegistrationCount'],126);
  assert.equal(x.scope.distinctRegistrationNumbersInScope,275);
  assert.equal(x.scope.originalCandidateReportsTabApiCalls,396);
  assert.equal(x.scope.candidateYearPairsExamined,792);
  assert.equal(x.scope['2020OnlySourceRegistrationIdsNotProbed'],84);
  assert.equal(x.scope['2026OnlySourceRegistrationIdsNotProbed'],134);
  assert.equal(x.scope['2020And2026OnlySourceRegistrationIdsNotProbed'],1);
  assert.equal(x.observations.responsesAcquired,396);
  assert.equal(x.observations.sourceFailures,0);
  assert.equal(x.observations.sourcePayloadOrRegistrationIdentityFailures,0);
  assert.equal(x.observations.unreviewedSourceReportTypes,0);
  assert.equal(x.provenance.parentRegistrationIdsNewlineSha256,original().observedCandidateRegistrationIndex.registrationIdsNewlineSha256);
  assert.equal(x.provenance.parentRegistrationFourSegmentMaskHexSha256,original().observedCandidateRegistrationIndex.registrationMaskHexSha256);
});
test('941 scoped principal committee ORIGINAL viewer version keys never include 437 amendments or four affidavits',()=>{
  const x=p(), by=x.byReportYear as Array<Record<string,any>>;
  assert.deepEqual(by.map(r=>r.reportYear),[2021,2022,2023,2024]);
  assert.deepEqual(by.map(r=>r.pccOriginalVersionReferences),[165,524,118,134]);
  assert.deepEqual(by.map(r=>r.pccAmendmentVersionReferences),[70,247,51,69]);
  assert.deepEqual(by.map(r=>r.pccTotalReportVersionReferences),[235,771,169,203]);
  assert.deepEqual(by.map(r=>r.sourceScopedRegistrations),[270,270,126,126]);
  assert.deepEqual(by.map(r=>r.registrationsWithPccReportVersionReferences),[165,254,118,121]);
  assert.deepEqual(by.map(r=>r.registrationsWithoutYearSpecificPccReferences),[105,16,8,5]);
  for(const y of by){
    assert.equal(y.registrationsWithPccReportVersionReferences+
      y.registrationsWithoutYearSpecificPccReferences,y.sourceScopedRegistrations);
    assert.equal(y.pccOriginalVersionReferences+y.pccAmendmentVersionReferences,y.pccTotalReportVersionReferences);
    assert.equal(y.originalVersionByPeriod.YE+y.originalVersionByPeriod.C+y.originalVersionByPeriod.E,
      y.pccOriginalVersionReferences);
  }
  assert.deepEqual(by.map(r=>r.originalVersionByPeriod),[
    {YE:165,C:0,E:0},{YE:253,C:146,E:125},{YE:118,C:0,E:0},{YE:124,C:6,E:4},
  ]);
  assert.equal(by.reduce((n,r)=>n+r.pccOriginalVersionReferences,0),941);
  assert.equal(by.reduce((n,r)=>n+r.pccAmendmentVersionReferences,0),437);
  assert.equal(x.observations.principalCampaignCommitteeOriginalVersionReferencesAmendmentZero,941);
  assert.equal(x.observations.principalCampaignCommitteeAmendedVersionReferencesAmendmentPositive,437);
  assert.equal(x.observations.financialReportViewerReferencesTotal,1378);
  assert.equal(x.observations.excludedNonFinancialCandidateViewerAffidavitReferences,4);
  assert.equal(x.observations.allSourceDocumentVersionsIncludingAffidavits,1382);
  assert.deepEqual(x.observations.excludedAffidavitVersionIds,[
    '2442:22:aoc:C:0:0','2471:22:aoc:C:0:0','2491:22:aoc:C:0:0','2495:22:aoc:C:0:0',
  ]);
});
test('current 2026 registration list has only 109 of 275 old viewer IDs, proving neither older activity nor termination',()=>{
  const x=p(), originalViewer=original();
  const ix=originalViewer.observedCandidateRegistrationIndex;
  const ids:string[]=(ix.registrationIdsCsv as string).split(',');
  const datedIds=new Set<string>(readFileSync(CURRENT,'utf8').trim().split('\n').map(s=>s.split('|')[0] ?? ''));
  const cohort=deriveCfb2021to24SenateViewerCohort(originalViewer);
  const present=cohort.scopedDistinctRegistrationNumbers.filter(id=>datedIds.has(id)).length;
  const old=ids.filter((id,i)=>ix.segmentMembershipMaskHex[i]==='1');
  assert.equal(present,109);
  assert.equal(cohort.scopedDistinctRegistrationNumbers.length-present,166);
  assert.equal(old.length,84);
  assert.equal(old.filter(id=>datedIds.has(id)).length,1);
  assert.equal(x.currentRegistryCrosscheckAt2026Capture.outOf275HistoricalViewersAlsoCurrentlyListedWithRegistrationDate,109);
  assert.equal(x.currentRegistryCrosscheckAt2026Capture.outOf275HistoricalViewersAbsentFrom2026CurrentRegistrationList,166);
  assert.equal(x.currentRegistryCrosscheckAt2026Capture.outOf84_2020OnlyViewersAlsoPresentInCurrentRegistrationList,1);
  assert.equal(x.currentRegistryCrosscheckAt2026Capture.outOf84_2020OnlyViewersAbsentFrom2026CurrentRegistrationList,83);
  assert.equal(x.currentRegistryCrosscheckAt2026Capture.absenceFromPresentDayRegistryProvesHistoricalTermination,false);
  assert.equal(x.currentRegistryCrosscheckAt2026Capture.presentDayRegistrationDateProvesContinuousHistoricActiveStatus,false);
});
test('metadata references are never promoted into authenticated PDFs, legal count or historical public-by availability',()=>{
  const x=p(),b=x.sourceBounds,privacy=x.boundaries;
  assert.equal(b.viewerOriginalAmendmentZeroIsAuthenticatedPdf,false);
  assert.equal(b.sourceReportReferenceIsLegallyRequiredFiling,false);
  assert.equal(b.zeroReferencesProvesZeroFilings,false);
  assert.equal(b.sourceScopedViewerCountIsCompleteStatewideFilingCount,false);
  assert.equal(b.actualFiledOriginalPdfProofsNewlyVerifiedByThisCount,0);
  assert.equal(b.historicallyVerifiedPublicBy2021to24ReportCountFromThisAudit,0);
  assert.equal(b.statewide2021to2025RequiredSenateReportDenominator,null);
  assert.equal(b.statewide2021to2025ActuallyFiledOriginalSenateReportCount,null);
  assert.equal(b.historicallyDatedSenateCommitteeActiveYearCount,null);
  assert.equal(b.sourceToProductionDatabaseReconciliation,false);
  assert.equal(privacy.rawCfbResponseBodiesStoredInRepository,false);
  assert.equal(privacy.rawCandidateFinancePdfsOrTransactionsStoredInRepository,false);
  assert.equal(privacy.noProductionNeonOrVercelReadOrWrite,true);
  assert.equal(privacy.noModelRetrainingOrServingChange,true);
  assert.equal(privacy.noBackfillOrScheduler,true);
  assert.equal(privacy.issue864RemainsOpen,true);
});
