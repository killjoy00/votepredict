/**
 * #864 one-shot, GitHub owner-comment-authorized integration of thirteen
 * exact original publisher receipts into the EXISTING VotePredict Neon default
 * branch. The API key, SQL password, host and private row data remain within
 * the protected GitHub Actions job. No API or artifact records credentials.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Pool} from 'pg';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.js';
import {APPLY_COMMENT} from '../src/evidence/senate-864-2026-verified-positions.mjs';
import {requireReviewedOwnerApply,reconcileVerifiedStatements} from './reconcile-senate-864-2026-verified-positions.mjs';

export const READONLY_COMMENT='[senate-864-2026-verified-13-readonly-v1-20261014]';
const REPO='killjoy00/votepredict';
const ISSUE=864;
const pattern=/^[a-f0-9]{40}$/;
const modifiable=new Set(['INSERT_VERIFIED_QUOTE','REPAIR_EXISTING_VERIFIED_TIMESTAMP']);

export function assertOwnerEvent(env,event,mode){
  assert.ok(mode==='--dry-run'||mode==='--apply','Only dry-run or apply is supported');
  assert.equal(env.GITHUB_EVENT_NAME,'issue_comment');
  assert.equal(env.GITHUB_REPOSITORY,REPO);
  assert.equal(env.GITHUB_REF,'refs/heads/main');
  assert.equal(env.GITHUB_RUN_ATTEMPT,'1');
  assert.equal(env.GITHUB_ACTOR,'killjoy00');
  assert.ok(pattern.test(env.GITHUB_SHA??''),'Reviewed main SHA required');
  assert.equal(env.VOTEPREDICT_864_13_INDEPENDENT_CI,'true');
  assert.equal(event?.repository?.full_name,REPO);
  assert.equal(event?.issue?.number,ISSUE);
  assert.equal(event?.issue?.pull_request,undefined);
  assert.equal(event?.comment?.user?.login,'killjoy00');
  assert.equal(event?.comment?.body,mode==='--apply'?APPLY_COMMENT:READONLY_COMMENT);
  if(mode==='--apply')requireReviewedOwnerApply({
    ...env,
    VOTEPREDICT_864_13_APPROVAL:APPLY_COMMENT,
    VOTEPREDICT_864_13_EXACT_OWNER_COMMENT:'true',
  },true);
  return true;
}

export function assertAllThirteenSafeToApply(before){
  assert.equal(before.claims,13);
  assert.equal(before.verifiedOriginalPages,13);
  assert.equal(before.blockedOriginalUrlsExcluded,15);
  assert.equal(before.unmatchedQuoteUrlsExcluded,1);
  assert.equal(before.noQuoteSenatorsExcluded,3);
  assert.equal(before.perPublicDistrict.length,13);
  assert.equal(before.plannedOrApplied.held,0,'Never partially apply a thirteen-quote cohort with unresolved holds');
  assert.equal(before.plannedOrApplied.inserted+before.plannedOrApplied.repaired+before.plannedOrApplied.already,13);
  assert.ok(before.perPublicDistrict.every(row =>
    modifiable.has(row.status)||row.status.startsWith('EXISTING_')));
  return before;
}

export function assertAllThirteenVerifiedAfterApply(after){
  assert.equal(after.claims,13);
  assert.equal(after.plannedOrApplied.inserted,0,'A stored original quote still missing after apply');
  assert.equal(after.plannedOrApplied.repaired,0,'A publication timestamp repair remains after apply');
  assert.equal(after.plannedOrApplied.held,0,'A new hold appeared after apply');
  assert.equal(after.plannedOrApplied.already,13);
  assert.equal(after.perPublicDistrict.length,13);
  assert.ok(after.perPublicDistrict.every(row=>row.status.startsWith('EXISTING_')));
  return after;
}

/** Connection identity only, no quoted statement body or secrets returned. */
export async function verifyConnectionIdentity(client,target,{write=false}={}){
  const r=await client.query([
    'SELECT current_database() AS db,current_user AS role,',
    "COALESCE(has_table_privilege(current_user,'public.source_documents','SELECT'),false) AS source_read,",
    "COALESCE(has_table_privilege(current_user,'public.evidence_items','SELECT'),false) AS evidence_read,",
    "COALESCE(has_table_privilege(current_user,'public.source_documents','INSERT'),false) AS source_write,",
    "COALESCE(has_table_privilege(current_user,'public.evidence_items','INSERT'),false) AS evidence_write",
  ].join(' '));
  assert.equal(r.rows.length,1);
  const identity=r.rows[0];
  assert.equal(identity.db,target.database);
  assert.equal(identity.role,target.role);
  assert.equal(identity.source_read,true);
  assert.equal(identity.evidence_read,true);
  if(write){
    assert.equal(identity.source_write,true);
    assert.equal(identity.evidence_write,true);
  }
  return true;
}

/** Designed for test doubles as well as a real protected Neon primary. */
export async function reconcileWithVerification(client,{apply=false}={}){
  const pre=await reconcileVerifiedStatements(client,{apply:false});
  assertAllThirteenSafeToApply(pre);
  if(!apply)return {mode:'read_only_verified',preview:pre,productionEvidenceRowsActuallyUpdated:0};
  const committed=await reconcileVerifiedStatements(client,{apply:true});
  assert.equal(committed.plannedOrApplied.held,0);
  const post=await reconcileVerifiedStatements(client,{apply:false});
  assertAllThirteenVerifiedAfterApply(post);
  return {
    mode:'applied_and_read_back_verified',preview:pre,
    committed:committed.plannedOrApplied,after:post,
    productionEvidenceRowsActuallyUpdated:committed.productionEvidenceRowsActuallyUpdated,
  };
}

export async function main(){
  const mode=process.argv.length===3?process.argv[2]:null;
  if(mode!=='--dry-run'&&mode!=='--apply')
    throw Error('Exactly one approved mode required');
  const env=process.env;
  const event=JSON.parse(readFileSync(env.GITHUB_EVENT_PATH||'', 'utf8'));
  assertOwnerEvent(env,event,mode);
  const apiKey=env.NEON_API_KEY?.trim()??'';
  const projectId=env.VOTEPREDICT_NEON_PROJECT_ID?.trim()??'';
  let phase='owner_comment_and_ci_verified';
  try{
    const target=await discoverExistingVotePredictNeonConnection({
      apiKey,projectId,
      preferredDatabase:env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined,
      requirePrimary:true,
    },fetch,step=>{phase=step});
    phase='existing_votepredict_default_branch_primary_verified';
    const pool=new Pool({
      host:target.host,port:target.port,user:target.role,password:target.password,
      database:target.database,ssl:{rejectUnauthorized:true},max:1,
      connectionTimeoutMillis:9000,query_timeout:27000,statement_timeout:26000,
      application_name:'votepredict-864-13-original-publisher-owner-reviewed',
    });
    try{
      const client=await pool.connect();
      try{
        phase='database_connection_opened';
        await verifyConnectionIdentity(client,target,{write:mode==='--apply'});
        phase='production_evidence_schema_and_identity_verified';
        const report=await reconcileWithVerification(client,{apply:mode==='--apply'});
        phase='reconciliation_complete';
        // Public district/status only. Never report database, hostname, role,
        // URL, password, raw source body, private evidence, or SQL response.
        console.log(JSON.stringify({
          schema:'senate-864-13-existing-neon-default-branch-transactional-integration-v1',
          sourceVerifiedPublicByUtc:'2026-10-14',
          exactExistingNeonProjectAndDefaultBranchVerified:true,
          deployedVercelDatabaseBindingIndependentlyVerified:false,
          transactionOutcome:report,
          noForecastOrModelChanges:true,
          noBlockedOriginalsProcessed:true,
          noRawSourceBodiesStored:true,
        }));
      }finally{client.release(true)}
    }finally{await pool.end()}
  }catch{
    // Only static stage identifiers can appear. No database errors, credentials,
    // private rows, Neon metadata, source URL or per-person excerpt may escape.
    console.error('SENATE_864_13_PROTECTED_INTEGRATION_FAILED_AT='+phase);
    throw Error('Protected thirteen-quote integration stopped safely');
  }
}
const invoked=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked)main().catch(()=>{
  console.error('One-shot thirteen verified Senate quotes: no confidential details logged');
  process.exitCode=1;
});
