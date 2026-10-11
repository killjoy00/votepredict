/**
 * PUBLIC METADATA ONLY: pin previously matched archive HTML bodies to exact
 * Actions #38109279186 SHA256/length before searching their visible text.
 * No arbitrary publisher URLs, credentials, cached raw bodies, quote review.
 *
 * node --import tsx scripts/audit-senate-media-pinned-original-passages-public.ts \
 *    --output artifacts/senate-media-pinned-original-passages.json
 */
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdirSync,writeFileSync} from 'node:fs';
import {runPinnedPublicPassageAudit} from
  '../src/evidence/senate-media-pinned-public-passage-audit.js';

async function main(){
  const args=process.argv.slice(2);
  if(args.length!==2||args[0]!=='--output'||!args[1])
    throw Error('Require one public artifact output path');
  const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..');
  const destination=resolve(args[1]);
  if(!destination.startsWith(resolve(repo,'artifacts')+'/')
    || !destination.endsWith('.json'))throw Error('Public result path must be artifacts/*.json');
  const report=await runPinnedPublicPassageAudit();
  mkdirSync(dirname(destination),{recursive:true});
  writeFileSync(destination,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({
    version:report.version,
    originalPilotRunId:report.originalPublicArchivePilotRunId,
    pinnedSources:report.replayArchiveRecords.length,
    exactSameOriginalArchiveSha256Bodies:report.exactKnownOriginalHtmlBodiesReobserved,
    archivedVisibleShortExcerptMatches:report.foundShortExcerptInOriginalVisibleHtml,
    boundedSenatorSpeakerTurnMatches:report.foundSpeakerTurnAndExpectedExcerpt,
    actualSpeakerQuotesHumanVerified:0,originalAudioAuthenticated:0,
    privateSourceDocumentsMatched:0,
    originalHtmlOrExactQuotesLogged:false,
    noDatabaseOrForecastEffects:true,
  }));
}
main().catch(()=>{
  console.error('Pinned public HTML proof run failed to produce a safe report');
  process.exitCode=1;
});
