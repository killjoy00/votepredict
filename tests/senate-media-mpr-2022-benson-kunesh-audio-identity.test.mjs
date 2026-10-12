import test from 'node:test';
import assert from 'node:assert/strict';
import {audioSourceIndicators,ORIGINALS,PAGES,VERSION,run2022MprRadioIdentity} from '../scripts/probe-senate-media-mpr-2022-benson-kunesh-audio-identity.mjs';
const named='https://download.publicradio.org/voices/minnesota-now/benson-kunesh-2022.mp3';
const other='https://download.publicradio.org/voices/minnesota-now/parents-2022.mp3';
function html(audio){
 return '<!doctype html><html><head><meta property="og:audio" content="'+audio+'"></head>'
  +'<body><audio src="'+audio+'"></audio><script>const audioId="audiodabcf012123";</script>'
  +'<p>Michelle Benson and Mary Kunesh</p>'+' '.repeat(4000)+'</body></html>';
}
test('two exact distinct MPR Feb23 2022 episode URLs, one separately SHA1+SHA256 original archive source with two versions',()=>{
 assert.equal(VERSION,'mpr-2022-benson-kunesh-two-episode-original-audio-identity-v1');
 assert.equal(PAGES.length,2);assert.notEqual(PAGES[0].url,PAGES[1].url);
 assert.deepEqual(PAGES[0].namedSenators,['Michelle Benson','Mary Kunesh']);
 assert.deepEqual(PAGES[1].namedSenators,[]);
 assert.equal(ORIGINALS.length,2);
 assert.deepEqual(ORIGINALS.map(x=>x.utc),['2022-02-24T02:53:02Z','2022-11-08T20:55:33Z']);
 assert.equal(ORIGINALS[0].rawSha256,'4c0d261abbbee79f31a2520b983bb84c8a998a488cf7e834b673b65d3b6be780');
 assert.equal(ORIGINALS[1].rawSha256,'3715f4b97a12a5ed59ef0506a24be311464501dad3ed72bc9192d1efc53a1d1e');
});
test('first-party MPR/publicradio mp3 URL fingerprint is deterministic, deduplicated, no raw original MP3 link or body exposed',()=>{
 const x=audioSourceIndicators(html(named));
 assert.equal(x.explicitAudioTagCount,1);
 assert.equal(x.openGraphAudioTags,1);
 assert.equal(x.distinctCandidateMediaUrlCount,1);
 assert.equal(x.candidateMediaUrlFingerprints[0].hostname,'download.publicradio.org');
 assert.match(x.candidateMediaUrlFingerprints[0].originPathSha256,/^[a-f0-9]{64}$/);
 assert.equal(JSON.stringify(x).includes('benson-kunesh-2022.mp3'),false);
 assert.equal(x.stringMatchNotRecordedAudioOrNamedSenatorSpeech,true);
});
test('embeds from a third party do not count as MPR asset identity',()=>{
 const x=audioSourceIndicators(html('https://evil.example/track.mp3'));
 assert.equal(x.distinctCandidateMediaUrlCount,0);
});
test('different first-party MP3 asset ids must NOT be conflated due common interview topic or page date',async()=>{
 const f=async url=>url.startsWith('https://web.archive.org/')?
  new Response('unavailable',{status:503}):
  new Response(html(url===PAGES[0].url?named:other),{headers:{'content-type':'text/html'}});
 const r=await run2022MprRadioIdentity(f);
 assert.equal(r.currentTwoPagesMediaFingerprintComparison.identicalAudioAssetFingerprintCount,0);
 assert.equal(r.archivedSeparateProgramPageVersions.length,2);
 assert.ok(r.archivedSeparateProgramPageVersions.every(x=>x.status==='historical_original_unavailable_unknown'));
 assert.ok(r.separate2022ArchivedPageAudioVsCurrentNamedPage.every(x=>x.comparison.identicalAudioAssetFingerprintCount===null));
 assert.equal(r.firstNamedBensonKuneshProgramHistoricalOriginalStillUnverified,true);
 assert.equal(r.noActualMprMp3OrWavContentsDownloadedOrSpeechRecognized,true);
 assert.equal(r.noPrivateSourceDocsOrModelOrForecastOrCollectorChanges,true);
 assert.equal(r.noRawPageOrAudioWritten,true);
});
test('the same explicit MPR-owned media asset string on two first-party pages proves shared asset identifier NOT its voiced speech',async()=>{
 const f=async url=>url.startsWith('https://web.archive.org/')?
  new Response('historical unavailable',{status:503}):
  new Response(html(named),{headers:{'content-type':'text/html'}});
 const r=await run2022MprRadioIdentity(f);
 assert.equal(r.currentTwoPagesMediaFingerprintComparison.identicalAudioAssetFingerprintCount,1);
 assert.equal(r.currentTwoPagesMediaFingerprintComparison.identicalMediaIdFingerprintCount,1);
 assert.equal(r.identicalUrlNotSufficientToHumanApproveSenatorVoice,true);
 assert.equal(r.newCurrentPublisherHtmlNotHistoricPublicByProof,true);
});
test('publisher audio appearance strings in embedded scripts are not authentic original 2022 audio itself',()=>{
 const noisy='download.publicradio.org/foo audioUrl audioSource <script type="application/json">{}</script>';
 const r=audioSourceIndicators(noisy);
 assert.equal(r.distinctCandidateMediaUrlCount,0);
 assert.equal(r.stringMatchNotRecordedAudioOrNamedSenatorSpeech,true);
});
