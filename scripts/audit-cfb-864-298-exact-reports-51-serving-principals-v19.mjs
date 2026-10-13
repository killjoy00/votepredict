/**
 * #864 report-PDF VERSION evidence only: reconstruct exact 298 official
 * original/amended CFB 2021–25 source refs from 255 previously separately
 * source-certified original/acquired versions and 43 newly original-source-
 * verified CFB 2023/24 report viewer PDF versions (three registration
 * first-page identity HOLDS, one same-PDF-index alias).
 *
 * No historically actual public-by inventing, legally owed filing counts,
 * bulk finance transactions, private DB, model/serving or 2027 changes.
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {buildV16ReportSourceVersionLedger,verifyV16PermanentSourceLedgers}
 from './audit-cfb-864-255-exact-report-version-ledger-v16.mjs';
import {serializeServedExactLedger,FIELDS as BASE_FIELDS}
 from './audit-cfb-864-served-report-version-ledger-v12.mjs';

export const SCHEMA='cfb-864-2021-25-51-actual-senator-CFB-principals-298-version-PDF-ledger-v19';
export const SOURCE_V18='docs/evaluation/source-proof/cfb-2023-24-thirteen-served-43-original-amended-yearend-pdfs-v18.psv';
export const SOURCE_CHECKPOINT='docs/evaluation/source-proof/cfb-2023-24-13-serving-original-amended-source-checkpoint-v18.json';
export const ALL_298='docs/evaluation/source-proof/cfb-2021-25-51-actually-serving-principals-298-exact-report-version-pdfs-v19.psv';
export const ALL_95='docs/evaluation/source-proof/cfb-2021-25-95-serving-senators-51-source-authentic-CFB-report-principals-v19.psv';
export const ORIGINAL_95='docs/evaluation/source-proof/cfb-2021-25-95-served-senator-38-report-principal-crosswalk-v16.psv';
export const ORIGINAL_REGISTRY='docs/evaluation/source-proof/cfb-2021-25-57-additional-serving-senator-original-candidate-registration-leads-v17.psv';
const SHA=/^[a-f0-9]{64}$/;
const DATE=/^20\d\d-\d\d-\d\d$/;
const HOLD='original_pdf_firstpage_committee_district_period_or_receipt_hold';
const PANEL_ISSUE=864;
function sha(s){return createHash('sha256').update(s,'utf8').digest('hex')}
function gitBlob(s){return createHash('sha1').update('blob '+Buffer.byteLength(s,'utf8')+'\0').update(s,'utf8').digest('hex')}
function personKey(name){
 const t=String(name).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/[^a-z0-9 ]/g,' ').trim().split(/\s+/).filter(x=>!['sr','jr','ii','iii','iv'].includes(x));
 return t.length>1?t[0]+'|'+t.at(-1):null;
}
function officialVersionUrl(id){
 const [reg,year,typ,period,se,amend]=id.split(':');
 if(!/^\d{4,8}$/.test(reg)||!['23','24'].includes(year)
  ||typ!=='pcc'||period!=='YE'||se!=='0'||!/^\d+$/.test(amend))
  throw Error('Official original CFB report viewer immutable version ID invalid');
 return 'https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&downloadpdf=false&year='+
  year+'&type=pcc&period=YE&se=0&regnum='+reg+'&amend='+amend;
}
export function sourceVerified43OriginalYearEndReportVersions(){
 const content=readFileSync(SOURCE_V18,'utf8');
 const proof=JSON.parse(readFileSync(SOURCE_CHECKPOINT,'utf8'));
 if(!content.endsWith('\n')||proof.schema!==
   'cfb-864-2023-24-13-served-43-exact-full-original-amended-yearend-pdf-source-checkpoint-v18'
  ||gitBlob(content)!==proof.sourceProofMetadata.metadataPsvGitBlobSha
  ||proof.sourceProofMetadata.metadataRowCount!==43
  ||proof.sourceProofMetadata.authenticatedDistinctSourcePdfBodies!==39
  ||proof.sourceProofMetadata.firstPageRegistrationIdentityHolds!==3
  ||proof.sourceProofMetadata.exactSourcePdfBinaryAliases!==1
  ||proof.sourceProofMetadata.actualHistoricalPublicationByExactPdfShaCount!==0
  ||proof.observedCfbOriginalAcquisition.independentOriginalApiSources?.length!==13)
  throw Error('V18 exact original PDF full byte source checkpoint changed');
 const oldRegSource=readFileSync(ORIGINAL_REGISTRY,'utf8').trimEnd().split('\n').map(x=>x.split('|'));
 const sourceRegs=new Map(oldRegSource.map(x=>[x[1],x]));
 if(sourceRegs.size!==57)throw Error('Original 57 CFB candidate source principals drift');
 const reports=content.trimEnd().split('\n').map(x=>x.split('|'));
 if(reports.length!==43||reports.some(x=>x.length!==18)
  ||new Set(reports.map(x=>x[0])).size!==43)
  throw Error('V18 original CFB 43 unique version IDs not permanently proven');
 const cps=new Map(proof.observedCfbOriginalAcquisition.independentOriginalApiSources.map(x=>[x.registration,x]));
 const rows=[];
 for(const x of reports){
  const[id,person,district,reg,year,amend,status,pdfSha,bytes,start,end,board,due,floor,viewer,alias,candidateSha,historic]=x;
  const m=/^(\d{4,8}):(23|24):pcc:YE:0:(\d+)$/.exec(id);
  const p=sourceRegs.get(reg),api=cps.get(reg);
  if(!m||m[1]!==reg||Number(m[2])!==Number(year)
   ||Number(m[3])!==Number(amend)||!p||p[0]!==person
   ||p[3]!=='EXACT'||p[4]!=='2022'||p[5]!==district
   ||p[6]!==candidateSha
   ||!api||api.senator!==person||api.viewerOriginalSha256!==viewer
   ||api.candidateOriginalPageSha256!==candidateSha
   ||!SHA.test(viewer)||!SHA.test(pdfSha)
   ||!Number.isSafeInteger(Number(bytes))||Number(bytes)<1000
   ||!['authenticated_original_pdf','authenticated_amendment_pdf',
      'exact_pdf_alias',HOLD].includes(status)
   ||!['2023','2024'].includes(year)||!['2024-01-31','2025-01-31'].includes(due)
   ||due!==(year==='2023'?'2024-01-31':'2025-01-31')
   ||historic!=='-')
   throw Error('Exact original CFB 2023/24 source version registration, header/receipt or no public-by drift '+id);
  const held=status===HOLD;
  if(held){
   if(start!=='-'||end!=='-'||board!=='-'||floor!=='-'||alias!=='-')
    throw Error('Original full binary registration-identity HOLD cannot be given verified period/receipt/release date');
  }else if(start!==year+'-01-01'||end!==year+'-12-31'
   ||!DATE.test(board)||!DATE.test(floor)
   ||floor<board||floor<=due)
   throw Error('Original government PDF firstpage coverage, Board-stamp or legal floor invalid');
  if(status==='authenticated_original_pdf'&&amend!=='0'
   ||status==='authenticated_amendment_pdf'&&amend==='0'
   ||status==='exact_pdf_alias'&&(amend==='0'||alias==='-')
   ||status!=='exact_pdf_alias'&&alias!=='-')
   throw Error('Source PDF original amendment/alias classification contradicted');
  rows.push({
   reportVersionId:id,reportYear:Number(year),servingSenator:person,
   sourcePanelDistrict:Number(district),committeeRegistration:reg,
   reportPeriodCode:'YE',specialElectionIndex:'0',amendmentIndex:Number(amend),
   viewerRevisionClass:amend==='0'?'original':'amended',
   pdfIdentityStatus:held?'source_identity_hold':status,
   sourcePdfSha256:pdfSha,sourcePdfBytes:Number(bytes),
   periodStart:held?'-':start,periodEnd:held?'-':end,
   boardReceivedOn:held?'-':board,calendarDueOn:due,
   conservativeNotBeforeOn:held?'-':floor,
   viewerApiSha256:viewer,aliasCanonicalVersionId:alias==='-'?null:alias,
   historicalActualPublicByOn:null,officialPdfUrl:officialVersionUrl(id),
   proofLedger:SOURCE_V18
  });
 }
 const auth=rows.filter(r=>r.pdfIdentityStatus.startsWith('authenticated_'));
 const aliases=rows.filter(r=>r.pdfIdentityStatus==='exact_pdf_alias');
 const holds=rows.filter(r=>r.pdfIdentityStatus==='source_identity_hold');
 if(auth.length!==39||new Set(auth.map(x=>x.sourcePdfSha256)).size!==39
  ||rows.filter(x=>x.pdfIdentityStatus==='authenticated_original_pdf').length!==25
  ||rows.filter(x=>x.pdfIdentityStatus==='authenticated_amendment_pdf').length!==14
  ||holds.length!==3||aliases.length!==1||new Set(rows.map(x=>x.committeeRegistration)).size!==13)
  throw Error('Independent original source V18 new 43 version authenticity counts changed');
 for(const a of aliases){
  const canonical=rows.find(r=>r.reportVersionId===a.aliasCanonicalVersionId);
  if(!canonical||canonical.sourcePdfSha256!==a.sourcePdfSha256
   ||canonical.committeeRegistration!==a.committeeRegistration
   ||canonical.reportYear!==a.reportYear
   ||!canonical.pdfIdentityStatus.startsWith('authenticated_'))
   throw Error('Official CFB original source identical PDF alias identity not independently proven');
 }
 return rows;
}
export function assembleExpanded298OfficialVersionSources(){
 verifyV16PermanentSourceLedgers();
 const old=buildV16ReportSourceVersionLedger().rows;
 if(old.length!==255)throw Error('Prior 255 source original PDF versions changed');
 const next=sourceVerified43OriginalYearEndReportVersions();
 const all=[...old,...next];
 const ids=new Set(all.map(x=>x.reportVersionId));
 const certified=all.filter(x=>x.pdfIdentityStatus.startsWith('authenticated_'));
 const binaries=new Set(certified.map(x=>x.sourcePdfSha256));
 const personRegs=new Set(all.map(x=>x.committeeRegistration));
 const orig=all.filter(x=>x.viewerRevisionClass==='original');
 const am=all.filter(x=>x.viewerRevisionClass==='amended');
 const holds=all.filter(x=>x.pdfIdentityStatus==='source_identity_hold');
 const aliases=all.filter(x=>x.pdfIdentityStatus==='exact_pdf_alias');
 if(all.length!==298||ids.size!==298||binaries.size!==288
  ||certified.length!==288||personRegs.size!==51
  ||orig.length!==190||am.length!==108||holds.length!==6
  ||aliases.length!==4||all.some(x=>x.historicalActualPublicByOn!==null))
  throw Error('Official 298 original/amended viewer refs or 288 distinct signed PDF proofs drifted');
 all.sort((a,b)=>a.reportYear-b.reportYear||a.sourcePanelDistrict-b.sourcePanelDistrict
  ||a.committeeRegistration.localeCompare(b.committeeRegistration)
  ||a.reportVersionId.localeCompare(b.reportVersionId));
 const years=[2021,2022,2023,2024,2025].map(year=>{
  const r=all.filter(x=>x.reportYear===year);
  return{year,reportVersionRefs:r.length,
   original:r.filter(x=>x.viewerRevisionClass==='original').length,
   amended:r.filter(x=>x.viewerRevisionClass==='amended').length,
   independentlyAuthenticatedDistinctSourcePdfBodies:
    r.filter(x=>x.pdfIdentityStatus.startsWith('authenticated_')).length,
   identityHolds:r.filter(x=>x.pdfIdentityStatus==='source_identity_hold').length,
   identicalViewerAliases:r.filter(x=>x.pdfIdentityStatus==='exact_pdf_alias').length};
 });
 return{all,years};
}
export function audit95ActuallyServingSenatorVersionPanel(rows){
 const official=readFileSync(ORIGINAL_95,'utf8').trimEnd().split('\n').map(x=>x.split('|'));
 if(official.length!==95||official.some(x=>x.length!==10))
  throw Error('Actual LRL original service 95 source rows changed');
 const directory=new Map(official.map(x=>[personKey(x[0]),x]));
 if(directory.size!==95||directory.has(null))
  throw Error('Official serving senator names require individual identity manual review');
 const byPerson=new Map();
 for(const r of rows){
  const key=personKey(r.servingSenator);
  if(!directory.has(key))throw Error('Original CFB source committee person not official actual Senate-served identity');
  if(!byPerson.has(key))byPerson.set(key,[]);
  byPerson.get(key).push(r);
 }
 if(byPerson.size!==51)throw Error('Expected 51 distinct serving senator original CFB signed PDF principals');
 const output=official.map(x=>{
  const observed=byPerson.get(personKey(x[0]))??[];
  const regs=[...new Set(observed.map(r=>r.committeeRegistration))].sort();
  if(regs.length>1)throw Error('More than one registration for same original Senate service person requires separate historical review');
  const years=[...new Set(observed.map(r=>r.reportYear))].sort();
  return[
   x[0],x[1],x[2],x[3],regs.join(',')||'-',
   String(observed.length),years.join(',')||'-',
   observed.length?'source_authentic_selected_CFB_PDF_versions_not_complete_historic_report_universe'
     :'not_yet_observed_in_selected_source_authenticated_original_CFB_PDFs',
   '0','UNKNOWN_NOT_IN_SCOPE'
  ];
 });
 if(output.length!==95||output.filter(x=>x[4]!=='-').length!==51
  ||output.filter(x=>x[4]==='-').length!==44
  ||output.reduce((n,x)=>n+Number(x[5]),0)!==298)
  throw Error('Actual serving senator source CFB committee report version source coverage drift');
 return output;
}
export function serialize95SenateCoverage(rows){
 return rows.map(r=>{
  if(r.length!==10||r.some(v=>!v||String(v).includes('|')||String(v).includes('\n')))
   throw Error('Invalid public original Senate serving person coverage field');
  return r.join('|');
 }).join('\n')+'\n';
}
export function verifyPermanent298SourceLedgers(){
 const proof=assembleExpanded298OfficialVersionSources();
 const versions=serializeServedExactLedger(proof.all);
 const permanent=readFileSync(ALL_298,'utf8');
 if(BASE_FIELDS.length!==22||versions!==permanent)
  throw Error('Permanent 298 source-authentic official original/amended PDF ledger not derived from original source');
 const persons=serialize95SenateCoverage(audit95ActuallyServingSenatorVersionPanel(proof.all));
 if(persons!==readFileSync(ALL_95,'utf8'))
  throw Error('Original 95 actually serving senators to 51 authenticated CFB PDF principals not reproduced');
 return{
  schema:SCHEMA,issue:PANEL_ISSUE,
  actualServingSenatorSourceRoster:95,
  sourceAuthenticatedCFBReportPrincipalSenators:51,
  servingPersonsNotYetInSelectedOriginalPDFSourcePanel:44,
  officialVersionReferences:298,originalReferences:190,amendedReferences:108,
  independentlyAuthenticatedDistinctOriginalPdfBinaries:288,
  originalFirstPageCommitteeIdentityHolds:6,
  officialViewerIndexPdfAliases:4,
  sourceAuthenticOriginalPdfHistoricalActualPublicByCount:0,
  byReportYear:proof.years,
  permanentOriginal298VersionLedgerSha256:sha(versions),
  permanentOfficial95PersonSenatorCoverageSha256:sha(persons),
  candidateRegistrationLedgersNotConflatedWithFiledPdfs:true,
  legallyOwedOriginalReportDenominator:null,
  noBulkFinanceTransactionsOrHistoricalEligibilityBackfill:true,
  noNeonOrProductionDataReadWrite:true,noForecastOrModelServingChange:true
 };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2)throw Error('No externally chosen report-PDF ID source overrides accepted');
 console.log('CFB_864_298_OFFICIAL_REPORT_PDF_VERSION_V19 '+
  JSON.stringify(verifyPermanent298SourceLedgers()));
}
