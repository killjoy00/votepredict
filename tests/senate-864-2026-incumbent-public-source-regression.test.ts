/**
 * #864: Include the public-only Duckworth + 49-incumbent 2026 provenance
 * regressions in the repository's normal npm test/CI verification.
 * Runs only offline synthetic data. No database access or external network.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {test} from 'node:test';

test('2026 senator public original speaker attribution / date and 49-person boundary',()=>{
  // Node's parent test worker sets NODE_TEST_CONTEXT; forwarding it causes\n  // a nested --test child to silently skip the requested MJS test files.\n  const env={...process.env};\n  delete env.NODE_TEST_CONTEXT;\n  const stdout=execFileSync(process.execPath,[
    '--test',
    'tests/senate-864-2026-incumbent-duckworth-public-source.test.mjs',
    'tests/senate-864-2026-49-incumbent-source-parity-boundary.test.mjs',
  ],{cwd:process.cwd(),env,timeout:30000,encoding:'utf8',maxBuffer:200000});
  assert.match(stdout,/# tests 14\b/);
  assert.match(stdout,/# pass 14\b/);
  assert.match(stdout,/# fail 0\b/);
});
