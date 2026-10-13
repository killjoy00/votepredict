/**
 * #864: actual-serving 2023-25 senators: exact CFB 2023/24 year-end
 * original + amended REPORT PDF VERSION original bodies only. This is
 * source research, not a legally owed filer denominator, bulk transactions,
 * historical prediction eligibility or production data.
 *
 * Reader: independently sourced 57-person original-CFB name/district/page
 * hashes (V17) + actual 95-person service roster and government original
 * 2023/24 statutory year-end disclosure-calendar proof (no invented dates).
 *
 * Original PDF bytes and text are NEVER persisted/uploaded or printed;
 * original government full SHA, headers and safe counts only.
 */
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {
 fetchCfbCandidateHistoricalReportReferenceSnapshot
}from '../src/evidence/cfb-candidate-report-history.js';
import {fetchCfbReportViewerText,cfbReportViewerUrl}
 from '../src/evidence/cfb-current-report-acquisition.js';
import {parseServed2023to24YearEndHeader}
 from '../src/evidence/cfb-2023-24-served-28-yearend-originals.js';
import {parsePermanent57RegistrationLeadPsv,
 verifyPinned57AgainstOriginalSourceCheckpoint}
 from './audit-cfb-864-57-actual-serving-candidate-registration-leads-v17.mjs';

export const SCHEMA='cfb-864-2023-24-13-new-actual-senators-official-original-amended-yearend-PDF-v18';
const ORIGINAL_CALENDAR='docs/evaluation/source-proof/cfb-2023-24-original-board-yearend-calendar-and-revisor-release-checkpoint.json';
const OFFICIAL_MEMBERS='docs/evaluation/source-proof/cfb-2021-25-95-served-senator-38-report-principal-crosswalk-v16.psv';
const AUTHENTIC_PDF_PANEL='docs/evaluation/source-proof/cfb-2021-25-38-served-principal-255-exact-report-version-ledger-v16.psv';
const ROOT='https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/';
const HEX=/^[a-f0-9]{64}$/;
const EXPECTED_YE={2023:{end:'2023-12-31',due:'2024-01-31',legalDate:'2024-02-01'},
  2024:{end:'2024-12-31',due:'2025-01-31',legalDate:'2025-02-01'}};
const HEADER='CFB_864_13_2023_24_ORIGINAL_AMENDED_YE_V18 ';
const INDEX_CAP_PER_YEAR=12;
const FILE_CAP_TOTAL=120;
function namesValid(){
 const people=readFileSync(OFFICIAL_MEMBERS,'utf8').trimEnd().split('\n').map(x=>x.split('|'));
 if(people.length!==95||people.some(x=>x.length!==10))throw Error('Official 95-member source changed');
 return new Map(people.map(x=>[x[0],x]));
}
export function choose13NewSenator2023To24YearEndSubjects(){
 verifyPinned57AgainstOriginalSourceCheckpoint();
 const refs=readFileSync(AUTHENTIC_PDF_PANEL,'utf8').trimEnd().split('\n').map(x=>x.split('|'));
 if(refs.length!==255||new Set(refs.map(x=>x[4])).size!==38)
  throw Error('V16 original CFB 255 report version panel drift');
 const known=new Set(refs.map(x=>x[4]));
 const directory=namesValid();
 const targets=parsePermanent57RegistrationLeadPsv().filter(x=>
  x.earliestOriginalViewerSegment===2022&&x.identityStatus==='EXACT');
 if(targets.length!==13||new Set(targets.map(x=>x.committeeRegistrationLead)).size!==13)
  throw Error('Expected exactly 13 first-serving 2023 principal CFB candidates');
 for(const t of targets){
  const member=directory.get(t.officialSenator);
  const pair=['2023','2024'].every(y=>
   member?.[1].split(',').includes(y)
   &&member[2].split(';').some(x=>x===y+':'+t.originalCandidatePageDistrict));
  if(!member||member[4]!=='-'||known.has(t.committeeRegistrationLead)||!pair
   ||!HEX.test(t.originalCandidatePageSha256))
   throw Error('Original CFB registration and actual 2023/24 serving senator source mismatch');
 }
 return targets.map(t=>({
  officialSenator:t.officialSenator,reg:t.committeeRegistrationLead,
  senateDistrict:t.originalCandidatePageDistrict,
  originalCfb2022DistrictPageSha:t.originalCandidatePageSha256,
  originalGovtCandidateLabel:t.originalCfbCandidateLabel
 })).sort((a,b)=>a.senateDistrict-b.senateDistrict);
}
export function verify2023to24IndependentYearendCalendars(){
 const source=JSON.parse(readFileSync(ORIGINAL_CALENDAR,'utf8'));
 if(source.schemaVersion!=='cfb-2023-24-five-primary-original-yearend-calendars-and-10A-reporting-law-source-v1'
  ||source.primarySourceAcquisition?.independentFullSourceRecheck
   ?.allFiveExactOriginalPdfAndStatuteSha256MatchPriorCorrectedRun!==true
  ||source.exactStatutoryCalendarDates?.length!==2)
  throw Error('Independent original 2023/24 year-end CFB calendar and statute acquisition drift');
 for(const y of [2023,2024]){
  const d=source.exactStatutoryCalendarDates.find(x=>x.reportYear===y);
  if(!d||d.coveredFrom!==y+'-01-01'
   ||d.coveredThrough!==EXPECTED_YE[y].end
   ||d.ordinaryYearEndDueOn!==EXPECTED_YE[y].due
   ||!d.localNonpublicUntil.startsWith(EXPECTED_YE[y].legalDate+'T08:00:00')
   ||d.actualHistoricalPublicationOn!==null)
   throw Error('Official original CFB report calendar or historic public-by status changed');
 }
 return true;
}
export function official2023To24YearEndReference(t,year,amend=0){
 if(![2023,2024].includes(year)||!Number.isInteger(amend)||amend<0||amend>99)
  throw Error('Unapproved report year/amendment version');
 return{registrationNumber:t.reg,filingYear:year,year:String(year).slice(2),
  type:'pcc',period:'YE',se:'0',amendment:amend,
  reportName:'Annual Report of Receipts and Expenditures for Principal Campaign Committee'};
}
function exactVersionId(ref){
 return [ref.registrationNumber,ref.year,ref.type,ref.period,ref.se,ref.amendment].join(':');
}
export function selectedOriginalAndAmendedViewerReferences(t,snapshot){
 const correctUrl=ROOT+t.reg+'/2024/';
 if(snapshot?.registrationNumber!==t.reg||snapshot?.segmentEndYear!==2024
  ||snapshot.sourceUrl!==correctUrl||!HEX.test(snapshot.responseSha256))
  throw Error('CFB candidate viewer original API source not independently reliable');
 const selected=snapshot.references.filter(ref=>
  ref.registrationNumber===t.reg&&['23','24'].includes(ref.year)
  &&ref.type==='pcc'&&ref.period==='YE'&&ref.se==='0'
  &&Number.isInteger(ref.amendment)&&ref.amendment>=0
  &&ref.amendment<=99);
 const seen=new Set(),all=[];
 for(const r of selected){
  const id=exactVersionId(r);
  if(seen.has(id))throw Error('CFB original year-end version identity duplicate in viewer');
  seen.add(id);all.push(r);
 }
 if(all.length>FILE_CAP_TOTAL)throw Error('Selected bounded official CFB year-end PDF reference count exceeded');
 const eligible=[],holds=[];
 for(const year of [2023,2024]){
  const versions=all.filter(r=>r.year===String(year).slice(2))
   .sort((a,b)=>a.amendment-b.amendment);
  if(versions.length>INDEX_CAP_PER_YEAR){
   holds.push({year,sourceStatus:'official_yearend_viewer_reference_count_overflow_hold',
    numberOfReferences:versions.length});continue;
  }
  const original=versions.find(x=>x.amendment===0);
  if(!original){
   holds.push({year,sourceStatus:'original_yearend_viewer_reference_not_observed_hold',
    numberOfReferences:versions.length});
   continue;
  }
  eligible.push(...versions);
 }
 return{refs:eligible,holds,allSelectedRefs:all.length};
}
export function auditYearEndSourcePdfHeader(t,ref,source,viewerSha,fetchError=null){
 const year=2000+Number(ref.year);
 if(!EXPECTED_YE[year]||ref.registrationNumber!==t.reg
  ||ref.type!=='pcc'||ref.period!=='YE'||ref.se!=='0'
  ||!HEX.test(viewerSha))
  throw Error('Not a source-verified exact CFB ordinary 2023/24 year-end version');
 const id=exactVersionId(ref);
 const expectedUrl=cfbReportViewerUrl(ref);
 const valid=!!source&&source.sourceUrl===expectedUrl
  &&HEX.test(source.contentSha256)
  &&Number.isSafeInteger(source.bytes)
  &&source.bytes>=1000&&source.bytes<=30_000_000
  &&Number.isFinite(Date.parse(source.fetchedAt));
 const header=valid
  ?parseServed2023to24YearEndHeader({
   reg:t.reg,district2022:t.senateDistrict,reportYear:year,
  },source.text):null;
 const verified=valid&&header?.verified&&!fetchError;
 const date=header?.boardReceivedOn??null;
 const release=verified
  ?[date,EXPECTED_YE[year].legalDate].sort().at(-1):null;
 return{
  id,person:t.officialSenator,senateDistrict:t.senateDistrict,
  registration:t.reg,year,originalOrAmendedIndex:ref.amendment,
  viewerApiSha256:viewerSha,
  sourcePdfSha256:valid?source.contentSha256:null,
  sourcePdfBytes:valid?source.bytes:null,
  coverageStartOn:verified?header.coverageStartOn:null,
  coverageEndOn:verified?header.coverageEndOn:null,
  boardReceivedOn:verified?date:null,
  originalIndependentCalendarDueOn:EXPECTED_YE[year].due,
  legalAndBoardReceivedEarliestPossiblePublicDate:release,
  exactHistoricalActualPublicByOn:null,
  firstPageIdentityAndReportPeriodVerified:!!verified,
  candidateSourceSha256:t.originalCfb2022DistrictPageSha,
  sourceErrorKind:fetchError,
  sourceStatus:fetchError?'source_retrieval_hold':
   !valid?'original_pdf_binary_not_authenticated_hold':
   !verified?'original_pdf_firstpage_committee_district_period_or_receipt_hold':
   'authenticated_pdf_first_page_version_unclassified',
 };
}
export function classifyYearEndSourceVersions(rows){
 const byId=new Map(rows.map(x=>[x.id,x]));
 if(byId.size!==rows.length)throw Error('Duplicate source exact official report version id');
 const verified=[];
 for(const row of rows.sort((a,b)=>a.registration.localeCompare(b.registration)
   ||a.year-b.year||a.originalOrAmendedIndex-b.originalOrAmendedIndex)){
  if(row.sourceStatus!=='authenticated_pdf_first_page_version_unclassified')continue;
  const canonical=[row.registration,String(row.year).slice(2),'pcc','YE','0','0'].join(':');
  const parent=byId.get(canonical);
  if(row.originalOrAmendedIndex===0){
   row.sourceStatus='authenticated_original_pdf';
  }else if(parent?.sourceStatus!=='authenticated_original_pdf'){
   row.sourceStatus='amendment_parent_original_pdf_not_authenticated_hold';
  }else if(row.boardReceivedOn<parent.boardReceivedOn){
   row.sourceStatus='amendment_board_receipt_precedes_original_hold';
  }else{
   const previous=verified.filter(x=>x.registration===row.registration&&x.year===row.year
    &&x.sourcePdfSha256===row.sourcePdfSha256);
   if(previous.length){
    row.sourceStatus='exact_pdf_alias';
    row.aliasCanonicalVersionId=previous[0].id;
   }else row.sourceStatus='authenticated_amendment_pdf';
  }
  if(row.sourceStatus.startsWith('authenticated_'))verified.push(row);
 }
 return rows;
}
function boundedError(e){
 const x=e instanceof Error?e.message:String(e);
 return /timeout|abort/i.test(x)?'official_cfb_request_timeout'
  :/HTTP [45]/i.test(x)?'official_cfb_http_unavailable'
  :/pdf|parse|source|reference/i.test(x)?'official_source_pdf_parse_or_identity_hold'
  :'official_source_fetch_unknown_hold';
}
async function fetchOneOfficialCommittee(t){
 let snapshot;
 try{snapshot=await fetchCfbCandidateHistoricalReportReferenceSnapshot(t.reg,2024)}
 catch(e){return{person:t.officialSenator,reg:t.reg,viewerSourceStatus:'official_viewer_api_fetch_hold',
  errorKind:boundedError(e),viewerSha:null,refs:[],holds:[
   {year:2023,sourceStatus:'official_viewer_unavailable_hold'},
   {year:2024,sourceStatus:'official_viewer_unavailable_hold'}]}}
 const selection=selectedOriginalAndAmendedViewerReferences(t,snapshot);
 const out=[];
 for(const ref of selection.refs){
  try{
   const pdf=await fetchCfbReportViewerText(ref,{
    method:'POST',referer:snapshot.sourceUrl,searchType:'Candidate'
   });
   out.push(auditYearEndSourcePdfHeader(t,ref,pdf,snapshot.responseSha256));
  }catch(e){
   out.push(auditYearEndSourcePdfHeader(t,ref,null,snapshot.responseSha256,boundedError(e)));
  }
 }
 const authenticated=classifyYearEndSourceVersions(out);
 return{person:t.officialSenator,reg:t.reg,
  viewerSourceStatus:'authentic_official_CFB_candidate_viewer_API',
  viewerSha:snapshot.responseSha256,
  viewerObservedAtUtc:snapshot.fetchedAt,viewerSourceUrl:snapshot.sourceUrl,
  originalCfbCandidatePageSha:t.originalCfb2022DistrictPageSha,
  availableSelectedYearEndVersionReferences:selection.allSelectedRefs,
  holds:selection.holds,refs:authenticated};
}
export async function acquireNewSenator2023to24YearEndPdfVersions(){
 verify2023to24IndependentYearendCalendars();
 const targets=choose13NewSenator2023To24YearEndSubjects();
 const results=new Array(targets.length);
 let next=0;
 const worker=async()=>{
  for(;;){
   const i=next++;
   if(i>=targets.length)break;
   try{results[i]=await fetchOneOfficialCommittee(targets[i])}
   catch(e){results[i]={person:targets[i].officialSenator,reg:targets[i].reg,
    viewerSourceStatus:'official_viewer_selection_or_source_identity_hold',
    errorKind:boundedError(e),viewerSha:null,holds:[],refs:[]}}
  }
 };
 await Promise.all([worker(),worker(),worker()]);
 const rows=results.flatMap(x=>x.refs);
 const uniqueRows=new Set(rows.map(x=>x.id));
 if(uniqueRows.size!==rows.length||results.length!==13)throw Error('CFB source version reference duplicates');
 const certified=rows.filter(x=>x.sourceStatus==='authenticated_original_pdf'
  ||x.sourceStatus==='authenticated_amendment_pdf');
 const aliases=rows.filter(x=>x.sourceStatus==='exact_pdf_alias');
 const holds=rows.filter(x=>!x.sourceStatus.startsWith('authenticated_')
  &&x.sourceStatus!=='exact_pdf_alias');
 return{
  schema:SCHEMA,originalGovernmentSourcesRechecked:true,
  originalSourceSenatorTargets:13,coveredReportYears:[2023,2024],
  authenticatedOriginalPdfVersions:rows.filter(x=>x.sourceStatus==='authenticated_original_pdf').length,
  authenticatedAmendedPdfVersions:rows.filter(x=>x.sourceStatus==='authenticated_amendment_pdf').length,
  verifiedUniquePdfBinaries:new Set(certified.map(x=>x.sourcePdfSha256)).size,
  identicalOfficialVersionPdfAliases:aliases.length,
  sourceIdentityOrRetrievalHolds:holds.length,
  viewerReferenceOrOverflowHolds:results.flatMap(x=>x.holds).length,
  historicallyExactOriginalPdfPublicByOnCount:0,
  unprovenOriginalAmendmentCheckboxNotAutoPromoted:true,
  legallyOwedReportsNotCalculated:true,
  storedTransactionOrLegacyEligibilityUpdates:false,
  noRawReportOrDonorSourceTextPersisted:true,
  noProductionReadWriteOrForecastChange:true,
  originalCalendarSha256sAlreadySourceAuthenticated:true,
  rows,viewerSources:results.map(x=>{
   const {refs,...rest}=x;return rest;
  })
 };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2)throw Error('No custom unproven candidate IDs permitted');
 const result=await acquireNewSenator2023to24YearEndPdfVersions();
 const safe=JSON.stringify(result);
 if(safe.length>90000||/donorName|contributionId|privateDatabase|rawPdfBody|rowKey|%PDF-/.test(safe))
  throw Error('Unsafe report source metadata output');
 console.log(HEADER+safe);
}
