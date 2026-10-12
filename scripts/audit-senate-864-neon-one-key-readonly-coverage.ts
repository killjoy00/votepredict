/**
 * #864 Existing protected GitHub NEON_API_KEY, one-shot aggregate-only.
 * Five already reviewed Neon management GETs; existing branch/database/role.
 * One READ ONLY REPEATABLE READ SQL transaction, explicit ROLLBACK, always
 * close. No private rows, names, URLs, donors, statements, keys or raw
 * source bytes in outputs. Not an official statewide completeness proof.
 */
import {Pool} from 'pg';
import type {PoolClient} from 'pg';
import {appendFileSync} from 'node:fs';
import {discoverExistingVotePredictNeonConnection} from
 '../src/operations/senate-media-neon-api-readonly.js';
import {REQUIRED_MEDIA_EXPORT_TABLES} from
 '../src/evidence/senate-media-readonly-export.js';

export const REQUIRED_864_TABLES=[...REQUIRED_MEDIA_EXPORT_TABLES,'vote_events','member_votes'] as const;
export const ONE_SHOT_MARKER='SENATE_864_EXISTING_NEON_KEY_COUNTS_ONESHOT_20261011_V5' as const;
export const GROUPS=[
 'roster','finance','committeeSources','committeeVotes','committeeChoices','campaign','media',
] as const;
type Group=typeof GROUPS[number];
export const QUERIES:Record<Group,string>={
 roster:[
  'SELECT yr.y::text AS year,',
  'count(DISTINCT l.id)::text AS people,',
  'count(DISTINCT m.id)::text AS memberships,',
  'count(*) FILTER (WHERE COALESCE(m.starts_on,s.starts_on) IS NULL',
  'OR COALESCE(m.ends_on,s.ends_on) IS NULL)::text AS memberships_missing_date_boundary',
  'FROM memberships m JOIN legislators l ON l.id=m.legislator_id',
  'JOIN chambers c ON c.id=m.chamber_id',
  'JOIN legislative_sessions s ON s.id=m.session_id',
  'CROSS JOIN generate_series(2021,2025) AS yr(y)',
  "WHERE c.slug='senate'",
  "AND s.slug IN ('2021-2022','2023-2024','2025-2026')",
  'AND (COALESCE(m.starts_on,s.starts_on) IS NULL',
  'OR COALESCE(m.starts_on,s.starts_on)<=make_date(yr.y,12,31))',
  'AND (COALESCE(m.ends_on,s.ends_on) IS NULL',
  'OR COALESCE(m.ends_on,s.ends_on)>=make_date(yr.y,1,1))',
  'GROUP BY yr.y ORDER BY yr.y',
 ].join(' '),
 finance:[
  // Finance source-document discovery only; original bulk evidence_items
  // by-year/legislator counts exceeded the live statement timeout twice.
  // This source table is ALL CHAMBERS, and metadata year may be absent.
  // Do NOT call these stored CFB sources Senate evidence rows or filers.
  "SELECT CASE WHEN sd.metadata->>'year' ~ '^202[1-5]$'",
  "THEN sd.metadata->>'year' ELSE 'unknown_or_outside' END AS year,",
  'sd.source_kind AS family,',
  'count(*)::text AS source_document_rows,',
  "count(*) FILTER (WHERE sd.chamber_id IS NULL)::text AS documents_without_stored_chamber,",
  "count(*) FILTER (WHERE sd.session_id IS NULL)::text AS documents_without_stored_session,",
  "count(*) FILTER (WHERE sd.content_sha256 IS NULL OR sd.content_sha256 !~ '^[a-f0-9]{64}$')::text",
  'AS missing_source_sha',
  'FROM source_documents sd',
  "WHERE sd.source_kind IN ('campaign_finance_candidate_contribution_bulk',",
  "'campaign_finance_candidate_expenditure_bulk','campaign_finance_independent_expenditure_bulk',",
  "'campaign_finance_bulk')",
  'GROUP BY 1,2 ORDER BY 1,2',
 ].join(' '),
 committeeSources:[
  "SELECT COALESCE(substring(sd.source_url from '/senate/(202[2-5])/'),",
  "'unknown_or_outside') AS year,",
  'count(*)::text AS source_document_rows,',
  'count(DISTINCT sd.source_url)::text AS unique_source_urls,',
  "count(*) FILTER (WHERE sd.content_sha256 IS NULL OR sd.content_sha256 !~ '^[a-f0-9]{64}$')::text",
  'AS missing_source_sha,',
  "count(*) FILTER (WHERE NULLIF(sd.metadata->>'meetingDate','') IS NULL)::text",
  'AS missing_meeting_date,',
  "count(*) FILTER (WHERE NULLIF(sd.metadata->>'committeeName','') IS NULL)::text",
  'AS missing_committee_name',
  "FROM source_documents sd WHERE sd.source_kind='senate_committee_minutes'",
  'GROUP BY year ORDER BY year',
 ].join(' '),
 committeeVotes:[
  'SELECT LEFT(ve.occurred_on::text,4) AS year,',
  'count(*)::text AS committee_vote_events,',
  'count(*) FILTER (WHERE ve.source_document_id IS NULL)::text AS events_missing_document,',
  "count(*) FILTER (WHERE NULLIF(ve.external_key,'') IS NULL)::text AS events_missing_key,",
  'count(*) FILTER (WHERE ve.yea_count IS NULL OR ve.nay_count IS NULL)::text AS missing_tally',
  "FROM vote_events ve WHERE ve.metadata->>'committeeVote'='true'",
  'GROUP BY LEFT(ve.occurred_on::text,4) ORDER BY year',
 ].join(' '),
 committeeChoices:[
  'SELECT LEFT(ve.occurred_on::text,4) AS year,',
  'count(*)::text AS member_vote_rows,',
  'count(*) FILTER (WHERE mv.membership_id IS NULL)::text AS unresolved_member_identity,',
  "count(*) FILTER (WHERE NULLIF(mv.normalized_member_name,'') IS NULL)::text AS missing_source_member_name",
  'FROM member_votes mv JOIN vote_events ve ON ve.id=mv.vote_event_id',
  "WHERE ve.metadata->>'committeeVote'='true'",
  'GROUP BY LEFT(ve.occurred_on::text,4) ORDER BY year',
 ].join(' '),
 campaign:[
  "SELECT COALESCE(LEFT(ei.published_at::text,4),'unknown_or_undated') AS year,",
  'count(*)::text AS campaign_evidence_rows,',
  'count(DISTINCT sd.id)::text AS distinct_source_documents,',
  "count(*) FILTER (WHERE sd.content_sha256 IS NULL OR sd.content_sha256 !~ '^[a-f0-9]{64}$')::text",
  'AS missing_source_sha,',
  'count(*) FILTER (WHERE ei.published_at IS NULL)::text AS undated_rows',
  'FROM evidence_items ei JOIN source_documents sd ON sd.id=ei.source_document_id',
  'JOIN memberships m ON m.id=ei.membership_id',
  'JOIN chambers c ON c.id=m.chamber_id',
  "WHERE c.slug='senate'",
  "AND ei.metadata->>'contextType'='issue_position'",
  "AND ei.metadata->>'sourceSubtype'='campaign_site_page'",
  'GROUP BY year ORDER BY year',
 ].join(' '),
 media:[
  "SELECT LEFT(COALESCE(ei.metadata->>'archiveCapturedAt',''),4) AS year,",
  'count(*)::text AS context_rows,',
  'count(DISTINCT sd.id)::text AS distinct_source_documents,',
  "count(*) FILTER (WHERE sd.content_sha256 IS NULL OR sd.content_sha256 !~ '^[a-f0-9]{64}$')::text",
  'AS missing_source_sha,',
  "count(*) FILTER (WHERE NULLIF(ei.metadata->>'archiveUrl','') IS NULL)::text",
  'AS missing_archive_url',
  'FROM evidence_items ei JOIN source_documents sd ON sd.id=ei.source_document_id',
  "WHERE sd.source_kind='wayback_local_trade_news'",
  "AND ei.metadata->>'contextType'='local_trade_news'",
  "GROUP BY LEFT(COALESCE(ei.metadata->>'archiveCapturedAt',''),4) ORDER BY year",
 ].join(' '),
};
const CATALOG_SQL=[
 'SELECT names.name AS table_name,',
 "to_regclass('public.'||names.name) IS NOT NULL AS present,",
 "COALESCE(has_table_privilege(current_user,to_regclass('public.'||names.name),'SELECT'),false)",
 'AS readable FROM unnest($1::text[]) AS names(name) ORDER BY names.name',
].join(' ');
type CountRow={year:string;[field:string]:string};
type CountResults=Record<Group,CountRow[]>;
const FAMILIES=new Set([
 'campaign_finance_candidate_contribution_bulk',
 'campaign_finance_candidate_expenditure_bulk',
 'campaign_finance_independent_expenditure_bulk',
 'campaign_finance_bulk',
]);
const VALID_YEAR=/^20[0-9]{2}$/;
const UNKNOWN=new Set(['unknown_or_outside','unknown_or_undated','']);
export function safeCount(v:unknown):string{
 if(typeof v!=='string'||!/^[0-9]+$/.test(v)||!Number.isSafeInteger(Number(v))
  ||Number(v)>100000000)throw Error('Source aggregate is not a bounded integer');
 return v;
}
export function validateCountRows(name:Group,rows:unknown):CountRow[]{
 if(!Array.isArray(rows)||rows.length>70)throw Error('Unexpected SQL aggregate group count');
 const seen=new Set<string>(),out:CountRow[]=[];
 for(const r of rows){
  if(!r||typeof r!=='object'||Array.isArray(r))throw Error('Malformed aggregate');
  const fields=r as Record<string,unknown>;
  if(Object.keys(fields).length<2||Object.keys(fields).length>12
   ||typeof fields.year!=='string'
   ||(!VALID_YEAR.test(fields.year)&&!UNKNOWN.has(fields.year)))
   throw Error('Unsafe aggregate group year');
  const key=name==='finance'?fields.year+':'+fields.family:fields.year;
  if(seen.has(key))throw Error('Duplicate aggregate group');
  seen.add(key);
  const line:CountRow={year:fields.year};
  for(const [k,v] of Object.entries(fields)){
   if(k==='year')continue;
   if(k==='family'){
    if(name!=='finance'||typeof v!=='string'||!FAMILIES.has(v))
     throw Error('Unexpected finance source family');
    line.family=v;continue;
   }
   if(!/^[a-z][a-z0-9_]*$/.test(k))throw Error('Unexpected aggregate field');
   line[k]=safeCount(v);
  }
  out.push(line);
 }
 return out;
}
/** Diagnostic classification is fixed and cannot reveal PostgreSQL messages. */
export function safeSqlFailureReason(error:unknown):
 'statement_timeout'|'undefined_column'|'aggregate_grouping'|
 'sql_syntax'|'invalid_input'|'unknown_query_or_validation'{
 const code=error&&typeof error==='object'&&'code' in error?
  (error as {code?:unknown}).code:undefined;
 if(code==='57014')return 'statement_timeout';
 if(code==='42703')return 'undefined_column';
 if(code==='42803')return 'aggregate_grouping';
 if(code==='42601')return 'sql_syntax';
 if(code==='22P02')return 'invalid_input';
 return 'unknown_query_or_validation';
}
export function assertProtectedOneShot(env:Record<string,string|undefined>):void{
 if(env.GITHUB_REPOSITORY!=='killjoy00/votepredict'
  ||env.GITHUB_EVENT_NAME!=='push'||env.GITHUB_REF!=='refs/heads/main'
  ||env.GITHUB_RUN_ATTEMPT!=='1'
  ||! /^[a-f0-9]{40}$/.test(env.GITHUB_SHA??'')
  ||env.VOTEPREDICT_864_APPROVAL!=='BOUNDED_COUNTS_ONLY'
  ||env.VOTEPREDICT_864_INDEPENDENT_CI_VERIFIED!=='true'
  ||env.VOTEPREDICT_864_ONE_SHOT_MARKER_PRESENT!=='true')
  throw Error('Protected main-only single approved read-only source audit required');
}
export async function auditNeonExistingKey2021To25(
 input:{apiKey:string;projectId:string;preferredDatabase?:string},
 fetchApi:Parameters<typeof discoverExistingVotePredictNeonConnection>[1]=fetch,
 poolFactory:(opt:ConstructorParameters<typeof Pool>[0])=>Pick<Pool,'connect'|'end'>=
  opt=>new Pool(opt),
 phase:(name:string)=>void=()=>{},
){
 const selected=await discoverExistingVotePredictNeonConnection(input,fetchApi);
 phase('verified_existing_neon_project_branch_and_database');
 const pool=poolFactory({
  host:selected.host,port:selected.port,user:selected.role,password:selected.password,
  database:selected.database,ssl:{rejectUnauthorized:true},max:1,
  connectionTimeoutMillis:8000,query_timeout:16000,statement_timeout:15000,
  application_name:'votepredict-864-historical-aggregates-readonly',
  options:'-c default_transaction_read_only=on -c statement_timeout=15000 -c lock_timeout=3000',
 });
 try{
  const client=(await pool.connect()) as Pick<PoolClient,'query'|'release'>;
  let transaction=false;
  try{
   await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
   transaction=true;
   const identity=await client.query(
    "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro",
   );
   if(identity.rows.length!==1||identity.rows[0].db!==selected.database
    ||identity.rows[0].role!==selected.role||identity.rows[0].ro!=='on')
    throw Error('Expected VotePredict READ ONLY transaction identity mismatch');
   phase('transaction_identity_readonly');
   const catalog=await client.query(CATALOG_SQL,[[...REQUIRED_864_TABLES]]);
   if(catalog.rows.length!==REQUIRED_864_TABLES.length
    ||catalog.rows.some((row:Record<string,unknown>)=>
      !REQUIRED_864_TABLES.includes(row.table_name as typeof REQUIRED_864_TABLES[number])
      ||row.present!==true||row.readable!==true))
    throw Error('Expected VotePredict committee/finance/media/roster sources missing');
   phase('tables_verified');
   const groups={} as CountResults;
   const groupHolds:Partial<Record<Group,ReturnType<typeof safeSqlFailureReason>>>={};
   // SAVEPOINTs are transactional and permitted in a READ ONLY transaction.
   // When a single expensive source family times out, isolate that failure,
   // preserve the original REPEATABLE READ snapshot, and continue other
   // immutable SELECTs. Never turn a held query into a zero count.
   for(const name of GROUPS){
    await client.query('SAVEPOINT current_source_group');
    try {
     const rows=await client.query(QUERIES[name]);
     const checked=validateCountRows(name,rows.rows);
     await client.query('RELEASE SAVEPOINT current_source_group');
     groups[name]=checked;
     phase('completed_'+name);
    } catch(error) {
     const safeName=name.replace(/[A-Z]/g,v=>'_'+v.toLowerCase());
     const kind=safeSqlFailureReason(error);
     // Unknown SQL failures, unsafe result shape and lost connections do not
     // qualify for graceful partial data release.
     if(kind==='unknown_query_or_validation'){
      phase('failed_'+safeName+'_'+kind);
      throw Error('Unverified source query could not be safely classified');
     }
     try{
      await client.query('ROLLBACK TO SAVEPOINT current_source_group');
      await client.query('RELEASE SAVEPOINT current_source_group');
     }catch{
      phase('failed_'+safeName+'_savepoint_recovery');
      throw Error('READ ONLY source query savepoint could not recover');
     }
     groups[name]=[];
     groupHolds[name]=kind;
     phase('held_'+safeName+'_'+kind);
    }
   }
   await client.query('ROLLBACK');
   transaction=false;
   phase('rolled_back');
   return{
    schema:'mn-864-existing-key-cross-track-readonly-counts-v2',issue:864,
    status:Object.keys(groupHolds).length
     ?'partial_verified_existing_votepredict_default_branch_aggregates'
     :'verified_existing_votepredict_default_branch_aggregate_source_snapshot',
    defaultBranchExisting:true,deployedProductionBindingIndependentlyVerified:false,
    originalSqlRoleMayHaveWriteGrantsOutsideReadOnlyTransaction:true,
    financeQueryOnlyExplicitHistoricSenateMembershipLinkedEvidence:false,
    financeQuerySourceDocumentOnlyAcrossAllChambers:true,
    financeEvidenceItemRowsAndEligibilityNotAudited:true,
    financeSourceMetadataYearMayBeMissing:true,
    unlinkedAndMetadataOnlyFinanceEvidenceNotAuditedInThisSnapshot:true,
    fullStatewideFinanceDatabaseCompletenessNotEstablished:true,
    currentTransactionReadOnly:true,transactionRollbackCompleted:true,
    privateOriginalRowsAndNamesExported:false,originalArticleBodiesOrDonorRowsExported:false,
    fullPerSourceRowReconciliationCompleted:false,
    officialOriginalPrint2021MeetingDenominator:null,
    legalCampaignFinanceObligationDenominator:null,
    historicalOriginalPublicByProofUnchanged:true,
    historicalStatewideMediaArticleDenominator:null,
    historicalCompletenessCertified:false,productionMutations:0,
    groups,groupHolds,
    allSevenSourceFamilyQueriesSucceeded:Object.keys(groupHolds).length===0,
    groupHoldsAreNotZeroCounts:true,
   } as const;
  }finally{
   if(transaction){try{await client.query('ROLLBACK')}catch{/* close */}}
   client.release(true);
  }
 }finally{await pool.end()}
}
async function main(){
 if(process.argv.length!==2)throw Error('No arbitrary SQL or CLI arguments');
 assertProtectedOneShot(process.env);
 let phase='main_one_shot_approval_passed';
 try{
  const audit=await auditNeonExistingKey2021To25({
   apiKey:process.env.NEON_API_KEY?.trim()??'',
   projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim()??'',
   preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined,
  },fetch,undefined,p=>{phase=p});
  // Cross-job communication carries ONLY the above validator's year/family
  // grouped integers, with no connection identity or private original records.
  // A separate job with issues:write publishes this safe receipt to #864;
  // the protected Neon job itself has no GitHub issue-write permission.
  if(process.env.GITHUB_OUTPUT){
   const safe=Buffer.from(JSON.stringify(audit),'utf8').toString('base64');
   if(safe.length>70000)throw Error('Sanitized aggregate exceeds bounded output');
   appendFileSync(process.env.GITHUB_OUTPUT,'public_counts_b64='+safe+'\n');
  }
  console.log('VOTEPREDICT_864_SANITIZED_EXISTING_NEON_COUNTS='+JSON.stringify(audit));
  if(process.env.GITHUB_STEP_SUMMARY){
   const lines=[
    '## #864 — Existing VotePredict Neon key, protected historical source counts',
    'Existing default branch independently identified. One READ ONLY',
    'REPEATABLE READ SQL transaction, explicit ROLLBACK. This does not',
    'prove database deployment binding or all-official-source completeness.',
    '| Original evidence class | Number of year/family aggregate groups |',
    '| --- | ---: |',
    ...GROUPS.map(x=>'| '+x+' | '+audit.groups[x].length
      +(audit.groupHolds[x]?' (HOLD: '+audit.groupHolds[x]+')':'')+' |'),
    '',
    'No individual private rows, names, source URLs or credentials logged.',
    'No database writes or historical feature promotions.',
   ];
   appendFileSync(process.env.GITHUB_STEP_SUMMARY,lines.join('\n')+'\n');
  }
 }catch{
  console.error('VOTEPREDICT_864_SANITIZED_READONLY_SOURCE_AUDIT_FAILED_CLOSED phase='+phase);
  if(process.env.GITHUB_OUTPUT && /^[a-z_]+$/.test(phase) && phase.length<110)
   appendFileSync(process.env.GITHUB_OUTPUT,'failure_phase='+phase+'\n');
  process.exitCode=1;
 }
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/audit-senate-864-neon-one-key-readonly-coverage.ts'))
 void main();
