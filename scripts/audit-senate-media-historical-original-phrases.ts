/**
 * Public-only, metadata-only exact archived Senate speaker-phrase cue research.
 *
 * node --import tsx scripts/audit-senate-media-historical-original-phrases.ts \
 *   --output artifacts/senate-media-historical-original-phrase-cues.json
 *
 * Uses only six independently SHA256-pinned historical HTTP article body
 * versions: no database, source ingest, prediction, audio or quoted text in
 * stdout/artifacts. Rendered text substring hits are NOT quote approvals.
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  auditHistoricalMediaPhraseCues,
  type HistoricPhraseCue,
  type HistoricalOriginalLedgerLead,
  type HistoricalReviewReceipts,
} from '../src/evidence/senate-media-historical-phrase-presence.js';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const CUES='docs/evaluation/senate-media-2021-25-pinned-historical-original-phrase-review-queue.json';
const ORIGINALS='docs/evaluation/senate-media-2021-25-public-firsthand-remarks-discovery.json';
const RECEIPTS='docs/evaluation/senate-media-2021-25-new-public-original-replay-receipts-20261011.json';
function safeJson(path:string,byteCap:number):unknown{
  const raw=readFileSync(resolve(ROOT,path),'utf8');
  if(Buffer.byteLength(raw)>byteCap)throw Error('Public evidence input too large');
  return JSON.parse(raw) as unknown;
}
function parseOutput():string{
  const args=process.argv.slice(2);
  if(args.length!==2||args[0]!=='--output'||!args[1])
    throw Error('Expected exactly --output artifacts/NAME.json');
  const out=resolve(args[1]);
  const prefix=resolve(ROOT,'artifacts')+'/';
  if(!out.startsWith(prefix)||!out.endsWith('.json')||out.includes('\0'))
    throw Error('Refusing to write outside public research metadata artifacts');
  return out;
}
async function main(){
  const output=parseOutput();
  const data=safeJson(CUES,80_000) as {
    version?:string;cues?:HistoricPhraseCue[];
    sourceReceipts?:string;currentSourceUrlLedger?:string;
  };
  const source=safeJson(ORIGINALS,130_000) as {
    version?:string;selectedNewPublicSourcePages?:HistoricalOriginalLedgerLead[];
  };
  const receipts=safeJson(RECEIPTS,95_000) as HistoricalReviewReceipts&{version?:string};
  if(data.version!=='senate-media-2021-25-selected-historical-original-phrase-review-v1'
    ||data.sourceReceipts!==RECEIPTS||data.currentSourceUrlLedger!==ORIGINALS
    ||!Array.isArray(data.cues)
    ||source.version!=='senate-media-2021-25-public-firsthand-remarks-discovery-v1'
    ||!Array.isArray(source.selectedNewPublicSourcePages)
    ||receipts.version!=='senate-media-2021-25-new-public-original-replay-receipts-v1')
    throw Error('Unexpected original historical research version');
  const result=await auditHistoricalMediaPhraseCues(data.cues,
    source.selectedNewPublicSourcePages,receipts);
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({
    originalPagesRequested:result.exactDistinctArchivedHttpBodiesRequested,
    sha256ReverifiedHistoricalBodies:result.originalBodiesSha256Reverified,
    originalBodiesUnknown:result.originalBodiesFailedOrUnresolved,
    shortHistoricalMarkupPhraseCues:result.shortPhraseCuesTested,
    presentInDigestMatchedOriginalMarkup:result.cuesFoundInHashReverifiedHtmlText,
    absentFromDigestMatchedOriginalMarkup:result.cuesNotFoundInHashReverifiedHtmlText,
    unverifiedBecauseOriginalUnavailable:result.cuesWithUnavailableOrUnverifiedOriginal,
    humanApprovedSenatorQuotes:0,firstPublisherDateTimeProven:false,
    audioCompared:false,privateEvidenceCompared:false,sourceTextSaved:false,
  }));
}
main().catch(()=>{
  console.error('Public original senator-phrase cue research failed closed');
  process.exitCode=1;
});
