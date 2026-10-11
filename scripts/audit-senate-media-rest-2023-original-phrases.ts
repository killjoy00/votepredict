/**
 * PUBLIC-ONLY two timestamped 2023 Ann Rest reporter quote cues. Do not
 * persist article HTML, quotations, original audio, private data or votes.
 *
 * node --import tsx scripts/audit-senate-media-rest-2023-original-phrases.ts \
 *  --output artifacts/senate-media-rest-2023-original-phrase-proof.json
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {auditRestOriginalQuotes,type RestQueue,type RestArticleLead,
  type RestOriginalReceiptManifest} from '../src/evidence/senate-media-rest-2023-original-quote-audit.js';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const QUEUE='docs/evaluation/senate-media-2023-rest-historical-original-quote-fragment-queue.json';
const LEADS='docs/evaluation/senate-media-2021-25-public-broader-source-discovery.json';
const PIN='docs/evaluation/senate-media-2021-25-broader-25-original-public-archive-receipts-20261011.json';
function safeJson(file:string,limit:number):unknown{
  const raw=readFileSync(resolve(ROOT,file),'utf8');
  if(Buffer.byteLength(raw)>limit)throw Error('Historical source metadata exceeded bounded size');
  return JSON.parse(raw) as unknown;
}
async function main(){
  const arg=process.argv.slice(2);
  if(arg.length!==2||arg[0]!=='--output'||!arg[1])throw Error('Expected public metadata --output');
  const output=resolve(arg[1]);
  if(!output.startsWith(resolve(ROOT,'artifacts')+'/')
    ||!output.endsWith('.json')||output.includes('\0'))
    throw Error('Refuse writing article research outside metadata artifacts');
  const queue=safeJson(QUEUE,15_000) as RestQueue;
  const ledger=safeJson(LEADS,200_000) as {
    version?:string;selectedPublicSourceLeads?:RestArticleLead[];
  };
  const prior=safeJson(PIN,130_000) as RestOriginalReceiptManifest;
  if(ledger.version!=='senate-media-2021-25-public-broader-source-discovery-v1'
    ||!Array.isArray(ledger.selectedPublicSourceLeads))
    throw Error('Untrusted public source ledger for 2023 Rest article');
  const outputReport=await auditRestOriginalQuotes(
    queue,ledger.selectedPublicSourceLeads,prior);
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output,JSON.stringify(outputReport,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({
    exactArchivedRawBodiesRequested:2,
    originalSha1AndSha256Reverified:outputReport.sha1AndSha256ReverifiedOriginals,
    unavailableOriginalVersions:outputReport.sourceOriginalHttpVersionsUnverified,
    historicalHtmlPhraseCuesPresent:outputReport.historicalHtmlPhraseFound,
    historicalHtmlPhraseCuesAbsent:outputReport.historicalHtmlPhraseNotFound,
    historicalHtmlPhraseUnknown:outputReport.historicalHtmlUnknown,
    originalHtmlSameParagraphRestNameHeuristic:outputReport.historicalHtmlSameParagraphSpeakerLabelCues,
    originalReporterAudioCompared:false,senatorQuoteHumanApproved:0,
    actualSenateRecordedVotesEstablished:0,rawTextSaved:false,
  }));
}
main().catch(()=>{
  console.error('Public 2023 historical original Rest quote audit failed closed');
  process.exitCode=1;
});
