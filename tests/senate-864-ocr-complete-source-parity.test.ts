import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {OCR_207_SOURCE_ARTIFACTS,mergeSourceAuditsWithAuthenticated207Ocr}
 from '../scripts/merge-senate-864-ocr-207-original-proof-metadata.js';
import type {OriginalSenateCommitteeYearAudit} from
 '../src/evidence/senate-committee-source-to-db-reconciliation.js';

const prior=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-864-v1-protected-committee-source-db-parity-receipt.json',
 'utf8',
)) as Record<string,any>;
test('protected source-to-Neon V1 receipt is immutable and exact source-pinned',()=>{
 assert.equal(prior.schemaVersion,
  'mn-864-protected-committee-original-source-db-exact-parity-receipt-v1');
 assert.equal(prior.issue,864);
 assert.equal(prior.sourceReceiptId,6117215492);
 assert.equal(prior.run.id,38199687178);
 assert.equal(prior.run.mainCommit,'e201e719b9b60f04ab79c8c81d4519dd3af8a222');
 assert.equal(prior.run.conclusion,'success');
 assert.equal(prior.transaction.readOnly,true);
 assert.equal(prior.transaction.repeatableRead,true);
 assert.equal(prior.transaction.explicitRollback,true);
 assert.equal(prior.transaction.noDatabaseMutations,true);
 assert.equal(prior.transaction.defaultNeonBranchAuthenticated,true);
 assert.equal(prior.transaction.deployedProductionBranchIndependentlyProven,false);
 assert.equal(prior.stored.sourceUrlsOneToOne,1452);
 assert.equal(prior.stored.originalUrlsAbsent,0);
 assert.equal(prior.stored.duplicateStoredUrls,0);
 assert.equal(prior.stored.extraStoredDocuments,0);
 assert.equal(prior.stored.exactRawPdfShaMatches,1245);
 assert.equal(prior.stored.exactRawPdfShaMismatches,0);
 assert.equal(prior.originalSourceScope.lowTextOriginalPdfHashNotComparedInThisRun,207);
 assert.equal(prior.stored.candidateRollsOriginal,135);
 assert.equal(prior.stored.candidateRollsExactMatched,134);
 assert.equal(prior.stored.namedChoiceTokensOriginal,855);
 assert.equal(prior.stored.namedChoiceTokensInFullyMatchedEvents,845);
 assert.equal(prior.pdfLevelMismatchCategories.original_named_choices_mismatch,1);
 assert.equal(prior.stored.persistedCommitteeVoteEvents,153);
 assert.equal(prior.stored.persistedCommitteeMemberVoteRows,988);
 assert.equal(prior.interpretations.ten2024SourceNamedTokensInThatRollNotIndividuallyCertifiedMissing,true);
 assert.equal(prior.interpretations.other207AlreadyOcrRecoveredInSeparateImmutableSourceCohorts,true);
 assert.equal(prior.interpretations.noSourceCompletenessOrForecastEligibilityCertificate,true);
 const y=prior.byYear.find((r:{year:number})=>r.year===2024);
 assert.equal(y.recognizedOriginalRollCalls,49);
 assert.equal(y.matchedRecognizedRollCalls,48);
 assert.equal(y.originalNamedChoiceTokens,228);
 assert.equal(y.matchedNamedChoiceTokens,218);
 assert.equal(y.storedCommitteeMemberChoices,227);
});

test('exactly 16 uniquely pinned immutable source artifacts collectively contain 207 OCR originals',()=>{
 assert.equal(OCR_207_SOURCE_ARTIFACTS.length,16);
 const ids=new Set<number>();
 const filenames=new Set<string>();
 for(const a of OCR_207_SOURCE_ARTIFACTS){
  assert.ok([2022,2023,2024,2025,null].includes(a.year));
  assert.ok([38068730892,38069432305,38073521109,38075234242].includes(a.run));
  assert.match(a.sha,/^[a-f0-9]{64}$/);
  assert.match(a.filename,/^[a-z0-9-]+\.json$/);
  assert.ok(!ids.has(a.id));ids.add(a.id);
  assert.ok(!filenames.has(a.filename));filenames.add(a.filename);
 }
 assert.equal(OCR_207_SOURCE_ARTIFACTS.reduce((n,a)=>n+a.expected,0),207);
 assert.equal(OCR_207_SOURCE_ARTIFACTS.filter(a=>a.year===null).length,1);
});

function minimalYear(year:number):OriginalSenateCommitteeYearAudit{
 return {auditedYear:year,independentlyDiscoveredOriginalMinutesPdfLinks:1,
  originalPdfsFetchedAndParsed:0,originalPdfsFailedOrUnparsed:1,
  documentProofs:[],unresolvedOriginalDocuments:[
   {sourceUrl:'https://www.lrl.mn.gov/archive/minutes/senate/'+year+
    '/x/'+year+'0101/x_'+year+'0101_minutes.pdf',meetingDate:year+'-01-01'}],
 };
}
test('OCR union source verifier fails closed on absent years, tampered metadata, wrong fixed universe and parser gaps',()=>{
 assert.throws(()=>mergeSourceAuditsWithAuthenticated207Ocr([],()=>Buffer.from('bad')),
  /not exact/);
 assert.throws(()=>mergeSourceAuditsWithAuthenticated207Ocr(
  [minimalYear(2022),minimalYear(2023),minimalYear(2024),minimalYear(2025)],
  ()=>Buffer.from('bad'),
 ),/not exact/);
});
