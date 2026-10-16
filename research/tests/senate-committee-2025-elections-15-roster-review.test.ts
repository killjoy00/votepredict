import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {normalizeMemberName} from '../../src/sources/minnesota/house-votes.js';
import {
  MN_2025_ELECTIONS_POST_FEB3_PUBLIC_ROSTER as roster,
  MN_2025_ELECTIONS_SOURCE_PIN as proof,
  audit2025OriginalElectionsAgainstPublicRoster,
  validate2025OriginalElectionsSourceBlock,
} from '../evidence/senate-committee-2025-elections-15-roster-review.js';

const sha=(x:string)=>createHash('sha256').update(x).digest('hex');
function syntheticMemberRoll(yea:number,nay:number){
  const source=[...roster].slice(0,yea+nay).map((name,i)=>
    sha((i<yea?'yea:':'nay:')+normalizeMemberName(name)));
  return {sourceOffset:1114,namedYeaCount:yea,namedNayCount:nay,
    sourceReportedYeaCount:yea,sourceReportedNayCount:nay,
    namesUniqueAndExclusive:true,numericTallyMatchesExplicitNamedList:true,
    choiceIdentitySha256:source};
}
test('official LRL 94th Senate Elections history: 11 after Feb 3, no early departing Weber',()=>{
 assert.equal(roster.length,11);
 assert.equal(new Set(roster.map(normalizeMemberName)).size,11);
 assert.ok(!roster.map(normalizeMemberName).includes('weber'));
 assert.equal(proof.originalSourceRun,38079646647);
 assert.equal(proof.artifactId,11679214346);
 assert.match(proof.originalArtifactJsonSha256,/^[a-f0-9]{64}$/);
 assert.equal(proof.exactMatchedNamedChoiceTokens,163);
 assert.throws(()=>audit2025OriginalElectionsAgainstPublicRoster('{}','{}'),/raw JSON SHA256 differs/);
});
test('a complete 2025 source roll maps to 11 historic senators, not eleven Senate floor votes',()=>{
 const r=validate2025OriginalElectionsSourceBlock(syntheticMemberRoll(5,6));
 assert.equal(r.matchedKnownRosterNames,11);
 assert.equal(r.originalSourceNamedYeaNayTokens,11);
 assert.equal(r.rosterMembersWithNoNamedChoice,0);
 assert.deepEqual(r.missingMembersSha256,[]);
 assert.equal(r.independentlyValidatedOriginalMeetingAttendance,false);
 assert.equal(r.approvedHistoricalMemberVote,false);
});
test('2025 Mar27 8/1 source roll does not invent any vote or absence for 2 unlisted members',()=>{
 const r=validate2025OriginalElectionsSourceBlock(syntheticMemberRoll(8,1));
 assert.equal(r.matchedKnownRosterNames,9);
 assert.equal(r.rosterMembersWithNoNamedChoice,2);
 assert.equal(r.missingMembersSha256.length,2);
 assert.ok(r.missingMembersSha256.every(x=>/^[a-f0-9]{64}$/.test(x)));
 assert.equal(r.noChoiceDoesNotProveAbsentOrPass,true);
 assert.equal(r.approvedHistoricalMemberVote,false);
});
test('unknown, out-of-period Weber, duplicate or contradictory source directions fail closed',()=>{
 const outsider=syntheticMemberRoll(5,6);
 outsider.choiceIdentitySha256[0]=sha('yea:'+normalizeMemberName('Weber'));
 assert.throws(()=>validate2025OriginalElectionsSourceBlock(outsider),/not on historical/);
 const duplicate=syntheticMemberRoll(5,6);
 duplicate.choiceIdentitySha256[0]=duplicate.choiceIdentitySha256[1];
 assert.throws(()=>validate2025OriginalElectionsSourceBlock(duplicate),/more than once/);
 const mismatch=syntheticMemberRoll(5,6);
 mismatch.sourceReportedNayCount=4;
 assert.throws(()=>validate2025OriginalElectionsSourceBlock(mismatch),/do not match/);
 const missing=syntheticMemberRoll(5,6);
 missing.choiceIdentitySha256.pop();
 assert.throws(()=>validate2025OriginalElectionsSourceBlock(missing),/do not match/);
 const nameless=syntheticMemberRoll(5,6);
 nameless.choiceIdentitySha256=undefined as unknown as string[];
 assert.throws(()=>validate2025OriginalElectionsSourceBlock(nameless),/do not match/);
});
test('absence, attendance, title discrepancies and 2027 are never silently attributed',()=>{
 const r=validate2025OriginalElectionsSourceBlock(syntheticMemberRoll(6,5));
 assert.equal(r.independentlyValidatedOriginalMeetingAttendance,false);
 assert.equal(r.approvedHistoricalMemberVote,false);
 assert.equal(r.noChoiceDoesNotProveAbsentOrPass,true);
});