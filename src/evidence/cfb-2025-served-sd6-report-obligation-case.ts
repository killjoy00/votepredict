/**
 * #864 finance Track B: ONE ever-served Minnesota senator, ONE dated 2025
 * CFB committee, original vs amendment lineage. This is a source-confirmed
 * filing ledger, NOT a claim that four filings were legally required.
 *
 * Legally owed counts stay null until 2025-effective registration, primary
 * applicability, termination and reporting-exemption predicates are proven.
 */
import {cfbElectronicReportAvailableOn} from './cfb-report-availability.js';
import {
  validateActualSenateServiceForElection,
  type AuditedOfficialSenateDirectory,
} from './senate-official-ever-served-directory.js';
export const SENATE_SD6_2025_REPORT_OBLIGATION_CASE_VERSION=
  'cfb-2025-ever-served-senator-sd6-report-obligation-case-v1' as const;
export const SENATE_SD6_2025_PROOF_PATH=
  'docs/evaluation/source-proof/cfb-2025-senate-district6-report-pdfs.json' as const;
const HASH=/^[a-f0-9]{64}$/;
const SOURCE_PROOF_REGISTRATION='19205';
type Expected={
  id:string;originalSha:string;dueOn:string;
  originalVersion:boolean;amendmentOf?:string;
};
const EXPECTED:readonly Expected[]=[
  {id:'19205:25:pcc:C:1:0',originalSha:'db3db4cb38251b6f75a345af059e64f39cfabb87e021dbba2ab7bca4526477ff',dueOn:'2025-04-08',originalVersion:true},
  {id:'19205:25:pcc:E:1:0',originalSha:'52027e46e25edcf3eb54f117413f62fd2f9638fdd15b50196a9353436f6b3eeb',dueOn:'2025-04-22',originalVersion:true},
  {id:'19205:25:pcc:YE:1:0',originalSha:'85e1a40c39f4a23b8173bf567868f323ee331f2fb895fb1608625a0d5b253049',dueOn:'2025-05-27',originalVersion:true},
  {id:'19205:25:pcc:YE:0:0',originalSha:'5f8f4aa06134f5659f1ef6be1eec4f8931e5724b4e52d3411895fe7471256af3',dueOn:'2026-02-02',originalVersion:true},
  {id:'19205:25:pcc:YE:0:1',originalSha:'1d6ac6b2d30d066480f522d667921200562e95940da469a5ea4d5114242f3d86',dueOn:'2026-02-02',
    originalVersion:false,amendmentOf:'19205:25:pcc:YE:0:0'},
];
const dates=new Set(EXPECTED.map(x=>x.dueOn));
type RecordLike={ [key:string]:unknown };
function obj(value:unknown):RecordLike{
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid original CFB metadata object');
  return value as RecordLike;
}
function date(s:unknown):string{
  if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s)
    ||new Date(s+'T00:00:00Z').toISOString().slice(0,10)!==s)
    throw Error('Invalid independently recorded original date');
  return s;
}
export function reconcileServedSenatorSd6ReportCase(
  official:AuditedOfficialSenateDirectory,originalProof:unknown,
){
  const service=validateActualSenateServiceForElection(official,'Keri Heintzeman','6',2025);
  if(service.status!=='verified_senate_service'
    ||!service.officialName||!service.officialServiceSource
    ||!official.supplementalSwearingSource?.swearingDateIndependentlyDocumentedForNamedSpecialMembers)
    throw Error('Original official Senate service and 2025 special oath not established');
  const proof=obj(originalProof),scope=obj(proof.scope),recorded=obj(proof.recordedFrom),
    calendars=obj(proof.officialCalendars);
  if(proof.schemaVersion!=='cfb-sd6-2025-official-pdf-provenance-v1'
    ||scope.registrationNumber!==SOURCE_PROOF_REGISTRATION
    ||scope.reportYear!==2025
    ||recorded.actionRun!==37997701770||recorded.actionArtifactId!==11647469147
    ||recorded.capturedDate!=='2026-10-09'
    ||!Array.isArray(proof.reports)||proof.reports.length!==5
    ||!(calendars.special&&calendars.general))
    throw Error('CFB SD6 independently source-acquired report metadata changed');
  for(const [name,calendar] of Object.entries(calendars)){
    const c=obj(calendar);
    if(c.scopeAndDateMarkersVerified!==true||c.manualDateToReportTableAssociationReviewed!==true
      ||!HASH.test(String(c.pdfSha256??''))
      ||!Number.isInteger(c.bytes)||Number(c.bytes)<500
      ||!String(c.url??'').startsWith('https://cfb.mn.gov/pdf/'))
      throw Error('Unauthenticated '+name+' year-specific original disclosure calendar');
  }
  const rows=(proof.reports as unknown[]).map(obj);
  const names=rows.map(row=>String(row.reportId));
  if(new Set(names).size!==5||names.some(n=>!EXPECTED.some(x=>x.id===n)))
    throw Error('Expected exactly five original+amendment source-version identities');
  const verified=EXPECTED.map(e=>{
    const row=rows.find(r=>r.reportId===e.id);
    if(!row)throw Error('Missing original CFB viewer version '+e.id);
    const filed=date(row.officialReceivedOn),
      due=date(row.statutoryDueOnFromCaseSpecificCalendar),
      start=date(row.reportCoverageStartOn),end=date(row.reportCoverageEndOn),
      observedAt=String(row.sourceFetchedAt);
    if(row.sourcePdfSha256!==e.originalSha||!HASH.test(e.originalSha)
      ||row.officialReportHeaderIdentityVerified!==true
      ||row.amendmentIndexFromViewer!==(e.originalVersion?0:1)
      ||row.originalPdfAmendmentCheckboxIndependentlyVerified!==false
      ||row.historicallyPublicByOn!==null||row.historicalAsOfEligible!==false
      ||row.exactRowContainmentVerified!==false
      ||due!==e.dueOn||!dates.has(due)
      ||!(typeof row.sourcePdfBytes==='number')||row.sourcePdfBytes<300
      ||!Number.isFinite(Date.parse(observedAt))
      ||!String(row.sourceUrl).startsWith('https://cfb.mn.gov/rptViewer/Main.php?')
      ||end<start||filed<end
      ||row.conservativeLegalAndFilingBoundOn!==cfbElectronicReportAvailableOn(filed,due))
      throw Error('Original report source date/hash/legal floor or lineage tampered');
    if(e.originalVersion&&row.amendedVersionNotSeparateRequiredReport!==false)
      throw Error('Original version incorrectly classified as amendment');
    if(!e.originalVersion&&row.amendedVersionNotSeparateRequiredReport!==true)
      throw Error('An amendment was incorrectly counted as an additional report duty');
    return {
      reportVersionId:e.id,registrationNumber:SOURCE_PROOF_REGISTRATION,
      senateDistrict:6,reportYear:2025,
      reportType:e.id.includes(':C:')?'pre_special_primary':
        e.id.includes(':E:')?'pre_special_general':
        e.id.includes(':YE:1:')?'special_cycle_final':'annual_year_end',
      amendmentIndex:e.originalVersion?0:1,amendmentOf:e.amendmentOf??null,
      historicalObligationState:'unknown' as const,
      actualOriginalFilingEvidenceState:e.originalVersion
        ?'original_filing_verified' as const
        :'amendment_version_verified_not_an_additional_original' as const,
      historicalPublicByEvidenceState:'historical_public_by_unknown' as const,
      sourceReportPdfUrl:row.sourceUrl,sourceSha256:e.originalSha,
      sourcePdfBytes:row.sourcePdfBytes,
      sourceAcquiredAt:observedAt,
      coverageStartOn:start,coverageEndOn:end,
      boardReceivedOn:filed,independentlyVerifiedDueOn:due,
      earliestStatutoryAndReceiptBoundOn:cfbElectronicReportAvailableOn(filed,due),
      independentlyProvenHistoricalPublicBy:null,
      eligibleForHistoricalForecast:false,
    };
  });
  const originals=verified.filter(r=>r.amendmentIndex===0);
  const amendments=verified.filter(r=>r.amendmentIndex>0);
  if(originals.length!==4||amendments.length!==1
    ||amendments[0]!.amendmentOf!==originals.find(x=>x.reportType==='annual_year_end')?.reportVersionId)
    throw Error('Invalid original/amendment same-obligation collapse');
  const cycle=originals.find(x=>x.reportType==='special_cycle_final');
  const annual=originals.find(x=>x.reportType==='annual_year_end');
  if(cycle?.coverageEndOn!=='2025-05-14'
    ||annual?.coverageStartOn!=='2025-05-15'
    ||annual?.coverageEndOn!=='2025-12-31')
    throw Error('Original 2025 cycle/year-end coverage continuity changed');
  const review=obj(proof.periodReview);
  if(review.sourceSpecialCycleFinalCoveredThrough!=='2025-05-14'
    ||review.specialElectionCalendarLastTransactionDate!=='2025-05-20'
    ||review.reportCalendarPeriodMismatchNeedsReview!==true
    ||review.noUncoveredTransactionInferencePermitted!==true)
    throw Error('Held special-cycle coverage mismatch was silently cleared');
  return {
    schema:SENATE_SD6_2025_REPORT_OBLIGATION_CASE_VERSION,
    scope:{
      person:service.officialName,actualSenateServiceOfficiallyDocumented:true,
      senateServiceSourceUrl:service.officialServiceSource,
      senateServiceObservedAt:official.source.observedAt,
      office:'Minnesota Senate District 6',reportYear:2025,
      committeeRegistrationNumber:SOURCE_PROOF_REGISTRATION,
      originalCfbCasePath:SENATE_SD6_2025_PROOF_PATH,
      CfbProofAcquiredOn:recorded.capturedDate,
      statutory2025ReleaseRule:'Minnesota Statutes 2025 section 10A.20 subdivision 1b',
      statutoryCandidateAndSpecialCycleRule:'Minnesota Statutes 2025 section 10A.20 subdivision 2',
      terminationAndRegistrationDutyRule:'Minnesota Statutes 2025 section 10A.243',
    },
    sourceResults:{
      originalPdfVersionReferences:originals.length,
      originalReportPdfsAlreadyAuthenticated:originals.length,
      amendmentVersionReferences:amendments.length,
      distinctOriginalReportTypeGroups:originals.length,
      newlyAuthenticatedPdfCount:0,
      sourceFirstPageIdentityAndBoardReceiptVerified:originals.length,
      originalLegalDeadlineDatesVerified:originals.length,
      originalCalendarSourcesPreviouslyVerified:2,
      historicalPublicByVerified:0,
      reportPeriodsWithHeldCalendarMismatch:1,
    },
    committeeYearDuty:{
      historicInitialRegistrationEffectiveAt:null,
      historicTerminationEffectiveAt:null,
      primaryAndElectionFilingDutyPredicatesComplete:false,
      yearEndReportingExemptionProven:false,
      registeredAndLegallyActiveAtAllDueDatesProven:false,
      legallyRequiredReportCount:null,
      independentlyVerifiedNonfilerCount:null,
      legallyNotRequiredReportsVerified:null,
      earliestBoardReceiptProvesCommitteeWasFilingBy:'2025-04-08',
      originalRegistrationDateProvenBy2026CurrentRegistrySnapshot:false,
      completeRequiredReportDenominator:false,
    },
    originalReports:originals,
    amendments,
    heldCoverageConflict:{
      originalSpecialFinalEndOn:cycle.coverageEndOn,
      independentlyRecordedCalendarLastTransactionOn:'2025-05-20',
      documentMismatchRequiresFurtherOriginalSourceReview:true,
      backfillOrAsOfEligibilityBlocked:true,
    },
    safeguards:{
      notStatewideReportingDenominator:true,
      originalSourcePdfBodiesNotRepublished:true,
      noDonorsOrTransactionsStored:true,
      noPredictionEligibilityGranted:true,
      noProductionReadOrWrite:true,
      noModelRetraining:true,keepIssue864Open:true,
    },
  };
}
