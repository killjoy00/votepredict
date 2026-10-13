import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const load=p=>JSON.parse(readFileSync(p,'utf8'));
const manifest=load('data/evaluation/senate-864-2023-hf669-five-official-text-versions-asof-research-v1.json');
const evidence=load('data/evaluation/senate-864-2023-hf669-five-authenticated-original-pdf-sha-lexical-differences-v1.json');
const bond=load('data/evaluation/senate-864-bonding-four-conditional-statements-original-hf669-hf670-personal-rolls-v1.json');
const sha=/^[0-9a-f]{64}$/;
test('five permanent exact HF669 original PDF version SHA receipts must match five canonical official URLs',()=>{
 assert.equal(evidence.issue,864);
 assert.equal(evidence.fullPdfOriginals.length,5);
 assert.equal(manifest.versionSources.length,5);
 const names=new Set();
 for(const [i,p] of evidence.fullPdfOriginals.entries()){
  const v=manifest.versionSources[i];
  assert.equal(p.id,v.id);
  assert.equal(p.officialFullPdfUrl,v.pdfUrl);
  assert.equal(p.listedDisplayDate,v.listedPostedDate);
  assert.match(p.wholeOfficialPdfRawSha256,sha);
  assert.ok(p.wholeRawOfficialPdfBytes>1_000_000);
  assert.ok(p.pdfPages>=60&&p.pdfPages<=100);
  assert.equal(p.rawPdfAndTextNotPersisted,true);
  assert.equal(p.historicalOriginalWebPublicByAtFloorVoteUtcUnproven,true);
  assert.equal(names.has(p.id),false);
  names.add(p.id);
 }
 assert.equal(new Set(evidence.fullPdfOriginals.map(x=>x.wholeOfficialPdfRawSha256)).size,5);
 assert.equal(evidence.sourceArtifactId,11786261922);
});
test('March and May particular official PDF originals are not collapsed into one generic HF669 text',()=>{
 const seq=evidence.lexicalComparisons;
 assert.equal(seq.length,5);
 const r=seq.find(x=>x.from==='second_unofficial_march16'&&x.to==='third_unofficial_may22');
 assert.ok(r);
 assert.equal(r.eightWordContiguousShingleJaccard,0.059);
 assert.equal(r.notALegalStatutoryLineByLineAmendmentDiff,true);
 assert.notEqual(evidence.fullPdfOriginals[2].wholeOfficialPdfRawSha256,evidence.fullPdfOriginals[3].wholeOfficialPdfRawSha256);
 assert.equal(evidence.noSelfReportedIndividualSenatorVoteMotivationProven,true);
});
test('never assert May 22 document published then when current source page states Aug 16',()=>{
 assert.equal(evidence.revisionAvailabilityConflicts.find(x=>x.version==='third_unofficial_may22').versionPageHeadingNotOriginalPublicByMinute,true);
 assert.equal(evidence.zeroNewProductionModelHistoricalSourceAsOfFeaturesApproved,true);
 assert.equal(manifest.sourceTextMayNotBeUsedForEarlierDecisionWithoutAsOfProof,true);
});
test('cross bill HF670 and HF3342 nursing home action cannot be interpreted as HF669 text',()=>{
 assert.equal(evidence.crossBillNegotiationScope.neverAttributeFundingInHF3342ToTextOfHF669,true);
 assert.equal(manifest.relatedButDistinctLegislativeDecisions[0].bill,'HF670');
 assert.equal(manifest.relatedButDistinctLegislativeDecisions[1].bill,'HF3342');
 for(const m of manifest.relatedButDistinctLegislativeDecisions)assert.equal(m.notLegallySameAsHF669,true);
 assert.equal(evidence.crossBillNegotiationScope.originalEveryChangedSectionAndFloorAmendmentCrosswalkStillPending,true);
});
test('three original statement quote digests from one article, only two bill votes for each of the three changing senators',()=>{
 assert.equal(bond.summary.namedIndividualOriginalQuoteVerifiedBeforeMarch16,3);
 assert.equal(bond.reverifiedThreeSpeakersRunId,38339711431);
 assert.equal(bond.sourceOriginalThreeIndividuallyNamedQuoteProofs.length,3);
 const valid=new Map(bond.sourceOriginalThreeIndividuallyNamedQuoteProofs.map(x=>[x.officialSenatorName,x.boundedNormalizedQuoteSha256]));
 assert.equal(valid.size,3);
 assert.ok([...valid.values()].every(x=>sha.test(x)));
 for(const x of bond.bySenator){
  assert.equal(x.quoteSourceHistoricOriginalAuthenticated,valid.has(x.officialName));
  assert.equal(x.originalQuoteArchivePublicByUtc,valid.has(x.officialName)?'2023-03-07T22:07:14Z':null);
 }
 assert.deepEqual(bond.bySenator.map(x=>x.verifiedVotes.slice(0,2).map(y=>y.senatorChoice)),
  [['NAY','YEA'],['NAY','YEA'],['NAY','YEA'],['NAY','NAY']]);
 assert.equal(bond.summary.sourceToVoteMatchedPositiveHistoricalBacktestEligibilityApproved,0);
});
