/**
 * Offline V2 current incumbent source-to-evidence per-district regressions.
 * Normal npm run check/test worker must actually run nested 14 tests.
 * No live secrets, internet or SQL in this wrapper.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {test} from 'node:test';

test('2026 49-incumbent protected per-public-district status and member-issue counts: 14 offline safeguards',()=>{
 const env={...process.env};
 delete env.NODE_TEST_CONTEXT;
 const out=execFileSync(process.execPath,[
  '--import','tsx','--test',
  'tests/senate-864-2026-incumbent-per-district-parity-v2.test.mjs',
 ],{cwd:process.cwd(),env,encoding:'utf8',timeout:40000,maxBuffer:250000});
 assert.match(out,/# tests 14\b/);
 assert.match(out,/# pass 14\b/);
 assert.match(out,/# fail 0\b/);
});
