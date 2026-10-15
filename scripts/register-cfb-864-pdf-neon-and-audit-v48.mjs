/**
 * #864 V48 guarded, one-shot GitHub Actions Neon registry import and
 * historical finance date triage. Writes ONLY the new official PDF metadata
 * table + its migration ledger entry. Existing financial evidence untouched.
 */
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {appendFileSync} from 'node:fs';
import {Pool} from 'pg';
import {pathToFileURL} from 'node:url';
import {discoverExistingVotePredictNeonConnection}
 from '../src/operations/senate-media-neon-api-readonly.js';
import {SCHEMA,registry830,INSERT_SQL,VERIFY_SQL,REVALIDATE_SQL,safeRevalidation}
 from '../src/evidence/cfb-864-pdf-registry-eligibility-v48.mjs';

export const MARKER='SENATE_864_CFB_PDF_LINK_REVALIDATE_V48';
const MIGRATION='0014_cfb_official_senate_pdf_versions.sql';
const hex=/^[0-9a-f]{64}$/;

export function assertProtectedScope(e){
 if(e.GITHUB_REPOSITORY!=='killjoy00/votepredict'
   ||e.GITHUB_EVENT_NAME!=='push'
   ||e.GITHUB_REF!=='refs/heads/main'
   ||e.GITHUB_RUN_ATTEMPT!=='1'
   ||!/^[a-f0-9]{40}$/.test(e.GITHUB_SHA??'')
   ||e.VOTEPREDICT_864_CFB_V48_VERIFIED!=='true'
   ||e.VOTEPREDICT_864_CFB_V48_MARKER!=='true')
  throw Error('Only independently checked first-attempt main commit may import CFB PDF registry');
}
export function expectedMigrationLedger(){
 const names=readdirSync('migrations').filter(x=>/^\d{4}_[\w-]+\.sql$/.test(x)).sort();
 if(names.length!==14||names.at(-1)!==MIGRATION)
  throw Error('Unexpected tracked VotePredict migration set');
 return names.map(filename=>({
  filename,checksum:createHash('sha256').update(readFileSync('migrations/'+filename)).digest('hex')
 }));
}
export function assertPriorMigrationLedger(stored,expected){
 if(!Array.isArray(stored)||!Array.isArray(expected)||expected.length!==14
  ||!expected.every((m,i)=>typeof m.filename==='string'
    &&hex.test(m.checksum)&&(i===0||expected[i-1].filename<m.filename))
  ||stored.length<13||stored.length>14)throw Error('Unexpected migrated database revision');
 const previous=expected.slice(0,-1);
 for(let i=0;i<13;i++){
  if(stored[i]?.filename!==previous[i].filename
    ||stored[i]?.checksum!==previous[i].checksum)
   throw Error('Existing VotePredict schema migration checksum mismatch');
 }
 if(stored.length===14&&(stored[13].filename!==MIGRATION
    ||stored[13].checksum!==expected[13].checksum))
  throw Error('Unexpected existing PDF registry migration checksum');
 return stored.length===14;
}
export function safeRegistryProof(rows){
 if(!Array.isArray(rows)||rows.length!==1)throw Error('Registry not verified');
 const r=rows[0],keys=['stored','indexed','exact','missing','distinct_bodies'];
 if(!r||typeof r!=='object'||Array.isArray(r)
  ||Object.keys(r).length!==keys.length||Object.keys(r).some(k=>!keys.includes(k))
  ||keys.some(k=>typeof r[k]!=='string'||!/^\d+$/.test(r[k])))
  throw Error('Registry verification returned unexpected private columns');
 if(r.stored!=='830'||r.indexed!=='830'||r.exact!=='830'
   ||r.missing!=='0'||r.distinct_bodies!=='813')
  throw Error('Registered CFB PDF identities do not exactly match the government source census');
 return r;
}
export async function importOfficialCfbRegistryAndAudit(input,{
 discover=discoverExistingVotePredictNeonConnection,
 connect=options=>new Pool(options),onPhase=()=>{},
 now='2026-10-15'
}={}){
 // No protected credential is needed to authenticate this local immutable input.
 const records=registry830(),expectedMigrations=expectedMigrationLedger();
 if(records.length!==830)throw Error('CFB source count changed');
 onPhase('830_official_pdf_versions_local_sha_verified');
 const target=await discover({...input,requirePrimary:true});
 onPhase('existing_default_branch_primary_endpoint_verified');
 const pool=connect({
  host:target.host,port:target.port,user:target.role,password:target.password,
  database:target.database,ssl:{rejectUnauthorized:true},max:1,
  connectionTimeoutMillis:10000,statement_timeout:100000,query_timeout:110000,
  application_name:'votepredict-864-cfb-830-pdf-registry-v48',
  options:'-c statement_timeout=100000 -c lock_timeout=2500'
 });
 let transaction=false,phase='opening_existing_neon_primary',committed=false;
 try{
  const client=await pool.connect();
  try{
   phase='begin_single_bounded_transaction';
   await client.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE READ WRITE');
   transaction=true;
   onPhase('neon_single_transaction_opened');
   const identity=await client.query(
    "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro"
   );
   if(identity.rows.length!==1||identity.rows[0].db!==target.database
     ||identity.rows[0].role!==target.role||identity.rows[0].ro!=='off')
    throw Error('Wrong database, role or transaction type');
   phase='checking_existing_migration_ledger';
   const old=await client.query(
    'SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename'
   );
   const alreadyApplied=assertPriorMigrationLedger(old.rows,expectedMigrations);
   if(!alreadyApplied){
    phase='applying_nonserving_pdf_registry_migration';
    await client.query(readFileSync('migrations/'+MIGRATION,'utf8'));
    await client.query(
     'INSERT INTO votepredict_schema_migrations (filename,checksum) VALUES ($1,$2)',
     [MIGRATION,expectedMigrations[13].checksum]
    );
   }
   phase='registering_only_current_official_pdf_version_metadata';
   await client.query(INSERT_SQL,[JSON.stringify(records)]);
   phase='verifying_830_exact_registered_pdf_rows';
   const verified=safeRegistryProof(
    (await client.query(VERIFY_SQL,[JSON.stringify(records)])).rows
   );
   phase='historical_eligibility_triangulation_no_row_mutation';
   const grouped=safeRevalidation((await client.query(REVALIDATE_SQL)).rows);
   const sum=k=>grouped.reduce((n,row)=>n+Number(row[k]),0);
   const totals={
    eligibleCopies:sum('eligible_copies'),
    hasCandidateYearPdf:sum('candidate_year_candidates'),
    candidateYearAmbiguous:sum('ambiguous_candidate_pdfs'),
    uniqueCandidatePdf:sum('unique_candidate_pdf'),
    noCandidatePdf:sum('no_candidate_pdf'),
    exactVersionReferences:sum('exact_version_reference'),
    noExactVersionReferences:sum('no_exact_version_reference'),
    beforeEveryCandidateLegalFloor:sum('before_every_candidate_legal_floor'),
    beforeEveryCandidateEstimatedDate:sum('before_every_candidate_estimate'),
    filingDerivedClaims:sum('filing_derived_claims'),
    missingPublishedAt:sum('missing_published_at')
   };
   if(totals.eligibleCopies>3_000_000
    ||totals.eligibleCopies!==totals.exactVersionReferences+totals.noExactVersionReferences)
    throw Error('Historical eligibility grouping is incomplete');
   phase='commit_registry_only';
   await client.query('COMMIT');transaction=false;committed=true;
   onPhase('exact_pdf_registry_committed_and_eligibility_revalidated');
   return{
    schema:SCHEMA,issue:864,reportAsOf:now,authenticatedOfficialVersions:830,
    authenticatedUniqueBodies:813,registryExactMatches:Number(verified.exact),
    registryImportCommitted:committed,pdfVersionRegistrationIsNotRowContainment:true,
    currentSourceIdentifiersAreNotHistoricalFirstPublicProof:true,
    eligibilityRevalidatedAsDiagnosticOnly:true,
    existingEvidenceItemsNotModified:true,existingSourceDocumentsNotModified:true,
    existingForecastsAndModelsNotModified:true,
    onlyNewPdfRegistryAndMigrationLedgerWritten:true,
    grouped,totals
   };
  }finally{
   if(transaction)try{await client.query('ROLLBACK')}catch{}
   client.release(true);
  }
 }finally{await pool.end()}
}
async function main(){
 if(process.argv.length!==2)throw Error('No freeform SQL, source or private-row arguments');
 assertProtectedScope(process.env);
 let phase='first_attempt_reviewed_main';
 try{
  const result=await importOfficialCfbRegistryAndAudit({
   apiKey:process.env.NEON_API_KEY?.trim()??'',
   projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim()??'',
   preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined
  },{onPhase:x=>{phase=x}});
  const safe=JSON.stringify(result);
  if(safe.length>30000)throw Error('Protected summary too large');
  if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,
   'safe_cfb_v48_b64='+Buffer.from(safe).toString('base64')+'\n');
  console.log('CFB_864_V48_SAFE_PDF_REGISTRY='+safe);
 }catch{
  // Postgres/Neon error messages can contain SQL, URLs, credentials or DB IDs.
  console.error('CFB_864_V48_REGISTRY_HELD_AT='+phase);
  process.exitCode=1;
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
 void main();
