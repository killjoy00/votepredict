/**
 * Raw-only Minnesota State Senate questionnaire collector.
 * npm run data:senate:questionnaires -- --dry-run --out /tmp/answers.jsonl
 * npm run data:senate:questionnaires -- --write  (database with 0019 applied)
 * Optional --cycle=2026 --source=mhp-housing-2026 --max-sources=5
 */
import { readFileSync,writeFileSync,appendFileSync } from 'node:fs';
import { Pool } from 'pg';
import { collectQuestionnaires,validateCatalog } from '../src/sources/minnesota/senate-questionnaire-raw.js';
import { insertQuestionnaire,questionnaireReadback } from '../src/operations/senate-questionnaire-ingest.js';
function opt(args:string[],key:string):string|undefined {
  return args.find(s=>s.startsWith(key+'='))?.slice(key.length+1)
    ??(args.includes(key)?args[args.indexOf(key)+1]:undefined);
}
function bound(args:string[],key:string,defaultValue:number,max:number):number {
  const raw=opt(args,key);const n=raw===undefined?defaultValue:Number(raw);
  if(!Number.isInteger(n)||n<0||n>max)throw Error(key+' must be an integer in bounds');
  return n;
}
async function main():Promise<void> {
  const args=process.argv.slice(2);
  const write=args.includes('--write');
  if(write&&args.includes('--dry-run'))throw Error('Specify either --write or --dry-run');
  const config=opt(args,'--catalog')??'data/senate-questionnaire-sources.json';
  const sources=validateCatalog(JSON.parse(readFileSync(config,'utf8')));
  const source=opt(args,'--source'),cycle=opt(args,'--cycle');
  if(cycle&&!['2020','2022','2026'].includes(cycle))throw Error('Unknown requested cycle');
  const chosen=sources.filter(s=>(!source||s.id===source)&&(!cycle||String(s.cycle)===cycle));
  if(!chosen.length)throw Error('No matching questionnaire sources');
  const out=opt(args,'--out');
  if(out)writeFileSync(out,'');
  const pool=write?new Pool({
    connectionString:process.env.DATABASE_URL_UNPOOLED||process.env.DATABASE_URL||'',
    max:1,connectionTimeoutMillis:10000,
  }):undefined;
  if(write&&!process.env.DATABASE_URL_UNPOOLED&&!process.env.DATABASE_URL)
    throw Error('Write requires pre-migrated Postgres; use --dry-run instead');
  let inserted=0,previous=0,matched=0;
  try{
    const summary=await collectQuestionnaires({
      sources:chosen,
      maxSources:bound(args,'--max-sources',180,500),
      delayMs:bound(args,'--delay-ms',350,5000),
      onResponse:async item=>{
        if(out)appendFileSync(out,JSON.stringify(item)+'\n');
        if(!pool)return;
        const client=await pool.connect();
        try{
          const r=await insertQuestionnaire(client,item);
          if(r.inserted)inserted++;else previous++;
          if(r.inserted&&r.matched)matched++;
        }finally{client.release();}
      },
    });
    console.log('SENATE_QUESTIONNAIRE_RAW_COLLECTION='+JSON.stringify({
      mode:write?'database':'public_raw_preview',out:out??null,
      ...summary,inserted,previous,matched,
    }));
    if(pool){
      const client=await pool.connect();
      try{
        await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
        try{console.log('SENATE_QUESTIONNAIRE_RAW_READBACK='+JSON.stringify(await questionnaireReadback(client)));}
        finally{await client.query('ROLLBACK');}
      }finally{client.release();}
    }
  }finally{await pool?.end();}
}
void main().catch(err=>{
  // No credentials, raw answer text, or URLs with query tokens in diagnostics.
  console.error('Raw Senate questionnaire collection failed: '+(err instanceof Error?err.message.slice(0,200):'unknown error'));
  process.exitCode=1;
});
