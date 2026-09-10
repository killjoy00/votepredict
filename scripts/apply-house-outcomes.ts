import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
const file=process.argv.find(a=>a.startsWith('--manifest='))?.slice(11);
if(!file)throw new Error('Specify --manifest=PATH; writes require --apply');
const manifest=JSON.parse(readFileSync(file,'utf8')) as Array<{id:string;passed:boolean}>;
if(!Array.isArray(manifest)||new Set(manifest.map(r=>r.id)).size!==manifest.length||manifest.some(r=>typeof r.passed!=='boolean'))throw new Error('Invalid or duplicate outcome rows');
async function main(){
 if(!process.argv.includes('--apply')){console.log(JSON.stringify({candidates:manifest.length,writes:0}));return;}
 const pool=new Pool({connectionString:process.env.DATABASE_URL_UNPOOLED||process.env.DATABASE_URL,max:1});
 try{const result=await pool.query(readFileSync(new URL('./house-outcome-repair.sql',import.meta.url),'utf8'),[JSON.stringify(manifest)]);console.log(JSON.stringify({updated:result.rowCount}));}
 finally{await pool.end();}
}
main().catch(()=>{console.error('House outcome application failed; inspect the database without exposing credentials.');process.exitCode=1;});
