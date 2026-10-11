/**
 * One-shot ORIGINAL campaign archive recovery for six further actual Senate-serving Minnesota state senators.
 * No network access unless original independent LRL Senate directory HTML and
 * its public observed-at and SHA-256 receipt are reverified.
 */
import {readFileSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {parseOfficialMnSenateServiceDirectory} from
 '../src/evidence/senate-official-ever-served-directory.js';
import {acquireSixPreviouslyUncoveredSenators2022OriginalCampaignSites} from
 './acquire-six-followup-2022-serving-originals.js';

function bounded(path:string,min:number,max:number){
 const st=statSync(path);
 if(!st.isFile()||st.size<min||st.size>max)
  throw Error('Independently preserved official Senate member original is missing or oversized');
 return readFileSync(path);
}
async function main(){
 const args=process.argv.slice(2);
 const fields=['--lrl-directory-html','--lrl-original-source-receipt','--output-dir'];
 if(args.length!==fields.length*2||fields.some(x=>args.filter(a=>a===x).length!==1))
  throw Error('Must supply exactly LRL original Senate HTML, pinned original-source receipt and exclusive output directory');
 const [html,receipt,output]=fields.map(f=>{
  const i=args.indexOf(f),value=i<0?undefined:args[i+1];
  if(!value||value.startsWith('--'))throw Error('Original public LRL Senate service bytes/receipt required');
  return resolve(value);
 });
 if(new Set([html,receipt,output]).size!==3)
  throw Error('Never overwrite original official evidence files or conflate source and output');
 const b=bounded(html,9000,5*1024*1024);
 const m=JSON.parse(bounded(receipt,100,3*1024*1024).toString('utf8')) as{
  source?:{url?:string;observedAt?:string;sourceBytesSha256?:string};
 };
 if(m.source?.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
   ||!m.source.observedAt
   ||m.source.sourceBytesSha256!==createHash('sha256').update(b).digest('hex'))
  throw Error('Actual LRL original government directory HTML or acquisition SHA/date receipt mismatch');
 const source=parseOfficialMnSenateServiceDirectory(b,m.source.observedAt);
 const report=await acquireSixPreviouslyUncoveredSenators2022OriginalCampaignSites(output,source);
 console.log('SIX-UNCOVERED-SENATORS-2022-ORIGINAL-SOURCE-RESULTS '+
  JSON.stringify(report.totals));
}
main().catch(error=>{
 console.error('Original 2022 senators campaign site source not admitted: '+
  (error instanceof Error?error.message.slice(0,240):'unknown'));
 process.exitCode=1;
});
