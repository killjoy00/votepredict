/**
 * #987/#946 PUBLIC ONLY, one selected media lead, bounded Wayback CDX search
 * and optional exact indexed-original HTTP replay. No private export/DB.
 *
 * node --import tsx scripts/probe-senate-media-public-wayback.ts \
 *   --lead-id mpr-2024-hauschild-north-star-on-air-interview --replay-count 1
 *
 * This helper never stores article bytes or attributes remarks.
 */
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {
  discoverMediaPublicCdxCaptures,
  verifyMediaPublicCdxReplay,
  type PublicMediaResearchLead,
} from '../src/evidence/senate-media-public-wayback-probe.js';

const REPO=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const LEDGER=resolve(REPO,'docs/evaluation/senate-media-public-article-discovery-2021-25.json');

function args():{id:string;replayCount:number}{
  const values=process.argv.slice(2);
  const allowed=new Set(['--lead-id','--replay-count']);
  if(values.length%2!==0)throw Error('Expected --lead-id and optional --replay-count');
  const parsed:Record<string,string>={};
  for(let i=0;i<values.length;i+=2){
    const key=values[i]!,value=values[i+1]!;
    if(!allowed.has(key)||key in parsed || !value || value.startsWith('--'))
      throw Error('Unexpected or repeated archive probe argument');
    parsed[key]=value;
  }
  const id=parsed['--lead-id'];
  if(!id||!/^[a-z0-9-]{5,100}$/.test(id))
    throw Error('Require one selected public media --lead-id');
  const n=parsed['--replay-count']??'1';
  if(!/^[012]$/.test(n))
    throw Error('Replay at most two original captures per invocation');
  return {id,replayCount:Number(n)};
}
function ledgerLead(id:string):PublicMediaResearchLead{
  const raw=readFileSync(LEDGER,'utf8');
  if(Buffer.byteLength(raw)>300_000)throw Error('Public research ledger above size cap');
  const parsed=JSON.parse(raw) as {selectedNonExhaustiveArticleLeads?:PublicMediaResearchLead[]};
  const leads=parsed.selectedNonExhaustiveArticleLeads;
  if(!Array.isArray(leads)||leads.length>500)
    throw Error('Invalid checked-in public media lead list');
  const candidates=leads.filter(x=>x?.id===id);
  if(candidates.length!==1)throw Error('Public lead ID not present exactly once in ledger');
  return candidates[0]!;
}
async function main():Promise<void>{
  const {id,replayCount}=args();
  const lead=ledgerLead(id);
  const index=await discoverMediaPublicCdxCaptures(lead);
  const replays=[];
  for(const [i,capture]of index.captures.slice(0,replayCount).entries()){
    if(i>0)await new Promise(r=>setTimeout(r,750));
    replays.push(await verifyMediaPublicCdxReplay(capture));
  }
  console.log(JSON.stringify({
    version:index.version,
    publicResearchLead:id,
    sourcePublisherUrl:index.originalUrl,
    indexedCaptureWindow:'2021-2025-UTC',
    indexStatus:index.status,
    indexRecordsReturned:index.captures.length,
    indexFirstPageMayHaveMore:index.resultLimitReachedMayHaveMoreCaptures,
    indexCaptures:index.captures.map(x=>({
      captureUtc:x.archiveCapturedAt,
      exactTimestampedIdOriginalUrl:x.archiveUrl,
      indexedCdxSha1Base32:x.indexedPayloadSha1Base32,
      articleBodyRetrievedOrAuthenticatedByIndexAlone:false,
    })),
    replayAttempts:replays,
    originalBodyBytesPersisted:false,
    matchingPrivateVotePredictSourceShaEstablished:false,
    publisherInitialPublicationClockVerified:false,
    individualSenatorQuoteReviewedOrApproved:false,
    historicalForecastEligibilityEstablished:false,
    interpretedAsPublisherArticleCensus:false,
    note:'CDX metadata alone is not an original article. A CDX SHA-1 matched replay verifies consistency with that index only. No private VotePredict SHA-256, original media publication, audio/transcript version, senator speaker or historical prediction cutoff is established.',
  },null,2));
}
main().catch(e=>{
  const message=e instanceof Error?e.message:'Public Wayback probe failed';
  // Do not echo potentially untrusted URL payloads, response text or filenames.
  const safe=/^([a-zA-Z0-9 ,.–():-]{1,120})$/.test(message)
    ?message:'Wayback response not verifiable';
  console.error(JSON.stringify({status:'probe_failed_no_historical_capture_verified',reason:safe}));
  process.exitCode=1;
});
