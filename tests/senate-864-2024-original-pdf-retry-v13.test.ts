import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rehydrateShaPinned2024Original} from
 '../src/evidence/senate-864-2024-original-pdf-bounded-v13.js';
import {YEA_V13_SAFE_PHASES,safeYeaV13Phase} from
 '../scripts/audit-senate-864-2024-one-yea-bounded-pdf-lrl-v13.js';
const SHA='a'.repeat(64);

test('V13 bounded original PDF accepts only exact original SHA after two transient failures',async()=>{
 let tries=0;const sleeps:number[]=[];
 const found=await rehydrateShaPinned2024Original(SHA,
  async()=>{
   tries++;
   if(tries<3)throw Error('test only: privately identifiable source URL');
   return {contentSha256:SHA,bytes:131315};
  },
  async ms=>{sleeps.push(ms)});
 assert.equal(tries,3);
 assert.equal(found.attempts,3);
 assert.equal(found.value.contentSha256,SHA);
 assert.deepEqual(sleeps,[250,500]);
});
test('V13 original SHA mismatch is NEVER accepted, even if previous HTTP returned success',async()=>{
 let tries=0;
 await assert.rejects(rehydrateShaPinned2024Original(SHA,async()=>{
  tries++;return{contentSha256:'b'.repeat(64)};
 },async()=>{}),/Original 2024 PDF unavailable after bounded SHA-verified retries/);
 assert.equal(tries,3);
});
test('V13 failure remains bounded and never serializes a caught private error',async()=>{
 let tries=0;
 const secret='test-only-private-SENATOR-name-AND-source-url';
 const outcome=rehydrateShaPinned2024Original(SHA,async()=>{
  tries++;throw Error(secret);
 },async()=>{});
 await assert.rejects(outcome,error=>{
  assert.equal((error as Error).message.includes(secret),false);
  assert.match((error as Error).message,/Original 2024 PDF unavailable/);
  return true;
 });
 assert.equal(tries,3);
});
test('V13 rejects unverifiable original SHA without making any request',async()=>{
 let called=0;
 await assert.rejects(rehydrateShaPinned2024Original('not-a-digest',
  async()=>{called++;return{contentSha256:SHA}}));
 assert.equal(called,0);
});
test('V13 keyless safe phase whitelist matches the protected script enum exactly, digits permitted',()=>{
 const workflow=readFileSync(
  '.github/workflows/senate-864-2024-single-yea-bounded-pdf-lrl-v13.yml','utf8');
 const marker=workflow.match(/const approvedPhases=\('([^']+)'\)\.split\(' '\);/);
 assert.ok(marker,'Static approved phases absent from independent keyless receiver');
 const approved=marker[1]!.split(' ');
 assert.deepEqual(approved,[...YEA_V13_SAFE_PHASES]);
 assert.ok(approved.includes('original_2024_pdf_rehydration'));
 assert.equal(safeYeaV13Phase('original_2024_pdf_rehydration'),
  'original_2024_pdf_rehydration');
 assert.throws(()=>safeYeaV13Phase('private-senator-name'));
 assert.ok(workflow.includes("approvedPhases.includes(raw)?raw:'unclassified'"));
 assert.ok(!workflow.includes("if(!/^[a-z_]{1,80}$/.test(phase))"));
});
test('V13 protected script retains bounded original matching and rollback, unchanged V11 result schema',()=>{
 const code=readFileSync(
  'scripts/audit-senate-864-2024-one-yea-bounded-pdf-lrl-v13.ts','utf8');
 assert.match(code,/rehydrateShaPinned2024Original\([\s\S]{0,125}match\.source\.document\.originalRawPdfSha256/);
 assert.match(code,/await client\.query\('ROLLBACK'\)/);
 assert.match(code,/serializeApprovedYeaV11SafeScalars/);
 assert.match(code,/senate-864-2024-one-yea-lrl-original-year-roster-v11/);
 assert.doesNotMatch(code,/UPDATE memberships|DELETE FROM member_votes|INSERT INTO vote_events/);
});
