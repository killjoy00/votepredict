/**
 * Independent full-source OFFLINE #864 historical candidate campaign text.
 * No fetch, no database, no forecast; fail closed on missing genuine 2020 HTML.
 */
import {readFileSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import ledger from '../data/evaluation/senate-two-more-2021-served-2020-original-campaign-dated-policy-excerpts-v1.json' with {type:'json'};
import {parseOfficialMnSenateServiceDirectory}
 from '../src/evidence/senate-official-ever-served-directory.js';
import {
 auditTwoNew2021ServedSenators2020Original47CampaignPolicyExcerpts,
 type OriginalFive2021ServingSenators2020SourceManifest,
} from '../src/evidence/senate-two-more-2021-serving-2020-campaign-47-original-quote-proof.js';
function bounded(path:string,min:number,max:number){
 const st=statSync(path);
 if(!st.isFile()||st.size<min||st.size>max)
  throw Error('Full original 2020 Senate campaign or original state directory source missing/unbounded');
 return readFileSync(path);
}
function main(){
 const flags=[
  '--whole-original-independent-lrl-senate-directory',
  '--whole-original-lrl-service-utc-sha-receipt',
  '--2020-original-campaign-html-and-cdx-archive-dir',
  '--output',
 ];
 const args=process.argv.slice(2);
 if(args.length!==flags.length*2||flags.some(f=>args.filter(x=>x===f).length!==1))
  throw Error('All four original whole-source LRL/UTC/2020 CDX/HTML/output arguments required');
 const [gov,receipt,archive,out]=flags.map(f=>{
  const n=args.indexOf(f),v=n<0?undefined:args[n+1];
  if(!v||v.startsWith('--'))throw Error('Original independent 2020 candidate evidence missing');
  return resolve(v);
 });
 if(new Set([gov,receipt,archive,out]).size!==4)
  throw Error('Cannot reuse or overwrite the authenticated original sources or output');
 const originalGovernment=bounded(gov,9000,5*1024*1024);
 const meta=JSON.parse(bounded(receipt,100,3*1024*1024).toString('utf8')) as{
  source?:{url?:string;observedAt?:string;sourceBytesSha256?:string};
 };
 const computed=createHash('sha256').update(originalGovernment).digest('hex');
 if(computed!=='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51'
  ||meta.source?.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
  ||meta.source.sourceBytesSha256!==computed||!meta.source.observedAt)
  throw Error('Full genuine Minnesota LRL actual Senate service original or source receipt changed');
 const originalDirectory=parseOfficialMnSenateServiceDirectory(originalGovernment,meta.source.observedAt);
 const acquisition=JSON.parse(bounded(join(archive,'source-acquisition-manifest.json'),
  100,3*1024*1024).toString('utf8')) as OriginalFive2021ServingSenators2020SourceManifest;
 const html:Record<string,Uint8Array>={};
 for(const s of ledger.fullOriginalArchivedPageReceipts){
  if(Object.hasOwn(html,s.originalFile))
   throw Error('Duplicate actual original 2020 archived candidate first-party file');
  html[s.originalFile]=bounded(join(archive,s.originalFile),32,2_500_000);
 }
 const cdx:Record<string,unknown>={};
 for(let i=1;i<=5;i++){
  const f='five20-'+String(i).padStart(2,'0')+'-real-2020-cdx-source.json';
  cdx[f]=JSON.parse(bounded(join(archive,f),2,1_500_000).toString('utf8')) as unknown;
 }
 const report=auditTwoNew2021ServedSenators2020Original47CampaignPolicyExcerpts(
  originalDirectory,acquisition,html,cdx);
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(report,null,2)+'\n',{mode:0o600,flag:'wx'});
 console.log('TWO-2021-SERVED-SENATORS-2020-ORIGINAL-47-CAPTURE-DATED-CAMPAIGN-ISSUE-PROOFS '+JSON.stringify({
  senatorPersons:report.actual2021ServingSenatorPeopleIndependentlyChecked,
  peopleWithSource:report.actual2020FirstPartyCampaignSitePeopleWithFullOriginalHTML,
  quotePeople:report.distinctActuallyServingSenatorsWithExactCandidatePolicyText,
  pagesRehashed:report.fullOriginal2020FirstPartyHTMLBodiesReopenedSHA1AndSHA256,
  originalCDX:report.fullIndependent2020CDXIndexesReopened,
  sections:report.distinctOriginalCandidateIssuePageSections,
  excerpts:report.exactOriginalSiteShortPolicyExcerptsAuthenticated,
  bySenator:report.bySenator,
  productionChanges:report.productionNeonVercelEvidenceModelForecastSchedulerChanges,
 }));
}
if(process.argv[1]?.endsWith('audit-two-2021-serving-senators-2020-original-47-issue-quotes-offline.ts')){
 try{main();}catch(e){
  console.error('Original 2020 full Senate archived candidate HTML/CDX/government exact quote proof rejected: '+
    (e instanceof Error?e.message:'unknown').slice(0,500));process.exitCode=1;
 }
}
