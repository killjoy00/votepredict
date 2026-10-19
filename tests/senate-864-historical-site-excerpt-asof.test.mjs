import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SOURCE_LEDGER_FILES} from '../src/evidence/senate-864-95-historical-source-neon-parity.mjs';
import {buildRecoveryPlan} from '../scripts/build-senate-864-95-missing-original-recovery-plan.mjs';
import {websiteExcerptPlan,websiteExcerptPlanV1,observedBeforeVote} from '../src/evidence/senate-864-historical-site-excerpt-asof.mjs';

const manifest=JSON.parse(readFileSync('data/evaluation/senate-864-95-served-historical-candidate-research-manifest-v1.json'));
const docs=new Map(SOURCE_LEDGER_FILES.map(file=>[file,JSON.parse(readFileSync(file))]));
const originals=buildRecoveryPlan().witnesses;
test('reuse existing 29 authenticated ledgers; distinguish pages from 1197 explicit website research rows',()=>{
 const plan=websiteExcerptPlan(manifest,docs,originals);
 assert.equal(plan.sourceLedgers,29);
 assert.equal(plan.selectedExcerpts,1197);
 assert.equal(plan.manifestAggregateResearchCount,1285);
 assert.equal(plan.countOnlyNotMaterialized,88);
 assert.equal(plan.ready.length+plan.holds.length,1197);
 assert.ok(plan.sourcePagesIndexed>=72);
 assert.equal(new Set([...plan.ready,...plan.holds].map(x=>x.id)).size,1197);
 for(const row of plan.ready){
  assert.match(row.sourceSha,/^[a-f0-9]{64}$/);
  assert.match(row.originalCdxSha1,/^[A-Z2-7]{32}$/);
  assert.ok(row.sourceUrl.startsWith('http'));
  assert.ok(row.literal.length>4);
  assert.ok(row.archiveCapturedAt);
  assert.equal(typeof row.ordinal,'number');
  assert.ok(!('stance' in row),'no subjective stance classification');
 }
 console.log('SENATE_864_1285_MINIMAL_RESEARCH_PLAN='+JSON.stringify({
  selected:plan.selectedExcerpts,ready:plan.ready.length,held:plan.holds.length,
  holdCounts:plan.holdCounts,distinctSourcePages:plan.sourcePagesIndexed,
  readyFrom72:plan.ready.filter(x=>originals.some(p=>p.originalHtmlSha256===x.sourceSha && p.originalUrl===x.sourceUrl && p.originalArchiveCapturedAtUtc===x.archiveCapturedAt)).length,
  uniqueReadyPages:new Set(plan.ready.map(x=>x.sourceSha)).size
 }));
});
test('historical replay uses exact archive observation, never later votes or same-day ambiguity',()=>{
 assert.equal(observedBeforeVote('2022-10-28T09:08:42.000Z','2023-01-01T00:00:00Z'),true);
 assert.equal(observedBeforeVote('2022-10-28T09:08:42.000Z','2022-10-28T09:08:42.000Z'),false);
 assert.equal(observedBeforeVote('2022-10-28T09:08:42.000Z','2022-10-27T20:00:00Z'),false);
 assert.equal(observedBeforeVote('2024-09-04T05:28:50.000Z','2023-02-01T00:00:00Z'),false);
 assert.equal(observedBeforeVote('unknown','2025-01-01T00:00:00Z'),false);
});

test('all 52 previously mislabelled people resolve from explicit structured declarations and page IDs',()=>{
 const corrected=websiteExcerptPlan(manifest,docs,originals);
 assert.equal(corrected.ready.length,668);
 assert.equal(corrected.holds.length,529);
 assert.equal(corrected.holdCounts.unresolved_official_person??0,0);
 assert.equal(corrected.holdCounts.outside_served_senate_cohort,3);
 const byPerson=Object.fromEntries(['Justin D. Eichorn','Kent Eken','Bill G. Ingebrigtsen'].map(name=>{
  const ordinal=manifest.people.findIndex(p=>p.officialName===name)+1;
  assert.ok(ordinal>0);
  return [name,corrected.ready.filter(r=>r.ordinal===ordinal&&/eichorn-historic-|eken2020-issue-|billhist-issue-/.test(r.id)).length];
 }));
 assert.deepEqual(byPerson,{'Justin D. Eichorn':12,'Kent Eken':13,'Bill G. Ingebrigtsen':27});
 const excluded=corrected.holds.filter(r=>r.reason==='outside_served_senate_cohort');
 assert.ok(excluded.every(r=>r.knownCandidateName==='Louis McNutt'&&r.ordinal===null));
 assert.deepEqual(excluded.map(r=>r.id.split('|')[1]).sort(),['lm25-health-choice','lm25-social-security-taxes','lm25-special-education']);
});

test('explicit frozen-v1 consumer reproduces the imported 616 exactly; corrected plan does not duplicate their keys',()=>{
 const frozen=websiteExcerptPlanV1(manifest,docs,originals),corrected=websiteExcerptPlan(manifest,docs,originals);
 assert.equal(frozen.ready.length,616);assert.equal(frozen.holds.length,581);
 const current=new Map(corrected.ready.map(r=>[r.id,r]));
 for(const row of frozen.ready)assert.deepEqual(current.get(row.id),row);
 const oldIds=new Set(frozen.ready.map(r=>r.id));
 assert.equal(corrected.ready.filter(r=>!oldIds.has(r.id)).length,52);
 assert.equal(new Set(corrected.ready.map(r=>r.ingestionIdentityKey)).size,668);
});

test('conflicting full candidate declarations and competing file receipts cannot manufacture a match',()=>{
 const changed=structuredClone(Object.fromEntries(docs));
 const path='data/evaluation/senate-bill-ingebrigtsen-27-exact-historical-first-party-issues-2010-2012-v1.json';
 changed[path].actualSenator.name='Kent Eken';
 assert.throws(()=>websiteExcerptPlan(manifest,new Map(Object.entries(changed)),originals),/Conflicting structured/);
 const ambiguous=structuredClone(Object.fromEntries(docs));
 const e='data/evaluation/senate-justin-eichorn-2016-original-12-capture-dated-exact-issues-v1.json';
 const first=ambiguous[e].originalFullPageReceipts[0];
 ambiguous[e].originalFullPageReceipts.push({...first,sha256:'a'.repeat(64)});
 const result=websiteExcerptPlan(manifest,new Map(Object.entries(ambiguous)),originals);
 assert.ok(result.holds.filter(r=>r.id.startsWith(e+'|')).every(r=>r.reason==='missing_original_page_sha'&&r.ordinal));
 assert.equal(result.holds.filter(r=>r.id.startsWith(e+'|')).length,12);
});
