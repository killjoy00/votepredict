/**
 * #864 — 2021-25 official CFB original/amended PDF report-VERSION provenance.
 * Combine immutable 229-row authentic original sources, 24 source-authenticated
 * SD1-12 2022 original C/E PDFs now individually linked to true senators
 * (source run 38357913504), and Erin Murphy's two authenticated original YEs.
 * Never infer exact historical publicly available-by from Board receipt or
 * statutory gate. No raw PDF, donors, finance row matching, private DB,
 * legal filer-obligation universe, eligibility, serving, forecast or contact.
 */
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {buildServedExactVersionLedger,verifyPinnedServedExactLedger,
 serializeServedExactLedger,FIELDS as VERSION_FIELDS}
 from './audit-cfb-864-served-report-version-ledger-v12.mjs';
import {cfb2022OriginalCePdfTargets}
 from '../src/evidence/cfb-2022-senate-original-ce-pdf-proof.js';
export const SCHEMA='cfb-864-2021-25-38-served-principal-255-exact-original-pdf-versions-v16';
export const FULL_VERSION_PSV='docs/evaluation/source-proof/cfb-2021-25-38-served-principal-255-exact-report-version-ledger-v16.psv';
export const FULL_SENATOR_PSV='docs/evaluation/source-proof/cfb-2021-25-95-served-senator-38-report-principal-crosswalk-v16.psv';
const P='docs/evaluation/source-proof/';
const SOURCE24=P+'cfb-2022-senate-24-original-ce-pdf-headers.psv';
const SOURCEERIN=P+'cfb-2021-22-senate-one-filer-original-reports-and-calendars.json';
const SENATOR95=P+'cfb-2021-25-95-serving-senator-report-version-source-crosswalk-v14.psv';
const HEX=/^[0-9a-f]{64}$/;
const DATE=/^20\d\d-\d\d-\d\d$/;
const CFB_PROVEN_2022={
 '18011':'Mark T. Johnson','18792':'Steve Green',
 '18873':'Grant Hauschild','18917':'Robert Kupec',
 '18001':'Paul J. Utke','18077':'Justin D. Eichorn',
 '18821':'Robert Farnsworth','18581':'Jennifer A McEwen',
 '18749':'Jordan Rasmusson','18778':'Nathan Wesenberg',
 '18406':'Jason Rarick','17373':'Torrey Westrom'
};
const PDF_STATUS='authenticated_original_pdf';
const CFB_NAME_SOURCE='original_2022_cfb_district_label_and_independent_lrl_member_verification_v15';
const sha=text=>createHash('sha256').update(text,'utf8').digest('hex');
const fields=[
 'officialSenator','sourceServiceYears','sourceDistrictByYear',
 'sourceServiceUrl','sourceProvenCFBRegistrations',
 'officialReportVersionRefsInSelectedPanel',
 'reportYearsObservedInSelectedPanel','sourceProofStatus',
 'exactHistoricalVersionPublicByProvenCount','legallyOwedReportCount'
];
function serviceNameKey(name){
 const tokens=String(name).normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9 ]/g,' ')
  .trim().split(/\s+/).filter(x=>!['jr','sr','ii','iii','iv'].includes(x));
 if(tokens.length<2)return null;
 return tokens[0]+'|'+tokens.at(-1);
}
function versionUrl(id){
 const [reg,year,typ,period,se,amend]=id.split(':');
 if(typ!=='pcc')throw Error('Unexpected CFB report type');
 return 'https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&downloadpdf=false&year='+
  year+'&type=pcc&period='+period+'&se='+se+'&regnum='+reg+'&amend='+amend;
}
export function buildV16ReportSourceVersionLedger(){
 // Its own verifier inspects and rejoins every original 2021-25 source PDF,
 // not just trusting precommitted 229 strings.
 verifyPinnedServedExactLedger();
 const result=buildServedExactVersionLedger();
 const seen=new Map(result.rows.map(r=>[r.reportVersionId,r]));
 if(seen.size!==229)throw Error('Original V12 229 immutable report version source drift');
 const targets=cfb2022OriginalCePdfTargets();
 if(targets.length!==24||Object.keys(CFB_PROVEN_2022).length!==12
  ||new Set(Object.values(CFB_PROVEN_2022)).size!==12)throw Error('Unproven actual 2022 Senate principals');
 const raw=readFileSync(SOURCE24,'utf8').trimEnd().split('\n').map(x=>x.split('|'));
 if(raw.length!==24||raw.some(x=>x.length!==8))throw Error('Source first12 original PDF 24 ledger drift');
 const inputs=new Map(raw.map(x=>[x[0],x]));
 if(inputs.size!==24)throw Error('Duplicate first12 CFB original PDF ID');
 const newly=[];
 for(const target of targets){
  const [id,pdfSha,bytes,start,end,board,due,floor]=inputs.get(target.id)??[];
  const person=CFB_PROVEN_2022[target.reg];
  if(id!==target.id||!person||!HEX.test(pdfSha??'')
   ||!HEX.test(target.viewerSha)||!HEX.test(target.districtPageSha)
   ||!/^\d{4,8}$/.test(target.reg)
   ||!DATE.test(start??'')||!DATE.test(end??'')
   ||!DATE.test(board??'')||!DATE.test(due??'')||!DATE.test(floor??'')
   ||start!=='2022-01-01'
   ||end!==target.expectedPeriodEndOn
   ||due!==target.dueOn
   ||floor<=due||floor<board
   ||!Number.isSafeInteger(Number(bytes))||Number(bytes)<500
   ||seen.has(id)||target.id.split(':')[4]!=='0'
   ||target.id.split(':')[5]!=='0')
   throw Error('Original official CFB 2022 serving senator source PDF identity drift');
  const row={
   reportVersionId:id,reportYear:2022,servingSenator:person,
   sourcePanelDistrict:target.district,committeeRegistration:target.reg,
   reportPeriodCode:target.period,specialElectionIndex:'0',
   amendmentIndex:0,viewerRevisionClass:'original',
   pdfIdentityStatus:PDF_STATUS,sourcePdfSha256:pdfSha,
   sourcePdfBytes:Number(bytes),periodStart:start,periodEnd:end,
   boardReceivedOn:board,calendarDueOn:due,conservativeNotBeforeOn:floor,
   viewerApiSha256:target.viewerSha,aliasCanonicalVersionId:null,
   historicalActualPublicByOn:null,officialPdfUrl:versionUrl(id),
   proofLedger:SOURCE24,
  };
  seen.set(id,row);newly.push(row);
 }
 const erin=JSON.parse(readFileSync(SOURCEERIN,'utf8'));
 if(erin.scope?.candidate!=='Erin Murphy'
  ||erin.scope?.registrationNumber!=='18443'
  ||erin.reportProofs?.length!==2
  ||!HEX.test(erin.originalCapture?.originalViewerApiSha256??''))
  throw Error('Erin Murphy original source ledger identity drift');
 for(const proof of erin.reportProofs){
  const id=proof.reportId;
  const year=proof.reportYear;
  const calendar=proof.independentDueCalendar;
  if(year!==2021&&year!==2022||id!==`18443:${String(year).slice(2)}:pcc:YE:0:0`
   ||proof.originalReportPdfSha256===null
   ||!HEX.test(proof.originalReportPdfSha256)
   ||!Number.isSafeInteger(proof.originalPdfBytes)
   ||proof.originalPdfBytes<500
   ||proof.originalPeriodStartOn!==year+'-01-01'
   ||proof.originalPeriodEndOn!==year+'-12-31'
   ||!DATE.test(proof.actualBoardReceivedOn??'')
   ||calendar?.originalCalendarDueDateVerified!==true
   ||!DATE.test(calendar?.specificYearEndReportDueOn??'')
   ||!HEX.test(calendar?.originalPdfSha256??'')
   ||!DATE.test(proof.conservativeEarliestStatutoryAndFilingReleaseOn??'')
   ||proof.conservativeEarliestStatutoryAndFilingReleaseOn<=calendar.specificYearEndReportDueOn
   ||proof.conservativeEarliestStatutoryAndFilingReleaseOn<proof.actualBoardReceivedOn
   ||proof.independentlyProvenHistoricalPublicByOn!==null
   ||seen.has(id)
   ||proof.reportViewerUrl!==versionUrl(id))
   throw Error('Erin Murphy official government original year-end source PDF identity or date drift');
  const row={
   reportVersionId:id,reportYear:year,servingSenator:'Erin P. Murphy',
   sourcePanelDistrict:64,committeeRegistration:'18443',
   reportPeriodCode:'YE',specialElectionIndex:'0',amendmentIndex:0,
   viewerRevisionClass:'original',pdfIdentityStatus:PDF_STATUS,
   sourcePdfSha256:proof.originalReportPdfSha256,
   sourcePdfBytes:proof.originalPdfBytes,
   periodStart:proof.originalPeriodStartOn,periodEnd:proof.originalPeriodEndOn,
   boardReceivedOn:proof.actualBoardReceivedOn,
   calendarDueOn:calendar.specificYearEndReportDueOn,
   conservativeNotBeforeOn:proof.conservativeEarliestStatutoryAndFilingReleaseOn,
   viewerApiSha256:erin.originalCapture.originalViewerApiSha256,
   aliasCanonicalVersionId:null,historicalActualPublicByOn:null,
   officialPdfUrl:proof.reportViewerUrl,proofLedger:SOURCEERIN
  };
  seen.set(id,row);newly.push(row);
 }
 const all=[...result.rows,...newly].sort((a,b)=>a.reportYear-b.reportYear
  ||a.sourcePanelDistrict-b.sourcePanelDistrict
  ||a.committeeRegistration.localeCompare(b.committeeRegistration)
  ||a.reportVersionId.localeCompare(b.reportVersionId));
 const binaries=all.filter(r=>r.pdfIdentityStatus.startsWith('authenticated_'));
 const orig=all.filter(r=>r.viewerRevisionClass==='original');
 const amend=all.filter(r=>r.viewerRevisionClass==='amended');
 const holds=all.filter(r=>r.pdfIdentityStatus==='source_identity_hold');
 const aliases=all.filter(r=>r.pdfIdentityStatus==='exact_pdf_alias');
 const regs=new Set(all.map(r=>r.committeeRegistration));
 const byYear=[2021,2022,2023,2024,2025].map(year=>{
  const items=all.filter(x=>x.reportYear===year);
  return{year,sourceVersionReferences:items.length,
   original:items.filter(x=>x.viewerRevisionClass==='original').length,
   amended:items.filter(x=>x.viewerRevisionClass==='amended').length,
   verifiedDistinctPdfs:items.filter(x=>x.pdfIdentityStatus.startsWith('authenticated_')).length,
   identityHolds:items.filter(x=>x.pdfIdentityStatus==='source_identity_hold').length,
   identicalViewerAliases:items.filter(x=>x.pdfIdentityStatus==='exact_pdf_alias').length};
 });
 const expected=[[30,17,13,29,1,0],[134,91,43,133,0,1],
  [32,22,10,30,2,0],[39,22,17,38,0,1],[20,12,8,19,0,1]];
 if(all.length!==255||seen.size!==255||newly.length!==26
  ||orig.length!==164||amend.length!==91||binaries.length!==249
  ||new Set(binaries.map(x=>x.sourcePdfSha256)).size!==249
  ||holds.length!==3||aliases.length!==3||regs.size!==38
  ||all.some(x=>x.historicalActualPublicByOn!==null)
  ||byYear.some((x,i)=>[x.sourceVersionReferences,x.original,x.amended,
   x.verifiedDistinctPdfs,x.identityHolds,x.identicalViewerAliases]
   .some((val,j)=>val!==expected[i][j])))
   throw Error('CFB exact Senate report version provenance counts or complete binary identity drift');
 return{rows:all,newRows:newly,byYear};
}
export function buildV16ActualSenatorVersionCrosswalk(rows){
 const official=readFileSync(SENATOR95,'utf8').trimEnd().split('\n').map(x=>x.split('|'));
 if(official.length!==95||official.some(x=>x.length!==10))
  throw Error('Original officially serving 95-person LRL crosswalk drift');
 const keyToSenator=new Map(official.map(x=>[serviceNameKey(x[0]),x]));
 if(keyToSenator.size!==95||keyToSenator.has(null))
  throw Error('Actual-serving senator identity collision');
 const byName=new Map();
 for(const r of rows){
  const k=serviceNameKey(r.servingSenator);
  const senator=keyToSenator.get(k);
  if(!senator)throw Error('Report version principal is not a source-proven actually serving senator: '+r.reportVersionId);
  if(!byName.has(k))byName.set(k,[]);
  byName.get(k).push(r);
 }
 if(byName.size!==38)throw Error('Selected source-proven CFB original version principal count not 38');
 const result=official.map(o=>{
  const records=byName.get(serviceNameKey(o[0]))??[];
  const regs=[...new Set(records.map(x=>x.committeeRegistration))].sort();
  if(regs.length>1)throw Error('Multiple CFB registrations need separately reviewed historical person join');
  const years=[...new Set(records.map(x=>x.reportYear))].sort();
  return{
   officialSenator:o[0],sourceServiceYears:o[1],sourceDistrictByYear:o[2],
   sourceServiceUrl:o[3],sourceProvenCFBRegistrations:regs.join(',')||'-',
   officialReportVersionRefsInSelectedPanel:records.length,
   reportYearsObservedInSelectedPanel:years.join(',')||'-',
   sourceProofStatus:records.length
    ?'CFB_original_report_PDF_source_proven_not_entire_person_year_universe'
    :'not_in_selected_original_PDF_version_sources_not_no_report',
   exactHistoricalVersionPublicByProvenCount:0,
   legallyOwedReportCount:'UNKNOWN_NOT_IN_SCOPE',
  };
 });
 if(result.filter(x=>x.sourceProvenCFBRegistrations!=='-').length!==38
  ||result.filter(x=>x.sourceProvenCFBRegistrations==='-').length!==57
  ||result.reduce((n,x)=>n+x.officialReportVersionRefsInSelectedPanel,0)!==255
  ||result.length!==95)throw Error('Original 95 senator-to-38 CFB source panel version source count drift');
 return result;
}
function asValue(value){
 const s=String(value??'-');
 if(!s||/[|\r\n]/.test(s))throw Error('Output source metadata unsafe');
 return s;
}
export function serializeV16SenatorCrosswalk(rows){
 return rows.map(row=>fields.map(f=>asValue(row[f])).join('|')).join('\n')+'\n';
}
export function verifyV16PermanentSourceLedgers(){
 const source=buildV16ReportSourceVersionLedger();
 const version=serializeServedExactLedger(source.rows);
 const permanent=readFileSync(FULL_VERSION_PSV,'utf8');
 if(version!==permanent)throw Error('255 original CFB PDF report version ledger not reproducible from original source');
 const persons=buildV16ActualSenatorVersionCrosswalk(source.rows);
 const roster=serializeV16SenatorCrosswalk(persons);
 if(roster!==readFileSync(FULL_SENATOR_PSV,'utf8'))
  throw Error('95 actually serving senator original 38 principal registration crosswalk not immutable');
 return{schema:SCHEMA,versionRows:source.rows.length,
  uniqueAuthenticSourcePdfs:249,officialCandidateRegistrationPrincipals:38,
  actualSenateServingPersons:95,sourcePanelNotRepresentedPeople:57,
  originalVersionRefs:164,amendedVersionRefs:91,
  officialPdfHeaderIdentityHolds:3,officialViewerBinaryAliases:3,
  independentlyProvenExactHistoricalPdfPublicByDates:0,
  byYear:source.byYear,
  originalSourceVersionLedgerSha256:sha(version),
  originalSenatorCoverageLedgerSha256:sha(roster),
  protectedDatabaseReadsOrWrites:0,legalFiledReportObligationDenominator:null,
  noBulkFinanceOrOldEligibilityWork:true,contentSourcePdfsNotSaved:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2)throw Error('No selectable unreviewed source/report inputs');
 console.log('CFB_864_255_EXACT_OFFICIAL_REPORT_PDF_VERSION_V16 '+
  JSON.stringify(verifyV16PermanentSourceLedgers()));
}
