/**
 * Offline real-original-source recheck of Nick Frentz personally serving MN
 * Senate, historic Wayback archived 2022 campaign URL recovered from real
 * Sept 2022 podcast, all three authenticated campaign HTML bodies, and 26
 * exact page issue snippets by real 2022 archive capture UTC.
 *
 * No first-writer date needed. No live URLs, production DB, forecasts or IO.
 */
import {createHash} from 'node:crypto';
import {readFileSync,statSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import ledger from '../data/evaluation/senate-nick-frentz-2022-podcast-site-26-original-capture-dated-policy-excerpts-v1.json' with {type:'json'};
import {parseOfficialMnSenateServiceDirectory}
 from '../src/evidence/senate-official-ever-served-directory.js';
import {
 auditFrentz26CaptureDatedOriginal2022CandidateIssueStatements,
 type NickFrentzOriginal2022Acquisition,
} from '../src/evidence/senate-nick-frentz-2022-26-original-capture-dated-campaign-issue-proof.js';

function exact(path:string,min:number,max:number){
 const st=statSync(path);
 if(!st.isFile()||st.size<min||st.size>max)
  throw Error('Missing or unsafe real original government service / campaign archived HTML source');
 return readFileSync(path);
}
function run(){
 const names=[
  '--original-lrl-senate-directory','--original-lrl-sha-utc-receipt',
  '--frentz-2022-original-archive-dir','--output',
 ];
 const args=process.argv.slice(2);
 if(args.length!==names.length*2||names.some(k=>args.filter(x=>x===k).length!==1))
  throw Error('Required three independent REAL Senate government/acquisition paths and one output');
 const [lrl,receipt,originals,out]=names.map(k=>{
  const i=args.indexOf(k),v=i<0?undefined:args[i+1];
  if(!v||v.startsWith('--'))throw Error('Cannot audit candidate policy excerpt without original evidence');
  return resolve(v);
 });
 if(new Set([lrl,receipt,originals,out]).size!==4)
  throw Error('Original source and output conflation forbidden');
 const originalLrlHtml=exact(lrl,9000,5*1024*1024);
 const m=JSON.parse(exact(receipt,100,3*1024*1024).toString('utf8')) as{
  source?:{url?:string;observedAt?:string;sourceBytesSha256?:string};
 };
 const hash=createHash('sha256').update(originalLrlHtml).digest('hex');
 if(hash!=='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51'
  ||m.source?.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
  ||m.source.sourceBytesSha256!==hash||!m.source.observedAt)
  throw Error('Actual LRL official Senator-service original HTML/UTC/SHA receipt not valid');
 const official=parseOfficialMnSenateServiceDirectory(originalLrlHtml,m.source.observedAt);
 const manifest=JSON.parse(
  exact(join(originals,'source-acquisition-manifest.json'),100,3*1024*1024).toString('utf8')
 ) as NickFrentzOriginal2022Acquisition;
 const bodies:Record<string,Uint8Array>={};
 for(const page of ledger.originalFullPageSourceReceipts){
  if(Object.hasOwn(bodies,page.file))throw Error('Duplicate original campaign source page');
  bodies[page.file]=exact(join(originals,page.file),32,2_500_000);
 }
 const audit=auditFrentz26CaptureDatedOriginal2022CandidateIssueStatements(
  official,manifest,bodies);
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(audit,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log('FRENTZ-2022-CONTEMPORANEOUS-ORIGINAL-CAPTURE-DATED-26-SOURCE-QUOTES '+
  JSON.stringify({
   actuallyServingSenators:audit.actualOfficialSenateServedPeopleVerified,
   authenticOriginalFullHTMLBodies:audit.trueOriginalCampaignHTMLPageCopiesReopenedAndCDXAuthenticated,
   shortExactCandidateOwnedPolicyStatements:audit.fullyRehashedExactCampaignPolicyStatements,
   older2020ReportJan2022CaptureStatements:audit.originalEarlier2020ReportWordsStillOnJan2022Site,
   november2022PolicyStatements:audit.originalNovember2022ReportWordExcerpts,
   november2022EarlierCapturedQuotesDoubleProof:audit.November2022EarlierCaptureAttributionIndependentlyCorroboratedOnLaterSameDayOriginal,
   firstAuthoredDateRequired:audit.firstAuthoredDateRequired,
   productionDbOrForecastEvidenceWrites:audit.productionDatabaseReadsOrForecastEvidenceWrites,
   byIssue:audit.issueFamilyCounts,
  }));
}
if(process.argv[1]?.endsWith('audit-nick-frentz-2022-original-26-capture-dated-policy-snippets-offline.ts')){
 try{run();}catch(e){
  console.error('Real Frentz original page/date exact campaign excerpt proof rejected: '+
   (e instanceof Error?e.message:'unknown').slice(0,400));
  process.exitCode=1;
 }
}
