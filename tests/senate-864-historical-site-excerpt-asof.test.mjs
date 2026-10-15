import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SOURCE_LEDGER_FILES} from '../src/evidence/senate-864-95-historical-source-neon-parity.mjs';
import {buildRecoveryPlan} from '../scripts/build-senate-864-95-missing-original-recovery-plan.mjs';
import {websiteExcerptPlan,observedBeforeVote} from '../src/evidence/senate-864-historical-site-excerpt-asof.mjs';

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
  holdCounts:plan.holdCounts,distinctSourcePages:plan.sourcePagesIndexed
 }));
});
test('historical replay uses exact archive observation, never later votes or same-day ambiguity',()=>{
 assert.equal(observedBeforeVote('2022-10-28T09:08:42.000Z','2023-01-01T00:00:00Z'),true);
 assert.equal(observedBeforeVote('2022-10-28T09:08:42.000Z','2022-10-28T09:08:42.000Z'),false);
 assert.equal(observedBeforeVote('2022-10-28T09:08:42.000Z','2022-10-27T20:00:00Z'),false);
 assert.equal(observedBeforeVote('2024-09-04T05:28:50.000Z','2023-02-01T00:00:00Z'),false);
 assert.equal(observedBeforeVote('unknown','2025-01-01T00:00:00Z'),false);
});
