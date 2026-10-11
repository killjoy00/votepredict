/**
 * PUBLIC ONLY: bounded exact-CDX+Wayback id_ replays for selected MPR/Reformer
 * URLs from a checked-in, NON-exhaustive ledger. No arbitrary URL input.
 *
 * node --import tsx scripts/probe-senate-media-public-wayback-batch.ts \
 *   --scope pilot --replay-count 1 \
 *   --output artifacts/senate-media-public-proof-batch.json
 *
 * CI contains NO private database credentials. Metadata report only.
 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  runMediaPublicArchiveBatch,
  type MediaPublicBatchLead,
  type MediaPublicBatchOptions,
} from '../src/evidence/senate-media-public-proof-batch.js';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const LEDGER=resolve(ROOT,'docs/evaluation/senate-media-public-article-discovery-2021-25.json');
function args():MediaPublicBatchOptions & {output:string}{
  const entries=process.argv.slice(2);
  if(entries.length!==6 || entries.length%2!==0)
    throw Error('Use exactly --scope, --replay-count, --output');
  const values:Record<string,string>={};
  for(let i=0;i<entries.length;i+=2){
    const key=entries[i]!,value=entries[i+1]!;
    if(!['--scope','--replay-count','--output'].includes(key)
      || key in values || !value || value.startsWith('--'))
      throw Error('Invalid batch argument');
    values[key]=value;
  }
  const scope=values['--scope'];
  const replay=values['--replay-count'];
  const output=values['--output'];
  if(!['pilot','all'].includes(scope??'')
    || !['0','1','2'].includes(replay??'')
    || !output || output.indexOf('\0')>=0)
    throw Error('Scope must be pilot/all, replay must be 0/1/2, output required');
  const absolute=resolve(output);
  if(!absolute.startsWith(resolve(ROOT,'artifacts')+'/')
    || !/\.json$/.test(absolute))
    throw Error('Public batch report must be JSON under repo artifacts/');
  return {
    scope:scope as 'pilot'|'all',
    replayCount:Number(replay) as 0|1|2,
    concurrency:3,output:absolute,
  };
}
async function main(){
  const options=args();
  const source=readFileSync(LEDGER,'utf8');
  if(Buffer.byteLength(source)>300_000)throw Error('Public research ledger too large');
  const ledger=JSON.parse(source) as {selectedNonExhaustiveArticleLeads?:MediaPublicBatchLead[]};
  if(!Array.isArray(ledger.selectedNonExhaustiveArticleLeads))
    throw Error('Public research ledger missing selected leads');
  const report=await runMediaPublicArchiveBatch(ledger.selectedNonExhaustiveArticleLeads,options);
  mkdirSync(dirname(options.output),{recursive:true});
  writeFileSync(options.output,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({
    version:report.version,scope:report.scope,
    selectedUrlLeads:report.selectedUrlLeadCount,
    exactCdxIndexRequests:report.boundedPublicIndexRequests,
    indexUnreachableOrUnverifiable:report.failedOrUnverifiableIndexLeads,
    indexEmptyResponses:report.completedIndexEmptyLeads,
    indexCandidateResponses:report.completedIndexCandidateLeads,
    exactReplayAttempts:report.replayAttempts,
    indexedPayloadSha1ConsistentReplays:report.indexConsistentOriginalBodyReplays,
    privateSourceMatches:0,humanVerifiedSenatorQuotes:0,
    fullHistoricalPublisherCoverageCertified:false,
    noPrivateArticleBodiesLoggedOrPersisted:true,
  }));
}
main().catch(()=>{
  // Do not echo data-dependent errors or untrusted HTTP payload into CI logs.
  console.error('Public batch configuration or file verification failed');
  process.exitCode=1;
});
