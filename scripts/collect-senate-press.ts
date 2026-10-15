/**
 * Raw Senate DFL + Republican caucus and member publications (2023 onward).
 * Inclusive ranges; archives traverse current/newest first.
 *
 * npm run data:senate:statements -- --from=2025-01-01 --to=2026-10-15 --dry-run --max-pages=2
 * npm run db:migrate
 * npm run data:senate:statements -- --from=2023-01-01 --to=2026-10-15
 *
 * --dry-run needs no credentials and prints counts, not the full article text.
 * DB mode needs DATABASE_URL (or DATABASE_URL_UNPOOLED) and the migration.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { collectSource, type SenatePressSource, type StatementSink } from '../src/sources/minnesota/senate-press-raw.js';

function arg(args:string[],name:string):string|undefined {
  const inline=args.find(x=>x.startsWith(name+'='));
  return inline?inline.slice(name.length+1):(args.includes(name)?args[args.indexOf(name)+1]:undefined);
}
function date(value:string,label:string):string {
  if(!/^20\d{2}-\d{2}-\d{2}$/.test(value))throw Error(label+' must be YYYY-MM-DD');
  const parsed=new Date(value+'T12:00:00Z');
  if(Number.isNaN(parsed.valueOf())||parsed.toISOString().slice(0,10)!==value)throw Error('Invalid '+label);
  return value;
}
function limit(raw:string|undefined,label:string):number|undefined {
  if(raw===undefined)return undefined;
  if(!/^[1-9]\d*$/.test(raw)||!Number.isSafeInteger(Number(raw)))throw Error('Invalid '+label);
  return Number(raw);
}
function config(json:unknown):SenatePressSource[] {
  if(!Array.isArray(json)||!json.length)throw Error('Expected nonempty source config array');
  const seen=new Set<string>();
  return json.map((value:unknown)=>{
    if(!value||typeof value!=='object')throw Error('Invalid source config');
    const s=value as Record<string,unknown>,p=s.pagination as Record<string,unknown>|undefined;
    if(typeof s.id!=='string'||!(/^[a-z_]+$/).test(s.id)||seen.has(s.id)
      ||typeof s.source_type!=='string'||!(/^[a-z_]+$/).test(s.source_type)
      ||typeof s.archive_url!=='string'||!s.archive_url.startsWith('https://')
      ||!p||(p.kind==='query'?!((typeof p.key==='string')&&(/^[_a-z]+$/).test(p.key)):
             p.kind==='path'?!((typeof p.segment==='string')&&(/^[a-z]+$/).test(p.segment)):true))
      throw Error('Invalid/duplicate source config');
    const url=new URL(s.archive_url);
    if(url.username||url.password||url.search||url.hash||!['senatedfl.mn','www.mnsenaterepublicans.com'].includes(url.hostname))
      throw Error('Non-allowlisted Senate source');
    seen.add(s.id);
    return s as unknown as SenatePressSource;
  });
}
async function main():Promise<void>{
  const args=process.argv.slice(2);
  const from=date(arg(args,'--from')??'2023-01-01','--from');
  const to=date(arg(args,'--to')??new Date().toISOString().slice(0,10),'--to');
  if(from>to)throw Error('--from must be no later than --to');
  const maxPages=limit(arg(args,'--max-pages'),'--max-pages');
  const maxItems=limit(arg(args,'--max-items'),'--max-items');
  const delayMs=limit(arg(args,'--delay-ms'),'--delay-ms');
  const selected=arg(args,'--source');
  const sourceFile=arg(args,'--config')??'data/senate-press-sources.json';
  const sources=config(JSON.parse(await readFile(path.resolve(sourceFile),'utf8')))
    .filter(s=>!selected||s.id===selected);
  if(!sources.length)throw Error('No matching Senate source');
  const dryRun=args.includes('--dry-run');
  let close=async()=>{};
  let sink:StatementSink;
  if(dryRun)sink={existing:async()=>new Set<string>(),insert:async()=>true};
  else{
    const connectionString=process.env.DATABASE_URL_UNPOOLED||process.env.DATABASE_URL;
    if(!connectionString)throw Error('DATABASE_URL or DATABASE_URL_UNPOOLED required for inserts');
    const {Pool}=await import('pg');
    const {SenatePressRawStore}=await import('../src/operations/senate-press-raw-store.js');
    const pool=new Pool({connectionString,max:2});
    close=async()=>{await pool.end();};
    sink=new SenatePressRawStore(pool);
  }
  let failed=false;
  try{
    for(const source of sources){
      const result=await collectSource(source,{from,to,maxPages,maxItems,delayMs,dryRun},sink);
      console.log(JSON.stringify(result));
      if(result.failures.length||!result.pages)failed=true;
    }
  }finally{await close();}
  if(failed)process.exitCode=1;
}
main().catch(error=>{
  console.error(error instanceof Error?error.message:'Senate statement collection failed');
  process.exitCode=1;
});
