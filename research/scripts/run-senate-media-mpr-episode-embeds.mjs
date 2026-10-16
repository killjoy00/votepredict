// Public original MPR /episode/ source audit. Never persist original HTML or audio.
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {researchMprEpisodes} from '../../scripts/probe-senate-media-mpr-episode-embeds.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--output'||!args[1])throw Error('Require --output artifacts/*.json');
const out=resolve(args[1]);
if(!out.startsWith(resolve(root,'artifacts')+'/')||!out.endsWith('.json'))
 throw Error('Only original-source evidence metadata artifacts may be saved');
const research=await researchMprEpisodes();
mkdirSync(dirname(out),{recursive:true});
writeFileSync(out,JSON.stringify(research,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({checkedEpisodes:research.nonexhaustiveOriginalMprEpisodeCount,
 authenticatedOriginalHtmlVersions:research.indexedOriginalHtmlBodiesAuthenticated,
 archivedAudioVerified:research.originalAudioAuthenticationCount,
 perEpisode:research.episodes.map(e=>({id:e.id,index:e.indexStatus,
  historicalBodies:e.historicalCaptureReplays.map(c=>({utc:c.captureUtc,status:c.status,
   shortCueResults:c.historicalFragmentPresence,publisherMediaUrlCandidates:c.possiblePublisherAudioResourceUrls.length}))}))}));