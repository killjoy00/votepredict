/**
 * #864 Minnesota Senate 2021–25 committee/person-year source observations.
 * Full official legally owed-report denominator CANNOT be derived from a
 * candidate selector, a reported PDF or Senate service year alone.
 * Offline, read-only; nonfiler inferences forbidden.
 */
import{readFileSync}from'node:fs';
import{createHash}from'node:crypto';
import{pathToFileURL}from'node:url';
import{verifyPermanent430SourceLedgers}from'./audit-cfb-864-430-exact-original-amended-report-versions-v21.mjs';
export const SCHEMA='cfb-864-95-Senators-475-committee-report-years-legal-obligation-unknown-v23';
export const PANEL='docs/evaluation/source-proof/cfb-2021-25-95-serving-senators-85-authentic-89-viewer-principals-v21.psv';
export const OUTPUT='docs/evaluation/source-proof/cfb-2021-25-95-actual-serving-senators-475-committee-year-statutory-duty-unknown-matrix-v23.psv';
export const IMMUTABLE_GIT_BLOB_SHA1='32b7b20e572d578cb173923d400178cfd8b295c1';
function blob(s){return createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex')}
function getRows(path,width,count){
 const raw=readFileSync(path,'utf8');
 if(!raw.endsWith('\n')||raw.includes('\r'))throw Error('Source PSV must be exact LF terminated');
 const rows=raw.trimEnd().split('\n').map(x=>x.split('|'));
 if(rows.length!==count||rows.some(x=>x.length!==width||x.some(v=>!v)))
  throw Error('Source PSV width/count changed');
 return{raw,rows};
}
export function verifyComplete95ServingSenatorCommitteeYearMatrix(){
 const proof=verifyPermanent430SourceLedgers();
 const prior=getRows(PANEL,17,95),expected=getRows(OUTPUT,23,475);
 if(blob(expected.raw)!==IMMUTABLE_GIT_BLOB_SHA1)
  throw Error('CFB 475-row official committee-year source matrix byte identity drift');
 const uniqueRegs=new Set(),output=[],years={};
 for(const person of prior.rows){
  const[name,served,terms,,reg,leadStatus,,,,,,,,identity]=person;
  if(uniqueRegs.has(reg)||!reg||reg==='-'||!identity)
   throw Error('Original CFB candidate registration was not uniquely attributed to one serving person');
  uniqueRegs.add(reg);
  const servedYears=new Set(served.split(',').map(Number));
  for(let y=2021;y<=2025;y++){
   const selection=proof.versionRows.filter(v=>v.reg===reg&&v.year===y);
   if(selection.some(v=>v.person!==name))throw Error('CFB report identity crossed senator/committee');
   const refs=selection.length,original=selection.filter(v=>v.kind==='original').length;
   const authentic=selection.filter(v=>v.status.startsWith('authenticated_')).length;
   const held=selection.filter(v=>v.status==='source_identity_hold'||v.status==='source_fetch_hold').length;
   const alias=selection.filter(v=>v.status==='exact_pdf_alias').length;
   const types=[...new Set(selection.map(v=>v.period+':'+v.se))].sort().join(',')||'-';
   const due=[...new Set(selection.map(v=>v.period+':'+v.se+'@'+v.due))].sort().join(',')||'-';
   const district=terms.split(';').find(s=>s.startsWith(y+':'))?.split(':')[1]||'-';
   const source=refs?'official_viewer_versions_observed_selected_pdf_panel':
    'no_selected_official_viewer_version_not_a_nonfiler_finding';
   const line=[
    name,String(y),servedYears.has(y)?'actual_service_overlap':'not_served_in_this_calendar_year',
    district,reg,identity,leadStatus,String(refs),String(original),String(refs-original),
    String(authentic),String(held),String(alias),types,due,source,
    'UNKNOWN','UNKNOWN','UNKNOWN','UNKNOWN','UNKNOWN','unverified',
    selection.map(v=>v.id).join(',')||'-'
   ];
   if(line.length!==23||line.some(x=>x.includes('|')||x.includes('\n')))
    throw Error('Unsafe source row serialization');
   output.push(line.join('|'));
   years[y]??={reportYear:y,actualServingPersons:0,sourceVersionReferences:0,authenticatedFullPdfVersions:0,documentHolds:0,aliases:0};
   years[y].actualServingPersons+=servedYears.has(y)?1:0;
   years[y].sourceVersionReferences+=refs;years[y].authenticatedFullPdfVersions+=authentic;
   years[y].documentHolds+=held;years[y].aliases+=alias;
  }
 }
 if(uniqueRegs.size!==95||output.length!==475||output.join('\n')+'\n'!==expected.raw)
  throw Error('Original official 95-serving-member 475-row committee/year matrix not independently reproducible');
 for(const v of expected.rows){
  if(v[16]!=='UNKNOWN'||v[17]!=='UNKNOWN'||v[18]!=='UNKNOWN'
   ||v[19]!=='UNKNOWN'||v[20]!=='UNKNOWN'||v[21]!=='unverified')
   throw Error('No legal committee registration/termination or owed/received/nonfiler state may be fabricated');
 }
 if(Object.values(years).reduce((n,v)=>n+v.sourceVersionReferences,0)!==430)
  throw Error('Individual committee-year matrix did not account for 430 selected government viewer IDs');
 return{schema:SCHEMA,committeeYearObservationRows:475,actuallyServedPersons:95,
   originalCandidateCommitteeRegistrationLeads:95,
   authenticatedPrincipalPersons:85,committeeRegistrationsWithViewerPDFs:89,
   byReportYear:Object.values(years),
   legalRequiredOriginalReportDenominator:null,
   independentlyProvenCommitteeEffectiveRegistrationYearDenominator:null,
   independentlyProvenTerminationDates:null,
   independentlyProvenNonfilers:null,
   exactPdfHistoricalPublicationDatesCertified:0,
   originalReportReferenceNotEquivalentToRequiredReport:true,
   originalAmendmentNotAdditionalReportingDuty:true,
   noPrivateFinancialSummaryTransactionDonorRows:true,
   noProductionOrStoredHistoricalEligibilityChanges:true,
   outputOriginalGitBlobSha1:IMMUTABLE_GIT_BLOB_SHA1};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2)throw Error('No external inputs accepted');
 console.log('CFB_864_475_COMMITTEE_YEAR_LEGAL_DUTY_UNKNOWN_V23 '+JSON.stringify(verifyComplete95ServingSenatorCommitteeYearMatrix()));
}
