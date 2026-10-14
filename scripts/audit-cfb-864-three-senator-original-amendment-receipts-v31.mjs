/**
 * #864 V31: independently reproduce EXACT six government PDF total receipt
 * lines and three 2022 original -> latest amended report-stated deltas.
 * This proves printed summary Cash + In-kind = Total on original signed PDFs,
 * NOT independent candidate bulk contribution transaction ledger parity,
 * legally owed reports, motive or historical public-at-cutoff.
 */
import{readFileSync}from'node:fs';
import{createHash}from'node:crypto';
import{pathToFileURL}from'node:url';
import{audit435FullOriginalReportSources}from'./audit-cfb-864-435-exact-reports-86-senators-v28.mjs';
export const SCHEMA='cfb-864-2022-three-Senate-original-amendment-PDF-receipts-summaries-v31';
export const SOURCE={
 original:'docs/evaluation/source-proof/cfb-2021-25-86-serving-senators-435-exact-original-amended-report-versions-v28.psv',
 row:'docs/evaluation/source-proof/cfb-2022-three-senate-original-amended-double-authenticated-receipts-summary-v31.psv',
 delta:'docs/evaluation/source-proof/cfb-2022-three-senate-original-to-latest-amendment-receipts-deltas-v31.psv',
 checkpoint:'docs/evaluation/source-proof/cfb-2022-original-amendment-financial-summary-two-source-checkpoint-v31.json'
};
const PIN={
 row:'9963161612d699e4e23cdcf30d003195e9f61767',
 delta:'4db396982d935af224179513418517b22f30c29a',
 checkpoint:'1461b64f77d49a87843b74821ac26e00990bb221'
};
const blob=s=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex');
const DIGEST=/^[a-f0-9]{64}$/;
function psv(which,n,cols){
 const s=readFileSync(SOURCE[which],'utf8');
 if((PIN[which]&&blob(s)!==PIN[which])||!s.endsWith('\n')||s.includes('\r'))
  throw Error('Original signed government source summary checkpoint bytes changed: '+which);
 const lines=s.trimEnd().split('\n').map(x=>x.split('|'));
 if(lines.length!==n||lines.some(x=>x.length!==cols||x.some(z=>!z)))
  throw Error('Report-level financial original/amended PSV rows or fields drift: '+which);
 return lines;
}
export function verifyThreeOfficialSenateReportReceiptsAmendments(){
 const proof=audit435FullOriginalReportSources();
 if(proof.sourceObservedOfficialExactReportVersions!==435||proof.sourceVerifiedOriginalPdfVersions!==416)
  throw Error('Previous original PDF source body SHA proofs not reproduced');
 const whole=psv('original',435,22),row=psv('row',6,21),delta=psv('delta',3,9);
 const raw=readFileSync(SOURCE.checkpoint,'utf8');
 if(blob(raw)!==PIN.checkpoint)throw Error('Original PDF two separate live source-run result SHA checkpoint changed');
 const ck=JSON.parse(raw);
 if(ck.schema!=='cfb-864-original-2022-Senate-receipts-summary-three-amendment-lineages-v31'
  ||ck.firstCompletePDFSourceRun!==38508757848
  ||ck.firstOriginalSourceJob!==115672175664
  ||ck.secondIndependentSourceAttemptJob!==115672638085
  ||ck.distinctOfficialOriginalSignedPDFVersions!==6
  ||ck.candidateSenatorCommitteePrincipalCount!==3
  ||ck.originalSignedGovernmentPDFWholeSHAAndBytesSameOnBothRuns!==true
  ||ck.allSixReportTotalReceiptsCellsMatchTwoGovernmentSourceRuns!==true
  ||ck.allSixOriginalGovernmentSignedPDFSummaryCashPlusInKindEqualsTotal!==true
  ||ck.disbursementsCashBalancesDebtsLoansAndItemizedTotalsUnverified!==true
  ||ck.historicalExactPdfPublicByOn!==null||ck.updatedReadOnlyProductionDb!==false)
  throw Error('Original government two independent source runs and statutorily unavailable finance proof boundary changed');
 const expected=new Set(['17021:22:pcc:YE:0:0','17021:22:pcc:YE:0:4',
  '17316:22:pcc:YE:0:0','17316:22:pcc:YE:0:3',
  '18500:22:pcc:YE:0:0','18500:22:pcc:YE:0:3']);
 const lookup=new Map();
 for(const v of row){
  const[id,reg,person,pdf,viewer,bytes,year,period,se,index,cash,inkind,total,status,
   run,job,second,pub,independentCompleteReconcile,reportDueRelation,scope]=v;
  const orig=whole.find(x=>x[0]===id);
  if(!expected.has(id)||lookup.has(id)||!orig||orig[4]!==reg||orig[2]!==person
   ||orig[10]!==pdf||orig[17]!==viewer||orig[11]!==bytes
   ||orig[9]!==((index==='0')?'authenticated_original_pdf':'authenticated_amendment_pdf')
   ||!DIGEST.test(pdf)||!DIGEST.test(viewer)||year!=='2022'||period!=='YE'||se!=='0'
   ||orig[7]!==index||!Number.isSafeInteger(Number(cash))||!Number.isSafeInteger(Number(inkind))
   ||!Number.isSafeInteger(Number(total))||Number(cash)<0||Number(inkind)<0
   ||Number(cash)+Number(inkind)!==Number(total)
   ||status!=='signed_original_receipts_summary_column_arithmetic_verified'
   ||run!=='38508757848'||job!=='115672175664'||second!=='115672638085'
   ||pub!=='-'||independentCompleteReconcile!=='-'||reportDueRelation!=='-'
   ||scope!=='report_level_sum_not_transaction_row_parity')
   throw Error('Original report summary money source was not exact signed whole government version, arithmetic or scope: '+id);
  lookup.set(id,{id,reg,person,cash:Number(cash),inkind:Number(inkind),total:Number(total),pdf});
 }
 if(lookup.size!==6)throw Error('Did not pin all six original amended report summary source line pairs');
 const reports=[];
 for(const q of delta){
  const[reg,person,parent,last,original,latest,change,scope,pub]=q;
  const a=lookup.get(parent),b=lookup.get(last);
  if(!a||!b||a.reg!==reg||b.reg!==reg||a.person!==person||b.person!==person
    ||a.id.split(':').at(-1)!=='0'||Number(b.id.split(':').at(-1))<=0
    ||Number(original)!==a.total||Number(latest)!==b.total
    ||Number(change)!==b.total-a.total
    ||scope!=='government_original_report_stated_total_receipts_only'||pub!=='-')
   throw Error('Original vs latest officially indexed authentic PDF reported total receipts delta identity mismatch '+reg);
  const family=whole.filter(x=>x[4]===reg&&x[1]==='2022'&&x[5]==='YE')
    .sort((x,y)=>Number(x[7])-Number(y[7]));
  const first=family[0],final=family.at(-1);
  if(!first||!final||first[0]!==parent||final[0]!==last||final[9]!=='authenticated_amendment_pdf'
    ||final[14]<first[14])throw Error('Amended totals compared to wrong government report version or Board chronological filing');
  reports.push({senator:person,registration:reg,originalFullPDFVersion:parent,
    latestFullPDFVersion:last,originalReportTotalReceiptsCents:a.total,
    latestAmendedReportTotalReceiptsCents:b.total,
    differenceInPrintedTotalReceiptsCents:b.total-a.total,
    independentSourceFullSHAReplayedTwice:true});
 }
 if(reports.length!==3||new Set(reports.map(x=>x.registration)).size!==3)
  throw Error('CFB 2022 original-to-latest receipts amendment reconciliation missing one senator');
 return{schema:SCHEMA,numberOfOriginalGovernmentSignedReportPdfs:6,
   2022SenateCandidatePrincipalCommitteesReviewed:3,reviewedOriginalAndLatestAmendmentLineages:3,
   sourceReportedTotalReceiptsArithmeticVerifiedForSixVersions:true,
   independentlyWholePDFSHAAndReceiptSourceRepeated:true,
   actualOriginalReportVersionsHistoricalPublicByProven:0,
   reports,
   reportedExpendituresCashDebtsLoansItemizationIndependentlyReconciled:false,
   originalSourceSummaryNotBulkTransactionParity:true,
   noDonorEmployeeEmployerMotivationOrIndependentSpenderInferences:true,
   legallyOwedOriginalFilingDenominator:null,noProductionOrForecastOrEligibilityChanges:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2)throw Error('No runtime or private DB source override permitted');
 console.log('CFB_864_THREE_SENATE_AMENDED_RECEIPTS_SOURCE_V31 '+JSON.stringify(verifyThreeOfficialSenateReportReceiptsAmendments()));
}
