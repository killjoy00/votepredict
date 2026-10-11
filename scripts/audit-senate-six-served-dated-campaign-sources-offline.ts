/**
 * #864 unified date-specific campaign issue evidence for only six independently
 * actual Minnesota Senators: original public LRL Senate directory+special
 * swearing sources, two ORIGINAL Carla 2022 Wayback HTML pages required.
 *
 * This is OFFLINE and no-network; no database reads or source admission.
 */
import {readFileSync,statSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {parseOfficialMnSenateServiceDirectory} from
 '../src/evidence/senate-official-ever-served-directory.js';
import {combineOnlyActualSenatorsDated2022to2025CampaignSources} from
 '../src/evidence/senate-six-served-person-dated-campaign-coverage.js';
const args=process.argv.slice(2);
const flag=(n:string)=>{
 const i=args.indexOf(n);
 const value=i>=0?args[i+1]:undefined;
 return value&&!value.startsWith('--')?value:undefined;
};
function boundedFile(path:string,min:number,max:number){
 const s=statSync(path);
 if(!s.isFile()||s.size<min||s.size>max)
  throw Error('Original independently acquired public source file missing or outside cap');
 return readFileSync(path);
}
function main(){
 const raw=flag('--official-lrl-original'),
  meta=flag('--official-lrl-metadata'),
  swearing=flag('--official-lrl-swearing'),
  carlaA=flag('--carla-2022-original-a'),
  carlaB=flag('--carla-2022-original-b'),
  out=flag('--output');
 if(!raw||!meta||!swearing||!carlaA||!carlaB||!out||args.length!==12)
  throw Error('Require exactly six original service/campaign/output flags');
 const files=[raw,meta,swearing,carlaA,carlaB,out].map(value=>resolve(value));
 if(new Set(files).size!==files.length)
  throw Error('Refusing to overwrite or substitute original date/public-source files');
 const dir=boundedFile(files[0],9000,5*1024*1024);
 const metadata=JSON.parse(boundedFile(files[1],100,3*1024*1024).toString('utf8')) as {
  source?:{url?:string;observedAt?:string;sourceBytesSha256?:string};
  supplementalSwearingSource?:{observedAt?:string;sourceBytesSha256?:string};
 };
 const swearingOriginal=boundedFile(files[2],9000,5*1024*1024);
 if(metadata.source?.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
  ||!metadata.source.observedAt||!metadata.source.sourceBytesSha256
  ||metadata.source.sourceBytesSha256!==createHash('sha256').update(dir).digest('hex')
  ||!metadata.supplementalSwearingSource?.observedAt
  ||metadata.supplementalSwearingSource.sourceBytesSha256!==
    createHash('sha256').update(swearingOriginal).digest('hex'))
  throw Error('Official dated LRL senator source/sworn special original SHA-256 missing or mismatched');
 const official=parseOfficialMnSenateServiceDirectory(
  dir,metadata.source.observedAt,
  swearingOriginal,metadata.supplementalSwearingSource.observedAt);
 const sourceOriginals={
  'carla-2022-page-a':boundedFile(files[3],9000,2*1024*1024),
  'carla-2022-page-b':boundedFile(files[4],9000,2*1024*1024),
 };
 const output=combineOnlyActualSenatorsDated2022to2025CampaignSources(
  official,sourceOriginals);
 mkdirSync(dirname(files[5]),{recursive:true});
 writeFileSync(files[5],JSON.stringify(output,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log(JSON.stringify({
  namedActualSenators:output.totals.everServedSenatorsNamed,
  datedIssues:output.totals.shortIssueExcerptLeads,
  genuine2022OriginalHistoricalPlatformIssues:
    output.totals.unique2022CarlaOriginalHistoricalCampaignIssueExcerpts,
  historic2024to2025Issues:output.totals.historical2024to2025OriginalCampaignIssueExcerpts,
  merely2026AcquiredPublisherQuotes:
    output.totals.modernPublisherOnlyQuoteExcerptsUnverifiedBefore2026,
  nonSenatorsNamed:0,
  historicalProductionEvidenceAdmitted:0,
  output:files[5],
 }));
}
main();
