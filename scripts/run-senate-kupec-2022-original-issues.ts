/**
 * Runs actual public 2022 source GETs only after independently acquired MN LRL
 * Senate-service directory HTML is rehashed and parsed.
 * Require explicit source originals and a new exclusive output directory.
 */
import {createHash} from 'node:crypto';
import {readFileSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {parseOfficialMnSenateServiceDirectory} from '../src/evidence/senate-official-ever-served-directory.js';
import {acquireKupec2022OriginalIssuePages} from './acquire-senate-kupec-2022-original-issues.js';
const args=process.argv.slice(2);
function option(k:string){
 const i=args.indexOf(k);const v=i<0?undefined:args[i+1];
 return v&&!v.startsWith('--')?v:undefined;
}
async function main(){
 const [source,meta,out]=['--lrl-original','--lrl-metadata','--output-dir'].map(option);
 if(args.length!==6||!source||!meta||!out)
  throw Error('Requires exactly LRL original, metadata and exclusive output dir');
 const original=resolve(source),provenance=resolve(meta),destination=resolve(out);
 if(new Set([original,provenance,destination]).size!==3)
  throw Error('Original government source may never be overwritten');
 const raw=statSync(original),info=statSync(provenance);
 if(!raw.isFile()||!info.isFile()||raw.size<9000||raw.size>5*1024*1024
   ||info.size<100||info.size>3*1024*1024)
  throw Error('Missing/oversized original 2026 LRL Senate service directory evidence');
 const html=readFileSync(original),originalHash=createHash('sha256').update(html).digest('hex');
 const manifest=JSON.parse(readFileSync(provenance,'utf8')) as {
  source?:{url?:string;sourceBytesSha256?:string;observedAt?:string};
 };
 if(manifest.source?.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
   ||!manifest.source.observedAt||manifest.source.sourceBytesSha256!==originalHash)
  throw Error('Original observed LRL Senate-service source bytes/date hash mismatch');
 const verified=parseOfficialMnSenateServiceDirectory(html,manifest.source.observedAt);
 if(verified.source.sourceBytesSha256!==originalHash)
  throw Error('Original parsed official Senator directory source mismatch');
 const report=await acquireKupec2022OriginalIssuePages(destination,verified);
 console.log('KUPEC-2022-ISSUES-SUMMARY '+JSON.stringify({
  archivedIssuesSourcePagesDigestAuthenticated:report.stats.independentOriginalIssueHTMLMatchedHistoricalIndex,
  exactOriginalIssuePathIndexRows:report.stats.bounded2022IssueOriginalIndexRows,
  observedAtUtc:report.observedAtUtc,
  personConfirmedActuallyServedMinnesotaSenate:true,
  issueStancesAutomaticallyAdmitted:0,
  databaseOrModelWrites:0,
 }));
}
main().catch(e=>{
 console.error('Senator-only original 2022 issues public acquisition failed closed: '+
  (e instanceof Error?e.message.slice(0,160):'unknown'));
 process.exitCode=1;
});
