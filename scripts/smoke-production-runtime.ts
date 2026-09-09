import {readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';

let stage='configuration';
let secretValues:string[]=[];
function safeError(error:unknown){
 let message=error instanceof Error?error.message:'Unknown failure';
 for(const value of secretValues.filter(v=>v.length>3).sort((a,b)=>b.length-a.length))message=message.split(value).join('[redacted]');
 return {stage,error:error instanceof Error?error.name:'Error',message:message.replace(/postgres(?:ql)?:\/\/\S+/g,'[redacted database URL]')};
}
async function main(){
 const path=process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
 if(!path)throw new Error('Production environment file is required');
 const env=parseEnv(readFileSync(path,'utf8'));
 secretValues=Object.entries(env).filter(([key])=>/SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(key)).map(([,value])=>value).filter((value):value is string=>typeof value==='string');
 try{const uri=new URL(env.DATABASE_URL??'');secretValues.push(decodeURIComponent(uri.username),decodeURIComponent(uri.password));}catch{}
 // Mask before loading modules or reporting errors. Never print the file or a connection URL.
 for(const [key,value] of Object.entries(env))if(value && /SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(key))console.log(`::add-mask::${value.replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A')}`);
 console.log(JSON.stringify({configuration:{databasePresent:Boolean(env.DATABASE_URL),cronSecretPresent:Boolean(env.CRON_SECRET),batchSize:Number(env.FORECAST_BATCH_SIZE??10)}}));
 const projectResponse=await fetch(`https://api.vercel.com/v9/projects/${process.env.VERCEL_PROJECT_ID}?teamId=${process.env.VERCEL_ORG_ID}`,{headers:{Authorization:`Bearer ${process.env.VERCEL_TOKEN}`},signal:AbortSignal.timeout(30000)});
 if(!projectResponse.ok)throw new Error('Project configuration lookup failed');
 const project=await projectResponse.json();
 const definitions=project.crons?.definitions??[];
 console.log(JSON.stringify({cronRegistration:{enabled:project.crons?.enabled??null,matchingDailyDefinition:definitions.some((d:{path:string;schedule:string})=>d.path==='/api/cron/forecasts'&&d.schedule==='17 11 * * *')}}));
 for(const key of ['DATABASE_URL','CRON_SECRET'])if(!env[key])throw new Error(`Missing production variable: ${key}`);
 if(Number(env.FORECAST_BATCH_SIZE??10)!==10)throw new Error('Production FORECAST_BATCH_SIZE must be 10');
 stage='public health';
 const health=await fetch('https://votepredict.vercel.app/api/health',{signal:AbortSignal.timeout(30000)});
 if(!health.ok || (await health.json()).database!=='ok')throw new Error('Production health failed');
 stage='unauthenticated cron';
 const unauthorized=await fetch('https://votepredict.vercel.app/api/cron/forecasts',{signal:AbortSignal.timeout(30000)});
 if(unauthorized.status!==401)throw new Error('Unauthenticated cron must return 401');
 // Only inject what Quick mode needs; no AI keys and no deployment OIDC token.
 process.env.DATABASE_URL=env.DATABASE_URL;
 stage='load database module';
 const {pool}=await import('../src/lib/db/index.js');
 try{
  stage='database identity query';
  const matches=await pool.query("SELECT id FROM forecasts WHERE owner_user_id='system:production-smoke' AND archived_at IS NULL");
  if(matches.rows.length!==1)throw new Error('Expected exactly one system smoke forecast');
  const forecastId=matches.rows[0].id as string;
  stage='schedule query';
  const before=await pool.query(`SELECT fs.enabled,fs.research_mode,fs.next_run_at<=now() AS due,f.owner_user_id FROM forecast_schedules fs JOIN forecasts f ON f.id=fs.forecast_id WHERE f.id=$1`,[forecastId]);
  const schedule=before.rows[0];
  if(!schedule || schedule.owner_user_id!=='system:production-smoke'||schedule.research_mode!=='quick')throw new Error('System Quick smoke schedule does not match expected identity');
  if(!schedule.enabled||!schedule.due)throw new Error('System smoke schedule is disabled or not due; inspect its existing runs');
  stage='load scheduler module';
  const {runScheduledForecasts}=await import('../src/operations/scheduled-forecasts.js');
  stage='scheduler execution';
  const result=await runScheduledForecasts(1,undefined,forecastId);
  console.log(JSON.stringify({health:'ok',unauthenticatedCron:401,cronSecretConfigured:true,productionBatchSize:10,smokeBatchSize:1,...result}));
  if(result.claimed!==1||result.completed!==1||result.failed!==0)throw new Error('One-item scheduler smoke did not complete');
  const runs=await pool.query(`SELECT status,revision_id IS NOT NULL AS has_revision,resolution_id IS NOT NULL AS has_resolution,finished_at IS NOT NULL AS finished FROM forecast_snapshot_runs WHERE forecast_id=$1 ORDER BY started_at DESC LIMIT 1`,[forecastId]);
  console.log(JSON.stringify({latestRun:runs.rows[0]}));
  const due=await pool.query("SELECT count(*)::int AS count FROM forecast_schedules WHERE enabled AND next_run_at<=now()");
  if(due.rows[0].count===0){
   const authenticated=await fetch('https://votepredict.vercel.app/api/cron/forecasts',{headers:{Authorization:`Bearer ${env.CRON_SECRET}`},signal:AbortSignal.timeout(30000)});
   if(authenticated.status!==200)throw new Error('Authenticated cron did not return 200');
   const batch=await authenticated.json();
   console.log(JSON.stringify({authenticatedCron:authenticated.status,claimed:batch.claimed,failed:batch.failed}));
   if(batch.claimed!==0||batch.failed!==0)throw new Error('Authenticated cron empty-batch validation failed');
  }else console.log('Authenticated cron check deferred because other schedules are due');
 }finally{await pool.end();}
}
main().catch(error=>{console.error(JSON.stringify(safeError(error)));process.exitCode=1;});
