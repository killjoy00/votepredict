import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 VERSION,STUDY,selectPinned2023Originals,validateSelectedShortPhrases,runOriginal2023KuneshSpeakerStudy
} from '../../scripts/probe-senate-media-mpr-kunesh-2023-speaker-cues.mjs';
import {inspectBoundedNamedSpeakerTurn} from '../../scripts/probe-senate-media-mpr-kunesh-original-speaker-turns.mjs';
const pinned=JSON.parse(readFileSync(new URL('../docs/evaluation/senate-media-mpr-six-interviews-public-reconciliation-20261011.json',import.meta.url),'utf8'));
const original=selectPinned2023Originals(pinned);
const transcript='<html><body><h2>Audio transcript</h2>'
 +'Reporter: The senator is sponsoring this legislation.'
 +'<p>CATHY WURZER: What does this MIFPA proposal accomplish?</p>'
 +'<p>MARY KUNESH: It mandates our state interest in preserving our tribal identity,'
 +" and we are also making sure it's like a family first placement for those children.</p>"
 +'<p>CATHY WURZER: Thank you. We want to make sure this is codified in our state legislature.</p>'
 +'</body></html>';
test('two existing SHA1/SHA256 authenticated original 2023 episode captures, no new first-party URL discovered',()=>{
 assert.equal(VERSION,'mpr-2023-kunesh-speaker-printed-passages-on-original-html-v1');
 assert.equal(original.length,2);
 assert.equal(new Set(original.map(x=>x.pageUrl)).size,1);
 assert.deepEqual(original.map(x=>x.captureUtc),['2023-02-10T02:40:30Z','2024-04-18T02:46:06Z']);
 assert.deepEqual(original.map(x=>x.bytes),[81419,82580]);
 assert.equal(original[0].sha1,'LSMKP7LJQX2FXTNTSFGN2ACEJ6J46GIV');
});
test('two short current-page first-party senator transcript passages and one previously proven news-summary negative control',()=>{
 assert.equal(validateSelectedShortPhrases().length,3);
 assert.deepEqual(STUDY.map(x=>x.role),[
  'selected_short_senator_printed_transcript_candidate',
  'selected_short_senator_printed_transcript_candidate',
  'negative_control_prior_page_context_not_a_separate_2023_transcript_cue'
 ]);
 assert.throws(()=>validateSelectedShortPhrases([{...STUDY[0],shortPhrase:'faked'},...STUDY.slice(1)]));
 assert.ok(STUDY.every(x=>x.shortPhrase.split(/\s+/).length<=18));
});
test('synthetic two preselected issue passages inside same explicit senator full-name transcript turn are individually attributable printed cues',()=>{
 for(const s of STUDY.slice(0,2)){
  const r=inspectBoundedNamedSpeakerTurn(transcript,{cue:s.shortPhrase,label:'MARY KUNESH:'});
  assert.equal(r.transcriptSectionHeadingVisible,true);
  assert.equal(r.selectedShortCueInsideBoundedSameExplicitLabeledSpeakerTurn,true);
  assert.deepEqual(r.selectedShortCueSpeakerTurnOwnerLabels,['MARY KUNESH:']);
  assert.equal(r.speakerTurnAdjacencyIsNotRecordedAudioOrHumanCertifiedFullQuotation,true);
 }
});
test('same summary wording in interviewer/host turn not an authenticated senator utterance',()=>{
 const r=inspectBoundedNamedSpeakerTurn(transcript,{cue:STUDY[2].shortPhrase,label:'MARY KUNESH:'});
 assert.equal(r.selectedShortCueVisibleAnywhereOnOriginalPage,true);
 assert.equal(r.selectedShortCueInsideBoundedSameExplicitLabeledSpeakerTurn,false);
 assert.deepEqual(r.selectedShortCueSpeakerTurnOwnerLabels,['CATHY WURZER:']);
});
test('reporter pre-transcript phrase in original page context cannot count as direct Kunesh speaker turn',()=>{
 const h='<html><body><p>It mandates our state interest in preserving our tribal identity.</p>'
  +'<h2>Audio transcript</h2><p>CATHY WURZER: Thank you.</p>'
  +'<p>MARY KUNESH: I support this bill.</p></body></html>';
 const r=inspectBoundedNamedSpeakerTurn(h,{cue:STUDY[0].shortPhrase,label:'MARY KUNESH:'});
 assert.equal(r.selectedShortCueVisibleAnywhereOnOriginalPage,true);
 assert.equal(r.selectedShortCueVisibleInsideTranscriptSection,false);
 assert.equal(r.selectedShortCueInsideBoundedSameExplicitLabeledSpeakerTurn,false);
});
test('unavailable replay of an original SHA1+SHA256 original stays UNKNOWN and cannot count as a senator speech',async()=>{
 let called=0;
 const fail=async url=>{called++;assert.match(url,/^https:\/\/web\.archive\.org\/web\/20/);return new Response('unavailable',{status:503});};
 const r=await runOriginal2023KuneshSpeakerStudy(fail);
 assert.equal(called,6);
 assert.equal(r.exactOriginalArchiveBodiesSelected,2);
 assert.equal(r.totalExactOriginalRawBodyReplaysAttempted,6);
 assert.equal(r.totalOriginalShaMatchedReplays,0);
 assert.equal(r.first2023OriginalPrintedSpeakerCuesAuthenticated,0);
 assert.ok(r.results.every(x=>x.shortCues.every(c=>c.selectedCueWithinExactMaryKuneshLabeledTranscriptTurn===null)));
 assert.equal(r.selectedStringEvidenceNotHumanFullQuoteCertified,true);
 assert.equal(r.original2023AudioShaNotAuthenticated,true);
 assert.equal(r.noProductionSourceCollectorDatabaseOrForecastChange,true);
 assert.equal(r.noRawHTMLFullTranscriptOrAudioSaved,true);
});
