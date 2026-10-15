/**
 * Minnesota #864 original CFB YE 2021/22 reporting document SOURCE ONLY.
 * Bounded 38 uniquely source-registered (2020 election segment) actual Senate
 * serving 2021+22 members, not candidates generally, each source checked
 * against the original 268 CFB district-page archive and original LRL Senate
 * service year and district. Does NOT infer legally owed report versions.
 *
 * PR-only government read, full PDF buffers/text never persisted or logged.
 * Full original signed PDF SHA, first page source identity, Board received,
 * original 2021 and 2022 annual periods/due only. Original source date/filing
 * clock is NEVER a positive historically public-by date.
 */
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {fetchCfbCandidateHistoricalReportReferenceSnapshot}
 from '../src/evidence/cfb-candidate-report-history.js';
import {fetchCfbReportViewerText,cfbReportViewerUrl}
 from '../src/evidence/cfb-current-report-acquisition.js';
import{parseServedYearEnd2021to22Header,SERVED_2021_22_YE_DUE,
 SERVED_2021_22_YE_CALENDAR_PDF_SHA}
 from '../src/evidence/cfb-2021-22-served-senator-yearend-original-proof.js';
import {verifyPinned57AgainstOriginalSourceCheckpoint,
 replay57AgainstEntireOriginal268PageBody,
 originalCfbCandidateLabelNameKey,originalOfficialMemberNameKey,
 parsePermanent57RegistrationLeadPsv}
 from './audit-cfb-864-57-actual-serving-candidate-registration-leads-v17.mjs';
import {verifyPermanent298SourceLedgers}
 from './audit-cfb-864-298-exact-reports-51-serving-principals-v19.mjs';
export const SCHEMA='cfb-864-2021-22-thirtyeight-actually-served-original-yearend-report-PDF-sources-v20';
const ORIGINAL_SERVICE='docs/evaluation/source-proof/cfb-2021-25-95-served-senator-38-report-principal-crosswalk-v16.psv';
const ORIG_CAL='docs/evaluation/source-proof/cfb-2021-22-senate-one-filer-original-reports-and-calendars.json';
const OFFICIAL_268_ARCHIVE='artifacts/official-268/cfb-senate-district-registrations.json';
const OFFICIAL_268_ORIGINAL_SOURCE_SHA='83770615658f7cf47802b05257bcbd45bed0c7c41ec19dfe99c31ca91b746c04';
const OFFICIAL='https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/';
const HASH=/^[a-f0-9]{64}$/;
const DUE={"2021":"2022-01-31","2022":"2023-01-31"};
export const MAX_PDF_REFERENCES_PER_MEMBER_YEAR=3; // original plus up to two edited versions, larger queue held
const RESEARCH_TIMEOUT_HINT='Public source only; incomplete retrieval produces a source HOLD, not an absent filing';
const MARKER='CFB_864_38_ACTUALLY_SERVED_2021_22_YE_PDFS_V20 ';
function k(name){
 const words=String(name).normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9 ]/g,' ').trim().split(/\s+/)
  .filter(x=>x&&!['jr','sr','ii','iii','iv'].includes(x));
 return words.length>=2?words[0]+'|'+words.at(-1):null;
}
function regRef(ref){
 return [ref.registrationNumber,ref.year,ref.type,ref.period,ref.se,String(ref.amendment)].join(':');
}
export function chooseActual38ServingSenatorsIn2021And2022(){
 verifyPinned57AgainstOriginalSourceCheckpoint();
 const existing=verifyPermanent298SourceLedgers();
 if(existing.officialVersionReferences!==298||
  existing.servingPersonsNotYetInSelectedOriginalPDFSourcePanel!==44)
  throw Error('Prior 298 authentic report source parent changed');
 const sourceNames=readFileSync(ORIGINAL_SERVICE,'utf8')
  .trimEnd().split('\n').map(x=>x.split('|'));
 if(sourceNames.length!==95||sourceNames.some(x=>x.length!==10))
  throw Error('Actual Senate service original source missing');
 const byName=new Map(sourceNames.map(x=>[x[0],x]));
 const target=parsePermanent57RegistrationLeadPsv().filter(r=>
  r.earliestOriginalViewerSegment===2020&&r.identityStatus==='EXACT'
  &&['2021','2022'].every(y=>byName.get(r.officialSenator)?.[1].split(',').includes(y)));
 if(target.length!==38||new Set(target.map(r=>r.committeeRegistrationLead)).size!==38)
  throw Error('Original 38 serving 2021-22 Senate CFB source principals drift');
 const result=target.map(p=>{
  const member=byName.get(p.officialSenator);
  const originalDistricts=[...new Set(member[2].split(';')
   .filter(v=>v.startsWith('2021:')||v.startsWith('2022:'))
   .flatMap(v=>v.split(':')[1].split(',').map(Number)))];
  if(member[4]!=='-'||member[0]!==p.officialSenator
   ||!originalDistricts.includes(p.originalCandidatePageDistrict)
   ||!HASH.test(p.originalCandidatePageSha256))
   throw Error('Official 2021/22 actual serving term/district/registered candidate identity mismatch');
  return{officialSenator:p.officialSenator,reg:p.committeeRegistrationLead,
   originalCfb2020CandidateLabel:p.originalCfbCandidateLabel,
   source2020District:p.originalCandidatePageDistrict,
   originalPageSha:p.originalCandidatePageSha256,
   servingDistricts2021And2022:originalDistricts,
   // Independently authenticated official LRL actual 2023 service term. Only
   // a 2022-report redistricted printed SD matching THIS official term can pass.
   independentlyDocumented2023ServingDistricts:member[2].split(';')
    .filter(v=>v.startsWith('2023:'))
    .flatMap(v=>v.split(':')[1].split(',').map(Number))
  };
 }).sort((a,b)=>a.source2020District-b.source2020District);
 return result;
}
// Caller must independently replay and SHA-validate the FULL 268-page archive
// before passing the parsed payload. This lookup never equates an old Senate
// incumbency district with the post-redistricting candidate filing district.
export function attach2022GovernmentCandidateDistricts(targets,source){
 if(!Array.isArray(source?.observations)||source.observations.length!==268)
  throw Error('The official government 268-page original archive is required');
 const byReg=new Map(targets.map(t=>[t.reg,t]));
 const found=new Map(targets.map(t=>[t.reg,[]]));
 const labelHolds=new Set();
 for(const o of source.observations){
  if(o.segmentEndYear!==2022||o.status!=='candidate_labels_observed')continue;
  if(!Number.isInteger(o.district)||o.district<1||o.district>67
    ||!HASH.test(o.htmlSha256))
   throw Error('Official archived 2022 candidate district/source SHA invalid');
  for(const c of o.candidates??[]){
   const t=byReg.get(String(c.registrationNumber));if(!t)continue;
   if(originalCfbCandidateLabelNameKey(c.candidateDisplayName)!==
      originalOfficialMemberNameKey(t.officialSenator)){
     labelHolds.add(t.reg);continue;
   }
   found.get(t.reg).push({district:o.district,originalOfficialPageSha256:o.htmlSha256});
  }
 }
 return targets.map(t=>{
  const pairs=found.get(t.reg);
  // One changed-name observation invalidates the 2022 archived candidate proof
  // for the registration, rather than accepting any other same-reg row.
  const clean=labelHolds.has(t.reg)?[]:pairs;
  const unique=[...new Map(clean.map(x=>[x.district+':'+x.originalOfficialPageSha256,x])).values()];
  return{...t,independentlyDocumented2022CfbCandidateDistricts:
   [...new Set(unique.map(x=>x.district))].sort((a,b)=>a-b),
   archivedOriginal2022CfbDistrictPageHashes:unique.map(x=>x.originalOfficialPageSha256),
   archived2022RegistrationCandidateNameDriftHold:labelHolds.has(t.reg)};
 });
}
export function independentlyReplayOriginal268AndAttach2022CfbDistricts(targets){
 const bytes=readFileSync(OFFICIAL_268_ARCHIVE);
 const proof=replay57AgainstEntireOriginal268PageBody(bytes);
 if(proof.sourceArchiveOriginalJsonSha256!==OFFICIAL_268_ORIGINAL_SOURCE_SHA
   ||proof.entireOriginal268GovernmentPagesIndependentlyReplayed!==true)
  throw Error('Archived source 2022 registration district not SHA-replayed');
 return attach2022GovernmentCandidateDistricts(targets,JSON.parse(bytes.toString('utf8')));
}

export function verifyIndependentOriginalYearendCalendars(){
 const erin=JSON.parse(readFileSync(ORIG_CAL,'utf8'));
 if(erin.scope?.registrationNumber!=='18443'||erin.reportProofs?.length!==2)
  throw Error('Original Senate source calendar independent proof absent');
 for(const p of erin.reportProofs){
  const due=DUE[String(p.reportYear)];
  if(!due||p.independentDueCalendar?.specificYearEndReportDueOn!==due
   ||p.independentDueCalendar?.originalCalendarDueDateVerified!==true
   ||!HASH.test(p.independentDueCalendar.originalPdfSha256)
   ||p.originalPeriodStartOn!==p.reportYear+'-01-01'
   ||p.originalPeriodEndOn!==p.reportYear+'-12-31'
   ||p.independentlyProvenHistoricalPublicByOn!==null)
   throw Error('Original 2021/22 yearend due/date/report coverage source changed');
 }
 if(erin.reportProofs[0].independentDueCalendar.originalPdfSha256!==SERVED_2021_22_YE_CALENDAR_PDF_SHA)
  throw Error('Original 2022 Senate campaign calendar SHA changed');
 return true;
}
export function sourceYearEndReferences(t,snapshot){
 if(snapshot?.registrationNumber!==t.reg||snapshot?.segmentEndYear!==2022
  ||snapshot.sourceUrl!==OFFICIAL+t.reg+'/2022/'
  ||!HASH.test(snapshot.responseSha256))
  throw Error('Not this registration historical original CFB 2022 report viewer API');
 const rows=snapshot.references.filter(r=>r.registrationNumber===t.reg
  &&['21','22'].includes(r.year)
  &&r.type==='pcc'&&r.period==='YE'&&r.se==='0'
  &&Number.isInteger(r.amendment)&&r.amendment>=0&&r.amendment<=99);
 const selected=[],holds=[];
 for(const year of [2021,2022]){
  const refs=rows.filter(r=>r.year===String(year).slice(2))
   .sort((a,b)=>a.amendment-b.amendment);
  if(!refs.some(r=>r.amendment===0)){
   holds.push({reportYear:year,
    sourceStatus:'original_government_yearend_version_not_indexed_in_current_retrieved_viewer_not_nonfiling',
    officialIndexedVersionReferences:refs.length});
   continue;
  }
  const accepted=refs.slice(0,MAX_PDF_REFERENCES_PER_MEMBER_YEAR);
  if(accepted.length!==new Set(accepted.map(regRef)).size)
   throw Error('Duplicate original CFB report viewer indexed exact yearend version');
  if(refs.length>accepted.length)
   holds.push({reportYear:year,sourceStatus:'additional_edited_government_version_references_not_downloaded',
    officialIndexedVersionReferences:refs.length,
    reviewedSourceReferences:accepted.length});
  selected.push(...accepted);
 }
 return{selected,holds,indexed2021and2022YE:rows.length};
}
function diagnosticForOfficialPdfFirstPage(t,text){
 const head=String(text??'').replace(/\u0000/g,'').replace(/\s+/g,' ').slice(0,6500);
 const label=head.search(/Registration\s+Number\s*:/i);
 const direct=head.match(/Registration\s+Number\s*:\s*(\d{4,8})\b/i)?.[1]??null;
 const vicinity=label>=0?head.slice(Math.max(label-600,0),label+600):'';
 const directOk=direct===t.reg,near=label>=0&&new RegExp('(?:^|\\D)'+t.reg+'(?:\\D|$)').test(vicinity);
 const senate=[...head.matchAll(/Senat(?:e|or)\s+District\s*:?\s*(\d{1,2})\b/gi)].map(x=>Number(x[1]));
 return{principalReportTitle:/Report of Receipts and Expenditures\s+for\s+Principal Campaign Committee/i.test(head),
  registrationLabelPresent:label>=0,
  directRegistrationNumberMatches:directOk,
  printedNumberFoundNearRegLabel:near,
  differentDirectNumberPrinted:direct!==null&&!directOk,
  printedDistricts:[...new Set(senate)].sort((a,b)=>a-b),
  printedDistrictMatchesIndependentlyServingOriginalTerm:[...new Set(senate)].some(x=>t.servingDistricts2021And2022.includes(x)),
  printedDistrictMatchesIndependentlyProven2023ServingTerm:[...new Set(senate)].some(x=>t.independentlyDocumented2023ServingDistricts.includes(x)),
  printedDistrictMatchesOriginalArchived2022CfbRegistration:[...new Set(senate)].some(x=>(t.independentlyDocumented2022CfbCandidateDistricts??[]).includes(x))};
}
export function originalHeader(t,ref,source,viewerSha,sourceError=null){
 const year=2000+Number(ref.year);
 if(![2021,2022].includes(year)
  ||ref.registrationNumber!==t.reg||ref.type!=='pcc'
  ||ref.period!=='YE'||ref.se!=='0'||!HASH.test(viewerSha))
  throw Error('Wrong exact official CFB historical annual report version');
 const id=regRef(ref);
 const valid=!!source&&source.sourceUrl===cfbReportViewerUrl(ref)
  &&HASH.test(source.contentSha256)
  &&Number.isSafeInteger(source.bytes)&&source.bytes>=1000
  &&source.bytes<=30_000_000
  &&Number.isFinite(Date.parse(source.fetchedAt));
 const printed=valid?diagnosticForOfficialPdfFirstPage(t,source.text):null;
 const head=valid?parseServedYearEnd2021to22Header({
  reg:t.reg,reportId:id,year,person:t.officialSenator,
  electionDistrict:t.source2020District,
  originalOfficial2021or2022SenateDistricts:t.servingDistricts2021And2022,
  independentlyDocumentedNextTermSenateDistricts:year===2022?
   t.independentlyDocumented2023ServingDistricts:[],
  independentlyDocumented2022CfbCandidateDistricts:year===2022?
   (t.independentlyDocumented2022CfbCandidateDistricts??[]):[],
  dueOn:DUE[String(year)],
  periodStartOn:year+'-01-01',periodEndOn:year+'-12-31'
 },source.text):null;
 const verified=valid&&!!head&&!sourceError;
 const notBefore=verified?[head.boardReceivedOn,
  year===2021?'2022-02-01':'2023-02-01'].sort().at(-1):null;
 return{
  id,person:t.officialSenator,sourceSenateDistrict:t.source2020District,
  source2021and2022ServingDistricts:t.servingDistricts2021And2022,
  independentlyDocumented2023ServingDistricts:t.independentlyDocumented2023ServingDistricts,
  independent2022OriginalCfbCandidateDistricts:t.independentlyDocumented2022CfbCandidateDistricts??[],
  independent2022OriginalCfbDistrictSourcePageShas:t.archivedOriginal2022CfbDistrictPageHashes??[],
  archived2022CandidateNameDriftHold:t.archived2022RegistrationCandidateNameDriftHold??false,
  registration:t.reg,reportYear:year,amendmentIndex:ref.amendment,
  viewerApiSha256:viewerSha,
  originalCandidateSourcePageSha256:t.originalPageSha,
  sourcePdfSha256:valid?source.contentSha256:null,
  sourcePdfBytes:valid?source.bytes:null,
  reportPeriodStartOn:verified?head.reportStartOn:null,
  reportPeriodEndOn:verified?head.reportEndOn:null,
  originalPrintedSenateDistrict:verified?head.printedSenateDistrict:null,
  boardReceivedOn:verified?head.boardReceivedOn:null,
  independentlyVerifiedOriginalCalendarDueOn:DUE[String(year)],
  conservativePossibleReleaseNotBeforeOn:notBefore,
  actualHistoricalExactPdfPublicByOn:null,
  sourceHeaderIdentityDiagnostic:printed,
  sourceStatus:sourceError?'original_official_report_pdf_fetch_hold'
   :!valid?'original_pdf_full_binary_unverified_hold'
   :!verified?'original_pdf_firstpage_registration_senate_district_or_period_hold'
   :'original_or_amended_pdf_source_binary_and_firstpage_authenticated_unclassified'
 };
}
export function classifyOriginalAmended(rows){
 const original=new Map(rows.filter(x=>x.amendmentIndex===0).map(x=>[x.registration+':'+x.reportYear,x]));
 const verified=[];
 for(const x of rows.sort((a,b)=>a.reportYear-b.reportYear||
  a.registration.localeCompare(b.registration)||a.amendmentIndex-b.amendmentIndex)){
  if(x.sourceStatus!=='original_or_amended_pdf_source_binary_and_firstpage_authenticated_unclassified')continue;
  const parent=original.get(x.registration+':'+x.reportYear);
  if(x.amendmentIndex===0)x.sourceStatus='authenticated_original_pdf';
  else if(parent?.sourceStatus!=='authenticated_original_pdf')
   x.sourceStatus='amendment_original_parent_not_authenticated_hold';
  else if(x.boardReceivedOn<parent.boardReceivedOn)
   x.sourceStatus='amendment_board_received_before_parent_hold';
  else{
   const duplicate=verified.find(z=>z.registration===x.registration
    &&z.reportYear===x.reportYear&&z.sourcePdfSha256===x.sourcePdfSha256);
   if(duplicate){
    x.sourceStatus='exact_pdf_alias';
    x.aliasCanonicalVersionId=duplicate.id;
   }else x.sourceStatus='authenticated_amendment_pdf';
  }
  if(x.sourceStatus.startsWith('authenticated_'))verified.push(x);
 }
 return rows;
}
function errorType(e){
 const s=e instanceof Error?e.message:String(e);
 return /timeout|abort/i.test(s)?'official_cfb_pdf_timeout_hold'
  :/HTTP [45]/.test(s)?'official_cfb_pdf_http_hold'
  :/source|report|pdf|viewer/i.test(s)?'official_cfb_original_source_or_pdf_hold'
  :'original_cfb_unclassified_source_hold';
}
async function acquirePerson(t){
 let snap;
 try{snap=await fetchCfbCandidateHistoricalReportReferenceSnapshot(t.reg,2022)}
 catch(e){
  return{senator:t.officialSenator,registration:t.reg,
   viewerSourceStatus:'2022_official_candidate_reports_api_unavailable',
   viewerOriginalSha:null,originalCandidatePageSha:t.originalPageSha,
   errorKind:errorType(e),reports:[],holds:[{reportYear:2021,sourceStatus:'original_yearend_source_viewer_missing_hold'},
    {reportYear:2022,sourceStatus:'original_yearend_source_viewer_missing_hold'}]}
 }
 const selected=sourceYearEndReferences(t,snap);
 const rows=[];
 for(const ref of selected.selected){
  try{
   const pdf=await fetchCfbReportViewerText(ref,{
    method:'POST',referer:snap.sourceUrl,searchType:'Candidate'});
   rows.push(originalHeader(t,ref,pdf,snap.responseSha256));
  }catch(e){rows.push(originalHeader(t,ref,null,snap.responseSha256,errorType(e)))}
 }
 return{
  senator:t.officialSenator,registration:t.reg,
  viewerSourceStatus:'original_CFB_2022_candidate_report_tab_source_verified',
  viewerOriginalSha:snap.responseSha256,
  originalCandidatePageSha:t.originalPageSha,
  viewerObservedAt:snap.fetchedAt,selectedOriginalViewerYearendRefs:selected.indexed2021and2022YE,
  holds:selected.holds,reports:classifyOriginalAmended(rows)
 };
}
export async function acquireThirtyEightSenateMembers2021to22YearendPDFs(){
 verifyIndependentOriginalYearendCalendars();
 const targets=independentlyReplayOriginal268AndAttach2022CfbDistricts(
  chooseActual38ServingSenatorsIn2021And2022());
 const results=new Array(targets.length);let at=0;
 const worker=async()=>{
  for(;;){
   const i=at++;if(i>=targets.length)break;
   try{results[i]=await acquirePerson(targets[i])}
   catch(e){results[i]={senator:targets[i].officialSenator,registration:targets[i].reg,
    viewerSourceStatus:'original_CFB_report_version_selection_or_pdf_source_hold',
    viewerOriginalSha:null,originalCandidatePageSha:targets[i].originalPageSha,
    errorKind:errorType(e),reports:[],holds:[]}}
  }
 };
 await Promise.all([worker(),worker(),worker(),worker()]);
 const rows=results.flatMap(x=>x.reports);
 if(rows.length!==new Set(rows.map(x=>x.id)).size)
  throw Error('Duplicate version ID across independently selected source-only senators');
 const verified=rows.filter(x=>x.sourceStatus==='authenticated_original_pdf'
  ||x.sourceStatus==='authenticated_amendment_pdf');
 const hold=rows.filter(x=>!x.sourceStatus.startsWith('authenticated_')
  &&x.sourceStatus!=='exact_pdf_alias');
 return{
  schema:SCHEMA,onlyOriginalServingSenatorCandidateSource:true,
  sourceOriginalCandidateSenatePrincipals:38,
  selectedYears:[2021,2022],
  separatelyReplayVerifiedEntireOriginal268GovernmentPages:true,
  completeOriginal268GovernmentArchiveSha256:OFFICIAL_268_ORIGINAL_SOURCE_SHA,
  source2022CandidateDistrictIdentitiesIndependentlyObserved:targets.filter(t=>
   t.independentlyDocumented2022CfbCandidateDistricts.length>0).length,
  source2022ArchivedCandidateNameIdentityHolds:targets.filter(t=>
   t.archived2022RegistrationCandidateNameDriftHold).length,
  originalCFBIndexedYEReportReferencesObservedBySource:results.reduce(
   (n,x)=>n+(x.selectedOriginalViewerYearendRefs??0),0),
  originalYearendSignedPDFSourceVersionsSelected:rows.length,
  authenticatedOriginalSourcePDFs:rows.filter(x=>x.sourceStatus==='authenticated_original_pdf').length,
  authenticatedAmendedDistinctSourcePDFs:rows.filter(x=>x.sourceStatus==='authenticated_amendment_pdf').length,
  originalSignedDistinctPDFHashes:new Set(verified.map(x=>x.sourcePdfSha256)).size,
  identicalIndexedPdfAliases:rows.filter(x=>x.sourceStatus==='exact_pdf_alias').length,
  sourceFirstPageOrAcquisitionHolds:hold.length,
  governmentViewerMissingOrUnselectedSourceReferences:results.flatMap(x=>x.holds).length,
  allOriginalPdfSourceHistoricalPublicByUnproven:true,
  statutoryReportDueNotActualPublication:true,
  legallyOwedOriginalReportsDenominator:null,
  noBulkFinanceOrLegacyEligibilityRepair:true,
  noProtectedOrProductionDataWritesOrReads:true,
  noOriginalPdfBodiesOrTransactionDonorsPersisted:true,
  reportVersions:rows,
  originals:results.map(x=>{const{reports,...safe}=x;return safe})
 };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2)throw Error('Only fixed 38 independent original Senate 2021/22 CFB PDF source subjects permitted');
 const a=await acquireThirtyEightSenateMembers2021to22YearendPDFs();
 const output=JSON.stringify(a);
 if(output.length>260000||/donorName|rowKey|privateDatabase|rawReportPdf|%PDF-/.test(output))
  throw Error('Unsafe historic source PDF metadata output');
 console.log(MARKER+output);
}
