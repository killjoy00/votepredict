import test from 'node:test';
import assert from 'node:assert/strict';
import {parseOpeningElectionRows} from '../src/operations/2027-election-roster-reconciliation.js';
import {reviewPreseasonDistrict,buildPreseasonDistrictReview} from '../src/operations/2027-preseason-district-context.js';
import {readFileSync} from 'node:fs';
const m={seat:'house:1A',lrlId:'101',electionName:'Example Candidate',party:'R',basis:'matched_reported_leader'};
const line=(code:string,name:string,party:string,votes:number,reported=10)=>['MN','','','0121','State Representative District 1A','1A',code,name,'','',party,reported,10,votes,0,100].join(';');
const parse=(...lines:string[])=>parseOpeningElectionRows(lines.join('\n'),'house');
test('exact vote counts, named opponent margin, write-ins excluded as candidates but included in denominator',()=>{
  const r=reviewPreseasonDistrict(m,parse(line('0301','Example Candidate','R',60),line('0401','Other Candidate','DFL',35),line('9901','WRITE-IN','WI',5)));
  assert.equal(r.status,'reported_tally');
  if(r.status==='reported_tally'){assert.equal(r.namedOpponentMarginPercentagePoints,25);assert.equal(r.leaderShare,.6);assert.equal(r.writeInVotes,5);assert.equal(r.certifiedTallyProved,false);assert.equal(r.modelWeight,0);}
});
test('uncontested races have no named-opponent margin',()=>{
  const r=reviewPreseasonDistrict(m,parse(line('0301','Example Candidate','R',98),line('9901','WRITE-IN','WI',2)));
  assert.equal(r.status,'reported_tally');
  if(r.status==='reported_tally'){assert.equal(r.uncontested,true);assert.equal(r.namedOpponentMarginPercentagePoints,null);}
});
test('reject incomplete precincts, bad totals, changed identity, tied leaders, duplicate candidate rows',()=>{
  const a=line('0301','Example Candidate','R',60),b=line('0401','Other Candidate','DFL',40);
  for(const rows of [parse(a,line('0401','Other Candidate','DFL',40,9)),parse(a),parse(line('0301','Example Candidate','R',50),line('0401','Other Candidate','DFL',50)),parse(a,line('0301','Other Candidate','DFL',40))])assert.equal(reviewPreseasonDistrict(m,rows).status,'held');
  assert.equal(reviewPreseasonDistrict({...m,electionName:'Different Person'},parse(a,b)).reason,'projected_identity_mismatch');
  assert.equal(reviewPreseasonDistrict({...m,basis:'accepted_recount_leader'},parse(a,b)).reason,'separate_recount_tally_required');
});
test('all 201 frozen roster seats accounted for even when sources are missing',()=>{
  const roster=JSON.parse(readFileSync('docs/evaluation/source-proof/2027-preseason-roster-20261126.json','utf8'));
  const r=buildPreseasonDistrictReview(roster.members,[],[]);
  assert.equal(r.length,201);assert.equal(r.every(x=>x.status==='held'),true);
  assert.throws(()=>buildPreseasonDistrictReview(roster.members.slice(1),[],[]),/coverage mismatch/);
});
