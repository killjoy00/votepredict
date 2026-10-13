/**
 * Include 49-person protected URL parity source/membership regression in the
 * standard repository npm test/CI without accessing any real database.
 * Explicitly clear NODE_TEST_CONTEXT so nested runner executes, not skips.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {test} from 'node:test';

test('2026 49 incumbent source-to-evidence read-only parity / 17 offline safeguards',()=>{
 const env={...process.env};
 delete env.NODE_TEST_CONTEXT;
 const out=execFileSync(process.execPath,[
  '--import','tsx','--test',
  'tests/senate-864-2026-49-incumbent-protected-source-parity.test.mjs',
 ],{cwd:process.cwd(),env,encoding:'utf8',timeout:40000,maxBuffer:250000});
 assert.match(out,/# tests 17\b/);
 assert.match(out,/# pass 17\b/);
 assert.match(out,/# fail 0\b/);
});
