import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdirSync,writeFileSync} from 'node:fs';
import {researchOriginalCdnMp3s} from './probe-senate-media-mpr-cdn-original-mp3.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--output'||!args[1])throw Error('Require output artifacts path');
const target=resolve(args[1]);
if(!target.startsWith(resolve(root,'artifacts')+'/')||!target.endsWith('.json'))throw Error('Only metadata artifact; audio never persisted');
const r=await researchOriginalCdnMp3s();
mkdirSync(dirname(target),{recursive:true});
writeFileSync(target,JSON.stringify(r,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({exactFirstPartyDerivedUrlHypotheses:r.testedExactPublisherDerivedCDNPaths,
 indexedRawMP3BodyVersionsShaVerified:r.independentlyShaAuthenticatedHistoricalOriginalAudioVersions,
 historicBodyIdenticalToCurrentPublisherMP3:r.shaIdenticalToCurrentPublisherAudioHistoricalVersions,
 outcomes:r.mediaLeadResults.map(x=>({id:x.sourceId,index:x.indexStatus,
 archiveStatuses:x.earliestTwoIndexedHistoricalOriginalAudioReplays.map(y=>({utc:y.captureUtc,status:y.status,sameAsCurrent:y.sameRawBodyAsCurrentPublisherAudio}))})),
 rawMp3Persisted:false,speakerWordsAuthenticated:false}));
