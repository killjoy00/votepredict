/**
 * #864 Track B: offline, SOURCE-SCOPED crosscheck of exact CFB viewer
 * report-version IDs against the already authenticated V12 original PDFs.
 * Public aggregate and committee metadata only. NO donor/transaction data,
 * database, network, forecast eligibility, file mutation or claims of legally
 * owed reports. A viewer response observed in 2026 is NOT historical public-by.
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {buildServedExactVersionLedger,verifyPinnedServedExactLedger} from './audit-cfb-864-served-report-version-ledger-v12.mjs';

const DIR='docs/evaluation/source-proof/';
export const OUTPUT=DIR+'cfb-2021-25-served-25-committee-year-crosssource-v13.psv';
export const FIELDS=[
 'committeeRegistration','servingSenator','sourcePanelDistrict','reportYear',
 'sourceViewerCohort','sourceViewerResponseSha256',
 'viewerOriginalVersionRefs','viewerAmendmentVersionRefs',
 'authenticatedDistinctPdfBodies','identityHolds','viewerIndexAliases',
 'exactHistoricalPublicByVerified','registrationDateShownIn2026Registry',
 'terminationLabelShownIn2026Viewer','originalVersionIds','amendmentVersionIds',
 'legallyOwedReportObligations','financialContentRowReconciliation'
];
const HASH=/^[a-f0-9]{64}$/;
const REPORT=/^(\d{4,6}):(2[1-5]):pcc:(C|E|YE):([01]):(\d+)$/;
const AOC=new Set(['2442:22:aoc:C:0:0','2471:22:aoc:C:0:0',
 '2491:22:aoc:C:0:0','2495:22:aoc:C:0:0']);
const read=(p)=>readFileSync(DIR+p,'utf8');
const sourceRows=(p,count,cols)=>{
 const x=read(p).trimEnd().split('\n').map(s=>s.split('|'));
 if(x.length!==count||x.some(z=>z.length!==cols))
  throw Error('Pinned CFB source shape changed: '+p);
 return x;
};
const sha256=(s)=>createHash('sha256').update(s).digest('hex');
const sha1blob=(s)=>{
 const buf=Buffer.from(s,'utf8');
 return createHash('sha1').update('blob '+buf.length+'\0').update(buf).digest('hex');
};
export function decode2025ReportToken(reg,token){
 const m=/^(C|E|YE)([01])\.(\d+)$/.exec(token);
 if(!/^\d{4,6}$/.test(reg)||!m)throw Error('Invalid exact 2025 CFB source token');
 return reg+':25:pcc:'+m[1]+':'+m[2]+':'+m[3];
}
export function confirmVersionProof(ledgerRow,view){
 if(!view||view.sha!==ledgerRow.viewerApiSha256
   ||view.reg!==ledgerRow.committeeRegistration
   ||view.year!==ledgerRow.reportYear)
  throw Error('Official viewer original report ID / body SHA mismatch: '+ledgerRow.reportVersionId);
 if(!REPORT.test(ledgerRow.reportVersionId)
   ||ledgerRow.historicalActualPublicByOn!==null
   ||!HASH.test(ledgerRow.sourcePdfSha256))
  throw Error('Invalid historical source or publication-proof state');
 return true;
}
const rowStr=(o)=>FIELDS.map(f=>{
 const v=o[f]??'-',s=String(v);
 if(!s||/[|\n\r]/.test(s))throw Error('Unsafe CFB public report metadata field');
 return s;
}).join('|');
export const serialize=(rows)=>rows.map(rowStr).join('\n')+'\n';

export function buildViewerCrosscheck(){
 // Rebuild the independently authenticated 229 original PDF version records
 // before attempting source joins. The V12 ledger must match the source files.
 verifyPinnedServedExactLedger();
 const {rows:authenticated}=buildServedExactVersionLedger();
 const p396='cfb-2021-24-senate-396-original-viewer-source-observations.psv';
 const p41='cfb-2025-dated-senate-85-reference-versions.psv';
 const p8='cfb-2024-eight-verified-senators-original-viewer-responses.psv';
 const c396=JSON.parse(read('cfb-2021-24-senate-396-source-viewer-count-checkpoint.json'));
 const c41=JSON.parse(read('cfb-2025-dated-senate-85-reference-source-checkpoint.json'));
 const c8=JSON.parse(read('cfb-2024-eight-verified-senators-viewer-gap-source-checkpoint.json'));
 if(sha256(read(p396).trimEnd())!==c396.provenance.metadataOnly396SourceRowsCanonicalPsvSha256WithoutTrailingNewline
   ||sha256(read(p41).trimEnd())!==c41.provenance.canonicalVersionLedgerSha256WithoutFinalNewline
   ||sha1blob(read(p8))!==c8.viewerSnapshotsLedger.gitBlobSha)
  throw Error('Pinned official CFB viewer source-body metadata fingerprint changed');
 const versions=new Map(),snapshots=new Map();
 const provenance={core_396:0,eight_recovered:0,special_41:0,excluded_affidavit:0};
 function addSnapshot(reg,year,sha,cohort){
  if(!HASH.test(sha))throw Error('Missing source response SHA');
  const key=reg+':'+year;
  if(snapshots.has(key))throw Error('Overlapping CFB year-committee viewer response');
  snapshots.set(key,{reg,year,sha,cohort});
 }
 function addVersion(id,reg,year,sha,cohort){
  if(!REPORT.test(id))throw Error('Non-PCC report entered financial version universe: '+id);
  if(versions.has(id))throw Error('Duplicate exact CFB version identity');
  if(!snapshots.has(reg+':'+year)||snapshots.get(reg+':'+year).sha!==sha)
   throw Error('No matching source viewer response for CFB version');
  versions.set(id,{reg,year,sha,cohort});
  provenance[cohort]++;
 }
 const old=sourceRows(p396,396,4);
 const observedSegmentPairs=new Set();
 for(const [segment,reg,sha,tokens] of old){
  if(!['2022','2024'].includes(segment)||!/^\d{4,6}$/.test(reg))
   throw Error('Invalid CFB district viewer segment');
  const pair=segment+':'+reg;
  if(observedSegmentPairs.has(pair))throw Error('Duplicate 396 source response');
  observedSegmentPairs.add(pair);
  const years=segment==='2022'?[2021,2022]:[2023,2024];
  for(const y of years)addSnapshot(reg,y,sha,'core_396');
  for(const token of (tokens?tokens.split(','):[])){
   const id=reg+':'+token;
   if(AOC.has(id)){provenance.excluded_affidavit++;continue;}
   const m=REPORT.exec(id),year=m?2000+Number(m[2]):NaN;
   if(!years.includes(year))throw Error('Source ID crosses CFB viewer segment');
   addVersion(id,reg,year,sha,'core_396');
  }
 }
 if(observedSegmentPairs.size!==396||provenance.core_396!==1378
    ||provenance.excluded_affidavit!==4
    ||new Set(old.map(r=>r[1])).size!==275)
  throw Error('Known 396-source CFB principal report/affidavit population drift');
 for(const [reg,person,district,sha,seen,o23,a23,o24,a24,ids] of sourceRows(p8,8,10)){
  if(!person||!Number.isInteger(+district)||!seen.startsWith('2026-10-')
   ||[o23,a23,o24,a24].some(v=>!/^\d+$/.test(v)))
   throw Error('Original eight-response metadata corrupted');
  addSnapshot(reg,2023,sha,'eight_recovered');
  addSnapshot(reg,2024,sha,'eight_recovered');
  const toks=ids.split(',');
  if(toks.length!==Number(o23)+Number(a23)+Number(o24)+Number(a24))
   throw Error('Recovered response report totals conflict with version keys');
  for(const id of toks){
   const m=REPORT.exec(id),year=m?2000+Number(m[2]):NaN;
   if(m?.[1]!==reg||![2023,2024].includes(year))
    throw Error('Recovered eight source response contains unexpected version');
   addVersion(id,reg,year,sha,'eight_recovered');
  }
 }
 if(provenance.eight_recovered!==27)throw Error('Unexpected eight-source report version scope');
 for(const [reg,sha,tokens] of sourceRows(p41,41,3)){
  addSnapshot(reg,2025,sha,'special_41');
  for(const token of (tokens?tokens.split(','):[]))
   addVersion(decode2025ReportToken(reg,token),reg,2025,sha,'special_41');
 }
 if(provenance.special_41!==85||versions.size!==1490)
  throw Error('Exact official CFB report-version source universe drift');
 const verified=new Map(),ledgerOrigin={core_396:0,eight_recovered:0,special_41:0};
 for(const row of authenticated){
  if(verified.has(row.reportVersionId))throw Error('Duplicate authenticated ledger ID');
  const view=versions.get(row.reportVersionId);
  confirmVersionProof(row,view);
  verified.set(row.reportVersionId,row);
  ledgerOrigin[view.cohort]++;
 }
 if(verified.size!==229||ledgerOrigin.core_396!==182
  ||ledgerOrigin.eight_recovered!==27||ledgerOrigin.special_41!==20)
  throw Error('Source reference versus authenticated PDF ledger join drift');
 const registrations=new Map(sourceRows('cfb-2026-public-current-senate-registration-dates.psv',230,3)
  .map(r=>[r[0],{registeredOn:r[1],terminatedOn:r[2]}]));
 const historicalStatus=new Map(sourceRows(
  'cfb-2023-24-22-committee-signed-board-contemporaneous-status-matrix.psv',22,14)
  .map(r=>[r[0],r[8]]));
 const selected=new Map();
 for(const r of authenticated){
  const old=selected.get(r.committeeRegistration);
  if(old&&(old.name!==r.servingSenator||old.district!==r.sourcePanelDistrict))
   throw Error('Conflicting previously source-verified Senate committee identities');
  selected.set(r.committeeRegistration,{name:r.servingSenator,district:r.sourcePanelDistrict});
 }
 if(selected.size!==25)throw Error('Expected scoped 25 official candidate committees');
 const pre2025=new Set(authenticated.filter(r=>r.reportYear<2025).map(r=>r.committeeRegistration));
 const special2025=new Set(authenticated.filter(r=>r.reportYear===2025).map(r=>r.committeeRegistration));
 if(pre2025.size!==22||special2025.size!==3
   ||[...special2025].some(reg=>pre2025.has(reg)))
  throw Error('Only independently sourced actual-service panels can be joined');
 const byYear=[];
 const committeeYears=[];
 let hasRegistry=0,terminationLabels=0;
 for(const [reg,p] of [...selected].sort(([a],[b])=>Number(a)-Number(b))){
  const registration=registrations.get(reg);
  const priorStatus=historicalStatus.get(reg);
  const terminatedLabel=priorStatus==='explicitly_terminated_on_2026_viewer'
   ?'label_terminated_on_2026_viewer'
   :priorStatus==='no_terminated_label_on_2026_viewer'
    ?'no_terminated_label_on_2026_viewer':'not_in_22_committee_status_sample';
  if(registration)hasRegistry++;
  if(terminatedLabel==='label_terminated_on_2026_viewer')terminationLabels++;
  const years=pre2025.has(reg)?[2021,2022,2023,2024]:[2025];
  for(const year of years){
   const snapshot=snapshots.get(reg+':'+year);
   if(!snapshot)throw Error('Missing original viewer response for scoped senator/year');
   const originalIds=[],amendIds=[];
   for(const [id,v] of versions){
    if(v.reg!==reg||v.year!==year)continue;
    if(Number(REPORT.exec(id)[5])===0)originalIds.push(id);
    else amendIds.push(id);
   }
   originalIds.sort();amendIds.sort();
   const proofRows=authenticated.filter(r=>r.committeeRegistration===reg&&r.reportYear===year);
   const observed=[...originalIds,...amendIds].sort();
   if(JSON.stringify(observed)!==JSON.stringify(proofRows.map(r=>r.reportVersionId).sort()))
    throw Error('Committee-year original vs amendment viewer source mismatch');
   committeeYears.push({
    committeeRegistration:reg,servingSenator:p.name,sourcePanelDistrict:p.district,
    reportYear:year,sourceViewerCohort:snapshot.cohort,
    sourceViewerResponseSha256:snapshot.sha,
    viewerOriginalVersionRefs:originalIds.length,viewerAmendmentVersionRefs:amendIds.length,
    authenticatedDistinctPdfBodies:proofRows.filter(r=>r.pdfIdentityStatus.startsWith('authenticated_')).length,
    identityHolds:proofRows.filter(r=>r.pdfIdentityStatus==='source_identity_hold').length,
    viewerIndexAliases:proofRows.filter(r=>r.pdfIdentityStatus==='exact_pdf_alias').length,
    exactHistoricalPublicByVerified:0,
    registrationDateShownIn2026Registry:registration?.registeredOn||'-',
    terminationLabelShownIn2026Viewer:terminatedLabel,
    originalVersionIds:originalIds.join(',')||'-',
    amendmentVersionIds:amendIds.join(',')||'-',
    legallyOwedReportObligations:'UNKNOWN',
    financialContentRowReconciliation:'NOT_PERFORMED'
   });
  }
 }
 if(committeeYears.length!==91||hasRegistry!==23||terminationLabels!==2)
  throw Error('Committee/year source scope or 2026 registry crosscheck changed');
 for(let year=2021;year<=2025;year++){
  const rows=committeeYears.filter(r=>r.reportYear===year);
  byYear.push({year,scopedCommittees:rows.length,
   originalVersionReferences:rows.reduce((n,r)=>n+r.viewerOriginalVersionRefs,0),
   amendedVersionReferences:rows.reduce((n,r)=>n+r.viewerAmendmentVersionRefs,0),
   authenticatedDistinctPdfs:rows.reduce((n,r)=>n+r.authenticatedDistinctPdfBodies,0),
   identityHolds:rows.reduce((n,r)=>n+r.identityHolds,0),
   viewerAliases:rows.reduce((n,r)=>n+r.viewerIndexAliases,0),
   exactHistoricalPublicByVerified:0});
 }
 const expected=[[2021,22,16,13,28,1,0],[2022,22,66,43,108,0,1],
  [2023,22,22,10,30,2,0],[2024,22,22,17,38,0,1],
  [2025,3,12,8,19,0,1]];
 if(JSON.stringify(byYear.map(r=>[r.year,r.scopedCommittees,
  r.originalVersionReferences,r.amendedVersionReferences,
  r.authenticatedDistinctPdfs,r.identityHolds,r.viewerAliases]))
 !==JSON.stringify(expected))throw Error('Year-source reconciliation totals drift');
 return {committeeYears,receipt:{
  schema:'cfb-864-official-viewer-to-original-pdf-source-scoped-v13',
  originalResponseSnapshotPairs:396+8+41,
  originalViewerScopeRegistrations2021to24:275,
  sourceObservedPccVersionReferences:versions.size,
  officialAncillaryAffidavitReferencesExcluded:4,
  candidateCommitteePersonPairsIndependentlyServiceScoped:25,
  committeeYearSourceObservations:committeeYears.length,
  publishedExactVersionLedgerRefs:229,
  pdfLedgerRefsRejoinedToOriginalCfbViewerBodySha:229,
  exactViewerVersionIdsInCore396:ledgerOrigin.core_396,
  exactViewerVersionIdsInEightRecovery:ledgerOrigin.eight_recovered,
  exactViewerVersionIdsIn2025FortyOne:ledgerOrigin.special_41,
  sourceViewerVersionIdsNotInServed25PdfLedger:versions.size-verified.size,
  registryRegistrationDatesAvailableForScopedCommittees:hasRegistry,
  terminatedLabelsAvailableOn2026ViewerForScopedCommittees:terminationLabels,
  exactHistoricalPublicByProofs:0,
  committeeYearLegalOwedReportDenominator:null,
  financialRowContainmentProven:false,
  sourceScopedNotFull2021to25StatewideSenatorCensus:true,
  byYear}};
}
export function verifyPinnedViewerCrosscheck(){
 const {committeeYears,receipt}=buildViewerCrosscheck();
 if(readFileSync(OUTPUT,'utf8')!==serialize(committeeYears))
  throw Error('Source-scoped committee-year PSV differs from rejoined exact official viewer and PDF evidence');
 return receipt;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2)throw Error('Offline immutable source audit accepts no flags');
 console.log('CFB_864_VIEWER_PDF_CROSSCHECK_V13 '+JSON.stringify(verifyPinnedViewerCrosscheck()));
}
