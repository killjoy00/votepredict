/**
 * Public archival senator quote source study (#987), 7 separately reported
 * original news article URLs, 14 SHA-pinned historic HTTP captures, 28 tiny
 * text checks. Saves metadata-only receipts, never original HTML/audio.
 *
 * node --import tsx scripts/audit-senate-media-seven-reporter-originals.ts \
 *   --output artifacts/senate-media-seven-reporter-original-quotes.json
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {auditSevenIndependentHistoricalSenatorRemarks,
 type SevenOriginalQueue,type IndependentSourceLead,type EarlierIndependentReporterReceipt,
} from '../src/evidence/senate-media-seven-independent-articles-original-quote-audit.js';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function input(path:string,max:number):unknown{
 const text=readFileSync(resolve(ROOT,'docs/evaluation',path),'utf8');
 if(Buffer.byteLength(text)>max)throw Error('Public immutable original source metadata size limit exceeded');
 return JSON.parse(text) as unknown;
}
async function main(){
 const args=process.argv.slice(2);
 if(args.length!==2||args[0]!=='--output'||!args[1])throw Error('Require exactly one --output artifacts/*.json');
 const output=resolve(args[1]);
 if(!output.startsWith(resolve(ROOT,'artifacts')+'/')||!output.endsWith('.json')||output.includes('\0'))
   throw Error('Original reporter article or audio bytes must never be persisted');
 const queue=input('senate-media-seven-remaining-authentic-independent-reporter-quote-queue-20261011.json',60_000) as SevenOriginalQueue;
 const lead=input('senate-media-2021-25-further-independent-reporting-15-leads.json',180_000) as{
   version:string;newIndividuallyNamedSenatorSpeakerCandidates:number;
   independentOriginalReporterArticleLeads:IndependentSourceLead[];
 };
 const proof=input('senate-media-2021-25-independent-reporter-15-historical-original-receipts-20261011.json',180_000) as EarlierIndependentReporterReceipt;
 if(lead.version!=='public-2021-25-further-independent-15-reformer-articles-v1'
   ||lead.newIndividuallyNamedSenatorSpeakerCandidates!==24
   ||!Array.isArray(lead.independentOriginalReporterArticleLeads))
   throw Error('Unknown current-source original state senator attribution ledger');
 const report=await auditSevenIndependentHistoricalSenatorRemarks(queue,lead.independentOriginalReporterArticleLeads,proof);
 mkdirSync(dirname(output),{recursive:true});
 writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log(JSON.stringify({
  publicReporterOriginalArticleUrls:7,
  individuallyNamedServingSenators:7,
  historicalPageVersionAttempts:report.originalArchiveHttpBodyVersionsRequested,
  originalVersionsSha1AndPriorSha256Verified:report.originalBodiesReverifiedIndexedSha1AndPriorSha256,
  rawOriginalUnavailableUnknown:report.originalBodiesUnknownOrUnverified,
  positiveShortHistoricalTextCueChecks:report.shortTextHistoricallyPresent,
  negativeShortHistoricalTextCueChecks:report.shortTextHistoricallyAbsent,
  unknownShortHistoricalTextCueChecks:report.shortTextHistoricallyUnknown,
  fullNameSameParagraphProximityClues:report.speakerFullNameInSameParagraphClues,
  surnameSameParagraphClues:report.speakerSurnameInSameParagraphClues,
  authenticOriginalSpokenAudioCompared:false,
  fullHumanApprovedIndividualSenatorUtterances:0,
  individuallyAuthenticatedRecordedSenateMemberVotes:0,
  articleHtmlOrAudioSaved:false,
  productionSourceCollectorTouched:false,
 }));
}
main().catch(()=>{console.error('Public seven-original-reporter-senator-wording audit failed closed');process.exitCode=1;});
