import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES = ['DATABASE_URL_UNPOOLED','POSTGRES_URL_NON_POOLING','DATABASE_URL','POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL='https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const DEFAULT_OUTPUT_DIR='artifacts/lifecycle-external-evidence-screen-v1';
let secretValues:string[]=[];

type EvidenceRow={evidence_id:string;source_document_id:string;bill_id:string|null;membership_id:string|null;session_slug:string|null;source_kind:string;evidence_kind:string;stance:string|null;published_at:string|null;fetched_at:string;metadata:Record<string,unknown>|null;news_publication_date_source:string|null};

function mask(value:string){if(value.length>3)console.log('::add-mask::'+value.replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A'));}
function safeMessage(error:unknown){let message=error instanceof Error?(error.stack??error.message):String(error);for(const value of secretValues.filter(v=>v.length>3).sort((a,b)=>b.length-a.length))message=message.split(value).join('[redacted]');return message.replace(/postgres(?:ql)?:\/\/\S+/gi,'[redacted database URL]').replace(/https?:\/\/\S+/gi,'[source URL]');}
async function canConnect(value:string){const probe=new Pool({connectionString:value,max:1,connectionTimeoutMillis:8000});try{await probe.query('SELECT 1');return true;}catch{return false;}finally{await probe.end().catch(()=>undefined);}}
async function chooseDatabaseUrl(env:Record<string,string|undefined>){for(const key of DATABASE_CANDIDATES){const value=env[key]?.trim();if(value&&await canConnect(value))return value;}const secret=env.CRON_SECRET?.trim();if(!secret)throw new Error('CRON_SECRET unavailable');const response=await fetch(DATABASE_BRIDGE_URL,{method:'POST',headers:{authorization:'Bearer '+secret}});if(!response.ok)throw new Error('Database bridge HTTP '+response.status);const value=(await response.text()).trim();secretValues.push(value);mask(value);if(!await canConnect(value))throw new Error('Database bridge returned non-portable URL');return value;}

function loadAcceptedFromFrozenFile(path:string){
  const {
    lifecycleExternalAvailabilityContentSha256,
    LIFECYCLE_EXTERNAL_AVAILABILITY_FROZEN_CONTENT_SHA256,
  }=requireAvailability();
  const accepted=readFileSync(path,'utf8').split(/\r?\n/).filter(Boolean).map((line)=>JSON.parse(line));
  const hash=lifecycleExternalAvailabilityContentSha256(accepted);
  if(hash!==LIFECYCLE_EXTERNAL_AVAILABILITY_FROZEN_CONTENT_SHA256){
    throw new Error('Frozen external availability artifact drift before outcome read: '+hash);
  }
  return {accepted,hash};
}
let availabilityModule:any;
function requireAvailability(){
  if(!availabilityModule) throw new Error('Availability module was not initialized');
  return availabilityModule;
}

async function main(){
  const envPath=process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;if(!envPath)throw new Error('Production environment file required');
  const env=parseRuntimeEnvironment(readFileSync(envPath,'utf8'));secretValues=Object.entries(env).filter(([k])=>/SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(k)).map(([,v])=>v).filter((v):v is string=>typeof v==='string');for(const v of secretValues)mask(v);
  const databaseUrl=await chooseDatabaseUrl(env);secretValues.push(databaseUrl);process.env.DATABASE_URL=databaseUrl;delete process.env.POSTGRES_URL;delete process.env.DATABASE_URL_UNPOOLED;delete process.env.POSTGRES_URL_NON_POOLING;
  availabilityModule=await import('../src/evaluation/lifecycle-external-availability.js');
  const frozenAvailabilityPath=process.env.VOTEPREDICT_EXTERNAL_AVAILABILITY_FILE;
  if(!frozenAvailabilityPath)throw new Error('Frozen external availability file required');
  // Phase 1: exact outcome-blind artifact reproduction, independent of the mutable evidence tables.
  const availability=loadAcceptedFromFrozenFile(frozenAvailabilityPath);

  const {pool}=await import('../src/lib/db/index.js');
  try{
    // Phase 2 starts only after the frozen availability artifact gate.
    const {buildLifecycleP3SnapshotDataset}=await import('../src/evaluation/lifecycle-p3-snapshot-dataset.js');
    const {FROZEN_LIFECYCLE_P3_CONTENT_SHA256,fitLifecycleP4ProspectiveStageModel,predictLifecycleP4ProspectiveStageModel}=await import('../src/evaluation/lifecycle-p4-baselines.js');
    const {buildLifecycleExternalFeatureRows,evaluateLifecycleExternalEvidenceScreen}=await import('../src/evaluation/lifecycle-external-evidence-screen.js');
    const p3=await buildLifecycleP3SnapshotDataset(process.env.GITHUB_SHA??null);
    if(p3.manifest.snapshotContentSha256!==FROZEN_LIFECYCLE_P3_CONTENT_SHA256)throw new Error('P3 drift in external evidence screen');
    const training=p3.snapshots.filter((row)=>row.bill.session==='2021-2022');
    const baselineModel=fitLifecycleP4ProspectiveStageModel(training);
    const featureRows=buildLifecycleExternalFeatureRows({
      snapshots:p3.snapshots,accepted:availability.accepted,baselineModel,baselinePredict:predictLifecycleP4ProspectiveStageModel,
    });
    const report={
      ...evaluateLifecycleExternalEvidenceScreen(featureRows),
      generatedAt:new Date().toISOString(),
      codeSha:process.env.GITHUB_SHA??null,
      frozenInputs:{
        externalAvailabilitySha256:availability.hash,
        p3SnapshotContentSha256:p3.manifest.snapshotContentSha256,
      },
    };
    const outputDir=process.env.VOTEPREDICT_EXTERNAL_SCREEN_OUTPUT_DIR?.trim()||DEFAULT_OUTPUT_DIR;
    await mkdir(outputDir,{recursive:true});
    await writeFile(join(outputDir,'report.json'),JSON.stringify(report,null,2)+'\n','utf8');
    await writeFile(join(outputDir,'feature-rows.ndjson'),featureRows.map((row)=>JSON.stringify(row)).join('\n')+'\n','utf8');
    console.log(JSON.stringify({lifecycleExternalEvidenceScreen:report},null,2));
  }finally{await pool.end();}
}
main().catch((error)=>{console.error(safeMessage(error));process.exitCode=1;});
