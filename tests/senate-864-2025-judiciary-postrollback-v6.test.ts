import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {protectedCommitteeSourceParity} from
 '../scripts/audit-senate-864-protected-source-db-parity.js';
import {
 JUDICIARY_V6_ONESHOT_MARKER,
 build2025JudiciaryPostRollbackV6,
} from '../scripts/audit-senate-864-2025-judiciary-postrollback-v6.js';

type Observed=Awaited<ReturnType<typeof protectedCommitteeSourceParity>>;
const v2=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-864-v2-all-1452-original-pdf-neon-parity-receipt.json','utf8'));

function synthetic(variant:'FULL'|'TALLY_HOLD'|'DIGEST_HOLD'='FULL'):Observed{
 const full=variant==='FULL',digest=variant==='DIGEST_HOLD';
 const byYear=v2.byYear.map((r:Record<string,number>)=>({...r}));
 byYear[3].recognizedOriginalRollCalls=33;
 byYear[3].originalNamedChoiceTokens=305;
 byYear[3].matchedRecognizedRollCalls=full?33:32;
 byYear[3].matchedNamedChoiceTokens=full?305:297;
 const sample={
  status:'verified_default_neon_branch_original_to_stored_source_audit',
  authenticatedNeonDefaultBranch:true,
  deployedProductionBindingIndependentlyVerified:false,
  pinnedOfficialOriginalSourceRun:38066441841,
  protectedTransactionReadOnly:true,
  transactionRollbackCompleted:true,
  noDatabaseMutations:true,
  noPrivateRawRowExports:true,
  sourceContextActionsReconciled:false,
  fullHistoricalReconciliationCertified:false,
  sourceOriginalPdfUrlReferences:1452,
  originalPdfsWithIndependentRawPdfSha:1452,
  originalPdfsWithoutIndependentRawPdfSha:0,
  sourceExactUrlOneToOne:1452,
  sourceParsedRawPdfShaMatches:1452,
  sourceParsedRawPdfShaMismatches:0,
  originalUrlsAbsentFromStoredRecords:0,
  duplicateStoredUrlsForOriginals:0,
  storedRowsOutsideOriginalUrlSet:0,
  sourceCandidateRollCallEvents:153,
  sourceCandidateNamedChoiceTokens:989,
  persistedCommitteeVoteEvents:153,
  persistedCommitteeMemberVoteRows:988,
  matchedCandidateRollCallEvents:full?152:151,
  matchingCandidateNamedChoiceTokensWithNonNullMembership:full?979:971,
  keyOnlyOriginalEventVerification:{
   sourceRecognizedButOriginalTallyOrNameDigestsUnavailable:0,
   sourceKeyOnlyNamedChoiceTokens:0,
  },
  mismatchDocumentCountsByCategory:{
   original_named_choices_mismatch:digest?2:1,
   persisted_roll_call_tally_mismatch:variant==='TALLY_HOLD'?1:0,
   persisted_vote_event_not_matched_to_source:0,
  },
  originalVsPersistedNamedChoiceDigestDiscrepancy:{
   sourceRollEventsWithNamedChoiceMismatch:digest?2:1,
   originalNamedTokensInThoseRolls:digest?18:10,
   persistedNamedTokensInThoseRolls:digest?17:9,
   exactChoiceDigestIntersectionTokensInThoseRolls:9,
   originalNamedChoiceTokensAbsentFromPersistedDigestSet:digest?9:1,
   storedNamedChoiceTokensNotInOriginalDigestSet:digest?8:0,
   oneOriginalTokenAbsentAllStoredHashesExact:1,
   oneOriginalTokenYeaDeficit:1,
   oneOriginalTokenNayDeficit:0,
   oneOriginalTokenSideHeld:0,
   storedRowsOnSingleTokenRollWithMembership:9,
   storedRowsOnSingleTokenRollWithoutMembership:0,
  },
  byYear,
 };
 return sample as unknown as Observed;
}

test('one-shot V6 diagnostic pin follows the V5 after-ROLLBACK HOLD and original V2/V4 immutable receipts',()=>{
 assert.equal(JUDICIARY_V6_ONESHOT_MARKER,
  'SENATE_864_JUDICIARY_2025_POSTROLLBACK_NUMERIC_ONESHOT_20261012_V6');
 const r=build2025JudiciaryPostRollbackV6(synthetic());
 assert.equal(r.priorV5HeldRunId,38266959992);
 assert.equal(r.priorV5HeldIssueReceiptId,6126911116);
 assert.equal(r.priorV2ProtectedRunId,38201074454);
 assert.equal(r.priorV4ProtectedRunId,38262800243);
 assert.equal(r.independentlyVerifiedOriginalJudiciaryArtifactId,11676168658);
 assert.equal(r.original2025JudiciaryYea,7);
 assert.equal(r.original2025JudiciaryNay,1);
 assert.equal(r.original2025JudiciaryChoiceHashes,8);
 assert.equal(r.transactionRolledBack,true);
 assert.equal(r.noDatabaseWrites,true);
 assert.equal(r.issue864StillOpen,true);
});

test('only independently complete exact 2025 8/8 digests AND frozen 2024/DB proofs may classify FULL',()=>{
 const r=build2025JudiciaryPostRollbackV6(synthetic());
 assert.equal(r.individual2025FingerprintParity,'FULL_8_OF_8');
 assert.equal(r.explicitHoldReason,'COMPLETE');
 assert.equal(r.storedBaselineMatchesV2,true);
 assert.equal(r.earlier2024MissingYeaAnchorStillProven,true);
 assert.equal(r.original2025SourceTotalsExact,true);
 assert.equal(r.sourceDetailedCandidateRolls,153);
 assert.equal(r.original2025DetailedRolls,33);
 assert.equal(r.original2025DetailedChoices,305);
 assert.equal(r.matched2025DetailedRolls,33);
 assert.equal(r.matched2025DetailedChoices,305);
 assert.equal(r.sourceNamedChoiceMismatchCategories,1);
 assert.equal(r.sourceEventExtraStoredCategories,0);
 assert.doesNotMatch(JSON.stringify(r),
  /normalized_member_name|postgresql:|neondb_owner|source_url|externalKey|choiceIdentitySha256|membership_id|sourceSha|memberName|Senator/);
});

test('2025 original versus stored TALLY mismatch stays a numeric HOLD with original 2024 YEA preserved',()=>{
 const r=build2025JudiciaryPostRollbackV6(synthetic('TALLY_HOLD'));
 assert.equal(r.individual2025FingerprintParity,'HOLD');
 assert.equal(r.explicitHoldReason,'TALLY_OR_EVENT_MATCH_UNVERIFIED');
 assert.equal(r.sourceEventTallyMismatchCategories,1);
 assert.equal(r.matched2025DetailedRolls,32);
 assert.equal(r.matched2025DetailedChoices,297);
 assert.equal(r.earlier2024MissingYeaAnchorStillProven,true);
 assert.equal(r.missingSingleSourceYeaChoices,1);
});
test('2025 original versus stored named choice digest mismatch stays HOLD without disclosing member',()=>{
 const r=build2025JudiciaryPostRollbackV6(synthetic('DIGEST_HOLD'));
 assert.equal(r.individual2025FingerprintParity,'HOLD');
 assert.equal(r.explicitHoldReason,'NAMED_CHOICE_OR_MEMBER_MATCH_UNVERIFIED');
 assert.equal(r.sourceNamedChoiceMismatchCategories,2);
 assert.equal(r.originalChoiceDigestsAbsent,9);
 assert.equal(r.storedChoiceDigestsNotInOriginal,8);
 assert.equal(r.matched2025DetailedChoices,297);
});
test('stored cohort drift and historic single-YEA hold cannot silently promote 2025 to full match',()=>{
 const drift=synthetic();drift.persistedCommitteeMemberVoteRows=989;
 const observed=build2025JudiciaryPostRollbackV6(drift);
 assert.equal(observed.individual2025FingerprintParity,'HOLD');
 assert.equal(observed.explicitHoldReason,'STORED_BASELINE_OR_SOURCE_DOCUMENT_DRIFT');
 assert.equal(observed.storedBaselineMatchesV2,false);
 const previous=synthetic();
 previous.originalVsPersistedNamedChoiceDigestDiscrepancy.oneOriginalTokenYeaDeficit=0;
 const mismatch=build2025JudiciaryPostRollbackV6(previous);
 assert.equal(mismatch.individual2025FingerprintParity,'HOLD');
 assert.equal(mismatch.explicitHoldReason,'2024_YEA_ANCHOR_CHANGED');
});
test('cannot emit any result until independent Neon READ ONLY and explicit ROLLBACK are proved',()=>{
 const bad=synthetic();bad.transactionRollbackCompleted=false;
 assert.throws(()=>build2025JudiciaryPostRollbackV6(bad),
  /Protected transaction or independently original SHA source scope unverified/);
 const noOriginal=synthetic();noOriginal.sourceCandidateRollCallEvents=152;
 assert.throws(()=>build2025JudiciaryPostRollbackV6(noOriginal),
  /Protected transaction or independently original SHA source scope unverified/);
});
