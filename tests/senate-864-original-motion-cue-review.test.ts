import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {identifyOriginalSourceMotionCues,redactOriginalSenateMotionPreview} from
 '../src/evidence/senate-864-original-motion-cue-review.js';
test('actual official-minute motion syntax identifies voice decisions, separated roll-call and result cues with SHA/offets, never infers member choices',()=>{
 const original=[
  'Education Policy Senate Committee Minutes Tuesday, February 14, 2024.',
  'Senator Carlson moved the A-2 amendment on SF3534.',
  'Senator Westlin requested a roll call vote on the A2 amendment.',
  'The amendment 4 / 6 (Ayes: Carlson, Westlin, Cwodzinski, Kunesh; Nays: Rest, Koran, Bahr, Howe, Nelson, Lucero) MOTION FAILED.',
  'Senator Koran moved the A3 amendment on SF3534; MOTION FAILED.',
  'Senator Nelson moved that S.F. 3534 be laid over. Adopted by voice vote.'
 ].join('\n');
 const r=identifyOriginalSourceMotionCues(original);
 assert.ok(r.byCueKind.formal_result>=2);
 assert.ok(r.byCueKind.named_yes_no_label>=2);
 assert.ok(r.byCueKind.roll_call>=1);
 assert.ok(r.byCueKind.voice_vote>=1);
 assert.ok(r.byCueKind.motion_introduction>=2);
 assert.ok(r.cues.every(x=>x.memberSideIdentityRedacted&&
  x.distinctMotionNotIndependentlyCertified));
 assert.ok(r.cues.some(x=>x.nearbyPrintedBillReferences.includes('SF3534')));
 assert.ok(r.cues.some(x=>x.nearbyPrintedAmendmentReferences.includes('A3')));
 assert.equal(r.sourceContainsMoreCuesThanBoundedPreview,false);
 const previews=JSON.stringify(r.cues.map(x=>x.boundedRedactedPublicMotionPreview));
 assert.doesNotMatch(previews,/Senator Carlson|Senator Westlin|Ayes: Carlson|Nays: Rest/i);
 assert.match(previews,/original choices redacted/);
 assert.match(r.sourceTextSha256,/^[a-f0-9]{64}$/);
});
test('source cue count is a review signal; text with no motions cannot be pronounced vote-free',()=>{
 const t='Committee minutes meeting presentation and testimony only. '.repeat(5);
 const r=identifyOriginalSourceMotionCues(t);
 assert.equal(r.sourceDocumentHasActionCue,false);
 assert.equal(r.totalTextCuesAcrossKinds,0);
 assert.equal(r.cues.length,0);
 assert.equal(r.sourceContainsMoreCuesThanBoundedPreview,false);
 const repeated='The committee voted via voice vote; motion to amend failed. '.repeat(40);
 const q=identifyOriginalSourceMotionCues(repeated,10);
 assert.equal(q.cues.length,10);
 assert.equal(q.sourceContainsMoreCuesThanBoundedPreview,true);
 assert.ok(q.totalTextCuesAcrossKinds>10);
});
test('unbounded or inauthentic input, and importer with positional updates, remain barred from cue-only vote ingestion',()=>{
 assert.throws(()=>identifyOriginalSourceMotionCues('short'),/Bounded authentic/);
 assert.throws(()=>identifyOriginalSourceMotionCues('Minutes '.repeat(20),0),/Bounded authentic/);
 const src=readFileSync('scripts/audit-senate-864-11-flagged-original-motion-passages.ts','utf8');
 assert.match(src,/originalRaw/);
 assert.match(src,/x\.originalPdfSha256/);
 assert.match(src,/sourceCandidates:targets\.length/);
 assert.match(src,/noProductionDbReadWrite:true/);
 assert.doesNotMatch(src,/\b(?:INSERT INTO|ON CONFLICT|DELETE FROM|UPDATE vote_events)\b/i);
});
test('text sanitizer suppresses printed member names in result snippets',()=>{
 const q=redactOriginalSenateMotionPreview(
  'Senator Ann Rest moved that SF3534 be recommended to pass. '+
  '4/6 (Ayes: Carlson, Westlin; Nays: Koran, Bahr). MOTION FAILED.');
 assert.match(q,/Senator \[name redacted\]/);
 assert.doesNotMatch(q,/Carlson|Westlin|Koran|Bahr|Ann Rest/);
 assert.match(q,/MOTION FAILED/);
});
