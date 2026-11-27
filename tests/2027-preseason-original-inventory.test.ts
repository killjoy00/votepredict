import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildPreseasonTargets} from '../src/operations/2027-preseason-evidence-archive.js';
import {addRonnenbergTarget,ARCHIVE_MARKER} from '../src/operations/2027-preseason-existing-neon-archive.js';
import {buildFullPreseasonInventory,selectApprovedArchiveBatch,BASE_ARCHIVE_BATCHES} from '../src/operations/2027-preseason-original-inventory.js';
const read=(s:string)=>readFileSync('docs/evaluation/source-proof/'+s,'utf8');
const roster=read('2027-preseason-roster-20261126.json');
const a=JSON.parse(read('2027-incoming-evidence-pilot-20261126-part1.json')),b=JSON.parse(read('2027-incoming-evidence-pilot-20261126-part2.json'));
const initial=addRonnenbergTarget(buildPreseasonTargets(roster,JSON.parse(read('2027-incoming-evidence-manual-leads-20261126.json')),JSON.parse(read('2027-incoming-evidence-depth-review-20261126.json')),a),roster,a);
test('four explicitly scoped disjoint 29-source batches preserve initial canary and prioritize questionnaires',()=>{
  const p=buildFullPreseasonInventory(roster,initial,a,b);
  assert.deepEqual(p.initial,initial);
  assert.deepEqual(BASE_ARCHIVE_BATCHES.map(x=>p[x].length),[29,29,29,29]);
  const full=Object.values(p).flat();
  assert.equal(new Set(full.map(x=>x.url)).size,116);
  assert.equal(p['pilot-1'].slice(0,18).filter(t=>t.kind==='published_candidate_questionnaire').length,18);
  assert.equal(p.initial[0].lrlId,'15669');
  assert.deepEqual(p,buildFullPreseasonInventory(roster,initial,{...a,results:[...a.results].reverse()},{...b,results:[...b.results].reverse()}));
});
test('inventory rejects mismatched member identity and unverified source receipt',()=>{
  const wrong=structuredClone(a);wrong.results[0].seat='house:1A';assert.throws(()=>buildFullPreseasonInventory(roster,initial,wrong,b));
  const invalid=structuredClone(a);const first=invalid.results.find((r:{evidence:unknown[]})=>r.evidence.length>0);first.evidence[0].bodySha256='invalid';
  assert.throws(()=>buildFullPreseasonInventory(roster,initial,invalid,b));
});
test('only explicit bounded batch labels are accepted; normal marked push defaults to initial',()=>{
  const push=(message:string)=>({head_commit:{message}});
  assert.equal(selectApprovedArchiveBatch('push',push(ARCHIVE_MARKER)),'initial');
  assert.equal(selectApprovedArchiveBatch('push',push(ARCHIVE_MARKER+'\nVOTEPREDICT_PRESEASON_BATCH=pilot-2')),'pilot-2');
  assert.equal(selectApprovedArchiveBatch('workflow_dispatch',{inputs:{archive_batch:'pilot-3'}}),'pilot-3');
  assert.throws(()=>selectApprovedArchiveBatch('push',push(ARCHIVE_MARKER+'\nVOTEPREDICT_PRESEASON_BATCH=all')));
  assert.throws(()=>selectApprovedArchiveBatch('push',push(ARCHIVE_MARKER+'\nVOTEPREDICT_PRESEASON_BATCH=pilot-1\nVOTEPREDICT_PRESEASON_BATCH=pilot-2')));
  assert.throws(()=>selectApprovedArchiveBatch('pull_request',{}));
});
