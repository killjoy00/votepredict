/**
 * #864 V6 -- one reviewed main-only, read-only diagnostic of V5's
 * post-ROLLBACK HOLD.  No extra DB SQL: repeat exactly the original three
 * bounded source/event/choice SELECTs and permit only fixed scalar counts,
 * boolean provenance gates and source-to-stored match/HOLD enums as output.
 *
 * V5 source JSON/PDF/OCR proofs remain independently SHA-pinned. V5's
 * unsuccessful post-query strict receipt must never be promoted to 8/8.
 */
import {readFileSync,appendFileSync} from 'node:fs';
import {Pool} from 'pg';
import {assertProtectedOneShot} from './audit-senate-864-neon-one-key-readonly-coverage.js';
import {protectedCommitteeSourceParity} from './audit-senate-864-protected-source-db-parity.js';
import {sourceShaPinnedMerged} from './audit-senate-864-2025-judiciary-full-source-neon-v5.js';
import {JUDICIARY_2025_ORIGINAL_PROOF} from
 './senate-864-2025-judiciary-full-source-proof-v5.js';

export const JUDICIARY_V6_ONESHOT_MARKER=
 'SENATE_864_JUDICIARY_2025_POSTROLLBACK_NUMERIC_ONESHOT_20261012_V6' as const;
type Result=Awaited<ReturnType<typeof protectedCommitteeSourceParity>>;
const oldV2='docs/evaluation/source-proof/senate-864-v2-all-1452-original-pdf-neon-parity-receipt.json';
const oldV4='docs/evaluation/source-proof/senate-864-2024-one-missing-choice-yea-side-v4-protected-receipt.json';
const namedMismatchFields=[
 'duplicate_persisted_roll_call',
 'duplicate_persisted_source',
 'missing_original_roll_call_event',
 'official_original_pdf_not_retrieved',
 'original_named_choices_mismatch',
 'original_pdf_hash_mismatch',
 'original_source_not_in_export',
 'persisted_event_date_mismatch',
 'persisted_roll_call_tally_mismatch',
 'persisted_vote_event_not_matched_to_source',
 'source_meeting_or_committee_mismatch',
 'unexpected_individual_choices_on_count_only',
 'unresolved_persisted_member_identity',
] as const;
const safeNumber=(value:unknown,limit=3000)=>{
 if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0||value>limit)
  throw Error('Unexpected protected numeric source/comparison aggregate');
 return value;
};

/**
 * Uses only whitelisted finite scalar summary counts produced AFTER ROLLBACK.
 * A changed 2025 vote/tally or previous cohort is a visible HOLD, not a
 * private raw-row export or an invented 8-of-8 original fingerprint parity.
 */
export function build2025JudiciaryPostRollbackV6(out:Result){
 const base=JSON.parse(readFileSync(oldV2,'utf8')) as Record<string,any>;
 const v4=JSON.parse(readFileSync(oldV4,'utf8')) as Record<string,any>;
 if(base.receiptId!==6117412541||base.protectedRunId!==38201074454
  ||base.mainCommit!=='7fd5fe14e9819b5e5a084c67529b2d383211f4a1'
  ||base.transaction?.readOnly!==true||base.transaction?.explicitRollback!==true
  ||v4.issueReceiptId!==6126317993||v4.protectedRunId!==38262800243
  ||v4.reviewedMainSha!=='26110b8bc39f13cac70cacf3230cce9d1e436273'
  ||v4.inferredMissing2024ChoiceSide!=='YEA'
  ||v4.transaction?.readOnly!==true||v4.transaction?.explicitRollback!==true)
  throw Error('Independent V2/V4 source-to-Neon protected evidence references changed');
 if(out.status!=='verified_default_neon_branch_original_to_stored_source_audit'
  ||out.authenticatedNeonDefaultBranch!==true
  ||out.deployedProductionBindingIndependentlyVerified!==false
  ||out.pinnedOfficialOriginalSourceRun!==38066441841
  ||out.protectedTransactionReadOnly!==true
  ||out.transactionRollbackCompleted!==true
  ||out.noDatabaseMutations!==true||out.noPrivateRawRowExports!==true
  ||out.sourceContextActionsReconciled!==false
  ||out.fullHistoricalReconciliationCertified!==false
  ||out.sourceOriginalPdfUrlReferences!==1452
  ||out.originalPdfsWithIndependentRawPdfSha!==1452
  ||out.originalPdfsWithoutIndependentRawPdfSha!==0
  ||out.sourceCandidateRollCallEvents!==153
  ||out.sourceCandidateNamedChoiceTokens!==989
  ||out.keyOnlyOriginalEventVerification.sourceRecognizedButOriginalTallyOrNameDigestsUnavailable!==0
  ||out.keyOnlyOriginalEventVerification.sourceKeyOnlyNamedChoiceTokens!==0)
  throw Error('Protected transaction or independently original SHA source scope unverified');
 const rows=out.byYear;
 if(rows.length!==4||rows.some((x,i)=>x.year!==2022+i))
  throw Error('Unexpected original year-group count or order');
 const d=out.originalVsPersistedNamedChoiceDigestDiscrepancy;
 const reportMismatch=out.mismatchDocumentCountsByCategory;
 const mismatch=Object.fromEntries(namedMismatchFields.map(k=>[
  k,safeNumber(reportMismatch[k]??0,153),
 ])) as Record<typeof namedMismatchFields[number],number>;
 const current2025=rows[3]!;
 const coreFields=[
  'sourceExactUrlOneToOne','sourceParsedRawPdfShaMatches',
  'sourceParsedRawPdfShaMismatches','originalUrlsAbsentFromStoredRecords',
  'duplicateStoredUrlsForOriginals','storedRowsOutsideOriginalUrlSet',
  'persistedCommitteeVoteEvents','persistedCommitteeMemberVoteRows',
  'matchedCandidateRollCallEvents','matchingCandidateNamedChoiceTokensWithNonNullMembership',
 ] as const;
 for(const key of coreFields)safeNumber(out[key],3000);
 const thisYearFields=[
  'originalPdfUrls','exactUrlOneToOne','parsedOriginalPdfs',
  'originalParsedRawShaMatches','originalParsedRawShaMismatches',
  'parsedMetadataMatches','parsedMetadataMismatches',
  'missingOriginalUrls','duplicateStoredOriginalUrls',
  'recognizedOriginalRollCalls','matchedRecognizedRollCalls',
  'originalNamedChoiceTokens','matchedNamedChoiceTokens',
  'storedCommitteeEvents','storedCommitteeMemberChoices',
 ] as const;
 for(const y of rows)for(const field of thisYearFields)safeNumber(y[field],1500);
 const differenceFields=[
  'sourceRollEventsWithNamedChoiceMismatch','originalNamedTokensInThoseRolls',
  'persistedNamedTokensInThoseRolls','exactChoiceDigestIntersectionTokensInThoseRolls',
  'originalNamedChoiceTokensAbsentFromPersistedDigestSet',
  'storedNamedChoiceTokensNotInOriginalDigestSet',
  'oneOriginalTokenAbsentAllStoredHashesExact',
  'oneOriginalTokenYeaDeficit','oneOriginalTokenNayDeficit',
  'oneOriginalTokenSideHeld','storedRowsOnSingleTokenRollWithMembership',
  'storedRowsOnSingleTokenRollWithoutMembership',
 ] as const;
 for(const field of differenceFields)safeNumber(d[field],1500);
 let existingStoredCohortMatchesV2=
  out.sourceExactUrlOneToOne===base.counts.oneToOneStoredSourceUrls
  &&out.sourceParsedRawPdfShaMatches===base.counts.matchingOriginalRawSha
  &&out.sourceParsedRawPdfShaMismatches===0
  &&out.originalUrlsAbsentFromStoredRecords===0
  &&out.duplicateStoredUrlsForOriginals===0
  &&out.storedRowsOutsideOriginalUrlSet===0
  &&out.persistedCommitteeVoteEvents===base.counts.persistedCommitteeEvents
  &&out.persistedCommitteeMemberVoteRows===base.counts.persistedCommitteeChoices;
 for(let i=0;i<4;i++){
  const current=rows[i]!,older=base.byYear[i];
  for(const col of [
    'originalPdfUrls','exactUrlOneToOne','parsedOriginalPdfs',
    'originalParsedRawShaMatches','originalParsedRawShaMismatches',
    'parsedMetadataMatches','parsedMetadataMismatches',
    'missingOriginalUrls','duplicateStoredOriginalUrls',
    'storedCommitteeEvents','storedCommitteeMemberChoices',
  ] as const){
   if(current[col]!==older[col])existingStoredCohortMatchesV2=false;
  }
 }
 const originalDetailed2025SourceStillExact=current2025.recognizedOriginalRollCalls===33
  &&current2025.originalNamedChoiceTokens===305;
 const earlierDetailedRollsStillExact=rows.slice(0,3).every((now,i)=>{
  const before=base.byYear[i];
  return [
   'recognizedOriginalRollCalls','matchedRecognizedRollCalls',
   'originalNamedChoiceTokens','matchedNamedChoiceTokens',
  ].every(k=>(now as Record<string,unknown>)[k]===before[k]);
 });
 const original2024MissingYeaStillProven=d.oneOriginalTokenYeaDeficit===1
  &&d.oneOriginalTokenNayDeficit===0
  &&d.oneOriginalTokenAbsentAllStoredHashesExact===1
  &&d.storedRowsOnSingleTokenRollWithMembership===9
  &&d.storedRowsOnSingleTokenRollWithoutMembership===0
  &&rows[2]!.recognizedOriginalRollCalls===49
  &&rows[2]!.matchedRecognizedRollCalls===48
  &&rows[2]!.originalNamedChoiceTokens===228
  &&rows[2]!.matchedNamedChoiceTokens===218;
 const judiciary2025FullDigestProof=current2025.matchedRecognizedRollCalls===33
  &&current2025.matchedNamedChoiceTokens===305;
 const onlyOriginal2024Mismatch=
  d.sourceRollEventsWithNamedChoiceMismatch===1
  &&d.originalNamedTokensInThoseRolls===10
  &&d.persistedNamedTokensInThoseRolls===9
  &&d.exactChoiceDigestIntersectionTokensInThoseRolls===9
  &&d.originalNamedChoiceTokensAbsentFromPersistedDigestSet===1
  &&d.storedNamedChoiceTokensNotInOriginalDigestSet===0;
 const unmatchedRollKeysEliminated=
  mismatch.persisted_vote_event_not_matched_to_source===0;
 const otherMismatchCategoriesClean=namedMismatchFields.every(key=>
  key==='original_named_choices_mismatch'
   ?mismatch[key]===1
   :mismatch[key]===0);
 const full=existingStoredCohortMatchesV2
  &&originalDetailed2025SourceStillExact&&earlierDetailedRollsStillExact
  &&original2024MissingYeaStillProven&&judiciary2025FullDigestProof
  &&onlyOriginal2024Mismatch&&unmatchedRollKeysEliminated
  &&otherMismatchCategoriesClean
  &&out.matchedCandidateRollCallEvents===152
  &&out.matchingCandidateNamedChoiceTokensWithNonNullMembership===979;
 let status:'FULL_8_OF_8'|'HOLD'='HOLD';
 let reason:'COMPLETE'|'STORED_BASELINE_OR_SOURCE_DOCUMENT_DRIFT'|
  'PREVIOUS_ORIGINAL_ROLL_BASELINE_CHANGED'|'2024_YEA_ANCHOR_CHANGED'|
  'TALLY_OR_EVENT_MATCH_UNVERIFIED'|'NAMED_CHOICE_OR_MEMBER_MATCH_UNVERIFIED'|
  'ADDITIONAL_UNEXPLAINED_MISMATCH'='ADDITIONAL_UNEXPLAINED_MISMATCH';
 if(full){status='FULL_8_OF_8';reason='COMPLETE'}
 else if(!existingStoredCohortMatchesV2)reason='STORED_BASELINE_OR_SOURCE_DOCUMENT_DRIFT';
 else if(!originalDetailed2025SourceStillExact||!earlierDetailedRollsStillExact)
  reason='PREVIOUS_ORIGINAL_ROLL_BASELINE_CHANGED';
 else if(!original2024MissingYeaStillProven)reason='2024_YEA_ANCHOR_CHANGED';
 else if(mismatch.persisted_roll_call_tally_mismatch>0
  ||mismatch.persisted_event_date_mismatch>0
  ||mismatch.missing_original_roll_call_event>0
  ||mismatch.duplicate_persisted_roll_call>0)
  reason='TALLY_OR_EVENT_MATCH_UNVERIFIED';
 else if(mismatch.original_named_choices_mismatch>1
  ||mismatch.unresolved_persisted_member_identity>0
  ||!judiciary2025FullDigestProof)
  reason='NAMED_CHOICE_OR_MEMBER_MATCH_UNVERIFIED';
 const result={
  schemaVersion:'mn-864-2025-judiciary-postrollback-v6-safe-numeric-diagnostic',
  issue:864,
  priorV5HeldRunId:38266959992,
  priorV5HeldIssueReceiptId:6126911116,
  priorV2ProtectedRunId:38201074454,
  priorV4ProtectedRunId:38262800243,
  independentlyVerifiedOriginalJudiciaryArtifactId:JUDICIARY_2025_ORIGINAL_PROOF.originalArtifactId,
  original2025JudiciaryYea:7,original2025JudiciaryNay:1,
  original2025JudiciaryChoiceHashes:8,
  originalPdfHashProofsAvailable:out.originalPdfsWithIndependentRawPdfSha,
  storedPdfHashMatches:out.sourceParsedRawPdfShaMatches,
  sourceDetailedCandidateRolls:out.sourceCandidateRollCallEvents,
  sourceDetailedNamedChoiceTokens:out.sourceCandidateNamedChoiceTokens,
  storedCommitteeEvents:out.persistedCommitteeVoteEvents,
  storedCommitteeChoices:out.persistedCommitteeMemberVoteRows,
  original2025DetailedRolls:current2025.recognizedOriginalRollCalls,
  original2025DetailedChoices:current2025.originalNamedChoiceTokens,
  matched2025DetailedRolls:current2025.matchedRecognizedRollCalls,
  matched2025DetailedChoices:current2025.matchedNamedChoiceTokens,
  matchedAllYearsDetailedRolls:out.matchedCandidateRollCallEvents,
  matchedAllYearsDetailedChoices:out.matchingCandidateNamedChoiceTokensWithNonNullMembership,
  namedMismatchRolls:d.sourceRollEventsWithNamedChoiceMismatch,
  namedMismatchOriginalTokens:d.originalNamedTokensInThoseRolls,
  namedMismatchStoredTokens:d.persistedNamedTokensInThoseRolls,
  namedMismatchDigestIntersections:d.exactChoiceDigestIntersectionTokensInThoseRolls,
  originalChoiceDigestsAbsent:d.originalNamedChoiceTokensAbsentFromPersistedDigestSet,
  storedChoiceDigestsNotInOriginal:d.storedNamedChoiceTokensNotInOriginalDigestSet,
  missingSingleSourceYeaChoices:d.oneOriginalTokenYeaDeficit,
  missingSingleSourceNayChoices:d.oneOriginalTokenNayDeficit,
  sourceNamedChoiceMismatchCategories:mismatch.original_named_choices_mismatch,
  sourceEventTallyMismatchCategories:mismatch.persisted_roll_call_tally_mismatch,
  sourceEventDateMismatchCategories:mismatch.persisted_event_date_mismatch,
  sourceEventMissingCategories:mismatch.missing_original_roll_call_event,
  sourceEventExtraStoredCategories:mismatch.persisted_vote_event_not_matched_to_source,
  sourceMemberUnresolvedCategories:mismatch.unresolved_persisted_member_identity,
  sourceDocumentHashMismatchCategories:mismatch.original_pdf_hash_mismatch,
  sourceDocumentMetadataMismatchCategories:mismatch.source_meeting_or_committee_mismatch,
  storedBaselineMatchesV2:existingStoredCohortMatchesV2,
  otherOriginalRollsStillMatchV2:earlierDetailedRollsStillExact,
  original2025SourceTotalsExact:originalDetailed2025SourceStillExact,
  earlier2024MissingYeaAnchorStillProven:original2024MissingYeaStillProven,
  individual2025FingerprintParity:status,
  explicitHoldReason:reason,
  transactionReadOnly:true,
  transactionRolledBack:true,
  noDatabaseWrites:true,
  noPrivateRowsMemberNamesUrlsOrChoiceHashesExported:true,
  existingNeonDefaultBranchNotDeployedBinding:true,
  sourceCandidatesNotCompleteOfficialVoteUniverse:true,
  historicalEligibilityNotCertified:true,
  print2021Print2022And141MeetingsHeld:true,
  noProductionRepairOrPredictionChangeAuthorized:true,
  issue864StillOpen:true,
 };
 const serial=JSON.stringify(result);
 if(serial.length>6500||/postgresql:|neondb_owner|normalized_member_name|source_url|externalKey|choiceIdentitySha256|sourceSha|memberName|membership_id/i.test(serial))
  throw Error('Only numeric and enumerated original roll diagnostics permitted');
 return result;
}

async function main(){
 if(process.argv.length!==3
  ||!['--source-preflight','--protected'].includes(process.argv[2]))
  throw Error('Only fixed SHA-pinned original source preflight or protected V6');
 let phase='source_sha_preflight';
 try{
  const fixed=sourceShaPinnedMerged();
  if(process.argv[2]==='--source-preflight'){
   console.log('SENATE_864_JUDICIARY_2025_V6_PINNED_21_ORIGINAL_SOURCE_PROOFS=1');
   return;
  }
  assertProtectedOneShot(process.env);
  if(process.env.VOTEPREDICT_864_JUDICIARY_V6_MARKER_PRESENT!=='true')
   throw Error('Distinct first-attempt V6 marker absent');
  phase='protected_original_source_to_stored_query';
  const observed=await protectedCommitteeSourceParity(fixed.years,{
   apiKey:process.env.NEON_API_KEY?.trim()??'',
   projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim()??'',
   preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined,
  },fetch,o=>new Pool(o),p=>{phase=p},fixed.knownKeyOnlyOriginalEvents);
  const receipt=build2025JudiciaryPostRollbackV6(observed);
  const data=JSON.stringify(receipt);
  if(process.env.GITHUB_OUTPUT)
   appendFileSync(process.env.GITHUB_OUTPUT,
    'sanitized_judiciary_v6_b64='+Buffer.from(data).toString('base64')+'\n');
  console.log('SENATE_864_2025_JUDICIARY_V6_SANITIZED_RESULT='+data);
 }catch{
  console.error('SENATE_864_2025_JUDICIARY_V6_FAILED_CLOSED phase='+phase);
  if(process.env.GITHUB_OUTPUT&&/^[a-z_]{1,80}$/.test(phase))
   appendFileSync(process.env.GITHUB_OUTPUT,'safe_failure_phase='+phase+'\n');
  process.exitCode=1;
 }
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/audit-senate-864-2025-judiciary-postrollback-v6.ts'))
 void main();
