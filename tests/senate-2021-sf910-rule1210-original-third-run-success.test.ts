import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const proof=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-2021-sf910-rule1210-original-third-run-success.json','utf8'
));
test('third original SF910 named committee roll succeeds, first two failures remain immutable',()=>{
 assert.equal(proof.issue,864);
 const original=proof.originalPublishedJournal;
 const previous=proof.earlierGenuineFailureHistoryUnchanged;
 const forensic=proof.independentOriginalNameRedactedForensic;
 const success=proof.successfulThirdActualOriginalCertification;
 assert.equal(original.bill,'SF910');
 assert.equal(original.committee,'Housing Finance and Policy');
 assert.equal(original.journalReportDate,'2021-03-08');
 assert.equal(original.journalPage,714);
 assert.deepEqual([original.printedYea,original.printedNay,original.printedAbsent],[4,3,null]);
 assert.equal(original.distinctFromDifferentOriginalBillWithSameMemberSides,'SF1470');
 assert.equal(original.originalPDFBytes,827244);
 assert.equal(previous.firstRunConclusion,'failure');
 assert.equal(previous.secondRunConclusion,'failure');
 assert.equal(previous.earlierFailuresNotRetroactivelyReclassified,true);
 assert.equal(forensic.isNotNamedRollCertification,true);
 assert.equal(success.originalSourceRunId,38170146543);
 assert.equal(success.actualRunConclusion,'success');
 assert.equal(success.originalNamedCommitteeRollCertified,true);
 assert.equal(success.originalSourceErrorCount,0);
 assert.equal(success.independentlyDownloadedZipBytes,1343);
 assert.equal(success.independentlyDecodedJsonBytes,2524);
 assert.notEqual(previous.firstDownloadedZipSHA256,success.independentlyDownloadedZipSHA256);
 assert.notEqual(previous.secondDownloadedZipSHA256,success.independentlyDownloadedZipSHA256);
 for(const sha of [
  original.originalPDFSHA256,original.extractedOriginalPDFTextSHA256,
  original.originalMotionContextSHA256,original.originalMemberSideSHA256Only.yea,
  original.originalMemberSideSHA256Only.nay,previous.earlierFailedJsonSHA256,
  forensic.downloadedArtifactZIPSHA256,forensic.decodedJSONSHA256,
  success.independentlyDownloadedZipSHA256,success.independentlyDecodedJsonSHA256
 ])assert.match(sha,/^[0-9a-f]{64}$/);
 assert.equal(proof.limitations.missingPrintedAbsentCountMustRemainNull,true);
 assert.equal(proof.limitations.noProductionDatabaseReadsWrites,true);
 assert.equal(proof.limitations.noStoredPrivateVoteRowParityOrBackfill,true);
 assert.equal(proof.limitations.issue864MustRemainOpen,true);
});
