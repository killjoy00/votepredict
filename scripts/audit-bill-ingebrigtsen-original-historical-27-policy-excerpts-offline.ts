/**
 * Independent #864 OFFLINE original-byte Bill Ingebrigtsen actual historical
 * candidate policy audit: FULL original government service/UTC SHA, complete
 * original August 2020 candidate homepage, SIX whole 2010–2016 issues.php
 * archived HTML and FOUR complete independent Wayback index JSON sources.
 * History source-only: never infer new 2020 issue text or recorded votes.
 */
import {readFileSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import ledger from '../data/evaluation/senate-bill-ingebrigtsen-27-exact-historical-first-party-issues-2010-2012-v1.json' with {type:'json'};
import {parseOfficialMnSenateServiceDirectory}
 from '../src/evidence/senate-official-ever-served-directory.js';
import {
 independentlyAuditBillIngebrigtsen27OriginalHistoricalPolicyExcerpts,
 type BillArchivedIssuePageSourceManifest,
} from '../src/evidence/senate-bill-ingebrigtsen-historic-27-original-site-excerpts-proof.js';
const GOV_SHA='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
function whole(path:string,min:number,max:number){
 const s=statSync(path);
 if(!s.isFile()||s.size<min||s.size>max)
  throw Error('Missing or incomplete original 2010–2016 Senate site/government independent public source');
 return readFileSync(path);
}
function main(){
 const keys=[
  '--original-entire-government-senate-service-html',
  '--original-government-source-utc-sha-receipt',
  '--original-2020-candidate-homepage',
  '--original-historical-issues-site-html-cdx-dir',
  '--output',
 ];
 const args=process.argv.slice(2);
 if(args.length!==keys.length*2||keys.some(k=>args.filter(x=>x===k).length!==1))
  throw Error('Entire independent government/site/2020 source and output paths required');
 const [gov,receipt,home,dir,out]=keys.map(k=>{
  const i=args.indexOf(k),v=i<0?undefined:args[i+1];
  if(!v||v.startsWith('--'))throw Error('Original public source prerequisite absent');
  return resolve(v);
 });
 if(new Set([gov,receipt,home,dir,out]).size!==5)
  throw Error('Untrusted conflated original government, campaign, archive or output path');
 const bytes=whole(gov,9000,5*1024*1024);
 const meta=JSON.parse(whole(receipt,100,3*1024*1024).toString('utf8')) as{
  source?:{url?:string;sourceBytesSha256?:string;observedAt?:string};
 };
 if(meta.source?.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
  ||!meta.source.observedAt
  ||meta.source.sourceBytesSha256!==GOV_SHA
  ||createHash('sha256').update(bytes).digest('hex')!==GOV_SHA)
  throw Error('Independent original whole Minnesota serving-Senators government bytes and original receipt differ');
 const government=parseOfficialMnSenateServiceDirectory(bytes,meta.source.observedAt);
 const original2020Home=whole(home,1000,2_500_000);
 const rawManifest=JSON.parse(whole(join(dir,'source-acquisition-manifest.json'),100,3*1024*1024).toString('utf8')) as BillArchivedIssuePageSourceManifest;
 const originalPages:Record<string,Uint8Array>={};
 for(const page of ledger.originalFullHTMLReceipts){
  if(Object.hasOwn(originalPages,page.file))throw Error('Duplicate historical first-party original HTML receipt');
  originalPages[page.file]=whole(join(dir,page.file),32,2_500_000);
 }
 const originalIndexes:Record<string,unknown>={};
 for(let i=1;i<=4;i++){
  const f='billissue-index-'+String(i).padStart(2,'0')+'-original-cdx-2010-2020.json';
  originalIndexes[f]=JSON.parse(whole(join(dir,f),2,1_500_000).toString('utf8')) as unknown;
 }
 const proof=independentlyAuditBillIngebrigtsen27OriginalHistoricalPolicyExcerpts(
  government,rawManifest,original2020Home,originalPages,originalIndexes);
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(proof,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log('BILL-INGEBRIGTSEN-27-HISTORIC-FIRST-PARTY-EXACT-POLICY-QUOTE-PROOFS '+JSON.stringify({
  servedSenators:proof.realActual2021ServingSenatorsWithNewStatementCoverage,
  historicalBodies:proof.originalFirstPartyIssuePageBodiesIndependentlyRehashed,
  indexFiles:proof.originalIndependentIndexedCDXSourcesVerified,
  distinctOriginalIssueTextVersions:proof.distinctCandidateTextVersions,
  exactIssueQuotations:proof.originalExactShortPolicyExcerptsAuthenticated,
  byHistoricalCycle:proof.byHistoricalSourceCycle,
  productionChanges:proof.productionEvidenceDatabaseModelForecastSchedulerChanges,
 }));
}
if(process.argv[1]?.endsWith('audit-bill-ingebrigtsen-original-historical-27-policy-excerpts-offline.ts')){
 try{main();}catch(e){
  console.error('Complete government/campaign original 2010-2016 issues HTML/CDX 27 exact source-quote audit rejected: '+
   (e instanceof Error?e.message:'unknown').slice(0,550));
  process.exitCode=1;
 }
}
