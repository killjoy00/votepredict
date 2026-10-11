/**
 * Recheck original Oct 6 2022 campaign source words from exact Wayback HTML
 * plus the independently observed Minnesota LRL Senate-service original.
 * All inputs are existing public source originals; no network/DB writes.
 */
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {parseOfficialMnSenateServiceDirectory} from
 '../src/evidence/senate-official-ever-served-directory.js';
import {auditActuallyServed2022CarlaOriginalCampaignIssueExcerpts} from
 '../src/evidence/senate-carla-nelson-2022-original-platform-audit.js';
const args=process.argv.slice(2);
function opt(flag:string){
 const n=args.indexOf(flag),value=n<0?undefined:args[n+1];
 return value&&!value.startsWith('--')?value:undefined;
}
function bounded(path:string,max:number,min=100){
 const n=statSync(path);
 if(!n.isFile()||n.size<min||n.size>max)throw Error('Original dated source missing or exceeds bounded size');
 return readFileSync(path);
}
function main(){
 const srcA=opt('--2022-original-a'),srcB=opt('--2022-original-b'),
  lrlFile=opt('--official-lrl-html'),lrlMeta=opt('--official-lrl-metadata'),
  output=opt('--output');
 if(!lrlFile||!lrlMeta||!output||args.length!==
   (srcA&&srcB?10:6)||Boolean(srcA)!==Boolean(srcB))
  throw Error('Require both official LRL inputs and either both original 2022 HTML files or neither');
 const all=[lrlFile,lrlMeta,output,...[srcA,srcB].filter((v):v is string=>!!v)]
  .map(s=>resolve(s));
 if(new Set(all).size!==all.length)throw Error('Never overwrite historical original source');
 const raw=bounded(resolve(lrlFile),5*1024*1024,9000);
 const provenance=JSON.parse(bounded(resolve(lrlMeta),3*1024*1024).toString('utf8')) as{
  source?:{url?:string;observedAt?:string;sourceBytesSha256?:string};
 };
 if(provenance.source?.url!=='https://www.lrl.mn.gov/legdb/senate_dir'
  ||!provenance.source?.observedAt||!provenance.source.sourceBytesSha256
  ||createHash('sha256').update(raw).digest('hex')!==provenance.source.sourceBytesSha256)
  throw Error('Original independently dated LRL served-senator HTML SHA mismatch');
 const official=parseOfficialMnSenateServiceDirectory(raw,provenance.source.observedAt);
 const result=auditActuallyServed2022CarlaOriginalCampaignIssueExcerpts(
  official,srcA&&srcB?{
   'carla-2022-page-a':bounded(resolve(srcA),2*1024*1024,9000),
   'carla-2022-page-b':bounded(resolve(srcB),2*1024*1024,9000),
  }:{});
 mkdirSync(dirname(resolve(output)),{recursive:true});
 writeFileSync(resolve(output),JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log(JSON.stringify({
  datedOriginalSos2022SenateQuoteAudit:true,
  namedPeopleWhoIndependentlyServedInSenate:result.totals.confirmedPersonsWhoActuallyServedInSenate,
  raw2022ArchivedPagesChecked:result.totals.originalHistoricalArchivePagesRechecked,
  rawOriginalPolicyIssueFragmentsCrossChecked:result.totals.quoteOccurrenceChecksOnRawArchivedPages,
  earliestStatementAttestedAtUtc:result.source.sourceCaptureEarliestKnownUtc,
  firstAuthorPostedOnKnown:false,noNonSenatorNames:true,
  modelOrProductionEvidenceChanged:false,
 }));
}
main();
