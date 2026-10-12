/**
 * #864 V5 one-time existing Neon READ ONLY original source/DB parity.
 * Additional authenticated original-source proof: 2025-03-12 Judiciary
 * 7 YEA/1 NAY with eight one-way choice fingerprints. Reuse existing three
 * bounded SELECTs, READ ONLY REPEATABLE READ and explicit ROLLBACK.
 *
 * No private stored row/source member names/digests/URL exposed or changed.
 */
import {appendFileSync,readFileSync} from 'node:fs';
import {Pool} from 'pg';
import {assertProtectedOneShot} from './audit-senate-864-neon-one-key-readonly-coverage.js';
import {protectedCommitteeSourceParity,verifyPinnedOfficialSourceManifests} from
 './audit-senate-864-protected-source-db-parity.js';
import {mergeSourceAuditsWithAuthenticated207Ocr} from
 './merge-senate-864-ocr-207-original-proof-metadata.js';
import {promoteOne2025JudiciaryOriginalToFullyHashedProof,JUDICIARY_2025_ORIGINAL_PROOF} from
 './senate-864-2025-judiciary-full-source-proof-v5.js';
import {compareOriginalSenateCommitteeToStored} from
 '../src/evidence/senate-864-source-db-sanitized-compare.js';

export const JUDICIARY_2025_FULL_SOURCE_ONESHOT_MARKER=
 'SENATE_864_JUDICIARY_2025_FULL_ORIGINAL_NEON_ONESHOT_20261012_V5' as const;

type Output=Awaited<ReturnType<typeof protectedCommitteeSourceParity>>;
const BASELINE='docs/evaluation/source-proof/senate-864-v2-all-1452-original-pdf-neon-parity-receipt.json';
export function sourceShaPinnedMerged(){
 const original=verifyPinnedOfficialSourceManifests();
 const merged=mergeSourceAuditsWithAuthenticated207Ocr(original);
 const bytes=readFileSync('artifacts/judiciary/'+JUDICIARY_2025_ORIGINAL_PROOF.artifactJsonFilename);
 const upgraded=promoteOne2025JudiciaryOriginalToFullyHashedProof(merged,bytes);
 const dry=compareOriginalSenateCommitteeToStored(
  upgraded.years,{documents:[],events:[],choices:[]});
 if(dry.sourceOriginalPdfUrlReferences!==1452
  ||dry.originalPdfsWithIndependentRawPdfSha!==1452
  ||dry.originalPdfsWithoutIndependentRawPdfSha!==0
  ||dry.sourceCandidateRollCallEvents!==153
  ||dry.sourceCandidateNamedChoiceTokens!==989
  ||dry.keyOnlyOriginalEventVerification.sourceRecognizedButOriginalTallyOrNameDigestsUnavailable!==0
  ||upgraded.metadata.sourceNamedChoiceTokensWithoutIndividualDigestProof!==0)
  throw Error('2022–25 1452 original PDFs and fully detailed 153 source roll universe not pinned');
 return upgraded;
}

/** Strictly scalar comparison; never emits source rows or names. */
export function build2025JudiciaryFullSourceSanitizedV5(out:Output){
 const old=JSON.parse(readFileSync(BASELINE,'utf8')) as Record<string,any>;
 if(old.receiptId!==6117412541||old.protectedRunId!==38201074454
  ||old.mainCommit!=='7fd5fe14e9819b5e5a084c67529b2d383211f4a1'
  ||old.transaction?.readOnly!==true||old.transaction?.explicitRollback!==true)
  throw Error('Pinned earlier V2 protected source result changed');
 if(out.status!=='verified_default_neon_branch_original_to_stored_source_audit'
  ||out.authenticatedNeonDefaultBranch!==true
  ||out.deployedProductionBindingIndependentlyVerified!==false
  ||out.pinnedOfficialOriginalSourceRun!==38066441841
  ||out.protectedTransactionReadOnly!==true||out.transactionRollbackCompleted!==true
  ||out.noDatabaseMutations!==true||out.noPrivateRawRowExports!==true
  ||out.sourceContextActionsReconciled!==false||out.fullHistoricalReconciliationCertified!==false
  ||out.sourceOriginalPdfUrlReferences!==1452
  ||out.originalPdfsWithIndependentRawPdfSha!==1452
  ||out.originalPdfsWithoutIndependentRawPdfSha!==0
  ||out.sourceExactUrlOneToOne!==1452
  ||out.sourceParsedRawPdfShaMatches!==1452
  ||out.sourceParsedRawPdfShaMismatches!==0
  ||out.originalUrlsAbsentFromStoredRecords!==0
  ||out.duplicateStoredUrlsForOriginals!==0
  ||out.storedRowsOutsideOriginalUrlSet!==0
  ||out.sourceCandidateRollCallEvents!==153
  ||out.sourceCandidateNamedChoiceTokens!==989
  ||out.persistedCommitteeVoteEvents!==153
  ||out.persistedCommitteeMemberVoteRows!==988)
  throw Error('Existing Neon default/source cohort not the frozen independent V2 cohort');
 const k=out.keyOnlyOriginalEventVerification;
 if(k.sourceRecognizedButOriginalTallyOrNameDigestsUnavailable!==0
  ||k.persistedExactKeyAndHearingDateMatches!==0
  ||k.persistedKeyDateAndChoiceCountMatches!==0
  ||k.sourceKeyOnlyNamedChoiceTokens!==0
  ||k.storedCountMatchedButIndividualNamedChoiceIdentitiesNotProven!==0)
  throw Error('Previously key-only Judiciary original was not fully upgraded');
 const rows=out.byYear;
 if(rows.length!==4)throw Error('Original year universe changed');
 for(let i=0;i<4;i++){
  const now=rows[i]!,previous=old.byYear[i];
  if(now.year!==2022+i||previous?.year!==now.year)
   throw Error('Year source order changed');
  for(const name of [
   'originalPdfUrls','exactUrlOneToOne','parsedOriginalPdfs',
   'originalParsedRawShaMatches','originalParsedRawShaMismatches',
   'parsedMetadataMatches','parsedMetadataMismatches',
   'missingOriginalUrls','duplicateStoredOriginalUrls',
   'storedCommitteeEvents','storedCommitteeMemberChoices',
  ] as const)
   if(now[name]!==previous[name])throw Error('Frozen source/stored year identity drift');
  if(i!==3)for(const name of [
    'recognizedOriginalRollCalls','matchedRecognizedRollCalls',
    'originalNamedChoiceTokens','matchedNamedChoiceTokens',
   ] as const)
    if(now[name]!==previous[name])throw Error('Unchanged original 2022–24 roll cohort drift');
 }
 const y=rows[3]!;
 if(y.recognizedOriginalRollCalls!==33
  ||y.originalNamedChoiceTokens!==305
  ||y.storedCommitteeEvents!==33||y.storedCommitteeMemberChoices!==305)
  throw Error('2025 original detailed source/doc/stored choice cohort changed');
 // The original 2024 10-source/9-stored sha deficit and precise YEA side
 // must still be present; never misattribute that single outstanding row to 2025.
 const d=out.originalVsPersistedNamedChoiceDigestDiscrepancy;
 if(d.oneOriginalTokenYeaDeficit!==1
  ||d.oneOriginalTokenNayDeficit!==0
  ||d.originalNamedChoiceTokensAbsentFromPersistedDigestSet<1
  ||d.originalNamedTokensInThoseRolls<10)
  throw Error('Previously independently proven 2024 YEA-side missing token changed');
 const exact=(y.matchedRecognizedRollCalls===33 && y.matchedNamedChoiceTokens===305);
 if(y.matchedRecognizedRollCalls<32||y.matchedRecognizedRollCalls>33
  ||y.matchedNamedChoiceTokens<297||y.matchedNamedChoiceTokens>305
  ||(y.matchedRecognizedRollCalls===33)!==(y.matchedNamedChoiceTokens===305))
  throw Error('2025 source-to-persisted original 8-choice result is not safely classifiable');
 if(exact&&(out.matchedCandidateRollCallEvents!==152
  ||out.matchingCandidateNamedChoiceTokensWithNonNullMembership!==979
  ||d.sourceRollEventsWithNamedChoiceMismatch!==1
  ||d.originalNamedTokensInThoseRolls!==10
  ||d.persistedNamedTokensInThoseRolls!==9
  ||d.exactChoiceDigestIntersectionTokensInThoseRolls!==9
  ||d.originalNamedChoiceTokensAbsentFromPersistedDigestSet!==1
  ||d.storedNamedChoiceTokensNotInOriginalDigestSet!==0))
  throw Error('Fully matching 2025 source cannot silently change the 2024 known 1-choice hold');
 return {
  schemaVersion:'mn-864-2025-judiciary-fully-hashed-original-neon-v5',
  issue:864,
  firstIndependentSourceRun:JUDICIARY_2025_ORIGINAL_PROOF.originalRunId,
  sourceProofArtifactId:JUDICIARY_2025_ORIGINAL_PROOF.originalArtifactId,
  priorV2ProtectedRun:38201074454,
  priorV2IssueReceipt:6117412541,
  verified2025OriginalMeetingDay:'2025-03-12',
  independentOriginal2025Yea:7,
  independentOriginal2025Nay:1,
  independentOriginal2025ChoiceFingerprints:8,
  originalPdfShaReverifiedInFrozenUniverse:1452,
  originalDetailedCandidateRolls:153,
  originalNamedChoiceFingerprintTokens:989,
  originalKeyOnlyRollsRemaining:0,
  persistedCommitteeEvents:153,
  persistedCommitteeChoices:988,
  sourceDetailedCandidateRollsMatched:out.matchedCandidateRollCallEvents,
  sourceDetailedNamedChoiceTokensMatched:out.matchingCandidateNamedChoiceTokensWithNonNullMembership,
  matchingOriginal2025DetailedCandidateRolls:y.matchedRecognizedRollCalls,
  original2025DetailedCandidateRolls:33,
  original2025DetailedNamedChoiceTokens:305,
  matchingOriginal2025DetailedNamedChoiceTokens:y.matchedNamedChoiceTokens,
  verified2025JudiciaryChoiceFingerprintParity:exact?'FULL_8_OF_8':'HOLD',
  source2024SingleMissingYeaSideReproved:true,
  original2024SingleYeaChoiceAbsentFromStored:1,
  originalYear2021PrintAndUnlinkedMeetingHold:true,
  original2022PrintElectronicEquivalenceUnproven:true,
  parserCandidateUniverseNotOfficialAllActions:true,
  historicalAvailabilityAndServiceIdentityNotCertified:true,
  existingDefaultNeonNotIndependentlyProvenDeployedBinding:true,
  protectedTransactionReadOnly:true,
  protectedTransactionRolledBack:true,
  noDatabaseWrites:true,
  noPrivateMemberNamesOrRowsOrChoiceDigestsEmitted:true,
  noVoteOrPredictionRepairAuthorized:true,
  parentIssueStillOpen:true,
 };
}
async function main(){
 if(process.argv.length!==3
  ||!['--source-preflight','--protected'].includes(process.argv[2]))
  throw Error('Only fixed original government SHA source preflight or protected V5 check');
 let phase='independent_2025_judiciary_and_1452_original_source_sha';
 try{
  const upgraded=sourceShaPinnedMerged();
  if(process.argv[2]==='--source-preflight'){
   console.log('SENATE_864_V5_SHA_PINNED_1452_PDFS_AND_8_JUDICIARY_SOURCE_DIGESTS_VERIFIED=1');
   return;
  }
  assertProtectedOneShot(process.env);
  if(process.env.VOTEPREDICT_864_JUDICIARY_2025_V5_MARKER_PRESENT!=='true')
   throw Error('Unique V5 reviewed existing source-to-Neon full-Judiciary proof marker absent');
  phase='protected_readonly_original_neon';
  const out=await protectedCommitteeSourceParity(upgraded.years,{
   apiKey:process.env.NEON_API_KEY?.trim()??'',
   projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim()??'',
   preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined,
  },fetch,o=>new Pool(o),p=>{phase=p},upgraded.knownKeyOnlyOriginalEvents);
  const result=build2025JudiciaryFullSourceSanitizedV5(out);
  const body=JSON.stringify(result);
  if(body.length>5000
    ||/https?:\/\/|postgresql:|neondb_owner|normalized_member_name|source_url|externalKey|choiceIdentitySha256|sourceSha|memberName/i.test(body))
   throw Error('Unsafe source/stored original detail escaped into public V5 output');
  if(process.env.GITHUB_OUTPUT)
   appendFileSync(process.env.GITHUB_OUTPUT,
    'sanitized_judiciary_2025_b64='+Buffer.from(body).toString('base64')+'\n');
  console.log('SENATE_864_V5_2025_JUDICIARY_SOURCE_PARITY='+body);
 }catch{
  console.error('SENATE_864_2025_JUDICIARY_ORIGINAL_NEON_V5_HELD phase='+phase);
  if(process.env.GITHUB_OUTPUT&&/^[a-z_]{1,80}$/.test(phase))
   appendFileSync(process.env.GITHUB_OUTPUT,'safe_failure_phase='+phase+'\n');
  process.exitCode=1;
 }
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/audit-senate-864-2025-judiciary-full-source-neon-v5.ts'))
 void main();
