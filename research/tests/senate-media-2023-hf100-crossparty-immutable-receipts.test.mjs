/**
 * Track D #987 immutable metadata-only receipts. Independent literal pins:
 * changing a publisher original or source-vote record requires a real review,
 * not silently editing JSON and accepting a mutated quote.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JOURNAL,ORIGINALS,VERSION,validateOriginals} from '../../scripts/probe-senate-media-2023-hf100-crossparty-originals.mjs';
import {LEADS} from '../../scripts/probe-senate-media-2023-hf100-crossparty-candidates.mjs';
const receipt=JSON.parse(readFileSync('docs/evaluation/senate-media-2023-hf100-democratic-yes-crossparty-originals-20261012.json','utf8'));
const pins=[
 ['port-jan05-kstp-introduction','Lindsey Port','https://kstp.com/kstp-news/local-news/house-dfl-introduces-bill-to-legalize-recreational-marijuana/','2023-01-05T21:17:17Z','WARMR4RJ6NELAZRBXLEVM7DBTEOZBVK7','8c6df4ad994dabebb6c6dfa2ac610202b943e9155af2d30bd9b7504dd91ef579',172075,'cd88ed3de412f829426d09c177d56a8377fcd7335a4510028d3cb7d4a31a6b36',158,'closed_quote_immediately_named_sen_lindsey_port_reported_attribution'],
 ['port-jan06-redlake-reported-release','Lindsey Port','https://www.redlakenationnews.com/story/2023/01/06/politics/dfl-introduces-legislation-to-legalize-adult-use-cannabis/111129.html','2023-01-09T10:33:14Z','WNWHO7FO56MCHTBQTQW5Z66CGHJNZHQZ','ce685841c34e542c813ab6e6eafdff47b17bfef46eba3e5b7b28c797d7244022',30662,'cd88ed3de412f829426d09c177d56a8377fcd7335a4510028d3cb7d4a31a6b36',158,'closed_quote_immediately_named_senator_lindsey_port_attribution'],
 ['oumou-jan05-mpr-cannabis','Clare Oumou Verbeten','https://www.mprnews.org/story/2023/01/05/push-for-legal-marijuana-begins-at-minnesota-capitol','2023-01-05T17:56:14Z','AEWKILDAH5QTVDBB2NRVGH22IM7IL2KO','3cb55b27ef4706448b89fbdc2114dbda8c34ed657d33b269e65d137112cd2404',57846,'dd4d64bff6e85ce23c022f47fc9c54ac7379b7449e72c78330e71ea612e37187',37,'full_senator_named_preceding_sentence_then_direct_she_said_quote'],
 ['port-jan30-marijuana-herald-committee','Lindsey Port','https://themarijuanaherald.com/2023/01/third-minnesota-senate-committee-approves-bill-to-legalize-marijuana/','2023-01-31T18:52:53Z','DEFGFAP3WTPSI4GCEEUAPCNCA56EM6ZU','dfecffa31933b6dd8c4f5794453c2dd1c6e30f7e1e3a7e30ed4853faa5fe2794',56747,'9aba3ac3757e3ff9d2635a1a05bd72b0d8bc5cfbd30e73c878db1067706a337f',168,'closed_quote_immediately_named_senator_lindsey_port_at_hearing']
];
const field=['id','senator','url','earliestAuthenticatedOriginalCaptureUtc','independentlyIndexedOriginalSha1Base32','completeOriginalPublisherHtmlSha256','completeOriginalHtmlBytes','normalizedBoundedSpeakerStatementSha256','normalizedBoundedSegmentCharacters','boundedSpeakerAttributionProof'];
const expected=pins.map(p=>Object.fromEntries(field.map((key,i)=>[key,p[i]])));
test('receipt is an explicit research-only reviewed original cohort tied to Track D, not production',()=>{
 assert.equal(validateOriginals(),true);
 assert.equal(VERSION,'track-d-hf100-2023-two-democratic-yes-two-republican-no-original-primary-v1');
 assert.equal(receipt.version,'track-d-hf100-2023-democratic-yes-crossparty-primary-original-receipts-v1');
 assert.equal(receipt.trackingIssue,987);
 assert.equal(receipt.prNumber,1263);
 assert.equal(receipt.relatedMergedRepublicanNoPr,1254);
});
test('all four publisher article URLs and senator identities equal independent immutable pins',()=>{
 assert.equal(receipt.preVotePublisherOriginals.length,4);
 for(let i=0;i<4;i++){
  const p=receipt.preVotePublisherOriginals[i];
  assert.equal(p.id,expected[i].id);
  assert.equal(p.senator,expected[i].senator);
  assert.equal(p.url,expected[i].url);
  assert.equal(LEADS[i].id,p.id);
  assert.equal(LEADS[i].url,p.url);
 }
 assert.equal(new Set(receipt.preVotePublisherOriginals.map(p=>p.url)).size,4);
});
test('each independently indexed original SHA1, entire SHA256 and byte length locked',()=>{
 for(let i=0;i<4;i++){
  const p=receipt.preVotePublisherOriginals[i],e=expected[i];
  assert.equal(p.earliestAuthenticatedOriginalCaptureUtc,e.earliestAuthenticatedOriginalCaptureUtc);
  assert.equal(p.independentlyIndexedOriginalSha1Base32,e.independentlyIndexedOriginalSha1Base32);
  assert.equal(p.completeOriginalPublisherHtmlSha256,e.completeOriginalPublisherHtmlSha256);
  assert.equal(p.completeOriginalHtmlBytes,e.completeOriginalHtmlBytes);
  assert.equal(ORIGINALS[i].captureUtc,e.earliestAuthenticatedOriginalCaptureUtc);
  assert.equal(ORIGINALS[i].sha1,e.independentlyIndexedOriginalSha1Base32);
  assert.equal(ORIGINALS[i].sha256,e.completeOriginalPublisherHtmlSha256);
  assert.equal(ORIGINALS[i].bytes,e.completeOriginalHtmlBytes);
 }
});
test('four narrow personally named speaker boundaries are individually immutable',()=>{
 for(let i=0;i<4;i++){
  const p=receipt.preVotePublisherOriginals[i],e=expected[i];
  assert.equal(p.boundedSpeakerAttributionProof,e.boundedSpeakerAttributionProof);
  assert.equal(p.normalizedBoundedSpeakerStatementSha256,e.normalizedBoundedSpeakerStatementSha256);
  assert.equal(p.normalizedBoundedSegmentCharacters,e.normalizedBoundedSegmentCharacters);
  assert.equal(p.originalSpeakerQuoteAuthentic,true);
  assert.equal(p.completeHumanApprovedVerbatimUtteranceOrAudio,false);
  assert.equal(p.firstPublisherPostingMinuteIndependentlyVerified,false);
 }
});
test('same Port original quote syndicated: exact hash equality is one speaker statement, not two',()=>{
 const [k,red,mpr,herald]=receipt.preVotePublisherOriginals;
 assert.equal(k.normalizedBoundedSpeakerStatementSha256,red.normalizedBoundedSpeakerStatementSha256);
 assert.notEqual(k.normalizedBoundedSpeakerStatementSha256,mpr.normalizedBoundedSpeakerStatementSha256);
 assert.notEqual(k.normalizedBoundedSpeakerStatementSha256,herald.normalizedBoundedSpeakerStatementSha256);
 assert.equal(receipt.uniqueQuotations.samePortStatementReprintedKstpAndRedLakeByExactNormalizedSha256,true);
 assert.equal(receipt.uniqueQuotations.sameStatementNormalizedSha256,expected[0].normalizedBoundedSpeakerStatementSha256);
});
test('full official April 28 Senate Journal original PDF fingerprint never replaced by totals or extract',()=>{
 const j=receipt.originalOfficialSenateJournal;
 assert.equal(j.url,'https://www.senate.mn/journals/2023-2024/20230428059.pdf');
 assert.equal(j.fullPdfOriginalSha256,'9e8160e4c78ef70cc0635226201f12e656ac84a999af8e0a8f8dc3e6737791a3');
 assert.equal(j.fullPdfOriginalBytes,4472460);
 assert.equal(j.totalOriginalPdfPages,292);
 assert.equal(j.printedJournalPage,6890);
 assert.equal(j.originalPdfPageOneBased,290);
 assert.equal(JOURNAL.sha256,j.fullPdfOriginalSha256);
 assert.equal(JOURNAL.bytes,j.fullPdfOriginalBytes);
});
test('exact final question must be HF100 34–33, while SF73 remains only earlier companion',()=>{
 const j=receipt.originalOfficialSenateJournal;
 assert.equal(j.date,'2023-04-28');
 assert.equal(j.billInRecordedFinalPassage,'HF100');
 assert.equal(j.earlierCompanionNotDirectRecordedFinalPassageBill,'SF73');
 assert.equal(j.finalPassageYeas,34);
 assert.equal(j.finalPassageNays,33);
});
test('four senators have personally printed, opposite final passage rosters; no Rule40-only names',()=>{
 const j=receipt.originalOfficialSenateJournal;
 assert.deepEqual(j.individuallyPrintedNamedFinalBallots.map(x=>[x.senator,x.vote]),[
  ['Lindsey Port','yea'],['Clare Oumou Verbeten','yea'],['Gary Dahms','nay'],['Glenn Gruenhagen','nay']]);
 for(const r of j.individuallyPrintedNamedFinalBallots){
  assert.equal(r.inAffirmativeRoster,r.vote==='yea');
  assert.equal(r.inNegativeRoster,r.vote==='nay');
  assert.equal(r.notRule40ProxyOnly,true);
  assert.equal(r.notAdjacentFailedReReferralMotion,true);
 }
});
test('two new Democratic senator sources and two independently prior GOP-NO sources make four pairs only once',()=>{
 const q=receipt.uniqueQuotations;
 assert.equal(q.distinctOriginalPublisherArticles,4);
 assert.equal(q.verifiedOriginalPreVoteHtmlBodies,4);
 assert.equal(q.boundedOriginalSpeakerQuoteOccurrences,4);
 assert.equal(q.distinctSenatorQuoteContentSha256Count,3);
 assert.equal(q.distinctDemocraticSenatorsWithVerifiedPreVoteStatements,2);
 assert.equal(q.newlyVerifiedHistoricalDemocraticSenatorStatementToNamedYesResearchPairs,2);
 assert.equal(q.previouslyVerifiedRepublicanSenatorStatementToNamedNoResearchPairs,2);
 assert.equal(q.independentSenatorAgainstOpposedMemberCrossPartyPairwiseComparisons,4);
 assert.equal(q.distinctSingleBillFinalPassageOutcomeCount,1);
});
test('separate archive index digest mismatches remain precisely three UNKNOWN and unselected',()=>{
 const rows=receipt.unselectedArchiveIndexDigestMismatchQuarantinedUnknown;
 assert.equal(rows.length,3);
 assert.deepEqual(rows.map(x=>[x.sourceId,x.captureUtc]),[
  ['oumou-jan05-mpr-cannabis','2023-01-05T17:33:50Z'],
  ['port-jan06-redlake-reported-release','2023-01-09T15:00:04Z'],
  ['port-jan30-marijuana-herald-committee','2023-02-26T01:44:55Z']]);
 for(const row of rows){assert.equal(row.status,'archive_index_digest_mismatch_unknown');assert.equal(row.countAsAuthenticatedOriginal,false);}
});
test('audited receipts tie to two successful full CI live independent original replays',()=>{
 assert.equal(receipt.provenance.firstIndependentFourOriginalSourceIndexAndBodiesCI,38310942187);
 assert.equal(receipt.provenance.firstFourExactlyBoundedPersonalStatementsAndAllFourFinalBallotsCI,38311821251);
 assert.equal(receipt.provenance.strictVerifiedCommit,'be2cb396e63f42776d4f4662af235daecf2decde');
 assert.equal(receipt.provenance.fullRepoCIPassed,true);
});
test('epistemic and production safety holds must all remain hard barriers',()=>{
 const h=receipt.holds;
 for(const name of ['historicOriginalCaptureIsLatestKnownPublicByNotFirstPostingMinute',
  'reporterQuoteIsNotOriginalVerbatimAudioTranscript','mprAudioTranscriptSpeakersAreReportersNotQuotedSenator',
  'pressQuoteSyndicationNotCountedAsIndependentStatement','originalJanuaryBillProposalSF73MayDifferFromFinalAmendedHF100',
  'actualHistoricalVotePredictAsOfIngestionUnknown','noPrivateProductionDataUsed',
  'noRetrospectiveForecastOrPredictionBacktestPerformed','noProductionTrainingLabelApproved',
  'noSourceIngestionCollectorDatabaseFeatureModelOrDeploymentChange',
  'noFullCopyrightPublisherBodiesOrOfficialPDFPersisted','trackingIssue987RemainsOpen'])assert.equal(h[name],true,name);
 assert.ok(receipt.preVotePublisherOriginals.every(x=>x.party==='DFL'));
});
