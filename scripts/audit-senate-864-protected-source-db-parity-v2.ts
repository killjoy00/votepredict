/**
 * #864 — one-shot V2: 1,245 initially readable government PDF byte SHA
 * sources + all 207 independently archived OCR PDF byte SHA sources.
 * Full original PDF byte SHA parity for precisely 1,452 electronically indexed
 * Senate 2022-25 minutes, plus event/member-choice detail classifier.
 *
 * No live writes, role grant, branch creation, source text, private DB exports,
 * prediction/ingestion changes. Strict pre-secret original source SHA check.
 */
import {appendFileSync} from 'node:fs';
import {Pool} from 'pg';
import {assertProtectedOneShot} from './audit-senate-864-neon-one-key-readonly-coverage.js';
import {
 protectedCommitteeSourceParity,verifyPinnedOfficialSourceManifests,
} from './audit-senate-864-protected-source-db-parity.js';
import {mergeSourceAuditsWithAuthenticated207Ocr} from
 './merge-senate-864-ocr-207-original-proof-metadata.js';
export const COMPLETE_OCR_PARITY_ONESHOT_MARKER=
 'SENATE_864_FULL_207_OCR_NEON_PARITY_ONESHOT_20261012_V2' as const;

async function main(){
 if(process.argv.length!==3
   ||!['--source-preflight','--protected'].includes(process.argv[2]))
  throw Error('Specify exactly a fixed OCR original source preflight or protected audit');
 let phase='original_plus_ocr_sha_preflight';
 try{
  const original=verifyPinnedOfficialSourceManifests();
  const merged=mergeSourceAuditsWithAuthenticated207Ocr(original);
  // Dry-run the EXACT protected source-to-DB comparator against a synthetic
  // empty stored cohort BEFORE secrets; this validates all 1,452 original
  // source documents, 152 exact recognized vote digests and 1 key-only hold.
  const {compareOriginalSenateCommitteeToStored}=await import(
   '../src/evidence/senate-864-source-db-sanitized-compare.js');
  const dry=compareOriginalSenateCommitteeToStored(
   merged.years,{documents:[],events:[],choices:[]},merged.knownKeyOnlyOriginalEvents,
  );
  if(dry.sourceOriginalPdfUrlReferences!==1452
    ||dry.originalPdfsWithIndependentRawPdfSha!==1452
    ||dry.originalPdfsWithoutIndependentRawPdfSha!==0
    ||dry.sourceCandidateRollCallEvents!==152
    ||dry.sourceCandidateNamedChoiceTokens!==981
    ||dry.keyOnlyOriginalEventVerification.sourceRecognizedButOriginalTallyOrNameDigestsUnavailable!==1
    ||merged.metadata.allOriginalCandidateRollsIncludingKeyOnly!==153
    ||merged.metadata.totalSourceNamedChoiceTokens!==989)
   throw Error('Full 2022-25 authenticated original PDF OCR source census validation failed');
  if(process.argv[2]==='--source-preflight'){
   console.log('VOTEPREDICT_864_SHA_PINNED_1452_PDFS_INCLUDING_207_ORIGINAL_OCR_RECOVERIES_VERIFIED=1452');
   return;
  }
  assertProtectedOneShot(process.env);
  if(process.env.VOTEPREDICT_864_FULL_OCR_PARITY_MARKER_PRESENT!=='true')
   throw Error('Exact unique fully OCR-enriched one-shot reviewed marker absent');
  phase='protected_neon_query';
  const out=await protectedCommitteeSourceParity(merged.years,{
   apiKey:process.env.NEON_API_KEY?.trim()??'',
   projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim()??'',
   preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined,
  },fetch,opts=>new Pool(opts),x=>{phase=x},
   merged.knownKeyOnlyOriginalEvents);
  if(out.sourceOriginalPdfUrlReferences!==1452
    ||out.originalPdfsWithIndependentRawPdfSha!==1452
    ||out.originalPdfsWithoutIndependentRawPdfSha!==0)
   throw Error('Authenticated Neon source coverage did not meet exact original 1452');
  const report={
   ...out,
   schemaVersion:'mn-864-senate-committee-all-1452-original-sha-ocr-neon-parity-v2',
   originalSourceAndOcrScope:merged.metadata,
   noHistoricalAvailabilityOrAsOfPredictionCertification:true,
   one2025OriginalRollRemainsKeyOnlyNoTallyOrNamedDigest:true,
   persisted2024ChoiceMismatchNoLiveRepairPerformed:true,
  };
  const data=JSON.stringify(report);
  if(data.length>26000||/https?:\/\/|postgresql:|neondb_owner|normalized_member_name|source_url|documentId|externalKey/i.test(data))
   throw Error('Private source metadata or data escaped into the sanitized parity output');
  if(process.env.GITHUB_OUTPUT)
   appendFileSync(process.env.GITHUB_OUTPUT,
    'public_full_ocr_parity_b64='+Buffer.from(data,'utf8').toString('base64')+'\n');
  console.log('VOTEPREDICT_864_SANITIZED_FULL_1452_ORIGINAL_SHA_NEON_PARITY='+data);
 }catch{
  console.error('VOTEPREDICT_864_COMPLETE_OCR_ORIGINAL_NEON_PARITY_FAILED_CLOSED phase='+phase);
  if(process.env.GITHUB_OUTPUT&&/^[a-z_]{1,80}$/.test(phase))
   appendFileSync(process.env.GITHUB_OUTPUT,'safe_failure_phase='+phase+'\n');
  process.exitCode=1;
 }
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/audit-senate-864-protected-source-db-parity-v2.ts'))
 void main();
