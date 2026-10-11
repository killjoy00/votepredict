import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const proof=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-2021-special1-sf9-original-rule1210-second-run-success.json','utf8'
));
test('SF9 source path keeps genuine original failure, redacted diagnostic and new success distinct',()=>{
 assert.equal(proof.issue,864);
 const source=proof.originalPublication;
 const old=proof.originalFirstStrictSourceRunPreservedFailure;
 const diagnostic=proof.originalNameRedactedDiagnostic;
 const newer=proof.newSecondStrictNamedRollAuthentication;
 assert.equal(source.bill,'SF9');
 assert.equal(source.committee,'Finance');
 assert.equal(source.journalReportDay,'2021-06-21');
 assert.equal(source.printedJournalPage,156);
 assert.equal(source.exactMotion,'second portion of Marty division of Pratt amendment to SF9');
 assert.equal(source.result,'amendment adopted');
 assert.deepEqual([source.printedYea,source.printedNay,source.printedAbsent],[6,4,null]);
 assert.equal(old.runId,38168831620);
 assert.equal(old.conclusion,'failure');
 assert.equal(old.initialFailureIsNotReclassifiedAsSuccess,true);
 assert.equal(diagnostic.runId,38169272335);
 assert.equal(diagnostic.conclusion,'success');
 assert.equal(diagnostic.isNotNamedVoteCertification,true);
 assert.equal(newer.originalSourceRunId,38169878366);
 assert.equal(newer.actualRunConclusion,'success');
 assert.equal(newer.strictOriginalNamedCommitteeRollCertified,true);
 assert.equal(newer.originalSourceErrorCount,0);
 assert.notEqual(old.independentlyDownloadedZipSHA256,
  newer.independentlyDownloadedZIPSHA256);
 assert.notEqual(diagnostic.independentlyDownloadedZipSHA256,
  newer.independentlyDownloadedZIPSHA256);
 for(const sha of [
  source.originalPdfSHA256,source.originalEmbeddedTextSHA256,
  source.sourceMotionNeighborhoodSHA256,
  source.individualNameBySideSHA256Only.yea,source.individualNameBySideSHA256Only.nay,
  old.independentlyDownloadedZipSHA256,old.independentlyExtractedJsonSHA256,
  diagnostic.independentlyDownloadedZipSHA256,diagnostic.independentlyDecodedJsonSHA256,
  newer.independentlyDownloadedZIPSHA256,newer.independentlyDecodedJSONSHA256
 ])assert.match(sha,/^[a-f0-9]{64}$/);
 assert.equal(source.originalPdfBytes,1971941);
 assert.equal(old.zipBytes,878);
 assert.equal(diagnostic.zipBytes,990);
 assert.equal(newer.independentlyDownloadedZIPBytes,1396);
 assert.equal(newer.independentlyDecodedJSONBytes,2678);
 assert.equal(proof.limits.noPrivateProductionDatabaseReadsWritesOrBackfill,true);
 assert.equal(proof.limits.specialSessionSF9OutsideRegularSessionRule1210Index,true);
 assert.equal(proof.limits.issue864MustRemainOpen,true);
});
