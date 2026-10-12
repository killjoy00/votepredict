/**
 * #864 Track B, VERSION LEDGER ONLY. Offline, source-first reconciliation
 * of already-authenticated CFB original/amended official report PDFs.
 *
 * This is deliberately NOT a statewide filing-duty census, CFB candidate bulk
 * transaction comparison, legacy v6 eligibility repair, or a production feed.
 * All 229 selected original-version references retain historical public-by
 * UNKNOWN; Board stamped receipts and statutory release floors are NOT proof
 * of exact PDF display on that date.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const DIR='docs/evaluation/source-proof/';
export const SCHEMA='cfb-864-2021-25-served-source-panel-exact-pdf-version-ledger-v12';
export const OUTPUT=DIR+'cfb-2021-25-served-25-panel-229-exact-version-ledger.psv';
const SOURCES={
 originalYeA:'cfb-2021-22-served-11-20-original-ye-pdf-proof.psv',
 originalCeA:'cfb-2022-served-d13-24-original-ce-pdfs.psv',
 amendedA:'cfb-2021-22-served-amendment-26-pdf-source.psv',
 originalYeB:'cfb-2021-22-served-d25-36-18-original-yearend-pdfs.psv',
 originalCeB:'cfb-2022-served-d25-36-original-ce-pdfs.psv',
 amendedB:'cfb-2021-22-served-d25-36-30-amended-report-pdfs.psv',
 yearend71:'cfb-2023-24-served-22-71-yearend-version-statutory-release-bounds.psv',
 original28:'cfb-2023-24-verified-served-28-original-yearend-pdfs.psv',
 original16:'cfb-2023-24-eight-more-16-original-yearend-pdf-source-ledger.psv',
 amended16:'cfb-2023-24-parent-authenticated-16-amendment-pdf-source-ledger.psv',
 amended11:'cfb-2023-24-eight-verified-senators-11-amended-original-pdf-source-ledger.psv',
 ce2025:'cfb-2025-senate-12-special-original-pdf-source-ledger.psv',
 final2025:'cfb-2025-served-senators-2-special-cycle-final-original-pdf-ledger.psv',
 yearend2025:'cfb-2025-two-served-senators-yearend-original-pdf-ledger.psv',
 amended2025:'cfb-2025-served-sd29-seven-amended-version-pdfs.psv',
 sd6:'cfb-2025-senate-district6-report-pdfs.json',
 viewer2025:'cfb-2025-dated-senate-85-reference-versions.psv',
 panel90:'cfb-2021-25-served-senator-committee-year-coverage.psv',
};
const HASH=/^[a-f0-9]{64}$/;
const DAY=/^\d{4}-\d{2}-\d{2}$/;
const REPORT=/^(\d{4,6}):(2[1-5]):pcc:(C|E|YE):([01]):(\d+)$/;
export const FIELDS=[
 'reportVersionId','reportYear','servingSenator','sourcePanelDistrict',
 'committeeRegistration','reportPeriodCode','specialElectionIndex',
 'amendmentIndex','viewerRevisionClass','pdfIdentityStatus',
 'sourcePdfSha256','sourcePdfBytes','periodStart','periodEnd',
 'boardReceivedOn','calendarDueOn','conservativeNotBeforeOn',
 'viewerApiSha256','aliasCanonicalVersionId',
 'historicalActualPublicByOn','officialPdfUrl','proofLedger',
];
const uri=(id)=>{
 const match=REPORT.exec(id);
 if(!match)throw Error('CFB report version ID invalid');
 const [,reg,year,period,se,amend]=match;
 const p=new URLSearchParams({do:'viewPDF',downloadpdf:'false',
  year,type:'pcc',period,se,regnum:reg,amend});
 return 'https://cfb.mn.gov/rptViewer/Main.php?'+p.toString();
};
function records(name,expectedLength,cols){
 const x=readFileSync(DIR+SOURCES[name],'utf8').trimEnd().split('\n')
  .filter(Boolean).map(s=>s.split('|'));
 if(x.length!==expectedLength||x.some(a=>a.length!==cols))
  throw Error('Source provenance shape changed: '+name);
 return x;
}
function day(x){
 if(!DAY.test(x??''))return false;
 const d=new Date(x+'T00:00:00Z');
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===x;
}
function verifyHeader(entry){
 if(!REPORT.test(entry.reportVersionId))throw Error('Invalid exact version ID');
 const [,reg,yr,period,se,amend]=REPORT.exec(entry.reportVersionId);
 if(entry.reportYear!==Number('20'+yr)
  ||entry.committeeRegistration!==reg
  ||entry.reportPeriodCode!==period
  ||entry.specialElectionIndex!==se
  ||entry.amendmentIndex!==Number(amend)
  ||!HASH.test(entry.sourcePdfSha256)
  ||!Number.isSafeInteger(entry.sourcePdfBytes)
  ||entry.sourcePdfBytes<1000||entry.sourcePdfBytes>20000000
  ||!day(entry.periodStart)||!day(entry.periodEnd)
  ||entry.periodStart>entry.periodEnd
  ||(entry.boardReceivedOn!==null&&!day(entry.boardReceivedOn))
  ||(entry.calendarDueOn!==null&&!day(entry.calendarDueOn))
  ||(entry.conservativeNotBeforeOn!==null
     &&(!day(entry.conservativeNotBeforeOn)
       ||(entry.calendarDueOn!==null
         &&entry.conservativeNotBeforeOn<=entry.calendarDueOn)
       ||(entry.boardReceivedOn!==null
         &&entry.conservativeNotBeforeOn<entry.boardReceivedOn)))
  ||!HASH.test(entry.viewerApiSha256)
  ||(entry.viewerRevisionClass==='original'&&Number(amend)!==0)
  ||(entry.viewerRevisionClass==='amended'&&Number(amend)===0)
  ||(entry.pdfIdentityStatus==='source_identity_hold'
    &&entry.conservativeNotBeforeOn!==null)
  ||(entry.pdfIdentityStatus!=='source_identity_hold'
    &&entry.conservativeNotBeforeOn===null)
  ||(entry.pdfIdentityStatus==='exact_pdf_alias'&&!entry.aliasCanonicalVersionId)
  ||(entry.pdfIdentityStatus!=='exact_pdf_alias'&&entry.aliasCanonicalVersionId!==null)
  ||!['authenticated_original_pdf','authenticated_amendment_pdf',
      'source_identity_hold','exact_pdf_alias'].includes(entry.pdfIdentityStatus))
  throw Error('Report version PDF identity, coverage, Board receipt or floor invalid: '+entry.reportVersionId);
}
const blank=(v)=>v===undefined||v===null||v===''||v==='-'?null:v;
function normalize(input){
 const m=REPORT.exec(input.id??'');if(!m)throw Error('Unknown report identity');
 const entry={
  reportVersionId:input.id,reportYear:2000+Number(m[2]),
  servingSenator:input.person,sourcePanelDistrict:Number(input.district),
  committeeRegistration:m[1],reportPeriodCode:m[3],
  specialElectionIndex:m[4],amendmentIndex:Number(m[5]),
  viewerRevisionClass:Number(m[5])===0?'original':'amended',
  pdfIdentityStatus:input.status,
  sourcePdfSha256:input.pdfSha256,sourcePdfBytes:Number(input.bytes),
  periodStart:input.periodStart,periodEnd:input.periodEnd,
  boardReceivedOn:blank(input.board),
  calendarDueOn:blank(input.due),
  conservativeNotBeforeOn:blank(input.floor),
  viewerApiSha256:input.viewerSha,aliasCanonicalVersionId:blank(input.alias),
  historicalActualPublicByOn:null,officialPdfUrl:uri(input.id),
  proofLedger:DIR+SOURCES[input.sourceKey],
 };
 if(!entry.servingSenator||!Number.isInteger(entry.sourcePanelDistrict)
   ||entry.sourcePanelDistrict<1||entry.sourcePanelDistrict>67)
   throw Error('Unverified panel senator identity');
 verifyHeader(entry);
 return entry;
}
export function buildServedExactVersionLedger(){
 const yearend71=records('yearend71',71,21);
 const senators=new Map();
 for(const r of yearend71){
  const reg=r[3],entry={person:r[1],district:Number(r[2])};
  if(senators.has(reg)){
   const old=senators.get(reg);
   if(old.person!==entry.person||old.district!==entry.district)
    throw Error('Actual 2022 Senate person-to-CFB registration mismatch');
  }
  senators.set(reg,entry);
 }
 if(senators.size!==22)throw Error('Expected 22 separately sourced actual 2022-serving senator committee IDs');
 const matrix90=records('panel90',90,18),viewerByYear=new Map();
 for(const r of matrix90){
  const [cohort,year,district,person,reg,segment,sha]=r;
  if(cohort!=='2022_verified_served_22'||!senators.has(reg)||!HASH.test(sha??''))
   {if(year==='2025')continue; if(segment==='not_observed_in_2024_scoped_viewer')continue;
    if(cohort==='2022_verified_served_22'&&year==='2023'||year==='2024')continue;
    throw Error('Inconsistent primary senate panel 90-row source');}
  if(year==='2021'||year==='2022')
   viewerByYear.set(reg+':'+year,sha);
 }
 const viewers2025=records('viewer2025',41,3);
 const viewer2025=new Map(viewers2025.map(r=>[r[0],r[1]]));
 const special2025=new Map([
  ['19205',{person:'Keri Heintzeman',district:6}],
  ['19229',{person:'Michael Holmstrom Jr',district:29}],
  ['19233',{person:'Amanda Hemmingsen-Jaeger',district:47}],
 ]);
 const all=[],add=(x)=>all.push(normalize(x));
 const originalById=new Map(),sourceCeKey=['originalCeA','originalCeB'];
 for(const sourceKey of ['originalYeA','originalCeA','originalYeB','originalCeB']){
  const length={originalYeA:20,originalCeA:22,originalYeB:18,originalCeB:22}[sourceKey];
  const cols=sourceKey==='originalCeA'?11:12;
  for(const r of records(sourceKey,length,cols)){
   const id=r[0],m=REPORT.exec(id),reg=m?.[1],yr=2000+Number(m?.[2]);
   const actual=senators.get(reg);
   if(!actual||r[1]!==actual.person||Number(r[2])!==actual.district
    ||m[5]!=='0'||!viewerByYear.has(reg+':'+yr))
    throw Error('Original 2021/22 report is not from verified serving senator');
   const ye=sourceKey.startsWith('originalYe');
   const x=ye?{
    id,person:r[1],district:r[2],pdfSha256:r[4],bytes:r[5],
    periodStart:r[7],periodEnd:r[8],board:r[9],due:r[10],floor:r[11],
   }:{
    id,person:r[1],district:r[2],pdfSha256:r[4],bytes:r[5],
    periodStart:r[6],periodEnd:r[7],board:r[8],due:r[9],floor:r[10],
   };
   const row={...x,sourceKey,viewerSha:viewerByYear.get(reg+':'+yr),
    status:'authenticated_original_pdf',alias:null};
   add(row);originalById.set(id,row);
  }
 }
 if(originalById.size!==82)throw Error('2021/22 cohort had unexpected original PDF proof set');
 for(const r of records('amendedA',26,9)){
  const [id,parent,pdfSha256,bytes,board,, ,floor,state]=r;
  const orig=originalById.get(parent);
  if(!orig||id.slice(0,id.lastIndexOf(':'))!==parent.slice(0,parent.lastIndexOf(':')))
   throw Error('2021/22 original parent not authenticated');
  const hold=state==='HOLD_HEADER';
  if(!hold&&state!=='AUTH')throw Error('Invalid source amendment identity state');
  add({...orig,id,pdfSha256,bytes,board:hold?null:board,
   floor:hold?null:floor,sourceKey:'amendedA',
   status:hold?'source_identity_hold':'authenticated_amendment_pdf'});
 }
 for(const r of records('amendedB',30,18)){
  const [id,person,district,,,parent,parentSha,viewerSha,pdfSha256,bytes,
   ,periodStart,periodEnd,board,due,floor,state,alias]=r;
  const orig=originalById.get(parent);
  if(!orig||orig.person!==person||orig.pdfSha256!==parentSha
   ||Number(district)!==Number(orig.district)
   ||orig.periodStart!==periodStart||orig.periodEnd!==periodEnd
   ||orig.due!==due||orig.viewerSha!==viewerSha)
    throw Error('2021/22 second amendment source/parent invalid');
  const isAlias=state==='official_amendment_version_reference_alias_of_identical_pdf';
  if(!isAlias&&state!=='distinct_authenticated_amended_pdf')
   throw Error('Invalid original amended PDF source status');
  add({...orig,id,sourceKey:'amendedB',pdfSha256,bytes,board,due,floor,
   status:isAlias?'exact_pdf_alias':'authenticated_amendment_pdf',
   alias:isAlias?alias:null});
 }
 const detailById=new Map();
 const details={
  original28:records('original28',28,12),
  original16:records('original16',16,12),
  amended16:records('amended16',16,15),
  amended11:records('amended11',11,15),
 };
 for(const [sourceKey,rows] of Object.entries(details)){
  for(const r of rows){
   if(detailById.has(r[0]))throw Error('Duplicate 2023/24 published PDF version identity');
   detailById.set(r[0],{row:r,sourceKey});
  }
 }
 if(detailById.size!==71)throw Error('Original CFB source-version 2023/24 evidence incomplete');
 const sourceMap={
  verified28Originals:'original28',
  recovered16Originals:'original16',
  parentVerified16Amendments:'amended16',
  recovered11Amendments:'amended11',
 };
 for(const r of yearend71){
  const [id,person,district,reg,year,kind,viewerSha,pdfSha256,rawStatus,alias,
   board,periodStart,periodEnd,due,,floor,publicBy,owed,eligible,cohort]=r;
  const match=detailById.get(id);
  if(!match||match.sourceKey!==sourceMap[cohort]||match.row[1]!==person
    ||match.row[3]!==reg||match.row[4]!==viewerSha
    ||match.row[match.row.length===12?5:7]!==pdfSha256
    ||publicBy!=='-'||owed!=='-'||eligible!=='false'
    ||kind!==(id.endsWith(':0')?'original':'amended'))
    throw Error('Historical 2023/24 exact PDF provenance inconsistent');
  const detail=match.row,amended=detail.length===15;
  const status=rawStatus.startsWith('HOLD_')?'source_identity_hold'
   :rawStatus==='duplicate_official_amendment_reference_pdf_alias'?'exact_pdf_alias'
   :rawStatus==='original_pdf_first_page_authenticated'?'authenticated_original_pdf'
   :rawStatus==='distinct_authenticated_amended_pdf'?'authenticated_amendment_pdf'
   :null;
  if(!status)throw Error('Unknown original CFB 71 ledger source PDF state');
  add({id,person,district,sourceKey:match.sourceKey,pdfSha256,
   bytes:amended?detail[8]:detail[6],
   periodStart,periodEnd,board,due,floor,viewerSha,status,
   alias:status==='exact_pdf_alias'?alias:null});
 }
 const sd6=JSON.parse(readFileSync(DIR+SOURCES.sd6,'utf8'));
 if(sd6.scope?.registrationNumber!=='19205'||sd6.reports?.length!==5)
  throw Error('Original SD6 candidate report proof changed');
 for(const r of sd6.reports){
  const {reportId:id,sourcePdfSha256:pdfSha256,sourcePdfBytes:bytes,
   reportCoverageStartOn:periodStart,reportCoverageEndOn:periodEnd,
   officialReceivedOn:board,statutoryDueOnFromCaseSpecificCalendar:due,
   conservativeLegalAndFilingBoundOn:floor,historicallyPublicByOn}=r;
  if(historicallyPublicByOn!==null||!r.officialReportHeaderIdentityVerified
    ||!r.sourceUrl||!r.sourceUrl.includes('cfb.mn.gov'))
   throw Error('SD6 report first-page identity or historical public-by invalid');
  add({id,person:'Keri Heintzeman',district:6,sourceKey:'sd6',
   pdfSha256,bytes,periodStart,periodEnd,board,due,floor,
   viewerSha:sd6.officialViewer.apiResponseSha256,
   status:REPORT.exec(id)[5]==='0'
    ?'authenticated_original_pdf':'authenticated_amendment_pdf',alias:null});
 }
 for(const r of records('ce2025',12,9)){
  const [id,district,pdfSha256,bytes,periodStart,periodEnd,board,due,floor]=r;
  const reg=REPORT.exec(id)[1];if(!['19229','19233'].includes(reg))continue;
  const who=special2025.get(reg);
  if(who.district!==Number(district))throw Error('Wrong 2025 original CFB Senate candidate district');
  add({id,person:who.person,district,sourceKey:'ce2025',pdfSha256,
   bytes,periodStart,periodEnd,board,due,floor,
   viewerSha:viewer2025.get(reg),status:'authenticated_original_pdf',alias:null});
 }
 for(const sourceKey of ['final2025','yearend2025']){
  const yend=sourceKey==='yearend2025';
  for(const r of records(sourceKey,2,yend?11:10)){
   const [id,district,pdfSha256,bytes,periodStart,periodEnd,board,due,floor]=r;
   const reg=REPORT.exec(id)[1],who=special2025.get(reg);
   if(!who||reg==='19205'||who.district!==Number(district))
    throw Error('Unproved actual 2025 serving senator source report');
   add({id,person:who.person,district,sourceKey,pdfSha256,bytes,
    periodStart,periodEnd,board,due,floor,
    viewerSha:viewer2025.get(reg),
    status:'authenticated_original_pdf',alias:null});
  }
 }
 for(const r of records('amended2025',7,14)){
  const [id,person,district,parent,parentHash,pdfSha256,bytes,
    periodStart,periodEnd,board,due,floor,status,alias]=r;
  if(!id.startsWith('19229:25:')||person!=='Michael Holmstrom Jr'
    ||Number(district)!==29||!HASH.test(parentHash)
    ||parent!==id.replace(/:\d+$/,':0'))
   throw Error('2025 source amendment parent and identity mismatch');
  const isAlias=status==='reviewed_official_index_aliases_original_pdf';
  if(!isAlias&&status!=='distinct_amended_pdf')
   throw Error('Unrecognized official amendment status');
  add({id,person,district,sourceKey:'amended2025',pdfSha256,bytes,
   periodStart,periodEnd,board,due,floor,
   viewerSha:viewer2025.get('19229'),
   status:isAlias?'exact_pdf_alias':'authenticated_amendment_pdf',
   alias:isAlias?alias:null});
 }
 all.sort((a,b)=>a.reportYear-b.reportYear
  ||a.sourcePanelDistrict-b.sourcePanelDistrict
  ||a.committeeRegistration.localeCompare(b.committeeRegistration)
  ||a.reportVersionId.localeCompare(b.reportVersionId));
 const unique=new Map();
 for(const r of all){
  if(unique.has(r.reportVersionId))throw Error('Duplicate exact report version across cohorts');
  unique.set(r.reportVersionId,r);
  if(r.viewerRevisionClass==='amended'){
   const parent=unique.get(r.reportVersionId.replace(/:\d+$/,':0'))
     ||all.find(s=>s.reportVersionId===r.reportVersionId.replace(/:\d+$/,':0'));
   if(!parent||parent.pdfIdentityStatus!=='authenticated_original_pdf'
     ||parent.committeeRegistration!==r.committeeRegistration
     ||parent.reportYear!==r.reportYear)
     throw Error('Amended report lacks independently authenticated original parent');
  }
 }
 for(const r of all.filter(x=>x.pdfIdentityStatus==='exact_pdf_alias')){
  const orig=unique.get(r.aliasCanonicalVersionId);
  if(!orig||orig.pdfIdentityStatus!=='authenticated_amendment_pdf'
    &&orig.pdfIdentityStatus!=='authenticated_original_pdf'
    ||orig.sourcePdfSha256!==r.sourcePdfSha256
    ||orig.committeeRegistration!==r.committeeRegistration
    ||orig.periodStart!==r.periodStart||orig.periodEnd!==r.periodEnd)
    throw Error('Official amendment index alias must match authenticated same-report PDF');
 }
 const perYear=Array.from({length:5},(_,i)=>{
  const year=2021+i,rows=all.filter(r=>r.reportYear===year);
  return{year,references:rows.length,
   originals:rows.filter(r=>r.viewerRevisionClass==='original').length,
   amendments:rows.filter(r=>r.viewerRevisionClass==='amended').length,
   authenticated:rows.filter(r=>r.pdfIdentityStatus.startsWith('authenticated_')).length,
   identityHolds:rows.filter(r=>r.pdfIdentityStatus==='source_identity_hold').length,
   aliases:rows.filter(r=>r.pdfIdentityStatus==='exact_pdf_alias').length,
   exactHistoricalPublicBy:0};
 });
 const expected=[
  [29,16,13,28,1,0],
  [109,66,43,108,0,1],
  [32,22,10,30,2,0],
  [39,22,17,38,0,1],
  [20,12,8,19,0,1],
 ];
 for(let i=0;i<5;i++){
  const a=perYear[i],e=expected[i];
  if([a.references,a.originals,a.amendments,a.authenticated,a.identityHolds,a.aliases]
    .some((x,k)=>x!==e[k]))
   throw Error('Source cohort report version counts drifted in '+a.year);
 }
 const authentic=all.filter(r=>r.pdfIdentityStatus.startsWith('authenticated_'));
 if(all.length!==229||authentic.length!==223||unique.size!==229
  ||new Set(authentic.map(r=>r.sourcePdfSha256)).size!==223
  ||all.some(r=>r.historicalActualPublicByOn!==null))
  throw Error('Provenance scope or original-PDF identity uniqueness changed');
 const receipt={schema:SCHEMA,sourceScope:'22 verified 2022-serving committee IDs'
  +' with 2021-24 official reports, plus 3 source-verified 2025-serving special-election committees',
  personsAndRegistrationPairsInSelectedPanel:25,
  sourceOnlyCohortNotComplete2021to2025StatewideCoverage:true,
  reportVersions:all.length,originalVersionRefs:all.filter(x=>x.viewerRevisionClass==='original').length,
  amendmentVersionRefs:all.filter(x=>x.viewerRevisionClass==='amended').length,
  distinctAuthenticatedPdfBinaries:authentic.length,
  originalIdentityHolds:all.filter(x=>x.pdfIdentityStatus==='source_identity_hold').length,
  duplicateOfficialViewerAliases:all.filter(x=>x.pdfIdentityStatus==='exact_pdf_alias').length,
  exactHistoricalPublicByVerified:0,
  historicalPublicByEvidenceMissingForAllVersions:true,
  actualSourcePdfReportPeriodsAndBoardReceiptsCaptured:true,
  legalFloorIsNotProofOfActualPublicDisplay:true,
  statewideCommitteeOrFilingDutyDenominatorNotClaimed:true,
  bulkCandidateCsvComparisonOutOfScope:true,
  legacyEvidenceEligibilityBackfillOutOfScope:true,
  zeroDatabaseReadsAndWrites:true,
  noFinancialTransactionsOrDonorsInOutput:true,
  byYear:perYear};
 return{receipt,rows:all};
}
function stringPsvField(v){
 if(v===null||v===undefined)return '-';
 const out=String(v);
 if(!out||/[|\r\n]/.test(out))throw Error('Invalid sanitized original report PSV field');
 return out;
}
export function serializeServedExactLedger(rows){
 return rows.map(row=>FIELDS.map(f=>stringPsvField(row[f])).join('|')).join('\n')+'\n';
}
export function verifyPinnedServedExactLedger(){
 const {receipt,rows}=buildServedExactVersionLedger();
 const generated=serializeServedExactLedger(rows);
 const committed=readFileSync(OUTPUT,'utf8');
 if(committed!==generated)throw Error('Durable 229 exact report version metadata rows drift from original independently authenticated source proof');
 const sha256=createHash('sha256').update(generated).digest('hex');
 return {...receipt,ledgerPath:OUTPUT,sourceMetadataPsvSha256:sha256,
  bytes:Buffer.byteLength(generated,'utf8')};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2)
  throw Error('No write, override or production commands allowed');
 const safe=verifyPinnedServedExactLedger();
 console.log('CFB_864_EXACT_REPORT_VERSION_LEDGER_SOURCE_ONLY '+JSON.stringify(safe));
}
