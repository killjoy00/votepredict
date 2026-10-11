/**
 * Public-only #987 new 25 source Wayback probe. Never store original HTML/audio.
 *
 * node --import tsx scripts/probe-senate-media-25-original-wayback.ts \
 *  --scope all --replay-count 2 \
 *  --output artifacts/senate-media-25-original-public-proof.json
 */
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  proveBroaderOriginals,type BroaderLead,type BroaderOptions,
} from '../src/evidence/senate-media-broader-original-wayback.js';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const LEDGER='docs/evaluation/senate-media-2021-25-public-broader-source-discovery.json';
function parse():BroaderOptions&{output:string}{
  const parts=process.argv.slice(2),args:Record<string,string>={};
  if(parts.length!==6)throw Error('Use --scope, --replay-count, --output');
  for(let i=0;i<parts.length;i+=2){
    const k=parts[i]!,v=parts[i+1]!;
    if(!['--scope','--replay-count','--output'].includes(k)
      ||k in args||!v||v.startsWith('--'))throw Error('Invalid source research arguments');
    args[k]=v;
  }
  if(!['priority','all'].includes(args['--scope']??'')
    ||!['0','1','2'].includes(args['--replay-count']??''))
    throw Error('Invalid historical source research mode');
  const output=resolve(args['--output']!);
  if(!output.startsWith(resolve(ROOT,'artifacts')+'/')||!output.endsWith('.json')
    ||output.includes('\0'))throw Error('Unsafe output path');
  return {scope:args['--scope'] as BroaderOptions['scope'],
    replayCount:Number(args['--replay-count']) as BroaderOptions['replayCount'],
    concurrency:2,output};
}
async function main(){
  const opts=parse();
  const raw=readFileSync(resolve(ROOT,LEDGER),'utf8');
  if(Buffer.byteLength(raw)>200_000)throw Error('Original public URL ledger too large');
  const data=JSON.parse(raw) as {
    version?:string;selectedPublicSourceLeads?:BroaderLead[];
    distinctPageCount?:number;noPublisherPublicationCensusOrStatewideDenominator?:boolean;
  };
  if(data.version!=='senate-media-2021-25-public-broader-source-discovery-v1'
    ||data.distinctPageCount!==25
    ||data.noPublisherPublicationCensusOrStatewideDenominator!==true
    ||!Array.isArray(data.selectedPublicSourceLeads))
    throw Error('Unexpected or untrusted 25 URL first-party source ledger');
  const report=await proveBroaderOriginals(data.selectedPublicSourceLeads,opts);
  mkdirSync(dirname(opts.output),{recursive:true});
  writeFileSync(opts.output,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({
    sourceUrlCohort:'new_25_original_public_senate_media_leads',
    selectedUrls:report.selectedLeadCount,
    indexedOriginalUrlCandidates:report.indexCandidateUrls,
    indexUnavailableOrInvalidUnknown:report.indexUnavailableUrls,
    indexEmptyNotPublicationAbsence:report.indexEmptyUrls,
    originalSha1ConsistentBodies:report.indexedSha1ConsistentOriginalBodies,
    distinctOriginalUrlsWithVerifiedBodies:report.distinctOriginalUrlsWithSha1ConsistentBodies,
    historicQuotedWordsVerified:0,
    audioChecked:false,
    noPrivateDataRead:true,
    completePublisherUniverseKnown:false,
  }));
}
main().catch(()=>{
  console.error('Public 25 URL historical archive research failed closed');
  process.exitCode=1;
});
