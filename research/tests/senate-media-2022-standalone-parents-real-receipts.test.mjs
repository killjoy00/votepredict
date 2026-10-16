import test from 'node:test';
import assert from 'node:assert/strict';
import receipt from '../../docs/evaluation/senate-media-2022-sf2666-sf2575-sf2729-original-rolls-20261012.json' with {type:'json'};
import previous from '../../docs/evaluation/senate-media-2022-parents-rights-gop-wcco-archive-20261012.json' with {type:'json'};
import {VERSION,JOURNALS,TEXT_VERSIONS,PUBLISHER,validateOriginalContext,allowlist}
 from '../../scripts/probe-senate-media-2022-standalone-parents-bills-primary.mjs';
const VERIFIED_JOURNALS=[
  {
    "date": "2022-03-03",
    "sha256": "57508a799f660850e0794b4f09a7c958cd72dff606e58a493f7557a15358aa3b",
    "bytes": 412715,
    "pages": 18,
    "ballots": [
      {
        "bill": "SF2729",
        "member": "Roger Chamberlain",
        "yes": "yea",
        "voteTextPage": 17,
        "printed": 5209,
        "tally": [
          67,
          0
        ]
      },
      {
        "bill": "SF2575",
        "member": "Paul Gazelka",
        "yes": "yea",
        "voteTextPage": 17,
        "printed": 5209,
        "tally": [
          37,
          30
        ]
      }
    ]
  },
  {
    "date": "2022-03-10",
    "sha256": "3319cd7bbcebaca4b19657eb6a99d2a8cf70ee9b03251b608513084e235cb431",
    "bytes": 508243,
    "pages": 26,
    "ballots": [
      {
        "bill": "SF2666",
        "member": "Michelle Benson",
        "yes": "yea",
        "voteTextPage": 25,
        "printed": 5293,
        "tally": [
          36,
          31
        ]
      }
    ]
  }
];
const VERIFIED_BILLS=[
  {
    "bill": "SF2575",
    "version": 0,
    "sha256": "a73c9ba43aa269fb7201299511e981c30bcde54203a9939a0fad46da6ec34648",
    "bytes": 211399,
    "pages": 1
  },
  {
    "bill": "SF2729",
    "version": 1,
    "sha256": "b537a8f8b1142066fff5a8b9516028478f9650ca2a8a8d701b1ae3d8afaf5a70",
    "bytes": 219967,
    "pages": 2
  },
  {
    "bill": "SF2666",
    "version": 1,
    "sha256": "746e101e83590fe85fe6374a2f4bf96d7b093586055b9724f9b648642dece4e1",
    "bytes": 221128,
    "pages": 2
  }
];
const VERIFIED_BOUND_QUOTATIONS=[
  {
    "name": "Justin Eichorn",
    "hash": "17449db698d3ccbcad420e653c040ef2d6a6d983bb48b8ffc2a9824003966f5e",
    "chars": 96
  },
  {
    "name": "Michelle Benson",
    "hash": "3dbf76a78e179e8fa642185c6edcaac07ac985c1a96ee487c4f5165d956a5922",
    "chars": 64
  },
  {
    "name": "Paul Gazelka",
    "hash": "b8995d111cb1492fc3cbedcdcdf31f064eee9268a99b92af71264e7ba7b8b739",
    "chars": 101
  },
  {
    "name": "Roger Chamberlain",
    "hash": "2bfbc206218daf7ab0e0bf5e74f5b482626637fdb35e73ac10c551dd4eb2f11d",
    "chars": 117
  }
];

test('first complete public original journal vote CI evidence is tied to exact first source head and passed full repo',()=>{
 const p=receipt.provenance;
 assert.equal(VERSION,'track-d-2022-parents-education-three-standalone-primary-journal-v1');
 assert.equal(receipt.version,'track-d-2022-three-standalone-bills-official-journal-and-first-party-original-receipts-v1');
 assert.equal(p.issue,987);assert.equal(p.pr,1242);
 assert.equal(p.firstSuccessfulCompleteLiveReadOnlyCI,38291698878);
 assert.equal(p.sourceCommitHead,'9fd8788a1672083d4fe65e02a004a1779e7d1343');
 assert.equal(p.repositoryWideTestsPassed,2863);
 assert.equal(p.repositoryWideTestsFailed,0);
 assert.equal(p.adversarialStandaloneSourceVoteAndProxyTestsPassed,10);
 assert.equal(allowlist(),true);
});
test('both actual entire Senate March 3 and March 10 government original PDF SHA/body lengths/pages and exact printed individual ballot positions pinned',()=>{
 const cur=receipt.senateJournalOriginals.map(x=>({date:x.sourceDate,sha256:x.fullDownloadedOriginalPdfSha256,bytes:x.originalRawPdfBytes,pages:x.originalPdfPages,
 ballots:x.namedOriginalSenateBallots.map(y=>({bill:y.originalBill,member:y.senator,yes:y.verifiedDirectOriginalNamedMemberVote,
  voteTextPage:y.officialWholeJournalPdfPageOneBased,printed:y.revisorListedPrintedSenateJournalPage,
  tally:[y.officialRecordedChamberYeas,y.officialRecordedChamberNays]}))}));
 assert.deepEqual(cur,VERIFIED_JOURNALS);
 assert.deepEqual(cur.map(x=>x.bytes),[412715,508243]);
 assert.deepEqual(cur.map(x=>x.pages),[18,26]);
 assert.deepEqual(cur.map(x=>x.date),['2022-03-03','2022-03-10']);
 assert.deepEqual(cur.flatMap(x=>x.ballots.map(y=>[y.bill,y.member,y.yes])),[
  ['SF2729','Roger Chamberlain','yea'],['SF2575','Paul Gazelka','yea'],
  ['SF2666','Michelle Benson','yea']]);
});
test('three official ballots each in correct standalone bill third-reading affirmative roster, excluding surname-only proxy and authorship interpretations',()=>{
 const all=receipt.senateJournalOriginals.flatMap(x=>x.namedOriginalSenateBallots);
 assert.equal(all.length,3);
 for(const b of all){
  assert.equal(b.personallyInOriginalOfficialAffirmativeList,true);
  assert.equal(b.personallyInOriginalOfficialNegativeList,false);
  assert.equal(b.correctBillIsNearestPriorSenateFile,true);
  assert.equal(b.strictSeparateThirdReadingRollCallContext,true);
  assert.equal(b.voteNotInferredFromAuthorshipOrChamberTotals,true);
  assert.ok(b.billBeforeVoteAnchorDistanceChars>0&&b.billBeforeVoteAnchorDistanceChars<4800);
 }
 assert.deepEqual(all.map(v=>v.verifiedDirectOriginalNamedMemberVote),['yea','yea','yea']);
 assert.equal(receipt.holdBoundaries.Rule40ProxyNoteOnlyNotConsideredPersonalRosterEntry,true);
 assert.equal(receipt.totals.verifiedOfficialIndividualMemberYeaVotesOnThreeDistinctStandaloneBills,3);
});
test('original Feb14 current article not confused with independently indexed same-day historical original before March3 and March10 votes',()=>{
 const q=receipt.historicalPublisher,previousOriginal=previous.sourceOriginals[0].independentlyAuthenticatedHistoricalOriginals[0];
 assert.equal(q.originalPublisherUrl,PUBLISHER.url);
 assert.equal(q.earliestOriginalPublisherOriginalAuthenticatedCaptureUtc,'2022-02-14T23:24:11Z');
 assert.equal(q.firstCapture.utc,previousOriginal.captureUtc);
 assert.equal(q.firstCapture.indexedSha1Base32,'QKCIZE6CX4AZ2ZUOT6JNUNDKNYRYLEGP');
 assert.equal(q.firstCapture.indexedSha1Base32,previousOriginal.indexedOriginalSha1Base32);
 assert.equal(q.firstCapture.rawOriginalHtmlSha256,previousOriginal.downloadedOriginalHtmlRawSha256);
 assert.equal(q.firstCapture.rawOriginalHtmlSha256,'0bf05a87365ca09a6a85114fe867995c4bfe0531a35adf61641454ed322e7696');
 assert.equal(q.firstCapture.rawHtmlBytes,91008);
 assert.equal(q.firstCapture.independentlyReauthenticatedOnInitialDirectVoteRun,true);
 const anchor=validateOriginalContext();
 assert.equal(anchor.earliestOriginalArticleCapturedUtc,q.firstCapture.utc);
});
test('four separate senator original first bounded closed quote SHA and publisher printed name ownership proven but not full statements',()=>{
 const q=receipt.historicalPublisher.namedOriginalIndividualFirstCompleteClosedQuoteSegments;
 assert.deepEqual(q.map(x=>({name:x.senator,hash:x.firstClosedOriginalQuoteSegmentRawSha256,chars:x.firstClosedQuoteLengthCharacters})),VERIFIED_BOUND_QUOTATIONS);
 assert.deepEqual(q.map(x=>x.senator),['Justin Eichorn','Michelle Benson','Paul Gazelka','Roger Chamberlain']);
 for(const x of q){
  assert.equal(x.fullNamedSenatorBeforeQuote,true);
  assert.equal(x.issuerSurnameImmediatelyAfterClosingQuote,true);
  assert.equal(x.oneBoundedMatchInThisExactArchivedOriginal,true);
  assert.equal(x.completeFollowingParagraphsAsWholeSenatorVerbatimNotHumanApproved,true);
  assert.equal(x.actualRecordedVoiceNotAuthenticated,true);
  assert.match(x.firstClosedOriginalQuoteSegmentRawSha256,/^[0-9a-f]{64}$/);
 }
 assert.equal(receipt.totals.verifiedSeparatelyAttributedFirstClosedOriginalSenatorQuotes,4);
 assert.equal(receipt.historicalPublisher.firstPublisherPostingMinuteNotIndependentlyVerified,true);
});
test('March7 second original archived version is previously authenticated but transiently unavailable on first focused replay, never fabricated missing',()=>{
 const s=receipt.historicalPublisher.secondPriorPreviouslyAuthenticatedVersion;
 const upstream=previous.sourceOriginals[0].independentlyAuthenticatedHistoricalOriginals[1];
 assert.equal(s.utc,'2022-03-07T02:18:03Z');
 assert.equal(s.rawOriginalHtmlSha256,upstream.downloadedOriginalHtmlRawSha256);
 assert.equal(s.rawHtmlBytes,upstream.rawOriginalHtmlBytes);
 assert.equal(s.directVoteRunRetrieval,'http_unavailable_unknown');
 assert.equal(s.positiveHistoricalOriginalProofFromPriorMergedIssue987,true);
 assert.equal(receipt.totals.historicalPublisherOriginalHtmlVersionsReauthenticatedThisIncrement,1);
 assert.equal(receipt.totals.historicallyOriginalAuthenticatedPublisherArticleUrlCountNewThisIncrement,0);
});
test('three exact 92nd Legislature bill versions SHA pinned with topic terms; historic as-of version and floor amendments NOT auto-certified',()=>{
 const cur=receipt.selectedHistoricalOriginalBillTextVersions.map(x=>({
  bill:x.bill,version:x.officialRevisorTextVersion,sha256:x.fullOriginalPdfSha256,bytes:x.originalPdfBytes,pages:x.originalPdfPages
 }));
 assert.deepEqual(cur,VERIFIED_BILLS);
 assert.deepEqual(cur.map(x=>x.bill),['SF2575','SF2729','SF2666']);
 for(const b of receipt.selectedHistoricalOriginalBillTextVersions){
  assert.equal(b.officialCorrect92ndSenateBillAndVersionTextAuthenticated,true);
  assert.equal(b.allSelectedPolicyTopicTermsPresent,true);
  assert.ok(b.selectedTopicLexicalCues.every(x=>x.present===true));
  assert.equal(b.currentRevisorVersionListingNotIndependently2022PreVoteHtmlCapture,true);
  assert.equal(b.exactFirstPublicPostingMinuteNotProved,true);
  assert.equal(b.identicalToEveryFloorAmendmentAtVoteNotIndependentlyCertified,true);
  assert.equal(b.noFullGovernmentBillPdfTextPersisted,true);
 }
 assert.equal(receipt.totals.independentlyDownloadedAndSHA256VerifiedOfficialOriginalBillVersions,3);
});
test('three direct source-before-vote issue-level research candidates, one control, zero model or production labels',()=>{
 const c=receipt.evidenceJoinCandidates;
 assert.equal(c.length,3);
 assert.equal(c.filter(x=>x.role==='primary').length,2);
 assert.equal(c.filter(x=>x.role==='supporting_control').length,1);
 assert.ok(c.every(x=>x.earliestOriginalPublisherArticleBeforeVoteDay&&x.originalPersonallyOwnedBoundedFirstPrintedQuote));
 assert.ok(c.every(x=>x.originalOfficialSenatePersonalVote==='yea'));
 assert.ok(c.every(x=>x.selectedGovernmentBillTextPolicyCueMatch&&x.strongResearchSourceBeforeDirectStandaloneVoteCandidate));
 assert.ok(c.every(x=>x.validStoredTrainingOrProductionPredictionLabelApproved===false));
 assert.equal(receipt.totals.fullyProductionEligibleHistoricalSourceToVoteLabelsCreated,0);
});
test('strict historic origination, evidence source and no private DB/audio/serving production guard retained',()=>{
 const b=receipt.holdBoundaries;
 assert.equal(b.originalPublisherInitialPostingExactUtcStillUnknown,true);
 assert.equal(b.archivedFeb14OriginalActuallyPredatesAllThreeMarchVotes,true);
 assert.equal(b.feb14OriginalMayNotPredictEarlierFeb14Hearing,true);
 assert.equal(b.journalNamedMemberVoteProofIndependentOfSenatorBillAuthorship,true);
 assert.equal(b.exactFirstPublicAsOfTextVersionOrLastFloorAmendmentStillNotCertified,true);
 assert.equal(b.unrecordedAudioAndDifferentMprBensonKuneshProgramRemainUnknown,true);
 assert.equal(b.noPrivateVotePredictCorpusOrProductionSourceRowCompared,true);
 assert.equal(b.noForecastCollectorModelDatabaseStoredVoteOrServingChanged,true);
 assert.equal(b.noCopyrightedCompleteArticleTranscriptOrGovernmentOriginalFullPdfCommitted,true);
 assert.equal(receipt.historicalPublisher.noOriginalRawPublisherHtmlOrFullQuotationPersisted,true);
});
