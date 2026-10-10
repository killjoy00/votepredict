/**
 * #912 owner-approved manual-only VotePredict historical media aggregate.
 * Existing NEON_API_KEY -> authenticated Neon GET connection_uri -> SELECT
 * inside an enforced READ ONLY SQL transaction, then ROLLBACK.
 *
 * No original articles, source identifiers, senator names, passwords, URLs,
 * private JSONL or snapshots are written to logs/artifacts. No DML or DDL.
 * A pre-existing owner role may have general write grants: this workflow
 * DOES NOT claim the role is SELECT-only; only this transaction is read-only.
 */
import { appendFileSync } from 'node:fs';
import { Pool } from 'pg';
import {
  discoverExistingVotePredictNeonConnection,
  assertApprovedDirectNeonWorkflow,
  type MediaNeonAccessPhase,
  type MediaNeonPhaseReporter,
} from '../src/operations/senate-media-neon-api-readonly.js';
import { REQUIRED_MEDIA_EXPORT_TABLES } from '../src/evidence/senate-media-readonly-export.js';

const YEARS=['2021','2022','2023','2024','2025'] as const;
const REQUIRED=REQUIRED_MEDIA_EXPORT_TABLES;
type AggregateRows=Record<string,{contextRows:number; distinctSourceDocuments:number}>;
export interface SanitizedExistingNeonMediaReport {
  status:'existing_neon_api_readonly_aggregate_verified';
  projectIdentityVerified:true;
  defaultBranchExisting:true;
  existingRoleUsed:true;
  sqlTransactionReadOnlyVerified:true;
  roleStrictlySelectOnlyClaimed:false;
  requiredVotePredictSourceTablesReadable:true;
  mediaContextRowsByCaptureYear:AggregateRows;
  excluded2026AndOtherYearContextRows:number;
  contextRowsTotal:number;
  distinctArticleDocsSummedByCaptureYear:number;
  fullSourceRowsExported:false;
  originalArticleBodiesRead:false;
  humanQuotesVerified:0;
  statewideDenominatorEstablished:false;
  databaseModified:false;
}

const CATALOG_SQL=[
  "SELECT names.name AS table_name,",
  "  to_regclass('public.'||names.name) IS NOT NULL AS present,",
  "  COALESCE(has_table_privilege(current_user,to_regclass('public.'||names.name),'SELECT'),false) AS readable",
  "FROM unnest($1::text[]) AS names(name)",
  "ORDER BY names.name",
].join('\n');
const CONTEXT_COUNTS_SQL=[
  "SELECT LEFT(COALESCE(ei.metadata->>'archiveCapturedAt',''),4) AS year,",
  "  count(*)::text AS context_rows,",
  "  count(DISTINCT sd.id)::text AS source_documents",
  "FROM public.evidence_items ei",
  "JOIN public.source_documents sd ON sd.id=ei.source_document_id",
  "WHERE sd.source_kind='wayback_local_trade_news'",
  "  AND ei.metadata->>'contextType'='local_trade_news'",
  "GROUP BY LEFT(COALESCE(ei.metadata->>'archiveCapturedAt',''),4)",
  "ORDER BY year",
].join('\n');
function boundedCount(value:unknown):number {
  if(typeof value!=='string'||!/^\d+$/.test(value))throw Error('Unexpected SQL aggregate count');
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n>100_000_000)
    throw Error('Media aggregate unexpectedly exceeds safe numeric limit');
  return n;
}

export async function verifyExistingNeonMediaAggregate(
  input:{apiKey:string;projectId:string;preferredDatabase?:string},
  request:Parameters<typeof discoverExistingVotePredictNeonConnection>[1]=fetch,
  createPool:(config:ConstructorParameters<typeof Pool>[0])=>Pick<Pool,'connect'|'end'>=
    options=>new Pool(options),
  onPhase:MediaNeonPhaseReporter=()=>{},
):Promise<SanitizedExistingNeonMediaReport>{
  const target=await discoverExistingVotePredictNeonConnection(input,request,onPhase);
  const pool=createPool({
    host:target.host,port:target.port,
    user:target.role,password:target.password,database:target.database,
    ssl:{rejectUnauthorized:true},max:1,
    connectionTimeoutMillis:8000,query_timeout:16000,
    statement_timeout:15000,application_name:'votepredict-manual-media-counts-readonly',
    options:'-c default_transaction_read_only=on -c statement_timeout=15000 -c lock_timeout=4000',
  });
  try {
    const client=await pool.connect();
    onPhase('sql_connection_opened');
    let transactionStarted=false;
    try {
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      transactionStarted=true;
      const identity=await client.query(
        "SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro",
      );
      if(identity.rows.length!==1
        || identity.rows[0].db!==target.database
        || identity.rows[0].role!==target.role
        || identity.rows[0].ro!=='on')
        throw Error('VotePredict SQL database/user or READ ONLY transaction mismatch');
      onPhase('sql_readonly_identity_verified');
      const catalog=await client.query(CATALOG_SQL,[[...REQUIRED]]);
      if(catalog.rows.length!==REQUIRED.length
        || catalog.rows.some((row:{table_name:string;present:boolean;readable:boolean})=>
          !REQUIRED.includes(row.table_name as typeof REQUIRED[number])
          || row.present!==true||row.readable!==true))
        throw Error('Expected VotePredict media/roster source tables are missing or unreadable');
      onPhase('sql_required_tables_verified');
      const result=await client.query(CONTEXT_COUNTS_SQL);
      if(result.rows.length>30)throw Error('Media aggregate unexpectedly has too many year keys');
      const byYear:AggregateRows=Object.fromEntries(
        YEARS.map(year=>[year,{contextRows:0,distinctSourceDocuments:0}]),
      );
      let outside=0,contextTotal=0,documentYearSum=0;
      const keys=new Set<string>();
      for(const raw of result.rows){
        if(typeof raw.year!=='string'||keys.has(raw.year))
          throw Error('Duplicate or malformed media capture year');
        keys.add(raw.year);
        const contextRows=boundedCount(raw.context_rows);
        const distinctSourceDocuments=boundedCount(raw.source_documents);
        if(distinctSourceDocuments>contextRows)
          throw Error('Media source document count exceeds context rows');
        contextTotal+=contextRows;
        documentYearSum+=distinctSourceDocuments;
        if(YEARS.includes(raw.year as typeof YEARS[number]))
          byYear[raw.year]={contextRows,distinctSourceDocuments};
        else outside+=contextRows;
      }
      onPhase('sql_aggregate_completed');
      await client.query('ROLLBACK');
      transactionStarted=false;
      onPhase('sql_transaction_rolled_back');
      return {
        status:'existing_neon_api_readonly_aggregate_verified',
        projectIdentityVerified:true,
        defaultBranchExisting:true,existingRoleUsed:true,
        sqlTransactionReadOnlyVerified:true,
        roleStrictlySelectOnlyClaimed:false,
        requiredVotePredictSourceTablesReadable:true,
        mediaContextRowsByCaptureYear:byYear,
        excluded2026AndOtherYearContextRows:outside,
        contextRowsTotal:contextTotal,
        distinctArticleDocsSummedByCaptureYear:documentYearSum,
        fullSourceRowsExported:false,
        originalArticleBodiesRead:false,
        humanQuotesVerified:0,
        statewideDenominatorEstablished:false,
        databaseModified:false,
      };
    } finally {
      if(transactionStarted){
        try{await client.query('ROLLBACK');}catch{/* always close client */ }
      }
      client.release(true);
    }
  } finally {
    await pool.end();
  }
}
/** A fixed phase enum is the only diagnostic allowed into public CI logs. */
let lastSafePhase:'not_started'|'manual_approval_verified'|MediaNeonAccessPhase='not_started';
const notePhase:MediaNeonPhaseReporter=phase=>{
  lastSafePhase=phase;
  console.log(JSON.stringify({mediaReadOnlyPhase:phase,completed:true}));
};
async function main():Promise<void>{
  if(process.argv.length!==2)
    throw Error('No CLI arguments permitted for bounded protected Neon media audit');
  assertApprovedDirectNeonWorkflow(process.env);
  lastSafePhase='manual_approval_verified';
  const report=await verifyExistingNeonMediaAggregate({
    apiKey:process.env.NEON_API_KEY?.trim()??'',
    projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID?.trim()??'',
    preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE?.trim()||undefined,
  },fetch,undefined,notePhase);
  // These are aggregate counts only, never raw source records or credentials.
  console.log(JSON.stringify(report));
  if(process.env.GITHUB_STEP_SUMMARY){
    appendFileSync(process.env.GITHUB_STEP_SUMMARY,[
      '## Senate media — existing Neon API key, bounded READ ONLY source count',
      '',
      '**Project, existing branch/database and SQL READ ONLY transaction verified.**',
      '',
      'This checked the selected Neon project default branch, not an independently',
      'proven deployed production DB binding. An existing SQL database owner role may',
      'still have write grants: this one transaction only was READ ONLY.',
      '',
      'Source context rows (capture year; not verified quotations):',
      '',
      '| Capture year | Context evidence rows | Distinct source documents |',
      '| --- | ---: | ---: |',
      ...YEARS.map(year=>[
        '| ',year,' | ',report.mediaContextRowsByCaptureYear[year].contextRows,
        ' | ',report.mediaContextRowsByCaptureYear[year].distinctSourceDocuments,' |',
      ].join('')),
      '',
      'Outside 2021–2025: '+report.excluded2026AndOtherYearContextRows+' context rows.',
      '',
      'No article bodies, senator identities, snapshots, source URLs or private',
      'per-row exports were saved or printed. No database writes occurred.',
      'No statewide article denominator or human quote completeness certified.',
    ].join('\n')+'\n',{encoding:'utf8'});
  }
}

// Test imports exercise the same functions with faked Neon/PG clients only.
if(process.argv[1]&&/check-senate-media-neon-api-readonly\.ts$/.test(process.argv[1]))
  main().catch(()=>{
    // pg errors and Neon fetch diagnostics may contain user/password/endpoints.
    console.error('Existing VotePredict Neon one-key aggregate failed closed at last completed phase: '+lastSafePhase+'; no source records exported');
    process.exitCode=1;
  });
