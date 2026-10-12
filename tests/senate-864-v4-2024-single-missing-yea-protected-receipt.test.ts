import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path:string)=>JSON.parse(readFileSync(path,'utf8')) as Record<string,any>;
const v2=read('docs/evaluation/source-proof/senate-864-v2-all-1452-original-pdf-neon-parity-receipt.json');
const v4=read('docs/evaluation/source-proof/senate-864-2024-one-missing-choice-yea-side-v4-protected-receipt.json');
const doc=readFileSync('docs/evaluation/senate-864-single-missing-choice-tally-side-v3.md','utf8');

test('V4 one-original-2024-named-choice side pinned to actual reviewed protected ROLLBACK and issue receipt',()=>{
 assert.equal(v4.schemaVersion,'mn-864-2024-single-missing-candidate-choice-tally-side-v4-protected-receipt');
 assert.equal(v4.issue,864);
 assert.equal(v4.reviewedMainSha,'26110b8bc39f13cac70cacf3230cce9d1e436273');
 assert.equal(v4.protectedRunId,38262800243);
 assert.equal(v4.issueReceiptId,6126317993);
 assert.equal(v4.protectedRunUrl,'https://github.com/killjoy00/votepredict/actions/runs/'+v4.protectedRunId);
 assert.equal(v4.issueReceiptUrl,'https://github.com/killjoy00/votepredict/issues/864#issuecomment-'+v4.issueReceiptId);
 assert.equal(v4.pinnedOriginalV2RunId,v2.protectedRunId);
 assert.equal(v4.pinnedOriginalV2ReceiptId,v2.receiptId);
 assert.equal(v4.v3PresecretHoldRunId,38261106387);
 assert.equal(v4.v3DidNotAccessNeon,true);
 assert.deepEqual(v4.transaction,{
  existingDefaultNeonBranchAuthenticated:true,
  liveDeployedBindingProven:false,
  isolation:'REPEATABLE READ',readOnly:true,explicitRollback:true,
  mutations:0,rawPrivateRowsMemberNamesChoiceDigestsAndUrlsExported:false,
 });
});

test('V4 counts are exactly the previous V2 1452-SHA, 152 detailed-roll, 9/10-matched cohort',()=>{
 const old=v2.counts,c=v4.counts;
 assert.deepEqual(c,{
  originalRawPdfShaAndStoredSourceMatches:old.matchingOriginalRawSha,
  detailedCandidateRolls:old.originalDetailedRolls,
  fullyMatchedCandidateRolls:old.fullyMatchedDetailedRolls,
  originalNamedChoiceTokensOn2024DiscrepantRoll:old.namedMismatchSourceTokens,
  exactStoredChoiceDigestIntersections:old.namedMismatchDigestIntersection,
  originalNamedChoiceTokensAbsent:old.sourceTokensMissingFromStored,
  extraStoredNamedChoiceTokens:old.storedTokensNotInSource,
  exactStoredChoiceRowsWithNonNullMembership:9,
  exactStoredChoiceRowsWithNullMembership:0,
 });
 assert.equal(c.originalRawPdfShaAndStoredSourceMatches,1452);
 assert.equal(c.detailedCandidateRolls,152);
 assert.equal(c.fullyMatchedCandidateRolls,151);
 assert.equal(c.originalNamedChoiceTokensOn2024DiscrepantRoll,10);
 assert.equal(c.exactStoredChoiceDigestIntersections,9);
 assert.equal(c.originalNamedChoiceTokensAbsent,1);
 assert.equal(c.extraStoredNamedChoiceTokens,0);
 assert.equal(c.exactStoredChoiceRowsWithNonNullMembership,9);
 assert.equal(c.exactStoredChoiceRowsWithNullMembership,0);
 assert.equal(v4.inferredMissing2024ChoiceSide,'YEA');
 assert.equal(v4.observedSourceToStoredChoiceSideProved,true);
});

test('V4 never identifies senator or authorizes missing vote repair or forecasting',()=>{
 assert.deepEqual(v4.holds,{
  missingPersonCertified:false,missingRowRootCauseProven:false,
  parserCandidateRollsEqualOfficialAllMotions:false,
  roll2025KeyOnlyIndividualChoiceProof:false,
  print2021MinutesDenominatorComplete:false,
  printElectronic2022Equivalence:false,
  unlinked141ElectronicMeetingsReconciled:false,
  rosterServiceDatesAuthenticated:false,
  asOfEvidenceEligibilityCertified:false,
  allSourceFamiliesComplete:false,
  productionVoteRepairAuthorized:false,
  issue864Closed:false,
 });
 assert.doesNotMatch(JSON.stringify(v4),/source_url|normalized_member_name|postgresql:|neondb_owner|choiceIdentitySha256|external_key|membership_id|sourceSha|meetingDate/);
 assert.match(doc,/Protected V4 outcome — verified one missing YEA-side choice/);
 assert.match(doc,/one absent original choice token is on the\s+YEA side/);
 assert.match(doc,/V3 is still an explicit presecret \*\*HOLD\*\*/);
 assert.match(doc,/live DB binding/);
 assert.match(doc,/Parent #864 remains OPEN/);
});
