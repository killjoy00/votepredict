import test from 'node:test';
import assert from 'node:assert/strict';
import {coalitionPromotionBlockers} from '../src/evaluation/promotion-gate.js';
const valid={knownOutcomes:100,failed:20,candidateBrier:0.1,baselineBriers:[0.15,0.2,0.25],coverage80:0.81,freshTest:true,verifiedRules:true,slicesReviewed:true};
test('promotion requires positive skill and verified evaluation provenance',()=>{
 assert.deepEqual(coalitionPromotionBlockers(valid),[]);
 for(const input of [{...valid,failed:0},{...valid,freshTest:false},{...valid,verifiedRules:false},{...valid,slicesReviewed:false},{...valid,candidateBrier:0.2},{...valid,baselineBriers:[null]},{...valid,coverage80:0.99}]) assert.ok(coalitionPromotionBlockers(input).length);
});
