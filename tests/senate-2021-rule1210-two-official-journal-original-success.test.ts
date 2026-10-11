import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

const p=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-2021-rule1210-two-official-journal-rolls-original-success.json','utf8'
));
test('actual successful 2021 original Journal PDF source-run/ZIP/JSON immutable',()=>{
 assert.equal(p.schemaVersion,
  'senate-2021-rule1210-sf173-sf1470-official-journal-original-success-checkpoint-v1');
 assert.equal(p.issue,864);
 const r=p.successfulOriginalAcquisition;
 assert.equal(r.originalSourceRunnerPR,1091);
 assert.equal(r.mergedSourceRunnerCommit,'8fa018a886f276f2fecd618a9db9586252545c77');
 assert.equal(r.originalActionsRunId,38160752446);
 assert.equal(r.originalActionsConclusion,'success');
 assert.equal(r.originalPdfSourcesVerified,2);
 assert.equal(r.originalPdfSourcesExpected,2);
 assert.equal(r.failedOriginalSources,0);
 assert.equal(r.originalArtifactId,11710620968);
 assert.equal(r.independentlyDownloadedOriginalZipBytes,2526);
 assert.equal(r.independentlyDownloadedOriginalZipSha256,
  '15e28075547a0a6c59b130b1f8425fa45308b7c56c4c92961bdc19b7253ba5e2');
 assert.equal(r.decodedOriginalJsonEntryName,
  'official-sf173-sf1470-committee-report-rolls.json');
 assert.equal(r.independentlyDownloadedOriginalJsonBytes,7004);
 assert.equal(r.independentlyDownloadedOriginalJsonSha256,
  '241e85496056ba89c4f1990a9bb0a5feaad6b46614bad991dfaa8f961195b9a2');
});
test('two original PDF and text SHA verified with accurate Senate Journal report dates',()=>{
 const a=p.originalDocuments;
 assert.equal(a.length,2);
 assert.deepEqual(a.map((x:{bill:string;reportedSenateJournalDate:string;committee:string;printedPage:number;yea:number;nay:number;absentPrinted:number|null})=>[
  x.bill,x.reportedSenateJournalDate,x.committee,x.printedPage,x.yea,x.nay,x.absentPrinted
 ]),[
  ['SF173','2021-02-08','Transportation Finance and Policy',272,5,4,null],
  ['SF1470','2021-03-04','Housing Finance and Policy',666,4,3,null]
 ]);
 assert.equal(a[0].originalPdfBytes,517480);
 assert.equal(a[1].originalPdfBytes,1039640);
 assert.equal(a[0].originalPdfSHA256,
  'e4abf92f914c719dc440e947a683ed870b6ed9bdcddad3e3454d1b6b85794f4a');
 assert.equal(a[0].originalExtractedTextSHA256,
  '7063ae90f776140b0ffd78ba578eb4de2fe50ea7d3ccaf23b4817571d3229987');
 assert.equal(a[1].originalPdfSHA256,
  'b84b3e3eba4569670356e94f7da0ff7ffecb5d13baab00755e5cf39571ceea9e');
 assert.equal(a[1].originalExtractedTextSHA256,
  '6bbf58433749c921eba7f77705d0be55ea2fd2ec80053485f2f575f6b51106db');
 assert.deepEqual(a.map((x:{sourceOriginalNormalizedMotionOffset:number;sourceOriginalNormalizedResultOffset:number})=>[
  x.sourceOriginalNormalizedMotionOffset,x.sourceOriginalNormalizedResultOffset
 ]),[[22118,22275],[81416,81586]]);
 assert.deepEqual(a.map((x:{originalMotionNeighborhoodSha256:string})=>x.originalMotionNeighborhoodSha256),[
  '6fb3fb60b34f478ab0b6f289509162949949ae2b4ed0bac61c011f5a24b3179a',
  'f735a772ef699d4f1bb3288c8d6b396c037665bc9a06bb94348ef71030e122b9'
 ]);
 for(const x of a){
  assert.equal(x.originalEmbeddedTextExtractionVerified,true);
  assert.equal(x.exactNamesAndCountsVerified,true);
  assert.equal(x.result,'prevailed');
  assert.match(x.originalPdfSHA256,/^[a-f0-9]{64}$/);
 }
});
test('original Journal Rule 12.10 NOT floor, meeting date, print minute census or import',()=>{
 for(const [key,value] of Object.entries(p.provenanceHolds))
  assert.equal(value,true,key);
});
