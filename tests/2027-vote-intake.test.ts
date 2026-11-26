import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { authorizeArchivedHouseVoteIndex,collectionSourceFetch,with2027ArchivedSources,classify2027CollectionUrl,getArchivedCollectionResponse,collectionResponseByteLimit,COLLECTION_LIMITS } from '../src/sources/minnesota/2027-collection-source.js';
import { chooseVoteTargets,reconcile2027VoteCandidate } from '../src/operations/2027-vote-intake.js';
import type { NormalizedVoteEvent } from '../src/sources/minnesota/types.js';

const houseIndex='https://www.house.mn.gov/Votes';
const houseSummary='https://www.house.mn.gov/Votes/GetVoteSummary';
const detail='https://www.house.mn.gov/Votes/Details?SessionKey=901&BillNumber=HF1';
const journal='https://www.senate.mn/journals/2027-2028/20270112001.pdf';
test('archived vote sources permit only discovered native House key and exact read-only summary POST',async()=>{
  const observed:string[]=[];
  await with2027ArchivedSources('501:1',async(receipt,body)=>{
    observed.push(receipt.sourceUrl);
    if(receipt.sourceUrl===houseSummary){
      assert.equal(receipt.requestMethod,'POST');
      assert.equal(receipt.requestBodySha256,createHash('sha256').update(JSON.stringify({SessionKey:901,sortOption:'BillNumber'})).digest('hex'));
    }
    return createHash('sha256').update(body).digest('hex');
  },async counters=>{
    await assert.rejects(collectionSourceFetch(detail),/key not established/);
    const index=await collectionSourceFetch(houseIndex);
    const session=await authorizeArchivedHouseVoteIndex(index);
    assert.equal(session.sessionKey,'901');
    await assert.rejects(collectionSourceFetch(detail.replace('901','302')),/differs/);
    await assert.rejects(collectionSourceFetch(houseSummary,{method:'POST',body:JSON.stringify({SessionKey:302,sortOption:'BillNumber'})}),/exact read-only/);
    const response=await collectionSourceFetch(houseSummary,{method:'POST',body:JSON.stringify({SessionKey:901,sortOption:'BillNumber'})});
    assert.ok(getArchivedCollectionResponse(response));
    await collectionSourceFetch(detail);
    assert.deepEqual(observed,[houseIndex,houseSummary,detail]);
    assert.equal(counters.byKind.house_vote,3);
  },async url=>new Response(String(url)===houseIndex?'<a href="/Votes/Summary/901">2027 - 2028 Regular Session</a>':'[{"Number":"HF1"}]'));
  assert.equal(classify2027CollectionUrl(journal),'senate_vote');
  assert.equal(collectionResponseByteLimit(journal),COLLECTION_LIMITS.maxJournalBytes);
  for(const url of [journal.replace('2027-2028','2025-2026'),journal+'?download=1',detail+'&SessionKey=302','https://example.com/Votes','https://www.senate.mn/journals/journal_list.html?display_ls_year=94'])
    assert.throws(()=>classify2027CollectionUrl(url));
});

const roster=[
  {membershipId:'a',legislatorId:'A',name:'Alice Example',startsOn:'2027-01-04',endsOn:'2028-12-31'},
  {membershipId:'b',legislatorId:'B',name:'Bob Other',startsOn:'2027-01-04',endsOn:'2028-12-31'},
  {membershipId:'c',legislatorId:'C',name:'Chris Example',startsOn:'2025-01-01',endsOn:'2026-12-31'},
];
const vote:NormalizedVoteEvent={externalKey:'fixture-1',billIdentifier:'HF1',sourceUrl:detail,occurredOn:'2027-01-12',isPassage:true,voteKind:'passage',
  motionText:'Passage',yeaCount:1,nayCount:1,otherCount:0,memberVotes:[
    {sourceName:'Example',normalizedName:'example',sourceOrdinal:0,choice:'yea'},
    {sourceName:'Other',normalizedName:'other',sourceOrdinal:1,choice:'nay'},
  ]};
const input={chamber:'house' as const,roster,knownBills:new Map([['HF1','bill1']]),observedAt:'2027-01-13T18:00:00.000Z'};
test('term-aware voter reconciliation retains exact tally but never invents passage outcome',()=>{
  const result=reconcile2027VoteCandidate(vote,input);
  assert.equal(result.rollReconciled,true);
  assert.equal(result.billId,'bill1');
  assert.equal(result.members[0].resolution.status,'matched');
  if(result.members[0].resolution.status==='matched')assert.equal(result.members[0].resolution.membershipId,'a');
  assert.equal(result.automaticOutcomeEligible,false);
  assert.equal(result.outcomeDisposition,'unknown');
  assert.ok(result.reasons.includes('OFFICIAL_RESULT_UNPROVED'));
  const duplicate=reconcile2027VoteCandidate({...vote,memberVotes:[vote.memberVotes[0],{...vote.memberVotes[0],choice:'nay',sourceOrdinal:1}]},input);
  assert.equal(duplicate.rollReconciled,false);
  assert.ok(duplicate.reasons.includes('DUPLICATE_OR_INVALID_MEMBER_ROW'));
  const ambiguous=reconcile2027VoteCandidate(vote,{...input,roster:[...roster,{...roster[2],startsOn:'2027-01-04',endsOn:'2028-12-31'}]});
  assert.ok(ambiguous.reasons.includes('UNRESOLVED_MEMBER'));assert.equal(ambiguous.rollReconciled,false);
  assert.ok(reconcile2027VoteCandidate({...vote,yeaCount:2},input).reasons.includes('TALLY_MISMATCH'));
  assert.ok(reconcile2027VoteCandidate({...vote,occurredOn:'2027-02-30'},input).reasons.includes('DATE_OUTSIDE_OBSERVED_SESSION'));
  assert.ok(reconcile2027VoteCandidate({...vote,billIdentifier:'HF9'},input).reasons.includes('BILL_UNRESOLVED'));
});
test('Senate explicit parser result is not an automatically verified final outcome',()=>{
  const result=reconcile2027VoteCandidate({...vote,sourceUrl:journal,passed:true,motionText:'The question was taken on the passage of H.F. No. 1'},{...input,chamber:'senate'});
  assert.equal(result.rollReconciled,true);
  assert.equal(result.outcomeDisposition,'parser_reported_only');
  assert.equal(result.automaticOutcomeEligible,false);
  assert.ok(result.reasons.includes('JOURNAL_QUESTION_AND_VERSION_REVIEW_REQUIRED'));
  assert.ok(!result.reasons.includes('EXACT_QUESTION_BILL_UNPROVED'));
  const competing=reconcile2027VoteCandidate({...vote,sourceUrl:journal,passed:true,motionText:'Motion to reconsider passage of H.F. No. 1; S.F. No. 2'},{...input,chamber:'senate'});
  assert.ok(competing.reasons.includes('EXACT_QUESTION_BILL_UNPROVED'));
});
test('bounded vote intake advances past failing and already attempted documents',()=>{
  const targets=[{sourceUrl:'a'},{sourceUrl:'b'},{sourceUrl:'c'},{sourceUrl:'d'},{sourceUrl:'d'}];
  assert.deepEqual(chooseVoteTargets(targets,new Map([['a','2027-01-12'],['b','2027-01-11']]),3).map(t=>t.sourceUrl),['c','d','b']);
});
