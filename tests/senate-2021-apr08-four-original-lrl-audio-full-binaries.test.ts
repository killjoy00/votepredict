import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 APR08_FOUR_ORIGINAL_LRL_AUDIO,verifyFirstPinnedApril08AudioPrefix,
 verifyJournalMotionPreservationAcrossAudioSources
} from '../src/evidence/senate-2021-apr08-four-original-lrl-audio-pins.js';
import {APR12_THREE_STRICT_ORIGINAL as journal} from
 '../src/evidence/senate-2021-apr12-three-strict-original-committee-amendments.js';

const proof=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-2021-apr08-four-original-lrl-audio-prefix-access-success.json',
 'utf8'
));

test('four historical Apr8 MP3 addresses have first original authenticated 64KiB binary SHA only',()=>{
 const spec=APR08_FOUR_ORIGINAL_LRL_AUDIO;
 assert.equal(spec.sourceMP3.length,4);
 assert.equal(spec.exactFirstPrefixBytes,65536);
 assert.equal(spec.originalFirstRunId,38178990727);
 assert.equal(spec.officialLRLMediaPageMeetingDate,'2021-04-08');
 assert.equal(spec.originalJournalReportDate,'2021-04-12');
 assert.deepEqual(spec.sourceMP3.map(x=>x.bill),['SF1159','SF970','SF970','SF970']);
 assert.equal(new Set(spec.sourceMP3.map(x=>x.url)).size,4);
 assert.equal(new Set(spec.sourceMP3.map(x=>x.firstOriginalPrefixSHA256)).size,4);
 for(const [i,x] of spec.sourceMP3.entries()){
  assert.equal(x.url,proof.originalAudioLeads[i]!.url);
  assert.equal(x.firstOriginalPrefixSHA256,
   proof.originalAudioLeads[i]!.originalFirstPrefixSHA256);
  assert.match(x.firstOriginalPrefixSHA256,/^[0-9a-f]{64}$/);
  assert.match(x.url,/^https:\/\/www\.lrl\.mn\.gov\/audio\/senate\/2021\/cmte_.*\.mp3$/);
 }
});

test('genuine original source run and independently downloaded ZIP/JSON byte/hash facts immutable',()=>{
 const p=proof.firstOriginalAudioSourceRun;
 assert.equal(p.runnerPR,1159);
 assert.equal(p.runId,38178990727);
 assert.equal(p.conclusion,'success');
 assert.equal(p.sourcePageFailures,0);
 assert.equal(p.verified2021LrlHearingPages,2);
 assert.equal(p.artifactId,11717117508);
 assert.equal(p.independentlyDownloadedZIPBytes,1824);
 assert.equal(p.independentlyDecodedJSONBytes,7875);
 assert.match(p.independentlyDownloadedZIPSHA256,/^[a-f0-9]{64}$/);
 assert.match(p.independentlyDecodedJSONSHA256,/^[a-f0-9]{64}$/);
 assert.equal(proof.strictFirstPrefixFacts.originalHTTPStatus,206);
 assert.equal(proof.strictFirstPrefixFacts.rangeRequestHonored,true);
 assert.equal(proof.strictFirstPrefixFacts.originalPrefixSignature,'id3');
 assert.equal(proof.strictFirstPrefixFacts.distinctOriginalAudioURLs,4);
 assert.equal(proof.strictFirstPrefixFacts.fullOriginalAudioSourcesAuthenticated,false);
});

test('even a fake ID3 prefix of same byte count fails original SHA and cannot certify a motion',()=>{
 const fake=Buffer.alloc(65536,0x41);
 fake.write('ID3',0,'ascii');
 for(const source of APR08_FOUR_ORIGINAL_LRL_AUDIO.sourceMP3){
  assert.throws(()=>verifyFirstPinnedApril08AudioPrefix(source,Buffer.from('ID3')),
   /length mismatch/);
  assert.throws(()=>verifyFirstPinnedApril08AudioPrefix(source,fake),/SHA-256 mismatch/);
 }
 const identity=verifyJournalMotionPreservationAcrossAudioSources();
 assert.equal(identity.originalJournalDistinctAmendments,3);
 assert.equal(identity.audioSourceLeads,4);
 assert.equal(identity.motionsHeardFromOriginalAudio,0);
 assert.equal(identity.motionOccurredOnFromAudio,null);
 assert.equal(identity.noAudioToMemberVoteInference,true);
 assert.deepEqual(journal.motions.map(x=>[x.bill,x.mover]),[
  ['SF1159','Dibble'],['SF1159','McEwen'],['SF970','Pappas']
 ]);
 assert.equal(proof.holds.specificAmendmentOccurredOn,null);
 assert.equal(proof.holds.issue864RemainsOpen,true);
});
