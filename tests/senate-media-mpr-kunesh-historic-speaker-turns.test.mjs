import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {
 VERSION,QUOTES,publicPinnedOriginals,inspectBoundedNamedSpeakerTurn,
 reverifyPinnedOriginalSpeakerTurn,runKuneshSpeakerTurnProof
} from '../scripts/probe-senate-media-mpr-kunesh-original-speaker-turns.mjs';
const receipt=JSON.parse(readFileSync(new URL('../docs/evaluation/senate-media-mpr-six-interviews-public-reconciliation-20261011.json',import.meta.url),'utf8'));
const pins=publicPinnedOriginals(receipt);
const p={cue:QUOTES['mpr-2023-kunesh-native-family-preservation'].shortCue,label:QUOTES['mpr-2023-kunesh-native-family-preservation'].speakerLabel};
const charter={cue:QUOTES['mpr-2024-kunesh-charter-school-oversight'].shortCue,label:QUOTES['mpr-2024-kunesh-charter-school-oversight'].speakerLabel};
const example='<html><head><script>NINA MOINI: bad hidden script</script></head><body>'
  +'<h2>Audio transcript</h2><p>NINA MOINI: Today we hear from Senator Kunesh.</p>'
  +'<p>MARY KUNESH: We want to make sure this is codified in our state legislature. The point is protecting children.</p>'
  +'<p>NINA MOINI: Thanks, Senator.</p></body></html>';
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function sha1b32(buf){let v=0,bits=0,out='';for(const b of createHash('sha1').update(buf).digest()){
 v=v<<8|b;bits+=8;while(bits>=5){bits-=5;out+=B32[v>>>bits&31];}v&=(1<<bits)-1;}
 if(bits)out+=B32[v<<(5-bits)&31];return out;}
test('four exact prior original HTML proof pins across only two 2023/24 Kunesh public interviews, no new URL inflation',()=>{
 assert.equal(VERSION,'mpr-two-kunesh-historic-pinned-original-speaker-turn-v1');
 assert.equal(pins.length,4);assert.equal(new Set(pins.map(x=>x.pageUrl)).size,2);
 assert.deepEqual(pins.map(x=>x.captureUtc),
 ['2023-02-10T02:40:30Z','2024-04-18T02:46:06Z','2024-10-22T18:31:15Z','2024-12-11T00:46:18Z']);
 assert.deepEqual(pins.map(x=>x.bytes),[81419,82580,91958,129815]);
 assert.equal(pins[0].sha256,'091376b6f0a3a0a1104d9aa8bd4573212c2ba5953486c082df2877a8eb041f92');
 assert.equal(pins[3].sha1,'EXUETRMUIVMGRHPLYKSKWB3CXGJBDXWC');
});
test('same speaker turn with full-name MARY KUNESH label and selected short phrase succeeds, without claiming human approved full quotation',()=>{
 const v=inspectBoundedNamedSpeakerTurn(example,p);
 assert.equal(v.transcriptSectionHeadingVisible,true);
 assert.equal(v.senatorFullNameSpeakerLabelsInTranscript,1);
 assert.equal(v.selectedShortCueVisibleAnywhereOnOriginalPage,true);
 assert.equal(v.selectedShortCueInsideBoundedSameExplicitLabeledSpeakerTurn,true);
 assert.deepEqual(v.selectedShortCueSpeakerTurnOwnerLabels,['MARY KUNESH:']);
 assert.equal(v.selectedShortCueInsideOtherNamedSpeakerTurn,false);
 assert.equal(v.speakerTurnAdjacencyIsNotRecordedAudioOrHumanCertifiedFullQuotation,true);
 assert.equal(v.noPrivateEvidenceOrForecastPromotion,true);
});
test('host turn quoting Kunesh phrase is not the senator speaking her own labeled turn',()=>{
 const src='<html><body><h2>Audio transcript</h2><p>MARY KUNESH: Thank you for having me.</p>'
  +'<p>NINA MOINI: We want to make sure this is codified in our state legislature, is that your goal?</p></body></html>';
 const r=inspectBoundedNamedSpeakerTurn(src,p);
 assert.equal(r.selectedShortCueVisibleAnywhereOnOriginalPage,true);
 assert.equal(r.senatorFullNameSpeakerLabelsInTranscript,1);
 assert.equal(r.selectedShortCueInsideBoundedSameExplicitLabeledSpeakerTurn,false);
 assert.deepEqual(r.selectedShortCueSpeakerTurnOwnerLabels,['NINA MOINI:']);
 assert.equal(r.selectedShortCueInsideOtherNamedSpeakerTurn,true);
});
test('same statement phrase and named senator attribution reported in news description but no full speaker label is insufficient',()=>{
 const src='<html><body><h2>Audio transcript</h2><p>Reporter says Mary Kunesh wants to make sure this is codified in our state legislature.</p></body></html>';
 const r=inspectBoundedNamedSpeakerTurn(src,p);
 assert.equal(r.senatorFullNameSpeakerLabelsInTranscript,0);
 assert.equal(r.selectedShortCueInsideBoundedSameExplicitLabeledSpeakerTurn,false);
});
test('speaker cue outside Audio transcript section cannot be promoted into a verified speaker-labeled original turn',()=>{
 const src='<html><body><p>MARY KUNESH: We want to make sure this is codified in our state legislature.</p></body></html>';
 const r=inspectBoundedNamedSpeakerTurn(src,p);
 assert.equal(r.selectedShortCueVisibleAnywhereOnOriginalPage,true);
 assert.equal(r.transcriptSectionHeadingVisible,false);
 assert.equal(r.selectedShortCueInsideBoundedSameExplicitLabeledSpeakerTurn,false);
});
test('hidden markup and script not counted as senator quotes even when a visible host label appears',()=>{
 const src='<html><head><script>MARY KUNESH: We want to make sure this is codified in our state legislature.</script></head>'
  +'<body><h2>Audio transcript</h2><p>NINA MOINI: Here is the live conversation.</p></body></html>';
 const r=inspectBoundedNamedSpeakerTurn(src,p);
 assert.equal(r.selectedShortCueVisibleAnywhereOnOriginalPage,false);
 assert.equal(r.selectedShortCueInsideBoundedSameExplicitLabeledSpeakerTurn,false);
});
test('2024 charter school exact short reform phrase falls only inside matching Kunesh speaker turn',()=>{
 const src='<html><body><h2>Audio transcript</h2>'
  +'<p>NINA MOINI: How should Minnesota deal with closed charter schools?</p>'
  +'<p>MARY KUNESH: We need to really look at probably some kind of reform before proceeding.</p>'
  +'<p>NINA MOINI: Thanks, Senator.</p></body></html>';
 assert.equal(inspectBoundedNamedSpeakerTurn(src,charter).selectedShortCueInsideBoundedSameExplicitLabeledSpeakerTurn,true);
 const nope=src.replace('MARY KUNESH: We need to really look at probably some kind of reform',
  'NINA MOINI: We need to really look at probably some kind of reform');
 assert.equal(inspectBoundedNamedSpeakerTurn(nope,charter).selectedShortCueInsideBoundedSameExplicitLabeledSpeakerTurn,false);
});
test('archive replay proves own original HTTP bytes with BOTH prior SHA1 AND SHA256 and bounded speaker cue',async()=>{
 const raw=Buffer.from(example+' '.repeat(4000));
 const pin={...pins[0],sha1:sha1b32(raw),sha256:createHash('sha256').update(raw).digest('hex'),bytes:raw.length};
 const f=async (url,opt)=>{
  assert.equal(url,'https://web.archive.org/web/20230210024030id_/'+pin.pageUrl);
  assert.equal(opt.redirect,'manual');
  return new Response(raw,{headers:{'content-type':'text/html'}});
 };
 const v=await reverifyPinnedOriginalSpeakerTurn(pin,f);
 assert.equal(v.status,'sha1_and_sha256_reverified_same_original_html');
 assert.equal(v.reverifiedRawBytes,raw.length);
 assert.equal(v.turnIndicators.selectedShortCueInsideBoundedSameExplicitLabeledSpeakerTurn,true);
 assert.equal(v.independentlyAuthenticatedAudioOfSpeaker,false);
});
test('one-byte source alteration after prior source receipt fails closed, no transcript flags leaked',async()=>{
 const raw=Buffer.from(example+' '.repeat(4000));
 const pin={...pins[0],sha1:sha1b32(raw),sha256:createHash('sha256').update(raw).digest('hex'),bytes:raw.length};
 const f=async()=>new Response(Buffer.from(raw.toString('utf8')+'changed'),{headers:{'content-type':'text/html'}});
 const v=await reverifyPinnedOriginalSpeakerTurn(pin,f);
 assert.equal(v.status,'historical_original_sha1_sha256_or_length_mismatch_unknown');
 assert.equal(v.turnIndicators,null);
});
test('archived original HTTP errors preserve unknown rather than implying source text absent',async()=>{
 const v=await reverifyPinnedOriginalSpeakerTurn(pins[0],async()=>new Response('Service temporarily unavailable',{status:503}));
 assert.equal(v.status,'historical_original_replay_http_redirect_or_mime_unknown');
 assert.equal(v.turnIndicators,null);
});
test('entire bounded selected sample is not a private source export and cannot certify full quotes or forecast availability',async()=>{
 const r=await runKuneshSpeakerTurnProof(async()=>new Response('Unavailable',{status:503}));
 assert.equal(r.originalPublicSourceDocumentCount,4);
 assert.equal(r.originalDistinctFirstPartyEpisodeUrls,2);
 assert.equal(r.verifiedOriginalHtmlRawBodyCount,0);
 assert.equal(r.candidateSameLabeledSpeakerTurnCount,0);
 assert.equal(r.theseAreSelectedShortCuesNotReviewedFullVerbatimUtterances,true);
 assert.equal(r.sameOriginalAudioNotIndependentlyAuthenticated,true);
 assert.equal(r.originalSpeakerTurnNotAutomaticallyEligibleForAnyPastVote,true);
 assert.equal(r.neverSavedRawMprHtmlOrAudioOrTranscript,true);
 assert.equal(r.noPrivateDbOrCollectorOrModelTouched,true);
});


test('selected short phrase in transcript introduction without any labeled speaker remains unattributed, not Kunesh',()=>{
 const src='<html><body><h2>Audio transcript</h2>'
  +'<p>We want to make sure this is codified in our state legislature.</p>'
  +'<p>NINA MOINI: Welcome to the news show.</p></body></html>';
 const r=inspectBoundedNamedSpeakerTurn(src,p);
 assert.equal(r.selectedShortCueVisibleInsideTranscriptSection,true);
 assert.equal(r.selectedShortCueOutsideAllBoundedSpeakerTurns,true);
 assert.deepEqual(r.selectedShortCueSpeakerTurnOwnerLabels,[]);
 assert.equal(r.selectedShortCueInsideBoundedSameExplicitLabeledSpeakerTurn,false);
});

