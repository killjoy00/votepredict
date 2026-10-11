/**
 * One-shot original-source-only source quote/date provenance #864.
 * Read full Minnesota LRL actual-serving Senate directory and its verified
 * dated SHA, six-person archive manifest and all 16 original 2022 HTML
 * files before accepting any individual candidate policy excerpt.
 * No live sources, network, DB, Vercel, ingestion or forecast.
 */
import {createHash} from 'node:crypto';
import {readFileSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import fixture from '../data/evaluation/senate-four-more-2022-original-campaign-policy-excerpts-capture-dated-v1.json' with {type:'json'};
import {parseOfficialMnSenateServiceDirectory}
 from '../src/evidence/senate-official-ever-served-directory.js';
import {
 auditFourMoreSenateOriginal2022CampaignCaptureDatedPolicyExcerpts,
 type ActualOriginal2022SixSenatorsAcquisition,
} from '../src/evidence/senate-four-more-2022-original-capture-dated-77-excerpts.js';

const source=(f:string,min:number,max:number)=>{
 const stat=statSync(f);
 if(!stat.isFile()||stat.size<min||stat.size>max)
  throw Error('Original public government/campaign source outside expected bounds');
 return readFileSync(f);
};
function main(){
 const flags=['--official-original-senate-directory','--official-original-receipt',
  '--actual-2022-original-acquisition-dir','--output'];
 const args=process.argv.slice(2);
 if(args.length!==8||flags.some(k=>args.filter(x=>x===k).length!==1))
  throw Error('Required original LRL bytes/receipt, true Wayback page archive source and exclusive output');
 const [lrlFile,lrlReceipt,archiveDir,out]=flags.map(k=>{
  const i=args.indexOf(k),v=i<0?undefined:args[i+1];
  if(!v||v.startsWith('--'))throw Error('Missing actual independently attributed original source path');
  return resolve(v);
 });
 if(new Set([lrlFile,lrlReceipt,archiveDir,out]).size!==4)
  throw Error('Source and output cannot overlap or be interchangeable');
 const html=source(lrlFile,9000,5_000_000);
 const receipt=JSON.parse(source(lrlReceipt,100,3_000_000).toString('utf8')) as{
  source?:{url?:string;observedAt?:string;sourceBytesSha256?:string};
 };
 const actualHash=createHash('sha256').update(html).digest('hex');
 if(actualHash!=='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51'
   ||receipt.source?.sourceBytesSha256!==actualHash
   ||receipt.source?.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
   ||!receipt.source.observedAt)
  throw Error('Genuine previously independently archived official LRL Minnesota Senator source byte receipt invalid');
 const official=parseOfficialMnSenateServiceDirectory(html,receipt.source.observedAt);
 const originalManifest=JSON.parse(source(join(archiveDir,'source-acquisition-manifest.json'),
  100,3_000_000).toString('utf8')) as ActualOriginal2022SixSenatorsAcquisition;
 const originals:Record<string,Uint8Array>={};
 for(const p of fixture.year2022OriginalPages){
  if(Object.hasOwn(originals,p.originalFile))
   throw Error('Repeated archived original page file path');
  originals[p.originalFile]=source(join(archiveDir,p.originalFile),32,2_500_000);
 }
 const audited=auditFourMoreSenateOriginal2022CampaignCaptureDatedPolicyExcerpts(
  official,originalManifest,originals);
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(audited,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log('FOUR-MORE-SERVED-SENATORS-ORIGINAL-CAPTURE-DATED-77-ISSUE-QUOTE-PROOF '+
  JSON.stringify({
   actualPeople:audited.uniqueSenateServedPeopleWithSourceQuotes,
   authenticPageCopies:audited.firstPartyFullArchivePageOriginalsReopened,
   attributedPageSections:audited.candidateOwnedPolicyPagesRechecked,
   exactQuotes:audited.exactCandidatePolicyIssueExcerptsVerified,
   provenPublicByArchiveUtc:audited.independentlyAttributableDateIsRealArchiveCaptureUtc,
   bySenator:audited.bySenator,
   productionWrites:audited.productionDatabaseReadsOrWrites,
  }));
}
if(process.argv[1]?.endsWith('audit-four-more-senate-2022-capture-dated-original-issue-excerpts-offline.ts')){
 try{main();}catch(e){
  console.error('Four more actual senators original archive-date/quote audit rejected: '+
    (e instanceof Error?e.message:'unknown').slice(0,400));
  process.exitCode=1;
 }
}
