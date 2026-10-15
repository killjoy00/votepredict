import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 planVerifiedSenateCommitteeNamedRollAdditions,
 stableSenateCommitteeOriginalMotionKey,
 type OriginalMotion,type CompleteSourceSnapshot,type StoredMotion
} from '../evidence/senate-864-verified-motion-addition-plan.ts';

const sha='a'.repeat(64),textSha='b'.repeat(64),motionSha=(n:number)=>
 n.toString(16).padStart(64,'0');
const members=[...Array(10)].map((_,i)=>({
 sourceName:'FictionalMember'+i,
 historicalMembershipId:'11111111-2222-3333-4444-'+i.toString().padStart(12,'0'),
 choice:i<4?'yea' as const:'nay' as const
}));
function original(amend:number,i:number):OriginalMotion{
 return {year:2024,hearingDate:'2024-02-14',committeeName:'Education Policy',
  originalSourceSha256:sha,originalNormalizedTextSha256:textSha,
  originalMotionContextSha256:motionSha(i+1),originalTextOffset:1000+500*i,
  recordedYea:4,recordedNay:6,billIdentifier:'SF3534',amendmentRef:'#'+amend,
  originalExplicitNamedRoll:true,independentOriginalBodyShaAuthenticated:true,
  historicMemberServiceDayIndependentlyValidated:true,memberSides:members};
}
const originalSix=[10,2,3,5,6,9].map(original);
function oldEvent(a:OriginalMotion):StoredMotion{
 return {externalKey:'senate-committee:legacy:'+a.originalTextOffset,
  originalSourceSha256:sha,hearingDate:a.hearingDate,committeeName:a.committeeName,
  originalTextOffset:null,originalMotionContextSha256:null,
  billIdentifier:a.billIdentifier,amendmentRef:a.amendmentRef,
  recordedYea:4,recordedNay:6,memberSides:members,storedMemberChoicesComplete:true};
}
const db=(events:StoredMotion[]):CompleteSourceSnapshot=>({
 originalSourceSha256:sha,queryReadOnlyAndRolledBack:true,
 sourceDocumentShaExactlyMatched:true,exhaustiveStoredSourceEventRowsCompared:true,
 matchedDeployedDatabaseBindingIndependentlyVerified:true,events
});
test('six separate original amendment decisions sharing ten senators never collapse, add only four after exact old action/choice match',()=>{
 const report=planVerifiedSenateCommitteeNamedRollAdditions(originalSix,
  db([oldEvent(originalSix[0]!),oldEvent(originalSix[5]!)]));
 assert.equal(report.sourceNamedRolls,6);
 assert.equal(report.existingExactVerified,2);
 assert.equal(report.addOnlyCandidatesAwaitingExplicitDatabaseApproval,4);
 assert.equal(report.ambiguouslyExistingOrConflicting,0);
 assert.equal(report.noAutomaticDatabaseWrites,true);
 assert.equal(report.noLegacyPositionalUpdates,true);
 assert.deepEqual(report.plans.map(x=>x.status),[
  'already_stored_verified','candidate_add_only_after_separate_approval',
  'candidate_add_only_after_separate_approval',
  'candidate_add_only_after_separate_approval',
  'candidate_add_only_after_separate_approval','already_stored_verified']);
 const keys=report.plans.flatMap(x=>x.stableExternalKey?[x.stableExternalKey]:[]);
 assert.equal(new Set(keys).size,4);
 assert.ok(keys.every(x=>/^senate-committee-original-v1:[0-9a-f]{48}$/.test(x)));
 const replaced=originalSix.map((r,i)=>({...r,originalTextOffset:r.originalTextOffset+10}));
 assert.notEqual(stableSenateCommitteeOriginalMotionKey(originalSix[0]!),
  stableSenateCommitteeOriginalMotionKey(replaced[0]!));
});
test('unanchored legacy positional evidence for same tally/member slate results in HOLD, not a duplicate insert',()=>{
 const previous=oldEvent(originalSix[0]!);
 previous.amendmentRef=null;
 const result=planVerifiedSenateCommitteeNamedRollAdditions(originalSix,db([previous]));
 assert.equal(result.addOnlyCandidatesAwaitingExplicitDatabaseApproval,0);
 assert.equal(result.ambiguouslyExistingOrConflicting,6);
 assert.ok(result.plans.every(x=>x.stableExternalKey===null));
});
test('fully verified anchored existing event with conflicting named votes MUST hold rather than overwrite',()=>{
 const v=originalSix[0]!,stored=oldEvent(v);
 stored.externalKey=stableSenateCommitteeOriginalMotionKey(v);
 stored.memberSides=members.map((x,i)=>({...x,choice:i===0?'nay':x.choice})) as typeof members;
 const plan=planVerifiedSenateCommitteeNamedRollAdditions([v],db([stored]));
 assert.equal(plan.addOnlyCandidatesAwaitingExplicitDatabaseApproval,0);
 assert.equal(plan.ambiguouslyExistingOrConflicting,1);
 assert.equal(plan.plans[0]?.status,'hold_stored_event_disagrees');
});
test('missing year identity, unverified roster member, invalid source hash or unknown deployed DB binding suppress all candidate writes',()=>{
 const a=originalSix[0]!;
 const noPerson=planVerifiedSenateCommitteeNamedRollAdditions([
  {...a,memberSides:a.memberSides.map((x,i)=>i===0?{...x,historicalMembershipId:null}:x)}
 ],db([]));
 assert.equal(noPerson.unresolvedSourceRosterOrSnapshot,1);
 assert.equal(noPerson.addOnlyCandidatesAwaitingExplicitDatabaseApproval,0);
 const noDb=planVerifiedSenateCommitteeNamedRollAdditions([a],
  {...db([]),matchedDeployedDatabaseBindingIndependentlyVerified:false});
 assert.equal(noDb.unresolvedSourceRosterOrSnapshot,1);
 const noOriginal=planVerifiedSenateCommitteeNamedRollAdditions([
  {...a,independentOriginalBodyShaAuthenticated:false}
 ],db([]));
 assert.equal(noOriginal.unresolvedSourceRosterOrSnapshot,1);
 const badYear=planVerifiedSenateCommitteeNamedRollAdditions([
  {...a,year:2021} as unknown as OriginalMotion
 ],db([]));
 assert.equal(badYear.unresolvedSourceRosterOrSnapshot,1);
 assert.throws(()=>stableSenateCommitteeOriginalMotionKey({
  ...a,originalMotionContextSha256:'bad'
 }),/source\/text SHA/);
});
test('duplicate original offset or duplicated historical membership inside one named YEA/NAY roll cannot authorize an insert',()=>{
 const d=planVerifiedSenateCommitteeNamedRollAdditions([originalSix[0]!,{
  ...originalSix[1]!,originalTextOffset:originalSix[0]!.originalTextOffset
 }],db([]));
 assert.equal(d.addOnlyCandidatesAwaitingExplicitDatabaseApproval,1);
 assert.equal(d.unresolvedSourceRosterOrSnapshot,1);
 const source=originalSix[0]!;
 const duplicateMember=planVerifiedSenateCommitteeNamedRollAdditions([
  {...source,memberSides:source.memberSides.map((v,i)=>
   i===1?{...v,historicalMembershipId:source.memberSides[0]!.historicalMembershipId}:v)}
 ],db([]));
 assert.equal(duplicateMember.unresolvedSourceRosterOrSnapshot,1);
});
test('old importer remains explicitly unsafe to replay; this planner contains no hidden database writes',()=>{
 const old=readFileSync('scripts/backfill-senate-committee-minutes.ts','utf8');
 assert.match(old,/externalKey=\x60senate-committee:\$\{sourceKey\}:\$\{observationIndex\}\x60/);
 assert.match(old,/ON CONFLICT\(session_id,chamber_id,external_key\)[\s\S]{0,180}DO UPDATE/);
 const planner=readFileSync('research/evidence/senate-864-verified-motion-addition-plan.ts','utf8');
 assert.doesNotMatch(planner,/\b(?:INSERT INTO|DELETE FROM|UPDATE vote_events|DROP TABLE)\b/i);
 assert.ok(planner.includes('noAutomaticDatabaseWrites:true'));
});
