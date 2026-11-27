import test from 'node:test';
import assert from 'node:assert/strict';
import {OLD_SESSIONS,OLD_TARGETS,selectHistoricalBills,pickHistoricalNamedVotes,confirmHistoricalIndex} from '../src/evidence/2027-incoming-historical-vote-pilot.js';
import {buildHouseVoteDetailUrl} from '../src/sources/minnesota/house-votes.js';
import type {NormalizedVoteEvent} from '../src/sources/minnesota/types.js';
test('historical pilot is deterministic, bounded, and not outcome-selected',()=>{
  const input=Array.from({length:50},(_,i)=>({Number:'HF'+(i+1)}));
  const r=selectHistoricalBills([...input,{Number:'HF0001'}],16);
  assert.equal(r.universe,50);assert.equal(r.selected.length,16);
  assert.equal(r.selected[0],'HF1');assert.equal(r.selected.at(-1),'HF50');
  assert.deepEqual(r,selectHistoricalBills([...input].reverse(),16));
  assert.throws(()=>selectHistoricalBills([{Number:'other'}],16));
  assert.throws(()=>selectHistoricalBills(input,17));
});
test('explicit session link is required; special-session key is not inferred',()=>{
  confirmHistoricalIndex('<a href="/Votes/Summary/239">2013 - 2014 Regular Session</a>',OLD_SESSIONS[0]);
  assert.throws(()=>confirmHistoricalIndex('<a href="/Votes/Summary/240">2013 Special Session</a>',OLD_SESSIONS[0]));
});
test('only actual named rolls during verified prior service produce observations',()=>{
  const s=OLD_SESSIONS[1],t=OLD_TARGETS[1];
  const e:NormalizedVoteEvent={externalKey:'246:HF1:2018-03-01:55:1',billIdentifier:'HF1',voteKind:'passage',isPassage:true,motionText:'Passage',occurredOn:'2018-03-01',journalPage:'55',yeaCount:1,nayCount:1,otherCount:0,sourceUrl:buildHouseVoteDetailUrl(s.sessionKey,'HF1'),memberVotes:[{sourceName:'Munson',normalizedName:'munson',choice:'yea',sourceOrdinal:0},{sourceName:'Other',normalizedName:'other',choice:'nay',sourceOrdinal:1}]};
  assert.equal(pickHistoricalNamedVotes([e],s,'HF1',[t])[0].choice,'yea');
  assert.deepEqual(pickHistoricalNamedVotes([{...e,occurredOn:'2018-01-01'}],s,'HF1',[t]),[]);
  assert.deepEqual(pickHistoricalNamedVotes([{...e,memberVotes:[{sourceName:'Not Munson',normalizedName:'not munson',choice:'yea',sourceOrdinal:0},e.memberVotes[1]]}],s,'HF1',[t]),[]);
  assert.throws(()=>pickHistoricalNamedVotes([{...e,yeaCount:2}],s,'HF1',[t]));
  assert.throws(()=>pickHistoricalNamedVotes([{...e,sourceUrl:buildHouseVoteDetailUrl('249','HF1')}],s,'HF1',[t]));
});
