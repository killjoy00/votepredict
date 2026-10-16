import assert from 'node:assert/strict';
import test from 'node:test';
import {ORIGINAL_2025_22_PARTIAL_CUE_SHA256,RETRY_TARGET,
 JAN22_RETRY_SCHEMA,verify2025FirstMotionCueSourceOutcome}
 from '../../scripts/retry-senate-2025-jan22-caption-motion-cues.js';

test('one exact source identity; original partial 2025 cue artifact never changed to complete',()=>{
 assert.equal(JAN22_RETRY_SCHEMA,'senate-2025-jan22-one-original-caption-motion-cue-retry-v1');
 assert.deepEqual(RETRY_TARGET,{
  year:2025,hearingDate:'2025-01-22',
  committeeName:'Energy, Utilities, Environment, and Climate',mtgid:'1050345'
 });
 assert.equal(ORIGINAL_2025_22_PARTIAL_CUE_SHA256,
  '6c39b11830b2c3e53e0b14f037203cbbe85e0b0b4e07dc0a3f1610f0d56ff00c');
});
test('fake, missing, or cosmetically altered first-run source proof fails before network access',()=>{
 for(const s of ['','{}',JSON.stringify({year:2025,records:[],failures:[]}),
  '{"schemaVersion":"senate-2025-22-unlinked-original-caption-motion-cue-review-v1","total":{"fullOriginalHtmlAndCaptionBodyShaReverified":22}}'])
  assert.throws(()=>verify2025FirstMotionCueSourceOutcome(s),
   /Original 2025 21\/22 caption motion-cue partial source SHA changed/);
});
