import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const p=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-2025-elections-feb06-sf0529-filed-a2-original-first-failure-checkpoint.json',
 'utf8'));
test('2025 Feb06 original filed SF529 A2 download FAILURE immutable source identity',()=>{
 assert.equal(p.schemaVersion,'senate-2025-elections-feb06-sf0529-filed-a2-first-original-failure-checkpoint-v1');
 assert.equal(p.issue,864);
 assert.equal(p.historicalHearingDate,'2025-02-06');
 assert.equal(p.officialIndexedDocumentLabel,'sf0529-a2-amendment');
 assert.equal(p.expectedOriginalPdfUrl,
  'https://www.lrl.mn.gov/archive/minutes/senate/2025/elections/20250206/Elections_20250206_SF0529-A2-Amendment.pdf');
 const q=p.actualFirstOriginalFiledA2SourceRun;
 assert.equal(q.runId,38157040475);
 assert.equal(q.sourceAcquisitionPR,1071);
 assert.equal(q.sourceAcquisitionMergeCommit,'ce5ec9a8226d05d35f645b92d812d5e50e2b9547');
 assert.equal(q.conclusion,'failure');
 assert.equal(q.originalArtifactId,11709186032);
 assert.equal(q.zipBytes,969);
 assert.equal(q.independentlyDownloadedArtifactZipSha256,
  '71c8954a141fd48338150c5a67ae1324fd41d88e58a61697e624f3de1180030f');
 assert.equal(q.decodedJsonEntryName,'original-filed-sf0529-a2-metadata.json');
 assert.equal(q.decodedJsonBytes,1441);
 assert.equal(q.independentlyDownloadedDecodedJsonSha256,
  '08ae9f983f428ea97f68f0d1b06c46c2e9d6de45a44fd11fafd5e5f9f4267bff');
 assert.equal(q.originalFetchError,'fetch failed');
 assert.equal(q.firstObservedDownloadTimestampUtc,null);
 assert.equal(q.actualOriginalPdfBytesAcquired,false);
 assert.equal(q.sourceOriginalPdfSha256IndependentlyVerified,false);
 assert.equal(q.sourceOriginalFilePagesRead,false);
 assert.equal(q.sourceOriginalPDFFileInArtifact,false);
});
test('original minutes source anchors and oral-vs-filed A2 distinctness hold',()=>{
 const q=p.previousAuthenticatedCommitteeMinutes,h=p.safetyHolds;
 assert.equal(q.originalPdfSha256,
  '054c81c01271e8ef6513f57c29e95cbdb4f3984a8b0676effe6a83f0f812469d');
 assert.equal(q.extractedOriginalTextSha256,
  '99301546122e3bdb2013302b384e4dd3c2bb15d66056efb1888c66c541758750');
 assert.deepEqual([q.oralA2LuceroTextOffset,q.otherA2MathewsTextOffset],[1991,2250]);
 assert.equal(q.separatePrintedFiveSixResultsDoNotProveDistinctHistoricalRolls,true);
 for(const [key,value] of Object.entries(h)){
  assert.equal(value,true,key);
 }
});