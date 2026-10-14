/** Keep the 2026 original publisher 13-quote proof tests in the default npm test suite. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
test('13 verified Senate original positions preserve conservative public by, exact attribution and dedup',()=>{
  const env={...process.env};delete env.NODE_TEST_CONTEXT;
  const run=execFileSync(process.execPath,['--test','tests/senate-864-2026-verified-direct-positions.test.mjs'],{
    cwd:process.cwd(),env,timeout:30000,encoding:'utf8',maxBuffer:250000,
  });
  assert.match(run,/# tests 15\b/);
  assert.match(run,/# pass 15\b/);
  assert.match(run,/# fail 0\b/);
});
