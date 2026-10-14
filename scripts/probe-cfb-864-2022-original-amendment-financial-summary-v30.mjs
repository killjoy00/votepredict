/**
 * #864 OFFICIAL CFB PDF REPORT-LEVEL MONETARY SUMMARY ONLY.
 * Deliberately bounded original vs latest 2022 Year-End amended versions for
 * three already government-SHA-authenticated Senate candidate committees.
 * Never print/export PDF text, contribution payees, donor/vendor identities or
 * transaction rows. No protected DB, production, model, scheduler or outreach.
 * A summary label and values are not direct transaction-row parity proof.
 */
import{readFileSync}from'node:fs';
import{pathToFileURL}from'node:url';
import{cfbReportViewerUrl,fetchCfbReportViewerText}from'../src/evidence/cfb-current-report-acquisition.js';
import{audit435FullOriginalReportSources}from'./audit-cfb-864-435-exact-reports-86-senators-v28.mjs';
export const SCHEMA='cfb-864-three-2022-original-versus-latest-verified-official-PDF-financial-summary-v30';
const LEDGER='docs/evaluation/source-proof/cfb-2021-25-86-serving-senators-435-exact-original-amended-report-versions-v28.psv';
const EXACT=[
'17021:22:pcc:YE:0:0','17021:22:pcc:YE:0:4',
'17316:22:pcc:YE:0:0','17316:22:pcc:YE:0:3',
'18500:22:pcc:YE:0:0','18500:22:pcc:YE:0:3'];
const PREFIX='CFB_864_2022_YE_ORIGINAL_AMENDMENT_SUMMARY_V30 ';
const SHA=/^[a-f0-9]{64}$/;
const toCents=s=>{
 const cleaned=String(s).replace(/,/g,'');
 if(!/^-?\d+\.\d{2}$/.test(cleaned))return null;
 const n=Number(cleaned);
 return Number.isSafeInteger(Math.round(n*100))?Math.round(n*100):null;
};
const AMOUNT=/(?<![A-Za-z0-9])(?:-?\$?\s*)?(\d{1,3}(?:,\d{3})+\.\d{2}|\d+\.\d{2})(?!\d)/g;
const LABELS=Object.freeze([
 ['totalReceipts',/\btotal\s+receipts\b/i],
 ['totalDisbursements',/\btotal\s+expenditures\s+and\s+disbursements\b/i],
 ['endingCashBalance',/\bending\s+cash\s+balance\b/i],
 ['outstandingLoanBalance',/\btotal\s+outstanding\s+balance\s+of\s+all\s+loans\b/i]
]);
export function findSummaryRows(text){
 const normalized=String(text??'').replace(/\u0000/g,'');
 const heading=normalized.search(/Committee\s+Transaction\s+Summary/i);
 if(heading<0)return{status:'official_pdf_summary_heading_not_found_hold',fields:[]};
 // Only summary page(s), not any candidate donor/schedule transaction rows.
 const chunk=normalized.slice(heading,heading+11500);
 const lines=chunk.split(/\r?\n/).map(x=>x.trim()).filter(x=>x);
 // A source summary line is certifiable ONLY if the same single PDF text line
 // has the unambiguous label, at least one amount and no conflicting repeat.
 const fields=[];
 for(const [key,re]of LABELS){
  const match=lines.map((line,i)=>({line,i})).filter(x=>re.test(x.line));
  if(match.length!==1){
   fields.push({field:key,status:match.length?'ambiguous_repeated_summary_label_hold':'summary_label_not_on_first_page_hold',
    matchingLineCount:match.length});continue;
  }
  const line=match[0].line;
  const raw=[...line.matchAll(AMOUNT)].map(x=>toCents(x[1])).filter(Number.isSafeInteger);
  if(raw.length===0||raw.length>6){
   fields.push({field:key,status:'source_row_amount_not_co_resident_with_label_hold',
    parsedCurrencyAmountsOnLabeledLine:raw.length});continue;
  }
  // At least one genuinely recorded currency amount; a solitary number may
  // also be a column in a different order. Report the candidate diagnostics,
  // not a FINAL total until all columns can be tied to an official line schema.
  fields.push({field:key,status:'official_summary_label_and_same_line_amounts_source_observed_not_reconciled',
   parsedCurrencyAmountsOnLabeledLine:raw.length,
   candidateLastDisplayedTotalCents:raw.at(-1)});
 }
 return{status:fields.every(x=>x.status==='official_summary_label_and_same_line_amounts_source_observed_not_reconciled')
  ?'source_summary_amount_candidates_need_column_alignment_proof'
  :'source_summary_not_fully_parseable_hold',
  sourceTextCharacters:normalized.length,summaryHeadingOffset:heading,
  summaryLinesInspected:lines.length,fields};
}
function targets(){
 const proof=audit435FullOriginalReportSources();
 if(proof.sourceObservedOfficialExactReportVersions!==435||proof.sourceVerifiedOriginalPdfVersions!==416)
  throw Error('Earlier official firstpage/whole PDF source panel changed');
 const a=readFileSync(LEDGER,'utf8').trimEnd().split('\n').map(x=>x.split('|'));
 if(a.length!==435||a.some(v=>v.length!==22))throw Error('Immutable V28 full original source ledger unavailable');
 const row=[];
 for(const id of EXACT){
  const x=a.find(z=>z[0]===id);
  if(!x||x[1]!=='2022'||x[5]!=='YE'||x[6]!=='0'
    ||!x[9].startsWith('authenticated_')||!SHA.test(x[10])
    ||!SHA.test(x[17])||x[19]!=='-'||x[21].length<30)
    throw Error('Only six signed government authenticated exact 2022 PDF versions in original research sample allowed');
  row.push({id,reg:x[4],year:x[1].slice(2),amendment:Number(x[7]),
   expectedOriginalPdfWholeSha:x[10],expectedBytes:Number(x[11]),
   originalViewerApiSha:x[17],originalCommitteePerson:x[2]});
 }
 if(row.length!==6||new Set(row.map(x=>x.id)).size!==6||new Set(row.map(x=>x.reg)).size!==3)
  throw Error('Source audit committee/year original+final amended sample not uniquely scoped');
 return row;
}
export async function probe2022ThreeCandidateFinancialSummaries(){
 const selection=targets();
 const results=[];
 for(const r of selection){
  const ref={registrationNumber:r.reg,year:r.year,type:'pcc',period:'YE',se:'0',
    amendment:r.amendment,filingYear:2022,reportName:'Year-End Report of Receipts and Expenditures'};
  let v;
  try{
   const out=await fetchCfbReportViewerText(ref,{method:'POST',
    referer:'https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/'+r.reg+'/2022/',
    searchType:'Candidate'});
   if(out.sourceUrl!==cfbReportViewerUrl(ref)||out.contentSha256!==r.expectedOriginalPdfWholeSha
      ||out.bytes!==r.expectedBytes)
    v={status:'fetched_government_pdf_does_not_match_pinned_authentic_full_binary_hold'};
   else v={status:'whole_official_original_pdf_binary_verified',
    reportLevelSourceSummaryDiagnostic:findSummaryRows(out.text)};
  }catch(e){
   const s=e instanceof Error?e.message:String(e);
   v={status:/timeout|abort/i.test(s)?'original_source_transport_timeout_hold':
    /HTTP [45]/i.test(s)?'original_source_HTTP_error_hold':'original_source_pdf_reader_or_transport_hold'};
  }
  results.push({versionId:r.id,senator:r.originalCommitteePerson,committeeRegistration:r.reg,
   isOriginal:r.amendment===0,amendmentIndex:r.amendment,
   expectedSignedWholeOriginalPdfSha256:r.expectedOriginalPdfWholeSha,
   originalReportPdfBytes:r.expectedBytes,sourceStatus:v.status,
   reportLevelSourceSummaryDiagnostic:v.reportLevelSourceSummaryDiagnostic??null,
   exactOriginalPdfHistoricalPublicBy:null});
 }
 return{schema:SCHEMA,originalYearEndCandidateCommitteePrincipalCount:3,
  distinctOfficialAuthenticatedVersionIdentities:results.length,
  originalVersionsInBoundedComparison:3,latestOfficialEditedVersionsInBoundedComparison:3,
  originalOfficialPDFWholeSourceHashMatched:results.filter(x=>x.sourceStatus==='whole_official_original_pdf_binary_verified').length,
  parsedReportLevelFinancialTotalsIndependentlyReconciled:false,
  noContributionOrExpenditureTransactionLineContainmentClaimed:true,
  noRawSourcePDFTextDonorVendorOrTransactionsInLog:true,
  noAsOfEligibilityOrProductionChanges:true,reportVersions:results};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2)throw Error('Only original fixed six government signed CFB PDFs, no other inputs');
 const result=JSON.stringify(await probe2022ThreeCandidateFinancialSummaries());
 if(result.length>16500||/donorName|vendorName|rawPDF|%PDF-|rowKey/.test(result))
  throw Error('Unsafe source summary information');
 console.log(PREFIX+result);
}
