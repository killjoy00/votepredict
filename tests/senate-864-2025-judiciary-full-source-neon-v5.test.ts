import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {protectedCommitteeSourceParity} from
 '../scripts/audit-senate-864-protected-source-db-parity.js';
import {
  JUDICIARY_2025_ORIGINAL_PROOF,promoteOne2025JudiciaryOriginalToFullyHashedProof,
} from '../scripts/senate-864-2025-judiciary-full-source-proof-v5.js';
import {
  build2025JudiciaryFullSourceSanitizedV5,JUDICIARY_2025_FULL_SOURCE_ONESHOT_MARKER,
} from '../scripts/audit-senate-864-2025-judiciary-full-source-neon-v5.js';
type Output=Awaited<ReturnType<typeof protectedCommitteeSourceParity>>;
const prior=JSON.parse(readFileSync(
 'docs/evaluation/source-proof/senate-864-v2-all-1452-original-pdf-neon-parity-receipt.json','utf8'));

function mock(match=true):Output{
 const c=prior.counts;
 const byYear=prior.byYear.map((y:Record<string,number>)=>({...y}));
 byYear[3].recognizedOriginalRollCalls=33;
 byYear[3].originalNamedChoiceTokens=305;
 byYear[3].matchedRecognizedRollCalls=match?33:32;
 byYear[3].matchedNamedChoiceTokens=match?305:297;
 const candidate={
  status:'verified_default_neon_branch_original_to_stored_source_audit',
  authenticatedNeonDefaultBranch:true,
  deployedProductionBindingIndependentlyVerified:false,
  pinnedOfficialOriginalSourceRun:38066441841,
  protectedTransactionReadOnly:true,transactionRollbackCompleted:true,
  noDatabaseMutations:true,noPrivateRawRowExports:true,
  sourceContextActionsReconciled:false,fullHistoricalReconciliationCertified:false,
  sourceOriginalPdfUrlReferences:1452,
  originalPdfsWithIndependentRawPdfSha:1452,originalPdfsWithoutIndependentRawPdfSha:0,
  sourceExactUrlOneToOne:1452,sourceParsedRawPdfShaMatches:1452,
  sourceParsedRawPdfShaMismatches:0,originalUrlsAbsentFromStoredRecords:0,
  duplicatePersistedSourceUrls:0,storedRowsOutsideOriginalUrlSet:0,
  sourceCandidateRollCallEvents:153,sourceCandidateNamedChoiceTokens:989,
  persistedCommitteeVoteEvents:153,persistedCommitteeMemberVoteRows:988,
  matchedCandidateRollCallEvents:match?152:151,
  matchingCandidateNamedChoiceTokensWithNonNullMembership:match?979:971,
  keyOnlyOriginalEventVerification:{
   sourceRecognizedButOriginalTallyOrNameDigestsUnavailable:0,
   persistedExactKeyAndHearingDateMatches:0,
   persistedKeyDateAndChoiceCountMatches:0,
   sourceKeyOnlyNamedChoiceTokens:0,
   storedCountMatchedButIndividualNamedChoiceIdentitiesNotProven:0,
  },
  originalVsPersistedNamedChoiceDigestDiscrepancy:{
   oneOriginalTokenYeaDeficit:1,oneOriginalTokenNayDeficit:0,
   originalNamedChoiceTokensAbsentFromPersistedDigestSet:1,
   sourceRollEventsWithNamedChoiceMismatch:1,
   originalNamedTokensInThoseRolls:10,
   persistedNamedTokensInThoseRolls:9,
   exactChoiceDigestIntersectionTokensInThoseRolls:9,
   storedNamedChoiceTokensNotInOriginalDigestSet:0,
  },
  byYear,
 };
 return candidate as unknown as Output;
}
test('pin distinct original source-only proof to independent run, archive ZIP SHA and JSON SHA',()=>{
 assert.equal(JUDICIARY_2025_FULL_SOURCE_ONESHOT_MARKER,
  'SENATE_864_JUDICIARY_2025_FULL_ORIGINAL_NEON_ONESHOT_20261012_V5');
 assert.equal(JUDICIARY_2025_ORIGINAL_PROOF.originalRunId,38070395356);
 assert.equal(JUDICIARY_2025_ORIGINAL_PROOF.originalArtifactId,11676168658);
 assert.equal(JUDICIARY_2025_ORIGINAL_PROOF.zipSha256,
  '841dc184b1596a2af00a7652910c31fa903cde258b85d3cdb4e0ff1d08aeb703');
 assert.equal(JUDICIARY_2025_ORIGINAL_PROOF.artifactJsonSha256,
  '26f47dfa3b4cb45507fa9bf9e816a8f7ceb2d4db7ff2dc0bf780683141aa892b');
 assert.throws(()=>promoteOne2025JudiciaryOriginalToFullyHashedProof(
  {} as Parameters<typeof promoteOne2025JudiciaryOriginalToFullyHashedProof>[0],
  Buffer.from('synthetic wrong source fingerprint')),/SHA mismatch/);
});

test('exact new 2025 original eight-choice parity can be promoted without any senator/source data',()=>{
 const d=build2025JudiciaryFullSourceSanitizedV5(mock());
 assert.equal(d.verified2025JudiciaryChoiceFingerprintParity,'FULL_8_OF_8');
 assert.equal(d.independentOriginal2025Yea,7);
 assert.equal(d.independentOriginal2025Nay,1);
 assert.equal(d.originalKeyOnlyRollsRemaining,0);
 assert.equal(d.originalDetailedCandidateRolls,153);
 assert.equal(d.originalNamedChoiceFingerprintTokens,989);
 assert.equal(d.sourceDetailedCandidateRollsMatched,152);
 assert.equal(d.sourceDetailedNamedChoiceTokensMatched,979);
 assert.equal(d.original2024SingleYeaChoiceAbsentFromStored,1);
 assert.equal(d.source2024SingleMissingYeaSideReproved,true);
 assert.equal(d.protectedTransactionRolledBack,true);
 assert.equal(d.noDatabaseWrites,true);
 assert.equal(d.parentIssueStillOpen,true);
 assert.doesNotMatch(JSON.stringify(d),
  /normalized_member_name|source_url|postgresql:|neondb_owner|choiceIdentitySha256|externalKey|membership_id|sourceSha|Senator/);
});

test('unchanged eight stored count with unverified fingerprints is a HOLD not eight matched votes',()=>{
 const d=build2025JudiciaryFullSourceSanitizedV5(mock(false));
 assert.equal(d.verified2025JudiciaryChoiceFingerprintParity,'HOLD');
 assert.equal(d.matchingOriginal2025DetailedCandidateRolls,32);
 assert.equal(d.matchingOriginal2025DetailedNamedChoiceTokens,297);
 assert.equal(d.original2025DetailedNamedChoiceTokens,305);
});
test('changed original cohort, stored 2025 vote totals or changed 2024 known YEA side fail closed',()=>{
 const a=mock();a.persistedCommitteeMemberVoteRows++;
 assert.throws(()=>build2025JudiciaryFullSourceSanitizedV5(a),/frozen independent V2 cohort/);
 const b=mock();b.byYear[3]!.storedCommitteeMemberChoices++;
 assert.throws(()=>build2025JudiciaryFullSourceSanitizedV5(b),/year identity drift/);
 const c=mock();c.originalVsPersistedNamedChoiceDigestDiscrepancy.oneOriginalTokenYeaDeficit=0;
 assert.throws(()=>build2025JudiciaryFullSourceSanitizedV5(c),/2024 YEA-side/);
 const d=mock();d.keyOnlyOriginalEventVerification.sourceRecognizedButOriginalTallyOrNameDigestsUnavailable=1;
 assert.throws(()=>build2025JudiciaryFullSourceSanitizedV5(d),/fully upgraded/);
});
