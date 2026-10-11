/**
 * Offline #864 complete original public Senate government+2020 campaign
 * HTML source recheck for 41 dated original candidate website policy texts.
 * No live web, no DB, forecast, model or evidence updates.
 */
import {createHash} from 'node:crypto';
import {readFileSync,statSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import source from '../data/evaluation/senate-two-2021-served-2020-original-campaign-eight-html-source-receipts-v1.json' with {type:'json'};
import {parseOfficialMnSenateServiceDirectory}
 from '../src/evidence/senate-official-ever-served-directory.js';
import {
 auditTwoActual2021Senators41SourceIssuesFrom2020OriginalHTML,
 type Three2021SenatorsActual2020OriginalArchive,
} from '../src/evidence/senate-two-2021-serving-2020-41-original-capture-dated-policy-proof.js';
function bounded(f:string,min:number,max:number){
 const stat=statSync(f);
 if(!stat.isFile()||stat.size<min||stat.size>max)
  throw Error('Original government or candidate archived full HTML source missing/unsafe');
 return readFileSync(f);
}
function main(){
 const flags=['--entire-original-lrl-senator-directory','--entire-original-lrl-source-receipt',
  '--actual-2020-original-candidate-archive-dir','--output'];
 const args=process.argv.slice(2);
 if(args.length!==8||flags.some(f=>args.filter(x=>x===f).length!==1))
  throw Error('Require exact original public Senate directory, source receipt, original 2020 site archive and new output');
 const [govPath,receiptPath,sourceDir,output]=flags.map(flag=>{
  const i=args.indexOf(flag),v=i<0?undefined:args[i+1];
  if(!v||v.startsWith('--'))throw Error('Original source evidence must be specified');
  return resolve(v);
 });
 if(new Set([govPath,receiptPath,sourceDir,output]).size!==4)
  throw Error('Cannot conflate or overwrite public original source');
 const governmentHtml=bounded(govPath,9000,5*1024*1024);
 const meta=JSON.parse(bounded(receiptPath,100,3*1024*1024).toString('utf8')) as{
  source?:{url?:string;observedAt?:string;sourceBytesSha256?:string};
 };
 const actualSha=createHash('sha256').update(governmentHtml).digest('hex');
 if(actualSha!=='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51'
  ||meta.source?.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
  ||meta.source.sourceBytesSha256!==actualSha
  ||!meta.source.observedAt)
  throw Error('Authentic State Senate original official LRL actual service membership SHA/UTC source receipt not verified');
 const directory=parseOfficialMnSenateServiceDirectory(governmentHtml,meta.source.observedAt);
 const acquisition=JSON.parse(bounded(join(sourceDir,'source-acquisition-manifest.json'),
  100,4*1024*1024).toString('utf8')) as Three2021SenatorsActual2020OriginalArchive;
 const originals:Record<string,Uint8Array>={};
 for(const p of source.originalFirstPartyWebPages){
  if(Object.hasOwn(originals,p.originalSourceFile))
   throw Error('Duplicate original 2020 candidate webpage source receipt');
  originals[p.originalSourceFile]=bounded(join(sourceDir,p.originalSourceFile),32,2_500_000);
 }
 const outputData=auditTwoActual2021Senators41SourceIssuesFrom2020OriginalHTML(
  directory,acquisition,originals);
 mkdirSync(dirname(output),{recursive:true});
 writeFileSync(output,JSON.stringify(outputData,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log('TWO-2021-SERVING-SENATORS-2020-ORIGINAL-41-ISSUE-PROOFS '+
  JSON.stringify({
   peopleWhoActuallyServedSenate2021:outputData.actual2021ServingSenatorPeopleWithOriginalSitePages,
   rehashedOriginal2020FullHTMLBodies:outputData.authentic2020SourceOriginalHTMLCopiesReopenedAndSHA1Proven,
   policyPages:outputData.historicCandidateOwned2020IssueSectionsIndependentlyChecked,
   exactlyDatedOriginalCampaignPolicyExcerpts:outputData.exactReal2020CampaignIssueExcerptsVerified,
   bySenator:outputData.byServingSenator,
   firstAuthorTimeNeeded:outputData.firstAuthoredOriginalPostingDateRequired,
   productionDatabaseForecastChanges:outputData.productionDatabaseReadsWritesOrHistoricalForecastAdmission,
  }));
}
if(process.argv[1]?.endsWith('audit-two-actually-served-2021-senators-41-original-2020-issue-excerpts-offline.ts')){
 try{main();}catch(e){
  console.error('2020 authentic first-party Senate candidate issue source original bytes/date or quote rejected: '+
    (e instanceof Error?e.message:'unknown').slice(0,500));
  process.exitCode=1;
 }
}
