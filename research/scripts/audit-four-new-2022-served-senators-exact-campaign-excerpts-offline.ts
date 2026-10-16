/**
 * Run one-shot source-only offline #864 candidate campaign historical audit.
 * Require independently captured original government LRL service HTML, original
 * archived campaign HTML + genuine historical CDX JSON. No network or DB.
 */
import {readFileSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import ledger from '../../data/evaluation/senate-four-new-2022-served-original-2022-exact-policy-quotes-v1.json' with {type:'json'};
import {parseOfficialMnSenateServiceDirectory} from '../../src/evidence/senate-official-ever-served-directory.js';
import {
 auditFour2023ServingSenators47GenuineArchived2022CandidateStatements,
 type SixNewOriginalCampaignManifest,
} from '../../src/evidence/senate-four-new-2022-original-campaign-excerpt-proof.js';
function bounded(file:string,min:number,max:number){
 const stat=statSync(file);
 if(!stat.isFile()||stat.size<min||stat.size>max)
  throw Error('Full original Senate evidence file missing/incomplete/oversized');
 return readFileSync(file);
}
function main(){
 const flags=['--whole-original-lrl-senate-service-html',
  '--whole-original-lrl-source-sha-utc-receipt',
  '--2022-original-campaign-archive-dir','--output'];
 const args=process.argv.slice(2);
 if(args.length!==8||flags.some(f=>args.filter(a=>a===f).length!==1))
  throw Error('Require four original government/receipt/candidate archive/new output paths');
 const [lrl,receipt,archive,output]=flags.map(flag=>{
  const i=args.indexOf(flag),v=i<0?undefined:args[i+1];
  if(!v||v.startsWith('--'))throw Error('Missing original source prerequisite');
  return resolve(v);
 });
 if(new Set([lrl,receipt,archive,output]).size!==4)
  throw Error('Original sources/receipt/output cannot overlap');
 const government=bounded(lrl,9000,5*1024*1024);
 const source=JSON.parse(bounded(receipt,100,3*1024*1024).toString('utf8')) as{
  source?:{url?:string;observedAt?:string;sourceBytesSha256?:string};
 };
 const sha=createHash('sha256').update(government).digest('hex');
 if(sha!=='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51'
  ||source.source?.sourceBytesSha256!==sha
  ||source.source.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
  ||!source.source.observedAt)
  throw Error('Entire original Minnesota government actual-serving Senate roster UTC/SHA receipt changed');
 const official=parseOfficialMnSenateServiceDirectory(government,source.source.observedAt);
 const manifest=JSON.parse(bounded(join(archive,'source-acquisition-manifest.json'),
   100,2*1024*1024).toString('utf8')) as SixNewOriginalCampaignManifest;
 const originalHtml:Record<string,Uint8Array>={};
 for(const page of ledger.fullOriginalPageSHAReceipts){
  if(Object.hasOwn(originalHtml,page.originalFile))
   throw Error('Duplicate pinned genuine first-party HTML file');
  originalHtml[page.originalFile]=bounded(join(archive,page.originalFile),32,2_500_000);
 }
 const independentCdx:Record<string,unknown>={};
 for(let i=0;i<6;i++){
  const file='six22-'+String(i+1).padStart(2,'0')+'-real-2022-cdx-source.json';
  independentCdx[file]=JSON.parse(bounded(join(archive,file),3,1_500_000).toString('utf8')) as unknown;
 }
 const proved=auditFour2023ServingSenators47GenuineArchived2022CandidateStatements(
  official,manifest,originalHtml,independentCdx);
 mkdirSync(dirname(output),{recursive:true});
 writeFileSync(output,JSON.stringify(proved,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log('FOUR-NEW-2023-SERVING-SENATORS-ORIGINAL-2022-CAMPAIGN-47-EXACT-QUOTES '+
  JSON.stringify({
   sourcePages:proved.genuineFullArchivedHTMLRehashed,
   cdxOriginalIndices:proved.originalCDXIndexSourcesReopened,
   policySections:proved.candidatePolicySectionsActuallyReverified,
   authenticPolicyQuotes:proved.exactCandidateOwnedPolicyExcerptsVerified,
   people:proved.peopleWithActualCandidatePolicyExcerpts,
   bySenator:proved.bySenator,
   autoProductionWrites:proved.productionDatabaseOrForecastEvidenceChanges,
  }));
}
if(process.argv[1]?.endsWith('audit-four-new-2022-served-senators-exact-campaign-excerpts-offline.ts')){
 try{main();}catch(e){
  console.error('Full original Senate service + 16 HTML + 6 CDX indices + 47 exact policy excerpts rejected: '+
   (e instanceof Error?e.message:'unknown').slice(0,500));process.exitCode=1;
 }
}
