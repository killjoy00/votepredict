/**
 * #864 V42: offline replay of NINE government CFB PDF whole-body SHA
 * anchored summary holds following independent extended extraction/limited
 * first-2-page OCR. Source bytes are not stored. A failed textual summary is
 * not proof of absent filing; OCR is never promoted to financial certification.
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {audit388SourceReportSummariesAndAmendmentsV42}
 from './audit-cfb-864-388-report-content-and-dates-v42.mjs';

export const SCHEMA='cfb-864-nine-secondary-official-pdf-summary-holds-source-audit-v42';
const ROOT='docs/evaluation/source-proof/';
const PSV=ROOT+'cfb-2021-25-nine-still-unverified-summary-secondary-gov-source-v42.psv';
const CK=ROOT+'cfb-2021-25-nine-unresolved-PDF-review-checkpoint-v42.json';
const PARENT=ROOT+'cfb-2021-25-388-content-review-checkpoint-v42.json';
const ORIGINAL=ROOT+'cfb-2021-25-95-senators-830-indexed-830-downloaded-v41.psv';
const BLOB={psv:'e177f17fea267f647da4b4187647ca0bf96b4fd3',
 checkpoint:'db909c41fa0b583e2ee5f2b1bb6b544fa217390f'};
const sha=/^[a-f0-9]{64}$/;
const gitHash=x=>createHash('sha1').update('blob '+Buffer.byteLength(x)+'\0').update(x).digest('hex');
function pinned(path,hash){
 const raw=readFileSync(path,'utf8');
 if(!raw.endsWith('\n')||raw.includes('\r')||gitHash(raw)!==hash)
  throw Error('Government PDF summary secondary evidence bytes changed: '+path);
 return raw;
}
export function replayNineOriginalGovernmentSummaryHoldsV42(){
 const parent=audit388SourceReportSummariesAndAmendmentsV42();
 if(parent.sourceReportVersionsReviewed!==388||parent.unresolvedSourceSummaryReportVersions!==9
  ||parent.verifiedOriginalGovernmentPdfSummaryReceiptTotals!==379)
  throw Error('Parent V42 original content summary proof changed');
 const ck=JSON.parse(pinned(CK,BLOB.checkpoint));
 const rows=pinned(PSV,BLOB.psv).trimEnd().split('\n').map(x=>x.split('|'));
 const parentHeld=JSON.parse(readFileSync(PARENT,'utf8')).remainingSpecificUnresolvedSummaryVersions;
 const originals=readFileSync(ORIGINAL,'utf8').trimEnd().split('\n').map(x=>x.split('|'));
 const byOriginal=new Map(originals.map(x=>[x[0],x]));
 const held=new Map(parentHeld.map(x=>[x.versionId,x]));
 if(ck.schema!=='cfb-864-nine-original-official-government-PDF-secondary-source-report-holds-v42'
  ||ck.exactOriginalSourcePDFsSelected!==9
  ||ck.independentOriginalGovernmentSecondarySourceRun!==38758588098
  ||ck.originalGovernmentSecondarySourceJob!==116503521080
  ||ck.originalGovernmentPDFHashesAndByteLengthsChanged!==0
  ||ck.checkedExtendedTextLayerForAllNine!==true
  ||ck.digitalTextLayerWithoutVerifiableSummary!==2
  ||ck.fullyImagePDFsWithOCRFormCueOnly!==7
  ||ck.noAdditionalAggregateReportReceiptTotalsCertified!==0
  ||ck.currentValidOriginalPDFVersionsPreserved!==830
  ||ck.totalCurrentOriginallyReviewNeededReportVersions!==388
  ||ck.totalVerifiedAggregateReceiptSummaryVersionsUnchanged!==379
  ||ck.nineUnreconciledAggregateSummaryVersionReferencesRemain!==9
  ||ck.historicExactReportVersionFirstPublicByProven!==0
  ||ck.statutoryOwedOriginalFilingDenominator!==null
  ||ck.OCRNeverTreatedAsCertifiedReceiptAmount!==true
  ||ck.noRawReportPdfOrIndividualDonorPayeeRowsStored!==true
  ||ck.noProtectedDBForecastEligibilityModelOrDeploymentChanges!==true
  ||ck.specificVersions?.length!==9
  ||rows.length!==9||rows.some(x=>x.length!==19)||byOriginal.size!==830)
  throw Error('Secondary original government source hold metadata mismatch');
 const seen=new Set();let image=0,text=0;
 for(const r of rows){
  const [id,name,reg,hash,prior,now,method,pageCount,pagesSearched,textChars,
    ocr,ocrChars,summaryCandidate,formHeader,regMatch,money,run,job,publicOn]=r;
  const orig=byOriginal.get(id),priorHold=held.get(id);
  if(!orig||!priorHold||seen.has(id)||priorHold.senator!==name||
    priorHold.status!==prior||orig[1]!==name||orig[3]!==reg||
    orig[10]!==hash||!sha.test(hash)||money!=='-'||publicOn!=='UNKNOWN'||
    run!=='38758588098'||job!=='116503521080'||
    !Number.isInteger(Number(pageCount))||Number(pageCount)<1||
    !Number.isInteger(Number(pagesSearched))||Number(pagesSearched)<1||
    Number(pagesSearched)>Math.min(12,Number(pageCount))||
    !Number.isInteger(Number(textChars))||
    !['0','1'].includes(ocr)||!['-','0','1'].includes(summaryCandidate)||
    !['-','0','1'].includes(formHeader)||!['-','0','1'].includes(regMatch)||
    regMatch==='0')
   throw Error('Original CFB PDF source byte hash/summary status discrepancy: '+id);
  if(now==='image_pdf_ocr_only_not_financially_certified'){
   if(method!=='first_two_pages_local_ocr'||ocr!=='1'||textChars!=='0'||
     prior==='text_layer_readable'||!Number.isInteger(Number(ocrChars))||Number(ocrChars)<30)
    throw Error('Secondary OCR source incorrectly treated as original text-layer money: '+id);
   image++;
  }else if(now==='no_verified_report_receipts_in_extended_text'){
   if(!['poppler-raw','poppler-layout'].includes(method)||ocr!=='0'||ocrChars!=='-'||
     prior!=='text_layer_readable'||Number(textChars)<90)
    throw Error('Extended original PDF text missing: '+id);
   text++;
  }else throw Error('Original PDF secondary reports introduced unverified new financial claim: '+id);
  const ckCase=ck.specificVersions.find(x=>x.versionId===id);
  if(!ckCase||ckCase.sourceSHA256!==hash||ckCase.person!==name||
    ckCase.format!==now||ckCase.pageCount!==Number(pageCount)||
    ckCase.summaryCertified!==false)
   throw Error('Untrusted secondary source rows not matching checkpoint: '+id);
  seen.add(id);
 }
 if(seen.size!==9||image!==7||text!==2||held.size!==9)throw Error('Secondary CFB PDF source coverage lost');
 return{schema:SCHEMA,versionsStillRequiringReviewedReceipts:9,
  imagePdfOcrDiagnosticOnly:7,digitalTextWithoutSummary:2,
  sourcePdfHashesPreserved:9,unverifiedReceiptAmountsPromoted:0,
  originalGovernmentPDFVersionReferencesPreserved:830,
  historicalExactReportVersionPublicByProven:0,
  noIndividualFinanceOrProductionChanges:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2)throw Error('Only immutable original read-only government CFB evidence supported');
 console.log('CFB_864_NINE_OFFLINE_SECONDARY_V42 '+JSON.stringify(replayNineOriginalGovernmentSummaryHoldsV42()));
}