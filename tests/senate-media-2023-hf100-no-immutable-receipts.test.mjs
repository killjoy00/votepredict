import test from 'node:test';
import assert from 'node:assert/strict';
import receipt from '../docs/evaluation/senate-media-2023-hf100-no-primary-20261012.json' with {type:'json'};
import {VERSION,JOURNAL,LEADS,allowed} from '../scripts/probe-senate-media-2023-hf100-no-originals.mjs';

const JOURNAL_ORIGINAL={
 url:'https://www.senate.mn/journals/2023-2024/20230428059.pdf',
 fullHash:'9e8160e4c78ef70cc0635226201f12e656ac84a999af8e0a8f8dc3e6737791a3',
 bytes:4472460,pages:292,printedPage:6890,pdfPage:290
};
const EXACT_PUBLISHER=[
 ['Gary Dahms','2023-03-27T23:22:22Z','U6AGAN3WS5JI3KDBQG7UPCYI5CNRMTAY',
  '0db73702a497b3a6859ec265fae9d97b9a8e0df3a618d58171c62cbd63db6b5f',84459,
  '6a88b0eb34b8a45c12a05d67d8113813fa5d1603f55073b7085ee29ae72b58f2',106],
 ['Glenn Gruenhagen','2023-03-19T11:54:13Z','ZMGG3NCOOTVKSASEOVQCNK7HST4VHQ3Y',
  'acb3b8b3042a42206e96a92a3687dc153e06e032166cbaa4cb55beaabbcbac3a',84417,
  '4a498ae455f8f898d0e6f2d33820b6be249db79f391156a805067402d934c468',91]
];
function verifyPinned(o){
 assert.equal(o.version,'track-d-2023-hf100-two-authenticated-original-statement-to-named-no-receipts-v1');
 assert.equal(o.originalOfficialSenateJournal.rawFullPdfSha256,JOURNAL_ORIGINAL.fullHash);
 assert.equal(o.originalOfficialSenateJournal.entireOriginalPdfBytes,JOURNAL_ORIGINAL.bytes);
 assert.equal(o.originalOfficialSenateJournal.totalOriginalPdfPages,JOURNAL_ORIGINAL.pages);
 assert.equal(o.historicalPublisherOriginals.length,2);
 for(let i=0;i<2;i++){
  const c=o.historicalPublisherOriginals[i],p=EXACT_PUBLISHER[i];
  assert.deepEqual([c.senator,c.earliestAuthenticatedOriginalCaptureUtc,c.independentlyIndexedOriginalSha1Base32,
   c.downloadedRawOriginalHtmlSha256,c.rawOriginalHtmlBytes,c.normalizedBoundedSpeakerStatementSha256,
   c.normalizedBoundedSegmentCharacters],p);
 }
 return true;
}
test('two first-party 2023 original publisher article receipts are literal immutable evidence, not fixture output',()=>{
 assert.equal(verifyPinned(receipt),true);
 assert.equal(VERSION,'track-d-2023-hf100-individual-no-public-original-audit-v1');
 assert.equal(allowed(),true);
});
test('source provenance pins two successful prior complete LIVE CI reruns and PR head',()=>{
 const p=receipt.provenance;
 assert.equal(p.issue,987);assert.equal(p.pr,1254);
 assert.equal(p.firstWholeJournalAndPublisherOriginalLiveCI,38306090967);
 assert.equal(p.firstNamedSpeakerBoundaryAndWholeOriginalCI,38306925130);
 assert.equal(p.sourceHead,'542eb8be61159848efedb884729b79c0368c3ab5');
 assert.equal(p.fullCIOnSourceHeadPassed,2913);
 assert.equal(p.fullCIOnSourceHeadFailed,0);
});
test('entire official 292 page April28 Senate Journal original hash, byte length and exact vote page identity pinned',()=>{
 const j=receipt.originalOfficialSenateJournal;
 assert.deepEqual([j.originalJournalUrl,j.rawFullPdfSha256,j.entireOriginalPdfBytes,j.totalOriginalPdfPages,
  j.printedJournalPage,j.originalPdfPageOneBased],[JOURNAL_ORIGINAL.url,JOURNAL_ORIGINAL.fullHash,
  JOURNAL_ORIGINAL.bytes,JOURNAL_ORIGINAL.pages,JOURNAL_ORIGINAL.printedPage,JOURNAL_ORIGINAL.pdfPage]);
 assert.equal(j.finalPassageBill,'HF100');assert.equal(j.notDirectFinalPassageBill,'SF73');
 assert.deepEqual([j.yeas,j.nays],[34,33]);
 assert.equal(j.legislativeDay,59);assert.equal(JOURNAL.url,j.originalJournalUrl);
});
test('actual final-passage NAY member names personally printed, not absent YES or proxy or motion',()=>{
 const r=receipt.originalOfficialSenateJournal.namedNegativeRosterMembers;
 assert.deepEqual(r.map(x=>[x.senator,x.vote]),[['Gary Dahms','nay'],['Glenn Gruenhagen','nay']]);
 for(const x of r){assert.equal(x.inOriginalPrintedNegativeRoster,true);
  assert.equal(x.inOriginalPrintedAffirmativeRoster,false);assert.equal(x.finalPassageNotAdjacentMotion,true);
  assert.equal(x.notRule40Only,true);}
});
test('source 1 Dahms original index digest and complete body identity, original close-named quote',()=>{
 const a=receipt.historicalPublisherOriginals[0],p=EXACT_PUBLISHER[0];
 assert.deepEqual([a.senator,a.earliestAuthenticatedOriginalCaptureUtc,
  a.independentlyIndexedOriginalSha1Base32,a.downloadedRawOriginalHtmlSha256,a.rawOriginalHtmlBytes,
  a.normalizedBoundedSpeakerStatementSha256,a.normalizedBoundedSegmentCharacters],p);
 assert.equal(a.exactPublisherUrl,LEADS[0].url);
 assert.equal(a.attributionProof,'closed_original_first_party_quotation_followed_by_full_senator_name');
 assert.equal(a.statementScope,'specific_previous_SF73_cannabis_bill_opposition');
 assert.equal(a.officialSenateService,'https://www.lrl.mn.gov/legdb/fulldetail?ID=15326');
});
test('source 2 Gruenhagen independently published and originally signed opposition NOT exact bill-number quote',()=>{
 const a=receipt.historicalPublisherOriginals[1],p=EXACT_PUBLISHER[1];
 assert.deepEqual([a.senator,a.earliestAuthenticatedOriginalCaptureUtc,
  a.independentlyIndexedOriginalSha1Base32,a.downloadedRawOriginalHtmlSha256,a.rawOriginalHtmlBytes,
  a.normalizedBoundedSpeakerStatementSha256,a.normalizedBoundedSegmentCharacters],p);
 assert.equal(a.exactPublisherUrl,LEADS[1].url);
 assert.equal(a.attributionProof,'first_person_named_headline_with_original_signed_glenn_closing');
 assert.equal(a.statementScope,'general_recreational_marijuana_legalization_opposition_no_bill_number');
 assert.equal(a.officialSenateService,'https://www.lrl.mn.gov/legdb/fulldetail?ID=15350');
});
test('both original dates unambiguously before April28, and current publisher Feb10 display is NOT their authenticated source cutoff',()=>{
 for(const a of receipt.historicalPublisherOriginals){
  assert.equal(a.displayedPublisherDay,'2023-02-10');
  assert.ok(a.earliestAuthenticatedOriginalCaptureUtc<'2023-04-28T00:00:00Z');
  assert.equal(a.originalCaptureBeforeFinalVote,true);
  assert.equal(a.exactApril28FloorAmendedHF100StatementIdentityUnproven,true);
  assert.equal(a.notWholeHumanApprovedVerbatimSpeech,true);
 }
 assert.equal(receipt.holds.firstSourceFeb10PostingMinuteNotVerified,true);
 assert.equal(receipt.holds.currentPublisherVersionNeverUsedAs2023Proof,true);
});
test('two distinct source URLs and persons do not count archive versions as additional original speakers',()=>{
 assert.equal(new Set(receipt.historicalPublisherOriginals.map(x=>x.exactPublisherUrl)).size,2);
 assert.equal(new Set(receipt.historicalPublisherOriginals.map(x=>x.senator)).size,2);
 assert.equal(receipt.totals.distinctPublisherArticleUrls,2);
 assert.equal(receipt.totals.verifiedOriginalPublisherVersionsCounted,2);
 assert.equal(receipt.totals.uniqueSenators,2);
 assert.equal(receipt.totals.individuallyBoundedAuthenticOriginalPrintedPositions,2);
});
test('two direct named NO results, one SF73 companion-specific and one broad topic control, no cross-party',()=>{
 const c=receipt.researchEvidencePairs;
 assert.equal(c.length,2);
 assert.deepEqual(c.map(x=>[x.senator,x.voteBill,x.personalVote]),[
  ['Gary Dahms','HF100','nay'],['Glenn Gruenhagen','HF100','nay']]);
 assert.deepEqual(c.map(x=>x.role),[
  'primary_bill_specific_statement_contemporaneously_earlier','supporting_broad_issue_control']);
 assert.ok(c.every(x=>x.productionTrainingLabelApproved===false));
 assert.equal(receipt.totals.historicalPreVoteStatementToOfficialNamedNoResearchPairs,2);
 assert.equal(receipt.totals.crossPartyComparisonPairs,0);
});
test('strict source and identity hold, no private data, model, training, full quotation or audio inferred',()=>{
 const h=receipt.holds;
 assert.equal(h.SF73IsCompanionNotApr28RecordedDirectPassageBill,true);
 assert.equal(h.GruenhagenNoExactBillNumberInStatement,true);
 assert.equal(h.exactHF100FloorAmendmentVersionAndMinuteUnproven,true);
 assert.equal(h.noPrivateAsOfProductionIngestionChecked,true);
 assert.equal(h.completeOriginalSenatorVerbatimUtteranceNotHumanApproved,true);
 assert.equal(h.originalAudioNotAuthenticated,true);
 assert.equal(h.noTrainingLabelsOrModelForecastsOrStoredVotesChanged,true);
 assert.equal(h.noRawCopyrightedPublisherHtmlOrGovernmentPdfCommitted,true);
 assert.equal(receipt.totals.productionTrainingLabelsApproved,0);
 assert.equal(receipt.totals.fullAutomatedProductionOrHistoricalForecastBacktestsRun,0);
});
test('mutations of immutable originals, speaker quote digests, page counts or member list fail closed',()=>{
 for(const edit of [
  d=>d.originalOfficialSenateJournal.rawFullPdfSha256='0'.repeat(64),
  d=>d.originalOfficialSenateJournal.entireOriginalPdfBytes=2,
  d=>d.originalOfficialSenateJournal.totalOriginalPdfPages=290,
  d=>d.historicalPublisherOriginals[0].downloadedRawOriginalHtmlSha256='f'.repeat(64),
  d=>d.historicalPublisherOriginals[1].independentlyIndexedOriginalSha1Base32='A'.repeat(32),
  d=>d.historicalPublisherOriginals[1].normalizedBoundedSpeakerStatementSha256='a'.repeat(64),
  d=>d.historicalPublisherOriginals[0].earliestAuthenticatedOriginalCaptureUtc='2023-05-01T00:00:00Z',
  d=>d.historicalPublisherOriginals.pop()
 ]){const d=structuredClone(receipt);edit(d);assert.throws(()=>verifyPinned(d));}
});

test('separate unselected 2023-04-25 archive capture hash mismatch remains UNKNOWN, not a third speaker event',()=>{
 assert.equal(receipt.holds.unselectedGruenhagenApril25OriginalIndexedReplayMismatchQuarantinedUnknownNotCounted,true);
 const q=receipt.unselectedArchiveReplayObservations;
 assert.equal(q.length,1);
 assert.equal(q[0].senator,'Glenn Gruenhagen');
 assert.equal(q[0].captureUtc,'2023-04-25T22:47:57Z');
 assert.equal(q[0].observedStatus,'original_archive_index_digest_mismatch_unknown');
 assert.equal(q[0].countAsIndependentlyAuthenticatedHistoricalOriginal,false);
 assert.equal(q[0].doesNotInvalidateSeparatelyReauthenticatedMarch19Original,true);
 assert.equal(receipt.totals.verifiedOriginalPublisherVersionsCounted,2);
});
