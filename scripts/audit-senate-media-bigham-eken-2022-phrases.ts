/**
 * #987 PUBLIC only: re-verify two separately attributed 2022 Bigham/Eken
 * quote cues in two exact independently SHA256-pinned original HTML captures.
 *
 * node --import tsx scripts/audit-senate-media-bigham-eken-2022-phrases.ts \
 *  --output artifacts/senate-media-bigham-eken-2022-original-phrase-proof.json
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {auditTwoSpeakerHistoricalMarkup,
  type TwoSpeakerQueue,type TwoSpeakerLedger,type TwoSpeakerFirstAndSecondRun,
} from '../src/evidence/senate-media-bigham-eken-2022-original-speaker-audit.js';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const Q='docs/evaluation/senate-media-2022-bigham-eken-historical-original-speaker-queue.json';
const L='docs/evaluation/senate-media-2021-25-public-broader-source-discovery.json';
const P='docs/evaluation/senate-media-2021-25-broader-25-original-public-archive-receipts-20261011.json';
function load(file:string,limit:number):unknown{
  const value=readFileSync(resolve(ROOT,file),'utf8');
  if(Buffer.byteLength(value)>limit)throw Error('Research metadata source too large');
  return JSON.parse(value) as unknown;
}
async function main(){
  const args=process.argv.slice(2);
  if(args.length!==2||args[0]!=='--output'||!args[1])
    throw Error('Expected exactly one metadata-only --output');
  const out=resolve(args[1]);
  if(!out.startsWith(resolve(ROOT,'artifacts')+'/')
    ||!out.endsWith('.json')||out.includes('\0'))
    throw Error('Refuse to write historical source article output outside metadata artifacts');
  const q=load(Q,15_000) as TwoSpeakerQueue;
  const leads=load(L,200_000) as {
    version?:string;selectedPublicSourceLeads?:TwoSpeakerLedger[];
  };
  const pins=load(P,130_000) as TwoSpeakerFirstAndSecondRun;
  if(leads.version!=='senate-media-2021-25-public-broader-source-discovery-v1'
    ||!Array.isArray(leads.selectedPublicSourceLeads))
    throw Error('Untrusted 2022 original senator source ledger');
  const report=await auditTwoSpeakerHistoricalMarkup(q,leads.selectedPublicSourceLeads,pins);
  mkdirSync(dirname(out),{recursive:true});
  writeFileSync(out,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({
    singleOriginalPublisherArticle:1,
    separatelyNamedSenators:2,
    originalArchivedPageVersionsRequested:2,
    indexedSha1AndRawSha256Reverified:report.rawOriginalVersionsSha1AndSha256Reverified,
    historicalMarkupShortPhrasesPresent:report.historicMarkupShortPhraseFound,
    historicalMarkupShortPhrasesNotFound:report.historicMarkupShortPhraseAbsent,
    sameParagraphCorrectSpeakerLabelClues:report.sameParagraphCorrectSpeakerLabelCues,
    audioOriginallyCompared:false,humanApprovedQuoteCount:0,
    recordedMemberVotesProven:0,rawHtmlOrAudioPersisted:false,
  }));
}
main().catch(()=>{
  console.error('Historical original two-senator public speaker research failed closed');
  process.exitCode=1;
});
