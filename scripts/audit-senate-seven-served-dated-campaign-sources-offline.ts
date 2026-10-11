/**
 * #864 - bounded OFFLINE seven-served-Senator original-source audit.
 * No public-network calls, no Neon/Vercel, no forecast or training mutations.
 * All seven actual archived campaign source bodies must be supplied as bytes.
 */
import {readFileSync,statSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {parseOfficialMnSenateServiceDirectory} from
 '../src/evidence/senate-official-ever-served-directory.js';
import {combineSevenActuallyServedDatedCampaignIssueSources} from
 '../src/evidence/senate-seven-served-person-dated-campaign-coverage.js';

const keys=[
 '--official-lrl-original','--official-lrl-metadata',
 '--official-lrl-swearing','--carla-2022-original-a',
 '--carla-2022-original-b','--nicole-2022-feb-original',
 '--nicole-2022-nov-original','--archive-2024-ann-original',
 '--archive-2025-keri-original','--archive-2025-holmstrom-original',
 '--output',
] as const;
function bounded(path:string,min:number,max:number):Buffer{
 const file=statSync(path);
 if(!file.isFile()||file.size<min||file.size>max)
  throw Error('Original date-stamped source missing or outside bounded size');
 return readFileSync(path);
}
function main(){
 const args=process.argv.slice(2);
 const values=keys.map(key=>{
  const i=args.indexOf(key),value=i<0?undefined:args[i+1];
  return value&&!value.startsWith('--')?resolve(value):undefined;
 });
 if(args.length!==keys.length*2||values.some(x=>!x)
    ||keys.some(key=>args.filter(a=>a===key).length!==1))
  throw Error('Require each official directory, original campaign and output path exactly once');
 const files=values as string[];
 if(new Set(files).size!==files.length)
  throw Error('Refuse duplicate input or destination original-source paths');
 const officialHtml=bounded(files[0],9000,5*1024*1024);
 const meta=JSON.parse(bounded(files[1],100,3*1024*1024).toString('utf8')) as {
  source?:{url?:string;observedAt?:string;sourceBytesSha256?:string};
  supplementalSwearingSource?:{observedAt?:string;sourceBytesSha256?:string};
 };
 const swearing=bounded(files[2],9000,5*1024*1024);
 if(meta.source?.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
    ||!meta.source.observedAt||!meta.supplementalSwearingSource?.observedAt
    ||meta.source.sourceBytesSha256!==createHash('sha256').update(officialHtml).digest('hex')
    ||meta.supplementalSwearingSource.sourceBytesSha256!==
      createHash('sha256').update(swearing).digest('hex'))
  throw Error('Official original LRL and special sworn Senate service source/date SHA-256 mismatch');
 const official=parseOfficialMnSenateServiceDirectory(
  officialHtml,meta.source.observedAt,swearing,
  meta.supplementalSwearingSource.observedAt);
 const report=combineSevenActuallyServedDatedCampaignIssueSources(official,{
  carla:{
   'carla-2022-page-a':bounded(files[3],9000,2*1024*1024),
   'carla-2022-page-b':bounded(files[4],9000,2*1024*1024),
  },
  nicole:{
   'nicole2022-priorities-feb01':bounded(files[5],100,2_500_000),
   'nicole2022-priorities-nov05':bounded(files[6],100,2_500_000),
  },
  archived2024to25:{
   'snapshot-01':bounded(files[7],100,3_000_000),
   'snapshot-05':bounded(files[8],100,3_000_000),
   'snapshot-09':bounded(files[9],100,3_000_000),
  },
 });
 const destination=files[10];
 mkdirSync(dirname(destination),{recursive:true});
 writeFileSync(destination,JSON.stringify(report,null,2)+'\n',
  {flag:'wx',mode:0o600,encoding:'utf8'});
 console.log(JSON.stringify({
  namedVerifiedSenators:report.totals.actualSenators,
  datedShortIssueExcerpts:report.totals.shortAttributedIssueStatements,
  independentlyArchivedOriginalIssueExcerpts:report.totals.authenticatedHistoricalCampaignExcerpts,
  publisherResponseExcerpts2026Only:report.totals.observed2026OnlyPublisherQuestionnaireExcerpts,
  originalArchivedPageVersionsReopened:report.totals.originalHistoricalCampaignHtmlVersionsRechecked,
  exactOriginalHtmlSpanAndDigestChecks:report.totals.originalHtmlExactVisibleQuoteSpanChecks,
  noNonSenatorsOrProductionEvidenceRows:true,
  output:destination,
 }));
}
main();
