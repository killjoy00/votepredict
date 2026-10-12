import test from 'node:test';
import assert from 'node:assert/strict';
import {checkImmutableSourceManifest,makeAudioFeatures,matchOneWindow,compareAudioParts} from
 '../scripts/audit-senate-2021-apr08-judiciary-acoustic-overlap.mjs';

function simulatedSpeech(seconds,seed=1){
 const bytes=Buffer.alloc(seconds*1000*2);
 let state=seed,level=1;
 for(let i=0;i<seconds*1000;i++){
  state=(Math.imul(state,1664525)+1013904223)>>>0;
  if(i%125===0)level=200+((state>>>12)%2500);
  const value=(((state&65535)-32768)/32768*level)|0;
  bytes.writeInt16LE(value,i*2);
 }
 return bytes;
}
const src=simulatedSpeech(155,11);
const different=simulatedSpeech(155,45);
const shifted=Buffer.concat([simulatedSpeech(17,84),src.subarray(10*2000,125*2000),simulatedSpeech(22,85)]);

test('a consistent ten-second source cut with seventeen-second target lead is explicitly aligned',()=>{
 const a=makeAudioFeatures(src),b=makeAudioFeatures(shifted);
 const result=compareAudioParts(a,b,{anchorSeconds:[20,58,84]});
 assert.equal(result.state,'MULTIPLE_INDEPENDENT_SAMPLED_WINDOWS_ACOUSTICALLY_ALIGNED');
 assert.equal(result.multipleIndependentSpeechSamplesConfirmed,true);
 assert.equal(result.strongestSupportedConsistentWindowCount,3);
 assert.ok(Math.abs(result.sampledAlignmentOffsetSeconds-7)<0.5);
 assert.equal(result.aNegativeResultDoesNotProveNoOtherOverlap,true);
 for(const row of result.sampleWindows){
  assert.equal(row.acousticMatchSupported,true);
  assert.ok(row.energyCorrelation>0.99);
  assert.ok(row.decodedPCMCorrelation>0.99);
 }
});
test('unrelated synthetic speech cannot prove shared recording',()=>{
 const result=compareAudioParts(makeAudioFeatures(src),makeAudioFeatures(different),{anchorSeconds:[20,58,84]});
 assert.equal(result.state,'FULL_SESSION_OVERLAP_NOT_PROVEN');
 assert.equal(result.multipleIndependentSpeechSamplesConfirmed,false);
 assert.equal(result.sampledAlignmentOffsetSeconds,null);
});
test('same RMS envelope with inverted waveform fails PCM identity guard',()=>{
 const inverted=Buffer.alloc(src.length);
 for(let i=0;i<src.length;i+=2)inverted.writeInt16LE(-src.readInt16LE(i),i);
 const result=matchOneWindow(makeAudioFeatures(src),makeAudioFeatures(inverted),39);
 assert.equal(result.acousticMatchSupported,false);
 assert.equal(result.status,'WEAK_OR_MISMATCHED_PCM');
});
test('adversarial source manifests cannot change authenticated bytes, hashes or unresolved motion date',()=>{
 const spec=[
 ['transportation','SF1159','cmte_fintrans_040821.mp3',118836368,'ec5f1ca5183ec0e9b40dfa9f5e30c0b3ae2fc13afefcd935856715430013a8ef','8e2f01c874816f79811facc762146232f34d044a5db1cefecda4795dce04103f',8179.357],
 ['judiciary-first','SF970','cmte_jud_040821.mp3',106416620,'97cbe4438cb4f541f2202cb53a27f72098152107617fe4e21622227b79af9cbc','74b5c8c5580a805dfdebfbef803df02c0715e04075ba490983f38ec55e0b455a',6651.037],
 ['judiciary-second','SF970','cmte_jud_040821a.mp3',116669459,'818e8ddcaad73674444dd39d8033a9887ffc4dadc1e95009817539fe65f91013','0930c662d0b95ad73b661e6fd37f1549e6d64704d55d3c617ae2c3d14682f4f1',6651.011],
 ['judiciary-third','SF970','cmte_jud_040821b.mp3',85774553,'160483667a070a19b6d5b33df8cc1457a2c97a2ac16de831a0882a82a4aea028','b777ba4adde388217111376ecedae4d37f353875ffa52846dbb3e67630e514d7',5073.006]
 ];
 const p={issue:864,secondIndependentCompleteSource:{runId:38188288307,sourceFailures:0},
 exactOriginalAudio:spec.map(([sourcePart,bill,file,n,sha,prefix,duration])=>({
  sourcePart,bill,url:'https://www.lrl.mn.gov/audio/senate/2021/'+file,
  firstAndSecondOriginalFullBytes:n,firstAndSecondOriginalFullSHA256:sha,
  firstAndSecond64KiBSourcePrefixSHA256:prefix,originalAudioDurationSeconds:duration
 })),holds:{individualDibbleMcEwenPappasMotionOccurredOn:null}};
 assert.equal(checkImmutableSourceManifest(p),true);
 const mutated=structuredClone(p);mutated.exactOriginalAudio[2].firstAndSecondOriginalFullBytes++;
 assert.throws(()=>checkImmutableSourceManifest(mutated),/original whole MP3 pinned content mismatch/);
 mutated.exactOriginalAudio[2].firstAndSecondOriginalFullBytes--;
 mutated.holds.individualDibbleMcEwenPappasMotionOccurredOn='2021-04-08';
 assert.throws(()=>checkImmutableSourceManifest(mutated),/motion-specific day must remain null/);
});
