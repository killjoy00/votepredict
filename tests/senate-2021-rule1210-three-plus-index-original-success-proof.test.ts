import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const a=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-2021-rule1210-sf2-sf566-sf1457-original-three-source-success.json','utf8'
));
const i=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-2021-misc-journal-rule1210-ten-index-original-success.json','utf8'
));
test('original three Senate 2021 Journal PDFs, exact Actions run + downloaded source artifact verified',()=>{
 assert.equal(a.schemaVersion,
  'senate-2021-rule1210-sf2-sf566-sf1457-three-original-journal-success-v1');
 assert.equal(a.issue,864);
 const x=a.success;
 assert.equal(x.originalSourceWorkflowId,38163482503);
 assert.equal(x.originalSourceRunConclusion,'success');
 assert.equal(x.originalSourceRunFailures,0);
 assert.equal(x.sourceRunnerPR,1101);
 assert.equal(x.sourceRunnerMergeSHA,'eb356c91bb7defc58e5eb10560391d9afe5bd34a');
 assert.equal(x.originalSourceArtifactId,11711171699);
 assert.equal(x.independentArtifactZipBytes,3454);
 assert.equal(x.independentlyDownloadedArtifactZipSHA256,
  'cf300ade453b110b68aa72ead98f5729cc0b59b3bc5cde114844b78b4b28fc37');
 assert.equal(x.exactDecodedJsonEntry,'sf2-sf566-sf1457-original-source-proof.json');
 assert.equal(x.decodedJsonBytes,11566);
 assert.equal(x.independentlyVerifiedDecodedJsonSHA256,
  '95f7b9e16229d35efc64d11b11774f453020b06cf525cfd0630c5498e720beec');
 assert.equal(x.separatelyParsedCommitteeMotionCount,3);
 assert.equal(x.originalSourcePDFsSHAAndEmbeddedTextVerifiableCount,3);
});
test('each 2021 committee original PDF/roll/named-side commitment is exact; absent stays null',()=>{
 assert.equal(a.motions.length,3);
 const want=[
  ['SF2','2021-02-08',268,517480,
   'e4abf92f914c719dc440e947a683ed870b6ed9bdcddad3e3454d1b6b85794f4a',
   '7063ae90f776140b0ffd78ba578eb4de2fe50ea7d3ccaf23b4817571d3229987',
   5,3,11418,11585,'94860135ac396520c426e495e0f915b8329808f9a75abe33c2b178d31650a11f'],
  ['SF566','2021-02-17',417,557795,
   '7eb8bd12071fbbda2fa2a57c3d8c034926570d875cb4121218a9545bc3651603',
   'a82cdb414437df02669a99c7a2e82c388d5b3810ac6e37e6539e26e41c2d28fc',
   7,1,4844,4994,'47429e57a2f36835b5865d7aeac15f5f0ba0d4106d8c60c5c89fa27c7604f7ee'],
  ['SF1457','2021-03-10',764,818926,
   '69527407028f0db56ed7e1fd4af3ad7c2036ca93af16a81157b01948067de63e',
   'cdd760afc9cfbcc4f2750a5f81ecf9dcdebffd6728ba5dbc3e054bb8a86a8eed',
   7,2,2510,2668,'d9a9961af478bb64e9874052c8b75f48035e6f9f64f4c36386d9232711bc1563']
 ];
 assert.deepEqual(a.motions.map((m:{
  bill:string;journalReportDate:string;journalPage:number;originalPdfBytes:number;
  originalPdfSHA256:string;originalTextSHA256:string;yea:number;nay:number;
  originalMotionNormalizedTextOffset:number;originalResultNormalizedTextOffset:number;
  originalBoundedMotionSHA256:string
 })=>[
  m.bill,m.journalReportDate,m.journalPage,m.originalPdfBytes,
  m.originalPdfSHA256,m.originalTextSHA256,m.yea,m.nay,
  m.originalMotionNormalizedTextOffset,m.originalResultNormalizedTextOffset,
  m.originalBoundedMotionSHA256
 ]),want);
 for(const m of a.motions){
  assert.equal(m.absentPrinted,null);
  assert.match(m.originalYeaNamesHashDigest,/^[a-f0-9]{64}$/);
  assert.match(m.originalNayNamesHashDigest,/^[a-f0-9]{64}$/);
 }
 assert.equal(a.motions[0].sameMemberSideHashAsDifferentBillSF450NotADuplicateMotion,true);
 assert.equal(a.motions[0].sameOriginalJournalPDFAsPreviousSeparatelyVerifiedSF173Report,true);
 for(const [k,v] of Object.entries(a.holds))assert.equal(v,true,k);
});
test('separate original 2021 official Journal Misc index PDF and successful ZIP/JSON immutable',()=>{
 assert.equal(i.schemaVersion,
  'senate-2021-misc-journal-rule1210-ten-publication-references-original-success-v1');
 assert.equal(i.issue,864);
 assert.equal(i.originalSource.originalPdfBytes,4889272);
 assert.equal(i.originalSource.originalPdfSHA256,
  'ab34a4ea20629f8f4cdf663003f284a0ad7e388602a6717ac267cd9240543c0b');
 assert.equal(i.originalSource.originalExtractedTextSHA256,
  'b3ecadf714a7029ff72a7819fb2c1f6bae3e850e2aae904456355d58c4f6987f');
 assert.equal(i.originalSource.originalRule12_10NormalizedSectionOffsetStart,69493);
 assert.equal(i.originalSource.originalRule12_10NormalizedSectionOffsetEnd,70205);
 assert.equal(i.originalSource.originalRule12_10SectionSHA256,
  '57ea51f3a0919cbed66e95d5025b5648683fc75038522aa6b594d7245cb3e01c');
 assert.equal(i.originalSource.originalExtractedSectionBillPageLines,10);
 const x=i.provenance;
 assert.equal(x.runnerPR,1103);
 assert.equal(x.runnerMergeCommit,'9d0e9d886c30d5a0703118b6e4764d9dac500117');
 assert.equal(x.sourceRunId,38163486518);
 assert.equal(x.sourceRunConclusion,'success');
 assert.equal(x.sourceFailures,0);
 assert.equal(x.sourceArtifactId,11711281341);
 assert.equal(x.artifactDownloadedZipBytes,1596);
 assert.equal(x.independentlyDownloadedZipSHA256,
  '7d3ce3ced82edc8f19d9f4d8892750a1defdc71d279b09805eefb839f71060b8');
 assert.equal(x.originalJsonEntry,'2021-misc-original-index-rule1210-probe.json');
 assert.equal(x.independentlyDecodedOriginalJsonBytes,4009);
 assert.equal(x.independentlyDecodedOriginalJsonSHA256,
  'd43d0740c29e960f790508f1614633429ca4b5aefbe0e901661ad8f397fdbe22');
});
test('2021 regular session only TEN indexed journal publication references, FIVE separately held',()=>{
 const x=i.originalSource;
 assert.deepEqual(x.extractedRule1210BillPagePublicationReferences.map(
  (r:{bill:string;journalPage:number})=>[r.bill,r.journalPage]),[
  ['SF1',297],['SF2',268],['SF173',272],['SF566',417],['SF910',714],
  ['SF970',2147],['SF1159',2086],['SF1457',764],['SF1470',666],['SF2909',5098]
 ]);
 assert.deepEqual(x.extractedRule1210BillPagePublicationReferences.filter(
  (r:{status:string})=>r.status==='NOT_YET_SEPARATELY_ORIGINAL_ROLL_AUTHENTICATED'
 ).map((r:{bill:string})=>r.bill),['SF1','SF910','SF970','SF1159','SF2909']);
 assert.equal(x.independent2021SpecialSessionRule1210SF9JournalPage,156);
 assert.equal(x.specialSessionOriginalBinaryAuthenticated,false);
 assert.equal(x.specialSessionSF9NamedCommitteeRollOriginalAuthenticated,false);
 assert.equal(x.specialSessionSourceMustNotBeCountedInRegularSession10,true);
 for(const [k,v] of Object.entries(i.limits))assert.equal(v,true,k);
});
