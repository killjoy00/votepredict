import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

const DATABASE_CANDIDATES=['DATABASE_URL_UNPOOLED','POSTGRES_URL_NON_POOLING','DATABASE_URL','POSTGRES_URL'] as const;
const DATABASE_BRIDGE_URL='https://br-billowing-wave-aecfbwky-dbbridge.compute.c-2.us-east-2.aws.neon.tech/connection';
const DEFAULT_OUTPUT_DIR='artifacts/lifecycle-bill-language-screen-v1';
let secretValues:string[]=[];
function mask(v:string){if(v.length>3)console.log('::add-mask::'+v.replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A'));}
function safeMessage(e:unknown){let m=e instanceof Error?(e.stack??e.message):String(e);for(const v of secretValues.filter(x=>x.length>3).sort((a,b)=>b.length-a.length))m=m.split(v).join('[redacted]');return m.replace(/postgres(?:ql)?:\/\/\S+/gi,'[redacted database URL]').replace(/https?:\/\/\S+/gi,'[source URL]');}
async function canConnect(v:string){const p=new Pool({connectionString:v,max:1,connectionTimeoutMillis:8000});try{await p.query('SELECT 1');return true;}catch{return false;}finally{await p.end().catch(()=>undefined);}}
async function chooseDatabaseUrl(env:Record<string,string|undefined>){for(const k of DATABASE_CANDIDATES){const v=env[k]?.trim();if(v&&await canConnect(v))return v;}const s=env.CRON_SECRET?.trim();if(!s)throw new Error('CRON_SECRET unavailable');const r=await fetch(DATABASE_BRIDGE_URL,{method:'POST',headers:{authorization:'Bearer '+s}});if(!r.ok)throw new Error('Database bridge HTTP '+r.status);const v=(await r.text()).trim();secretValues.push(v);mask(v);if(!await canConnect(v))throw new Error('Database bridge returned non-portable URL');return v;}

async function main(){
  const envPath=process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;if(!envPath)throw new Error('Production environment file required');
  const env=parseRuntimeEnvironment(readFileSync(envPath,'utf8'));secretValues=Object.entries(env).filter(([k])=>/SECRET|PASSWORD|TOKEN|KEY|DATABASE_URL|POSTGRES_URL/i.test(k)).map(([,v])=>v).filter((v):v is string=>typeof v==='string');for(const v of secretValues)mask(v);
  const databaseUrl=await chooseDatabaseUrl(env);secretValues.push(databaseUrl);process.env.DATABASE_URL=databaseUrl;delete process.env.POSTGRES_URL;delete process.env.DATABASE_URL_UNPOOLED;delete process.env.POSTGRES_URL_NON_POOLING;
  const {pool}=await import('../src/lib/db/index.js');
  const {buildLifecycleP3SnapshotDataset}=await import('../src/evaluation/lifecycle-p3-snapshot-dataset.js');
  const {FROZEN_LIFECYCLE_P3_CONTENT_SHA256}=await import('../src/evaluation/lifecycle-p4-baselines.js');
  const {buildLifecycleP5Rows,fitLifecycleP5RetainedProspectiveModel}=await import('../src/evaluation/lifecycle-p5-evidence-allocation.js');
  const {buildLifecycleBillLanguageRows,evaluateLifecycleBillLanguageScreen}=await import('../src/evaluation/lifecycle-bill-language-screen.js');
  try{
    const p3=await buildLifecycleP3SnapshotDataset(process.env.GITHUB_SHA??null);
    if(p3.manifest.snapshotContentSha256!==FROZEN_LIFECYCLE_P3_CONTENT_SHA256)throw new Error('Bill-language screen refuses P3 drift');
    const ids=[...new Set(p3.snapshots.map(s=>s.features.latestEligibleBillVersion?.billVersionId).filter((v):v is string=>Boolean(v)))];
    const result=await pool.query<{id:string;text_hash:string|null;raw_text:string|null}>(`
      SELECT id::text,text_hash,raw_text FROM bill_versions WHERE id = ANY($1::uuid[]) ORDER BY id`,[ids]);
    const versions=new Map(result.rows.filter(r=>r.raw_text).map(r=>[r.id,{id:r.id,textHash:r.text_hash,rawText:r.raw_text!}]));
    const missing=ids.filter(id=>!versions.has(id));
    if(missing.length)throw new Error('Bill-language screen missing raw text for '+missing.length+' frozen versions');
    const trainingSnapshots=p3.snapshots.filter(r=>r.bill.session==='2021-2022');
    const p5Model=fitLifecycleP5RetainedProspectiveModel(buildLifecycleP5Rows(trainingSnapshots));
    const rows=buildLifecycleBillLanguageRows({snapshots:p3.snapshots,versions,p5Model});
    const report={
      ...evaluateLifecycleBillLanguageScreen(rows),
      generatedAt:new Date().toISOString(),
      codeSha:process.env.GITHUB_SHA??null,
      frozenInputs:{p3SnapshotContentSha256:p3.manifest.snapshotContentSha256,versionIds:ids.length,versionRows:result.rows.length},
    };
    const outputDir=process.env.VOTEPREDICT_BILL_LANGUAGE_OUTPUT_DIR?.trim()||DEFAULT_OUTPUT_DIR;
    await mkdir(outputDir,{recursive:true});
    await writeFile(join(outputDir,'report.json'),JSON.stringify(report,null,2)+'\n','utf8');
    await writeFile(join(outputDir,'rows.ndjson'),rows.map(r=>JSON.stringify({...r,tokens:undefined})).join('\n')+'\n','utf8');
    console.log(JSON.stringify({lifecycleBillLanguageScreen:report},null,2));
  }finally{await pool.end();}
}
main().catch(e=>{console.error(safeMessage(e));process.exitCode=1;});
