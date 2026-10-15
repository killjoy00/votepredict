/**
 * #864 V46: independent offline replay of practical estimated public
 * availability for every currently indexed 2021-2025 CFB Senate PDF version.
 *
 * Original V41/V42 official data is SHA-anchored. These are estimates,
 * NOT independently dated exact historic PDF publication, not a new
 * time-travel prediction eligibility authorization and not PDF changes.
 *
 * Standard (non-special) pre-election and year-end dues use the official
 * candidate calendars; all 2024/25 special-election deadlines are inferred
 * by report period close +7 days as labelled. The release floor always uses
 * 8AM Chicago time on the NEXT day after the applicable report DUE date.
 * Receipt dates after that floor become next-day conservative assumptions.
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {verifyAll830SenateCFBPDFSourceVersionsV41}
 from './audit-cfb-864-830-full-pdf-source-v41.mjs';
import {audit388SourceReportSummariesAndAmendmentsV42}
 from './audit-cfb-864-388-report-content-and-dates-v42.mjs';

export const SCHEMA='cfb-864-830-dated-availability-with-release-floor-v46';
const BASE='docs/evaluation/source-proof/';
const LEDGER=BASE+'cfb-2021-25-95-senators-830-indexed-830-downloaded-v41.psv';
const EXTRA=BASE+'cfb-2021-25-388-report-level-summary-and-date-review-v42.psv';
const CHECK='data/cfb-2021-25-nine-five-review-dispositions-v45.json';
const AFTER='data/cfb-2021-25-830-estimated-availability-v46.json';
const V26=BASE+'cfb-2021-22-served-amendment-26-pdf-source.psv';
const PIN='cf36b94566c94af4531c0e5ffb2698d761f9d811';
const SHA=/^[a-f0-9]{64}$/,DATE=/^\d{4}-\d{2}-\d{2}$/;
function gitBlobHash(s){return createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex')}
function iso(x){return typeof x==='string'&&DATE.test(x)&&!Number.isNaN(new Date(x+'T00:00:00Z').valueOf())&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;}
function plus(x,days){if(!iso(x))throw Error('Illegal date '+x);return new Date(new Date(x+'T00:00:00Z').getTime()+days*86400000).toISOString().slice(0,10)}
function endFor(r,bySha,byId){
 function field(s){const earlier=s[15]!=='-'?s[15]:byId.get(s[0])?.[16];return earlier&&earlier!=='-'?earlier:null;}
 let end=field(r);
 if(!end){const same=bySha.get(r[10]).filter(s=>s[0].split(':').slice(0,5).join(':')===r[0].split(':').slice(0,5).join(':'));end=same.map(field).find(Boolean);}
 if(end&&!iso(end))throw Error('Bad original PDF covered period '+r[0]);
 return end??null;
}
function due(r,bySha,byId){
 const y=Number(r[2]),period=r[4],special=r[0].split(':')[4]==='1';
 if(special){
  const end=endFor(r,bySha,byId);
  if(!end)throw Error('Special source has no report period close '+r[0]);
  const on=plus(end,7);
  return {due:on,release:plus(on,1),rule:'special_reporting_due_inferred_seven_days_after_cover_end'};
 }
 if(period==='YE'){
  const mapped={2021:'2022-01-31',2022:'2023-01-31',2023:'2024-01-31',
   2024:'2025-01-31',2025:'2026-02-02'};
  const on=mapped[y];if(!on)throw Error('Unsupported year-end due year');
  return{due:on,release:plus(on,1),rule:'official_year_end_due_calendar'};
 }
 if(y===2022&&period==='C')return{due:'2022-07-25',release:'2022-07-26',rule:'official_2022_candidate_preprimary_calendar'};
 if(y===2022&&period==='E')return{due:'2022-10-31',release:'2022-11-01',rule:'official_2022_candidate_pregeneral_calendar'};
 throw Error('Unknown CFB original report due class '+r[0]);
}
export function auditEveryOfficialCFBDocumentHasPracticalDateV46(){
 const original=verifyAll830SenateCFBPDFSourceVersionsV41();
 const content=audit388SourceReportSummariesAndAmendmentsV42();
 if(original.completeOfficialGovernmentPDFVersionSources!==830||
  original.distinctWholeGovernmentPdfBodies!==813||
  content.sourceReportVersionsReviewed!==388||
  content.verifiedOriginalGovernmentPdfSummaryReceiptTotals!==379)
  throw Error('Prior immutable V41/V42 source verification changed');
 const ledger=readFileSync(LEDGER,'utf8').trimEnd().split('\n').map(x=>x.split('|'));
 const v42=readFileSync(EXTRA,'utf8').trimEnd().split('\n').map(x=>x.split('|'));
 const v45=JSON.parse(readFileSync(CHECK,'utf8'));
 const raw=readFileSync(AFTER,'utf8');
 const putnam=readFileSync(V26,'utf8').trimEnd().split('\n').map(x=>x.split('|')).find(x=>x[0]==='18430:21:pcc:YE:0:1');
 if(!raw.endsWith('\n')||raw.includes('\r')||gitBlobHash(raw)!==PIN||
  putnam?.[6]!=='2026-10-11T03:59:15.582Z')
  throw Error('V46 accepted government-source dates or first observed copy changed');
 const dates=JSON.parse(raw);
 if(ledger.length!==830||v42.length!==388||dates.schema!=='cfb-864-830-dated-official-PDF-estimated-availability-v46'
  ||dates.total!==830||dates.records?.length!==830||
  dates.hasActualDateForEveryDocument!==true||dates.originalSourcePDFsIdentical!==true
  ||dates.noBackdatedModelOrDatabaseChanges!==true
  ||dates.websiteFirstObservedFallbackOn!=='2026-10-15'
  ||dates.methods.pdf_board_stamp_with_statutory_floor!==807
  ||dates.methods.identical_full_pdf_sha_stamp_inferred!==13
  ||dates.methods.scheduled_release_assuming_filed_on_time!==6
  ||dates.methods.first_observed_official_site_copy!==4)
  throw Error('Dated source ledger lacks 830 version records or declared provenance');
 const byVersion=new Map(ledger.map(x=>[x[0],x]));
 const byV42=new Map(v42.map(x=>[x[0],x]));
 const bySha=new Map();
 for(const x of ledger){const list=bySha.get(x[10])??[];list.push(x);bySha.set(x[10],list);}
 const byUser=new Map(v45.resolutions.map(x=>[x.versionId,x]));
 if(byVersion.size!==830||byV42.size!==388)throw Error('Original PDF indexed versions duplicated');
 function stampOf(r){
  const initial=r[13]!=='-'?r[13]:null,parsed=byV42.get(r[0])?.[17];
  const fromV42=parsed&&parsed!=='-'?parsed:null;
  if(initial&&fromV42&&initial!==fromV42)throw Error('Original PDF metadata conflicts');
  const stamp=initial??fromV42;
  if(stamp&&!iso(stamp))throw Error('Source PDF stamp not valid date');
  return stamp??null;
 }
 let count={pdf_board_stamp_with_statutory_floor:0,
   identical_full_pdf_sha_stamp_inferred:0,
   scheduled_release_assuming_filed_on_time:0,
   first_observed_official_site_copy:0};
 const seen=new Set();let earlySourceStamps=0,special=0,post2025YearEnd=0;
 for(const x of dates.records){
  const r=byVersion.get(x.id);
  if(!r||seen.has(x.id)||x.senator!==r[1]||x.year!==Number(r[2])
   ||x.period!==r[4]||x.sourceFullPdfSHA256!==r[10]||
   !SHA.test(x.sourceFullPdfSHA256)||
   x.amendmentIndex!==Number(r[5])||x.specialElection!==(r[0].split(':')[4]==='1')||
   !iso(x.estimatedAvailableOn)||!iso(x.websiteObservedByOn)||
   x.estimatedAvailableOn>x.websiteObservedByOn||
   x.independentlyProvenHistoricalExactVersionPublicBy!==false)
   throw Error('Dated source not exact same government PDF identity '+x.id);
  const expectedDue=due(r,bySha,byV42);
  if(x.reportDueOn!==expectedDue.due||x.releaseFloorOn!==expectedDue.release||
   x.dueRule!==expectedDue.rule||
   x.estimatedAvailableOn<x.releaseFloorOn)
   throw Error('Illegal early public availability; official release floor violated: '+x.id);
  if(x.specialElection)special++;
  if(x.year===2025&&!x.specialElection&&x.period==='YE'){
   if(x.releaseFloorOn!=='2026-02-03')throw Error('2026 Feb 2 official due adjustment lost');
   post2025YearEnd++;
  }
  const ownStamp=stampOf(r),owner=byUser.get(x.id);
  if(x.boardReceivedOnOriginal!==ownStamp)throw Error('Original government Board stamp was rewritten '+x.id);
  let method,confidence,estimate;
  let nearest=null, sourceStamp=ownStamp;
  if(sourceStamp){method='pdf_board_stamp_with_statutory_floor';confidence='medium';}
  else {
   const same=bySha.get(r[10]).filter(other=>other[0]!==x.id&&other[0].split(':').slice(0,5).join(':')===x.id.split(':').slice(0,5).join(':')&&stampOf(other));
   if(same.length){
    same.sort((a,b)=>stampOf(a).localeCompare(stampOf(b)));
    nearest=same[0];sourceStamp=stampOf(nearest);
    method='identical_full_pdf_sha_stamp_inferred';confidence='medium_low';
   }else if(r[5]==='0'){method='scheduled_release_assuming_filed_on_time';confidence='low_estimate';}
   else{method='first_observed_official_site_copy';confidence='high_observed_by_not_historic';}
  }
  const expectedObserved=x.id==='18430:21:pcc:YE:0:1'?'2026-10-11':'2026-10-15';
  if(x.method!==method||x.confidence!==confidence||x.websiteObservedByOn!==expectedObserved||
   (x.samePdfSourceVersionId??null)!==(nearest?.[0]??null))
   throw Error('Government PDF first observed date or duplicate-body provenance does not match '+x.id);
  if(method==='first_observed_official_site_copy')estimate=expectedObserved;
  else if(method==='scheduled_release_assuming_filed_on_time')estimate=expectedDue.release;
  else{
   let receipt=sourceStamp;
   if(owner?.reviewDisposition==='later_of_printed_stamp_or_period_end_used_for_review'){
    if(ownStamp!==owner.originalPrintedBoardReceivedOn
      ||owner.effectiveReviewOn!==owner.originalReportedPeriodEndOn
      ||x.ownerReviewDateOn!==owner.effectiveReviewOn)
     throw Error('Owner later-date rule not preserved '+x.id);
    receipt=[sourceStamp,owner.effectiveReviewOn].sort().at(-1);
   }else if(x.ownerReviewDateOn!==undefined)
    throw Error('Spurious owner date override '+x.id);
   estimate=[plus(receipt,1),expectedDue.release].sort().at(-1);
  }
  if(estimate!==x.estimatedAvailableOn)throw Error('Per-report date recomputation mismatch: '+x.id);
  if(ownStamp&&ownStamp<expectedDue.due)earlySourceStamps++;
  count[method]++;seen.add(x.id);
 }
 if(seen.size!==830||special!==28||post2025YearEnd!==115||
  Object.keys(count).some(k=>count[k]!==dates.methods[k]))
  throw Error('All indexed versions not covered by source-specific availability policy');
 return{schema:SCHEMA,
  distinctSourceAuthenticatedGovernmentVersions:830,
  datedDocuments:seen.size,
  exactOriginalBoardDateDerived:807,wholePdfSameBodyInherited:13,
  releaseScheduleAssumedTimelyForUndatedOriginals:6,
  websiteFirstObservedFallbackOnly:4,
  statutoryFloorEnforcedOnAll:830,
  conservativeDueAdjustment2025YearEndApplied:115,
  specialElectionCyclesHandled:28,
  independentExactHistoricPublicationDatesProven:0,
  existingHistoricalModelEligibilityRecomputed:false,
  originalCFBSourcePDFsUnchanged:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2)throw Error('No input override of frozen original CFB source date records');
 console.log('CFB_864_830_DATES_V46 '+JSON.stringify(auditEveryOfficialCFBDocumentHasPracticalDateV46()));
}