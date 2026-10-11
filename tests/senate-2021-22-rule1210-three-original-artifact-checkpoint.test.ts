import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const proof=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-2021-22-rule1210-sf1-sf2909-special-sf9-two-original-success-one-failure.json','utf8'
));
test('original 2021 SF1 and 2022 SF2909 both independently SHA-authenticated without inventing meeting dates',()=>{
 assert.equal(proof.issue,864);
 assert.equal(proof.certifiedOriginalRolls,2);
 assert.equal(proof.genuineOriginalRunsFailed,1);
 assert.equal(proof.originalSourceRuns.length,3);
 const sf1=proof.originalSourceRuns.find((x:{key:string})=>x.key==='sf1');
 const sf2909=proof.originalSourceRuns.find((x:{key:string})=>x.key==='sf2909');
 const sf9=proof.originalSourceRuns.find((x:{key:string})=>x.key==='sf9ss1');
 assert.ok(sf1&&sf2909&&sf9);
 for(const row of [sf1,sf2909]){
  assert.equal(row.originalRunConclusion,'success');
  assert.equal(row.namedRollOriginalSourceCertified,true);
  assert.equal(row.sourceFailures,0);
  assert.equal(row.printedAbsent,null);
  assert.ok(row.resultNormalizedTextOffset>row.motionNormalizedTextOffset);
  for(const digest of [
   row.binarySHA256,row.originalEmbeddedTextSHA256,
   row.independentlyDownloadedZipSHA256,row.independentlyDecodedJsonSHA256,
   row.motionContextSHA256,row.identityBySideSHAOnly.yea,row.identityBySideSHAOnly.nay
  ])assert.match(digest,/^[a-f0-9]{64}$/);
 }
 assert.equal(sf1.bill,'SF1');
 assert.equal(sf1.journalReportDate,'2021-02-11');
 assert.equal(sf1.printedYea,5);
 assert.deepEqual(sf1.distinctSameChoicesAsDifferentMotions,['SF2','SF450']);
 assert.equal(sf2909.bill,'SF2909');
 assert.equal(sf2909.session,'2022 regular');
 assert.equal(sf2909.journalReportDate,'2022-02-24');
 assert.equal(sf2909.originalIndexNamed2021DespiteReportYear2022,true);
 assert.notEqual(sf1.binarySHA256,sf2909.binarySHA256);
 assert.notEqual(sf1.independentlyDownloadedZipSHA256,sf2909.independentlyDownloadedZipSHA256);
 assert.equal(proof.limits.sourceJournalReportDayNotIndependentlyProvenMotionMeetingDate,true);
 assert.equal(proof.limits.noPrivateDatabaseStoredMemberVotesComparedOrChanged,true);
 assert.equal(proof.limits.issue864MustRemainOpen,true);
 assert.equal(proof.limits.noStatewideCommitteeDenominator,true);
});
test('genuine original special-session SF9 PDF acquired but named-roll parser failure never certified',()=>{
 const row=proof.originalSourceRuns.find((x:{key:string})=>x.key==='sf9ss1');
 assert.equal(row.originalRunConclusion,'failure');
 assert.equal(row.namedRollOriginalSourceCertified,false);
 assert.equal(row.sourceFailures,1);
 assert.equal(row.originalSourceRunId,38168831620);
 assert.match(row.sourceOriginalParserFailure,/strict adjacent/i);
 assert.equal(row.exactMotion,'second portion of Marty division of Pratt amendment to SF9');
 assert.equal(row.uniqueSpecialSessionAmendmentNotWholeBillPassage,true);
 assert.equal(row.printedAbsent,null);
 assert.match(row.binarySHA256,/^[a-f0-9]{64}$/);
 assert.match(row.independentlyDownloadedZipSHA256,/^[a-f0-9]{64}$/);
 assert.match(row.independentlyDecodedJsonSHA256,/^[a-f0-9]{64}$/);
 assert.equal(proof.limits.originalSF9RunFailureNotRetroactivelySuccess,true);
});
