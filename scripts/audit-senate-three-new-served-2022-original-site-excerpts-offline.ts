/**
 * Source-only exact original archived 2022 HTML + original official Senate
 * service proof for Judy, Steve and Bonnie (legacy campaign copy flagged).
 * No runtime site or database network operations.
 */
import {readFileSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {parseOfficialMnSenateServiceDirectory} from
 '../src/evidence/senate-official-ever-served-directory.js';
import {auditThreeMoreActuallyServedSenator2022OriginalIssueExcerpts}
 from '../src/evidence/senate-three-new-served-2022-original-campaign-issue-proof.js';
const keys=[
 '--official-lrl-original','--official-lrl-metadata','--official-special-swearing',
 '--archive-acquisition-manifest','--judy-2022-priorities-original',
 '--bonnie-2022-legacy-issues-original','--steve-2022-vision-original','--output',
] as const;
function bounded(path:string,min:number,max:number){
 const x=statSync(path);
 if(!x.isFile()||x.size<min||x.size>max)
  throw Error('Original government or candidate campaign source missing/outside hard byte bounds');
 return readFileSync(path);
}
function main(){
 const argv=process.argv.slice(2);
 if(argv.length!==keys.length*2||keys.some(k=>argv.filter(a=>a===k).length!==1))
  throw Error('Require exactly eight distinct official/original/manifest/output file options');
 const args=keys.map(k=>{
  const i=argv.indexOf(k),v=i<0?undefined:argv[i+1];
  if(!v||v.startsWith('--'))throw Error('All original source files required');
  return resolve(v);
 });
 if(new Set(args).size!==args.length)
  throw Error('Do not substitute original official source files or overwrite originals');
 const [lrl,meta,swearing,sourceManifest,judy,bonnie,steve,out]=args;
 const gov=bounded(lrl,9000,5*1024*1024);
 const oath=bounded(swearing,9000,5*1024*1024);
 const m=JSON.parse(bounded(meta,100,3*1024*1024).toString('utf8')) as{
  source?:{url?:string;observedAt?:string;sourceBytesSha256?:string};
  supplementalSwearingSource?:{observedAt?:string;sourceBytesSha256?:string};
 };
 const hash=(x:Uint8Array)=>createHash('sha256').update(x).digest('hex');
 if(m.source?.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
   ||!m.source.observedAt||!m.supplementalSwearingSource?.observedAt
   ||m.source.sourceBytesSha256!==hash(gov)
   ||m.supplementalSwearingSource.sourceBytesSha256!==hash(oath))
  throw Error('Original official source directory and special member oath originals lack matching true hash/date proof');
 const official=parseOfficialMnSenateServiceDirectory(
  gov,m.source.observedAt,oath,m.supplementalSwearingSource.observedAt);
 const originalManifest=JSON.parse(bounded(sourceManifest,100,3*1024*1024).toString('utf8'));
 const report=auditThreeMoreActuallyServedSenator2022OriginalIssueExcerpts(
  official,{acquisition:originalManifest,originalHtml:{
   judy22:bounded(judy,100,2_500_000),
   bonnie22:bounded(bonnie,100,2_500_000),
   steve22:bounded(steve,100,2_500_000),
  }});
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log(JSON.stringify({
  newlyVerifiedSenatePersons:report.totals.additionalIndependentlyVerifiedActualSenatePeople,
  original2022HistoricIssuePageVersions:report.totals.authenticOriginal2022IssuePagesIndependentlyReopened,
  exactIssueExcerptsByteRechecked:report.totals.candidateSourceTextStatementsRechecked,
  original2022CycleCandidatePositions:report.totals.sourcePolicyStatementsFromContemporaneous2022ElectionPages,
  2022ArchivedPriorCycleLegacyCampaignExcerpts:report.totals.sourcePolicyStatementsFromPriorDistrictCampaignCopyOnlyObservedIn2022,
  combinedLongitudinalCampaignResearchExcerptLeads:report.totals.combinedHistoricallyDateAttestedPlusPublisherResearchLeads,
  priorCampaignCycleNeverMislabelledAsNew2022Stance:true,
  forecastOrProductionRecordsInserted:0,
  output:out,
 }));
}
main();
