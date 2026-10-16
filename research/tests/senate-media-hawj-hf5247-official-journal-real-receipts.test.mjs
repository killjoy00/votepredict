import test from 'node:test';
import assert from 'node:assert/strict';
import receipt from '../../docs/evaluation/senate-media-2024-hawj-hf5247-official-journals-20261012.json' with {type:'json'};
import bridge from '../../docs/evaluation/senate-media-2024-hawj-hf5247-bill-action-bridge-20261012.json' with {type:'json'};
import originalQuote from '../../docs/evaluation/senate-media-2024-hawj-mcewen-original-written-quote-receipts-20261012.json' with {type:'json'};
import {VERSION,JOURNALS,originalHawjSource,officialJournalAllowlist} from '../../scripts/probe-senate-media-hawj-hf5247-official-journal-pdfs.mjs';

const PINNED = [
  {
    "day": "2024-05-07",
    "url": "https://www.senate.mn/journals/2023-2024/20240507113.pdf",
    "sha256": "bea831ff7e8a9c51f388641012189af7c72cc2155e21de66717a6331f9a7b7b4",
    "bytes": 1474362,
    "pages": 86,
    "votes": [
      {
        "event": "third_reading_passage",
        "yes": 55,
        "no": 10,
        "h": "yea",
        "page": 16488,
        "pdfPage": 57
      }
    ]
  },
  {
    "day": "2024-05-19",
    "url": "https://www.senate.mn/journals/2023-2024/20240519119.pdf",
    "sha256": "fdc77ecf62de6f56ae33915105316f26f2f7c60765b9296dddf14d94c9f9584c",
    "bytes": 28283947,
    "pages": 2026,
    "votes": [
      {
        "event": "conference_report",
        "yes": 34,
        "no": 12,
        "h": "yea",
        "page": 20020,
        "pdfPage": 2022
      },
      {
        "event": "third_reading_amended",
        "yes": 34,
        "no": 14,
        "h": "yea",
        "page": 20021,
        "pdfPage": 2023
      }
    ]
  }
];

test('actual successful original PDF public Senate Journal first-head workflow and nine synthetic adversarial tests pinned',()=>{
 assert.equal(VERSION,'track-d-hawj-hf5247-2024-primary-senate-journal-individual-rollcall-v1');
 assert.equal(receipt.version,'track-d-2024-hawj-hf5247-primary-official-senate-journal-individual-ballot-receipts-v1');
 assert.equal(receipt.origin.issue,987);
 assert.equal(receipt.origin.pr,1225);
 assert.equal(receipt.origin.firstSuccessfulLiveOfficialPdfRunId,38265042318);
 assert.equal(receipt.origin.sourceHead,'dbb8d7dd78a1564f354ce4b2f204b9bb02ed3a96');
 assert.equal(receipt.origin.publicMetadataOnlyArtifactId,11753813661);
 assert.equal(receipt.origin.offlineSyntheticAdversarialTestsPassed,9);
 assert.equal(officialJournalAllowlist(),true);
 assert.deepEqual(JOURNALS.map(x=>x.day),[113,119]);
});
test('both exact full original 2024 MN Senate Journal government PDFs are independently SHA256 and byte-count pinned',()=>{
 const actual=receipt.exactOfficialPrimaryJournalSources.map(x=>({day:x.date,url:x.originalOfficialJournalUrl,
  sha256:x.completeOriginalPdfSha256,bytes:x.originalPdfBytes,pages:x.originalPdfPages,
  votes:x.namedHF5247RollCalls.map(y=>({event:y.event,yes:y.aggregateYeas,no:y.aggregateNays,h:y.individualVoteOnThisHF5247RollCall,page:y.printedJournalPageWhereRollCallBegins,pdfPage:y.sourcePdfPageOneBased}))}));
 assert.deepEqual(actual,PINNED);
 assert.equal(actual.length,2);
 assert.deepEqual(actual.map(x=>x.bytes),[1474362,28283947]);
 assert.deepEqual(actual.map(x=>x.pages),[86,2026]);
 assert.deepEqual(actual.map(x=>x.sha256),[
  'bea831ff7e8a9c51f388641012189af7c72cc2155e21de66717a6331f9a7b7b4',
  'fdc77ecf62de6f56ae33915105316f26f2f7c60765b9296dddf14d94c9f9584c'
 ]);
 assert.ok(actual.every(x=>x.url.startsWith('https://www.senate.mn/journals/2023-2024/')));
});
test('May7 printed 16488 and May19 printed 20020/20021 are 3 different HF5247 vote sections with Hawj named in YES, not attendance or proxy',()=>{
 const a=receipt.exactOfficialPrimaryJournalSources.flatMap(x=>x.namedHF5247RollCalls.map(v=>({date:x.date,...v})));
 assert.equal(a.length,3);
 assert.deepEqual(a.map(x=>x.event),['third_reading_passage','conference_report','third_reading_amended']);
 assert.deepEqual(a.map(x=>[x.aggregateYeas,x.aggregateNays]),[[55,10],[34,12],[34,14]]);
 assert.deepEqual(a.map(x=>x.printedJournalPageWhereRollCallBegins),[16488,20020,20021]);
 assert.deepEqual(a.map(x=>x.sourcePdfPageOneBased),[57,2022,2023]);
 assert.ok(a.every(x=>x.name==='Foung Hawj'));
 assert.ok(a.every(x=>x.individualVoteOnThisHF5247RollCall==='yea'));
 assert.ok(a.every(x=>x.journalPersonallyListedInAffirmativeSection&&!x.journalPersonallyListedInNegativeSection));
 assert.ok(a.every(x=>x.exactHF5247BillContext&&x.sourceOriginalPdfExactSha256Proved));
 assert.ok(a.every(x=>x.originalJournalSectionDistinguishesFromAttendanceAndRule40Proxy));
 assert.ok(a.every(x=>x.noSF3250SF3257SF4056IndividualVoteCertified));
 assert.ok(a.every(x=>x.sourceContextCharactersBeforeRoll<9000));
});
test('original written March 24 source is identical to independently authenticated #1216 and earlier #1220 anchor',()=>{
 const prior=originalHawjSource();
 const h=receipt.priorAuthenticatedPreVoteHistoricWrittenHawjPolicySource;
 const o=originalQuote.sources.find(x=>x.senator==='Foung Hawj'&&x.sourceHistoricalArchiveUtc==='2024-03-24T19:01:09Z');
 assert.equal(prior.originalUtc,h.earliestSourceVerifiedCaptureUtc);
 assert.equal(prior.originalSha256,h.rawHistoricalOriginalHtmlSha256);
 assert.equal(prior.url,h.firstPartyOriginalUrl);
 assert.equal(h.rawHistoricalOriginalHtmlSha256,o.rawOriginalHttpHtmlSha256);
 assert.equal(h.officialMinnesotaLegislativeMemberHistoryUrl,o.officialMemberHistoryUrl);
 assert.deepEqual(h.namedProposalTopicBills,['SF 4056','SF 3257','SF 3250']);
 assert.equal(h.ownNamedBoundedWrittenPolicyStatement,true);
 assert.equal(h.earliestWrittenPolicyStatementNotFirstPublisherPostingClock,true);
 assert.equal(bridge.totals.senateJournalOriginalHawjIndividualBallotsVerified,0);
});
test('zero policy-specific standalone SF votes and zero forecast-ready labels despite 3 authenticated omnibus Hawj YES votes',()=>{
 const n=receipt.counts,b=receipt.hardLimits;
 assert.equal(n.exactOriginalOfficialSenateJournalPdfUrlsAttempted,2);
 assert.equal(n.originalOfficialJournalPdfsIndependentlyDownloadedSha256HashedAndParsed,2);
 assert.equal(n.distinctHF5247IndividualRollCallsPersonallyListingHawjYes,3);
 assert.equal(n.individualHawjNayVotesIdentifiedForThoseEvents,0);
 assert.equal(n.may7OriginalJournalIndividualYeaConfirmed,1);
 assert.equal(n.may19ConferenceOriginalJournalIndividualYeaConfirmed,1);
 assert.equal(n.may19SeparateAmendedThirdReadingOriginalJournalIndividualYeaConfirmed,1);
 assert.equal(n.relatedStandaloneHawjSFPolicyVotesCertified,0);
 assert.equal(n.currentAsOfRelevantBillTextSectionsIndependentlyAuthenticated,0);
 assert.equal(n.predictionEligibleSourceToIssueVoteTrainingLabelsApproved,0);
 assert.equal(b.eachMemberOmnibusYeaDoesNotProveAllThreeIndividualSFSponsorshipVotes,true);
 assert.equal(b.completeFirstPartyLegislativeProvisionVersionAtMay7OrMay19Unproved,true);
 assert.equal(b.fourthEngrossmentPostedAfterMay19CannotServeAsAsOfVoteText,true);
 assert.equal(b.noneOfThreeRollCallsIsForecastOutput,true);
});
test('source provenance and privacy guard: original PDF and full extracted journal not persisted or treated as historic source prior to vote',()=>{
 assert.equal(receipt.exactOfficialPrimaryJournalSources.length,2);
 for(const j of receipt.exactOfficialPrimaryJournalSources){
  assert.equal(j.PDFDownloadedAndHashedBeforeParsing,true);
  assert.equal(j.publicOriginalOfficialJournalRollCallStatus,'official_journal_pdf_sha256_authenticated_and_tail_text_inspected');
  assert.equal(j.rawPdfOrExtractedJournalTextCommitted,false);
  assert.ok(j.selectedTailPdfPageRangeOneBased.inspected<=45);
 }
 const b=receipt.hardLimits;
 assert.equal(b.officialJournalMay7SourceIsDay113May7,true);
 assert.equal(b.officialJournalMay19SourceIsDay119May19,true);
 assert.equal(b.journalNameInCorrectYeasListNotAttendanceRollOrRule40Proxy,true);
 assert.equal(b.chamberTalliesSeparatelyMatched55_10_34_12_34_14,true);
 assert.equal(b.officialMay19ConferenceAndThirdReadingTwoDifferentVoteEvents,true);
 assert.equal(b.historicalPolicyWrittenSourcePrecedesBothMayVoteDates,true);
 assert.equal(b.noRestrictedVotePredictSourceExportOrProductionDbUsed,true);
 assert.equal(b.noPublicPdfOrExtractedFullJournalTextSavedInRepo,true);
 assert.equal(b.noStoredVoteLabelsProductionCollectorIngestDatabaseServingModelOrForecastChanged,true);
});
