/**
 * Independent OFFLINE verification of 26 short exact first-party site quotes
 * by two ACTUAL 2021-serving Minnesota State Senators. Whole original LRL
 * Senator service HTML+UTC/SHA, all TEN true historical site HTML bodies,
 * BOTH entire independently obtained 2012-2022 original Wayback CDX indexes.
 * Does not connect to network, source DB, Neon, Vercel, forecasts or scheduler.
 */
import {createHash} from 'node:crypto';
import {readFileSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {parseOfficialMnSenateServiceDirectory}
 from '../../src/evidence/senate-official-ever-served-directory.js';
import targets from '../../data/evaluation/senate-ruud-2013-chamberlain-2022-targeted-first-party-original-replays-v1.json' with {type:'json'};
import audit from '../../data/evaluation/senate-ruud-2013-chamberlain-2022-original-26-exact-policy-excerpts-v1.json' with {type:'json'};
import {
 independentlyProveRuudChamberlain26OriginalCampaignAndSenatorIssuesExcerpts,
 type RuudChamberlainExactOriginalAcquisition,
} from '../../src/evidence/senate-ruud-2013-chamberlain-2022-26-original-excerpts-proof.js';
const GOV_SHA='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
function readOriginal(path:string,min:number,max:number){
 const file=statSync(path);
 if(!file.isFile()||file.size<min||file.size>max)
  throw Error('Independently preserved historical official or first-party full source missing or unbounded');
 return readFileSync(path);
}
function main(){
 const args=process.argv.slice(2);
 const switches=[
  '--entire-original-mn-lrl-actual-senate-service-html',
  '--official-original-government-utc-sha-receipt',
  '--original-ten-historical-senator-site-html-dir',
  '--original-two-independent-wayback-cdx-json-dir',
  '--output',
 ];
 if(args.length!==switches.length*2||switches.some(s=>args.filter(x=>x===s).length!==1))
  throw Error('Whole government, genuine original site HTML/CDX and separate output source paths required');
 const [governmentPath,receiptPath,pageDir,cdxDir,out]=switches.map(s=>{
  const i=args.indexOf(s),p=i<0?undefined:args[i+1];
  if(!p||p.startsWith('--'))throw Error('Original historical full source prerequisite missing');
  return resolve(p);
 });
 if(new Set([governmentPath,receiptPath,pageDir,cdxDir,out]).size!==5)
  throw Error('Do not conflate independent source artifacts or overwrite their original bytes');
 const governmentHTML=readOriginal(governmentPath,9000,5*1024*1024);
 const meta=JSON.parse(readOriginal(receiptPath,100,3*1024*1024).toString('utf8')) as{
  source?:{url?:string;observedAt?:string;sourceBytesSha256?:string};
 };
 if(sha(governmentHTML)!==GOV_SHA
  ||meta.source?.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
  ||meta.source?.sourceBytesSha256!==GOV_SHA||!meta.source.observedAt)
  throw Error('Original entire independently retrieved MN State Senate served-person LRL source/UTC/SHA differs');
 const official=parseOfficialMnSenateServiceDirectory(governmentHTML,meta.source.observedAt);
 const originalSiteManifest=JSON.parse(readOriginal(
  join(pageDir,'source-acquisition-manifest.json'),100,3*1024*1024).toString('utf8')
 ) as RuudChamberlainExactOriginalAcquisition;
 const allHtml:Record<string,Uint8Array>={};
 for(const [i,rec] of targets.targets.entries()){
  const name='targeted-'+String(i+1).padStart(2,'0')+'-original-'+rec.timestamp+'.html';
  if(Object.hasOwn(allHtml,name))throw Error('Duplicate original campaign html source receipt');
  allHtml[name]=readOriginal(join(pageDir,name),32,2_500_000);
 }
 const cdxs:Record<string,unknown>={},originalSHA:Record<string,string>={};
 for(const source of audit.provenance.originalCDXFiles){
  const raw=readOriginal(join(cdxDir,source.file),100,1_500_000);
  originalSHA[source.file]=sha(raw);
  cdxs[source.file]=JSON.parse(raw.toString('utf8')) as unknown;
 }
 const result=independentlyProveRuudChamberlain26OriginalCampaignAndSenatorIssuesExcerpts(
  official,originalSiteManifest,allHtml,cdxs,originalSHA);
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log('RUUD-CHAMBERLAIN-2013-2022-ORIGINAL-26-LITERAL-QUOTE-PROOF '+JSON.stringify({
  actualServingPeople:result.actual2021ServingStateSenatorsNewDirectIssueCoverage,
  wholeOriginalHTML:result.historicalFirstPartyFullOriginalHTMLPagesRehashed,
  completeCDXIndexes:result.wholeOriginalIndependentWaybackCDXSourceFilesReopened,
  selectedAuthenticSections:result.originalCampaignAndSenatorPolicyPageSectionsProven,
  exactHistoricalCandidateSiteStatements:result.exactShortOriginalPolicyWebsiteExcerptsVerified,
  sectionCounts:result.bySiteSection,
  productionChanges:result.productionDatabaseEvidenceForecastModelSchedulerChanges,
 }));
}
if(process.argv[1]?.endsWith('audit-ruud-2013-chamberlain-2022-26-original-policy-excerpts-offline.ts')){
 try{main();}catch(e){
  console.error('Original LRL/2013 Ruud/2022 Chamberlain complete HTML/CDX literal quote proof denied: '+
   (e instanceof Error?e.message:'unknown').slice(0,550));
  process.exitCode=1;
 }
}
