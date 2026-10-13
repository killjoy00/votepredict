import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 SCHEMA,ALL_298,ALL_95,SOURCE_V18,
 sourceVerified43OriginalYearEndReportVersions,
 assembleExpanded298OfficialVersionSources,
 audit95ActuallyServingSenatorVersionPanel,
 serialize95SenateCoverage,verifyPermanent298SourceLedgers,
}from '../scripts/audit-cfb-864-298-exact-reports-51-serving-principals-v19.mjs';
import{serializeServedExactLedger}from '../scripts/audit-cfb-864-served-report-version-ledger-v12.mjs';
const sources=assembleExpanded298OfficialVersionSources();
const rows=sources.all,byId=new Map(rows.map(x=>[x.reportVersionId,x]));
test('source-authentic official 2021–25 report version 255+43 expansion, not registered-candidate discovery',()=>{
 assert.equal(SCHEMA,'cfb-864-2021-25-51-actual-senator-CFB-principals-298-version-PDF-ledger-v19');
 assert.equal(rows.length,298);assert.equal(byId.size,298);
 assert.equal(new Set(rows.map(x=>x.committeeRegistration)).size,51);
 assert.equal(rows.filter(x=>x.viewerRevisionClass==='original').length,190);
 assert.equal(rows.filter(x=>x.viewerRevisionClass==='amended').length,108);
 assert.equal(rows.filter(x=>x.pdfIdentityStatus==='source_identity_hold').length,6);
 assert.equal(rows.filter(x=>x.pdfIdentityStatus==='exact_pdf_alias').length,4);
 const verified=rows.filter(x=>x.pdfIdentityStatus.startsWith('authenticated_'));
 assert.equal(verified.length,288);
 assert.equal(new Set(verified.map(x=>x.sourcePdfSha256)).size,288);
});
test('source report-year cohorts preserve exact original and edited version count and unique full binary',()=>{
 assert.deepEqual(sources.years.map(x=>[
  x.year,x.reportVersionRefs,x.original,x.amended,
  x.independentlyAuthenticatedDistinctSourcePdfBodies,
  x.identityHolds,x.identicalViewerAliases
 ]),[
  [2021,30,17,13,29,1,0],
  [2022,134,91,43,133,0,1],
  [2023,54,35,19,49,5,0],
  [2024,60,35,25,58,0,2],
  [2025,20,12,8,19,0,1],
 ]);
});
test('three old PDF source holds and three newly identified held original source PDF committee registrations never silently pass',()=>{
 const holds=new Set(rows.filter(r=>r.pdfIdentityStatus==='source_identity_hold')
  .map(r=>r.reportVersionId));
 assert.deepEqual(holds,new Set([
  '18430:21:pcc:YE:0:1','17994:23:pcc:YE:0:0',
  '18430:23:pcc:YE:0:1',
  '18809:23:pcc:YE:0:0','18809:23:pcc:YE:0:1',
  '18910:23:pcc:YE:0:1',
 ]));
 for(const id of holds){
  const row=byId.get(id);
  assert.equal(row.conservativeNotBeforeOn==='-'||row.conservativeNotBeforeOn===null,true);
  assert.equal(row.historicalActualPublicByOn,null);
 }
 for(const id of ['18809:23:pcc:YE:0:0','18809:23:pcc:YE:0:1','18910:23:pcc:YE:0:1']){
  const r=byId.get(id);
  assert.equal(r.periodStart,'-');
  assert.equal(r.boardReceivedOn,'-');
  assert.match(r.sourcePdfSha256,/^[a-f0-9]{64}$/);
 }
});
test('four aliases are identical to a genuinely full-authenticated original CFB binary',()=>{
 const aliases=new Map(rows.filter(x=>x.pdfIdentityStatus==='exact_pdf_alias')
  .map(x=>[x.reportVersionId,x.aliasCanonicalVersionId]));
 assert.deepEqual(aliases,new Map([
  ['17319:22:pcc:YE:0:2','17319:22:pcc:YE:0:1'],
  ['18430:24:pcc:YE:0:2','18430:24:pcc:YE:0:1'],
  ['18724:24:pcc:YE:0:3','18724:24:pcc:YE:0:2'],
  ['19229:25:pcc:YE:0:1','19229:25:pcc:YE:0:0'],
 ]));
 for(const[id,canonical]of aliases){
  const alias=byId.get(id),original=byId.get(canonical);
  assert.equal(alias.sourcePdfSha256,original.sourcePdfSha256);
  assert.equal(alias.committeeRegistration,original.committeeRegistration);
  assert.equal(alias.reportYear,original.reportYear);
  assert.ok(original.pdfIdentityStatus.startsWith('authenticated_'));
 }
});
test('previous 255 original full authenticated PDF bodies stay completely unchanged in expanded immutable ledger',()=>{
 const previous=readFileSync(
  'docs/evaluation/source-proof/cfb-2021-25-38-served-principal-255-exact-report-version-ledger-v16.psv','utf8')
  .trimEnd().split('\n').map(x=>x.split('|'));
 assert.equal(previous.length,255);
 const newSourceIds=new Set(sourceVerified43OriginalYearEndReportVersions().map(x=>x.reportVersionId));
 for(const row of previous){
  const after=byId.get(row[0]);
  assert.ok(after);
  assert.ok(!newSourceIds.has(row[0]));
  const serialized=serializeServedExactLedger([after]).trimEnd();
  assert.equal(serialized,row.join('|'));
 }
});
test('all 43 new independently twice-authenticated source PDF full fingerprints preserve original years, exact ids and legal-publication barrier',()=>{
 const result=sourceVerified43OriginalYearEndReportVersions();
 assert.equal(result.length,43);
 assert.equal(result.filter(x=>x.pdfIdentityStatus==='authenticated_original_pdf').length,25);
 assert.equal(result.filter(x=>x.pdfIdentityStatus==='authenticated_amendment_pdf').length,14);
 assert.equal(result.filter(x=>x.pdfIdentityStatus==='exact_pdf_alias').length,1);
 assert.equal(result.filter(x=>x.pdfIdentityStatus==='source_identity_hold').length,3);
 assert.equal(new Set(result.map(x=>x.committeeRegistration)).size,13);
 assert.ok(result.every(x=>x.proofLedger===SOURCE_V18));
 assert.ok(result.every(x=>x.sourcePdfBytes>=1000
  &&/^[a-f0-9]{64}$/.test(x.sourcePdfSha256)
  &&/^[a-f0-9]{64}$/.test(x.viewerApiSha256)
  &&x.historicalActualPublicByOn===null));
 assert.ok(result.filter(x=>x.pdfIdentityStatus.startsWith('authenticated_')).every(x=>
  x.conservativeNotBeforeOn>x.calendarDueOn
  &&x.conservativeNotBeforeOn>=x.boardReceivedOn));
});
test('95 true serving members are not 95 legally required filers; exactly 51 CFB principals have selected authentic original PDF versions',()=>{
 const persons=audit95ActuallyServingSenatorVersionPanel(rows);
 assert.equal(persons.length,95);
 assert.equal(new Set(persons.map(x=>x[0])).size,95);
 assert.equal(persons.filter(x=>x[4]!=='-').length,51);
 assert.equal(persons.filter(x=>x[4]==='-').length,44);
 assert.equal(persons.reduce((n,x)=>n+Number(x[5]),0),298);
 assert.ok(persons.every(x=>x[8]==='0'&&x[9]==='UNKNOWN_NOT_IN_SCOPE'));
 assert.ok(persons.filter(x=>x[4]==='-').every(x=>
  x[7]==='not_yet_observed_in_selected_source_authenticated_original_CFB_PDFs'));
 assert.equal(persons.find(x=>x[0]==='Calvin K. Bahr')[4],'18864');
 assert.equal(persons.find(x=>x[0]==='Erin K. Maye Quade')[4],'18724');
 assert.equal(persons.find(x=>x[0]==='Kelly L. Morrison')[4],'18809');
});
test('298 exact full source proven version refs and 95 serving member coverage PSV permanently regenerate from original authenticated proofs',()=>{
 const signed=serializeServedExactLedger(rows);
 assert.equal(signed,readFileSync(ALL_298,'utf8'));
 assert.equal(signed.trimEnd().split('\n').length,298);
 const people=serialize95SenateCoverage(audit95ActuallyServingSenatorVersionPanel(rows));
 assert.equal(people,readFileSync(ALL_95,'utf8'));
 assert.equal(people.trimEnd().split('\n').length,95);
 const result=verifyPermanent298SourceLedgers();
 assert.equal(result.actualServingSenatorSourceRoster,95);
 assert.equal(result.sourceAuthenticatedCFBReportPrincipalSenators,51);
 assert.equal(result.servingPersonsNotYetInSelectedOriginalPDFSourcePanel,44);
 assert.equal(result.officialVersionReferences,298);
 assert.equal(result.independentlyAuthenticatedDistinctOriginalPdfBinaries,288);
 assert.equal(result.sourceAuthenticOriginalPdfHistoricalActualPublicByCount,0);
 assert.equal(result.legallyOwedOriginalReportDenominator,null);
 assert.equal(result.noBulkFinanceTransactionsOrHistoricalEligibilityBackfill,true);
 assert.equal(result.noNeonOrProductionDataReadWrite,true);
 assert.match(result.permanentOriginal298VersionLedgerSha256,/^[a-f0-9]{64}$/);
 assert.match(result.permanentOfficial95PersonSenatorCoverageSha256,/^[a-f0-9]{64}$/);
});
test('public original CFB PDF provenance workflow cannot alter production or export donor, transaction and itemized finance data',()=>{
 const wf=readFileSync('.github/workflows/senate-864-cfb-298-official-report-version-v19.yml','utf8');
 assert.match(wf,/pull_request:/);
 assert.match(wf,/contents: read/);
 assert.match(wf,/node --import tsx --test tests\/cfb-864-298-version-51-senator-report-ledger-v19.test.mjs/);
 assert.match(wf,/node --import tsx scripts\/audit-cfb-864-298-exact-reports-51-serving-principals-v19.mjs/);
 assert.doesNotMatch(wf,/secrets\.|NEON|upload-artifact|issues: write|workflow_dispatch|schedule:|environment:/);
 assert.ok(rows.every(x=>x.historicalActualPublicByOn===null));
});
