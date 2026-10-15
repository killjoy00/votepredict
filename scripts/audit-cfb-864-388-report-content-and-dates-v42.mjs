/**
 * #864 V42 offline, byte-pinned reconciliation of the 388 current
 * Minnesota CFB PDF-body summary/chronology observations and 92 exact
 * original-to-official-latest amended report receipt summary pairs.
 *
 * PDF source provenance is inherited from SHA-pinned V41. OCR-only findings
 * never become financial facts. Current 2026 PDF observations do not prove
 * exact historical public-by, statutory filing duty, individual transactions,
 * causal donor effects or production model eligibility.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { verifyAll830SenateCFBPDFSourceVersionsV41 }
  from './audit-cfb-864-830-full-pdf-source-v41.mjs';

export const SCHEMA='cfb-864-388-pdf-receipts-summary-and-92-amendment-deltas-v42';
const DIR='docs/evaluation/source-proof/';
const FILES={
  old:DIR+'cfb-2021-25-95-senators-830-indexed-830-downloaded-v41.psv',
  observed:DIR+'cfb-2021-25-388-report-level-summary-and-date-review-v42.psv',
  deltas:DIR+'cfb-2021-25-92-original-to-official-latest-receipts-comparisons-v42.psv',
  checkpoint:DIR+'cfb-2021-25-388-content-review-checkpoint-v42.json'
};
const PIN={
 observed:'e86cfb4b25aa59b72ee9edb5ebf2f789c5cbe7c7',
 deltas:'82343a18ae7c04bee22c0fd78a528255c9c8a070',
 checkpoint:'4fad0279674dd5f384d222477361c40add627819'
};
const SHAPAT=/^[a-f0-9]{64}$/,ISO=/^\d{4}-\d{2}-\d{2}$/;
const EXPECTED_JOBS=new Map([
 [116493353902,{phase:'pilot',records:15,run:38755685024,verified:8}],
 [116494855994,{phase:'unparsed-0',records:95,run:38756109428,verified:95}],
 [116494855883,{phase:'unparsed-1',records:95,run:38756109428,verified:94}],
 [116494855303,{phase:'unparsed-2',records:95,run:38756109428,verified:94}],
 [116494855966,{phase:'unparsed-3',records:88,run:38756109428,verified:88}]
]);
const count=(target,key)=>{target[key]=(target[key]??0)+1;};
function blob(text){
 return createHash('sha1').update('blob '+Buffer.byteLength(text)+'\0').update(text).digest('hex');
}
function file(key){
 const raw=readFileSync(FILES[key],'utf8');
 if(!raw.endsWith('\n')||raw.includes('\r')||(PIN[key]&&blob(raw)!==PIN[key]))
  throw Error('V42 pinned original government source record changed: '+key);
 return raw;
}
function psv(key,length,width){
 const rows=file(key).trimEnd().split('\n').map(x=>x.split('|'));
 if(rows.length!==length||rows.some(x=>x.length!==width||x.some(z=>z==='')))
  throw Error('V42 original government source proof row count or cells changed: '+key);
 return rows;
}
export function audit388SourceReportSummariesAndAmendmentsV42(){
 const base=verifyAll830SenateCFBPDFSourceVersionsV41();
 if(base.completeOfficialGovernmentPDFVersionSources!==830||
  base.distinctWholeGovernmentPdfBodies!==813||
  base.missingPdfBinarySources!==0)
  throw Error('V41 full official PDF source authenticity/references changed');
 const old=psv('old',830,19);
 const reviewed=psv('observed',388,26);
 const delta=psv('deltas',92,15);
 const checkpoint=JSON.parse(file('checkpoint'));
 if(checkpoint.schema!=='cfb-864-388-current-gov-report-bodies-379-verifiable-total-receipts-and-five-date-chronology-discrepancies-v42'
  ||checkpoint.selectedOriginalGovPDFFilesForFinancialDetailReview!==388
  ||checkpoint.originallyUnparsedVersionReferences!==373
  ||checkpoint.originallyUnreadableOrUnresolvedPDFVersions!==14
  ||checkpoint.originallyFlaggedReportDateConflicts!==1
  ||checkpoint.observedOriginalGovernmentPDFBytesChanged!==0
  ||checkpoint.popplerTextLayerReadableDocuments!==381
  ||checkpoint.assistedOCRFirstPageCandidateOnly!==6
  ||checkpoint.noUsableTextLayerPDFsNotOCRProcessed!==1
  ||checkpoint.sourceReceiptSummaryExactArithmeticVerified!==379
  ||checkpoint.remainingVersionReferencesWithoutCertifiedAggregateReceipts!==9
  ||checkpoint.independentOriginalFullPDFSHA256BinariesWithSummaryReceipts!==379
  ||checkpoint.sourceRegistrationMismatchCount!==0
  ||checkpoint.originalAndOfficialLatestVersionPairsWithVerifiedReceipts!==92
  ||checkpoint.reportFamiliesWithPrintedReceiptChanges!==39
  ||checkpoint.reportFamiliesWithIdenticalOriginalLatestReceiptTotals!==53
  ||checkpoint.historicFirstPublicExactVersionDateProven!==0
  ||checkpoint.legallyOwedOriginalReportsDenominator!==null
  ||checkpoint.sourceAggregateReceiptsIsNotItemizedTransactionParity!==true
  ||checkpoint.financialExpenditureAndLoanDebtTotalsVerified!==false
  ||checkpoint.noRawPDForDonorPayeeDataStored!==true
  ||checkpoint.noProtectedNeonDbReadWriteOrModelEligibilityDeployment!==true
  ||checkpoint.captureRuns?.length!==EXPECTED_JOBS.size)
  throw Error('V42 summary-content scope/limitations and original source checkpoint changed');
 for(const x of checkpoint.captureRuns){
  const p=EXPECTED_JOBS.get(x.jobId);
  if(!p||p.phase!==x.phase||p.records!==x.sourcePDFsInspected||
   p.run!==x.workflowRunId||p.verified!==x.sourceSummaryReportedVerified)
   throw Error('V42 independent original government PDF capture lineage changed');
 }
 const lookup=new Map(old.map(x=>[x[0],x]));
 if(lookup.size!==830)throw Error('V41 source version identities not distinct');
 const seen=new Set(),counts={old:{},year:{},text:{},summary:{},chronology:{}},
  totalsByBody=new Map(),early=[],holds=[];
 for(const x of reviewed){
  const[id,name,year,reg,period,amend,kind,oldStatus,sha,bytes,textMode,ocr,
   nChars,heading,regMatch,start,end,received,priorReceived,chronology,
   dateDiagnostic,summary,receipts,run,job,historic]=x;
  const original=lookup.get(id);
  if(!original||seen.has(id)||original[1]!==name||original[2]!==year||
   original[3]!==reg||original[4]!==period||original[5]!==amend||
   original[6]!==kind||original[7]!==oldStatus||original[10]!==sha||
   original[11]!==bytes||!SHAPAT.test(sha)||historic!=='UNKNOWN')
   throw Error('Current government PDF content source not authentic V41 exact version: '+id);
  const expected=EXPECTED_JOBS.get(Number(job));
  if(!expected||expected.run!==Number(run)||
    (expected.phase==='pilot'
      ? !['downloaded_pdf_details_unreadable_or_unresolved','downloaded_pdf_report_date_conflict'].includes(oldStatus)
      :oldStatus!=='official_pdf_downloaded_unparsed'))
   throw Error('Report in wrong official original government PDF acquisition batch: '+id);
  if(!['text_layer_readable','ocr_candidate_unverified','no_usable_text_layer'].includes(textMode)
    ||!['0','1'].includes(ocr)||!Number.isSafeInteger(Number(nChars))||
    !['-','0','1'].includes(heading)||!['-','0','1'].includes(regMatch)
    ||(ocr==='1')!==(textMode==='ocr_candidate_unverified')
    ||(textMode==='text_layer_readable')!==(Number(nChars)>0)
    ||regMatch==='0')
   throw Error('Unverified OCR or registration identification promoted: '+id);
  if([start,end,received,priorReceived].some(s=>s!=='-'&&!ISO.test(s)))
   throw Error('Report source printed date has not been authenticated: '+id);
  if(chronology==='board_receipt_before_covered_period_end_conflict'){
   if(received==='-'||end==='-'||received>=end)throw Error('False Board receipt-date conflict');
   early.push({versionId:id,senator:name,reportYear:Number(year),boardReceivedOn:received,reportedPeriodEndOn:end});
  }else if(chronology==='board_receipt_not_before_period_end'){
   if(received==='-'||end==='-'||received<end)throw Error('Unproved Board receipt chronology');
  }else if(!['chronology_not_established','unknown'].includes(chronology))
   throw Error('Report chronology inferred without source fields');
  if(dateDiagnostic!=='-'&&(id!=='16311:22:pcc:YE:0:0'
    ||dateDiagnostic!=='original_pdf_printed_receipt_precedes_covered_end'))
    throw Error('Date anomaly attached to wrong year-end source');
  if(summary==='receipt_cash_plus_inkind_equals_total_verified'){
   if(textMode!=='text_layer_readable'||!/^\d+$/.test(receipts)||
     !Number.isSafeInteger(Number(receipts))||Number(receipts)<0)
    throw Error('OCR-only or malformed report aggregate money certified: '+id);
   if(totalsByBody.has(sha)&&totalsByBody.get(sha)!==Number(receipts))
    throw Error('Identical original PDF whole body has contradictory report-level receipts: '+id);
   totalsByBody.set(sha,Number(receipts));
  }else{
   if(receipts!=='-'||!['committee_summary_not_found','not_inspected'].includes(summary))
    throw Error('Uncertified receipt summary amount was published: '+id);
   holds.push({versionId:id,status:textMode,summary});
  }
  for(const[k,v]of [['old',oldStatus],['year',year],['text',textMode],['summary',summary],
    ['chronology',chronology]])count(counts[k],v);
  seen.add(id);
 }
 const yearExpected={2021:24,2022:143,2023:59,2024:60,2025:102};
 if(seen.size!==388||counts.old.official_pdf_downloaded_unparsed!==373
  ||counts.old.downloaded_pdf_details_unreadable_or_unresolved!==14
  ||counts.old.downloaded_pdf_report_date_conflict!==1
  ||counts.text.text_layer_readable!==381
  ||counts.text.ocr_candidate_unverified!==6
  ||counts.text.no_usable_text_layer!==1
  ||counts.summary.receipt_cash_plus_inkind_equals_total_verified!==379
  ||counts.summary.committee_summary_not_found!==8
  ||counts.summary.not_inspected!==1||totalsByBody.size!==379
  ||holds.length!==9
  ||counts.chronology.board_receipt_before_covered_period_end_conflict!==5
  ||JSON.stringify(counts.year)!==JSON.stringify(yearExpected))
  throw Error('V42 historical report review total/status counts inconsistent');
 const expectedEarly=checkpoint.printedBoardReceiptEarlierThanPeriodEnd;
 const byId=(a,b)=>a.versionId.localeCompare(b.versionId);
 if(early.length!==5||expectedEarly.length!==5||
  JSON.stringify([...early].sort(byId))!==JSON.stringify([...expectedEarly].sort(byId)))
  throw Error('Original printed Board receipt/covered-end anomalies not reproducible');
 if(JSON.stringify([...holds].sort(byId).map(x=>x.versionId))!==
   JSON.stringify([...checkpoint.remainingSpecificUnresolvedSummaryVersions]
    .sort(byId).map(x=>x.versionId)))
  throw Error('Nine unresolved sources omitted or overwritten');
 const groups=new Map();
 for(const x of old){
  const family=x[0].split(':').slice(0,5).join(':');
  const list=groups.get(family)??[];list.push(x);groups.set(family,list);
 }
 const validPairs=new Map();
 for(const [family,list]of groups){
  list.sort((a,b)=>Number(a[5])-Number(b[5]));
  const original=list.find(x=>x[5]==='0'),latest=list.at(-1);
  if(!original||!latest||original===latest)continue;
  const a=totalsByBody.get(original[10]),b=totalsByBody.get(latest[10]);
  if(a!==undefined&&b!==undefined)validPairs.set(family,{original,latest,a,b});
 }
 if(validPairs.size!==92)throw Error('Not all official original/latest PDF receipts are cross-joined');
 let changed=0,aliases=0;const included=new Set();
 for(const x of delta){
  const[family,name,year,period,reg,startVersion,endVersion,sha0,sha1,startCents,
    endCents,difference,alias,scope,historic]=x;
  const e=validPairs.get(family);
  if(!e||included.has(family)||e.original[0]!==startVersion||
   e.latest[0]!==endVersion||e.original[1]!==name||e.original[2]!==year||
   e.original[3]!==reg||e.original[4]!==period||
   e.original[10]!==sha0||e.latest[10]!==sha1||
   Number(startCents)!==e.a||Number(endCents)!==e.b||
   Number(difference)!==e.b-e.a||
   alias!==(e.latest[7]==='indexed_alias_of_same_pdf'?'1':'0')||
   scope!=='government_exact_pdf_receipts_summary_arithmetic_only'||
   historic!=='UNKNOWN')
   throw Error('Comparing wrong amended report or invented financial delta: '+family);
  if(e.a!==e.b)changed++;if(alias==='1')aliases++;
  included.add(family);
 }
 if(included.size!==92||changed!==39||aliases!==8)
  throw Error('V42 official receipt amendment deltas/alias status changed');
 return{schema:SCHEMA,officialReportVersionsPreserved:830,
  currentlyDistinctAuthenticatedPdfBodies:813,
  sourceReportVersionsReviewed:388,extractableDigitalText:381,
  ocrCandidateOnly:6,notTextExtractable:1,
  verifiedOriginalGovernmentPdfSummaryReceiptTotals:379,
  unresolvedSourceSummaryReportVersions:9,
  comparableOriginalAndOfficialLatestReportFamilies:92,
  familiesWithChangedReceipts:39,familiesWithUnchangedReceipts:53,
  boardReceiptEarlierThanPrintedPeriodEndAnomalies:5,
  historicalExactPdfVersionPublicByDatesProven:0,
  legalOriginalReportsOwedDenominator:null,independentTransactionRowParityProven:false,
  expenseCashDebtLoanTotalsVerified:false,
  noPrivateOrProductionDbModelChanges:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2)throw Error('Offline fixed immutable CFB source proofs only');
 console.log('CFB_864_388_SUMMARY_REPLAY_V42 '+JSON.stringify(audit388SourceReportSummariesAndAmendmentsV42()));
}