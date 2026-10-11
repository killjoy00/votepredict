/** #987 source-only real original independent newsroom phrase provenance. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const load=(p:string)=>JSON.parse(readFileSync('docs/evaluation/'+p,'utf8')) as any;
const r=load('senate-media-three-reporter-original-historical-phrase-receipts-20261011.json');
const p=load('senate-media-2021-25-independent-reporter-15-historical-original-receipts-20261011.json');
const q=load('senate-media-three-independent-newsroom-historical-multi-speaker-queue-20261011.json');
test('actual six original text recheck versions link to independently downloaded public Actions proof digest',()=>{
 assert.equal(r.version,'senate-media-three-reporter-original-2022-2025-phrase-receipts-v1');
 assert.equal(r.originalPublicResearchRun.runId,38166031166);
 assert.equal(r.originalPublicResearchRun.sourceHeadSha,'6ccc3ff4e75fa06b61dab07363dc4da0781d742c');
 assert.equal(r.originalPublicResearchRun.conclusion,'success');
 assert.equal(r.originalPublicResearchRun.artifactId,11711912322);
 assert.equal(r.originalPublicResearchRun.downloadedZipSha256,
  '3a8e9a6889ed9e4fdefa78f882c34df1ad45ea34f69c11fdca8fdaec75ec7777');
 assert.equal(r.originalPublicResearchRun.decodedJsonSha256,
  '2010a9b6c2a1c1df2373fa84938d24586000a254fa95ac263964ccea7ac178a7');
 assert.equal(r.originalPublicResearchRun.decodedJsonBytes,12921);
});
test('13 of 13 actually inspected short historical source cues present; three unknown due refused earliest 2022 capture',()=>{
 const c=r.observations;
 assert.equal(c.selectedPublisherArticleUrls,3);
 assert.equal(c.distinctStateSenatorSpeakerCandidates,7);
 assert.equal(c.shortIndividuallyNamedPublisherTextCueCandidates,8);
 assert.equal(c.historicalOriginalHtmlCaptureVersionAttempts,6);
 assert.equal(c.historicalOriginalRawSha1AndSha256BodyVersionsReverified,5);
 assert.equal(c.originalBodyVersionFetchUnknown,1);
 assert.equal(c.positiveShortTextCuesInAuthenticatedHtml,13);
 assert.equal(c.negativeShortTextCuesInAuthenticatedHtml,0);
 assert.equal(c.unknownDueToUnreplayedBody,3);
 assert.equal(c.sameParagraphNameLabelClues,7);
 assert.equal(c.originalAudioVerified,0);
 assert.equal(c.fullSpeakerQuotesHumanApproved,0);
 assert.equal(c.individuallyRecordedFloorOrCommitteeVotesVerified,0);
 assert.equal(r.originalSourceVersionResults.length,6);
 const fromEarlier=[...p.originalSourceBodies.flatMap((x:any)=>
  x.rawSha1ConsistentOriginalHttpCaptures.map((c:any)=>({...c,leadId:x.leadId}))),
  ...p.independentFinalPublicRun.newExactHistoricalOriginalReceipts];
 let positive=0,unknown=0,nameLabels=0;
 for(const a of r.originalSourceVersionResults){
  const pin=fromEarlier.find((x:any)=>x.leadId===a.leadId&&x.captureUtc===a.archiveUtc);
  assert.ok(pin);
  assert.equal(a.individuallyAttributedShortTextCues.length,
   q.selectedOriginalReporterArticles.find((x:any)=>x.leadId===a.leadId).shortReporterAttributedSpeakerCues.length);
  if(a.status==='raw_sha1_and_prior_sha256_verified'){
   assert.equal(a.observedOriginalRawSha256,pin.rawOriginalBodySha256);
   assert.match(a.observedOriginalRawSha256,/^[a-f0-9]{64}$/);
   assert.ok(a.individuallyAttributedShortTextCues.every(
    (x:any)=>x.exactShortQuoteFragmentInHistoricVisibleHtml===true));
  }else{
   assert.equal(a.status,'redirect_unknown');
   assert.equal(a.archiveUtc,'2022-02-14T22:22:10Z');
   assert.equal(a.observedOriginalRawSha256,null);
   assert.ok(a.individuallyAttributedShortTextCues.every(
    (x:any)=>x.exactShortQuoteFragmentInHistoricVisibleHtml===null));
  }
  for(const x of a.individuallyAttributedShortTextCues){
   assert.equal(x.completeSenatorSpokenQuoteHumanApproved,false);
   assert.equal(x.originalAudioVerified,false);
   assert.equal(x.recordedSenateMemberVoteEstablished,false);
   positive+=Number(x.exactShortQuoteFragmentInHistoricVisibleHtml===true);
   unknown+=Number(x.exactShortQuoteFragmentInHistoricVisibleHtml===null);
   nameLabels+=Number(x.speakerNameInSameParagraph===true);
  }
 }
 assert.equal(positive,13);assert.equal(unknown,3);assert.equal(nameLabels,7);
});
test('recover Chamberlain direct speaker label historically; no false committee vote or timeline claim',()=>{
 const b=r.originalSourceVersionResults.find((x:any)=>
  x.leadId==='new-reporter-2022-curriculum'&&x.archiveUtc==='2022-02-15T03:12:23Z');
 assert.ok(b);
 assert.deepEqual(b.individuallyAttributedShortTextCues.map((x:any)=>x.speaker),
  ['Paul Gazelka','Michelle Benson','Roger Chamberlain']);
 assert.ok(b.individuallyAttributedShortTextCues.every((x:any)=>
  x.exactShortQuoteFragmentInHistoricVisibleHtml&&x.speakerNameInSameParagraph));
 assert.equal(r.unknownFeb14RawPageReplayNotEvidencePhraseMissing,true);
 assert.equal(r.verifiedFeb15RealHistoricReporterParagraphsLabelAllThreeGazelkaBensonChamberlain,true);
 assert.equal(r.sameParagraphNameProximityFalseMeansAttributionNeedsHumanReview,true);
 assert.equal(r.articleAboutCommitteeOrFloorProceedingsNotProofRecordedMemberVote,true);
 assert.equal(r.sourceRawHtmlAndAudioNeverPersisted,true);
 assert.equal(r.noPrivateVotePredictDataOrForecastUsed,true);
});
