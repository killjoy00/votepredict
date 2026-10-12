/**
 * #864: fixed session-overlap membership diagnostic inside existing protected
 * Neon key integration. One repeatable-read READ ONLY transaction, ROLLBACK.
 * Only 5-15 year/session GROUPED COUNTS leave; no person, district, or row IDs.
 */
import {readFileSync,appendFileSync} from 'node:fs';
import {Pool} from 'pg';
import {discoverExistingVotePredictNeonConnection} from
 '../src/operations/senate-media-neon-api-readonly.js';
import {assertProtectedOneShot} from './audit-senate-864-neon-one-key-readonly-coverage.js';
import {
 HISTORICAL_SENATE_SESSION_SQL_PROOF_VERSION,
 ROSTER_DIAGNOSTIC_QUERIES,V5_ROSTER_COUNTS,
} from './senate-864-roster-session-diagnostic-sql.js';

export const SENATE_ROSTER_SESSION_ONESHOT_MARKER=
 'SENATE_864_SENATE_ROSTER_SESSION_READONLY_ONESHOT_20261012_V1' as const;
const REQUIRED_2021_25_YEARS=['2021','2022','2023','2024','2025'] as const;
const ALLOWED_SESSIONS=['2021-2022','2023-2024','2025-2026'] as const;
type Row=Record<string,string>;
function requireCounts(rows:unknown,fields:readonly string[],limit:number,session:boolean){
 if(!Array.isArray(rows)||rows.length<1||rows.length>limit)
  throw Error('Roster aggregate SQL unexpected row count, no live data export');
 const seen=new Set<string>();
 const clean:Record<string,string|number>[]=[];
 for(const raw of rows){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))
   throw Error('Roster aggregate row not object');
  const row=raw as Row;
  const allowed=['year',...(session?['session_slug']:[]),...fields].sort();
  if(JSON.stringify(Object.keys(row).sort())!==JSON.stringify(allowed))
   throw Error('Unexpected aggregate field, possible private row or changed SQL');
  if(!REQUIRED_2021_25_YEARS.includes(row.year as typeof REQUIRED_2021_25_YEARS[number]))
   throw Error('Roster year out of fixed source scope');
  if(session&&!ALLOWED_SESSIONS.includes(row.session_slug as typeof ALLOWED_SESSIONS[number]))
   throw Error('Unknown legislative-session slug');
  const key=row.year+':'+(session?row.session_slug:'');
  if(seen.has(key))throw Error('Duplicate roster aggregate group');
  seen.add(key);
  const cleanRow:Record<string,string|number>={year:row.year};
  if(session)cleanRow.session=row.session_slug;
  for(const field of fields){
   const val=row[field];
   if(typeof val!=='string'||!/^(0|[1-9][0-9]{0,5})$/.test(val))
    throw Error('Invalid or unsafe annual roster aggregate');
   cleanRow[field]=Number(val);
  }
  clean.push(cleanRow);
 }
 clean.sort((a,b)=>a.year===b.year?String(a.session??'').localeCompare(String(b.session??''))
  :String(a.year).localeCompare(String(b.year)));
 return clean;
}
export const BY_SESSION=[
 'v5_membership_rows','v5_people_in_session',
 'rows_from_session_not_intersecting_calendar_year',
 'rows_from_session_year_but_not_active_within_both_bounds',
 'session_clamped_active_membership_rows','session_clamped_active_people_in_session',
 'membership_starts_before_session','membership_ends_after_session','missing_session_dates',
] as const;
export const BY_YEAR=[
 'v5_memberships','v5_people',
 'session_clamped_active_membership_rows','session_clamped_active_people',
 'rows_outside_session_calendar_year','people_with_outside_session_membership_rows',
 'records_missing_session_date_boundary',
] as const;
export const BY_PERSON_YEAR=[
 'people_with_multiple_v5_membership_rows','people_with_multiple_v5_session_slugs',
 'v5_extra_rows_from_duplicate_people',
 'multi_v5_row_people_with_at_most_one_session_clamped_row',
 'people_with_multi_session_clamped_rows',
 'highest_membership_rows_for_one_person','highest_sessions_for_one_person',
] as const;

export function validateIndependentV5RosterReceipt(){
 const receipt=JSON.parse(readFileSync(
  'docs/evaluation/source-proof/senate-864-v5-protected-neon-seven-family-baseline.json','utf8',
 )) as Record<string,any>;
 if(receipt.sourceReceiptId!==6116826026||receipt.run?.id!==38196817626
  ||receipt.transaction?.readOnly!==true||receipt.transaction?.explicitRollbackSucceeded!==true)
  throw Error('V5 independently verified protected roster baseline is missing or changed');
 const roster=receipt.groups?.roster;
 if(!Array.isArray(roster)||roster.length!==5)throw Error('V5 source scope not complete');
 for(const want of V5_ROSTER_COUNTS){
  const row=roster.find((x:{year:string})=>x.year===want.year);
  if(!row||Number(row.people)!==want.people
    ||Number(row.memberships)!==want.memberships)
   throw Error('Old V5 roster proof no longer matches source');
 }
 return true;
}
export async function auditProtectedRosterSessionMultiplicity(
 input:{apiKey:string;projectId:string;preferredDatabase?:string},
 fetchApi:Parameters<typeof discoverExistingVotePredictNeonConnection>[1]=fetch,
 poolFactory:(opts:ConstructorParameters<typeof Pool>[0])=>Pick<Pool,'connect'|'end'>=
  opts=>new Pool(opts),
 phase:(name:string)=>void=()=>{},
){
 const selected=await discoverExistingVotePredictNeonConnection(input,fetchApi);
 phase('existing_vote_predict_default_neon_branch_authenticated');
 const pool=poolFactory({
  host:selected.host,port:selected.port,user:selected.role,password:selected.password,
  database:selected.database,ssl:{rejectUnauthorized:true},max:1,
  connectionTimeoutMillis:8000,query_timeout:16000,statement_timeout:15000,
  application_name:'votepredict-864-senate-roster-session-multiplicity-readonly',
  options:'-c default_transaction_read_only=on -c statement_timeout=15000 -c lock_timeout=3000',
 });
 try{
  const client=await pool.connect();let begun=false;
  try{
   await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
   begun=true;
   const identity=await client.query(
    "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro",
   );
   if(identity.rows.length!==1||identity.rows[0].db!==selected.database
     ||identity.rows[0].role!==selected.role||identity.rows[0].ro!=='on')
    throw Error('Expected restricted READ ONLY session identity not proven');
   phase('repeatable_read_read_only_verified');
   const allSession=requireCounts((await client.query(ROSTER_DIAGNOSTIC_QUERIES[0])).rows,
    BY_SESSION,15,true);
   phase('bounded_year_and_session_grouping_completed');
   const allYear=requireCounts((await client.query(ROSTER_DIAGNOSTIC_QUERIES[1])).rows,
    BY_YEAR,5,false);
   phase('bounded_calendar_year_totals_completed');
   const allDuplicate=requireCounts((await client.query(ROSTER_DIAGNOSTIC_QUERIES[2])).rows,
    BY_PERSON_YEAR,5,false);
   phase('bounded_person_multiplicity_groups_completed');
   if(allYear.length!==5||allDuplicate.length!==5
     ||allYear.map(y=>y.year).join(',')!==REQUIRED_2021_25_YEARS.join(',')
     ||allDuplicate.map(y=>y.year).join(',')!==REQUIRED_2021_25_YEARS.join(','))
    throw Error('Every historical year must be explicitly accounted for');
   for(let i=0;i<5;i++){
    const y=allYear[i]!,d=allDuplicate[i]!;
    const sessions=allSession.filter(s=>s.year===y.year);
    const sum=(field:string)=>sessions.reduce((n,r)=>n+Number(r[field]),0);
    if(sum('v5_membership_rows')!==y.v5_memberships
      ||sum('session_clamped_active_membership_rows')!==y.session_clamped_active_membership_rows
      ||sum('rows_from_session_not_intersecting_calendar_year')!==y.rows_outside_session_calendar_year
      ||Number(y.v5_memberships)-Number(y.v5_people)!==d.v5_extra_rows_from_duplicate_people)
     throw Error('Roster year and session cardinalities inconsistent in trusted SQL');
   }
   await client.query('ROLLBACK');begun=false;
   phase('explicit_readonly_transaction_rolled_back');
   const drifts=allYear.map(y=>{
    const expected=V5_ROSTER_COUNTS.find(x=>x.year===y.year)!;
    return{year:y.year,peopleFromV5:expected.people,membershipRowsFromV5:expected.memberships,
     observedPeople:Number(y.v5_people),observedMembershipRows:Number(y.v5_memberships),
     differentFromPinnedV5Snapshot:expected.people!==y.v5_people||
       expected.memberships!==y.v5_memberships};
   });
   return{
    schemaVersion:HISTORICAL_SENATE_SESSION_SQL_PROOF_VERSION,
    issue:864,
    verifiedPriorAuditRun:38196817626,
    pinnedV5ReceiptId:6116826026,
    sessionRows:allSession,years:allYear,multiplicity:allDuplicate,
    driftComparedToPinnedV5:drifts,
    allFiveCalendarYearsIncluded:true,
    queryCount:ROSTER_DIAGNOSTIC_QUERIES.length,
    selectedVotePredictNeonDefaultBranchAuthenticated:true,
    deployedProductionBindingIndependentlyVerified:false,
    restrictedTransactionReadOnly:true,transactionExplicitRollbackCompleted:true,
    noDatabaseWrites:true,noPrivatePersonLevelRowsExported:true,
    individualSenatorIdentityMatchedToGovernment95Source:false,
    sessionClampedYearsNotAutomaticallySenateServiceDates:true,
    correctHistoricalTermAndEvidenceAsOfJoinsNotCertified:true,
    noPredictionOrIngestionChanges:true,
   };
  }finally{
   if(begun)try{await client.query('ROLLBACK')}catch{/* close */}
   client.release(true);
  }
 }finally{await pool.end()}
}
async function main(){
 if(process.argv.length!==3 ||!['--baseline-preflight','--protected'].includes(process.argv[2]))
  throw Error('Only the fixed #864 roster source preflight or protected audit is allowed');
 let phase='v5_source_baseline_preflight';
 try{
  validateIndependentV5RosterReceipt();
  if(process.argv[2]==='--baseline-preflight'){
   console.log('VOTEPREDICT_864_PROVEN_V5_FIVE_YEAR_SENATE_ROSTER_BASELINE=5');return;
  }
  assertProtectedOneShot(process.env);
  if(process.env.VOTEPREDICT_864_ROSTER_DIAGNOSTIC_MARKER_PRESENT!=='true')
   throw Error('New exact-main separately reviewed roster diagnostic marker absent');
  phase='protected_bounded_roster_sql';
  const result=await auditProtectedRosterSessionMultiplicity({
   apiKey:process.env.NEON_API_KEY?.trim()??'',
   projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim()??'',
   preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined,
  },fetch,opts=>new Pool(opts),s=>{phase=s});
  const publicResult=JSON.stringify(result);
  if(publicResult.length>17000
    ||/https?:\/\/|postgresql:|neondb_owner|legislator_id|membership_id|external_key|district/i.test(publicResult))
   throw Error('No raw person-level fields may escape protected role');
  if(process.env.GITHUB_OUTPUT)
   appendFileSync(process.env.GITHUB_OUTPUT,
    'public_roster_b64='+Buffer.from(publicResult,'utf8').toString('base64')+'\n');
  console.log('VOTEPREDICT_864_SANITIZED_ROSTER_SESSION_DIAGNOSTIC='+publicResult);
 }catch{
  console.error('VOTEPREDICT_864_ROSTER_DIAGNOSTIC_FAIL_CLOSED phase='+phase);
  if(process.env.GITHUB_OUTPUT&&/^[a-z_]{1,80}$/.test(phase))
   appendFileSync(process.env.GITHUB_OUTPUT,'safe_failure_phase='+phase+'\n');
  process.exitCode=1;
 }
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/audit-senate-864-roster-sessions-readonly.ts'))
 void main();
