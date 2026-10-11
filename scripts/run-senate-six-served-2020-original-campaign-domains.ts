/**
 * Original LRL senator service directory and SHA/UTC provenance are mandatory
 * before any 2019/2020 candidate-owned public historical archive requests.
 * Pure public source one-shot research, no database or current-site scraping.
 */
import {readFileSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {parseOfficialMnSenateServiceDirectory} from
 '../src/evidence/senate-official-ever-served-directory.js';
import {acquire2020OriginalCampaignSitesOfSixActualSenators}
 from './acquire-senate-six-served-2020-original-campaign-domains.js';

function bounded(f:string,min:number,max:number){
 const stat=statSync(f);
 if(!stat.isFile()||stat.size<min||stat.size>max)
  throw Error('Original public LRL Senator service source missing or unbounded');
 return readFileSync(f);
}
async function main(){
 const flags=['--original-lrl-senate-html','--original-lrl-receipt','--output-dir'];
 const args=process.argv.slice(2);
 if(args.length!==6||flags.some(f=>args.filter(a=>a===f).length!==1))
  throw Error('Requires original independently acquired LRL Senate service directory, original receipt and exclusive output');
 const [lrl,receipt,out]=flags.map(f=>{
  const i=args.indexOf(f),x=i<0?undefined:args[i+1];
  if(!x||x.startsWith('--'))throw Error('Original government Senate service provenance required');
  return resolve(x);
 });
 if(new Set([lrl,receipt,out]).size!==3)
  throw Error('Never overwrite or reclassify actual original LRL public source files');
 const html=bounded(lrl,9000,5*1024*1024);
 const source=JSON.parse(bounded(receipt,100,3*1024*1024).toString('utf8')) as{
  source?:{url?:string;observedAt?:string;sourceBytesSha256?:string};
 };
 if(source.source?.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
   ||!source.source.observedAt
   ||createHash('sha256').update(html).digest('hex')!==source.source.sourceBytesSha256)
  throw Error('Actual Senate government-service original has wrong SHA-256/UTC provenance');
 const official=parseOfficialMnSenateServiceDirectory(html,source.source.observedAt);
 const manifest=await acquire2020OriginalCampaignSitesOfSixActualSenators(out,official);
 console.log('SIX-ACTUALLY-SERVED-MN-SENATORS-2020-ARCHIVE '+JSON.stringify(manifest.totals));
}
main().catch(e=>{
 console.error('Original 2020 Senate campaign public research failed closed: '+
  (e instanceof Error?e.message.slice(0,240):'unknown'));
 process.exitCode=1;
});
