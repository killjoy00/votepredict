import './senate-2021-apr08-judiciary-acoustic-overlap.synthetic.test.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source='scripts/audit-senate-2021-apr08-judiciary-acoustic-overlap.mjs';
const workflow='.github/workflows/senate-2021-apr08-judiciary-acoustic-overlap-source.yml';

test('one-shot public-source action uploads only JSON and rejects unverified original MP3s',()=>{
 const w=readFileSync(workflow,'utf8'),s=readFileSync(source,'utf8');
 assert.match(w,/permissions:\s*\n\s*contents:\s*read/);
 assert.match(w,/branches: \[main\]/);
 assert.match(w,/node --test tests\/senate-2021-apr08-judiciary-acoustic-overlap\.synthetic\.test\.mjs/);
 assert.match(w,/node scripts\/audit-senate-2021-apr08-judiciary-acoustic-overlap\.mjs/);
 assert.match(w,/artifacts\/2021-apr08-judiciary-acoustic-overlap\/source\.json/);
 assert.doesNotMatch(w,/(?:\.mp3|\.pcm|transcript|\.wav)\s*$/m);
 assert.match(s,/MAX_SOURCE_BYTES=160\*1024\*1024/);
 assert.match(s,/firstAndSecondOriginalFullSHA256/);
 assert.match(s,/source_prefix_sha_mismatch/);
 assert.match(s,/source_full_sha_mismatch/);
 assert.match(s,/completeSourceMP3AndPCMDeletedFromEphemeralRunner/);
 assert.match(s,/occurred_on:null/);
 assert.match(s,/humanListeningPerformed:false/);
 assert.equal((s.match(/mover:'(?:Dibble|McEwen|Pappas)'/g)??[]).length,3);
});
