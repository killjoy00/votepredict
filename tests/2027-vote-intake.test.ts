import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { authorizeArchivedHouseVoteIndex,collectionSourceFetch,with2027ArchivedSources,classify2027CollectionUrl,getArchivedCollectionResponse,collectionResponseByteLimit,COLLECTION_LIMITS } from '../src/sources/minnesota/2027-collection-source.js';
import { chooseVoteTargets,reconcile2027VoteCandidate,retain2027VoteCandidateDocument,VOTE_CANDIDATE_TYPE } from '../src/operations/2027-vote-intake.js';
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

import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DAILY_COLLECTION_SOURCE_RECEIPT_TYPE } from '../src/operations/2027-daily-collection.js';
import { type CollectionSourceReceipt } from '../src/sources/minnesota/2027-collection-source.js';

test('disposable DB retains source-bound candidates without writing votes or resolving forecasts',async t=>{
  const uri=process.env.VOTEPREDICT_INTEGRATION_DATABASE_URL;
  if(!uri){t.skip('disposable PostgreSQL not configured');return;}
  assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(uri).hostname));
  const schema='vote_intake_'+randomUUID().replaceAll('-','');
  const admin=new Pool({connectionString:uri,max:1});let db:Pool|undefined;
  const digest=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
  try{
    await admin.query('CREATE SCHEMA '+schema);
    db=new Pool({connectionString:uri,max:2,options:'-c search_path='+schema});
    const migration=readFileSync('migrations/0037_forecast_evidence_contract.sql','utf8');
    const start=migration.indexOf('CREATE TABLE evidence_content_blobs (');
    const end=migration.indexOf('CREATE TABLE forecast_bill_text_observations',start);
    assert.ok(start>=0&&end>start);
    await db.query(migration.slice(start,end));
    // Explicitly synthetic replay records, not backdated production captures.
    // The real acquisition wrapper and acceptance-clock test are separate.
    const seedProof=async(sourceUrl:string,body:string,requestBody?:string)=>{
      const receipt:CollectionSourceReceipt={schemaVersion:'2027-source-observation-v1',session:'2027-2028',
        runId:'501:1',sourceKind:'house_vote',sourceUrl,httpStatus:200,mediaType:'text/html',
        observedAt:input.observedAt,responseBodySha256:digest(body),responseBodyBytes:Buffer.byteLength(body),
        ...(requestBody?{requestMethod:'POST' as const,requestBodySha256:digest(requestBody)}:{})};
      const serialized=JSON.stringify(receipt),receiptSha256=digest(serialized);
      await db!.query('INSERT INTO evidence_content_blobs(sha256,body,media_type) VALUES($1,$2,$3),($4,$5,$6)',
        [receipt.responseBodySha256,Buffer.from(body),'application/octet-stream',receiptSha256,Buffer.from(serialized),DAILY_COLLECTION_SOURCE_RECEIPT_TYPE]);
      return {receipt,receiptSha256};
    };
    const discovery=[
      await seedProof(houseIndex,'<a href="/Votes/Summary/901">2027 - 2028 Regular Session</a>'),
      await seedProof('https://www.house.mn.gov/Votes/Summary/901','<h1>2027 - 2028 Regular Session</h1>'),
      await seedProof(houseSummary,'[{"Number":"HF1"}]',JSON.stringify({SessionKey:901,sortOption:'BillNumber'})),
    ];
    const source=await seedProof(detail,'<html>Synthetic source-body fixture</html>');
    const event={...vote,externalKey:'901:HF1:2027-01-12:1:1'};
    const context={roster:roster.map(member=>({...member,chamber:'house' as const})),knownBills:input.knownBills};
    await with2027ArchivedSources('501:1',async()=>{throw Error('Unexpected network capture');},async()=>{
      const saved=await retain2027VoteCandidateDocument(db!,context,'house',source,discovery,[event],'fixture-parser');
      assert.equal(saved.events,1);assert.equal(saved.reconciled,1);assert.equal(saved.passageCandidates,1);assert.equal(saved.needsReview,1);
      const stored=(await db!.query<{body:Buffer;media_type:string}>('SELECT body,media_type FROM evidence_content_blobs WHERE sha256=$1',[saved.manifestSha256])).rows[0];
      assert.equal(stored.media_type,VOTE_CANDIDATE_TYPE);assert.equal(digest(stored.body),saved.manifestSha256);
      const manifest=JSON.parse(stored.body.toString());
      assert.equal(manifest.sourceBodySha256,source.receipt.responseBodySha256);
      assert.deepEqual(manifest.discoveryReceiptSha256s,discovery.map(x=>x.receiptSha256));
      assert.equal(manifest.canonicalWriteAllowed,false);assert.equal(manifest.candidates[0].automaticOutcomeEligible,false);
      const repeat=await retain2027VoteCandidateDocument(db!,context,'house',source,discovery,[event],'fixture-parser');
      assert.equal(repeat.manifestSha256,saved.manifestSha256);
      await assert.rejects(retain2027VoteCandidateDocument(db!,context,'house',source,discovery,[{...event,billIdentifier:'HF2'}],'fixture-parser'),/scope mismatch/);
      await assert.rejects(retain2027VoteCandidateDocument(db!,context,'house',{...source,receiptSha256:'f'.repeat(64)},discovery,[event],'fixture-parser'),/proof readback failed/);
      const count=(await db!.query<{count:number}>('SELECT count(*)::int AS count FROM evidence_content_blobs WHERE media_type=$1',[VOTE_CANDIDATE_TYPE])).rows[0].count;
      assert.equal(count,1);
      // Only the content store exists in this isolated schema. The operation
      // did not depend on, create or modify canonical vote/forecast tables.
      assert.equal((await db!.query<{table_name:string}>("SELECT table_name FROM information_schema.tables WHERE table_schema=$1 ORDER BY table_name",[schema])).rows.map(x=>x.table_name).join(','),'evidence_content_blobs');
    },async()=>{throw Error('Unexpected network request');});
  }finally{if(db)await db.end();await admin.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');await admin.end();}
});
