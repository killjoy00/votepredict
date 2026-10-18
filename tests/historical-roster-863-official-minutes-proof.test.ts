import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 SENATE863_ORIGINAL_MARKER,assertSenate863OfficialSourceUrl,
 validateSenate863SourceTargets,analyzeSenate863Original,
 summarizeSenate863OriginalProof,type OfficialSourceTarget863,
} from '../src/evaluation/historical-roster-863-official-minutes-proof.js';
import {execFileSync} from 'node:child_process';
import type {SenateCommitteeVoteObservation} from
 '../src/evidence/minnesota-senate-committee-minutes.js';
const targets=(JSON.parse(readFileSync(
 'data/evaluation/historical-roster-863-senate-50-public-source-targets.json','utf8'))
 as {targets:OfficialSourceTarget863[]}).targets;
test('exact 50 original mismatch events and 30 official source documents frozen',()=>{
 assert.equal(validateSenate863SourceTargets(targets),true);
 assert.equal(targets.filter(x=>x.named.yea+x.named.nay===0).length,49);
 assert.equal(targets.filter(x=>x.named.yea+x.named.nay>0).length,1);
 assert.equal(targets.filter(x=>x.voteKind==='amendment').length,47);
 assert.equal(targets.filter(x=>x.voteKind==='motion').length,3);
 assert.equal(SENATE863_ORIGINAL_MARKER,
  'ROSTER_863_FIFTY_PUBLIC_ORIGINALS_V1_20261018');
});
test('source network security demands exact original official LRL HTTPS path',()=>{
 assert.equal(assertSenate863OfficialSourceUrl(targets[0].sourceUrl),true);
 for(const url of [
  'http://www.lrl.mn.gov/archive/minutes/senate/2024/a/20240221/test.pdf',
  'https://www.lrl.mn.gov.evil.test/archive/minutes/senate/2024/a/20240221/test.pdf',
  'https://www.lrl.mn.gov/proxy?url=https://evil.test',
  'https://www.lrl.mn.gov/archive/minutes/senate/2030/a/20300101/test.pdf',
  'https://user:password@www.lrl.mn.gov/archive/minutes/senate/2024/a/20240221/test.pdf',
  'https://www.lrl.mn.gov/archive/minutes/senate/2024/a/20240221/test.pdf?download=1',
 ]){
  assert.throws(()=>assertSenate863OfficialSourceUrl(url),/URL/);
 }
});
test('never interpret a tally as named membership and never claim source identity from aggregate alone',()=>{
 const t=targets[0];
 const onlyCount:SenateCommitteeVoteObservation={
  billIdentifier:t.bill,yeaCount:t.declared.yea,nayCount:t.declared.nay,
  motionText:'Committee divided by counted show of hands',voteKind:'amendment',
  memberVotes:[],individualVotesAvailable:false,
 };
 const matched=analyzeSenate863Original(t,[onlyCount]);
 assert.equal(matched.originalTallyClass,'original_exact_count_only_tally');
 assert.equal(matched.fullNamedRollMatches,0);
 assert.equal(matched.parserProofNotWholeEventIdentity,true);
 const named=Array.from({length:t.declared.yea+t.declared.nay},(_,i)=>({
  sourceName:'Senator '+i,normalizedName:'S'+i,
  choice:(i<t.declared.yea?'yea':'nay') as 'yea'|'nay',
 }));
 const explicit=analyzeSenate863Original(t,[{
  ...onlyCount,individualVotesAvailable:true,memberVotes:named,
 }]);
 assert.equal(explicit.originalTallyClass,
  'original_exact_tally_with_complete_printed_named_roll');
 assert.equal(explicit.fullNamedRollMatches,1);
 assert.equal(analyzeSenate863Original(t,[onlyCount,onlyCount]).originalTallyClass,
  'ambiguous_multiple_original_tally_candidates');
 assert.equal(analyzeSenate863Original(t,[]).originalTallyClass,
  'no_exact_bill_tally_in_parser');
});
test('source receipt must account for all 50 and all 30 official links',()=>{
 const proof=targets.map(t=>analyzeSenate863Original(t,[]));
 const docs=[...new Set(targets.map(t=>t.sourceUrl))].map(sourceUrl=>({
  sourceUrl,bytes:0,sha256:'',extractionMethod:'none',status:'fetch_or_parse_deferred',
 }));
 const out=summarizeSenate863OriginalProof(proof,docs);
 assert.equal(out.originalSourceCount,30);
 assert.equal(out.mismatchedCommitteeEvents,50);
 assert.equal(out.finalPassageEvents,0);
 assert.equal(out.sourceFetchSucceeded,0);
 assert.equal(out.storedVoteRecordsModified,false);
 assert.equal(out.sourceFetchObservationIs2026NotHistoricalPublicByProof,true);
 assert.throws(()=>summarizeSenate863OriginalProof(proof.slice(1),docs),/complete/);
});
test('public-original preflight needs no API key, DB credential, or future data',()=>{
 const out=execFileSync(process.execPath,[
  '--import','tsx','scripts/audit-roster-863-fifty-originals.ts','--preflight',
 ],{encoding:'utf8'});
 assert.match(out,/PUBLIC_ORIGINAL_50_SCOPE_OK/);
});
