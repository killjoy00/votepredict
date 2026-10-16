/** Reviewed, bounded eight-document raw import. Existing Neon primary only. */
import {readFileSync,readdirSync,appendFileSync} from 'node:fs';
import {setTimeout as sleep} from 'node:timers/promises';
import {Client} from 'pg';
import {discoverExistingVotePredictNeonConnection} from '../src/operations/senate-media-neon-api-readonly.js';
import {compareMigrationLedgers,hasMigrationLedgerDrift} from '../src/operations/migration-ledger.js';
import {MINUTE_RECOVERY_BATCH,validateMinuteRecoveryCorpus,sha256,
  importRecoveredMinutes,readRecoveredMinutes,type MinuteRecoveryCorpus} from '../src/operations/senate-minute-gap-recovery.js';

export const RECOVERY_MARKER='SENATE_MINUTE_GAP_RAW_20261016';
export const CORPUS_PATH='data/collections/senate-minute-gap-recovery-20261016.json';
export function assertMinuteRecoveryEnvironment(env:Record<string,string|undefined>,event:{
  ref?:string;after?:string;forced?:boolean;deleted?:boolean;
  repository?:{full_name?:string};head_commit?:{id?:string;message?:string};
}){
  if(env.GITHUB_REPOSITORY!=='killjoy00/votepredict'||env.GITHUB_EVENT_NAME!=='push'||
    env.GITHUB_REF!=='refs/heads/main'||env.GITHUB_RUN_ATTEMPT!=='1'||
    env.VOTEPREDICT_MINUTES_INDEPENDENT_CI!=='true'||!env.NEON_API_KEY||!env.VOTEPREDICT_NEON_PROJECT_ID||
    !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA??'')||event.ref!==env.GITHUB_REF||
    event.after!==env.GITHUB_SHA||event.head_commit?.id!==env.GITHUB_SHA||
    event.repository?.full_name!==env.GITHUB_REPOSITORY||event.forced===true||event.deleted===true||
    !event.head_commit?.message?.includes(RECOVERY_MARKER))
    throw Error('Minute recovery requires first-attempt reviewed exact-main marker after independent CI');
}
async function sourceBytes(url:string,maxBytes:number):Promise<Uint8Array>{
  await sleep(1200);
  const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(45000),
    headers:{'user-agent':'VotePredict/2.0 targeted-public-minute-recovery'}});
  if(r.status!==200||!r.body||Number(r.headers.get('content-length')??0)>maxBytes)
    throw Error('Original minute transport or byte bound failed');
  const reader=r.body.getReader(),parts:Uint8Array[]=[];let total=0;
  try{
    while(true){const part=await reader.read();if(part.done)break;
      total+=part.value.byteLength;if(total>maxBytes){await reader.cancel();throw Error('Original minute too large');}
      parts.push(part.value);}
  }finally{reader.releaseLock();}
  return Buffer.concat(parts,total);
}
async function verifySources(corpus:MinuteRecoveryCorpus){
  const indexes=new Map<string,string>();
  for(const row of corpus.documents){
    if(!indexes.has(row.indexUrl))indexes.set(row.indexUrl,
      new TextDecoder().decode(await sourceBytes(row.indexUrl,3_000_000)));
    if(!indexes.get(row.indexUrl)!.includes(row.sourceUrl))
      throw Error('Original index no longer links to selected PDF');
    const bytes=await sourceBytes(row.sourceUrl,8_000_000);
    if(bytes.length!==row.bytes||sha256(bytes)!==row.contentSha256||
      new TextDecoder().decode(bytes.subarray(0,5))!=='%PDF-')
      throw Error('Selected original PDF SHA or bytes changed');
  }
  console.log(JSON.stringify({batch:MINUTE_RECOVERY_BATCH,verifiedOriginalPdfs:corpus.documents.length,
    remainingWrittenMinuteDates:corpus.remainingGaps.length}));
}
async function readOnly<T>(client:Client,run:()=>Promise<T>):Promise<T>{
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try{
    const r=await client.query("SELECT current_setting('transaction_read_only') AS ro");
    if(r.rows[0]?.ro!=='on')throw Error('Read-only transaction not verified');
    return await run();
  }finally{await client.query('ROLLBACK');}
}
async function protectedImport(corpus:MinuteRecoveryCorpus){
  assertMinuteRecoveryEnvironment(process.env,JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH??'','utf8')));
  const target=await discoverExistingVotePredictNeonConnection({apiKey:process.env.NEON_API_KEY!,
    projectId:process.env.VOTEPREDICT_NEON_PROJECT_ID!,
    preferredDatabase:process.env.VOTEPREDICT_MEDIA_EXISTING_DATABASE||undefined,requirePrimary:true});
  const client=new Client({host:target.host,port:target.port,user:target.role,password:target.password,
    database:target.database,ssl:{rejectUnauthorized:true},connectionTimeoutMillis:10000,
    statement_timeout:20000,query_timeout:25000,application_name:MINUTE_RECOVERY_BATCH});
  await client.connect();
  try{
    const before=await readOnly(client,async()=>{
      const identity=await client.query('SELECT current_database() AS db,current_user AS role');
      if(identity.rows[0]?.db!==target.database||identity.rows[0]?.role!==target.role)
        throw Error('Database identity mismatch');
      const expected=readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort().map(filename=>
        ({filename,checksum:sha256(readFileSync('migrations/'+filename))}));
      const ledger=await client.query<{filename:string;checksum:string}>(
        'SELECT filename,checksum FROM votepredict_schema_migrations ORDER BY filename');
      if(hasMigrationLedgerDrift(compareMigrationLedgers(expected,ledger.rows)))throw Error('Migration ledger drift');
      const allowed=await client.query("SELECT (has_table_privilege(current_user,'source_documents','INSERT') AND has_table_privilege(current_user,'source_documents','UPDATE')) AS allowed");
      if(!allowed.rows[0]?.allowed)throw Error('Raw source write privilege missing');
      return readRecoveredMinutes(client,corpus);
    });
    await client.query('BEGIN');
    let imported;
    try{
      await client.query("SET LOCAL lock_timeout='5s'");
      imported=await importRecoveredMinutes(client,corpus);
      if(imported.matching!==imported.expected)throw Error('Exact full-text raw readback failed');
      await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK');throw error;}
    const after=await readOnly(client,()=>readRecoveredMinutes(client,corpus));
    if(after.matching!==after.expected)throw Error('Post-commit raw text readback failed');
    const receipt={batch:MINUTE_RECOVERY_BATCH,before:before.matching,changed:imported.changed,...after,
      remainingWrittenMinuteDates:corpus.remainingGaps.length,
      sourceDocumentsOnly:true,forecastingUnchanged:true};
    console.log(JSON.stringify(receipt));
    if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      'Recovered official Senate minutes (raw only)\n\n```json\n'+JSON.stringify(receipt,null,2)+'\n```\n');
  }finally{await client.end();}
}
async function main(){
  let phase='validate_checked_in_corpus';
  try{
    const corpus=JSON.parse(readFileSync(CORPUS_PATH,'utf8')) as MinuteRecoveryCorpus;
    validateMinuteRecoveryCorpus(corpus);
    if(process.argv[2]==='--verify-sources'){phase='public_original_source_verification';await verifySources(corpus);}
    else if(process.argv[2]==='--protected'){phase='guarded_raw_import';await protectedImport(corpus);}
    else throw Error('Expected --verify-sources or --protected');
  }catch{
    // Do not export SQL errors, connection objects, raw data or credentials.
    console.error(JSON.stringify({batch:MINUTE_RECOVERY_BATCH,failedPhase:phase}));process.exitCode=1;
  }
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/recover-senate-minute-gaps.ts'))void main();
