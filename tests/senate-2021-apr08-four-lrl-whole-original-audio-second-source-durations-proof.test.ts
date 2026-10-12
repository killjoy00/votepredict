import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 APR08_FOUR_ORIGINAL_LRL_AUDIO,
 verifyFirstPinnedWholeOriginalApril08Audio
} from '../src/evidence/senate-2021-apr08-four-original-lrl-audio-pins.js';
import {APR12_THREE_STRICT_ORIGINAL} from
 '../src/evidence/senate-2021-apr12-three-strict-original-committee-amendments.js';

const source=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-2021-apr08-four-lrl-whole-mp3-strict-second-original-sha-durations-success.json',
 'utf8'
));

test('second independently fetched real 2021 Minnesota LRL Senate full MP3 originals match first pinned full SHA and lengths',()=>{
 assert.equal(source.issue,864);
 assert.equal(source.firstCompleteSource.runId,38187776601);
 assert.equal(source.firstCompleteSource.conclusion,'success');
 const second=source.secondIndependentCompleteSource;
 assert.equal(second.runId,38188288307);
 assert.equal(second.mergedPR,1170);
 assert.equal(second.conclusion,'success');
 assert.equal(second.sourceFailures,0);
 assert.equal(second.completeSourcesStrictlyIdenticalBytesAndFullSHA,4);
 assert.equal(second.ffprobeInstalledAndFourDurationsObtained,true);
 assert.equal(second.artifactId,11719559922);
 assert.equal(second.independentlyDownloadedArtifactZIPBytes,1708);
 assert.equal(second.independentlyDecodedSourceJSONBytes,6379);
 assert.match(second.independentlyDownloadedArtifactZIPSHA256,/^[a-f0-9]{64}$/);
 assert.match(second.independentlyDecodedSourceJSONSHA256,/^[a-f0-9]{64}$/);
 assert.equal(source.exactOriginalAudio.length,4);
 assert.equal(APR08_FOUR_ORIGINAL_LRL_AUDIO.sourceMP3.length,4);
 for(const [index,row] of source.exactOriginalAudio.entries()){
  const pinned=APR08_FOUR_ORIGINAL_LRL_AUDIO.sourceMP3[index]!;
  assert.equal(row.bill,pinned.bill);
  assert.equal(row.sourcePart,pinned.part);
  assert.equal(row.url,pinned.url);
  assert.equal(row.firstAndSecondOriginalFullBytes,pinned.firstCompleteOriginalBytes);
  assert.equal(row.firstAndSecondOriginalFullSHA256,pinned.firstCompleteOriginalSHA256);
  assert.equal(row.firstAndSecond64KiBSourcePrefixSHA256,pinned.firstOriginalPrefixSHA256);
  assert.equal(row.secondFullSourceSHAIdenticalToFirst,true);
  assert.equal(row.ffprobeDurationIndependentlyObtained,true);
  assert.ok(row.originalAudioDurationSeconds>1800);
  assert.equal(row.exactAmendmentRollHeardOrVerified,false);
  assert.equal(verifyFirstPinnedWholeOriginalApril08Audio(
   pinned,row.firstAndSecondOriginalFullBytes,row.firstAndSecondOriginalFullSHA256
  ).independentSecondWholeSourceVerified,true);
 }
});

test('three Pappas auto-caption lead offsets fit first Judiciary audio but are NOT roll-call timestamps',()=>{
 assert.deepEqual(source.originalJudiciaryFirstCaptionReviewOffsetsSeconds,[3503,4004,4943]);
 const firstJud=source.exactOriginalAudio.find((row:{sourcePart:string})=>
  row.sourcePart==='judiciary-first');
 assert.ok(firstJud);
 assert.equal(firstJud.originalAudioDurationSeconds,6651.037);
 assert.equal(source.allThreeCaptionOffsetsInsideFirstJudiciaryMP3Duration,true);
 assert.ok(source.originalJudiciaryFirstCaptionReviewOffsetsSeconds.every(
  (time:number)=>time<firstJud.originalAudioDurationSeconds));
 assert.equal(source.holds.individualDibbleMcEwenPappasMotionOccurredOn,null);
 assert.equal(source.holds.independentHistoricalFirstPublishedBy,null);
 assert.equal(source.holds.noSpeechOrRollContentListenedToOrTranscribed,true);
 assert.equal(source.holds.journalOriginalRule1210ReportDay,'2021-04-12');
 assert.equal(source.holds.dayOnOfficialLRLMediaHearing,'2021-04-08');
});

test('two nearly equal-duration Judiciary original files must not be silently deduplicated or called sequential',()=>{
 const [a,b]=source.exactOriginalAudio.filter((row:{bill:string})=>row.bill==='SF970');
 assert.equal(a.originalAudioDurationSeconds,6651.037);
 assert.equal(b.originalAudioDurationSeconds,6651.011);
 assert.notEqual(a.firstAndSecondOriginalFullSHA256,b.firstAndSecondOriginalFullSHA256);
 assert.notEqual(a.firstAndSecondOriginalFullBytes,b.firstAndSecondOriginalFullBytes);
 assert.equal(source.judiciaryAudioSourcesAreNotYetCertifiedNonOverlappingOrSequential,true);
 assert.equal(APR12_THREE_STRICT_ORIGINAL.motions.length,3);
 assert.deepEqual(APR12_THREE_STRICT_ORIGINAL.motions.map(x=>[x.bill,x.mover]),[
  ['SF1159','Dibble'],['SF1159','McEwen'],['SF970','Pappas']
 ]);
 assert.equal(source.holds.noOriginal2021PrintMinutesCompared,true);
 assert.equal(source.holds.no2022PrintVsElectronicParity,true);
 assert.equal(source.holds.noProductionReadWriteMemberVoteImportModelsForecastsFloorOr2027,true);
 assert.equal(source.holds.issue864RemainsOpen,true);
});
