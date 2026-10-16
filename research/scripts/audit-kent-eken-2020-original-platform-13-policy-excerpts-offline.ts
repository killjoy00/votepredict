/**
 * Independent #864 full source OFFLINE proof for authentic 2020 archive-captured
 * Kent Eken first-party platform (older 2016 campaign-copy clearly identified).
 * Requires original MN government Senate-service HTML+UTC receipt, ALL five
 * original archived HTML, and both independent original Wayback CDX JSON indices.
 * No networking, Neon, Vercel, forecast, model or production evidence accesses.
 */
import {readFileSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import ledger from '../../data/evaluation/senate-kent-eken-2020-original-13-capture-dated-platform-excerpts-v1.json' with {type:'json'};
import {parseOfficialMnSenateServiceDirectory}
 from '../../src/evidence/senate-official-ever-served-directory.js';
import {
 independentlyAuditKentEken13True2020ArchivedCampaignPolicyStatements,
 type Two2021ServingSenators2020OriginalSourceManifest,
} from '../../src/evidence/senate-kent-eken-2020-13-historical-campaign-excerpt-proof.js';
const GOV_SHA='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51';
function safeRead(path:string,min:number,max:number){
 const f=statSync(path);
 if(!f.isFile()||f.size<min||f.size>max)
  throw Error('Original 2020 candidate historical public source missing, incomplete or unbounded');
 return readFileSync(path);
}
function main(){
 const switches=[
  '--original-entire-mn-actual-senate-service-html',
  '--original-government-senate-service-utc-sha-receipt',
  '--original-2020-campaign-html-cdx-dir',
  '--output',
 ];
 const args=process.argv.slice(2);
 if(args.length!==switches.length*2||switches.some(x=>args.filter(t=>t===x).length!==1))
  throw Error('All four arguments required for whole original 2020 service and campaign proof');
 const [governmentPath,receiptPath,archivePath,out]=switches.map(x=>{
  const i=args.indexOf(x),p=i>=0?args[i+1]:null;
  if(!p||p.startsWith('--'))throw Error('No candidate statement proof without genuine original source path');
  return resolve(p);
 });
 if(new Set([governmentPath,receiptPath,archivePath,out]).size!==4)
  throw Error('Original government/Wayback source files cannot be conflated or overwritten');
 const fullGov=safeRead(governmentPath,9000,5*1024*1024);
 const governmentMeta=JSON.parse(safeRead(receiptPath,100,3*1024*1024).toString('utf8')) as{
  source?:{url?:string;observedAt?:string;sourceBytesSha256?:string};
 };
 const calculatedSha=createHash('sha256').update(fullGov).digest('hex');
 if(calculatedSha!==GOV_SHA
   ||governmentMeta.source?.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
   ||governmentMeta.source.sourceBytesSha256!==GOV_SHA
   ||!governmentMeta.source.observedAt)
  throw Error('Original complete Minnesota LRL actually serving state senators directory hash/UTC invalid');
 const official=parseOfficialMnSenateServiceDirectory(fullGov,governmentMeta.source.observedAt);
 const manifest=JSON.parse(safeRead(join(archivePath,'source-acquisition-manifest.json'),100,3*1024*1024).toString('utf8')) as Two2021ServingSenators2020OriginalSourceManifest;
 const html:Record<string,Uint8Array>={};
 for(const r of ledger.fullOriginalPageReceipts){
  if(Object.hasOwn(html,r.originalFile))throw Error('Duplicate original campaign site HTML receipt');
  html[r.originalFile]=safeRead(join(archivePath,r.originalFile),32,2_500_000);
 }
 const originalCDX:Record<string,unknown>={};
 for(let i=1;i<=2;i++){
  const file='two20b-'+String(i).padStart(2,'0')+'-real-2020-cdx-source.json';
  originalCDX[file]=JSON.parse(safeRead(join(archivePath,file),2,1_500_000).toString('utf8')) as unknown;
 }
 const audited=independentlyAuditKentEken13True2020ArchivedCampaignPolicyStatements(
  official,manifest,html,originalCDX);
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(audited,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log('KENT-EKEN-2020-ORIGINAL-13-EXACT-CAMPAIGN-POLICY-QUOTE-PROOF '+JSON.stringify({
  peopleIndependentlyProvenActualSenators:audited.originalActualSenateServingPeopleVerified,
  fullHtmlRehashed:audited.fullOriginalFirstPartyHTMLRehashed,
  independentCDXReopened:audited.fullIndependentHistoricalCDXJsonIndexesReopened,
  candidateOwnedIssuePages:audited.candidatePolicyOriginalPageSectionsVerified,
  exactExcerpts:audited.exactCandidateIssueExcerptsVerified,
  bySenator:audited.bySenator,
  productionChanges:audited.productionDBEvidenceForecastModelSchedulerChanges,
 }));
}
if(process.argv[1]?.endsWith('audit-kent-eken-2020-original-platform-13-policy-excerpts-offline.ts')){
 try{main();}catch(e){
  console.error('Original public government/2020 campaign whole HTML/CDX exact quote proof rejected: '+
   (e instanceof Error?e.message:'unknown').slice(0,600));
  process.exitCode=1;
 }
}
