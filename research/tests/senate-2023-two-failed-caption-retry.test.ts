import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TWO_SOURCE_RETRY,PREVIOUS_2023_PARTIAL_CAPTION_JSON_SHA,
  TWO_SOURCE_RETRY_SCHEMA,checkFailed2023OriginalArtifact,
} from '../scripts/retry-senate-2023-two-caption-http-failures.js';

test('pin ONLY the two previously failed 2023 Taxes committee source identities',()=>{
 assert.equal(TWO_SOURCE_RETRY_SCHEMA,
  'senate-2023-two-previously-failed-taxes-caption-original-source-retry-v1');
 assert.deepEqual(TWO_SOURCE_RETRY,[
  {id:'1046920',day:'2023-01-12',committee:'Taxes'},
  {id:'1047266',day:'2023-02-08',committee:'Taxes'}]);
 assert.match(PREVIOUS_2023_PARTIAL_CAPTION_JSON_SHA,/^[a-f0-9]{64}$/);
 assert.equal(PREVIOUS_2023_PARTIAL_CAPTION_JSON_SHA,
  'a1a3155b54c3a55d7f98bc812f75f90653d1727c135cd77972d16b3737bd50a4');
});
test('reject a fabricated successful full-source audit or altered original retry cohort',()=>{
 for(const source of ['{}','',JSON.stringify({year:2023,records:[],failures:[]}),
   '{"schemaVersion":"senate-2022-25-138-original-media-record-caption-surface-proof-v1","year":2023,"totals":{"originalHtmlPagesReverified":64,"originalHtmlPageFailures":0},"records":[],"failures":[]}']){
  assert.throws(()=>checkFailed2023OriginalArtifact(source),
    /Original 2023 partial-run artifact SHA changed/);
 }
});
