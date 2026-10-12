/**
 * #864 V3: infer the YEA/NAY tally *side* of the one independently proven
 * missing 2024 source-choice SHA. Never identify/export a person or write rows.
 * Uses EXACT same 20 SHA-pinned original metadata artifacts and three bounded
 * SELECTs as protected V2. All saved SQL names/choices remain in memory only.
 */
import {readFileSync,appendFileSync} from 'node:fs';
import {Pool} from 'pg';
import {assertProtectedOneShot} from './audit-senate-864-neon-one-key-readonly-coverage.js';
import {protectedCommitteeSourceParity,verifyPinnedOfficialSourceManifests} from
 './audit-senate-864-protected-source-db-parity.js';
import {mergeSourceAuditsWithAuthenticated207Ocr} from
 './merge-senate-864-ocr-207-original-proof-metadata.js';

export const ONE_MISSING_CHOICE_SIDE_MARKER=
 'SENATE_864_SINGLE_CHOICE_TALLY_SIDE_ONESHOT_20261012_V3' as const;

type Audit=Awaited<ReturnType<typeof protectedCommitteeSourceParity>>;
const REQUIRED_FIELDS=[
 ['originalPdfUrls','sourceOriginalPdfUrlReferences'],
 ['independentlyShaKnown','originalPdfsWithIndependentRawPdfSha'],
 ['oneToOneStoredSourceUrls','sourceExactUrlOneToOne'],
 ['matchingOriginalRawSha','sourceParsedRawPdfShaMatches'],
 ['originalRawShaMismatches','sourceParsedRawPdfShaMismatches'],
 ['missingStoredSourceUrls','originalUrlsAbsentFromStoredRecords'],
 ['duplicatePersistedSourceUrls','duplicateStoredUrlsForOriginals'],
 ['extraStoredOriginalDocuments','storedRowsOutsideOriginalUrlSet'],
 ['originalDetailedRolls','sourceCandidateRollCallEvents'],
 ['fullyMatchedDetailedRolls','matchedCandidateRollCallEvents'],
 ['originalDetailedNamedTokens','sourceCandidateNamedChoiceTokens'],
 ['matchedDetailedNamedTokens','matchingCandidateNamedChoiceTokensWithNonNullMembership'],
 ['persistedCommitteeEvents','persistedCommitteeVoteEvents'],
 ['persistedCommitteeChoices','persistedCommitteeMemberVoteRows'],
] as const;

/**
 * A protected count-only transformation. Frozen V2 receipt must match:
 * unexpected protected DB changes are a HOLD, not an invented new result.
 */
export function buildSingleChoiceSafeReceipt(observed:Audit){
 const prior=JSON.parse(readFileSync(
  'docs/evaluation/source-proof/senate-864-v2-all-1452-original-pdf-neon-parity-receipt.json',
  'utf8')) as Record<string,any>;
 if(prior.receiptId!==6117412541||prior.protectedRunId!==38201074454
  ||prior.mainCommit!=='7fd5fe14e9819b5e5a084c67529b2d383211f4a1'
  ||prior.transaction?.readOnly!==true||prior.transaction?.explicitRollback!==true)
  throw Error('Pinned independent original source/Neon V2 receipt drift');
 if(observed.status!=='verified_default_neon_branch_original_to_stored_source_audit'
  ||observed.pinnedOfficialOriginalSourceRun!==38066441841
  ||observed.protectedTransactionReadOnly!==true
  ||observed.transactionRollbackCompleted!==true
  ||observed.authenticatedNeonDefaultBranch!==true
  ||observed.deployedProductionBindingIndependentlyVerified!==false
  ||observed.noDatabaseMutations!==true
  ||observed.noPrivateRawRowExports!==true
  ||observed.sourceContextActionsReconciled!==false
  ||observed.fullHistoricalReconciliationCertified!==false)
  throw Error('Protected read-only source audit scope not established');
 for(const [proofField,observedField] of REQUIRED_FIELDS){
  if(!Number.isSafeInteger(observed[observedField])
   ||observed[observedField]!==prior.counts[proofField])
   throw Error('New protected source/database counts drift from verified V2 cohort');
 }
 const expected=[
  ['sourceRecognizedButOriginalTallyOrNameDigestsUnavailable','keyOnlyOriginalRolls'],
  ['persistedExactKeyAndHearingDateMatches','keyOnlyEventUrlHashDateMatches'],
  ['persistedKeyDateAndChoiceCountMatches','keyOnlyChoiceCountMatches'],
  ['sourceKeyOnlyNamedChoiceTokens','keyOnlyChoiceTokensUnverified'],
 ] as const;
 for(const [field,proofField] of expected)
  if(observed.keyOnlyOriginalEventVerification[field]!==prior.counts[proofField])
   throw Error('Known key-only original proof counts changed');
 const d=observed.originalVsPersistedNamedChoiceDigestDiscrepancy;
 const countCompare=[
  ['sourceRollEventsWithNamedChoiceMismatch','namedMismatchRolls'],
  ['originalNamedTokensInThoseRolls','namedMismatchSourceTokens'],
  ['persistedNamedTokensInThoseRolls','namedMismatchPersistedTokens'],
  ['exactChoiceDigestIntersectionTokensInThoseRolls','namedMismatchDigestIntersection'],
  ['originalNamedChoiceTokensAbsentFromPersistedDigestSet','sourceTokensMissingFromStored'],
  ['storedNamedChoiceTokensNotInOriginalDigestSet','storedTokensNotInSource'],
 ] as const;
 for(const [metric,proof] of countCompare)
  if(d[metric]!==prior.counts[proof])throw Error('Mismatch cohort changed from verified V2');
 if(!Array.isArray(observed.byYear)||observed.byYear.length!==4
  ||observed.byYear.some((year,i)=>{
   const older=prior.byYear?.[i];
   return !older||year.year!==older.year
    ||Object.entries(older).some(([field,number])=>
     (year as unknown as Record<string,unknown>)[field]!==number);
  }))
  throw Error('2022–25 source/DB by-year comparison drift');
 const yes=d.oneOriginalTokenYeaDeficit,no=d.oneOriginalTokenNayDeficit;
 const hold=d.oneOriginalTokenSideHeld;
 if(d.oneOriginalTokenAbsentAllStoredHashesExact!==1
  ||yes+no+hold!==1
  ||d.storedRowsOnSingleTokenRollWithMembership+
     d.storedRowsOnSingleTokenRollWithoutMembership!==9
  ||[yes,no,hold,d.storedRowsOnSingleTokenRollWithMembership,
     d.storedRowsOnSingleTokenRollWithoutMembership].some(n=>
      !Number.isSafeInteger(n)||n<0||n>9))
  throw Error('One-token direction classifier did not meet exact digest gate');
 return {
  schemaVersion:'mn-864-one-missing-2024-choice-source-tally-side-v3' as const,
  issue:864 as const,
  scope:'one-original-2024-roll-missing-choice-token' as const,
  previousV2ProtectedRunId:38201074454 as const,
  previousV2IssueReceiptId:6117412541 as const,
  originalPdfRawShaAndStoredSourceParities:1452 as const,
  detailedOriginalRolls:152 as const,
  fullyMatchedOriginalRolls:151 as const,
  originalChoiceTokensOnDiscrepantRoll:10 as const,
  exactStoredChoiceDigestIntersectionsOnDiscrepantRoll:9 as const,
  originalChoiceTokensAbsentFromStored:1 as const,
  unexpectedStoredChoiceTokens:0 as const,
  inferredMissingTallySide:yes===1?'YEA' as const:no===1?'NAY' as const:'HOLD' as const,
  oneMissingYeaSideCandidate:yes,
  oneMissingNaySideCandidate:no,
  sideHeld:hold,
  exactStoredChoiceRowsWithMembershipId:d.storedRowsOnSingleTokenRollWithMembership,
  exactStoredChoiceRowsWithoutMembershipId:d.storedRowsOnSingleTokenRollWithoutMembership,
  transactionReadOnly:true as const,
  transactionRolledBack:true as const,
  noDatabaseWrites:true as const,
  defaultNeonBranchOnlyNotDeployedBinding:true as const,
  candidateParserNotOfficialAllVotesDenominator:true as const,
  memberIdentityOfMissingTokenNeverExported:true as const,
  no2024SourceChoiceRepaired:true as const,
  keyOnly2025OriginalStillUnverified:true as const,
  historicalAvailabilityNotCertified:true as const,
 };
}
async function main(){
 if(process.argv.length!==3
  ||!['--source-preflight','--protected'].includes(process.argv[2]))
  throw Error('Expected one fixed SHA-pinned preflight or protected read-only audit mode');
 let phase='source_sha_preflight';
 try{
  const reports=verifyPinnedOfficialSourceManifests();
  const merged=mergeSourceAuditsWithAuthenticated207Ocr(reports);
  const {compareOriginalSenateCommitteeToStored}=await import(
   '../src/evidence/senate-864-source-db-sanitized-compare.js');
  const dry=compareOriginalSenateCommitteeToStored(
   merged.years,{documents:[],events:[],choices:[]},merged.knownKeyOnlyOriginalEvents);
  if(dry.sourceOriginalPdfUrlReferences!==1452
   ||dry.originalPdfsWithIndependentRawPdfSha!==1452
   ||dry.sourceCandidateRollCallEvents!==152
   ||dry.sourceCandidateNamedChoiceTokens!==981
   ||merged.metadata.allOriginalCandidateRollsIncludingKeyOnly!==153
   ||merged.metadata.totalSourceNamedChoiceTokens!==989)
   throw Error('Fixed independent original PDF/source event universe has drifted');
  if(process.argv[2]==='--source-preflight'){
   console.log('VOTEPREDICT_864_V3_INDEPENDENT_ORIGINAL_PDF_SHA_PREFLIGHT_PASSED=1452');
   return;
  }
  assertProtectedOneShot(process.env);
  if(process.env.VOTEPREDICT_864_SINGLE_CHOICE_MARKER_PRESENT!=='true')
   throw Error('Unique V3 reviewed protected marker not present');
  phase='protected_neon_query';
  const out=await protectedCommitteeSourceParity(merged.years,{
   apiKey:process.env.NEON_API_KEY?.trim()??'',
   projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim()??'',
   preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined,
  },fetch,opts=>new Pool(opts),p=>{phase=p},merged.knownKeyOnlyOriginalEvents);
  const receipt=buildSingleChoiceSafeReceipt(out);
  const data=JSON.stringify(receipt);
  if(data.length>5000
   ||/https?:\/\/|postgresql:|neondb_owner|normalized_member_name|source_url|documentId|externalKey|sourceSha|memberName/i.test(data))
   throw Error('Unsafe protected single-choice outcome');
  if(process.env.GITHUB_OUTPUT)
   appendFileSync(process.env.GITHUB_OUTPUT,
    'public_choice_side_b64='+Buffer.from(data,'utf8').toString('base64')+'\n');
  console.log('VOTEPREDICT_864_SINGLE_SOURCE_CHOICE_TALLY_SIDE='+data);
 }catch{
  console.error('VOTEPREDICT_864_MISSING_CHOICE_TALLY_SIDE_FAILED_CLOSED phase='+phase);
  if(process.env.GITHUB_OUTPUT&&/^[a-z_]{1,80}$/.test(phase))
   appendFileSync(process.env.GITHUB_OUTPUT,'safe_failure_phase='+phase+'\n');
  process.exitCode=1;
 }
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/audit-senate-864-single-choice-side-readonly-v3.ts'))
 void main();
