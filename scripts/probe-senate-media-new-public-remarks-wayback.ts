/**
 * PUBLIC-ONLY #987/#946 historical archive research: 18 curated senator
 * media-remarks pages (two caucus sites, MPR News, Enterprise Minnesota).
 *
 * node --import tsx scripts/probe-senate-media-new-public-remarks-wayback.ts \
 *   --scope all --replay-count 1 \
 *   --output artifacts/senate-media-new-remarks-public-wayback.json
 *
 * Never emit article HTML/audio, private credentials, human quote approvals,
 * production source modifications, or inferred vote/prediction eligibility.
 */
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  probeNewPublicRemarks,type OriginalRemarkLead,type NewRemarksProbeOptions,
} from '../src/evidence/senate-media-new-public-remarks-wayback.js';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const LEDGER=resolve(ROOT,'docs/evaluation/senate-media-2021-25-public-firsthand-remarks-discovery.json');

function parseArgs():NewRemarksProbeOptions&{output:string}{
  const raw=process.argv.slice(2);
  if(raw.length!==6)throw Error('Expected scope, replay count and output');
  const args:Record<string,string>={};
  for(let i=0;i<raw.length;i+=2){
    const k=raw[i]!,v=raw[i+1]!;
    if(!['--scope','--replay-count','--output'].includes(k) || !v || k in args || v.startsWith('--'))
      throw Error('Unexpected arguments');
    args[k]=v;
  }
  const scope=args['--scope'],replay=args['--replay-count'],output=args['--output'];
  if(!['pilot','all'].includes(scope??'')||!['0','1','2'].includes(replay??'')||!output||output.includes('\0'))
    throw Error('Invalid public archive batch request');
  const absolute=resolve(output);
  if(!absolute.startsWith(resolve(ROOT,'artifacts')+'/')||!absolute.endsWith('.json'))
    throw Error('Public metadata output must be JSON under repo artifacts');
  return {
    scope:scope as 'pilot'|'all',
    replayCount:Number(replay) as 0|1|2,
    concurrency:2,output:absolute,
  };
}
async function main(){
  const args=parseArgs();
  const raw=readFileSync(LEDGER,'utf8');
  if(Buffer.byteLength(raw)>150_000)throw Error('Public lead ledger too large');
  const parsed=JSON.parse(raw) as {
    version?:string;
    selectedNewPublicSourcePages?:OriginalRemarkLead[];
  };
  if(parsed.version!=='senate-media-2021-25-public-firsthand-remarks-discovery-v1'
    || !Array.isArray(parsed.selectedNewPublicSourcePages))
    throw Error('Unexpected public lead ledger');
  const report=await probeNewPublicRemarks(parsed.selectedNewPublicSourcePages,args);
  mkdirSync(dirname(args.output),{recursive:true});
  writeFileSync(args.output,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  // No raw archive/publisher response content appears in CI console.
  console.log(JSON.stringify({
    scope:report.scope,
    checkedInLeads:report.checkedInLeadCount,
    selectedLeads:report.selectedLeadCount,
    indexCandidates:report.candidateIndexLeads,
    indexFailuresUnknown:report.failedIndexLeads,
    indexEmptyNotAbsence:report.emptyIndexLeads,
    originalReplayAttempts:report.replayAttempts,
    indexedSha1ConsistentHtmlBodies:report.indexConsistentOriginalHttpBodies,
    distinctOriginalUrlsWithMatchedBodies:report.distinctOriginalUrlsWithConsistentBodies,
    humanVerifiedOriginalSenatorQuotations:0,
    initialPublicationTimesVerified:0,
    publicPublisherArticleUniverseKnown:false,
    privateVotePredictDatabaseAccessed:false,
  }));
}
main().catch(()=>{
  console.error('Public remarks historical archive research failed closed');
  process.exitCode=1;
});
