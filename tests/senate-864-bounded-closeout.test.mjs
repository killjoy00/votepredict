import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {finalWebsiteInputs,closeoutQueries,verifyFrozenInputs,assertSafeCloseoutReport,reconcileCloseout,sha} from '../scripts/audit-senate-864-bounded-closeout.mjs';
const map=()=>JSON.parse(readFileSync('docs/evaluation/source-proof/senate-864-website-recovered-source-map.json'));
test('retained source bindings reproduce exactly the executed 1194-record plan, without archive requests',()=>{
 const p=finalWebsiteInputs();assert.equal(p.current.ready.length,1194);assert.equal(p.current.holds.length,3);
 assert.equal(p.sourcePlanSha256,'a040c7d1ed699eb207cf36e17e3c90fe40e35b586f5fccc08b99287abd4bbd67');
 assert.equal(new Set(p.current.ready.map(r=>r.ingestionIdentityKey)).size,1194);
});
test('wrong person, original body, clock or binding cannot certify retained website text',()=>{
 for(const mutate of [m=>m.bindings[0].ordinal=95,m=>m.bindings[0].sourceSha='0'.repeat(64),m=>m.bindings[0].archiveCapturedAt='2025-01-01T00:00:00.000Z',m=>m.bindings[0].ingestionIdentityKey='0'.repeat(64)]){
  const m=map();mutate(m);assert.throws(()=>finalWebsiteInputs(m));
 }
});
test('fixed query set has READ ONLY/ROLLBACK, bounded scopes and the exact Taxes source regardless of source kind',()=>{
 const q=closeoutQueries();assert.equal(q.names.length,20);assert.equal(q.statements.length,22);
 assert.equal(q.statements[0],'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');assert.equal(q.statements.at(-1),'ROLLBACK');
 for(const s of q.statements.slice(1,-1))assert.match(s,/^(SELECT|WITH)\b/);
 assert.match(q.statements[2],/OR sd\.source_url=ANY/);assert.match(q.statements[2],/Taxes_20230427_Signed-Minutes\.pdf/);assert.match(q.statements[2],/LIMIT 3001$/);
 assert.doesNotMatch(q.statements[2],/AS text FROM/);assert.match(q.statements[5],/legislator_id/);
 assert.ok(q.statements.every(s=>!/^\s*(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)\b/i.test(s)));
});
test('unverified transaction or schema cannot produce a completed closeout',()=>{
 assert.throws(()=>reconcileCloseout({identity:[{db:'votepredict',ro:'off',isolation:'repeatable read'}]}),/identity hold/);
 assert.throws(()=>reconcileCloseout({identity:[{db:'votepredict',ro:'on',isolation:'repeatable read'}],schema:[]}),/Schema ledger drift/);
});
test('both frozen protocols and the already examined experiment result remain unchanged',()=>{
 assert.equal(Object.keys(verifyFrozenInputs()).length,3);
 assert.throws(()=>verifyFrozenInputs(()=>Buffer.from('modified')),/Frozen protocol/);
});
test('public receipt rejects nested private data and verifies the exact reported closeout',()=>{
 assert.throws(()=>assertSafeCloseoutReport({finance:{printed_counterparty:'private donor'}}),/Private/);
 assert.throws(()=>assertSafeCloseoutReport({media:{literal:'raw text'}}),/Private/);
 const r=JSON.parse(readFileSync('docs/evaluation/source-proof/senate-864-final-closeout-20261025.json'));
 assert.equal(assertSafeCloseoutReport(r),true);assert.equal(r.repairBatchNeeded,false);assert.deepEqual(r.provenRepairDiscrepancies,[]);
 assert.equal(r.committee.reviewedQuestions,52);assert.equal(r.committee.reviewedChoices,625);
 assert.equal(r.committee.questions.filter(q=>q.status==='exact').length,51);assert.equal(r.committee.questions.filter(q=>q.alternateSourceParityVerified).length,1);
 assert.equal(r.website.exact,1194);assert.equal(Number(r.finance.registryExact.exact),830);assert.equal(r.media.millerExactFragments,3);
 for(const [path,expected]of Object.entries(r.frozenInputsVerified))assert.equal(sha(readFileSync(path)),expected);
});
