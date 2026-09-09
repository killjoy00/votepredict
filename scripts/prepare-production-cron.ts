import {randomBytes} from 'node:crypto';
import {appendFileSync} from 'node:fs';

async function main(){
 const {VERCEL_TOKEN:token,VERCEL_PROJECT_ID:project,VERCEL_ORG_ID:team}=process.env;
 if(!token||!project||!team)throw new Error('Missing Vercel access configuration');
 const endpoint=`https://api.vercel.com/v10/projects/${project}/env?teamId=${team}`;
 const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
 const response=await fetch(endpoint,{headers,signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error(`Environment metadata lookup failed (${response.status})`);
 const data=await response.json();
 const entries=Array.isArray(data)?data:data.envs;
 if(!Array.isArray(entries))throw new Error('Unexpected environment metadata format');
 let changed=false;
 for(const key of ['CRON_SECRET','FORECAST_BATCH_SIZE']){
  const existing=entries.some((e:{key:string;target:string[]|string})=>e.key===key&&(Array.isArray(e.target)?e.target.includes('production'):e.target==='production'));
  if(existing){console.log(`${key}: existing production variable preserved`);continue;}
  const value=key==='CRON_SECRET'?randomBytes(32).toString('hex'):'10';
  if(key==='CRON_SECRET')console.log(`::add-mask::${value}`);
  const created=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify({key,value,type:key==='CRON_SECRET'?'encrypted':'plain',target:['production']}),signal:AbortSignal.timeout(30000)});
  if(!created.ok)throw new Error(`Could not create ${key} (${created.status})`);
  console.log(`${key}: created for production`);changed=true;
 }
 if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,`changed=${changed}\n`);
}
main().catch(e=>{console.error(e instanceof Error?e.message:'Cron configuration failed');process.exitCode=1;});
