import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRecoveryPlan,MISSING,V2_RECEIPT}
 from '../scripts/build-senate-864-95-missing-original-recovery-plan.mjs';
import {readPublicInputs,ROSTER_SQL}
 from '../scripts/audit-senate-864-95-historical-source-neon-readonly.mjs';
import {canonicalKey}
 from '../src/evidence/senate-864-95-historical-source-neon-parity.mjs';

test('V2 evidence-backed 34 actual senators and all 72 absent original pages are pinned',()=>{
 const x=buildRecoveryPlan();
 assert.equal(x.schema,'senate-864-95-72-original-historical-page-acquisition-plan-v1');
 assert.equal(x.previousV2Receipt,V2_RECEIPT);
 assert.equal(x.cohortPersons,34);
 assert.equal(x.previouslyUnmatchedPageWitnesses,72);
 assert.equal(x.witnesses.length,72);
 assert.equal(x.sourceResearchLedgerCount,29);
 assert.equal(x.sourceArtifactsNotYetDownloadedOrVerified,true);
 assert.equal(x.productionDatabaseWrites,0);
 assert.equal(x.forecastFeaturePromotions,0);
 assert.equal(Object.keys(MISSING).length,34);
 assert.equal(Object.values(MISSING).reduce((n,v)=>n+v,0),72);
 const a=Object.values(x.recoveryStates).reduce((n,v)=>n+v,0);
 assert.equal(a,72);
});
test('every proposed artifact is one authenticated URL + original SHA from exact serving person',()=>{
 const x=buildRecoveryPlan(),{manifest,research}=readPublicInputs();
 const found=new Set();
 for(const row of x.witnesses){
  assert.equal(row.officialName,manifest.people[row.senatorOrdinal-1].officialName);
  const original=research.pages[row.senatorOrdinal-1][row.pageOrdinalWithinSenator-1];
  assert.equal(original.url,row.originalUrl);
  assert.equal(original.sha,row.originalHtmlSha256);
  assert.match(row.originalHtmlSha256,/^[a-f0-9]{64}$/);
  assert.match(row.originalUrl,/^https?:\/\/[^/\s]+/);
  assert.ok(row.originalResearchLedgerPath.startsWith('data/evaluation/'));
  assert.ok(!found.has(row.senatorOrdinal+'|'+row.originalUrl+'|'+row.originalHtmlSha256));
  found.add(row.senatorOrdinal+'|'+row.originalUrl+'|'+row.originalHtmlSha256);
  assert.ok(row.recoveryState.startsWith('HOLD_')||
    row.recoveryState==='READY_FOR_INDEPENDENT_BYTE_VERIFICATION');
  if(row.recoveryState==='READY_FOR_INDEPENDENT_BYTE_VERIFICATION'){
   assert.match(row.originalArchiveCdxSha1Base32,/^[A-Z2-7]{32}$/);
   assert.match(row.originalArchiveCapturedAtUtc,/^\d{4}-\d\d-\d\dT/);
   assert.ok(Number.isSafeInteger(row.historicalSourceArtifactId));
   assert.match(row.originalHtmlArtifactFile,/^[^\/\\]+\.html$/);
  }
 }
 assert.equal(found.size,72);
 assert.ok(x.witnesses.some(w=>canonicalKey(w.officialName)==='gene|dornink'));
 assert.ok(x.witnesses.some(w=>canonicalKey(w.officialName)==='kent|eken'));
 assert.equal(ROSTER_SQL.includes('2021-2022'),true);
});
test('historical 2004/2010/2016/2019/2020/2022 captures are not independently first-authored or votes',()=>{
 const report=buildRecoveryPlan();
 assert.equal(report.historicalArchiveCaptureDateNotFirstPublicationDate,true);
 assert.equal(report.exactResearchQuotesNotIndependentlyReverifiedByThisPlan,true);
 assert.equal(report.automaticallyTrustedBytes,0);
 assert.equal(report.forecastFeaturePromotions,0);
 for(const w of report.witnesses){
  assert.equal(w.publishedAt,undefined);
  assert.equal(w.excerpt,undefined);
  assert.equal(w.membershipId,undefined);
  assert.equal(w.modelWeight,undefined);
 }
});
