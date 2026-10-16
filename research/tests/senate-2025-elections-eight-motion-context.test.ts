import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {
 EIGHT_2025_ELECTIONS_CONTEXT_VERSION,EIGHT_2025_ELECTIONS_EXPECTED_OFFSETS,
 FOUR_2025_ORIGINAL_SOURCE_LEDGER_GIT_BLOB,
 inspectEight2025ElectionMotionSource,
} from '../../src/evidence/senate-2025-elections-eight-motion-context.js';

const ledger=readFileSync(new URL('../docs/evaluation/source-proof/senate-2025-elections-four-other-originals-thirteen-attendance-source-proof.json',import.meta.url));
const blob=(b:Uint8Array)=>createHash('sha1').update('blob '+b.byteLength+'\0').update(b).digest('hex');
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
function example(){
 const off=2354;
 const text='.'.repeat(2020)+'Senator Mathews moved to table SF828. Roll Call. '+
 '.'.repeat(1800);
 return {text,candidate:{
  sourceTextOffset:off,explicitNamedYea:5,explicitNamedNay:6,
  sourceNearbyTextSha256:sha(text.slice(off-580,off+430)),
  matchesHistoricalCommitteeRoster:true,
  namedYeaNayAtOpeningAbsentMembers:0,
  candidateNotCertifiedDistinctHistoricalVote:true,
 }};
}
test('lock previously verified 4 original PDFs, 13 named offsets, select only remaining 3 PDFs/8 offsets',()=>{
 assert.equal(EIGHT_2025_ELECTIONS_CONTEXT_VERSION,
  'senate-2025-elections-feb11-mar25-apr08-eight-original-motion-context-v1');
 assert.equal(FOUR_2025_ORIGINAL_SOURCE_LEDGER_GIT_BLOB,'63a605e038bea5762a70be7ac79602f6c23a0924');
 assert.equal(blob(ledger),FOUR_2025_ORIGINAL_SOURCE_LEDGER_GIT_BLOB);
 const source=JSON.parse(ledger.toString('utf8'));
 assert.equal(source.issue,864);
 assert.equal(source.actualSuccessfulOriginalSourceRunId,38098600457);
 assert.equal(source.originalPdfSourcesReverified,4);
 assert.equal(source.exactNamedRollOffsetsReverified,13);
 assert.deepEqual(Object.entries(EIGHT_2025_ELECTIONS_EXPECTED_OFFSETS),[
  ['2025-02-11',[2354,3460]],['2025-03-25',[1326]],
  ['2025-04-08',[2133,2401,2673,2941,3303]]]);
 const expected=Object.values(EIGHT_2025_ELECTIONS_EXPECTED_OFFSETS).flat();
 assert.equal(expected.length,8);
 assert.deepEqual(source.sourceRecords.filter((r:any)=>r.indexedHearingDate!=='2025-02-06')
 .flatMap((r:any)=>r.provisionalNamedRollSourceBlocks.map((b:any)=>b.sourceTextOffset)),expected);
});
test('printed motion/bill context remains a provisional cue separate from member sides',()=>{
 const {text,candidate}=example();
 const r=inspectEight2025ElectionMotionSource({date:'2025-02-11',text,candidate});
 assert.equal(r.indexedHearingDate,'2025-02-11');
 assert.equal(r.originalSourceOffset,2354);
 assert.equal(r.explicitlyNamedSourceYeaCount,5);
 assert.equal(r.explicitlyNamedSourceNayCount,6);
 assert.equal(r.closestPrintedMoverStringCandidate,'Senator Mathews moved');
 assert.ok(r.candidateNearbyBillTextTokensOnly.includes('SF828'));
 assert.ok(r.nearbyActionKeywordClassesOnly.includes('tabling'));
 assert.match(r.sourceContextPreviewForHumanReview,/roll call/i);
 assert.equal(r.namedSidesNotPublished,true);
 assert.equal(r.duplicatedMotionNarrativeNotCertifiedUnique,true);
 assert.equal(r.noSourceParagraphAutomaticallyPromotedAsHistoricalVote,true);
});
test('mismatching original neighborhood SHA, unrecognized roll and count-only votes fail closed',()=>{
 const a=example();
 assert.throws(()=>inspectEight2025ElectionMotionSource({date:'2025-02-11',text:a.text,
  candidate:{...a.candidate,sourceNearbyTextSha256:'a'.repeat(64)}}),/source paragraph SHA changed/);
 const other=a.text.replace('Roll Call','Results');
 assert.throws(()=>inspectEight2025ElectionMotionSource({date:'2025-02-11',text:other,
  candidate:{...a.candidate,sourceNearbyTextSha256:sha(other.slice(2354-580,2354+430))}}),
  /no longer mentions roll call/);
 assert.throws(()=>inspectEight2025ElectionMotionSource({date:'2025-02-11',text:a.text,
  candidate:{...a.candidate,explicitNamedYea:7}}),/Not an original/);
});
test('do not cross-address Feb 6/held source offsets or fabricate a distinct motion',()=>{
 const a=example();
 assert.throws(()=>inspectEight2025ElectionMotionSource({date:'2025-03-25',text:a.text,
   candidate:a.candidate}),/Not an original/);
 assert.throws(()=>inspectEight2025ElectionMotionSource({date:'2025-04-08',text:a.text,
   candidate:a.candidate}),/Not an original/);
 assert.equal(a.candidate.candidateNotCertifiedDistinctHistoricalVote,true);
});

test('exact-hash validated original roll near EOF is allowed when full +430 context is unavailable',()=>{
 const a=example();
 const short=a.text.slice(0,2354+120);
 assert.ok(short.length<2354+430);
 const candidate={...a.candidate,
  sourceNearbyTextSha256:sha(short.slice(2354-580,short.length))};
 const r=inspectEight2025ElectionMotionSource({date:'2025-02-11',text:short,candidate});
 assert.equal(r.originalSourceOffset,2354);
 assert.equal(r.sourceNearbyContextSha256,candidate.sourceNearbyTextSha256);
 assert.equal(r.noSourceParagraphAutomaticallyPromotedAsHistoricalVote,true);
});
