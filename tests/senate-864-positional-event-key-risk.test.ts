import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluateSenate864ParserPositionalKeyReplayRisk} from
 '../src/evidence/senate-864-positional-event-key-replay-risk.js';

const educationV3=[10,2,3,5,6,9].map((num,i)=>({
 observationIndex:i,actionAnchor:'amendment:'+num,
}));
test('2024 Education 2 -> 6 original named motions are NOT 4 authorized stored inserts',()=>{
 const risk=evaluateSenate864ParserPositionalKeyReplayRisk({
  originalPdfShaAuthenticated:true,
  oldCandidateCount:2,currentCandidateCount:6,
  oldAnchoredActions:null,
  currentAnchoredActions:educationV3,
 });
 assert.equal(risk.netCandidateGain,4);
 assert.equal(risk.newlyRecognizedActionsRequiringSourceIdentityReviewCount,4);
 assert.equal(risk.oldAndNewOriginalActionAnchorSetsIndependentlyComplete,false);
 assert.equal(risk.parserV3RebackfillAllowed,false);
 assert.equal(risk.legacyStoredActionToCurrentActionMappingVerified,false);
});
test('same ten name-choices across separately numbered amendments cannot establish stable positional ID',()=>{
 const risk=evaluateSenate864ParserPositionalKeyReplayRisk({
  originalPdfShaAuthenticated:true,oldCandidateCount:2,currentCandidateCount:6,
  oldAnchoredActions:[
   {observationIndex:0,actionAnchor:'amendment:10'},
   {observationIndex:1,actionAnchor:'amendment:9'},
  ],
  currentAnchoredActions:educationV3,
 });
 assert.equal(risk.oldKeyReusedForDifferentSourceActionCount,1);
 assert.equal(risk.oldEventKeySlotsAtRiskWhenSourceActionReordered,2);
 assert.equal(risk.newlyRecognizedActionsRequiringSourceIdentityReviewCount,4);
 assert.equal(risk.legacyStoredEventAndMemberVoteRekeyAuthorized,false);
 assert.equal(risk.parserV3RebackfillAllowed,false);
});
test('matching anchored source order is still NOT an authorization to update private stored events',()=>{
 const rows=[{observationIndex:0,actionAnchor:'amendment:10'}];
 const risk=evaluateSenate864ParserPositionalKeyReplayRisk({
  originalPdfShaAuthenticated:true,oldCandidateCount:1,currentCandidateCount:1,
  oldAnchoredActions:rows,currentAnchoredActions:rows,
 });
 assert.equal(risk.oldKeyReusedForDifferentSourceActionCount,0);
 assert.equal(risk.legacyStoredActionToCurrentActionMappingVerified,false);
 assert.equal(risk.parserV3RebackfillAllowed,false);
});
test('unsafe original hash, duplicate motion anchor and shifted index fail closed',()=>{
 const bad={originalPdfShaAuthenticated:true,oldCandidateCount:1,
  currentCandidateCount:2,
  oldAnchoredActions:[{observationIndex:0,actionAnchor:'amendment:10'}],
  currentAnchoredActions:[
   {observationIndex:0,actionAnchor:'amendment:10'},
   {observationIndex:1,actionAnchor:'amendment:10'},
  ]};
 assert.throws(()=>evaluateSenate864ParserPositionalKeyReplayRisk(bad));
 assert.throws(()=>evaluateSenate864ParserPositionalKeyReplayRisk({
  ...bad,currentAnchoredActions:educationV3.slice(0,2).map((x,i)=>({
   ...x,observationIndex:i+1,
  })),
 }));
 assert.throws(()=>evaluateSenate864ParserPositionalKeyReplayRisk({
  ...bad,originalPdfShaAuthenticated:false,
 }));
});
test('actual historical write path still uses observation index with SQL conflict update',()=>{
 const actual=readFileSync('scripts/backfill-senate-committee-minutes.ts','utf8');
 assert.match(actual,/externalKey=\x60senate-committee:\$\{sourceKey\}:\$\{observationIndex\}\x60/);
 assert.match(actual,/ON CONFLICT\(session_id,chamber_id,external_key\)[\s\S]{0,180}DO UPDATE SET/);
 assert.match(actual,/for\(const \[observationIndex,observation\] of parsed\.entries\(\)\)/);
});
