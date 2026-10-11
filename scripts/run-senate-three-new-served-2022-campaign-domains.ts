/**
 * Source-only first-party original 2022 campaign discovery for exactly three
 * actually served Minnesota senators after official LRL source rehash.
 * Never read production DB or write model/evidence; no office contact.
 */
import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {parseOfficialMnSenateServiceDirectory} from
 '../src/evidence/senate-official-ever-served-directory.js';
import {acquireThree2022ActuallyServedCampaignDomains} from
 './acquire-senate-three-new-served-2022-campaign-domains.js';
function bounded(path:string,min:number,max:number){
 const s=statSync(path);if(!s.isFile()||s.size<min||s.size>max)
  throw Error('Original public LRL senator-service source is missing or unbounded');
 return readFileSync(path);
}
async function main(){
 const args=process.argv.slice(2);
 const keys=['--lrl-original','--lrl-metadata','--output-dir'];
 if(args.length!==6||keys.some(k=>args.filter(x=>x===k).length!==1))
  throw Error('Original LRL directory, provenance and distinct output folder required');
 const vals=keys.map(k=>{
  const i=args.indexOf(k),x=i<0?undefined:args[i+1];
  if(!x||x.startsWith('--'))throw Error('Official original source input must not be omitted');
  return resolve(x);
 });
 if(new Set(vals).size!==3)
  throw Error('Never overwrite any original official public source file');
 const [lrl,meta,out]=vals;
 const original=bounded(lrl,9000,5*1024*1024);
 const m=JSON.parse(bounded(meta,100,3*1024*1024).toString('utf8')) as {
  source?:{url?:string;observedAt?:string;sourceBytesSha256?:string};
 };
 if(m.source?.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
   ||!m.source.observedAt
   ||m.source.sourceBytesSha256!==createHash('sha256').update(original).digest('hex'))
  throw Error('Official real LRL senator-service source hash and exact observed date required');
 const official=parseOfficialMnSenateServiceDirectory(original,m.source.observedAt);
 const result=await acquireThree2022ActuallyServedCampaignDomains(out,official);
 console.log('ORIGINAL-2022-THREE-SENATOR-SITE-ACQUISITION '+JSON.stringify(result.totals));
}
main().catch(e=>{
 console.error('Historic campaign source not promoted: '+(e instanceof Error?e.message.slice(0,220):'unknown'));
 process.exitCode=1;
});
