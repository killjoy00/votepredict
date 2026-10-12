import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSenateCommitteeMinuteVotes,MN_SENATE_COMMITTEE_MINUTES_PARSER_VERSION} from
 '../src/evidence/minnesota-senate-committee-minutes.js';

const names='4/6 (Ayes: Johnson, Eichorn, Limmer, Miller; Nays: Murphy, Rest, Champion, Frentz, Marty, Pappas) MOTION FAILED.';
function roll(n:string){
 return 'Senator Mock requested a roll call vote for the adoption of '+n+
  ' amendment.\n'+names+'\n';
}

test('#864 six numbered amendment actions keep six separate identical named slates',()=>{
 const pdf='Education Policy February 14 2024.\n'+
  ['10','2','3','5','6','9'].map(roll).join('');
 const actual=parseSenateCommitteeMinuteVotes(pdf);
 assert.equal(MN_SENATE_COMMITTEE_MINUTES_PARSER_VERSION,'mn-senate-committee-minutes-v3');
 assert.equal(actual.length,6);
 assert.deepEqual(actual.map(x=>x.amendmentRef),['#10','#2','#3','#5','#6','#9']);
 assert.deepEqual(actual.map(x=>[x.yeaCount,x.nayCount]),Array.from({length:6},()=>[4,6]));
 assert.ok(actual.every(x=>x.voteKind==='amendment'&&x.passed===false));
 assert.ok(actual.every(x=>x.individualVotesAvailable&&x.memberVotes.length===10));
 assert.deepEqual(actual[0]?.memberVotes,actual[5]?.memberVotes);
});
test('the same ten-person slate under a second request for the SAME numbered amendment is distinct',()=>{
 const source=roll('10')+roll('10');
 const actual=parseSenateCommitteeMinuteVotes(source);
 assert.equal(actual.length,2);
 assert.deepEqual(actual.map(x=>x.amendmentRef),['#10','#10']);
});
test('repeated identical vote text without a second explicit motion request is not promoted',()=>{
 const source='Senator Mock requested a roll call vote for the adoption of 2 amendment.\n'+names+
 '\n'+names;
 assert.equal(parseSenateCommitteeMinuteVotes(source).length,1);
});
test('numbered amendment and letter-coded amendment never collide',()=>{
 const source=roll('10')+
 'Senator Mock moved the A10 amendment and requested a roll call vote.\n'+names;
 const actual=parseSenateCommitteeMinuteVotes(source);
 assert.equal(actual.length,2);
 assert.deepEqual(actual.map(x=>x.amendmentRef),['#10','A10']);
});
test('tally-to-name mismatch cannot fabricate a repaired member vote',()=>{
 const source=roll('10').replace('4/6 (Ayes','5/6 (Ayes');
 assert.equal(parseSenateCommitteeMinuteVotes(source).length,0);
});
test('count-only and context motions still do not manufacture named choices',()=>{
 const actual=parseSenateCommitteeMinuteVotes(
 'S.F. 311 was heard. Senator Mock requested a roll call on the motion. Vote was 5-4.');
 assert.equal(actual.length,1);
 assert.equal(actual[0]?.individualVotesAvailable,false);
 assert.deepEqual(actual[0]?.memberVotes,[]);
});
