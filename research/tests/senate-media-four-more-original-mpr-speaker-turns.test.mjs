import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import manifest from '../../docs/evaluation/senate-media-2022-25-mpr-caucus-breadth-20261011.json' with {type:'json'};
import {
 VERSION,STUDIES,selectExactOriginalSpeakerStudyPins,checkPinnedOriginalSpeakerTurn,runFourSenatorOriginalSpeakerTurns
} from '../../scripts/probe-senate-media-four-more-original-mpr-speaker-turns.mjs';
import {inspectBoundedNamedSpeakerTurn} from '../../scripts/probe-senate-media-mpr-kunesh-original-speaker-turns.mjs';
const PINS=selectExactOriginalSpeakerStudyPins(manifest);
const A='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function sha1base32(buf){let b=0,v=0,s='';for(const n of createHash('sha1').update(buf).digest()){
 v=v<<8|n;b+=8;while(b>=5){b-=5;s+=A[v>>>b&31];}v&=(1<<b)-1;}if(b)s+=A[v<<(5-b)&31];return s;}
test('four distinct serving 2023-25 state senators from seven earlier indexed genuine first-party MPR archived original HTML bodies',()=>{
 assert.equal(VERSION,'mpr-four-more-senators-2023-25-original-speaker-turn-source-proof-v1');
 assert.equal(PINS.length,7);
 assert.equal(new Set(PINS.map(x=>x.url)).size,4);
 assert.deepEqual(STUDIES.map(x=>x.speaker),['Steve Cwodzinski','John Hoffman','Zach Duckworth','Sandra Pappas']);
 assert.deepEqual(PINS.map(x=>x.originalArchiveUtc),[
  '2023-03-14T11:26:30Z','2023-11-30T10:11:31Z','2024-01-19T09:30:22Z',
  '2024-09-23T07:50:05Z','2024-10-08T15:38:38Z','2025-04-21T03:45:59Z','2025-05-01T17:07:38Z'
 ]);
 assert.equal(manifest.scope.independentlySha1AuthenticatedOriginalHtmlCaptureCount,10);
 assert.equal(manifest.scope.distinctOriginalPublisherUrlsWithAuthenticatedOriginalHtml,6);
 assert.throws(()=>selectExactOriginalSpeakerStudyPins({...manifest,sourceOriginals:[]}));
});
test('fake reporter/host and unquoted press statement cannot masquerade as printed named senator answers',()=>{
 for(const s of STUDIES){
  const src='<html><body><p>Host summarized: '+s.shortPhrase+'.</p><h2>Audio transcript</h2>'
   +'<p>CATHY WURZER: '+s.shortPhrase+'</p><p>'+s.label+' Thank you, Cathy.</p></body></html>';
  const x=inspectBoundedNamedSpeakerTurn(src,{label:s.label,cue:s.shortPhrase});
  assert.equal(x.selectedShortCueVisibleAnywhereOnOriginalPage,true);
  assert.equal(x.selectedShortCueInsideBoundedSameExplicitLabeledSpeakerTurn,false);
  assert.deepEqual(x.selectedShortCueSpeakerTurnOwnerLabels,['CATHY WURZER:']);
 }
});
test('same exact short passage enclosed in matching senator FULL name label within actual transcript heading is printed-turn candidate',()=>{
 for(const s of STUDIES){
  const src='<html><body><h2>Audio transcript</h2><p>CATHY WURZER: Please explain the policy.</p><p>'
   +s.label+' For me, '+s.shortPhrase+'. Thank you.</p><p>CATHY WURZER: Understood.</p></body></html>';
  const x=inspectBoundedNamedSpeakerTurn(src,{label:s.label,cue:s.shortPhrase});
  assert.equal(x.transcriptSectionHeadingVisible,true);
  assert.equal(x.selectedShortCueInsideBoundedSameExplicitLabeledSpeakerTurn,true);
  assert.deepEqual(x.selectedShortCueSpeakerTurnOwnerLabels,[s.label]);
  assert.equal(x.speakerTurnAdjacencyIsNotRecordedAudioOrHumanCertifiedFullQuotation,true);
 }
});
test('indexed original body and source metadata must be authentic, preserving rejected mutated HTML instead of attributing words',async()=>{
 const original=Buffer.from('<html><body><h2>Audio transcript</h2><p>CATHY WURZER: Hello</p><p>STEVE CWODZINSKI: I know the difference between an unfunded mandate and a funded mandate.</p></body></html>'+' '.repeat(6000));
 const t=PINS[0],pin={...t,indexedSha1:sha1base32(original),rawSha256:createHash('sha256').update(original).digest('hex'),bytes:original.length};
 const mock=async(url,opts)=>{assert.ok(url.includes('/20230314112630id_/'));assert.equal(opts.redirect,'manual');return new Response(original,{headers:{'content-type':'text/html'}});};
 const accepted=await checkPinnedOriginalSpeakerTurn(pin,mock);
 assert.equal(accepted.replayStatus,'sha1_sha256_and_bytes_reverified_original_mpr_html');
 assert.equal(accepted.speakerTurnIndicators.selectedShortCueInsideBoundedSameExplicitLabeledSpeakerTurn,true);
 assert.equal(accepted.humanFullVerbatimQuoteApproved,false);
 const rejected=await checkPinnedOriginalSpeakerTurn({...pin,rawSha256:'0'.repeat(64)},mock);
 assert.equal(rejected.replayStatus,'sha1_sha256_or_bytes_mismatch_unknown');
 assert.equal(rejected.speakerTurnIndicators,null);
});
test('index/replay 404/503 are UNKNOWN for 7, not proof the person never spoke in the original media',async()=>{
 const response=await runFourSenatorOriginalSpeakerTurns(async()=>new Response('Service unavailable',{status:503}));
 assert.equal(response.selectedFourDistinctServingSenatorInterviewUrls,4);
 assert.equal(response.knownIndexedSourceOriginalHtmlVersions,7);
 assert.equal(response.sourceVersionsRawSha1Sha256Reverified,0);
 assert.equal(response.sameFullNameSpeakerTurnShortPhraseAuthenticated,0);
 assert.ok(response.results.every(x=>x.speakerTurnIndicators===null));
 assert.equal(response.noHistoricalOriginalAudioBinariesAuthenticated,true);
 assert.equal(response.noEarlierModelCutoffDeducedFromDisplayedPublisherDate,true);
 assert.equal(response.multipleArchiveVersionsNotExtraDistinctArticles,true);
 assert.equal(response.noPrivateRecordsOrCollectorsOrForecastsTouched,true);
 assert.equal(response.noRawHtmlAudioPdfWarcRetained,true);
});
