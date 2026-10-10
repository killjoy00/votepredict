import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';

function read(name:string){
 const b=readFileSync(new URL('../docs/evaluation/source-proof/'+name,import.meta.url));
 return {json:JSON.parse(b.toString('utf8')),gitBlobSha:createHash('sha1')
  .update('blob '+b.byteLength+'\0').update(b).digest('hex')};
}
const proof=read('senate-committee-nine-originals-corrected-roll-source-ledger.json');
const queue=read('senate-committee-nine-tally-matched-source-action-review-queue.json');

test('one-time source-run evidence hashes for both original counted committee roll years are immutable',()=>{
 assert.equal(proof.gitBlobSha,'b914706111c3f17fd39135b9f7c5e4e426cbedcc');
 const x=proof.json;
 assert.equal(x.issue,864);
 assert.equal(x.correctedSourceRun,38084229868);
 assert.equal(x.lowercaseAbsentFixPr,923);
 assert.equal(x.sourceReviewParserPr,915);
 assert.equal(x.initialTallyMatches,10);
 assert.equal(x.totalOriginalPdfsShaVerified,9);
 assert.equal(x.totalTallyMatchedProvisionalBlocks,12);
 assert.equal(x.totalExplicitYeaNayTokens,147);
 assert.equal(x.totalExcludedAbsenceOrPassEntries,7);
 const y=x.yearProof;
 assert.deepEqual(y.map((z:{year:number})=>z.year),[2023,2024]);
 assert.equal(y.reduce((n:number,z:{tallyMatchedParserBlocks:number})=>n+z.tallyMatchedParserBlocks,0),12);
 assert.equal(y.reduce((n:number,z:{explicitAbsentOrPassExcluded:number})=>n+z.explicitAbsentOrPassExcluded,0),7);
 for(const row of y){
  assert.ok(row.sourceArtifactId>0);
  assert.match(row.zipSha256,/^[a-f0-9]{64}$/);
  assert.match(row.jsonSha256,/^[a-f0-9]{64}$/);
  assert.equal(row.sourceFailures,0);
 }
});

test('9 source-PDF identities and all 12 distinct original source offsets are source-bounded and not duplicate votes',()=>{
 assert.equal(queue.gitBlobSha,'35de761bf260805afb32eae44af95417621b3dc1');
 const x=queue.json;
 assert.equal(x.proofRunId,38084229868);
 assert.equal(x.totalOriginalOfficialPdfs,9);
 assert.equal(x.totalProvisionalNamedRollBlocks,12);
 assert.equal(x.totalExplicitYeaNayNames,147);
 assert.equal(x.totalNonvotingPassAbsentNames,7);
 const docs=x.documents;
 assert.equal(docs.length,9);
 assert.equal(new Set(docs.map((d:{officialSourcePdfUrl:string})=>d.officialSourcePdfUrl)).size,9);
 const flattened=docs.flatMap((doc:{officialSourcePdfUrl:string;sourceRollBlocks:unknown[]})=>
  doc.sourceRollBlocks.map(r=>({doc:doc.officialSourcePdfUrl,...r as object})));
 assert.equal(flattened.length,12);
 assert.equal(new Set(flattened.map((r:{doc:string;sourceTextOffset:number})=>r.doc+'|'+r.sourceTextOffset)).size,12);
 assert.equal(flattened.reduce((n:number,r:{sourceNamedYeaCount:number;sourceNamedNayCount:number})=>n+r.sourceNamedYeaCount+r.sourceNamedNayCount,0),147);
 assert.equal(flattened.reduce((n:number,r:{sourceAbsentCount:number;sourcePassCount:number})=>n+r.sourceAbsentCount+r.sourcePassCount,0),7);
 for(const doc of docs){
  const u=new URL(doc.officialSourcePdfUrl);
  assert.equal(u.protocol,'https:');
  assert.equal(u.hostname,'www.lrl.mn.gov');
  assert.ok(u.pathname.startsWith('/archive/minutes/senate/'+doc.year+'/'));
  assert.ok(u.pathname.includes('/'+doc.hearingDate.replaceAll('-','')+'/'));
  assert.match(doc.originalSourcePdfSha256,/^[a-f0-9]{64}$/);
  assert.match(doc.originalEmbeddedTextSha256,/^[a-f0-9]{64}$/);
  for(const vote of doc.sourceRollBlocks){
   assert.ok(vote.sourceTextOffset>=0);
   assert.equal(vote.sourceNumericTallyMatchesNamedRoll,true);
   assert.equal(vote.exactActionAndMembershipHumanCertified,false);
   assert.equal(vote.eligibleForPrivateHistoricalDatabaseImport,false);
   assert.equal(vote.billPolicyStanceAndSenateFloorVoteNotInferred,true);
  }
 }
});

test('2024 Rules A2 and ethics complaint procedural votes are never silently treated as bill stances',()=>{
 const docs=queue.json.documents.filter((x:{year:number})=>x.year===2024);
 assert.equal(docs.length,2);
 assert.equal(docs.reduce((n:number,d:{sourceRollBlocks:unknown[]})=>n+d.sourceRollBlocks.length,0),2);
 assert.match(docs[0].sourceRollBlocks[0].humanActionLabelForReviewOnly,/Committee Resolution CR008/);
 assert.match(docs[1].sourceRollBlocks[0].humanActionLabelForReviewOnly,/Ethics complaint/);
 assert.deepEqual(docs.map((d:{sourceRollBlocks:Array<{sourceNamedYeaCount:number;sourceNamedNayCount:number}>})=>
  [d.sourceRollBlocks[0].sourceNamedYeaCount,d.sourceRollBlocks[0].sourceNamedNayCount]),
  [[4,6],[0,4]]);
 assert.equal(proof.json.cautions.committeeResolutionAndEthicsMotionNotInferredPolicyPositions,true);
});

test('member identity, action distinctness, database equality and 2021-print gaps remain open',()=>{
 assert.equal(proof.json.cautions.historicalSenatorRosterMatchingNotCompleted,true);
 assert.equal(proof.json.cautions.memberVoteDatabaseReconciliationNotCompleted,true);
 assert.equal(proof.json.cautions.committeeActionsNotSenateFloorPassage,true);
 assert.equal(proof.json.cautions.originalFullTextMemberNamesAndPdfBytesNotCommitted,true);
 assert.equal(proof.json.cautions.productionDbUntouched,true);
 assert.equal(proof.json.cautions.forecastModelServingScheduler2027Untouched,true);
 assert.equal(proof.json.cautions.issue864StillOpen,true);
 assert.equal(queue.json.noOriginalMemberNamesOrFullPdfTextCommitted,true);
 assert.equal(queue.json.noSenatorIdentityRosterValidationPerformed,true);
 assert.equal(queue.json.noAutomaticEvidenceImport,true);
});