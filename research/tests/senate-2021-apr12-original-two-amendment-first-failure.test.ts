import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {APR12_THREE_STRICT_ORIGINAL as SOURCE} from
 '../../src/evidence/senate-2021-apr12-three-strict-original-committee-amendments.js';
const failure=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-2021-apr12-two-original-amendments-first-run-failure.json','utf8'
));
const earlier=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-2021-apr12-sf1159-sf970-original-redacted-layout-success.json','utf8'
));
test('Retired two-motion probe failure compared against authoritative three-motion source SHA',()=>{
 const correct='dda780e4fc076f56ff9f271303ba81897b69813acfece416b7741aea64c41214';
 assert.equal(SOURCE.originalEmbeddedTextSHA256,correct);
 assert.equal(earlier.original.originalExtractedTextSHA256,correct);
 assert.equal(failure.correctOriginalSHARecheckedAgainstIndependentPriorOriginal.bothPreviouslyExtractedOriginalTextSHA256,correct);
 assert.equal(failure.firstOriginalStrictProvisionalSideRun.originalEmbeddedTextSHA256,correct);
 assert.notEqual(failure.firstOriginalStrictProvisionalSideRun.scriptPreviouslyExpectedTextSHA256WithTranscriptionError,correct);
 assert.equal(SOURCE.originalPDFSHA256,failure.firstOriginalStrictProvisionalSideRun.originalPdfSHA256);
 assert.equal(earlier.original.originalPdfSHA256,SOURCE.originalPDFSHA256);
});
test('the real failed original source run remains failure, with no named-side evidence invented',()=>{
 const run=failure.firstOriginalStrictProvisionalSideRun;
 assert.equal(run.originalRunId,38172259470);
 assert.equal(run.actualRunConclusion,'failure');
 assert.equal(run.originalPDFObtained,true);
 assert.equal(run.sourceNoProvisionalSideDigestComputed,true);
 assert.equal(run.namedHistoricalVoterSidesNOTCertified,true);
 assert.equal(run.independentlyDownloadedZIPBytes,794);
 assert.equal(run.independentlyDecodedJSONBytes,1123);
 assert.match(run.independentlyDownloadedZIPSHA256,/^[a-f0-9]{64}$/);
 assert.match(run.independentlyDecodedJSONSHA256,/^[a-f0-9]{64}$/);
 assert.equal(failure.limits.failureRemainsFailureDespiteCodeFix,true);
 assert.equal(failure.limits.newSourceRetryRequired,true);
 assert.equal(failure.limits.issue864MustRemainOpen,true);
});
