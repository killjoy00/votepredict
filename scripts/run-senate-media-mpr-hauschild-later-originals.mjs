// Selected two later, not first two, original 2024 MPR episode captures only.
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {writeFileSync,mkdirSync} from 'node:fs';
import {researchLater2024HauschildVersions} from './probe-senate-media-mpr-episode-embeds.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--output'||!args[1])throw Error('Require metadata output path');
const out=resolve(args[1]);if(!out.startsWith(root+'/artifacts/')||!out.endsWith('.json'))throw Error('Metadata-only output');
const result=await researchLater2024HauschildVersions();
mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({indexedHistoricalOriginals:result.totalIndexedHistoricalOriginalPageCandidatesBounded,
 additionalVersionReplays:result.laterHistoricalBodyReplayAttempts,
 additionalShaAuthenticatedOriginals:result.laterOriginalHtmlBodiesShaAuthenticated,
 later:result.laterOriginalVersions.map(x=>({captureUtc:x.captureUtc,status:x.status,cues:x.historicalFragmentPresence,
   publisherAudioUrlCandidates:x.possiblePublisherAudioResourceUrls.length}))}));