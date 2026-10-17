/**
 * #864 targeted multicolumn candidate shadow for the 116 PAC contribution
 * rows. Uses immutable ORIGINAL CFB PDF page-derived spans from 0030, but
 * arithmetic/name/date matches are provisional; no report membership,
 * historical first-public date, affiliations or serving features are asserted.
 */
import {pageScheduleSignals,shadowMatchReportRows}
 from './cfb-report-schedule-arithmetic-shadow-v3.mjs';

export const PAC116_COLUMN_SHADOW_SCHEMA=
 'cfb-pac116-multicolumn-report-candidate-readonly-v2';
const REG=/^[0-9]{3,8}$/;
const HEX=/^[a-f0-9]{64}$/;
const YEARS=['2021','2022','2023','2024','2025'];
const billKey=r=>[r.reg,r.year,r.rowKey].join('|');
const yearReg=(reg,year)=>reg+'|'+year;
const emptyYear=()=>({
 canonicalContributions:0,
 indexedPdfVersionsWithV2Extraction:0,
 indexedPdfVersionsWithoutV2Extraction:0,
 sourceQualifiedProvisionalReportRowPairs:0,
 distinctCanonicalRowsWithProvisionalOriginalCandidate:0
});

export function auditPac116OriginalMultiColumnShadow({
 cohort,allCandidateContributions,reports,spans,pages
}){
 if(!Array.isArray(cohort)||cohort.length>2000||
  !Array.isArray(allCandidateContributions)||allCandidateContributions.length>50000||
  !Array.isArray(reports)||reports.length>830||
  !Array.isArray(spans)||spans.length>200000||
  !Array.isArray(pages)||pages.length>30000)
  throw Error('Unbounded original campaign finance candidate comparison');
 const keys=new Set(),yearByKey=new Map(),byYear=Object.fromEntries(
  YEARS.map(y=>[y,emptyYear()]));
 for(const r of cohort){
  if(!REG.test(r.reg??'')||!YEARS.includes(String(r.year))||
   !HEX.test(r.rowKey??''))throw Error('Invalid scoped registered PAC contribution');
  const key=billKey(r);
  keys.add(key);yearByKey.set(key,String(r.year));
 }
 for(const key of keys)byYear[yearByKey.get(key)].canonicalContributions++;
 const allByYearReg=new Map(),allKeys=new Set();
 for(const r of allCandidateContributions){
  if(r.family!=='candidate_contribution'||!REG.test(r.reg??'')||
   !YEARS.includes(String(r.year))||!HEX.test(r.rowKey??''))
   throw Error('Non-contribution row or malformed full comparator');
  const k=yearReg(r.reg,r.year);
  if(!allByYearReg.has(k))allByYearReg.set(k,[]);
  allByYearReg.get(k).push(r);allKeys.add(billKey(r));
 }
 if([...keys].some(k=>!allKeys.has(k)))
  throw Error('All-committee-year collision comparator missing a PAC contribution');
 const spansByReport=new Map();
 for(const s of spans){
  if(typeof s.report_version_id!=='string'||!s.report_version_id||
   s.schedule_family!=='candidate_contribution'||
   !Number.isInteger(Number(s.page_number))||
   s.readiness!=='multiple_amount_columns'&&
   s.readiness!=='single_amount_name_visible'&&
   s.readiness!=='insufficient_printed_fields')
   throw Error('Untrusted PDF v2 span');
  if(!spansByReport.has(s.report_version_id))
   spansByReport.set(s.report_version_id,[]);
  spansByReport.get(s.report_version_id).push(s);
 }
 const signals=new Map();
 for(const p of pages){
  if(!HEX.test(p.pdf_sha256??'')||!Number.isInteger(Number(p.page_number))||
   typeof p.raw_page_text!=='string')
   throw Error('Invalid immutable original PDF text page');
  signals.set(p.pdf_sha256+'|'+p.page_number,
   pageScheduleSignals(p.raw_page_text));
 }
 const reportIds=new Set(),candidateVersionsByRow=new Map(),
  ambiguousKeys=new Set();
 let versionPairs=0,reportedVersions=0,missingV2=0,
  supportedSpans=0,unsupportedMultiSpans=0,comparatorRows=0;
 for(const r of reports){
  if(reportIds.has(r.report_version_id)||
   !REG.test(r.committee_registration??'')||
   !YEARS.includes(String(r.report_year))||
   !HEX.test(r.pdf_sha256??'')||
   r.captured_pdf_sha!==r.pdf_sha256)
   throw Error('Broken official SHA-paired extracted original PDF');
  reportIds.add(r.report_version_id);
  const y=String(r.report_year);
  const relevant=allByYearReg.get(yearReg(r.committee_registration,y))??[];
  const sourceSpans=spansByReport.get(r.report_version_id)??[];
  if(!r.v2_extraction_present){
   missingV2++;byYear[y].indexedPdfVersionsWithoutV2Extraction++;
   if(sourceSpans.length)throw Error('Orphan extracted row spans');
   continue;
  }
  reportedVersions++;byYear[y].indexedPdfVersionsWithV2Extraction++;
  const flags=new Map();
  for(const s of sourceSpans){
   const f=signals.get(r.pdf_sha256+'|'+s.page_number);
   if(f)flags.set(Number(s.page_number),f);
  }
  // Important: compare against *ALL* campaign contribution rows for this
  // candidate committee/year to avoid falsely "uniquely" matching the
  // PAC-subset when another contributor row competes for that same PDF span.
  const shadow=shadowMatchReportRows(relevant,sourceSpans,Number(y),
   r.committee_registration,flags);
  supportedSpans+=shadow.arithmeticallySupportedSpans;
  unsupportedMultiSpans+=shadow.unsupportedMultiSpans;
  comparatorRows+=shadow.reportVersionCanonicalRows;
  for(const link of shadow.uniqueCandidateLinks){
   const parts=link.canonicalKey.split('|');
   if(parts.length!==4||parts[0]!=='candidate_contribution')continue;
   const key=parts.slice(1).join('|');
   if(!keys.has(key))continue;
   versionPairs++;
   byYear[y].sourceQualifiedProvisionalReportRowPairs++;
   if(!candidateVersionsByRow.has(key))candidateVersionsByRow.set(key,new Set());
   candidateVersionsByRow.get(key).add(r.report_version_id);
  }
  // The old v3 matcher emits aggregate ambiguity; do not pretend that an
  // ambiguity over the entire committee/year is specific to one PAC donor.
  if(shadow.ambiguousCanonicalRows>0)
   ambiguousKeys.add(r.report_version_id);
 }
 const keysWithCandidate=[...candidateVersionsByRow.keys()];
 for(const k of keysWithCandidate)
  byYear[yearByKey.get(k)].distinctCanonicalRowsWithProvisionalOriginalCandidate++;
 const multi=[...candidateVersionsByRow.values()].filter(v=>v.size>1).length;
 const summary={
  schema:PAC116_COLUMN_SHADOW_SCHEMA,
  interpretation:'strictly_provisional_original_report_candidates_not_containment',
  scopedCanonicalPACContributions:keys.size,
  sourceReportVersionsExamined:reports.length,
  sourceVersionsWithV2Extraction:reportedVersions,
  sourceVersionsWithoutV2Extraction:missingV2,
  allCandidateCommitteeYearRowComparisons:comparatorRows,
  sourceHeaderArithmeticSupportedSpans:supportedSpans,
  sourceMultiAmountSpansWithoutArithmeticHeaderProof:unsupportedMultiSpans,
  provisionalReportVersionContributionPairs:versionPairs,
  distinctPacContributionRowsWithProvisionalCandidate:keysWithCandidate.length,
  distinctPacRowsProvisionalAcrossMultipleReportVersions:multi,
  cohortRowsWithoutEvenProvisionalCandidate:keys.size-keysWithCandidate.length,
  originalReportsWithAmbiguityAmongAllCommitteeYearRows:ambiguousKeys.size,
  perYear:byYear,
  independentOriginalPdfTransactionProofsNewlyCertified:0,
  exactHistoricalFirstPublicVersionDatesCertified:0,
  strictHistoricalForecastEligibilityChanged:false,
  originalSourceEvidenceRowsOrModelWeightsChanged:false
 };
 const safe=v=>{
  if(typeof v==='number'&&(!Number.isSafeInteger(v)||v<0||v>1_000_000))
   throw Error('Unsafe original PDF source shadow aggregate');
  if(v&&typeof v==='object')for(const x of Object.values(v))safe(x);
 };
 safe(summary);
 return summary;
}
