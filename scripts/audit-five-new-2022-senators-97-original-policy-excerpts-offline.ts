/**
 * Genuine original archival source ONLY: previously authenticated Minnesota
 * LRL full 2023 serving senator HTML+dated receipt, actual 2022 campaign
 * source acquisition manifest, 23 full original candidate page HTML bodies.
 * No network calls, production DB, evidence writes, model or forecasts.
 *
 * Output proves 97 exact personally attributable candidate-owned issue
 * snippets from five people against original Wayback CDX SHA-1 and SHA-256
 * with public-by date equal to original 2022 archive capture UTC. No first
 * author-created date inferred or required.
 */
import {createHash} from 'node:crypto';
import {statSync,readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import sources from '../data/evaluation/senate-eight-probed-six-served-original-2022-23-html-receipts-v1.json' with {type:'json'};
import {parseOfficialMnSenateServiceDirectory}
 from '../src/evidence/senate-official-ever-served-directory.js';
import {
 auditFiveNewActuallyServedSenators97ArchiveDatedPolicyExcerpts,
 type EightNewSenatorOriginalSourceAcquisition,
} from '../src/evidence/senate-five-new-served-2022-97-capture-dated-exact-campaign-excerpts.js';

function actualFullSource(f:string,min:number,max:number){
 const s=statSync(f);
 if(!s.isFile()||s.size<min||s.size>max)
  throw Error('Missing full original Minnesota government/2022 first-party source');
 return readFileSync(f);
}
function main(){
 const flags=[
  '--real-original-lrl-senator-directory','--real-original-lrl-sha-utc-receipt',
  '--original-2022-candidate-archive-dir','--output',
 ];
 const args=process.argv.slice(2);
 if(args.length!==flags.length*2||flags.some(f=>args.filter(x=>x===f).length!==1))
  throw Error('Four mandatory original full source/receipt/archive/output paths required');
 const [government,govReceipt,archive,out]=flags.map(f=>{
  const i=args.indexOf(f);
  const p=i<0?undefined:args[i+1];
  if(!p||p.startsWith('--'))throw Error('Cannot audit dated Senate policy excerpt without genuine original source');
  return resolve(p);
 });
 if(new Set([government,govReceipt,archive,out]).size!==4)
  throw Error('Cannot overwrite or conflate original source and output paths');
 const html=actualFullSource(government,9000,5*1024*1024);
 const receipt=JSON.parse(actualFullSource(govReceipt,100,3*1024*1024).toString('utf8')) as{
  source?:{url?:string;observedAt?:string;sourceBytesSha256?:string};
 };
 const calculatedHash=createHash('sha256').update(html).digest('hex');
 if(calculatedHash!=='bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51'
  ||receipt.source?.sourceBytesSha256!==calculatedHash
  ||receipt.source?.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
  ||!receipt.source.observedAt)
  throw Error('Public MN LRL actual Senator full original HTML/UTC/source SHA receipt does not authenticate');
 const official=parseOfficialMnSenateServiceDirectory(html,receipt.source.observedAt);
 const acquired=JSON.parse(
  actualFullSource(join(archive,'source-acquisition-manifest.json'),100,4*1024*1024).toString('utf8')
 ) as EightNewSenatorOriginalSourceAcquisition;
 const original:Record<string,Uint8Array>={};
 for(const p of sources.allAuthenticatedOriginal2022SourcePages){
  if(Object.hasOwn(original,p.originalFile))
   throw Error('Duplicate original 2022 campaign source filename');
  original[p.originalFile]=actualFullSource(join(archive,p.originalFile),32,2_500_000);
 }
 const attested=auditFiveNewActuallyServedSenators97ArchiveDatedPolicyExcerpts(
  official,acquired,original);
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(attested,null,2)+'\n',{mode:0o600,flag:'wx'});
 console.log('SIX-MORE-SENATOR-ORIGINALS-FIVE-POLICY-PERSONS-97-CAPTURE-DATED-PROOF '+
  JSON.stringify({
   servingSenatorsWithOriginalPages:attested.actualSenateServedDistinctPeopleWithOriginalPageProof,
   senatorPersonsWithActualIssueExcerpts:attested.peopleWithFullOriginalPolicyStatements,
   originalArchivedFullHtmlSHA256AndCDXChecked:attested.actualFullOriginalHistoricHTMLCopiesReopened,
   issuePagesVerified:attested.candidateOwnedOriginalIssuePagesIndependentlyChecked,
   exactPolicyExcerptsAttributableToOriginal2022CaptureUtc:attested.exactFirstPartyCampaignPolicyExcerptsAuthenticated,
   bySenator:attested.byActualSenator,
   firstAuthorDateRequired:attested.firstAuthorPostingDateRequired,
   productionDatabaseOrForecastEvidenceChanges:attested.productionDatabaseReadsWritesOrForecastEvidenceAdmissions,
  }));
}
if(process.argv[1]?.endsWith('audit-five-new-2022-senators-97-original-policy-excerpts-offline.ts')){
 try{main();}catch(e){
  console.error('Original six actual MN Senators full site/body/CDX SHA and 97 policy quote proof rejected: '+
   (e instanceof Error?e.message:'unknown').slice(0,500));
  process.exitCode=1;
 }
}
