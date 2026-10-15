/**
 * Issue #864 V45: independently replay the owner's narrowed review policy:
 * 4 original PDF receipt totals accepted from public CFB annual summaries,
 * 3 index-listed email attachments excluded from FINANCIAL amendment sums,
 * 2 handwritten Jason Isaacson 2022 versions retained without invented
 * receipts, and 5 inconsistent source dates reviewed using max(stamp,end).
 *
 * The original CFB 830-version/813-body ledger and all stamped values remain
 * unchanged. "Effective review date" is NOT historical first-public evidence
 * and must not be inserted into a time-travel prediction or forecast model.
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {verify14OriginalCFBReportFormAndDateSourceReviewsV43}
 from './audit-cfb-864-nine-PDF-five-date-original-source-v43.mjs';
import {verifyAll830SenateCFBPDFSourceVersionsV41}
 from './audit-cfb-864-830-full-pdf-source-v41.mjs';
import {audit388SourceReportSummariesAndAmendmentsV42}
 from './audit-cfb-864-388-report-content-and-dates-v42.mjs';

export const SCHEMA='cfb-864-four-accepted-three-email-two-unknown-five-later-review-dates-v45';
const FILE={
 ledger:'docs/evaluation/source-proof/cfb-2021-25-95-senators-830-indexed-830-downloaded-v41.psv',
 original:'docs/evaluation/source-proof/cfb-2021-25-nine-unverified-PDFs-five-printed-receipt-date-anomalies-v43.json',
 annual:'docs/evaluation/source-proof/cfb-2021-25-official-annual-financial-summary-double-source-v44.json',
 decision:'data/cfb-2021-25-nine-five-review-dispositions-v45.json'
};
const PIN={annual:'b8842ba8f0f1e067273397fe6640fc74c4d89ebc',
 decision:'0c9d1bcc8735cfd14940c1e543b0333cc0863b31'};
const AMOUNT=new Map([
 ['17140:21:pcc:YE:0:0',7655912],
 ['17140:22:pcc:YE:0:0',102500],
 ['17929:21:pcc:YE:0:0',583020],
 ['18004:21:pcc:YE:0:0',110000]
]);
const HANDWRITTEN=new Set(['17929:22:pcc:YE:0:0','17929:22:pcc:YE:0:1']);
const EMAILS=new Set(['18430:21:pcc:YE:0:1','18488:21:pcc:YE:0:1','18730:21:pcc:YE:0:1']);
const DATE_IDS=new Set([
 '16311:22:pcc:YE:0:0','16931:21:pcc:YE:0:0',
 '17347:22:pcc:YE:0:0','17994:23:pcc:YE:0:0','17362:25:pcc:YE:0:0'
]);
const SHA=/^[a-f0-9]{64}$/;
function gitBlob(raw){
 return createHash('sha1').update('blob '+Buffer.byteLength(raw)+'\0').update(raw).digest('hex');
}
function readSource(key){
 const raw=readFileSync(FILE[key],'utf8');
 if(!raw.endsWith('\n')||raw.includes('\r')||(PIN[key]&&gitBlob(raw)!==PIN[key]))
  throw Error('Pinned public CFB report-source review has changed: '+key);
 return raw;
}
export function auditNarrowOwnerReviewV45(){
 const v41=verifyAll830SenateCFBPDFSourceVersionsV41();
 const v42=audit388SourceReportSummariesAndAmendmentsV42();
 const v43=verify14OriginalCFBReportFormAndDateSourceReviewsV43();
 if(v41.completeOfficialGovernmentPDFVersionSources!==830
  ||v41.distinctWholeGovernmentPdfBodies!==813
  ||v42.verifiedOriginalGovernmentPdfSummaryReceiptTotals!==379
  ||v42.unresolvedSourceSummaryReportVersions!==9
  ||v43.remainingReportVersionsWithUnverifiedSummaryAmounts!==9
  ||v43.originalOfficialPDFPrintedDateFieldsInternallyContradictory!==5)
  throw Error('Original government source report proof drift before owner selection');
 const resolution=JSON.parse(readSource('decision'));
 const annual=JSON.parse(readSource('annual'));
 const prior=JSON.parse(readSource('original'));
 const old=readSource('ledger').trimEnd().split('\n').map(s=>s.split('|'));
 const byId=new Map(old.map(x=>[x[0],x]));
 const v43ById=new Map(prior.records.map(x=>[x.versionId,x]));
 const byReg=new Map(annual.reports.map(x=>[x.registration,x]));
 if(old.length!==830||byId.size!==830||prior.records.length!==14
  ||annual.schema!=='cfb-864-11-official-candidate-year-source-summary-double-retrieval-v44'
  ||annual.originalFinancialSummaryTabs!==11||annual.distinctCommitteeYearAggregates!==13
  ||annual.arithmeticValidatedYearTotals!==12||annual.yearsWithoutSummary!==1
  ||annual.independentWholeResponseHashesEqual!==11
  ||annual.originalOfficialSourceJobId!==116543314555
  ||annual.independentReplayJobId!==116544130547
  ||annual.exactHistoricalFirstPublicByDatesProven!==0
  ||annual.correctedBoardReceiptDatesProven!==0
  ||annual.currentCandidateYearAggregatesAreNotPdfVersionSpecific!==true
  ||annual.donorLevelDataNotSaved!==true||annual.reportPdfTextNotSaved!==true)
  throw Error('Independent Board annual rollup proof missing or inconsistent');
 if(resolution.schema!=='cfb-864-nine-five-user-accepted-review-dispositions-v45'
  ||resolution.originalGovernmentPDFVersionReferencesPreserved!==830
  ||resolution.distinctOriginalGovernmentPdfBodiesPreserved!==813
  ||resolution.acceptedAnnualSourceCorroboratedOriginals!==4
  ||resolution.handwrittenReportVersionsStillUnresolved!==2
  ||resolution.userClassifiedCorrespondenceAttachmentsExcludedFromMoney!==3
  ||resolution.selectedLaterSourceFieldDateProxies!==5
  ||resolution.originalPrintedBoardReceivedDatesRewritten!==0
  ||resolution.historicalExactVersionPublicByDatesProven!==0
  ||resolution.noPrivateDBOrForecastEligibilityChanges!==true
  ||resolution.resolutions.length!==14)
  throw Error('Reviewed disposition schema/counts/limits changed');
 const seen=new Set();let accepted=0,email=0,unknown=0,later=0;
 for(const r of resolution.resolutions){
  const prev=byId.get(r.versionId), original=v43ById.get(r.versionId);
  if(!prev||!original||seen.has(r.versionId)||r.senator!==prev[1]
   ||r.senator!==original.senator||r.originalGovernmentPdfSHA256!==prev[10]
   ||r.originalGovernmentPdfSHA256!==original.sourceWholePDFSHA256
   ||r.originalGovernmentViewerUrl!==prev[9]||!SHA.test(r.originalGovernmentPdfSHA256)
   ||r.officialIndexedVersionKind!==(prev[6]==='original'?'original':'amended')
   ||r.historicalExactVersionFirstPublicOn!==null
   ||r.correctedOfficialBoardReceivedOn!==null)
    throw Error('Original indexed government PDF version/date/source changed: '+r.versionId);
  const reg=prev[3],year=Number(prev[2]);
  if(AMOUNT.has(r.versionId)){
   const source=byReg.get(reg),details=source?.years.find(x=>x.year===year);
   if(!source||!details||!details.aggregateArithmeticVerified||r.officialIndexedVersionKind!=='original'
     ||r.reviewDisposition!=='annual_receipts_accepted_from_original_pdf_and_board_summary'
     ||r.acceptedTotalReceiptsCents!==AMOUNT.get(r.versionId)
     ||r.acceptedTotalReceiptsCents!==details.boardAnnualReportedReceiptsCents
     ||details.independentPublicSourceFinancialCategoriesSumCents!==r.acceptedTotalReceiptsCents
     ||r.acceptedTotalReceiptsUSD!==(AMOUNT.get(r.versionId)/100).toFixed(2)
     ||r.boardFinancialSummaryResponseSHA256!==source.responseSHA256
     ||r.boardFinancialSummarySourceUrl!==source.officialViewerSourceUrl
     ||r.effectiveReviewOn!==details.yearEndThroughOn
     ||r.reviewDateBasis!=='current_board_year_end_report_through'
     ||r.amountCertainty!=='user_accepted_board_annual_summary_crosscheck')
    throw Error('Accepted original receipts not corroborated by independently twice-read Board annual source '+r.versionId);
   accepted++;
  }else if(HANDWRITTEN.has(r.versionId)){
   if(r.reviewDisposition!=='handwritten_receipts_remain_unknown'
     ||r.acceptedTotalReceiptsCents!==null||r.effectiveReviewOn!==null
     ||original.category!=='source_report_receipts_summary_unverified')
    throw Error('Unclear handwritten 2022 PDF amount was invented '+r.versionId);
   unknown++;
  }else if(EMAILS.has(r.versionId)){
   if(r.reviewDisposition!=='correspondence_attachment_excluded_from_monetary_reconciliation'
     ||r.officialIndexedVersionKind!=='amended'
     ||r.acceptedTotalReceiptsCents!==null||r.effectiveReviewOn!==null
     ||r.officialIndexClassificationPreserved!==true
     ||r.classificationSource!=='user_review_2026-10-15')
    throw Error('Correspondence attachment counted as an amended monetary contribution '+r.versionId);
   email++;
  }else if(DATE_IDS.has(r.versionId)){
   if(original.category!=='source_printed_date_chronology_conflict'
    ||r.reviewDisposition!=='later_of_printed_stamp_or_period_end_used_for_review'
    ||r.originalPrintedBoardReceivedOn!==original.boardReceivedOn
    ||r.originalReportedPeriodEndOn!==original.reportedPeriodEndOn
    ||r.originalPrintedBoardReceivedOn>=r.originalReportedPeriodEndOn
    ||r.effectiveReviewOn!==[r.originalPrintedBoardReceivedOn,r.originalReportedPeriodEndOn].sort().at(-1)
    ||r.reviewDateBasis!=='user_selected_later_of_two_source_dates'
    ||r.reviewDateIsIndependentPublicationProof!==false
    ||r.acceptedTotalReceiptsCents!==null)
    throw Error('Printed Board date overwritten, not conservatively selected: '+r.versionId);
   later++;
  }else throw Error('Non-allowed report version inserted into owner resolution: '+r.versionId);
  seen.add(r.versionId);
 }
 if(seen.size!==14||accepted!==4||unknown!==2||email!==3||later!==5)
  throw Error('Resolution failed exact four/three/two/five partition');
 const isaacson=byReg.get('17929')?.years.find(x=>x.year===2022);
 if(!isaacson||isaacson.boardAnnualReportedReceiptsCents!==null
  ||isaacson.aggregateArithmeticVerified!==false)
  throw Error('Absent CFB 2022 annual rollup incorrectly treated as zero or certifiable');
 return {
  schema:SCHEMA,sourceIndexedGovernmentReportVersionsPreserved:830,
  sourceWholePdfBodiesPreserved:813,
  newlyOwnerAcceptedBoardCrosscheckedOriginalTotals:4,
  nonFinancialCorrespondenceAttachmentsExcludedFromMonetaryReview:3,
  stillUnknownHandwrittenIsaacson2022ReportVersions:2,
  sourceDateConflictsUsingLaterPrintedDateForReview:5,
  originalBoardReceiptStampsCorrectedOrDeleted:0,
  newHistoricalFirstPublicByClaims:0,
  noHistoricalEligibilityModelOrProductionDbChange:true
 };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2)throw Error('Immutable V41–V45 source data only');
 console.log('CFB_864_OWNER_REVIEW_V45 '+JSON.stringify(auditNarrowOwnerReviewV45()));
}
