import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FINANCE_APR07_FIRST_FULL_ORIGINAL_SOURCE as first} from
 '../src/evidence/senate-2022-finance-apr07-original-seven-roll-verify.js';

const p=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-2022-apr07-finance-two-original-pdf-sha-parser-hold.json','utf8'
));
const originalLead=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-2022-finance-apr07-electronic-seven-rolls-discovery.json','utf8'
));

test('#864 twice original-source authenticated 2022 electronic PDF and text are stable despite parser failures',()=>{
 assert.equal(p.issue,864);
 assert.equal(p.hearingDate,'2022-04-07');
 assert.equal(p.officialSourceURL,originalLead.originalMinutesPdfUrl);
 const sha=p.exactWholeOriginalSource;
 assert.equal(sha.bytes,140671);
 assert.equal(sha.bytes,first.originalPDFBytes);
 assert.equal(sha.sha256,first.originalFullPDFSHA256);
 assert.equal(sha.embeddedTextSHA256,first.originalEmbeddedTextSHA256);
 assert.equal(sha.identicalAcrossTwoIndependentOriginalDownloads,true);
 assert.deepEqual(p.sourceRuns.map((r:{runId:number})=>r.runId),[
  38196825837,38197287278
 ]);
 assert.deepEqual(p.sourceRuns.map((r:{artifactId:number})=>r.artifactId),[
  11723219510,11723811939
 ]);
 assert.deepEqual(p.sourceRuns.map((r:{parseFailureCode:string})=>r.parseFailureCode),[
  'original motion disposition','original PDF roll side'
 ]);
 assert.deepEqual(p.sourceRuns.map((r:{artifactZIPBytes:number})=>r.artifactZIPBytes),
  [979,1079]);
 assert.deepEqual(p.sourceRuns.map((r:{sourceJSONBytes:number})=>r.sourceJSONBytes),
  [1537,1925]);
 assert.deepEqual(p.sourceRuns.map((r:{sourceJSONSHA256:string})=>r.sourceJSONSHA256),[
  '831d27ff7db949a9347059253fbad44fa8a8afa0f50ce50f25a2d2f5c54b3ecb',
  '8906a66764c2d204f65e1a1bf5a52b002c6a4a7e38e3020756e37d3867bf40bd'
 ]);
 assert.deepEqual(p.sourceRuns.map((r:{artifactZIPSHA256:string})=>r.artifactZIPSHA256),[
  '3e424dbf4d8af68958ee37552f287444b47f026e3b52eb1bbcfd0d7e9ea3c44c',
  '984c527ac4483d0e2e5cf10bef1c4ddc644d8d0675bd47239b180fbfbe2517db'
 ]);
 assert.ok(p.sourceRuns.every((r:{conclusion:string;originalPdfDownloaded:boolean;sevenRollParserCertified:boolean})=>
  r.conclusion==='failure'&&r.originalPdfDownloaded===true&&r.sevenRollParserCertified===false));
});
test('#864 source binary validity is NOT seven amended motion certification or 2022 printed minutes parity',()=>{
 assert.equal(originalLead.sourceRetrieval.sourceOriginalPdfOrTextSHA256IndependentlyVerified,false);
 assert.equal(originalLead.namedOriginalTextRollParagraphs.length,7);
 assert.equal(originalLead.aggregate.totalYesNoChoicesPrintedInText,67);
 assert.equal(p.existingResearchLead.semanticIndependentlyCertified,false);
 assert.equal(p.existingResearchLead.unprintedAbsentCount,null);
 assert.equal(p.conclusion.wholeOriginalPDFAndEmbeddedTextStable,true);
 assert.equal(p.conclusion.sevenMotionsNotAuthenticatedByStrictParser,true);
 assert.equal(p.conclusion.noNewCertifiedOriginalMemberChoiceCount,true);
 assert.equal(p.conclusion.noIndividualVotesImported,true);
 assert.equal(p.conclusion.audioOrHumanListeningPerformed,false);
 assert.equal(p.conclusion.skipFurtherParserOrAudioReviewForThisTask,true);
 assert.equal(p.conclusion.sourcePublicationClockVerified,false);
 assert.equal(p.conclusion.originalPrint2022ElectronicParityEstablished,false);
 assert.equal(p.conclusion.statewideRecordedVoteDenominator,null);
 assert.equal(p.conclusion.sourceToExistingHistoricalDatabaseRowsReconciled,false);
 assert.equal(p.conclusion.noProductionReadsWritesOrModelServingTrainingScheduler2027,true);
 assert.equal(p.conclusion.issue864Open,true);
});
