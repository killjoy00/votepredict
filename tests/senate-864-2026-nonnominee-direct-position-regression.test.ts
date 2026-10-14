/** #864 current nonnominee senator statements get independent normal CI regression. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
test('all 18 current nonnominee senators have a classified direct-source research disposition',()=>{
 const env={...process.env};delete env.NODE_TEST_CONTEXT;
 const x=execFileSync(process.execPath,['--test',
  'tests/senate-864-2026-nonnominee-direct-position-leads.test.mjs'],
  {cwd:process.cwd(),env,timeout:30000,encoding:'utf8',maxBuffer:240000});
 assert.match(x,/# tests 5\b/);assert.match(x,/# pass 5\b/);assert.match(x,/# fail 0\b/);
});