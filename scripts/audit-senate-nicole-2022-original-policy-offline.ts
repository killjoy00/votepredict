/**
 * Offline evidence-only recheck of TWO authentic 2022 candidate campaign
 * priorities page originals, and original LRL actually-served senator source.
 *
 * Full audited inputs are from public GitHub Actions artifacts #38094976711
 * and #38100551887, not later mutable websites or production databases.
 */
import {createHash} from 'node:crypto';
import {readFileSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {parseOfficialMnSenateServiceDirectory}
 from '../src/evidence/senate-official-ever-served-directory.js';
import {auditNicoleMitchell2022OriginalCampaignQuotes}
 from '../src/evidence/senate-nicole-mitchell-2022-original-issue-proof.js';
const args=process.argv.slice(2);
function opt(k:string){
 const i=args.indexOf(k);
 const val=i<0?undefined:args[i+1];
 return val&&!val.startsWith('--')?val:undefined;
}
function bounded(path:string,min:number,max:number){
 const p=resolve(path),st=statSync(p);
 if(!st.isFile()||st.size<min||st.size>max)
  throw Error('Original public source missing/outside bounds');
 return readFileSync(p);
}
function main(){
 const keys=['--lrl-original','--lrl-metadata','--feb-original','--nov-original','--output'] as const;
 const values=keys.map(opt);
 if(args.length!==10||values.some(x=>!x))
  throw Error('Must supply all five original source/output arguments');
 const [lrlFile,lrlMeta,febFile,novFile,out]=values as string[];
 if(new Set(values.map(path=>resolve(path!))).size!==5)
  throw Error('Never overwrite original LRL or original 2022 source HTML files');
 const source=bounded(lrlFile,9000,5*1024*1024);
 const metadata=JSON.parse(bounded(lrlMeta,100,3*1024*1024).toString('utf8')) as {
  source?:{url?:string;observedAt?:string;sourceBytesSha256?:string};
 };
 if(metadata.source?.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
  ||!metadata.source.observedAt
  ||metadata.source.sourceBytesSha256!==
    createHash('sha256').update(source).digest('hex'))
   throw Error('Original official Senate service source does not match independent SHA and recorded date');
 const official=parseOfficialMnSenateServiceDirectory(source,metadata.source.observedAt);
 const report=auditNicoleMitchell2022OriginalCampaignQuotes(official,{
  'nicole2022-priorities-feb01':bounded(febFile,100,2_500_000),
  'nicole2022-priorities-nov05':bounded(novFile,100,2_500_000),
 });
 const destination=resolve(out);
 mkdirSync(dirname(destination),{recursive:true});
 writeFileSync(destination,JSON.stringify(report,null,2)+'\n',
  {flag:'wx',mode:0o600,encoding:'utf8'});
 console.log(JSON.stringify({
  actualSenator:'Nicole Mitchell',historicalOriginalPageVersions:report.totals.originalDateAttestedCampaignIssuePageVersions,
  historicalShortPolicyExcerpts:report.totals.shortSenatorAuthoredCampaignExcerpts,
  independentOriginalHtmlAndExactQuoteChecks:report.totals.exactQuoteVisibleSpanAndSourceHashCrossChecks,
  earliestPageCapturedUtc:report.datedShortCandidateStatements[0].firstAttestedExactStatementPublicByUtc,
  originalAuthorFirstPostedAt:null,
  nonSenatorQuotes:0,productionWrites:0,forecastEligible:0,
 }));
}
main();
