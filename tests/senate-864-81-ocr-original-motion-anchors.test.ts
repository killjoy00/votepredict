import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectOriginalFlagged81} from '../scripts/audit-senate-864-81-ocr-original-motion-anchors.js';

const receipt=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-864-remaining149-ocr-original-recall-v1.json','utf8'));
function fixture(){
 return receipt.originalShaProofZipArtifacts.map((a:{
  year:number;shard:number;originalPdfs:number;flaggedSourcePdfs:number;
 })=>({
  schemaVersion:'senate-864-568-original-remaining149-ocr-source-recall-v1',
  sourceRecallPhase:'remaining149ocr',year:a.year,shard:a.shard,
  selectedOriginals:a.originalPdfs,originalShaReverified:a.originalPdfs,
  originalsHeld:0,sourceToStoredEventAndMemberParityPerformed:false,
  rows:Array.from({length:a.originalPdfs},(_,i)=>({
   year:a.year,committeeName:'Fictional audit committee '+a.shard,
   hearingDate:String(a.year)+'-02-'+String(i+1).padStart(2,'0'),
   originalSourceUrl:'https://www.lrl.mn.gov/archive/minutes/senate/'+a.year+
    '/fixture/'+a.shard+'/'+i+'.pdf',
   originalPdfSha256:(a.year*1000+a.shard*20+i).toString(16).padStart(64,'0'),
   originalNormalizedExtractedTextSha256:'b'.repeat(64),
   originallyRequiredOcr:true,
   currentParserNamedRollCandidates:0,currentParserCountOnlyRollCandidates:0,
   currentParserContextActionCandidates:1,explicitRecordedMotionResultCues:1,
   explicitNamedRollLabelCues:0,reportedRollOrVoiceVoteCues:0,
   priority:i<a.flaggedSourcePdfs?
    'possible_new_action_needs_original_motion_review':
    'zero_detected_still_not_a_certified_no_vote',
   status:'original_pdf_sha_reverified_parser_rechecked'
  }))
 }));
}
test('81 flagged minutes are the exact complete disjoint set of 149 original 2022-25 OCR PDFs',()=>{
 const cohort=fixture(),rows=selectOriginalFlagged81(cohort);
 assert.equal(rows.length,81);
 assert.deepEqual([2022,2023,2024,2025]
  .map(year=>rows.filter(r=>r.year===year).length),[54,4,1,22]);
 assert.equal(new Set(rows.map(r=>r.originalSourceUrl)).size,81);
 const all=new Set<string>();
 for(let shard=0;shard<8;shard++){
  const selected=rows.filter((_,i)=>i%8===shard);
  assert.ok(selected.length===10||selected.length===11);
  for(const x of selected){
   assert.equal(all.has(x.originalSourceUrl),false);
   all.add(x.originalSourceUrl);
  }
 }
 assert.equal(all.size,81);
 assert.deepEqual(rows,selectOriginalFlagged81(cohort));
});
test('the source audit refuses changed year/size, duplicate URL, 2021, and unverified bytes',()=>{
 const source=fixture();
 assert.throws(()=>selectOriginalFlagged81(source.slice(1)));
 const modified=fixture();modified[0].rows[0].originalPdfSha256='bad';
 assert.throws(()=>selectOriginalFlagged81(modified));
 const duplicate=fixture();duplicate[0].rows[1].originalSourceUrl=duplicate[0].rows[0].originalSourceUrl;
 assert.throws(()=>selectOriginalFlagged81(duplicate));
 const excluded=fixture();excluded[0].rows[0].year=2021;
 assert.throws(()=>selectOriginalFlagged81(excluded));
});
test('read-only source analysis never adds named decisions or exposes extracted source member names',()=>{
 const source=readFileSync('scripts/audit-senate-864-81-ocr-original-motion-anchors.ts','utf8');
 assert.match(source,/originalPdfSha256/);
 assert.match(source,/sha\(bytes\)!==r\.originalPdfSha256/);
 assert.match(source,/originalNormalizedExtractedTextSha256/);
 assert.match(source,/noSourceAnchorClaimedAsDistinctVote:true/);
 assert.match(source,/noProductionDatabaseReadWrite:true/);
 assert.doesNotMatch(source,/\b(?:INSERT INTO|UPDATE vote_events|DELETE FROM|DROP TABLE)\b/i);
 const workflow=readFileSync('.github/workflows/senate-864-81-original-motion-anchor-review.yml','utf8');
 assert.match(workflow,/38755921210/);
 assert.match(workflow,/max-parallel: 2/);
 assert.doesNotMatch(workflow,/NEON_API_KEY|DATABASE_URL|environment:\s*evidence-readonly-sandbox/);
});
