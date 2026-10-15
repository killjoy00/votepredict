import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectExactFlagged26FromAll323} from
 '../scripts/audit-senate-864-26-embedded-original-motion-boundaries.js';
const manifest=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-864-323-embedded-original-source-artifact-manifest.json','utf8'));
function fixture(){
 const years=[[2022,77,6,3],[2023,97,6,3],[2024,41,3,1],[2025,108,11,10]] as const;
 const a:any[]=[];
 for(const [year,total,flagged,formal] of years){
  const rows=Array.from({length:total},(_,i)=>({
   year,committeeName:'Fictional Source Committee '+year,
   hearingDate:year+'-02-'+String((i%27)+1).padStart(2,'0'),
   originalSourceUrl:'https://www.lrl.mn.gov/archive/minutes/senate/'+year+
    '/synthetic/'+i+'.pdf',
   originalPdfSha256:(year*1000+i).toString(16).padStart(64,'0'),
   originalNormalizedExtractedTextSha256:'a'.repeat(64),
   originallyRequiredOcr:false,
   status:'original_pdf_sha_reverified_parser_rechecked',
   priority:i<flagged?'possible_new_action_needs_original_motion_review':
    'zero_detected_still_not_a_certified_no_vote',
   explicitRecordedMotionResultCues:i<formal?1:0,
   currentParserNamedRollCandidates:0,
   currentParserCountOnlyRollCandidates:0,
   currentParserContextActionCandidates:0
  }));
  for(let shard=0;shard<12;shard++){
   const selected=rows.filter((_,i)=>i%12===shard);
   a.push({
    year,remainingEmbeddedShardIndex:shard,remainingEmbeddedTotalShards:12,
    schemaVersion:'senate-864-568-original-remaining323-embedded-source-recall-v1',
    sourceRecallPhase:'remaining323embedded',
    selectedOriginals:selected.length,originalShaReverified:selected.length,
    originalsHeld:0,
    noProductionDatabaseReadWrite:true,no2021Sources:true,
    noAutomaticallyInferredNamedVoteOrZeroAction:true,
    rows:selected
   });
  }
 }
 return a;
}
test('all 48 source receipts conservatively partition 323 different raw originals into exactly 26 flagged / 17 formal documents',()=>{
 const rows=selectExactFlagged26FromAll323(fixture(),manifest);
 assert.equal(manifest.originalArtifactZips.length,48);
 assert.equal(rows.length,26);
 assert.deepEqual([2022,2023,2024,2025].map(y=>rows.filter(x=>x.year===y).length),
  [6,6,3,11]);
 assert.deepEqual([2022,2023,2024,2025].map(y=>
  rows.filter(x=>x.year===y&&x.explicitRecordedMotionResultCues>0).length),
  [3,3,1,10]);
 assert.equal(new Set(rows.map(x=>x.originalSourceUrl)).size,26);
 assert.deepEqual(rows,selectExactFlagged26FromAll323(fixture(),manifest));
});
test('missing shard, inconsistent official source SHA, duplicate identity and unverified originals hard-hold',()=>{
 const rows=fixture();
 assert.throws(()=>selectExactFlagged26FromAll323(rows.slice(1),manifest));
 const wrongSha=fixture();wrongSha[0].rows[0].originalPdfSha256='bad';
 assert.throws(()=>selectExactFlagged26FromAll323(wrongSha,manifest));
 const repeated=fixture();repeated[1].rows[0].originalSourceUrl=
  repeated[0].rows[0].originalSourceUrl;
 assert.throws(()=>selectExactFlagged26FromAll323(repeated,manifest));
 const held=fixture();held[0].originalsHeld=1;
 assert.throws(()=>selectExactFlagged26FromAll323(held,manifest));
 const wrongYear=fixture();wrongYear[0].rows[0].year=2021;
 assert.throws(()=>selectExactFlagged26FromAll323(wrongYear,manifest));
 const badManifest=structuredClone(manifest);
 badManifest.originalArtifactZips[0].zipSha256='c';
 assert.throws(()=>selectExactFlagged26FromAll323(fixture(),badManifest));
 const forged=fixture();forged[0].rows[0].priority='invented_named_vote';
 assert.throws(()=>selectExactFlagged26FromAll323(forged,manifest));
});
test('second stage re-downloads SHA-verified original PDF text, no inferred individual members and no database writes',()=>{
 const s=readFileSync('scripts/audit-senate-864-26-embedded-original-motion-boundaries.ts','utf8');
 assert.match(s,/exactOriginal\(row/);
 assert.match(s,/classifyOriginalSenateMotionResultBoundaries/);
 assert.match(s,/noNamedMemberVotesOrDistinctMotionInference:true/);
 assert.match(s,/originalPrintedResultCuesNotCertifiedAsUniqueParliamentaryMotions:true/);
 assert.match(s,/noProductionNeonQueryOrWrite:true/);
 assert.doesNotMatch(s,/\b(?:INSERT INTO|UPDATE vote_events|DELETE FROM|DROP TABLE)\b/i);
});
