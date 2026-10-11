/**
 * PUBLIC-ONLY early original source quote snippet audit (#987).
 *
 * node --import tsx scripts/audit-senate-media-eight-early-original-phrases.ts \
 *  --output artifacts/senate-media-eight-early-original-phrases.json
 *
 * Only previously pinned historical response byte SHA1 and SHA256 provenance
 * and eight SHORT text cue presence statuses; never saves original article.
 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {auditEightEarlyOriginalPhrases,type EightQueue,type EightLead,
  type EightHistoricManifest} from '../src/evidence/senate-media-eight-early-original-text-audit.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const cuePath='docs/evaluation/senate-media-2021-25-eight-further-original-phrase-queue.json';
const leadPath='docs/evaluation/senate-media-2021-25-public-broader-source-discovery.json';
const manifestPath='docs/evaluation/senate-media-2021-25-broader-25-original-public-archive-receipts-20261011.json';
function boundedJson(path:string,max:number):unknown{
  const raw=readFileSync(resolve(root,path),'utf8');
  if(Buffer.byteLength(raw)>max)throw Error('Research metadata input too large');
  return JSON.parse(raw) as unknown;
}
async function main(){
  const args=process.argv.slice(2);
  if(args.length!==2||args[0]!=='--output'||!args[1])
    throw Error('Expected exact --output artifacts/*.json');
  const out=resolve(args[1]);
  if(!out.startsWith(resolve(root,'artifacts')+'/')||!out.endsWith('.json')||out.includes('\0'))
    throw Error('Original article data must never be saved outside metadata artifacts');
  const q=boundedJson(cuePath,45_000) as EightQueue;
  const ledger=boundedJson(leadPath,160_000) as {
    version?:string;selectedPublicSourceLeads?:EightLead[];
  };
  const manifest=boundedJson(manifestPath,130_000) as EightHistoricManifest;
  if(ledger.version!=='senate-media-2021-25-public-broader-source-discovery-v1'
    ||!Array.isArray(ledger.selectedPublicSourceLeads))
    throw Error('Unknown public original senator URL source cohort');
  const report=await auditEightEarlyOriginalPhrases(q,ledger.selectedPublicSourceLeads,manifest);
  mkdirSync(dirname(out),{recursive:true});
  writeFileSync(out,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({
    sourceUrls:8,archivedOriginalSha1Sha256Verified:report.sha1AndSha256ReverifiedOriginalHtmlBodies,
    shortHistoricalOriginalTextCuePresent:report.shortPhrasePresentInVerifiedOriginalHtml,
    shortOriginalTextCueAbsent:report.shortPhraseAbsentFromVerifiedOriginalHtml,
    sourceReplayUnknown:report.indexOrReplayFailuresUnknown,
    nearbyHistoricalSpeakerLabels:report.speakerNameNearbyPrior600VisibleCharacters,
    audioCompared:false,humanApprovedSenatorQuotes:0,recordedVotesProven:0,
    originalArticleTextStored:false,sourcePublisherUniverseCensus:false,
  }));
}
main().catch(()=>{
  console.error('Public senator historical quote cue study failed closed');
  process.exitCode=1;
});
