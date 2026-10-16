import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateSafeParserShards} from
 '../../scripts/audit-senate-864-parser-v3-shard-receipts.js';
const yearCounts={2022:325,2023:454,2024:258,2025:415} as const;
function sixteen(){
 return (Object.keys(yearCounts).map(Number) as (keyof typeof yearCounts)[])
  .flatMap(year=>Array.from({length:4},(_,shard)=>({
   schemaVersion:'senate-864-all-1452-originals-parser-v3-recheck-shard-v1',
   issue:864,year,shard,shards:4,
   baselineSourceRun:38066441841,baselineParser:'mn-senate-committee-minutes-v2',
   currentParser:'mn-senate-committee-minutes-v3',
   originalUrlsAssigned:Math.floor((yearCounts[year]+3-shard)/4),
   originalPdfAndSourceTextVerified:Math.floor((yearCounts[year]+3-shard)/4),
   originalsHeld:0,originallyRecognizedNamedRolls:3,
   newParserNamedRolls:year===2024&&shard===0?7:3,
   originallyRecognizedCountOnlyRolls:1,newParserCountOnlyRolls:1,
   docsWithNamedRollDecrease:0,docsWithCountOnlyDecrease:0,
   verifiedEducationOriginalOldCandidates:year===2024&&shard===0?2:0,
   verifiedEducationOriginalNewActions:year===2024&&shard===0?6:0,
   status:'VERIFIED_ORIGINAL_PDFS_NOT_OFFICIAL_DENOMINATOR',
   noPersonNamesUrlsChoiceHashesEventsOrSourceTextExported:true,
   noDatabaseReadOrWrite:true,completeOfficialMeetingOrVoteDenominatorCertified:false,
  })));
}
test('aggregated 1452 bounded originals verify all years with no private data',()=>{
 const result=aggregateSafeParserShards(sixteen());
 assert.equal(result.originalSourcePdfs,1452);
 assert.equal(result.totalNewNamedCandidateGain,4);
 assert.deepEqual(result.yearResults.map(y=>[y.year,y.originalPdfs]),
  [[2022,325],[2023,454],[2024,258],[2025,415]]);
 assert.equal(result.sourceToPrivateStoredRowParityNotEstablished,true);
 assert.equal(result.official2021Print2022PrintAnd141NoPdfMeetingsHeld,true);
});
test('one held PDF, a missing shard, or duplicated old proof fails full certification',()=>{
 const all=sixteen();
 const missing=all.slice(1);
 assert.throws(()=>aggregateSafeParserShards(missing));
 all[15]!.originalsHeld=1;all[15]!.originalPdfAndSourceTextVerified--;
 all[15]!.status='SOURCE_OR_PARSER_HOLD';
 assert.throws(()=>aggregateSafeParserShards(all));
 const duplicate=sixteen();duplicate[15]={...duplicate[14]!};
 assert.throws(()=>aggregateSafeParserShards(duplicate));
});
test('changed old manifest run, parser versions, negative counts or source scope fails',()=>{
 const cases=[(r:any)=>r.baselineSourceRun=999,
  (r:any)=>r.currentParser='unknown-parser',
  (r:any)=>r.originalUrlsAssigned=-2,
  (r:any)=>r.issue=863,
  (r:any)=>r.newParserNamedRolls=0];
 for(const mutate of cases){
  const all=sixteen();mutate(all[0]!);
  assert.throws(()=>aggregateSafeParserShards(all));
 }
});
