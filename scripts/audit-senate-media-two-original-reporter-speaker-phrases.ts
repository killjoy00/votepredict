/**
 * #987 PUBLIC-ONLY two original independent multi-senator reporter articles,
 * with four distinct short named-speaker phrase cues in 2021/2024.
 *
 * node --import tsx scripts/audit-senate-media-two-original-reporter-speaker-phrases.ts \
 *  --output artifacts/senate-media-two-reporter-original-speaker-cues.json
 *
 * No original article HTML/audio persisted. Printed quote != member vote.
 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
 auditTwoJournalistOriginalSpeakerPhrases,
 type DualReporterQueue,type ReporterArticleLead,type JournalistOriginalProof,
} from '../src/evidence/senate-media-independent-reporter-dual-original-phrase-audit.js';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const Q='docs/evaluation/senate-media-2021-2024-independent-reporter-two-dual-speaker-original-phrase-queue.json';
const L='docs/evaluation/senate-media-2021-25-further-independent-reporting-15-leads.json';
const P='docs/evaluation/senate-media-2021-25-independent-reporter-15-historical-original-receipts-20261011.json';
function readBounded(path:string,cap:number):unknown{
 const raw=readFileSync(resolve(ROOT,path),'utf8');
 if(Buffer.byteLength(raw)>cap)throw Error('Public source metadata too large');
 return JSON.parse(raw) as unknown;
}
async function main(){
 const args=process.argv.slice(2);
 if(args.length!==2||args[0]!=='--output'||!args[1])
   throw Error('Require only one --output artifacts/*.json');
 const output=resolve(args[1]);
 if(!output.startsWith(resolve(ROOT,'artifacts')+'/')||!output.endsWith('.json')||output.includes('\0'))
   throw Error('Refuse to write outside metadata artifacts');
 const q=readBounded(Q,35_000) as DualReporterQueue;
 const leads=readBounded(L,130_000) as {
   version?:string;independentOriginalReporterArticleLeads?:ReporterArticleLead[];
 };
 const pins=readBounded(P,130_000) as JournalistOriginalProof;
 if(leads.version!=='public-2021-25-further-independent-15-reformer-articles-v1'
   ||!Array.isArray(leads.independentOriginalReporterArticleLeads))
   throw Error('Untrusted public independent newsroom original source list');
 const report=await auditTwoJournalistOriginalSpeakerPhrases(
   q,leads.independentOriginalReporterArticleLeads,pins);
 mkdirSync(dirname(output),{recursive:true});
 writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log(JSON.stringify({
   independentPublisherArticles:2,separatelyNamedSenatorSpeakers:4,
   originalSha1AndSha256VersionsReverified:report.originalRawSha1AndSha256BodyVersionsReverified,
   shortHistoricallyCapturedHtmlPhrasesPresent:report.historicalPageTextPhrasePresent,
   notFound:report.historicalPageTextPhraseNotFound,
   sourceUnknown:report.historicalPageTextUnknown,
   namedSpeakerNearPhraseHeuristic:report.speakerNameNearVerbatimCueInHistoricalHtml,
   individualAudioOrQuoteHumanApproved:0,recordedVotesProven:0,
   noOriginalHtmlOrAudioStored:true,
 }));
}
main().catch(()=>{
 console.error('Public senator reporter original phrase verification failed closed');
 process.exitCode=1;
});
