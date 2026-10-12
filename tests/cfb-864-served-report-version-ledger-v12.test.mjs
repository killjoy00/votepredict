import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {
 SCHEMA,FIELDS,OUTPUT,buildServedExactVersionLedger,
 serializeServedExactLedger,verifyPinnedServedExactLedger,
} from '../scripts/audit-cfb-864-served-report-version-ledger-v12.mjs';
const result=buildServedExactVersionLedger();
const rows=result.rows,byId=new Map(rows.map(x=>[x.reportVersionId,x]));
const sha=v=>createHash('sha256').update(v,'utf8').digest('hex');
test('229 authentic-source version IDs held to 25 independently scoped committee identities',()=>{
 assert.equal(result.receipt.schema,SCHEMA);
 assert.equal(rows.length,229);
 assert.equal(byId.size,229);
 assert.equal(new Set(rows.map(r=>r.committeeRegistration)).size,25);
 assert.equal(rows.filter(r=>r.viewerRevisionClass==='original').length,138);
 assert.equal(rows.filter(r=>r.viewerRevisionClass==='amended').length,91);
 assert.equal(rows.filter(r=>r.pdfIdentityStatus.startsWith('authenticated_')).length,223);
 assert.equal(rows.filter(r=>r.pdfIdentityStatus==='source_identity_hold').length,3);
 assert.equal(rows.filter(r=>r.pdfIdentityStatus==='exact_pdf_alias').length,3);
});
test('original / amended cohorts and status counts are separately pinned by report year',()=>{
 const expected=[
  [2021,29,16,13,28,1,0],
  [2022,109,66,43,108,0,1],
  [2023,32,22,10,30,2,0],
  [2024,39,22,17,38,0,1],
  [2025,20,12,8,19,0,1],
 ];
 assert.deepEqual(result.receipt.byYear.map(r=>[
  r.year,r.references,r.originals,r.amendments,r.authenticated,
  r.identityHolds,r.aliases,
 ]),expected);
});
test('original PDF versions have source hashes and exact original identity + report period',()=>{
 for(const r of rows){
  assert.match(r.reportVersionId,/^\d{4,6}:2[1-5]:pcc:(?:C|E|YE):[01]:\d+$/);
  assert.match(r.sourcePdfSha256,/^[a-f0-9]{64}$/);
  assert.match(r.viewerApiSha256,/^[a-f0-9]{64}$/);
  assert.ok(Number.isSafeInteger(r.sourcePdfBytes)&&r.sourcePdfBytes>=1000);
  assert.match(r.periodStart,/^20\d\d-\d\d-\d\d$/);
  assert.match(r.periodEnd,/^20\d\d-\d\d-\d\d$/);
  assert.ok(r.periodStart<=r.periodEnd);
  assert.ok(r.proofLedger.startsWith('docs/evaluation/source-proof/'));
  const sourceUrl=new URL(r.officialPdfUrl);
  assert.equal(sourceUrl.hostname,'cfb.mn.gov');
  assert.equal(sourceUrl.pathname,'/rptViewer/Main.php');
  assert.equal(sourceUrl.searchParams.get('regnum'),r.committeeRegistration);
  assert.equal(sourceUrl.searchParams.get('year'),String(r.reportYear).slice(2));
  assert.equal(sourceUrl.searchParams.get('period'),r.reportPeriodCode);
  assert.equal(sourceUrl.searchParams.get('amend'),String(r.amendmentIndex));
  assert.equal(sourceUrl.searchParams.get('se'),r.specialElectionIndex);
 }
});
test('all original source versions retain UNKNOWN historical public-by, even after statutory clock',()=>{
 assert.ok(rows.every(r=>r.historicalActualPublicByOn===null));
 assert.ok(rows.every(r=>r.conservativeNotBeforeOn!==null
  ||r.pdfIdentityStatus==='source_identity_hold'));
 assert.ok(rows.every(r=>r.conservativeNotBeforeOn===null
  ||r.conservativeNotBeforeOn>=r.boardReceivedOn
   &&r.conservativeNotBeforeOn>r.calendarDueOn));
 assert.equal(result.receipt.exactHistoricalPublicByVerified,0);
 assert.equal(result.receipt.legalFloorIsNotProofOfActualPublicDisplay,true);
 assert.equal(result.receipt.historicalPublicByEvidenceMissingForAllVersions,true);
});
test('two 2023 official held original identities plus one 2021 held amendment stay unverified',()=>{
 const hold=new Set(rows.filter(r=>r.pdfIdentityStatus==='source_identity_hold')
  .map(r=>r.reportVersionId));
 assert.deepEqual(hold,new Set([
  '18430:21:pcc:YE:0:1',
  '17994:23:pcc:YE:0:0',
  '18430:23:pcc:YE:0:1',
 ]));
 assert.ok([...hold].every(id=>byId.get(id).conservativeNotBeforeOn===null));
});
test('three independently checked official version-ID aliases never count as unique authentic PDFs',()=>{
 const aliases=new Map(rows.filter(r=>r.pdfIdentityStatus==='exact_pdf_alias')
  .map(r=>[r.reportVersionId,r.aliasCanonicalVersionId]));
 assert.deepEqual(aliases,new Map([
  ['17319:22:pcc:YE:0:2','17319:22:pcc:YE:0:1'],
  ['18430:24:pcc:YE:0:2','18430:24:pcc:YE:0:1'],
  ['19229:25:pcc:YE:0:1','19229:25:pcc:YE:0:0'],
 ]));
 for(const [id,other]of aliases){
  assert.equal(byId.get(id).sourcePdfSha256,byId.get(other).sourcePdfSha256);
  assert.equal(byId.get(id).committeeRegistration,byId.get(other).committeeRegistration);
 }
});
test('2025 served specialist sources do not include neighboring non-serving candidates',()=>{
 const year=rows.filter(r=>r.reportYear===2025);
 assert.deepEqual(new Set(year.map(r=>r.committeeRegistration)),
  new Set(['19205','19229','19233']));
 assert.ok(year.filter(r=>r.committeeRegistration==='19205')
  .every(r=>r.servingSenator==='Keri Heintzeman'
    &&r.sourcePanelDistrict===6));
 assert.ok(year.filter(r=>r.committeeRegistration==='19229')
  .every(r=>r.servingSenator==='Michael Holmstrom Jr'
    &&r.sourcePanelDistrict===29));
 assert.ok(year.filter(r=>r.committeeRegistration==='19233')
  .every(r=>r.servingSenator==='Amanda Hemmingsen-Jaeger'
    &&r.sourcePanelDistrict===47));
 assert.equal(year.length,20);
 assert.equal(year.filter(r=>r.specialElectionIndex==='1'
  &&r.amendmentIndex===0).length,9);
 assert.equal(byId.get('19205:25:pcc:YE:0:1').boardReceivedOn,'2026-05-24');
});
test('2021/22 actual-served panel preserves 2022 district but original reporting period dates',()=>{
 const old=rows.filter(r=>r.reportYear<2023);
 assert.equal(new Set(old.map(r=>r.committeeRegistration)).size,22);
 assert.ok(old.every(r=>r.reportYear===2021||r.reportYear===2022));
 const sample=byId.get('17910:22:pcc:YE:0:0');
 assert.equal(sample.servingSenator,'Rich Draheim');
 assert.equal(sample.boardReceivedOn,'2023-02-01');
 assert.equal(sample.conservativeNotBeforeOn,'2023-02-02');
});
test('source-authenticated 2023/24 71-version cohort is never silently replaced by stale matrix',()=>{
 const sample=rows.filter(r=>r.reportYear===2023||r.reportYear===2024);
 assert.equal(sample.length,71);
 assert.equal(new Set(sample.map(r=>r.committeeRegistration)).size,22);
 assert.equal(sample.filter(r=>r.viewerRevisionClass==='original').length,44);
 assert.equal(sample.filter(r=>r.viewerRevisionClass==='amended').length,27);
 assert.equal(sample.filter(r=>r.pdfIdentityStatus.startsWith('authenticated_')).length,68);
 assert.equal(byId.get('18430:23:pcc:YE:0:2').boardReceivedOn,'2024-06-03');
});
test('all 223 source-certified distinct PDF SHA256 values are unique in fixed selected panel',()=>{
 const verified=rows.filter(r=>r.pdfIdentityStatus.startsWith('authenticated_'));
 assert.equal(new Set(verified.map(r=>r.sourcePdfSha256)).size,223);
 assert.equal(rows.length-verified.length,6);
});
test('permanent PSV round trips exactly to original known immutable source-ledger joins',()=>{
 assert.equal(FIELDS.length,22);
 const reconstructed=serializeServedExactLedger(rows);
 const permanent=readFileSync(OUTPUT,'utf8');
 assert.equal(reconstructed,permanent);
 assert.ok(reconstructed.endsWith('\n'));
 assert.equal(reconstructed.trim().split('\n').length,229);
 const receipt=verifyPinnedServedExactLedger();
 assert.equal(receipt.sourceMetadataPsvSha256,sha(permanent));
 assert.equal(receipt.bytes,Buffer.byteLength(permanent));
});
test('output cannot contain donors, private finance row keys, raw PDF bytes or fabricated public-by',()=>{
 const ledger=readFileSync(OUTPUT,'utf8');
 for(const token of ['donor','contributor','vendor','transaction','evidence_items']){
  assert.ok(!FIELDS.includes(token));
 }
 assert.ok(!rows.some(r=>r.officialPdfUrl.startsWith('https://web.archive.org/')));
 assert.ok(rows.every(r=>r.historicalActualPublicByOn===null));
 assert.equal(result.receipt.zeroDatabaseReadsAndWrites,true);
 assert.equal(result.receipt.bulkCandidateCsvComparisonOutOfScope,true);
 assert.equal(result.receipt.legacyEvidenceEligibilityBackfillOutOfScope,true);
 assert.equal(result.receipt.sourceOnlyCohortNotComplete2021to2025StatewideCoverage,true);
});
