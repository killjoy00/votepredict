/**
 * #864 V43 final source-only audit: validate exactly nine unresolved full
 * current-government PDF-source summaries plus five visual same-page printed
 * Board-receipt/coverage-end contradictions against immutable V41/V42 sources.
 * A readable handwritten-looking amount is not automatically certified.
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {verifyAll830SenateCFBPDFSourceVersionsV41}
 from './audit-cfb-864-830-full-pdf-source-v41.mjs';
import {audit388SourceReportSummariesAndAmendmentsV42}
 from './audit-cfb-864-388-report-content-and-dates-v42.mjs';
import {replayNineOriginalGovernmentSummaryHoldsV42}
 from './audit-cfb-864-nine-original-report-holds-v42.mjs';
export const SCHEMA='cfb-864-nine-receipt-source-holds-five-first-page-date-conflicts-v43';
const PROOF='docs/evaluation/source-proof/cfb-2021-25-nine-unverified-PDFs-five-printed-receipt-date-anomalies-v43.json';
const V41='docs/evaluation/source-proof/cfb-2021-25-95-senators-830-indexed-830-downloaded-v41.psv';
const V42='docs/evaluation/source-proof/cfb-2021-25-388-content-review-checkpoint-v42.json';
const PIN='741c72b2fefb486a1c297ab0107fdb23569db24e';
const ORIGINAL_SHA=/^[a-f0-9]{64}$/;
const GIT=x=>createHash('sha1').update('blob '+Buffer.byteLength(x)+'\0').update(x).digest('hex');
export function verify14OriginalCFBReportFormAndDateSourceReviewsV43(){
 const source=verifyAll830SenateCFBPDFSourceVersionsV41();
 const summary=audit388SourceReportSummariesAndAmendmentsV42();
 const nine=replayNineOriginalGovernmentSummaryHoldsV42();
 if(source.completeOfficialGovernmentPDFVersionSources!==830
    ||source.distinctWholeGovernmentPdfBodies!==813
    ||summary.sourceReportVersionsReviewed!==388
    ||summary.verifiedOriginalGovernmentPdfSummaryReceiptTotals!==379
    ||summary.boardReceiptEarlierThanPrintedPeriodEndAnomalies!==5
    ||nine.versionsStillRequiringReviewedReceipts!==9)
  throw Error('Original government CFB report and PDF evidence baseline changed');
 const raw=readFileSync(PROOF,'utf8');
 if(!raw.endsWith('\n')||raw.includes('\r')||GIT(raw)!==PIN)
  throw Error('Final V43 source layout review bytes changed');
 const d=JSON.parse(raw),old=readFileSync(V41,'utf8').trimEnd().split('\n').map(x=>x.split('|'));
 const oldById=new Map(old.map(x=>[x[0],x]));
 const prior=JSON.parse(readFileSync(V42,'utf8'));
 const holds=new Set(prior.remainingSpecificUnresolvedSummaryVersions.map(x=>x.versionId));
 const issues=new Map(prior.printedBoardReceiptEarlierThanPeriodEnd.map(x=>[x.versionId,x]));
 if(oldById.size!==830||holds.size!==9||issues.size!==5||
  d.schema!=='cfb-864-nine-source-PDF-summary-form-review-five-confirmed-source-date-conflicts-v43'
  ||d.sourceWorkflowRun!==38765027682||d.sourceJobId!==116525882895
  ||d.originalIndependentSourceRun!==38763363290||d.originalIndependentJobId!==116520137144
  ||d.parentV41OfficialPDFVersions!==830||d.originalSourceV42ReviewedPDFs!==388
  ||d.fourteenOriginalGovernmentFullPDFHashesAndBytesMatched!==true
  ||d.nineStillUncertifiedTotalReceiptsPDFVersions!==9
  ||d.sevenImageOnlyReceiptsSummaryUnverified!==7
  ||d.twoDigitalTextAmendmentFormsWithoutSummary!==2
  ||d.sixImageBasedVersionsWithOCRDetectedPrintedTotalReceiptsRows!==6
  ||d.fateh2021AmendmentAllEightPagesOCRNoTotalReceiptsLabel!==true
  ||d.fiveOriginalGovernmentPDFSamePageBoardReceiptDateBeforeCoverageEndConfirmed!==true
  ||d.correctedOriginalBoardReceiptDatesEstablished!==0
  ||d.newReportAmountsCertifiedInV43!==0
  ||d.originalCurrentSourceCertifiedSummaryTotalsUnchanged!==379
  ||d.historicalExactVersionFirstPublicByProven!==0
  ||d.legalOwedReportDenominator!==null
  ||d.noRawPDFScansDonorNamesOrTransactionRowsStored!==true
  ||d.noProtectedDBModelEligibilityOrForecastChanges!==true
  ||d.records?.length!==14)
  throw Error('V43 PDF form source review state, original hashes or caution constraints changed');
 const unique=new Set();let seenNine=0,seenFive=0,scans=0,labelScans=0,digital=0,fatehFound=false;
 for(const x of d.records){
  const row=oldById.get(x.versionId);
  if(!row||unique.has(x.versionId)||row[1]!==x.senator||
    row[10]!==x.sourceWholePDFSHA256||
    Number(row[11])!==x.sourceWholePDFBytes||!ORIGINAL_SHA.test(x.sourceWholePDFSHA256)||
    !Number.isSafeInteger(x.pages)||x.pages<1||
    x.independentlyVerifiedExactHistoricPublicBy!==null)
    throw Error('Current original CFB PDF SHA256 or registered version mismatch '+x.versionId);
  if(x.category==='source_report_receipts_summary_unverified'){
   seenNine++;
   if(!holds.has(x.versionId)||x.printedReceiptSummaryAmountCertifiedCents!==null||
    x.originalReportVersionStillIndexed!==true||
    !Array.isArray(x.ocrSourcePagesExamined)||!Array.isArray(x.ocrDetectedTotalReceiptsRowPages)||
    x.safePrintedReceiptsRowCropsReviewed!==x.ocrDetectedTotalReceiptsRowPages.length)
     throw Error('Unsigned scanned PDF receipts promoted without original arithmetic '+x.versionId);
   if(!x.digitalTextLayerReadable){
    scans++;
    if(x.ocrDetectedTotalReceiptsRowPages.length>0)labelScans++;
   }else digital++;
   if(x.versionId==='18488:21:pcc:YE:0:1'){
    fatehFound=true;
    if(x.ocrSourcePagesExamined.join(',')!=='1,2,3,4,5,6,7,8'
      ||x.ocrDetectedTotalReceiptsRowPages.length!==0)
     throw Error('Entire original Omar Fateh source amendment was not inspected conservatively');
   }
  }else if(x.category==='source_printed_date_chronology_conflict'){
   seenFive++;
   const o=issues.get(x.versionId);
   if(!o||x.boardReceivedOn!==o.boardReceivedOn||
    x.reportedPeriodEndOn!==o.reportedPeriodEndOn||
    x.boardReceivedOn>=x.reportedPeriodEndOn||
    x.sameOriginalPDFPagePrintedDateConflictsWithPeriodEnd!==true||
    x.originalFormHeadingPresent!==true||
    x.visualLabelledLineCropsReviewed!==2||
    !x.printedFirstPageBoardReceived||
    !x.printedFirstPagePeriodCovered||
    x.independentlyVerifiedCorrectedBoardDate!==null)
     throw Error('Reported government same-page source date mismatch or invented corrected date '+x.versionId);
  }else throw Error('Unknown CFB source finding');
  unique.add(x.versionId);
 }
 if(unique.size!==14||seenNine!==9||seenFive!==5||scans!==7||
    labelScans!==6||digital!==2||!fatehFound)
  throw Error('Fourteen source reviews did not preserve all nine/five original source cases');
 return{schema:SCHEMA,originalIndexedGovernmentPDFVersionsPreserved:830,
  governmentPdfSummariesReconciledBeforeReview:379,
  additionalFinancialAmountsCertified:0,
  imageOnlyGovernmentPDFVersionsReviewed:7,
  imagePdfSummaryRowPresentButNumbersStillUncertified:6,
  fullImageAmendmentWithoutRecognizedTotalReceiptsRow:1,
  digitalAmendmentDocumentsWithoutFullReceiptsSummary:2,
  originalOfficialPDFPrintedDateFieldsInternallyContradictory:5,
  correctedDateValuesEstablished:0,
  exactHistoricalPublicationDatesEstablished:0,
  remainingReportVersionsWithUnverifiedSummaryAmounts:9,
  productionForecastModelEligibilityUnchanged:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2)throw Error('Immutable V41/V42/V43 source evidence only');
 console.log('CFB_864_FINAL_NINE_FIVE_SOURCE_REVIEW_V43 '+JSON.stringify(verify14OriginalCFBReportFormAndDateSourceReviewsV43()));
}