import test from 'node:test';
import assert from 'node:assert/strict';
import {safeReparseCountComparison,selectPinnedYearShard} from
 '../../scripts/audit-senate-864-original-1452-parser-v3.js';

test('#864 source v3 comparison exposes counts only, not members or choice hashes',()=>{
 const old={document:{sourceUrl:'private-in-memory-only',
  committeeName:'Education Policy',meetingDate:'2024-02-14',
  originalRawPdfSha256:'a'.repeat(64)},voteObservations:[
   {individualVotesAvailable:true,namedMemberChoicesInPdf:10},
   {individualVotesAvailable:true,namedMemberChoicesInPdf:10},
 ]};
 const result=safeReparseCountComparison(old,6,0);
 assert.deepEqual(result,{beforeNamed:2,afterNamed:6,beforeCountOnly:0,
  afterCountOnly:0,addedNamed:4,addedCountOnly:0,
  namedDecreased:false,countsDecreased:false});
 assert.doesNotMatch(JSON.stringify(result),/private-in-memory-only|Education Policy|sourceUrl/);
});
test('source v3 comparator preserves decreases as explicit HOLD diagnostics',()=>{
 const old={document:{sourceUrl:'do-not-export',committeeName:'Example',
  meetingDate:'2023-02-01',originalRawPdfSha256:'a'.repeat(64)},
  voteObservations:[{individualVotesAvailable:true,namedMemberChoicesInPdf:3},
  {individualVotesAvailable:false,namedMemberChoicesInPdf:0}]};
 assert.deepEqual([safeReparseCountComparison(old,0,0).namedDecreased,
   safeReparseCountComparison(old,0,0).countsDecreased],[true,true]);
 for(const invalid of [-1,1.5,101,Infinity,NaN]){
  assert.throws(()=>safeReparseCountComparison(old,invalid,0));
 }
});
test('full-corpus source shard selector fails closed without all four pinned cohorts',()=>{
 assert.throws(()=>selectPinnedYearShard([],2024,0));
 assert.throws(()=>selectPinnedYearShard([],2021,0));
 assert.throws(()=>selectPinnedYearShard([],2024,4));
});
