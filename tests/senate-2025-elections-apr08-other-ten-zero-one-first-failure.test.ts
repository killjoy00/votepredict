import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const p=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-2025-elections-apr08-other-ten-zero-one-original-first-failure-checkpoint.json','utf8'
));
test('original April 8 other-10-0-1 failure and bytes are permanently frozen',()=>{
 assert.equal(p.schemaVersion,
  'senate-2025-elections-apr08-other-10-0-1-original-first-failure-checkpoint-v1');
 assert.equal(p.issue,864);
 assert.equal(p.hearingDate,'2025-04-08');
 assert.equal(p.expectedPreviouslyAuthenticatedOriginalPdfSha256,
  'd26c583ef3e5caae1b52d379bf9c6cc784e0e9d39a80c056259f65f83f2e4c46');
 assert.equal(p.expectedPreviouslyAuthenticatedExtractedTextSha256,
  '6dc40628432da41be2ac4afe24b8725d5638e069421c4f413445042794411101');
 const a=p.actualFirstOriginalRun;
 assert.equal(a.runId,38156811715);
 assert.equal(a.sourceRunnerPR,1067);
 assert.equal(a.sourceRunnerMergeCommit,'9bd2514c0328712813e24d67f4b8deaa5acc0cf3');
 assert.equal(a.conclusion,'failure');
 assert.equal(a.originalArtifactId,11708731132);
 assert.equal(a.originalArtifactName,'senate-2025-apr08-original-second-ten-zero-one');
 assert.equal(a.independentlyDownloadedOriginalZipSha256,
  'eb117ca95cd419234c77df9a6cc829d17a3deebd4dad81744bf548a5dd15e7bd');
 assert.equal(a.originalArtifactZipBytes,900);
 assert.equal(a.uncompressedOriginalJsonSha256,
  '28b14c59e483899bf06a15857d7b05b32bd7350a50567065f6fc70bc9fb7654b');
 assert.equal(a.uncompressedOriginalJsonBytes,1179);
 assert.equal(a.reportedFailure,'fetch failed');
 assert.equal(a.originalPdfAndTextSHAReverified,false);
 assert.equal(a.otherTenZeroOneParagraphInspected,false);
 assert.equal(a.failedOriginalSourceChecks,1);
 assert.equal(a.noCertifiedOriginalSecondTenZeroOneResultFromFirstRun,true);
});
test('retry keeps source pins and cannot convert first FAILURE into named vote or denominator',()=>{
 const r=p.retryBoundary,l=p.limits;
 assert.equal(r.unchangedOriginalOfficialUrl,true);
 assert.equal(r.unchangedOriginalPdfTextSHARequirements,true);
 assert.equal(r.noFirstOriginalRunRerunOrOverwrittenConclusion,true);
 assert.equal(r.retrySuccessNotYetEstablished,true);
 assert.equal(l.noIndividualYeaNaySideImported,true);
 assert.equal(l.noOtherMotionIdentityCertified,true);
 assert.equal(l.no2021to2025StatewideCommitteeVoteDenominatorEstablished,true);
 assert.equal(l.noPrivateProductionDbAccess,true);
 assert.equal(l.issue864MustRemainOpen,true);
});