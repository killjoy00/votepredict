/**
 * #864: PAC-specific canonical Senate CONTRIBUTION provenance triage.
 * Only the currently dual-original-attested 2026 PAC registrations are inputs;
 * no retrospective 2021-25 affiliation/publication eligibility is asserted.
 * Exact original PDF containment is distinct from historical public-by time.
 * This is aggregate research only and cannot change any model or evidence.
 */
import {createHash} from 'node:crypto';
import {normalizePrintedName,validDay}
 from './cfb-report-schedule-raw.mjs';

export const CFB_PAC_CONTRIBUTION_PROVENANCE_VERSION=
 'cfb-pac-contribution-report-provenance-readonly-v1';
const HEX=/^[a-f0-9]{64}$/;
const REG=/^[0-9]{3,8}$/;
const YEARS=['2021','2022','2023','2024','2025'];
const SUM_FIELDS=[
 'canonicalTransactions','evidenceCopies','conflictingCopies',
 'withoutValidFilerOrDateAmount','withOneCandidateReportVersion',
 'withMultipleCandidateReportVersions','withNoIndexedCandidateReport',
 'withCurrentOriginalPdfExactEntry','withAmbiguousExistingReportLinks',
 'withUnmatchedExistingReportLinks','withNoStoredReportLink',
 'withPdfExactAndVerifiedDueReleaseFloor','withPdfExactButReleaseFloorUnverified',
 'withPdfExactAndIndependentHistoricalPublicBy',
 'withIndependentBulkArchiveRowObservation','withArchiveRowObservedBy2025',
 'withLegacyAsOfEligibleClaim','withLegacyClaimEarlierThanMatchedLegalFloor'
];
function blank(){
 return Object.fromEntries(SUM_FIELDS.map(k=>[k,0]));
}
function checkedDate(s){return validDay(s)?s:null;}
function laterDay(s){
 if(!validDay(s))return null;
 const d=new Date(s+'T00:00:00.000Z');
 d.setUTCDate(d.getUTCDate()+1);
 return d.toISOString().slice(0,10);
}
function cents(value){
 if(typeof value!=='string'&&typeof value!=='number')return null;
 if(!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/.test(String(value)))
  return null;
 const n=Number(value);
 return Number.isSafeInteger(Math.round(n*100))&&n>0?Math.round(n*100):null;
}
function nameProof(printed,name){
 const n=normalizePrintedName(name);
 if(n.length<5||n==='unknown')return false;
 const words=n.split(' ');
 const variants=[n];
 if(words.length>=2&&words.length<=6)
  variants.push(words.at(-1)+' '+words.slice(0,-1).join(' '));
 const p=' '+normalizePrintedName(printed)+' ';
 return variants.some(x=>p.includes(' '+x+' '));
}
function baseKey(reg,rowKey){return String(reg??'')+'|'+String(rowKey??'');}
function exactRowSignature(r){
 return [r.filer_reg,r.year,r.contributor_reg,r.transaction_date,
  String(r.amount),r.member_id,r.contributor].map(x=>String(x??'')).join('|');
}
function sourceArchiveIsValid(a){
 return a.family==='candidate_contribution'&&
  REG.test(a.committee_registration??'')&&
  YEARS.includes(String(a.transaction_year))&&HEX.test(a.canonical_row_key??'')&&
  HEX.test(a.source_sha256??'')&&a.proof_kind==='independent_archive_capture_exact_row'&&
  !Number.isNaN(Date.parse(a.independently_observed_at??''))&&
  String(a.independently_observed_at).endsWith('Z');
}
function attestedRegs(statuses){
 if(!Array.isArray(statuses)||statuses.length!==3)
  throw Error('Three contemporary original-PAC identity decisions required');
 const found=new Set();
 for(const s of statuses){
  if(!REG.test(s.registration??'')||found.has(s.registration))
   throw Error('Invalid PAC attestation identity');
  found.add(s.registration);
  if(!['current_dual_original_source_attested',
   'held_no_explicit_first_party_pac_proof',
   'missing_or_invalid_original_source',
   'official_registration_row_not_demonstrated',
   'first_party_pac_identity_not_demonstrated'].includes(s.status))
    throw Error('Unrecognized PAC identity disposition');
 }
 const accepted=statuses.filter(s=>s.status==='current_dual_original_source_attested');
 // Current-only source proof MUST be present. Do not silently adopt an
 // unproved third PAC or treat the 2026 identity as historical affiliation.
 if(accepted.length!==2||!accepted.every(s=>
  validDay(s.observedByOn)&&s.observedByOn>='2026-10-17'&&
  s.retrospectivelyUsable===false))
  throw Error('Expected exactly two source-attested contemporary PACs');
 return new Set(accepted.map(s=>s.registration));
}
function versionGood(v){
 return v&&REG.test(v.committee_registration??'')&&
  YEARS.includes(String(v.report_year))&&HEX.test(v.full_original_pdf_sha256??'')&&
  HEX.test(v.captured_pdf_sha??'')&&
  v.captured_pdf_sha===v.full_original_pdf_sha256&&
  v.report_version_id&&typeof v.report_version_id==='string'&&
  validDay(v.website_observed_on)&&
  v.historical_exact_version_public_by_proven===false;
}
function realOriginalLine(link,r,version){
 return versionGood(version)&&
  link.match_status==='exact'&&link.family==='candidate_contribution'&&
  link.report_version_id===version.report_version_id&&
  link.committee_registration===version.committee_registration&&
  Number(link.transaction_year)===Number(version.report_year)&&
  link.committee_registration===r.filer_reg&&
  Number(link.transaction_year)===Number(r.year)&&
  link.canonical_row_key===r.row_key&&
  Number(link.possible_entry_count)===1&&
  link.entry_id!=null&&
  String(link.entry_id)===String(link.matched_entry_id??'')&&
  link.entry_schedule_family==='candidate_contribution'&&
  checkedDate(link.entry_date)===r.transaction_date&&
  Number(link.entry_cents)===cents(r.amount)&&
  nameProof(link.entry_line,r.contributor);
}
export function scoreCfbPacContributionProvenance({
 canonicalRows,reportVersions,reportLinks,archiveRows,attestationStatuses,
 independentlyVerifiedPdfHashes=[]
}){
 const approved=attestedRegs(attestationStatuses);
 if(!Array.isArray(canonicalRows)||canonicalRows.length>2000||
  !Array.isArray(reportVersions)||reportVersions.length>830||
  !Array.isArray(reportLinks)||reportLinks.length>20000||
  !Array.isArray(archiveRows)||archiveRows.length>2000||
  !Array.isArray(independentlyVerifiedPdfHashes))
  throw Error('Unbounded or unavailable CFB PAC source records');
 const hashes=new Set(independentlyVerifiedPdfHashes);
 if([...hashes].some(x=>!HEX.test(x)))throw Error('Unsafe PDF verification digest');
 const versions=new Map(),byYearReg=new Map();
 for(const v of reportVersions){
  if(!REG.test(v.committee_registration??'')||
   !YEARS.includes(String(v.report_year))||
   !HEX.test(v.full_original_pdf_sha256??'')||
   versions.has(v.report_version_id))
   throw Error('Malformed or duplicate original CFB report version');
  versions.set(v.report_version_id,v);
  const key=v.committee_registration+'|'+v.report_year;
  if(!byYearReg.has(key))byYearReg.set(key,[]);
  byYearReg.get(key).push(v);
 }
 const cohort=new Map();let copies=0;
 for(const r of canonicalRows){
  if(!approved.has(r.contributor_reg)||!HEX.test(r.row_key??'')||
   !YEARS.includes(String(r.year)))
   throw Error('Out-of-scope PAC campaign contribution or row-key');
  copies++;
  const key=baseKey(r.filer_reg,r.row_key);
  const previous=cohort.get(key);
  if(!previous){cohort.set(key,{row:r,contradiction:false,claims:[]});}
  else if(exactRowSignature(previous.row)!==exactRowSignature(r))
   previous.contradiction=true;
  cohort.get(key).claims.push(r);
 }
 const linksByRow=new Map();
 for(const l of reportLinks){
  if(l.family!=='candidate_contribution'||!HEX.test(l.canonical_row_key??'')||
   !YEARS.includes(String(l.transaction_year))||
   !['exact','ambiguous','unmatched'].includes(l.match_status))
   throw Error('Unsafe report link');
  const key=baseKey(l.committee_registration,l.canonical_row_key);
  if(!cohort.has(key))throw Error('Report link escaped selected PAC cohort');
  if(!linksByRow.has(key))linksByRow.set(key,[]);
  linksByRow.get(key).push(l);
 }
 const archiveByRow=new Map();
 for(const a of archiveRows){
  if(!sourceArchiveIsValid(a))throw Error('Unsafe independent archive observation');
  const key=baseKey(a.committee_registration,a.canonical_row_key);
  if(!cohort.has(key))throw Error('Archive record escaped selected PAC cohort');
  if(!archiveByRow.has(key))archiveByRow.set(key,[]);
  archiveByRow.get(key).push(a);
 }
 const total=blank(),perYear=Object.fromEntries(YEARS.map(y=>[y,blank()]));
 const keys=new Set();
 let exactVersionEntryPairs=0,conflictingOriginalReportClaims=0;
 const disposition={exact_current_pdf_entry:0,ambiguous_only:0,not_found:0};
 for(const [key,item] of cohort){
  const r=item.row;
  const rowMetrics=blank();
  rowMetrics.canonicalTransactions=1;
  rowMetrics.evidenceCopies=item.claims.length;
  rowMetrics.conflictingCopies=Number(item.contradiction);
  rowMetrics.withLegacyAsOfEligibleClaim=Number(item.claims.some(c=>
   c.as_of_eligible===true||c.as_of_eligible==='true'));
  const rowValid=REG.test(r.filer_reg??'')&&validDay(r.transaction_date)&&
   cents(r.amount)!==null&&!item.contradiction&&
   typeof r.contributor==='string'&&r.contributor.trim().length>=5;
  rowMetrics.withoutValidFilerOrDateAmount=Number(!rowValid);
  const plausible=byYearReg.get(r.filer_reg+'|'+r.year)??[];
  rowMetrics.withNoIndexedCandidateReport=Number(!plausible.length);
  rowMetrics.withOneCandidateReportVersion=Number(plausible.length===1);
  rowMetrics.withMultipleCandidateReportVersions=Number(plausible.length>1);
  const allLinks=linksByRow.get(key)??[];
  rowMetrics.withNoStoredReportLink=Number(allLinks.length===0);
  rowMetrics.withAmbiguousExistingReportLinks=Number(
   allLinks.some(l=>l.match_status==='ambiguous'));
  rowMetrics.withUnmatchedExistingReportLinks=Number(
   allLinks.some(l=>l.match_status==='unmatched'));
  const exact=[];
  for(const l of allLinks){
   const v=versions.get(l.report_version_id);
   if(!v||v.committee_registration!==r.filer_reg||
    Number(v.report_year)!==Number(r.year)){
    conflictingOriginalReportClaims++;continue;
   }
   if(rowValid&&realOriginalLine(l,r,v)&&
    hashes.has(v.full_original_pdf_sha256))exact.push(v);
  }
  const verified=[...new Map(exact.map(v=>[v.report_version_id,v])).values()];
  rowMetrics.withCurrentOriginalPdfExactEntry=Number(verified.length>0);
  exactVersionEntryPairs+=verified.length;
  if(verified.length>0)disposition.exact_current_pdf_entry++;
  else if(rowMetrics.withAmbiguousExistingReportLinks)
   disposition.ambiguous_only++;
  else disposition.not_found++;
  const legallyDated=verified.filter(v=>
   validDay(v.report_due_on)&&
   validDay(v.statutory_release_floor_on)&&
   v.statutory_release_floor_on>=laterDay(v.report_due_on)&&
   validDay(v.website_observed_on)&&
   v.website_observed_on>=v.statutory_release_floor_on);
  rowMetrics.withPdfExactAndVerifiedDueReleaseFloor=Number(legallyDated.length>0);
  rowMetrics.withPdfExactButReleaseFloorUnverified=Number(
   verified.length>0&&legallyDated.length===0);
  // There is NO historical exact-version public-by proof in the official 0014
  // registry. Even a currently SHA-matched row cannot be dated before a
  // past vote merely from its report due date or a current PDF observation.
  rowMetrics.withPdfExactAndIndependentHistoricalPublicBy=0;
  const archives=archiveByRow.get(key)??[];
  rowMetrics.withIndependentBulkArchiveRowObservation=Number(archives.length>0);
  rowMetrics.withArchiveRowObservedBy2025=Number(archives.some(a=>
   a.independently_observed_at.slice(0,10)<='2025-12-31'));
  rowMetrics.withLegacyClaimEarlierThanMatchedLegalFloor=Number(
   legallyDated.length>0&&item.claims.some(c=>
    validDay(c.stored_published_on)&&
    legallyDated.every(v=>c.stored_published_on<v.statutory_release_floor_on)));
  for(const field of SUM_FIELDS){
   total[field]+=rowMetrics[field];
   perYear[String(r.year)][field]+=rowMetrics[field];
  }
  keys.add(key);
 }
 if(total.canonicalTransactions!==cohort.size||
  total.evidenceCopies!==copies||
  Object.values(disposition).reduce((a,b)=>a+b,0)!==cohort.size)
  throw Error('Cohort canonical partition invariant failed');
 const result={
  schema:CFB_PAC_CONTRIBUTION_PROVENANCE_VERSION,
  claimedPriorCohortSize:116,
  priorCohortSizeReproduced:cohort.size===116,
  attestedCurrentPacIdentities:approved.size,
  currentPacAffiliationProvesHistoricalIdentity:false,
  ...total,
  exactCurrentPdfVersionEntryPairs:exactVersionEntryPairs,
  reportLinkConflicts:conflictingOriginalReportClaims,
  reportContainmentDisposition:disposition,
  perYear:Object.fromEntries(YEARS.map(y=>[y,perYear[y]])),
  historicalStrictAsOfQualifiedRows:0,
  historicalFirstPublicVersionEvidenceConfirmed:false,
  candidateExpendituresCountedAsContributions:false,
  independentExpendituresCountedAsContributions:false,
  sourceEvidenceOrForecastsChanged:false,
  servingOrModelWeightsChanged:false
 };
 const safe=x=>{
  if(typeof x==='number'&&(!Number.isSafeInteger(x)||x<0||x>200000))
   throw Error('Unsafe campaign-finance summary number');
  if(Array.isArray(x))for(const y of x)safe(y);
  else if(x&&typeof x==='object')for(const y of Object.values(x))safe(y);
 };
 safe(result);
 return result;
}
export function independentlyRehashCfbPdf(bytes,expectedSha){
 if(!Buffer.isBuffer(bytes)||bytes.length<501||bytes.length>30000000||
  bytes.subarray(0,5).toString('ascii')!=='%PDF-'||
  !HEX.test(expectedSha??''))return false;
 return createHash('sha256').update(bytes).digest('hex')===expectedSha;
}
