import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkNamedSenateRollIntegrity,getAllPreviouslyPinnedNamedOcrCandidateOriginals,
} from '../src/evidence/senate-committee-15-named-ocr-review.js';

test('all ten independently hashed original PDF sources account for fifteen candidate named rolls',()=>{
  const docs=getAllPreviouslyPinnedNamedOcrCandidateOriginals();
  assert.equal(docs.length,10);
  assert.equal(new Set(docs.map(x=>x.url)).size,10);
  assert.equal(docs.filter(x=>x.year===2022).length,8);
  assert.equal(docs.filter(x=>x.year===2025).length,2);
  assert.equal(docs.reduce((n,x)=>n+x.expectedNamedRolls,0),15);
  assert.equal(docs.reduce((n,x)=>n+x.expectedNamedChoices,0),134);
  assert.equal(docs.filter(x=>x.year===2022).reduce((n,x)=>n+x.expectedNamedRolls,0),11);
  assert.equal(docs.filter(x=>x.year===2025).reduce((n,x)=>n+x.expectedNamedRolls,0),4);
  for(const x of docs){
    assert.match(x.originalRawPdfSha256,/^[a-f0-9]{64}$/);
    assert.match(x.ocrTextSha256,/^[a-f0-9]{64}$/);
    assert.ok(x.url.startsWith('https://www.lrl.mn.gov/archive/minutes/senate/'));
  }
});

test('the same senator cannot appear in both YEA and NAY even when counts balance',()=>{
  const fake={
    yeaCount:1,nayCount:1,individualVotesAvailable:true,
    memberVotes:[
      {choice:'yea' as const,normalizedName:'Smith',sourceName:'Senator Smith'},
      {choice:'nay' as const,normalizedName:'SMITH',sourceName:'Smith'},
    ],
  };
  const result=checkNamedSenateRollIntegrity(fake);
  assert.equal(result.namedTallyMatchesRoll,true);
  assert.equal(result.sourceNamesUniqueWithinRoll,false);
  assert.equal(result.namedVoteCandidatesRequireSenatorRosterMatch,true);
});

test('source tally mismatch and unsourced name are not valid individual roll-call choices',()=>{
  const r=checkNamedSenateRollIntegrity({
    yeaCount:2,nayCount:0,individualVotesAvailable:true,
    memberVotes:[{choice:'yea',normalizedName:'',sourceName:'Smith'}],
  });
  assert.equal(r.namedTallyMatchesRoll,false);
  assert.equal(r.sourceNamesUniqueWithinRoll,true);
  assert.equal(r.namedVoteCandidatesRequireSenatorRosterMatch,true);
});
