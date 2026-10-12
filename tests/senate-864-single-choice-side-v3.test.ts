import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {buildSingleChoiceSafeReceipt,ONE_MISSING_CHOICE_SIDE_MARKER} from
 '../scripts/audit-senate-864-single-choice-side-readonly-v3.js';
import type {protectedCommitteeSourceParity} from
 '../scripts/audit-senate-864-protected-source-db-parity.js';

type Observation=Awaited<ReturnType<typeof protectedCommitteeSourceParity>>;
const old=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-864-v2-all-1452-original-pdf-neon-parity-receipt.json',
 'utf8'));

function syntheticProtectedOutcome(missing:'YEA'|'NAY'|'HOLD'='NAY'):Observation{
 const c=old.counts;
 const v5={
  status:'verified_default_neon_branch_original_to_stored_source_audit',
  pinnedOfficialOriginalSourceRun:38066441841,
  protectedTransactionReadOnly:true,transactionRollbackCompleted:true,
  authenticatedNeonDefaultBranch:true,deployedProductionBindingIndependentlyVerified:false,
  noDatabaseMutations:true,noPrivateRawRowExports:true,
  sourceContextActionsReconciled:false,fullHistoricalReconciliationCertified:false,
  sourceOriginalPdfUrlReferences:c.originalPdfUrls,
  originalPdfsWithIndependentRawPdfSha:c.independentlyShaKnown,
  sourceExactUrlOneToOne:c.oneToOneStoredSourceUrls,
  sourceParsedRawPdfShaMatches:c.matchingOriginalRawSha,
  sourceParsedRawPdfShaMismatches:c.originalRawShaMismatches,
  originalUrlsAbsentFromStoredRecords:c.missingStoredSourceUrls,
  duplicateStoredUrlsForOriginals:c.duplicatePersistedSourceUrls,
  storedRowsOutsideOriginalUrlSet:c.extraStoredOriginalDocuments,
  sourceCandidateRollCallEvents:c.originalDetailedRolls,
  matchedCandidateRollCallEvents:c.fullyMatchedDetailedRolls,
  sourceCandidateNamedChoiceTokens:c.originalDetailedNamedTokens,
  matchingCandidateNamedChoiceTokensWithNonNullMembership:c.matchedDetailedNamedTokens,
  persistedCommitteeVoteEvents:c.persistedCommitteeEvents,
  persistedCommitteeMemberVoteRows:c.persistedCommitteeChoices,
  keyOnlyOriginalEventVerification:{
   sourceRecognizedButOriginalTallyOrNameDigestsUnavailable:c.keyOnlyOriginalRolls,
   persistedExactKeyAndHearingDateMatches:c.keyOnlyEventUrlHashDateMatches,
   persistedKeyDateAndChoiceCountMatches:c.keyOnlyChoiceCountMatches,
   sourceKeyOnlyNamedChoiceTokens:c.keyOnlyChoiceTokensUnverified,
  },
  originalVsPersistedNamedChoiceDigestDiscrepancy:{
   sourceRollEventsWithNamedChoiceMismatch:c.namedMismatchRolls,
   originalNamedTokensInThoseRolls:c.namedMismatchSourceTokens,
   persistedNamedTokensInThoseRolls:c.namedMismatchPersistedTokens,
   exactChoiceDigestIntersectionTokensInThoseRolls:c.namedMismatchDigestIntersection,
   originalNamedChoiceTokensAbsentFromPersistedDigestSet:c.sourceTokensMissingFromStored,
   storedNamedChoiceTokensNotInOriginalDigestSet:c.storedTokensNotInSource,
   oneOriginalTokenAbsentAllStoredHashesExact:1,
   oneOriginalTokenYeaDeficit:missing==='YEA'?1:0,
   oneOriginalTokenNayDeficit:missing==='NAY'?1:0,
   oneOriginalTokenSideHeld:missing==='HOLD'?1:0,
   storedRowsOnSingleTokenRollWithMembership:missing==='HOLD'?8:9,
   storedRowsOnSingleTokenRollWithoutMembership:missing==='HOLD'?1:0,
  },
  byYear:old.byYear,
 };
 return v5 as Observation;
}

test('the V3 one-shot marker is unique; validates protected receipt and no person/name leak',()=>{
 assert.equal(ONE_MISSING_CHOICE_SIDE_MARKER,
  'SENATE_864_SINGLE_CHOICE_TALLY_SIDE_ONESHOT_20261012_V3');
 const out=buildSingleChoiceSafeReceipt(syntheticProtectedOutcome());
 assert.equal(out.inferredMissingTallySide,'NAY');
 assert.equal(out.oneMissingNaySideCandidate,1);
 assert.equal(out.exactStoredChoiceRowsWithMembershipId,9);
 assert.equal(out.previousV2IssueReceiptId,6117412541);
 assert.equal(out.defaultNeonBranchOnlyNotDeployedBinding,true);
 assert.equal(out.no2024SourceChoiceRepaired,true);
 assert.doesNotMatch(JSON.stringify(out),
  /neondb|source_url|lrl\.mn\.gov|normalized_member_name|Senator|postgresql|memberId/);
});
test('YEA-side single-token receipt remains a count-only, nonrepair observation',()=>{
 const out=buildSingleChoiceSafeReceipt(syntheticProtectedOutcome('YEA'));
 assert.equal(out.inferredMissingTallySide,'YEA');
 assert.equal(out.oneMissingYeaSideCandidate,1);
 assert.equal(out.oneMissingNaySideCandidate,0);
});
test('NULL stored member resolution leaves inferred side explicitly HELD',()=>{
 const out=buildSingleChoiceSafeReceipt(syntheticProtectedOutcome('HOLD'));
 assert.equal(out.inferredMissingTallySide,'HOLD');
 assert.equal(out.exactStoredChoiceRowsWithoutMembershipId,1);
});
test('changed stored membership count or second missing token fail closed',()=>{
 const data=syntheticProtectedOutcome();
 data.persistedCommitteeMemberVoteRows++;
 assert.throws(()=>buildSingleChoiceSafeReceipt(data),/drift/);
 const second=syntheticProtectedOutcome();
 second.originalVsPersistedNamedChoiceDigestDiscrepancy.oneOriginalTokenAbsentAllStoredHashesExact=2;
 assert.throws(()=>buildSingleChoiceSafeReceipt(second),/exact digest gate/);
});
test('falsely promoting mixed name/choice digest mismatches fails closed',()=>{
 const fake=syntheticProtectedOutcome();
 fake.originalVsPersistedNamedChoiceDigestDiscrepancy.storedNamedChoiceTokensNotInOriginalDigestSet=1;
 assert.throws(()=>buildSingleChoiceSafeReceipt(fake),/Mismatch cohort changed/);
});
