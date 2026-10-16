/**
 * #864 independent source-only OFFLINE proof. Never make external requests:
 * full LRL Senate-service original+SHA observed-UTC receipt, all 22 full archived
 * 2022 campaign original HTML, all SIX indexed original CDX JSON and 91 quotes.
 */
import {readFileSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import ledger from '../../data/evaluation/senate-five-additional-served-2022-capture-dated-candidate-quotes-v1.json' with {type:'json'};
import {parseOfficialMnSenateServiceDirectory}
 from '../../src/evidence/senate-official-ever-served-directory.js';
import {
 auditFiveNew2022CampaignSiteCandidateQuotes,
 type SixFollowupOriginalArchivedSourceManifest,
} from '../../src/evidence/senate-five-additional-served-2022-original-candidate-quote-audit.js';
function bounded(path:string,min:number,max:number){
 const s=statSync(path);
 if(!s.isFile()||s.size<min||s.size>max)
  throw Error('Genuine original government/CDX/candidate complete source file missing or incomplete');
 return readFileSync(path);
}
function main(){
 const args=process.argv.slice(2),flags=[
  '--original-entire-mn-lrl-senate-service-html',
  '--original-mn-lrl-service-utc-sha-receipt',
  '--original-wayback-2022-candidate-full-html-and-cdx-dir',
  '--output',
 ];
 if(args.length!==8||flags.some(f=>args.filter(x=>x===f).length!==1))
  throw Error('Must supply original official Senate government HTML/receipt, entire original 2022 campaign archive, output');
 const [gov,receipt,archive,out]=flags.map(f=>{
  const i=args.indexOf(f),v=i<0?undefined:args[i+1];
  if(!v||v.startsWith('--'))throw Error('Whole authentic original source prerequisite absent');
  return resolve(v);
 });
 if(new Set([gov,receipt,archive,out]).size!==4)
  throw Error('Cannot conflate or overwrite whole original evidence and independent proof');
 const originalGov=bounded(gov,9000,5*1024*1024);
 const receiptData=JSON.parse(bounded(receipt,100,3*1024*1024).toString('utf8')) as{
  source?:{url?:string;observedAt?:string;sourceBytesSha256?:string};
 };
 const computed=createHash('sha256').update(originalGov).digest('hex');
 if(computed!=='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51'
  ||receiptData.source?.sourceBytesSha256!==computed
  ||receiptData.source.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
  ||!receiptData.source.observedAt)
  throw Error('Actual complete independent Minnesota LRL Senate service source bytes or UTC receipt differs');
 const government=parseOfficialMnSenateServiceDirectory(originalGov,receiptData.source.observedAt);
 const sourceManifest=JSON.parse(bounded(join(archive,'source-acquisition-manifest.json'),100,3*1024*1024).toString('utf8')) as SixFollowupOriginalArchivedSourceManifest;
 const html:Record<string,Uint8Array>={};
 for(const p of ledger.fullOriginalArchivedSourceReceipts){
  if(Object.hasOwn(html,p.file))throw Error('Duplicate whole original captured candidate HTML source file');
  html[p.file]=bounded(join(archive,p.file),32,2_500_000);
 }
 const cdx:Record<string,unknown>={};
 for(let i=1;i<=6;i++){
  const filename='sixnext22-'+String(i).padStart(2,'0')+'-real-2022-cdx-source.json';
  cdx[filename]=JSON.parse(bounded(join(archive,filename),3,1_500_000).toString('utf8')) as unknown;
 }
 const audited=auditFiveNew2022CampaignSiteCandidateQuotes(government,sourceManifest,html,cdx);
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(audited,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log('FIVE-NEW-ACTUAL-MN-SENATORS-2022-ORIGINAL-SITE-91-EXACT-QUOTE-PROOFS '+JSON.stringify({
  officialServicePeople:audited.originalSenatorPersonsVerified,
  actualSitePeople:audited.actualSenatorsWithAuthenticatedOriginalSitePages,
  actualIssuePeople:audited.actualSenatorPersonsWithIssueExcerpts,
  originalHTMLRehashed:audited.originalWholeHTMLBodiesReopenedAndSHA1SHA256Rechecked,
  originalCDXFiles:audited.originalWholeHistoricalCDXIndexFilesReopened,
  candidatePolicySections:audited.candidateOwnedPolicySectionsIndependentlyReviewed,
  exactQuotes:audited.shortGenuineCampaignIssueExcerptsVerified,
  bySenator:audited.bySenator,
  productionChanges:audited.productionDatabaseReadsWritesEvidenceOrForecastChanges,
 }));
}
if(process.argv[1]?.endsWith('audit-five-additional-served-2022-candidate-quotes-offline.ts')){
 try{main();}catch(e){
  console.error('Original independent government service/2022 archived HTML/CDX quote attribution rejected: '+
   (e instanceof Error?e.message:'unknown').slice(0,500));process.exitCode=1;
 }
}
