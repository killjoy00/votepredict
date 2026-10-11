import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const p=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-2021-state-government-mar10-sf450-online-original-success.json','utf8'
));
test('exact original public 2021 Senate online HTML and genuine success artifact immutable',()=>{
 assert.equal(p.schemaVersion,'senate-2021-state-government-mar10-sf450-online-original-source-success-v1');
 assert.equal(p.issue,864);
 assert.equal(p.historicalHearingDate,'2021-03-10');
 assert.equal(p.bill,'SF450');
 assert.equal(p.source.senateHearingId,16146);
 assert.equal(p.source.originalOnlineHtmlBytes,73656);
 assert.equal(p.source.originalOnlineHtmlSHA256,
  '5f21d06bd06fd9d71bd91c7dcd897692cafe5d166c21216f67fb215854674ee1');
 const q=p.provenance;
 assert.equal(q.sourceRunnerPR,1087);
 assert.equal(q.sourceRunnerMergeSHA,'4c58093389fd031cd3d418fe1726d51428098682');
 assert.equal(q.sourceRunId,38160308868);
 assert.equal(q.sourceRunConclusion,'success');
 assert.equal(q.sourceFailures,0);
 assert.equal(q.artifactId,11710021221);
 assert.equal(q.artifactName,'senate-2021-mar10-sf450-original-online-source');
 assert.equal(q.artifactZipBytes,1756);
 assert.equal(q.independentlyDownloadedOriginalArtifactZIPSHA256,
  '3e53817e0c61ff7bfd15d41d71d9e2b22801f069f26b92609d311c53c65578a7');
 assert.equal(q.originalDecodedJsonEntry,'sf450-original-online-named-roll-5-3.json');
 assert.equal(q.originalDecodedJsonBytes,3202);
 assert.equal(q.independentlyDownloadedOriginalJsonSHA256,
  'bd247a7d2256521d3b12d0d06925e3da4761a35d8cb21c29390da9448b8619b3');
});
test('one motion, one eight-member named roll and no fabricated absentee',()=>{
 const x=p.motion;
 assert.equal(x.mover,'Osmek');
 assert.equal(x.requestedNamedRoll,'Carlson');
 assert.equal(x.committeeRecommendation,'Pass and re-refer to Finance');
 assert.deepEqual([x.yesCount,x.noCount,x.absentMemberCountPrinted],[5,3,null]);
 assert.equal(x.reportedResult,'motion prevailed');
 assert.equal(x.everyPrintedNamedYesNoChoiceValidatedInEightMemberPartition,true);
 assert.equal(x.oneOriginalNamedRollParagraph,true);
 assert.equal(x.oneLaterRepetitiveRecommendationRecap,true);
 assert.equal(x.laterRecapDoesNotCreateSecondRecordedVote,true);
 assert.deepEqual([x.introOriginalNormalizedTextOffset,x.originalResultEndNormalizedTextOffset],
  [5357,5632]);
 assert.equal(x.originalNeighborhoodSHA256,
  '6c26b3e2dfafd5cb7339f8ec28a1ba021408d04b58d00b68afc494af56dcb460');
 assert.equal(x.originalPreVoteSHA256,
  '31c3c656a72fe5ffbf04cf43292f6ad01a48460bfe011520a39acc231165cbcf');
});
test('2021 print official record remains unreviewed; no production member votes',()=>{
 assert.equal(p.source.originalPrintMinutesIndependentlyCompared,false);
 for(const [key,value] of Object.entries(p.holds))
  assert.equal(value,true,key);
});
