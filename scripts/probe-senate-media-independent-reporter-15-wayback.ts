/**
 * Research on 15 original independently reported Minnesota state senator
 * media stories; metadata-only URL/capture/hash reports.
 *
 * node --import tsx scripts/probe-senate-media-independent-reporter-15-wayback.ts \
 *   --scope all --replay-count 2 --output artifacts/independent-reporter-15-original-proofs.json
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {probeIndependentJournalistOriginals,type JournalistLead,
  type JournalistOptions} from '../src/evidence/senate-media-independent-reporter-15-wayback.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const PATH='docs/evaluation/senate-media-2021-25-further-independent-reporting-15-leads.json';
function parseArgs():JournalistOptions&{output:string}{
  const args=process.argv.slice(2);
  if(args.length!==6)throw Error('Expected --scope --replay-count --output');
  const d:Record<string,string>={};
  for(let i=0;i<args.length;i+=2){
    const k=args[i]!,v=args[i+1]!;
    if(!['--scope','--replay-count','--output'].includes(k)
      ||!v||k in d||v.startsWith('--'))throw Error('Untrusted research arguments');
    d[k]=v;
  }
  if(!['priority','all'].includes(d['--scope']??'')
    ||!['0','1','2'].includes(d['--replay-count']??''))
    throw Error('Invalid bounded reporter archive probe');
  const output=resolve(d['--output']!);
  if(!output.startsWith(resolve(root,'artifacts')+'/')||!output.endsWith('.json')
    ||output.includes('\0'))throw Error('Only metadata JSON research artifacts may be saved');
  return {scope:d['--scope'] as JournalistOptions['scope'],
    replayCount:Number(d['--replay-count']) as JournalistOptions['replayCount'],
    concurrency:3,output};
}
async function main(){
  const opts=parseArgs();
  const raw=readFileSync(resolve(root,PATH),'utf8');
  if(Buffer.byteLength(raw)>200_000)throw Error('Untrusted large source data');
  const d=JSON.parse(raw) as {
    version?:string;newOriginalArticleUrlLeads?:number;
    newIndividuallyNamedSenatorSpeakerCandidates?:number;
    noPublicationCensusOrStatewideSenatorYearDenominator?:boolean;
    independentOriginalReporterArticleLeads?:JournalistLead[];
  };
  if(d.version!=='public-2021-25-further-independent-15-reformer-articles-v1'
    ||d.newOriginalArticleUrlLeads!==15
    ||d.newIndividuallyNamedSenatorSpeakerCandidates!==21
    ||!Array.isArray(d.independentOriginalReporterArticleLeads))
    throw Error('Unknown original independent newsroom public source cohort');
  const report=await probeIndependentJournalistOriginals(
    d.independentOriginalReporterArticleLeads,opts);
  mkdirSync(dirname(opts.output),{recursive:true});
  writeFileSync(opts.output,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({
    sourceClass:'independent_reporter_original_publisher_article',
    exactOriginalArticleUrls:report.selectedOriginalArticleUrls,
    indexCandidates:report.indexedCandidateUrlLeads,
    unavailableIndicesUnknown:report.indexUnavailableOrInvalidUrlLeads,
    emptyIndicesNotHistoricalArticleAbsence:report.indexEmptyUrlLeads,
    originalHttpBodiesIndexedSha1Matched:report.sha1MatchedActualOriginalHttpBodies,
    distinctOriginalPageUrlsWithMatchedBodies:report.distinctReporterArticleUrlsWithAuthenticatedOriginalBodies,
    originalAudioCompared:false,humanVerifiedFullSenatorQuotes:0,
    actualRecordedSenateFloorOrCommitteeVotes:0,
    noProductionIngestOrPrivateDatabase:true,
  }));
}
main().catch(()=>{
  console.error('Public independent journalist original archive research failed closed');
  process.exitCode=1;
});
