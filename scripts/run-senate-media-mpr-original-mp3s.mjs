import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {auditMprSourceMp3s} from './probe-senate-media-mpr-original-mp3s.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--output'||!args[1])throw Error('Require --output artifacts/*.json');
const out=resolve(args[1]);
if(!out.startsWith(resolve(root,'artifacts')+'/')||!out.endsWith('.json'))throw Error('Public evidence metadata only');
const ledger=JSON.parse(readFileSync(resolve(root,'docs/evaluation/senate-media-mpr-2021-and-2024-original-episode-audio-link-receipts-20261011.json'),'utf8'));
const result=await auditMprSourceMp3s(ledger);
mkdirSync(dirname(out),{recursive:true});
writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({historicallyAuthenticatedOriginalMp3s:result.originalHistoricalAudioBinariesAuthenticated,
 currentPublisherMp3sWithHashes:result.publisherMp3DirectCurrentHashCount,
 perEpisode:result.episodes.map(x=>({id:x.episodeId,historicalIndex:x.archiveIndexStatus,
 originalReplayStatuses:x.archiveReplayVersions.map(y=>({utc:y.captureUtc,status:y.status})),
 currentPublisherMediaResourceStatus:x.currentOriginalPublisherResourceStatus.fetchStatus}))}));