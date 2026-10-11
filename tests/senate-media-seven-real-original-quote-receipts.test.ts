/** Immutable real public reporter historical HTML SHA proof regression (#987). */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const read=(path:string)=>JSON.parse(readFileSync('docs/evaluation/'+path,'utf8')) as any;
const q=read('senate-media-seven-remaining-authentic-independent-reporter-quote-queue-20261011.json');
const m=read('senate-media-2021-25-seven-reporter-authentic-original-quote-receipts-20261011.json');
const old=read('senate-media-2021-25-independent-reporter-15-historical-original-receipts-20261011.json');
const lead=read('senate-media-2021-25-further-independent-reporting-15-leads.json');
test('independently downloaded original seven-article live workflow ZIP/JSON SHA256 and source run pinned',()=>{
 assert.equal(m.version,'senate-media-seven-completed-journalist-original-quote-proof-receipts-v1');
 assert.equal(m.publicProofSource.runId,38168875941);
 assert.equal(m.publicProofSource.conclusion,'success');
 assert.equal(m.publicProofSource.originalBranchHeadSha,'0e2892a46ee5b025ca0f9ad20bab633416dbc88c');
 assert.equal(m.publicProofSource.artifactId,11712249946);
 assert.equal(m.publicProofSource.originalZipSha256,'40ccf1a4a3ace27e0d53c25d99e544209f166d28313ae88bf9427e028546c6db');
 assert.equal(m.publicProofSource.decodedJsonSha256,'dd03ea36f6f47012471057cc857dc469adf3bd49e1bb97cdf8cb7406b18837af');
 assert.equal(m.publicProofSource.decodedJsonBytes,33285);
});
test('all 14 selected HTTP body SHA1/SHA256 and historical capture UTC identities trace to prior real original evidence',()=>{
 const reference=[
  ...old.originalSourceBodies.flatMap((x:any)=>x.rawSha1ConsistentOriginalHttpCaptures.map((v:any)=>({...v,leadId:x.leadId}))),
  ...old.independentFinalPublicRun.newExactHistoricalOriginalReceipts,
 ];
 const a=m.originalArticleHttpCaptureVersions as any[];
 assert.equal(a.length,14);
 assert.equal(new Set(a.map((x:any)=>x.reporterArticleId)).size,7);
 assert.equal(new Set(a.map((x:any)=>x.reporterArticleId+'|'+x.verifiedOriginalCaptureUtc)).size,14);
 let found=0,full=0,surname=0;
 for(const body of a){
  const pin=reference.find((v:any)=>v.leadId===body.reporterArticleId&&v.captureUtc===body.verifiedOriginalCaptureUtc);
  assert.ok(pin);
  const src=lead.independentOriginalReporterArticleLeads.find((v:any)=>v.id===body.reporterArticleId);
  const cue=q.sourceArticles.find((v:any)=>v.originalLeadId===body.reporterArticleId);
  assert.ok(src&&cue);
  assert.equal(body.originalPublisherArticleUrl,src.originalPublisherUrl);
  assert.equal(body.namedSenator,cue.expectedNamedServingSenatorSpeaker);
  assert.equal(body.originalIndexedSha1Base32,pin.indexSha1Base32);
  assert.equal(body.originalRawSha256Reverified,pin.rawOriginalBodySha256);
  assert.equal(body.verifiedOriginalRawHttpBytes,pin.originalBytes);
  assert.equal(body.observedOriginalRawSha256EqualsPreviousPinnedDigest,true);
  assert.equal(body.replayStatus,'exact_original_raw_sha1_and_pinned_sha256_verified');
  assert.deepEqual(body.shortCueObservations.map((v:any)=>v.id),cue.cueFragments.map((v:any)=>v.id));
  assert.equal(body.shortCueObservations.length,2);
  for(const c of body.shortCueObservations){
   assert.equal(c.shortHistoricHtmlQuoteFragmentFound,true);found++;
   full+=Number(c.fullSenatorNameInSameHtmlParagraph);
   surname+=Number(c.senatorSurnameInSameHtmlParagraph);
   assert.equal(c.humanApprovedCompleteSpokenQuotation,false);
   assert.equal(c.originalAudioCompared,false);
   assert.equal(c.originalMemberFloorOrCommitteeRecordedVoteVerified,false);
  }
 }
 assert.equal(found,28);assert.equal(full,20);assert.equal(surname,26);
});
test('historic public original contents remain different from complete speeches, original audio, original posting clock and verified vote counts',()=>{
 assert.deepEqual(m.observedCounts,{
  distinctOriginallyReportingPublisherArticleUrls:7,distinctIndividuallyNamedServingSenatorSpeakers:7,
  originalExactHistoricalHtmlBodiesSha1AndPreviousSha256Reverified:14,originalHtmlReplayUnknown:0,
  shortHistoricHtmlSnippetChecks:28,shortHistoricalHtmlSnippetsPresent:28,
  shortHistoricalHtmlSnippetsAbsent:0,shortHistoricalHtmlSnippetsUnknown:0,
  weakSameParagraphFullSenatorNameClues:20,weakSameParagraphSenatorSurnameClues:26,
  originalAudioVersionsAuthenticated:0,completeSpokenSenatorUtterancesHumanApproved:0,
  originalPublisherInitialPostClocksProven:0,individualRecordedSenateCommitteeOrFloorVotesEstablished:0,
 });
 for(const [key,flag] of Object.entries(m.evidenceBoundaries))
  assert.equal(flag,true,'Original source evidence caveat '+key);
 assert.equal(lead.newIndividuallyNamedSenatorSpeakerCandidates,24);
 assert.equal(Object.hasOwn(m,'rawHistoricalArticleHtml'),false);
 assert.equal(Object.hasOwn(m,'recordedSenateRollCalls'),false);
});
