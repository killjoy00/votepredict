import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const d=JSON.parse(readFileSync('data/evaluation/senate-864-bonding-four-conditional-statements-original-hf669-hf670-personal-rolls-v1.json','utf8'));
const sha=/^[0-9a-f]{64}$/;
test('four actual Minnesota senators and three separate original bill-action identities',()=>{
 assert.equal(d.schema,'senate-864-bonding-2023-four-senator-conditions-and-original-rolls-v1');
 assert.deepEqual(d.bySenator.map(x=>x.officialName),['Mark T. Johnson','Karin Housley','Bill Weber','Nathan Wesenberg']);
 assert.deepEqual(d.eventJournals.map(x=>[x.bill,x.date,x.yeas,x.nays]),[
  ['HF669','2023-03-16',33,32],['HF669','2023-05-22',56,11],['HF670','2023-05-22',35,14]]);
});
test('two complete independently original SHA256 pinned government Senate Journals, 3 different rolls',()=>{
 const m=new Set(d.eventJournals.map(x=>x.sha256));
 assert.equal(m.size,2);
 for (const p of d.eventJournals){
  assert.match(p.sha256,sha);
  assert.ok(p.pages>=160);
  assert.ok(Number.isSafeInteger(p.rawBytes)&&p.rawBytes>=2_000_000);
  assert.ok(p.rollPageOneBased>0&&p.rollPageOneBased<=p.pages);
 }
 assert.equal(d.senateOriginalJournalAudit.primaryJournalPdfs,2);
});
test('all four independently named March16 NAY are NOT a party-level or proxy vote inference',()=>{
 const votes=d.bySenator.map(x=>x.verifiedVotes[0]);
 assert.ok(votes.every(x=>x.eventId==='senate-hf669-march16-failed'&&x.senatorChoice==='NAY'));
 assert.ok(votes.every(x=>x.proof==='exact_named_list_from_original_Senate_Journal_correct_third_reading'));
});
test('three NAY to YEA and one still NAY in actual May22 amended HF669',()=>{
 assert.deepEqual(d.bySenator.map(x=>x.verifiedVotes[1].senatorChoice),['YEA','YEA','YEA','NAY']);
 assert.deepEqual(d.bySenator.map(x=>x.knownVoteChangeOnHF669),['NAY_TO_YEA','NAY_TO_YEA','NAY_TO_YEA','NO_RECORDED_CHANGE']);
 assert.equal(d.summary.naysToYeasInHF669,3);
 assert.ok(d.bySenator.every(x=>x.sameBillNumberDifferentFloorAmendedTextsMustNotBeConflated));
});
test('May22 HF670 unidentified Housley Weber choices quarantined as UNKNOWN, never absent = Nay',()=>{
 const b=d.bySenator.map(x=>x.verifiedVotes[2]);
 assert.deepEqual(b.map(x=>x.senatorChoice),['NAY','UNKNOWN','UNKNOWN','NAY']);
 for (const x of b.filter(x=>x.senatorChoice==='UNKNOWN'))assert.match(x.proof,/unproven_UNKNOWN/);
 assert.equal(d.summary.may22HF670NamedUnknown,2);
});
test('three independently full-original-authenticated personally named policy quotes before both HF669 decisions',()=>{
 const q=d.sourceOriginalFullDocumentAndQuoteProof;
 assert.equal(q.speaker,'Mark T. Johnson');
 assert.match(q.wholeRawHtmlSha256,sha);
 assert.match(q.selectedBoundedNamedQuoteSha256,sha);
 assert.equal(q.originalIndexedSha1Base32.length,32);
 assert.ok(q.independentlyAuthenticatedOriginalArchivePublicByUtc<'2023-03-16');
 assert.equal(d.summary.namedIndividualOriginalQuoteVerifiedBeforeMarch16,3);
 assert.equal(d.reverifiedThreeSpeakersRunId,38339711431);
 assert.equal(d.reverifiedThreeSpeakersReceiptArtifactId,11785918533);
 assert.equal(d.sourceOriginalThreeIndividuallyNamedQuoteProofs.length,3);
 assert.deepEqual(d.sourceOriginalThreeIndividuallyNamedQuoteProofs.map(x=>x.officialSenatorName),['Mark T. Johnson','Karin Housley','Bill Weber']);
 assert.ok(d.sourceOriginalThreeIndividuallyNamedQuoteProofs.every(x=>sha.test(x.boundedNormalizedQuoteSha256)));
 assert.equal(new Set(d.sourceOriginalThreeIndividuallyNamedQuoteProofs.map(x=>x.boundedNormalizedQuoteSha256)).size,3);
 assert.deepEqual(d.bySenator.map(x=>x.quoteSourceHistoricOriginalAuthenticated),[true,true,true,false]);
 assert.deepEqual(d.bySenator.map(x=>x.originalQuoteArchivePublicByUtc),['2023-03-07T22:07:14Z','2023-03-07T22:07:14Z','2023-03-07T22:07:14Z',null]);
});
test('collective March27 caucus compromise NOT four individually pledged support positions',()=>{
 const c=d.crossBillPolicyContext[0];
 assert.match(c.attribution,/organizational_collective/);
 assert.equal(c.firstIndependentlyAuthenticatedHistoricalPublicByUtc,null);
 assert.equal(c.mayNotBackdateCurrentArchivedCollection,true);
 assert.match(c.sourceMeaning,/HF669/);
 assert.match(c.sourceMeaning,/HF670/);
});
test('motivation of vote changes and source ingestion at prediction time explicitly unknown',()=>{
 assert.ok(d.bySenator.every(x=>x.whetherConditionalSourceExplainsVote==='UNKNOWN_NO_MOTIVE_INFERRED'));
 assert.ok(d.bySenator.every(x=>x.asOfProductionFeatureApproved===false));
 assert.equal(d.summary.sourceToVoteMatchedPositiveHistoricalBacktestEligibilityApproved,0);
 assert.equal(d.controls.noProductionDatabaseReadsWritesModelRetrainingOrDeployments,true);
});
