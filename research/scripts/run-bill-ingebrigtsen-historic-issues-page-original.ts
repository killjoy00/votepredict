/** Source-only #864 probe. Verify FULL original LRL directory and authentic
 * 2020 first-party Ingebrigtsen homepage BEFORE any older archive query. */
import {readFileSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {parseOfficialMnSenateServiceDirectory}
 from '../../src/evidence/senate-official-ever-served-directory.js';
import {recoverBillIngebrigtsenHistoricExactIssuesPage}
 from './acquire-bill-ingebrigtsen-historic-issues-page-original.js';
function entire(p:string,min:number,max:number){
 const st=statSync(p);
 if(!st.isFile()||st.size<min||st.size>max)
  throw Error('Original full LRL/candidate government source missing or invalid');
 return readFileSync(p);
}
async function main(){
 const args=process.argv.slice(2);
 const switches=[
  '--original-complete-mn-lrl-senate-html',
  '--original-mn-lrl-utc-sha-receipt',
  '--original-2020-first-party-bill-home',
  '--output-original-source-dir',
 ];
 if(args.length!==8||switches.some(k=>args.filter(x=>x===k).length!==1))
  throw Error('Four complete source/evidence paths required');
 const [gov,receipt,home,out]=switches.map(k=>{
  const i=args.indexOf(k),v=i<0?undefined:args[i+1];
  if(!v||v.startsWith('--'))throw Error('Missing entire original source path');
  return resolve(v);
 });
 if(new Set([gov,receipt,home,out]).size!==4)
  throw Error('Original inputs cannot be conflated with mutable output');
 const b=entire(gov,9000,5*1024*1024);
 const m=JSON.parse(entire(receipt,100,3*1024*1024).toString('utf8')) as{
  source?:{url?:string;observedAt?:string;sourceBytesSha256?:string};
 };
 if(m.source?.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
  ||!m.source.observedAt
  ||m.source.sourceBytesSha256!=='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51'
  ||m.source.sourceBytesSha256!==createHash('sha256').update(b).digest('hex'))
  throw Error('Official Minnesota LRL original whole government directory SHA/UTC receipt invalid');
 const official=parseOfficialMnSenateServiceDirectory(b,m.source.observedAt);
 const originalHome=entire(home,1000,2_500_000);
 const result=await recoverBillIngebrigtsenHistoricExactIssuesPage(out,official,originalHome);
 console.log('BILL-FIRST-PARTY-ISSUES-ORIGINAL-SOURCE-SUMMARY '+JSON.stringify({
  indexes:result.totalIndexQueries,
  parsed:result.totalIndexesSuccessfullyParsed,
  originalIssuesHTML:result.authenticatedFirstPartyIssuesPageBodies,
  sourceOnlyPolicyExcerpts:result.sourceOnlyNoIssuePositionCountAutomaticallyAdmitted,
  productionChanges:result.productionDatabaseEvidenceForecastModelSchedulerChanges,
 }));
}
main().catch(e=>{
 console.error('Historical original first-party issue site source proof denied: '+
  (e instanceof Error?e.message:'unknown').slice(0,400));
 process.exitCode=1;
});
