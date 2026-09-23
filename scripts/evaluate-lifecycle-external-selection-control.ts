import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES=['DATABASE_URL_UNPOOLED','POSTGRES_URL_NON_POOLING','DATABASE_URL','POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL='https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const DEFAULT_OUTPUT_DIR='artifacts/lifecycle-external-selection-control-v1';
let secretValues:string[]=[];

function mask(value:string){if(value.length>3)console.log('::add-mask::'+value.replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A'));}
function safeMessage(error:unknown){let message=error instanceof Error?(error.stack??error.message):String(error);for(const value of secretValues.filter(v=>v.length>3).sort((a,b)=>b.length-a.length))message=message.split(value).join('[redacted]');return message.replace(/postgres(?:ql)?:\/\/\S+/gi,'[redacted database URL]').replace(/https?:\/\/\S+/gi,'[source URL]');}
async function canConnect(value:string){const probe=new Pool({connectionString:value,max:1,connectionTimeoutMillis:8000});try{await probe.query('SELECT 1');return true;}catch{return false;}finally{await probe.end().catch(()=>undefined);}}
async function chooseDatabaseUrl(env:Record<string,string|undefined>){for(const key of DATABASE_CANDIDATES){const value=env[key]?.trim();if(value&&await canConnect(value))return value;}const secret=env.CRON_SECRET?.trim();if(!secret)throw new Error('CRON_SECRET unavailable');const response=await fetch(DATABASE_BRIDGE_URL,{method:'POST',headers:{authorization:'Bearer '+secret}});if(!response.ok)throw new Error('Database bridge HTTP '+response.status);const value=(await response.text()).trim();secretValues.push(value);mask(value);if(!await canConnect(value))throw new Error('Database bridge returned non-portable URL');return value;}

async function main(){
  const frozenPath=process.env.VOTEPREDICT_EXTERNAL_AVAILABILITY_FILE;
  if(!frozenPath)throw new Error('Frozen external availability file required');
  const availability=await import('../src/evaluation/lifecycle-external-availability.js');
  const accepted=readFileSync(frozenPath,'utf8').split(/\r?\n/).filter(Boolean).map((line)=>JSON.parse(line));
  const acceptedHash=availability.lifecycleExternalAvailabilityContentSha256(accepted);
  if(acceptedHash!==availability.LIFECYCLE_EXTERNAL_AVAILABILITY_FROZEN_CONTENT_SHA256){
    throw new Error('Selection control refuses frozen availability drift: '+acceptedHash);
  }

  const envPath=process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;if(!envPath)throw new Error('Production environment file required');
  const env=parseRuntimeEnvironment(readFileSync(envPath,'utf8'));secretValues=Object.entries(env).filter(([k])=>/SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(k)).map(([,v])=>v).filter((v):v is string=>typeof v==='string');for(const v of secretValues)mask(v);
  const databaseUrl=await chooseDatabaseUrl(env);secretValues.push(databaseUrl);process.env.DATABASE_URL=databaseUrl;delete process.env.POSTGRES_URL;delete process.env.DATABASE_URL_UNPOOLED;delete process.env.POSTGRES_URL_NON_POOLING;

  const {pool}=await import('../src/lib/db/index.js');
  const {buildLifecycleP3SnapshotDataset}=await import('../src/evaluation/lifecycle-p3-snapshot-dataset.js');
  const {FROZEN_LIFECYCLE_P3_CONTENT_SHA256}=await import('../src/evaluation/lifecycle-p4-baselines.js');
  const {buildLifecycleP5Rows,fitLifecycleP5RetainedProspectiveModel}=await import('../src/evaluation/lifecycle-p5-evidence-allocation.js');
  const {buildLifecycleExternalSelectionRows,evaluateLifecycleExternalSelectionControl}=await import('../src/evaluation/lifecycle-external-selection-control.js');
  try{
    const p3=await buildLifecycleP3SnapshotDataset(process.env.GITHUB_SHA??null);
    if(p3.manifest.snapshotContentSha256!==FROZEN_LIFECYCLE_P3_CONTENT_SHA256)throw new Error('Selection control refuses P3 drift');
    const trainingSnapshots=p3.snapshots.filter((row)=>row.bill.session==='2021-2022');
    const p5Model=fitLifecycleP5RetainedProspectiveModel(buildLifecycleP5Rows(trainingSnapshots));
    const rows=buildLifecycleExternalSelectionRows({snapshots:p3.snapshots,accepted,p5Model});
    const result=evaluateLifecycleExternalSelectionControl(rows);
    const report={
      ...result,
      generatedAt:new Date().toISOString(),
      codeSha:process.env.GITHUB_SHA??null,
      frozenInputs:{
        externalAvailabilitySha256:acceptedHash,
        p3SnapshotContentSha256:p3.manifest.snapshotContentSha256,
      },
    };
    const outputDir=process.env.VOTEPREDICT_EXTERNAL_SELECTION_OUTPUT_DIR?.trim()||DEFAULT_OUTPUT_DIR;
    await mkdir(outputDir,{recursive:true});
    await writeFile(join(outputDir,'report.json'),JSON.stringify(report,null,2)+'\n','utf8');
    await writeFile(join(outputDir,'selection-rows.ndjson'),rows.map((row)=>JSON.stringify(row)).join('\n')+'\n','utf8');
    const reportHash=createHash('sha256').update(JSON.stringify(report)).digest('hex');
    console.log(JSON.stringify({lifecycleExternalSelectionControl:{...report,reportContentSha256:reportHash}},null,2));
  }finally{await pool.end();}
}
main().catch((error)=>{console.error(safeMessage(error));process.exitCode=1;});
