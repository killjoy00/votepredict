import {readFileSync} from 'node:fs';
import {parseRuntimeEnvironment} from '../src/operations/environment-file.js';

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
 const contents=readFileSync(path,'utf8');
 const env=parseRuntimeEnvironment(contents);
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
 for(const key of ['CRON_SECRET'])if(!env[key])throw new Error(`Missing production variable: ${key}`);
 if(Number(env.FORECAST_BATCH_SIZE??10)!==10)throw new Error('Production FORECAST_BATCH_SIZE must be 10');
 stage='public health';
 const health=await fetch('https://votepredict.vercel.app/api/health',{signal:AbortSignal.timeout(30000)});
 if(!health.ok || (await health.json()).database!=='ok')throw new Error('Production health failed');
 stage='unauthenticated cron';
 const unauthorized=await fetch('https://votepredict.vercel.app/api/cron/forecasts',{signal:AbortSignal.timeout(30000)});
 if(unauthorized.status!==401)throw new Error('Unauthenticated cron must return 401');
 stage='authenticated system smoke';
 const response=await fetch('https://votepredict.vercel.app/api/cron/forecasts?systemSmoke=1',{
  headers:{Authorization:`Bearer ${env.CRON_SECRET}`},signal:AbortSignal.timeout(310000)});
 if(response.status!==200)throw new Error(`Authenticated system smoke returned HTTP ${response.status}`);
 const result=await response.json();
 console.log(JSON.stringify({health:'ok',unauthenticatedCron:401,authenticatedCron:200,
  productionBatchSize:10,smokeBatchSize:1,claimed:result.claimed,completed:result.completed,
  failed:result.failed,latestRun:result.latestRun}));
 if((result.alreadyCompleted ? result.claimed!==0 : result.claimed!==1||result.completed!==1)||result.failed!==0)
  throw new Error('One-item scheduler smoke did not complete');
 if(result.latestRun?.status!=='completed'||!result.latestRun.finished||
   !(result.latestRun.has_revision||result.latestRun.has_resolution))
  throw new Error('Completed smoke must have a finished ledger and revision or resolution');
 stage='system Deep research';
 const deep=await fetch('https://votepredict.vercel.app/api/cron/forecasts?systemDeep=1',{
  method:'POST',headers:{Authorization:`Bearer ${env.CRON_SECRET}`},signal:AbortSignal.timeout(310000)});
 if(deep.status!==200)throw new Error(`Deep research check returned HTTP ${deep.status}`);
 const research=await deep.json();
 console.log(JSON.stringify({deepResearch:research}));
 if(research.mode!=='deep'||research.failure||research.evidenceCount<1||research.sourceCount<1)
  throw new Error(`Deep research is not ready: ${research.failure??'no_persisted_evidence'}`);

}
main().catch(error=>{console.error(JSON.stringify(safeError(error)));process.exitCode=1;});
