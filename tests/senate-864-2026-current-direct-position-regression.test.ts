/** #864 ensure current-senator media and source attribution protections run in normal CI. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

test('the 67-person current Senate census and 15 new bounded direct-source claims remain defensible',()=>{
 const env={...process.env};delete env.NODE_TEST_CONTEXT;
 const stdout=execFileSync(process.execPath,['--test',
  'tests/senate-864-2026-current-direct-position-leads.test.mjs'],
  {cwd:process.cwd(),env,timeout:30000,encoding:'utf8',maxBuffer:240000});
 assert.match(stdout,/# tests 10\b/);
 assert.match(stdout,/# pass 10\b/);
 assert.match(stdout,/# fail 0\b/);
});
