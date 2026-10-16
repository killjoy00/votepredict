/**
 * #864 one-shot original 2016–2020 candidate-owned /issues archive recovery.
 * Reopen original COMPLETE MN LRL government source and independently original
 * 2020 Justin Eichorn campaign homepage full HTML before any Wayback query.
 */
import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {parseOfficialMnSenateServiceDirectory}
 from '../../src/evidence/senate-official-ever-served-directory.js';
import {acquireAuthenticEichornHistoricalOriginalIssuesPages}
 from './acquire-justin-eichorn-2016-2020-first-party-issues-originals.js';
function bytes(path:string,min:number,max:number){
 const s=statSync(path);
 if(!s.isFile()||s.size<min||s.size>max)
  throw Error('Whole original government/first-party historical site is missing or unbounded');
 return readFileSync(path);
}
async function main(){
 const args=process.argv.slice(2);
 const fields=[
  '--whole-original-lrl-actual-senate-service-html',
  '--original-lrl-service-utc-sha-receipt',
  '--original-2020-first-party-eichorn-home-html',
  '--output-dir',
 ];
 if(args.length!==8||fields.some(f=>args.filter(a=>a===f).length!==1))
  throw Error('All complete original government, 2020 site, independent UTC SHA and output paths required');
 const [gov,receipt,home,output]=fields.map(f=>{
  const i=args.indexOf(f),arg=i<0?undefined:args[i+1];
  if(!arg||arg.startsWith('--'))throw Error('Original historical source argument absent');
  return resolve(arg);
 });
 if(new Set([gov,receipt,home,output]).size!==4)
  throw Error('Do not conflate or overwrite complete independent original sources');
 const body=bytes(gov,9000,5*1024*1024);
 const meta=JSON.parse(bytes(receipt,100,3*1024*1024).toString('utf8')) as{
  source?:{url?:string;observedAt?:string;sourceBytesSha256?:string};
 };
 const sha=createHash('sha256').update(body).digest('hex');
 if(sha!=='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51'
  ||meta.source?.sourceBytesSha256!==sha||!meta.source.observedAt
  ||meta.source.url!=='https://www.lrl.mn.gov/legdb/senate_dir')
  throw Error('Original entire actual Senate-served LRL government HTML SHA+UTC invalid');
 const source=parseOfficialMnSenateServiceDirectory(body,meta.source.observedAt);
 const original2020Home=bytes(home,1000,2_500_000);
 const report=await acquireAuthenticEichornHistoricalOriginalIssuesPages(
  output,source,original2020Home);
 console.log('EICHORN-ORIGINAL-FIRST-PARTY-ISSUE-PAGE-SOURCE-RECEIPTS '+JSON.stringify({
  actualServingSenator:report.actualSenatorIndependentlyVerified,
  indexes:report.originalArchiveCDXSourceQueries,
  parsedIndexes:report.independentlyParsedIndexCount,
  replays:report.selectedWholeOriginalHTMLReplays,
  genuinelyIndexedHTML:report.fullOriginalHTMLBodiesVerifiedAgainstIndependentCDXSHA1,
  quoteCountAdmitted:report.selectedOriginalPolicyExcerpts,
  productionChanges:report.productionDatabaseEvidenceModelForecastSchedulerChanges,
 }));
}
main().catch(e=>{
 console.error('Refused unproven actual 2021 Senate service/original 2020 candidate home/2016-2020 first-party archived issues: '+(e instanceof Error?e.message:'unknown').slice(0,550));
 process.exitCode=1;
});
