/**
 * #864 independently authenticate EXACT 12 first-party original 2016 candidate
 * policy excerpts for actual 2021-serving Minnesota Senator Justin Eichorn.
 * Reopen government original LRL/UTC/SHA, genuine 2020 home JS-shell, all FOUR
 * true 2016/2018 issues HTML bodies and EIGHT original CDX source JSON files.
 * NO internet, private DB, model/forecast/scheduler or evidence writes.
 */
import {readFileSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,dirname,resolve} from 'node:path';
import ledger from '../../data/evaluation/senate-justin-eichorn-2016-original-12-capture-dated-exact-issues-v1.json' with {type:'json'};
import {parseOfficialMnSenateServiceDirectory}
 from '../../src/evidence/senate-official-ever-served-directory.js';
import {
 independentlyAuditJustinEichorn12ExactOriginal2016CampaignIssueStatements,
 type EichornOriginalIssuesSourceManifest,
} from '../evidence/senate-justin-eichorn-2016-original-12-quote-proof.js';
const GOV='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
function bounded(path:string,min:number,max:number){
 const v=statSync(path);
 if(!v.isFile()||v.size<min||v.size>max)
  throw Error('Full original actual senator-service/public first-party historical campaign file is missing or unbounded');
 return readFileSync(path);
}
function main(){
 const keys=[
  '--entire-original-actual-mn-senate-service-html',
  '--independent-original-lrl-government-utc-sha-receipt',
  '--original-may-2020-first-party-eichorn-home-html',
  '--four-original-2016-2018-issue-html-and-eight-cdx-dir',
  '--output',
 ];
 const args=process.argv.slice(2);
 if(args.length!==keys.length*2||keys.some(k=>args.filter(x=>x===k).length!==1))
  throw Error('All five original public government/site/CDX/output arguments required');
 const [gov,receipt,home,dir,out]=keys.map(k=>{
  const i=args.indexOf(k),p=i<0?undefined:args[i+1];
  if(!p||p.startsWith('--'))throw Error('Missing complete independent historical source');
  return resolve(p);
 });
 if(new Set([gov,receipt,home,dir,out]).size!==5)
  throw Error('Cannot confuse or overwrite original government and campaign source files with output');
 const bytes=bounded(gov,9000,5*1024*1024);
 const source=JSON.parse(bounded(receipt,100,3*1024*1024).toString('utf8')) as{
  source?:{url?:string;observedAt?:string;sourceBytesSha256?:string};
 };
 const sha=createHash('sha256').update(bytes).digest('hex');
 if(sha!==GOV||source.source?.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
  ||source.source.sourceBytesSha256!==GOV||!source.source.observedAt)
  throw Error('Whole original complete Minnesota Senate service government SHA/UTC source untrusted');
 const official=parseOfficialMnSenateServiceDirectory(bytes,source.source.observedAt);
 const originalHome=bounded(home,1000,2_500_000);
 const manifest=JSON.parse(bounded(join(dir,'source-acquisition-manifest.json'),100,3*1024*1024).toString('utf8')) as EichornOriginalIssuesSourceManifest;
 const pages:Record<string,Uint8Array>={};
 for(const rec of ledger.originalFullPageReceipts){
  if(Object.hasOwn(pages,rec.file))throw Error('Duplicate full original candidate HTML capture');
  pages[rec.file]=bounded(join(dir,rec.file),32,2_500_000);
 }
 const indexes:Record<string,unknown>={};
 for(let i=1;i<=8;i++){
  const f='eichornissue-index-'+String(i).padStart(2,'0')+'-original-cdx-2016-2020.json';
  indexes[f]=JSON.parse(bounded(join(dir,f),2,1_500_000).toString('utf8')) as unknown;
 }
 const proof=independentlyAuditJustinEichorn12ExactOriginal2016CampaignIssueStatements(
  official,manifest,originalHome,pages,indexes);
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(proof,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log('JUSTIN-EICHORN-2016-ORIGINAL-12-EXACT-CANDIDATE-POLICY-QUOTES '+JSON.stringify({
  actualServingSenators:proof.actual2021ServingSenatorsCoveredByNewQuotes,
  wholeOriginalHTMLRehashed:proof.wholeOriginalHistoricalFirstPartyIssuesHTMLRehashed,
  independentCDXReopened:proof.wholeIndependentOriginalWaybackCDXSourcesReopened,
  actual2016PolicyExcerpts:proof.exact2016ArchivedCandidateShortExcerptsProven,
  byIssue:proof.byIssue,
  productionChanges:proof.productionDatabaseEvidenceModelForecastSchedulerChanges,
 }));
}
if(process.argv[1]?.endsWith('audit-justin-eichorn-2016-original-12-issue-quotations-offline.ts')){
 try{main();}catch(e){
  console.error('Entire original 2016 Eichorn candidate issue policy HTML/CDX/Senate-service provenance rejected: '+
   (e instanceof Error?e.message:'unknown').slice(0,550));
  process.exitCode=1;
 }
}
