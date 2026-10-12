import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

const json=(p:string)=>JSON.parse(readFileSync(p,'utf8')) as Record<string,any>;
const receipt=json('docs/evaluation/source-proof/senate-864-2025-judiciary-eight-of-eight-v6-protected-receipt.json');
const previousV2=json('docs/evaluation/source-proof/senate-864-v2-all-1452-original-pdf-neon-parity-receipt.json');
const previousV4=json('docs/evaluation/source-proof/senate-864-2024-one-missing-choice-yea-side-v4-protected-receipt.json');
const v5doc=readFileSync('docs/evaluation/senate-864-2025-judiciary-8-choice-original-full-source-v5.md','utf8');
const v6doc=readFileSync('docs/evaluation/senate-864-2025-judiciary-postrollback-numeric-v6.md','utf8');
const v2doc=readFileSync('docs/evaluation/senate-864-all-1452-original-pdf-ocr-neon-parity-v2.md','utf8');

test('pin actual reviewed first-attempt V6 protected and keyless issue receipt, not held V5',()=>{
 assert.equal(receipt.issue,864);
 assert.equal(receipt.schemaVersion,'mn-864-2025-judiciary-v6-verified-eight-original-named-choices-v1');
 assert.equal(receipt.reviewedMainCommit,'57b3248dca1ad406cda739c531ba9f2edbe5bca6');
 assert.equal(receipt.protectedRunId,38270466090);
 assert.equal(receipt.keylessIssueReceiptId,6127418525);
 assert.equal(receipt.protectedRunUrl,
  'https://github.com/killjoy00/votepredict/actions/runs/'+receipt.protectedRunId);
 assert.equal(receipt.keylessIssueReceiptUrl,
  'https://github.com/killjoy00/votepredict/issues/864#issuecomment-'+receipt.keylessIssueReceiptId);
 assert.equal(receipt.originalIndependentSourceRunId,38070395356);
 assert.equal(receipt.originalIndependentSourceProofArtifactId,11676168658);
 assert.equal(receipt.previouslyHeldV5RunId,38266959992);
 assert.equal(receipt.previouslyHeldV5IssueReceiptId,6126911116);
 assert.equal(receipt.pinnedV2ProtectedRunId,previousV2.protectedRunId);
 assert.equal(receipt.pinnedV2IssueReceiptId,previousV2.receiptId);
 assert.equal(receipt.pinnedV4ProtectedRunId,previousV4.protectedRunId);
 assert.equal(receipt.pinnedV4IssueReceiptId,previousV4.issueReceiptId);
 assert.equal(receipt.result,'FULL_8_OF_8');
 assert.equal(receipt.explanation,'COMPLETE');
});

test('independent 2025 8-of-8 and all-year 152-of-153 are numeric implications of frozen earlier proofs',()=>{
 assert.deepEqual(receipt.originalJudiciarySource,{
  meetingDate:'2025-03-12',yea:7,nay:1,
  independentlyHashedOriginalNamedChoices:previousV2.counts.keyOnlyChoiceTokensUnverified,
  matchedStoredNamedChoices:8,
 });
 assert.deepEqual(receipt.frozenOriginalPdfAndStoredSourceSha,{
  originalPdfs:previousV2.counts.independentlyShaKnown,
  storedMatches:previousV2.counts.matchingOriginalRawSha,
  sourceCohortUnchanged:true,
 });
 assert.deepEqual(receipt.candidateRollSummary,{
  originalDetailedCandidateRolls:previousV2.counts.originalDetailedRolls+previousV2.counts.keyOnlyOriginalRolls,
  fullyMatchedDetailedCandidateRolls:previousV2.counts.fullyMatchedDetailedRolls+1,
  originalDetailedNamedChoiceFingerprints:previousV2.counts.originalDetailedNamedTokens+8,
  originalNamedChoiceFingerprintsOnFullyMatchedRolls:previousV2.counts.matchedDetailedNamedTokens+8,
 });
 assert.deepEqual(receipt.year2025,{
  originalDetailedCandidateRolls:previousV2.byYear[3].recognizedOriginalRollCalls+1,
  fullyMatchedDetailedCandidateRolls:previousV2.byYear[3].matchedRecognizedRollCalls+1,
  originalDetailedNamedChoiceFingerprints:previousV2.byYear[3].originalNamedChoiceTokens+8,
  originalNamedChoiceFingerprintsOnFullyMatchedRolls:previousV2.byYear[3].matchedNamedChoiceTokens+8,
 });
 assert.deepEqual(receipt.storedCommittee,{
  candidateVoteEvents:previousV2.counts.persistedCommitteeEvents,
  individualChoiceRows:previousV2.counts.persistedCommitteeChoices,
 });
 assert.equal(receipt.candidateRollSummary.originalDetailedCandidateRolls,153);
 assert.equal(receipt.candidateRollSummary.fullyMatchedDetailedCandidateRolls,152);
 assert.equal(receipt.candidateRollSummary.originalDetailedNamedChoiceFingerprints,989);
 assert.equal(receipt.candidateRollSummary.originalNamedChoiceFingerprintsOnFullyMatchedRolls,979);
 assert.equal(receipt.year2025.fullyMatchedDetailedCandidateRolls,33);
 assert.equal(receipt.year2025.originalNamedChoiceFingerprintsOnFullyMatchedRolls,305);
});

test('one original 2024 YEA remains missing, not ten, without person/row attribution',()=>{
 const old=previousV2.counts;
 const v4=previousV4.counts;
 assert.deepEqual(receipt.onlyDetailedMismatchYear2024,{
  originalChoiceFingerprints:old.namedMismatchSourceTokens,
  storedChoiceFingerprintsOnRoll:old.namedMismatchPersistedTokens,
  exactDigestIntersections:old.namedMismatchDigestIntersection,
  originalChoiceFingerprintsAbsent:old.sourceTokensMissingFromStored,
  unexpectedStoredFingerprints:old.storedTokensNotInSource,
  missingOriginalChoiceTallySide:previousV4.inferredMissing2024ChoiceSide,
  personIdentityVerified:false,absenceRootCauseVerified:false,
 });
 assert.equal(v4.exactStoredChoiceRowsWithNonNullMembership,9);
 assert.equal(v4.exactStoredChoiceRowsWithNullMembership,0);
 assert.equal(receipt.candidateRollSummary.originalDetailedNamedChoiceFingerprints-
  receipt.candidateRollSummary.originalNamedChoiceFingerprintsOnFullyMatchedRolls,10);
 assert.equal(receipt.onlyDetailedMismatchYear2024.originalChoiceFingerprintsAbsent,1);
 assert.deepEqual(receipt.additionalMismatchCategories,{
  sourceEventTally:0,sourceEventDate:0,sourceEventMissing:0,
  sourceEventExtraStored:0,unresolvedStoredMember:0,originalNamedChoiceMismatch:1,
 });
});

test('V6 was protected read only and does not promote completion, service identity, deploy binding or repairs',()=>{
 assert.deepEqual(receipt.transaction,{
  authenticatedExistingDefaultNeonBranch:true,
  readOnly:true,isolation:'REPEATABLE READ',explicitRollback:true,
  databaseWrites:0,privateMemberRowsNamesOriginalUrlsAndChoiceHashesExported:false,
 });
 assert.deepEqual(receipt.remainingLimits,{
  sourceParserCandidatesAreOfficialAllActionsCensus:false,
  printYear2021Complete:false,printElectronicYear2022Equivalent:false,
  unlinked141MeetingsReconciled:false,historicalServiceDatesAuthenticated:false,
  asOfEligibilityCertified:false,liveDeployedAppDatabaseBindingVerified:false,
  allHistoricalSourceFamiliesComplete:false,voteRepairAuthorized:false,
  productionDeploymentChanged:false,issue864Closed:false,
 });
 assert.doesNotMatch(JSON.stringify(receipt),
  /"normalized_member_name"\s*:|"source_url"\s*:|"membership_id"\s*:|"choiceIdentitySha256"\s*:|"externalKey"\s*:|postgresql:|neondb_owner/);
 assert.match(v5doc,/V6 protected run #38270466090/);
 assert.match(v6doc,/Verified V6 protected outcome/);
 assert.match(v6doc,/FULL_8_OF_8/);
 assert.match(v6doc,/152 of 153/);
 assert.match(v2doc,/Subsequent V6: 2025 Judiciary/);
 assert.match(v2doc,/one key-only 2025 roll/);
 assert.match(v6doc,/Issue #864 remains OPEN/);
});
