import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRuntimeEnvironment} from '../src/operations/environment-file.js';
test('runtime dotenv parsing expands database aliases without retaining deployment environment flags',()=>{
 const original={...process.env};
 const parsed=parseRuntimeEnvironment('VP_TEST_POSTGRES_URL="postgresql://example:example@example.org/db"\nDATABASE_URL="${VP_TEST_POSTGRES_URL}"\nVERCEL=1\nCRON_SECRET=test-only-secret');
 assert.equal(parsed.DATABASE_URL,'postgresql://example:example@example.org/db');
 assert.equal(parsed.CRON_SECRET,'test-only-secret');
 assert.deepEqual({...process.env},original);
});
