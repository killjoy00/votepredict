/**
 * #864 C -- OFFLINE original HTML source-only campaign statement expansion.
 * Input files come only from public previously acquired GitHub Actions
 * artifacts; no source site, production DB, Vercel, model or network reads.
 * Requires all NINE real original archived campaign HTML versions.
 */
import {createHash} from 'node:crypto';
import {readFileSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {parseOfficialMnSenateServiceDirectory} from
 '../src/evidence/senate-official-ever-served-directory.js';
import {deepenActualSenatorHistoricalCampaignStatementLedger} from
 '../src/evidence/senate-served-2022-25-original-campaign-statement-expansion.js';

const opts=[
 '--official-lrl-original','--official-lrl-metadata','--official-lrl-swearing',
 '--carla-2022-original-a','--carla-2022-original-b',
 '--nicole-2022-feb-original','--nicole-2022-nov-original',
 '--ann-2024-sep-original','--ann-2024-oct-original','--ann-2024-nov-original',
 '--keri-2025-original','--holmstrom-2025-original','--output',
] as const;
function bounded(path:string,min:number,max:number){
 const st=statSync(path);
 if(!st.isFile()||st.size<min||st.size>max)
  throw Error('Missing/unbounded original public senator campaign or service source');
 return readFileSync(path);
}
function main(){
 const args=process.argv.slice(2);
 if(args.length!==opts.length*2||opts.some(k=>args.filter(a=>a===k).length!==1))
  throw Error('Thirteen unique, full source-file/output options required for deeper original campaign audit');
 const vals=opts.map(k=>{
  const i=args.indexOf(k),x=i<0?undefined:args[i+1];
  if(!x||x.startsWith('--'))throw Error('All original campaign source files are required');
  return resolve(x);
 });
 if(new Set(vals).size!==vals.length)
  throw Error('Duplicate original campaign/service inputs or output path refused');
 const [lrl,meta,sworn,ca,cb,nf,nn,annSep,annOct,annNov,keri,holm,out]=vals;
 const lrlBody=bounded(lrl,9000,5*1024*1024);
 const swornBody=bounded(sworn,9000,5*1024*1024);
 const manifest=JSON.parse(bounded(meta,100,3*1024*1024).toString('utf8')) as {
  source?:{url?:string;observedAt?:string;sourceBytesSha256?:string};
  supplementalSwearingSource?:{observedAt?:string;sourceBytesSha256?:string};
 };
 const sha=(x:Uint8Array)=>createHash('sha256').update(x).digest('hex');
 if(manifest.source?.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
   ||!manifest.source.observedAt||!manifest.supplementalSwearingSource?.observedAt
   ||manifest.source.sourceBytesSha256!==sha(lrlBody)
   ||manifest.supplementalSwearingSource.sourceBytesSha256!==sha(swornBody))
  throw Error('Original LRL Senate-service directory or special oath SHA/date invalid');
 const official=parseOfficialMnSenateServiceDirectory(
  lrlBody,manifest.source.observedAt,swornBody,
  manifest.supplementalSwearingSource.observedAt);
 const report=deepenActualSenatorHistoricalCampaignStatementLedger(official,{
  carla:{
   'carla-2022-page-a':bounded(ca,100,2*1024*1024),
   'carla-2022-page-b':bounded(cb,100,2*1024*1024),
  },
  nicole:{
   'nicole2022-priorities-feb01':bounded(nf,100,2_500_000),
   'nicole2022-priorities-nov05':bounded(nn,100,2_500_000),
  },
  archived2024to25:{
   'snapshot-01':bounded(annSep,100,3*1024*1024),
   'snapshot-05':bounded(keri,100,3*1024*1024),
   'snapshot-09':bounded(holm,100,3*1024*1024),
  },
  ann2024OctOriginal:bounded(annOct,100,3*1024*1024),
  ann2024NovOriginal:bounded(annNov,100,3*1024*1024),
 });
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log(JSON.stringify({
  verifiedEverServedSenators:report.totals.namedActualSenatePeople,
  previousShortStatements:report.totals.previousShortStatementLeads,
  newAdditionalCandidateCampaignTextStatements:report.totals.newHumanReviewedSourceStatementLeads,
  totalDatedStatementSourceLeads:report.totals.datedShortStatementResearchLeads,
  authenticatedHistoricalPlatformStatements:report.totals.independentlyDateAttestedOriginalCampaignExcerptLeads,
  modernPublisherOnlyQuotes:report.totals.modernPublisherOnlyHistoricallyUnattestedExcerpts,
  actualOriginalHtmlVersionsRechecked:report.totals.candidateSiteOriginalHtmlVersionsReopenedAndVerified,
  originalQuoteOccurrencesIndependentlyChecked:report.totals.totalExactOriginalHtmlAndHistoricalCdxExcerptChecks,
  attributedNeverServedPersons:0,productionWrites:0,forecastAdmitted:0,
  output:out,
 }));
}
main();
