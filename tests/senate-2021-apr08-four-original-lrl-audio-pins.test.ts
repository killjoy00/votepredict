import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 APR08_FOUR_ORIGINAL_LRL_AUDIO,
 verifyFirstPinnedApril08AudioPrefix,
 verifyJournalMotionPreservationAcrossAudioSources
} from '../src/evidence/senate-2021-apr08-four-original-lrl-audio-pins.js';
import {APR12_THREE_STRICT_ORIGINAL} from
 '../src/evidence/senate-2021-apr12-three-strict-original-committee-amendments.js';

const proof=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-2021-apr08-four-original-lrl-audio-prefix-access-success.json',
 'utf8'
));

test('the independently acquired original Senate 2021 LRL audio sources have 4 exact immutable MP3 prefix pins',()=>{
 assert.equal(proof.issue,864);
 assert.equal(proof.firstOriginalAudioSourceRun.runnerPR,1159);
 assert.equal(proof.firstOriginalAudioSourceRun.runId,38178990727);
 assert.equal(proof.firstOriginalAudioSourceRun.conclusion,'success');
 assert.equal(proof.firstOriginalAudioSourceRun.artifactId,11717117508);
 assert.equal(proof.firstOriginalAudioSourceRun.independentlyDownloadedZIPBytes,1824);
 assert.equal(proof.firstOriginalAudioSourceRun.independentlyDecodedJSONBytes,7875);
 assert.match(proof.firstOriginalAudioSourceRun.independentlyDownloadedZIPSHA256,/^[a-f0-9]{64}$/);
 assert.match(proof.firstOriginalAudioSourceRun.independentlyDecodedJSONSHA256,/^[a-f0-9]{64}$/);
 assert.equal(proof.strictFirstPrefixFacts.originalHTTPStatus,206);
 assert.equal(proof.strictFirstPrefixFacts.rangeRequestHonored,true);
 assert.equal(proof.strictFirstPrefixFacts.originalPrefixSignature,'id3');
 assert.equal(proof.strictFirstPrefixFacts.totalOriginalMP3PrefixBytesDownloaded,262144);
 assert.equal(proof.strictFirstPrefixFacts.fullOriginalAudioSourcesAuthenticated,false);
 assert.equal(proof.originalAudioLeads.length,4);
 assert.equal(APR08_FOUR_ORIGINAL_LRL_AUDIO.sourceMP3.length,4);
 assert.equal(APR08_FOUR_ORIGINAL_LRL_AUDIO.exactFirstPrefixBytes,65536);
 for(const [index,original] of APR08_FOUR_ORIGINAL_LRL_AUDIO.sourceMP3.entries()){
  const first=proof.originalAudioLeads[index];
  assert.equal(first.bill,original.bill);
  assert.equal(first.url,original.url);
  assert.equal(first.originalFirstPrefixBytes,65536);
  assert.equal(first.originalFirstPrefixSHA256,original.firstOriginalPrefixSHA256);
  assert.match(first.originalFirstPrefixSHA256,/^[a-f0-9]{64}$/);
  assert.equal(new URL(original.url).host,'www.lrl.mn.gov');
  assert.match(new URL(original.url).pathname,/^\/audio\/senate\/2021\/cmte_(fintrans|jud)_040821[a-b]?\.mp3$/);
 }
 assert.equal(new Set(APR08_FOUR_ORIGINAL_LRL_AUDIO.sourceMP3.map(x=>x.url)).size,4);
});

test('a correct length but fabricated MP3 prefix is rejected before claiming full original recording',()=>{
 for(const spec of APR08_FOUR_ORIGINAL_LRL_AUDIO.sourceMP3){
  assert.throws(()=>verifyFirstPinnedApril08AudioPrefix(
   spec,Buffer.from('FAKE')),/exact 64KiB length mismatch/);
  assert.throws(()=>verifyFirstPinnedApril08AudioPrefix(
   spec,Buffer.alloc(65536,0x41)),/audio prefix SHA-256 mismatch/);
  // Even a syntactically plausible MP3 header cannot substitute for genuine source bytes.
  const forged=Buffer.alloc(65536,0x41);
  forged.write('ID3',0,'ascii');
  assert.throws(()=>verifyFirstPinnedApril08AudioPrefix(
   spec,forged),/audio prefix SHA-256 mismatch/);
 }
});

test('three separate original April 12 Senate committee amendment rolls remain unpromoted',()=>{
 assert.deepEqual(APR08_FOUR_ORIGINAL_LRL_AUDIO.sourceMP3.map(x=>x.bill),
  ['SF1159','SF970','SF970','SF970']);
 assert.deepEqual(APR12_THREE_STRICT_ORIGINAL.motions.map(x=>[x.bill,x.mover]),[
  ['SF1159','Dibble'],['SF1159','McEwen'],['SF970','Pappas']]);
 const [a,b]=APR12_THREE_STRICT_ORIGINAL.motions;
 assert.equal(a?.originalYeaNamesSHA256,b?.originalYeaNamesSHA256);
 assert.equal(a?.originalNayNamesSHA256,b?.originalNayNamesSHA256);
 assert.notEqual(a?.originalMotionNeighborhoodSHA256,b?.originalMotionNeighborhoodSHA256);
 const names=verifyJournalMotionPreservationAcrossAudioSources();
 assert.equal(names.originalJournalDistinctAmendments,3);
 assert.equal(names.audioSourceLeads,4);
 assert.equal(names.motionsHeardFromOriginalAudio,0);
 assert.equal(names.motionOccurredOnFromAudio,null);
 assert.equal(names.noAudioToMemberVoteInference,true);
 assert.equal(APR08_FOUR_ORIGINAL_LRL_AUDIO.officialLRLMediaPageMeetingDate,'2021-04-08');
 assert.equal(APR08_FOUR_ORIGINAL_LRL_AUDIO.originalJournalReportDate,'2021-04-12');
 assert.equal(proof.holds.specificAmendmentOccurredOn,null);
 assert.equal(proof.holds.independentHistoricalPublicBy,null);
 assert.equal(proof.holds.issue864RemainsOpen,true);
});
