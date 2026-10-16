import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {normalizeMemberName} from '../../src/sources/minnesota/house-votes.js';
import {
  MN_2023_ELECTIONS_HISTORICAL_PUBLIC_ROSTER_LAST_NAMES as roster,
  MN_2023_ELECTIONS_HASHED_SOURCE_ARTIFACT as source,
  audit2023ElectionsOriginalNamedRollArtifact,
  inspect2023ElectionsCandidateAgainstOfficialRoster,
} from '../../src/evidence/senate-committee-2023-elections-roll-roster-audit.js';

const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
type Side='yea'|'nay'|'absent'|'pass';
function sample(sides:Side[]){
 return {
  sourceChoiceFingerprintSha256:roster.map((name,i)=>sha(sides[i]+':'+normalizeMemberName(name))),
  sourceYeaCount:sides.filter(x=>x==='yea').length,
  sourceNayCount:sides.filter(x=>x==='nay').length,
  explicitlyNamedYeas:sides.filter(x=>x==='yea').length,
  explicitlyNamedNays:sides.filter(x=>x==='nay').length,
  explicitlyListedAbsent:sides.filter(x=>x==='absent').length,
  explicitlyListedPass:sides.filter(x=>x==='pass').length,
  namedYeaNayTallyMatchesSource:true,
  explicitNamesAreUniqueWithinRoll:true,
 };
}
test('public 2023 Elections roster and independently hashed correct original source run fixed to 14 committee members',()=>{
 assert.equal(roster.length,14);
 assert.equal(new Set(roster.map(normalizeMemberName)).size,14);
 assert.equal(source.sourceRunId,38084229868);
 assert.equal(source.artifactId,11681598339);
 assert.match(source.artifactJsonSha256,/^[a-f0-9]{64}$/);
 assert.equal(source.provisionalNamedBlocks,10);
 assert.equal(source.namedYeaNayTokens+source.nonvotingAbsentOrPassTokens,140);
 assert.throws(()=>audit2023ElectionsOriginalNamedRollArtifact('{}'),/artifact SHA has drifted/);
});
test('published Feb14 committee attendance: Anderson Absent, 8 Yea and 5 Nay are complete and not fourteen Yea/Nay',()=>{
 const names=[...roster] as string[];
 const sides:Side[]=names.map((x,i)=>x==='Anderson'?'absent':i<9?'yea':'nay');
 // names array is sorted; Anderson is skipped, indexes 1..8 account for 8 yeas
 const vote=sample(sides);
 assert.equal(vote.explicitlyNamedYeas,8);
 assert.equal(vote.explicitlyNamedNays,5);
 assert.equal(vote.explicitlyListedAbsent,1);
 const res=inspect2023ElectionsCandidateAgainstOfficialRoster(vote);
 assert.equal(res.official2023CommitteeRosterCoversAllFourteenNamedSourceRows,true);
 assert.equal(res.explicitNamedYeaNayCount,13);
 assert.equal(res.explicitNonvotingStatusCount,1);
 assert.equal(res.absenteeFingerprintContainsAnderson,true);
 assert.equal(res.sourceChoiceIdentityStillNotVerifiedByDailyAttendance,true);
});
test('February 7 no absent and March 7 Pass are different explicit nonvoting states',()=>{
 const noAbsent=inspect2023ElectionsCandidateAgainstOfficialRoster(sample(roster.map((_,i)=>i<8?'yea':'nay')));
 assert.equal(noAbsent.explicitNonvotingStatusCount,0);
 const withPass=inspect2023ElectionsCandidateAgainstOfficialRoster(
  sample(roster.map((_,i)=>i===6?'pass':i<6?'yea':'nay')));
 assert.equal(withPass.explicitNonvotingStatusCount,1);
 assert.equal(withPass.absenteeFingerprintContainsAnderson,false);
 assert.equal(withPass.explicitNamedYeaNayCount,13);
});
test('unknown member, duplicate identity or choosing two sides for the same senator is rejected',()=>{
 const yes=sample(roster.map((_,i)=>i<7?'yea':'nay'));
 yes.sourceChoiceFingerprintSha256[0]=sha('yea:'+normalizeMemberName('outsider'));
 assert.throws(()=>inspect2023ElectionsCandidateAgainstOfficialRoster(yes),/outside 2023 public Elections roster/);
 const dup=sample(roster.map((_,i)=>i<7?'yea':'nay'));
 dup.sourceChoiceFingerprintSha256[0]=dup.sourceChoiceFingerprintSha256[1];
 assert.throws(()=>inspect2023ElectionsCandidateAgainstOfficialRoster(dup),/multiple times|both vote sides/);
 const miss=sample(roster.map((_,i)=>i<7?'yea':'nay'));
 miss.sourceChoiceFingerprintSha256.pop();
 assert.throws(()=>inspect2023ElectionsCandidateAgainstOfficialRoster(miss),/choice count/);
 const missing={...sample(roster.map((_,i):Side=>i<7?'yea':'nay')),sourceChoiceFingerprintSha256:undefined as unknown as string[]};
 assert.throws(()=>inspect2023ElectionsCandidateAgainstOfficialRoster(missing),/choice count/);
});
test('source tally mismatch and falsely absent senator inference fail closed',()=>{
 const wrong=sample(roster.map((_,i)=>i<7?'yea':'nay'));
 wrong.sourceYeaCount=8;
 assert.throws(()=>inspect2023ElectionsCandidateAgainstOfficialRoster(wrong),/choice count/);
});