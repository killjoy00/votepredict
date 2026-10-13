/**
 * Issue #864: 49 current MN Senate incumbents on Nov 2026 ballot.
 * One exact owner-comment-triggered protected existing VotePredict Neon
 * READ ONLY source-URL/membership parity, in memory, never raw row export.
 * Specific PUBLIC URLs only; does not assert URL = full HTML body sha or
 * deployed-production DB binding; cannot run on PR/cron/push.
 */
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {appendFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import candidates from '../data/evaluation/senate-864-2026-49-incumbent-public-source-reference-crosswalk-v1.json' with {type:'json'};
import duckworth from '../data/evaluation/senate-864-2026-incumbent-duckworth-exact-speaker-leads-v1.json' with {type:'json'};
import {
 auditPublic2026IncumbentSourceManifest,compare49IncumbentSources,publicUrlVariants,
} from '../src/evidence/senate-864-2026-incumbent-source-parity.mjs';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.js';

export const ONE_SHOT_COMMENT='[campaign-864-2026-49-incumbents-source-readonly-20261013-v1]';
export const REQUIRED=['source_documents','evidence_items','memberships','legislators','chambers','legislative_sessions'];
const DISTRICTS=candidates.rows.map(row=>String(row.district));
export const MEMBERSHIPS_SQL=[
 'SELECT m.id::text AS "membershipId",l.name::text AS "senatorName",',
 'm.district::text AS district',
 'FROM memberships m JOIN legislators l ON l.id=m.legislator_id',
 'JOIN chambers c ON c.id=m.chamber_id',
 'JOIN legislative_sessions s ON s.id=m.session_id',
 "WHERE c.slug='senate' AND s.slug='2025-2026'",
 'AND m.district::text=ANY($1::text[])',
 "AND COALESCE(m.starts_on,s.starts_on)<=DATE '2026-10-13'",
 "AND (COALESCE(m.ends_on,s.ends_on) IS NULL",
 "OR COALESCE(m.ends_on,s.ends_on)>=DATE '2026-10-13')",
 'ORDER BY m.district,l.name,m.id LIMIT 211',
].join(' ');
export const PUBLIC_SOURCE_SQL=[
 'SELECT sd.id::text AS "sourceDocumentId",',
 'sd.source_url::text AS "sourceUrl",',
 'sd.source_kind::text AS "sourceKind",',
 'sd.content_sha256::text AS "contentSha256",',
 'ei.id::text AS "sourceEvidenceId",ei.membership_id::text AS "membershipId",',
 "LEFT(COALESCE(ei.excerpt,''),4000)::text AS excerpt",
 'FROM source_documents sd',
 'LEFT JOIN evidence_items ei ON ei.source_document_id=sd.id',
 'WHERE sd.source_url=ANY($1::text[])',
 'ORDER BY sd.source_url,sd.id,ei.id LIMIT 1201',
].join(' ');
export const CATALOG_SQL=[
 'SELECT req.name AS table_name,',
 "to_regclass('public.'||req.name) IS NOT NULL AS present,",
 "COALESCE(has_table_privilege(current_user,to_regclass('public.'||req.name),'SELECT'),false) AS readable",
 'FROM unnest($1::text[]) AS req(name) ORDER BY req.name',
].join(' ');
export const IDENTITY_SQL="SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro";
export function sourceVariants(){
 auditPublic2026IncumbentSourceManifest(candidates,duckworth);
 const uris=[...candidates.rows.map(x=>x.researchSourceUrl),
  ...duckworth.duckworth.newDated2026SourceLeads.map(x=>x.url)];
 return [...new Set(uris.flatMap(publicUrlVariants))].sort();
}
export function assertOwnerCommentEvent(env){
 if(env.GITHUB_REPOSITORY!=='killjoy00/votepredict'
   ||env.GITHUB_EVENT_NAME!=='issue_comment'
   ||env.GITHUB_REF!=='refs/heads/main'
   ||env.GITHUB_RUN_ATTEMPT!=='1'
   ||env.VOTEPREDICT_864_2026_APPROVAL!==ONE_SHOT_COMMENT
   ||env.VOTEPREDICT_864_2026_CI_PASSED!=='true'
   ||!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA||''))
  throw Error('No authenticated owner-only GitHub comment and independent CI approval');
}
export function validateSanitizedReport(r){
 assert.equal(r.schema,'mn-864-2026-49-incumbent-protected-url-parity-v1');
 assert.equal(r.issue,864);
 assert.equal(r.currentTransactionReadOnly,true);
 assert.equal(r.transactionRollbackCompleted,true);
 assert.equal(r.productionMutations,0);
 assert.equal(r.deployedProductionDbBindingProven,false);
 assert.equal(r.currentSourceOriginalHtmlRawShaParityProven,false);
 assert.equal(r.outputContainsPrivateSourceRows,false);
 assert.equal(r.outputContainsPrivateUrls,false);
 assert.equal(r.outputContainsPrivatePeopleNames,false);
 assert.equal(r.outputContainsPrivateHashes,false);
 assert.ok(Array.isArray(r.sourceUrlStatusByDistrict)&&r.sourceUrlStatusByDistrict.length===49);
 assert.deepEqual(r.sourceUrlStatusByDistrict.map(x=>x.district),candidates.rows.map(x=>x.district));
 const safe=new Set([
  'matched_exact_url_with_named_senator_evidence',
  'matched_url_alias_with_named_senator_evidence',
  'source_url_present_but_no_named_senator_evidence',
  'source_url_not_observed_in_bounded_lookup',
  'senator_membership_identity_unresolved'
 ]);
 assert.ok(r.sourceUrlStatusByDistrict.every(x=>safe.has(x.status)&&Object.keys(x).length===2));
 assert.equal(r.duckworth.perSource.length,4);
 for(const x of r.duckworth.perSource) {
  assert.deepEqual(Object.keys(x).sort(),[
    'currentSenatorEvidenceLinked','exactShortCueInStoredEvidence',
    'originalFirstPublicationTimeProven','originalRawPublisherBodyShaProvenSame',
    'sourceOrdinal','urlInStoredDocuments'
  ].sort());
  assert.ok(Number.isInteger(x.sourceOrdinal)&&x.sourceOrdinal>=1&&x.sourceOrdinal<=4);
  for(const k of Object.keys(x).filter(x=>x!=='sourceOrdinal')) assert.equal(typeof x[k],'boolean');
 }
 const j=JSON.stringify(r);
 assert.ok(j.length<28000 && ! /(?:https?:\/\/|@[a-z0-9]+\.|neon\.tech|postgres:|sourceDocumentId|membershipId|evidenceItemId|sourceSha256|excerptBody)/i.test(j));
 return r;
}
export async function auditExistingVotePredict49SourceParity(
 connectionInput,
 discover=discoverExistingVotePredictNeonConnection,
 poolFactory=options=>new Pool(options),
 stage=()=>{},
){
 const variants=sourceVariants();
 assert.ok(variants.length>=53&&variants.length<=500);
 const target=await discover(connectionInput);
 stage('existing_project_default_branch_verified');
 const pool=poolFactory({
  host:target.host,port:target.port,user:target.role,password:target.password,
  database:target.database,ssl:{rejectUnauthorized:true},max:1,
  connectionTimeoutMillis:8000,query_timeout:22000,statement_timeout:21000,
  application_name:'votepredict-864-2026-49-source-parity-ro',
  options:'-c default_transaction_read_only=on -c statement_timeout=21000 -c lock_timeout=1200',
 });
 try{
  const client=await pool.connect();let open=false;
  try{
   await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
   open=true;stage('readonly_transaction_opened');
   const identity=await client.query(IDENTITY_SQL);
   if(identity.rows.length!==1||identity.rows[0].db!==target.database
    ||identity.rows[0].role!==target.role||identity.rows[0].ro!=='on')
    throw Error('Incorrect existing VotePredict read-only identity');
   const catalog=await client.query(CATALOG_SQL,[REQUIRED]);
   if(catalog.rows.length!==REQUIRED.length
    ||catalog.rows.some(x=>!REQUIRED.includes(x.table_name)||x.present!==true||x.readable!==true))
    throw Error('Expected existing VotePredict evidence tables unavailable');
   stage('identity_and_tables_checked');
   const memberSet=await client.query(MEMBERSHIPS_SQL,[DISTRICTS]);
   if(memberSet.rows.length>=211)throw Error('Unexpected truncated existing senator memberships');
   stage('current_member_identity_bounded');
   const evidenceSet=await client.query(PUBLIC_SOURCE_SQL,[variants]);
   if(evidenceSet.rows.length>=1201)throw Error('Unexpected truncated candidate source documents');
   stage('private_source_rows_bounded_in_memory');
   // No existing row is printed, saved as an artifact or returned to GitHub.
   const publicOnly=compare49IncumbentSources(candidates,duckworth,
     memberSet.rows,evidenceSet.rows);
   await client.query('ROLLBACK');open=false;
   stage('readonly_rollback_succeeded');
   return validateSanitizedReport({...publicOnly,
    currentTransactionReadOnly:true,transactionRollbackCompleted:true,
    originalSqlAccountMayHaveOtherPrivileges:true,
    sourceVariantsQueried:variants.length,
    protectedDefaultBranchVerified:true,productionMutations:0,
   });
  }finally{
   if(open){try{await client.query('ROLLBACK');}catch{/* close */}}
   client.release(true);
  }
 }finally{
  await pool.end();
 }
}
export async function main(){
 assert.equal(process.argv.length,2);
 assertOwnerCommentEvent(process.env);
 let phase='approved_comment';
 try{
  const audit=await auditExistingVotePredict49SourceParity({
   apiKey:process.env.NEON_API_KEY?.trim()||'',
   projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim()||'',
   preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined,
  },discoverExistingVotePredictNeonConnection,undefined,where=>{phase=where});
  const encoded=Buffer.from(JSON.stringify(audit),'utf8').toString('base64');
  if(encoded.length>38000)throw Error('Unsafe receipt length');
  if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,
   'safe_source_parity_b64='+encoded+'\n');
  console.log('SENATE_864_2026_49_PARITY_ROLLBACK_COMPLETED: '+audit.researchCandidateCount+' public district classifications, '+
   audit.duckworth.comparedDatedPublicSources+' Duckworth URL checks; no raw private records emitted.');
 }catch{
  console.error('SENATE_864_2026_49_PARITY_HOLD_AT_SAFE_PHASE='+phase);
  if(process.env.GITHUB_OUTPUT && /^[a-z_]+$/.test(phase))
   appendFileSync(process.env.GITHUB_OUTPUT,'safe_failure_phase='+phase+'\n');
  process.exitCode=1;
 }
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url)))
 void main();
