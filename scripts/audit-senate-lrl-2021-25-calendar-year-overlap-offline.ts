/**
 * Offline original LRL Senate 2021-25 calendar-year overlap inventory.
 * Uses only the previously obtained SHA-256 verified official directory
 * and special-member Senate swearing source. No network or database.
 */
import {readFileSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {parseOfficialMnSenateServiceDirectory} from
 '../src/evidence/senate-official-ever-served-directory.js';
import {buildActualSenatorOfficialYearOverlapResearch} from
 '../src/evidence/senate-lrl-2021-25-calendar-year-service-window.js';
const flags=[
 '--official-lrl-original','--official-lrl-metadata',
 '--official-lrl-swearing','--output',
] as const;
function bounded(file:string,min:number,max:number){
 const s=statSync(file);
 if(!s.isFile()||s.size<min||s.size>max)
  throw Error('Original official source byte file missing/outside bounds');
 return readFileSync(file);
}
function main(){
 const args=process.argv.slice(2);
 if(args.length!==flags.length*2||flags.some(k=>args.filter(v=>v===k).length!==1))
  throw Error('All original official Senate service and output paths required exactly once');
 const paths=flags.map(k=>{
  const i=args.indexOf(k),p=i<0?undefined:args[i+1];
  if(!p||p.startsWith('--'))throw Error('Original official source missing required path');
  return resolve(p);
 });
 if(new Set(paths).size!==paths.length)
  throw Error('Do not overwrite the original Senate service source records');
 const [file,metaFile,swearFile,out]=paths;
 const original=bounded(file,9000,5*1024*1024);
 const sworn=bounded(swearFile,9000,5*1024*1024);
 const meta=JSON.parse(bounded(metaFile,100,3*1024*1024).toString('utf8')) as {
  source?:{url?:string;observedAt?:string;sourceBytesSha256?:string};
  supplementalSwearingSource?:{observedAt?:string;sourceBytesSha256?:string};
 };
 const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
 if(meta.source?.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
   ||!meta.source.observedAt||!meta.supplementalSwearingSource?.observedAt
   ||meta.source.sourceBytesSha256!==hash(original)
   ||meta.supplementalSwearingSource.sourceBytesSha256!==hash(sworn))
  throw Error('Previously captured original official LRL source hash or date mismatch');
 const parsed=parseOfficialMnSenateServiceDirectory(
  original,meta.source.observedAt,sworn,meta.supplementalSwearingSource.observedAt);
 const report=buildActualSenatorOfficialYearOverlapResearch(parsed);
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log(JSON.stringify({
  originalOfficialDirectoryRows:report.totals.officialServedSenatorDirectoryRowsRead,
  peopleWith2021to25Overlaps:report.totals.distinctOfficialDirectoryPeopleRepresentedDuring2021to25,
  personYearOverlaps:report.totals.observedPersonCalendarYearOverlaps,
  exactSpecialOathEvents:report.totals.exactOriginalSpecialOathEventsAttached,
  perYear:report.byYear.map(x=>({year:x.year,people:x.people.length})),
  dayResolvedCompleteDenominator:false,output:out,
 }));
}
main();
