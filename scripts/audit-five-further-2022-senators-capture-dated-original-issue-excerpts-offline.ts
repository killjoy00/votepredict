/**
 * PR-only offline #864 full real original archived HTML 2022-source proof.
 * Reopen official Senate-serving LRL original and SHA/UTC receipt, exact
 * original historic campaign acquisition manifest and all 13 full HTML bodies
 * before checking 62 personally attributable candidate-owned policy snippets.
 * No network, private DB, evidence ingestion, forecasts or deployments.
 */
import {createHash} from 'node:crypto';
import {statSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import corpus from '../data/evaluation/senate-five-further-2022-authenticated-capture-dated-original-issue-excerpts-v1.json' with {type:'json'};
import {parseOfficialMnSenateServiceDirectory}
 from '../src/evidence/senate-official-ever-served-directory.js';
import {
 auditFiveMore2022CaptureDatedOriginalSenatorPolicyExcerpts,
 type AcquiredOriginal2022Sites,
} from '../src/evidence/senate-five-further-2022-capture-dated-62-original-campaign-excerpts.js';

function source(file:string,min:number,max:number):Buffer{
 const s=statSync(file);
 if(!s.isFile()||s.size<min||s.size>max)
  throw Error('Original public Senate member/candidate archived source bytes not available');
 return readFileSync(file);
}
function run(){
 const names=['--official-senator-directory-original','--official-lrl-source-receipt',
  '--original-2022-candidate-site-acquisition-dir','--output'];
 const args=process.argv.slice(2);
 if(args.length!==names.length*2||names.some(x=>args.filter(a=>a===x).length!==1))
  throw Error('Full official Senate source/receipt and original historical 2022 public archive required');
 const [lrl,receipt,archive,out]=names.map(x=>{
  const i=args.indexOf(x),p=i<0?undefined:args[i+1];
  if(!p||p.startsWith('--'))throw Error('No authentic source path provided');
  return resolve(p);
 });
 if(new Set([lrl,receipt,archive,out]).size!==4)
  throw Error('Output/source path reuse forbidden');
 const officialHtml=source(lrl,9000,5*1024*1024);
 const lrlMeta=JSON.parse(source(receipt,100,3*1024*1024).toString('utf8')) as{
  source?:{url?:string;observedAt?:string;sourceBytesSha256?:string};
 };
 const hash=createHash('sha256').update(officialHtml).digest('hex');
 if(hash!=='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51'
  ||lrlMeta.source?.sourceBytesSha256!==hash
  ||lrlMeta.source?.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
  ||!lrlMeta.source.observedAt)
  throw Error('Original government LRL Senate-service SHA/UTC/source receipt failed independent verification');
 const official=parseOfficialMnSenateServiceDirectory(officialHtml,lrlMeta.source.observedAt);
 const acquisition=JSON.parse(source(join(archive,'source-acquisition-manifest.json'),
  100,4*1024*1024).toString('utf8')) as AcquiredOriginal2022Sites;
 const sources:Record<string,Uint8Array>={};
 for(const p of corpus.originalAuthenticatedPageReceipts){
  if(Object.hasOwn(sources,p.originalFile))
   throw Error('Repeated / mismatched historical original page file');
  sources[p.originalFile]=source(join(archive,p.originalFile),32,2_500_000);
 }
 const result=auditFiveMore2022CaptureDatedOriginalSenatorPolicyExcerpts(
  official,acquisition,sources);
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log('FIVE-FURTHER-SENATORS-CAPTURE-DATED-62-ORIGINAL-POLICY-PROOF '+
  JSON.stringify({
   actuallyServingSenators:result.independentlyVerifiedActualSenatorPeople,
   originalArchiveHtmlSourcePages:result.originalHistoricalPageFullBytesReopened,
   selectedPolicyPages:result.originalCampaignIssuePolicySourcePages,
   independentlyDatedExactQuotes:result.exactOriginalCampaignIssueQuotesCaptureDated,
   bySenator:result.bySenator,byIssue:result.byIssue,
   firstAuthorPostedDateRequired:!result.noOriginalFirstAuthorPostingDateRequired,
   actualProductionWrites:result.productionDBOrForecastEvidenceWrites,
  }));
}
if(process.argv[1]?.endsWith('audit-five-further-2022-senators-capture-dated-original-issue-excerpts-offline.ts')){
 try{run();}catch(e){
  console.error('Actual Senate original candidate webpage/date/excerpt proof failed: '+
    (e instanceof Error?e.message:'unknown').slice(0,450));
  process.exitCode=1;
 }
}
