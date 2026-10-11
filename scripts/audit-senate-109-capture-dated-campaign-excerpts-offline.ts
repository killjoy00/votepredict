/**
 * PR-only all-original offline #864 quote audit. Independent LRL service
 * HTML + acquisition manifest + ALL 68 archived original body SHA/CDX
 * checks first, then 109 manually reviewed policy phrase/page/date checks.
 *
 * No network, source scraping, DB/Neon/Vercel, forecasts or ingestion.
 */
import {readFileSync,statSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import pinned from '../data/evaluation/senate-original-2020-22-authenticated-68-pages-v1.json' with {type:'json'};
import {auditPinned68SenateOriginalCampaignPageReceipts}
 from './audit-senate-original-68-campaign-page-receipts-offline.js';
import {auditCaptureDated109ActualSenatorOriginalCampaignExcerpts}
 from '../src/evidence/senate-capture-dated-2020-22-original-campaign-109-excerpts.js';

const readOriginal=(f:string,min:number,max:number):Buffer=>{
 const s=statSync(f);
 if(!s.isFile()||s.size<min||s.size>max)
  throw Error('Original government or historical candidate HTML outside source bounds');
 return readFileSync(f);
};
function main(){
 const flags=[
  '--lrl-original-html','--lrl-original-audit-receipt',
  '--2022-campaign-original-source-dir',
  '--2020-campaign-original-source-dir','--output',
 ];
 const opts=process.argv.slice(2);
 if(opts.length!==flags.length*2||flags.some(k=>opts.filter(x=>x===k).length!==1))
  throw Error('Exact original source archive directories, government HTML and output all required');
 const [official,receipt,year22,year20,out]=flags.map(k=>{
  const i=opts.indexOf(k),s=i<0?undefined:opts[i+1];
  if(!s||s.startsWith('--'))throw Error('Missing required original source directory/actual byte receipt');
  return resolve(s);
 });
 if(new Set([official,receipt,year22,year20,out]).size!==5)
  throw Error('Must supply independent original sources; never overwrite them');
 const input={
  lrlHtml:readOriginal(official,9000,5_000_000),
  lrlReceipt:JSON.parse(readOriginal(receipt,100,3_000_000).toString('utf8'))
,
  original2022:JSON.parse(readOriginal(join(year22,'source-acquisition-manifest.json'),100,4_000_000).toString('utf8'))
,
  original2020:JSON.parse(readOriginal(join(year20,'acquisition-manifest.json'),100,4_000_000).toString('utf8'))
,
  html2022:{} as Record<string,Uint8Array>,
  html2020:{} as Record<string,Uint8Array>,
 };
 for(const p of pinned.pages){
  const target=p.electionYear===2022?input.html2022:input.html2020;
  const dir=p.electionYear===2022?year22:year20;
  if(Object.hasOwn(target,p.sourceFile))throw Error('Duplicate original source page filename');
  target[p.sourceFile]=readOriginal(join(dir,p.sourceFile),32,2_500_000);
 }
 const real68=auditPinned68SenateOriginalCampaignPageReceipts(input);
 const verified109=auditCaptureDated109ActualSenatorOriginalCampaignExcerpts(real68,{
  html2022:input.html2022,html2020:input.html2020,
 });
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(verified109,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log('SENATE-2020-22-ARCHIVE-CAPTURE-DATED-ISSUE-EXCERPT-PROOF '+
 JSON.stringify({
  senators:verified109.actuallyServedSenatorPeopleWithExactlySourceQuotedPolicy,
  dates:verified109.earliestAttributionUsesVerifiedArchiveCaptureUtcOnly,
  originalPagesReopened:real68.independentlyHashAndCdxVerifiedSourceCopies,
  sourcePolicyPages:verified109.selectedCandidateOwnedSourcePages,
  exactPolicySnippets:verified109.exactSourceQuotedAttributableIssueExcerpts,
  earlierIndependentWordDates:verified109.identicalCampaignExcerptPublicByDatesEarlierConfirmed,
  bySenator:verified109.bySenator,byIssue:verified109.byIssue,
  databaseOrForecastWrites:0,
 }));
}
if(process.argv[1]?.endsWith('audit-senate-109-capture-dated-campaign-excerpts-offline.ts')){
 try{main();}catch(e){
  console.error('Archived senator original date/excerpt not proved: '+
   (e instanceof Error?e.message:'unknown').slice(0,480));
  process.exitCode=1;
 }
}
