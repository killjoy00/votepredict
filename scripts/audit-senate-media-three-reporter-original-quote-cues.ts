/** Public reporter original SHA evidence, not transcript/audio/roll-call (#987). */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {auditThreeReporterOriginalQuotes,type ThreeOriginalQueue,type PublicArticle,type PublicProof}
 from '../src/evidence/senate-media-three-reporter-original-quote-audit.js';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function read(s:string,cap:number):unknown{
 const c=readFileSync(resolve(ROOT,'docs/evaluation/'+s),'utf8');
 if(Buffer.byteLength(c)>cap)throw Error('Public research metadata size limit');
 return JSON.parse(c) as unknown;
}
async function main(){
 const args=process.argv.slice(2);
 if(args.length!==2||args[0]!=='--output'||!args[1])throw Error('Expected one metadata-only output path');
 const output=resolve(args[1]);
 if(!output.startsWith(resolve(ROOT,'artifacts')+'/')||!output.endsWith('.json'))
   throw Error('Do not save historical article HTML or audio outside metadata artifacts');
 const queue=read('senate-media-three-independent-newsroom-historical-multi-speaker-queue-20261011.json',25_000) as ThreeOriginalQueue;
 const leads=read('senate-media-2021-25-further-independent-reporting-15-leads.json',160_000) as{
  version:string;newIndividuallyNamedSenatorSpeakerCandidates:number;
  independentOriginalReporterArticleLeads:PublicArticle[];
 };
 const p=read('senate-media-2021-25-independent-reporter-15-historical-original-receipts-20261011.json',140_000) as PublicProof;
 if(leads.version!=='public-2021-25-further-independent-15-reformer-articles-v1'
   ||leads.newIndividuallyNamedSenatorSpeakerCandidates!==22
   ||!Array.isArray(leads.independentOriginalReporterArticleLeads))
   throw Error('Unknown serving-state-senator original journalist article cohort');
 const result=await auditThreeReporterOriginalQuotes(queue,leads.independentOriginalReporterArticleLeads,p);
 mkdirSync(dirname(output),{recursive:true});
 writeFileSync(output,JSON.stringify(result,null,2)+'\n',{mode:0o600,flag:'wx'});
 console.log(JSON.stringify({
  originalIndependentReporterArticles:3,senatorSpeakerCandidates:7,
  originalHttpBodyVersionsMatchedBothPriorDigests:result.originalSha1AndPriorSha256Matched,
  shortTextSourceCuesPresent:result.shortTextFragmentsPresent,
  shortTextSourceCuesAbsent:result.shortTextFragmentsAbsent,
  originalReplayUnknown:result.failedOrUnavailableOriginalVersions,
  namedSpeakerSameParagraphClues:result.correctlyNamedSameParagraphClues,
  audioCompared:0,fullHumanQuoteApprovals:0,recordedVoteEvidence:0,
  rawHtmlPersisted:false,modelTrainingUsed:false,
 }));
}
main().catch(()=>{console.error('Exact historical reporter source research failed closed');process.exitCode=1;});
